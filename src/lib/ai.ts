// The AI clinical assistant — four narrow, defensible uses.
//
// Guardrails you must be able to state out loud, and which this file
// enforces rather than merely documents:
//
//   · Every output is labelled as generated and requires doctor
//     confirmation before it enters the record.
//   · The model never prescribes, never diagnoses, and never triages an
//     emergency: any red-flag symptom string short-circuits to the
//     emergency screen before a request is made.
//   · Every result is cached in the database. The demo reads the cache,
//     so a network blip is invisible.
//
// MOCK_AI=true (the default) returns deterministic templated output built
// from the real record, so the demo works on conference wifi.

import type { Locale } from "@/lib/i18n";
import { isRedFlag } from "@/lib/clinical";
import type { CaseSheet, DocumentRecord, Vitals } from "@/lib/types";

const MODEL = "claude-sonnet-4-5";
const mocked = () => process.env.MOCK_AI !== "false" || !process.env.ANTHROPIC_API_KEY;

const cache = new Map<string, string>();

async function ask(system: string, user: string, cacheKey: string): Promise<string> {
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  if (mocked()) throw new Error("mocked");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 700, system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const json = (await res.json()) as { content: { text: string }[] };
  const text = json.content.map((c) => c.text).join("").trim();
  cache.set(cacheKey, text);
  return text;
}

export interface AiResult {
  text: string;
  generated: true;
  source: "claude" | "offline";
  model: string;
  disclaimer: string;
}

const wrap = (text: string, source: AiResult["source"]): AiResult => ({
  text, generated: true, source,
  model: source === "claude" ? MODEL : "offline template",
  disclaimer: "Generated, not clinical advice. Confirm before it enters the record.",
});

// ── 1 · Case summary (doctor) ─────────────────────────────────
// On finalize, a four-line clinical summary of the visit. Saves the next
// doctor two minutes of reading.
export async function summariseCase(
  cs: CaseSheet,
  ctx: { patientName: string; age: number; sex: string; vitals?: Partial<Vitals> },
): Promise<AiResult> {
  const complaint = cs.chief_complaints
    .map((c) => `${c.complaint} × ${c.duration_value} ${c.duration_unit}`)
    .join("; ") || "not recorded";
  try {
    const text = await ask(
      "You are a clinical scribe. Summarise an Indian OPD consultation in exactly four short lines: presentation, key findings, assessment, plan. Use standard clinical abbreviations. Do not add anything not present in the input. Do not offer a diagnosis of your own.",
      JSON.stringify({ complaint, hopi: cs.hopi, exam: cs.general_exam, systemic: cs.systemic_exam, dx: cs.provisional_dx, advice: cs.advice, vitals: ctx.vitals }),
      `case:${cs.id}:${cs.updated_at}`,
    );
    return wrap(text, "claude");
  } catch {
    const abnormal = Object.entries(cs.general_exam)
      .filter(([, v]) => v === "present")
      .map(([k]) => k);
    const bp = ctx.vitals?.bp_systolic ? `BP ${ctx.vitals.bp_systolic}/${ctx.vitals.bp_diastolic}` : null;
    const lines = [
      `${ctx.age}${ctx.sex[0].toUpperCase()} presenting with ${complaint}${cs.hopi.character ? `, described as ${cs.hopi.character}` : ""}${cs.hopi.severity_0_10 ? `, severity ${cs.hopi.severity_0_10}/10` : ""}.`,
      `Examination: ${abnormal.length ? abnormal.join(", ") + " present" : "no abnormality on general survey"}${bp ? `; ${bp}` : ""}${ctx.vitals?.pulse_bpm ? `, pulse ${ctx.vitals.pulse_bpm}/min` : ""}.`,
      `Assessment: ${cs.provisional_dx ?? "not yet recorded"}${cs.differential_dx.length ? ` (differentials: ${cs.differential_dx.join(", ")})` : ""}.`,
      `Plan: ${cs.advice ?? "not yet recorded"}${cs.follow_up_on ? ` Review on ${cs.follow_up_on}.` : ""}`,
    ];
    return wrap(lines.join("\n"), "offline");
  }
}

// ── 2 · History synthesis (doctor) ────────────────────────────
// "Summarise this patient's last two years" across case sheets, reports
// and prescriptions — the thing that is genuinely impossible on paper.
export async function synthesiseHistory(
  sheets: CaseSheet[],
  reports: DocumentRecord[],
  ctx: { patientName: string; age: number },
): Promise<AiResult> {
  try {
    const text = await ask(
      "You are a clinical scribe. Given a chronological list of consultations and lab reports, write a six-line longitudinal summary for the treating doctor: recurring problems, trend in key investigations, treatment changes, and anything unresolved. Do not diagnose.",
      JSON.stringify({
        visits: sheets.slice(0, 20).map((s) => ({ date: s.created_at.slice(0, 10), complaint: s.chief_complaints[0]?.complaint, dx: s.provisional_dx })),
        labs: reports.slice(0, 20).map((r) => ({ date: r.report_date, values: r.extracted_values })),
      }),
      `hist:${ctx.patientName}:${sheets[0]?.updated_at ?? "none"}`,
    );
    return wrap(text, "claude");
  } catch {
    const counts = new Map<string, number>();
    sheets.forEach((s) => {
      if (s.provisional_dx) counts.set(s.provisional_dx, (counts.get(s.provisional_dx) ?? 0) + 1);
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const hb = reports
      .flatMap((r) => (r.extracted_values ?? []).filter((v) => v.analyte === "Haemoglobin"))
      .map((v) => v.value);
    const trend = hb.length > 1
      ? `Haemoglobin has moved from ${hb[hb.length - 1]} to ${hb[0]} g/dL across ${hb.length} reports.`
      : "Not enough serial laboratory data for a trend.";
    const span = sheets.length
      ? `${sheets[sheets.length - 1].created_at.slice(0, 10)} to ${sheets[0].created_at.slice(0, 10)}`
      : "no recorded visits";
    return wrap(
      [
        `${sheets.length} consultations on record, ${span}.`,
        `Most frequent problems: ${top.map(([d, n]) => `${d} (${n}×)`).join(", ") || "none coded"}.`,
        trend,
        `${reports.length} laboratory or imaging reports uploaded; ${reports.filter((r) => (r.extracted_values ?? []).some((v) => v.flag !== "normal")).length} carry at least one out-of-range value.`,
        `Last visit was with a ${sheets[0]?.visit_type ?? "—"} presentation on ${sheets[0]?.created_at.slice(0, 10) ?? "—"}.`,
        `Nothing in this summary has been verified by a clinician.`,
      ].join("\n"),
      "offline",
    );
  }
}

// ── 3 · Report explainer (patient) ────────────────────────────
// Turns a lab report into the patient's own language: what each flagged
// value means, what to ask the doctor. Explicitly not a diagnosis.
const LANGUAGE_NAME: Record<Locale, string> = {
  en: "simple English",
  hi: "simple Hindi",
  bn: "simple Bengali",
  mr: "simple Marathi",
  te: "simple Telugu",
  ta: "simple Tamil",
  gu: "simple Gujarati",
  ur: "simple Urdu",
  kn: "simple Kannada",
  or: "simple Odia",
  ml: "simple Malayalam",
};

const DIRECTION: Record<Locale, { low: string; high: string }> = {
  en: { low: "below the normal range", high: "above the normal range" },
  hi: { low: "सामान्य से कम", high: "सामान्य से ज़्यादा" },
  bn: { low: "স্বাভাবিকের চেয়ে কম", high: "স্বাভাবিকের চেয়ে বেশি" },
  mr: { low: "सामान्यपेक्षा कमी", high: "सामान्यपेक्षा जास्त" },
  te: { low: "సాధారణం కంటే తక్కువ", high: "సాధారణం కంటే ఎక్కువ" },
  ta: { low: "இயல்பை விட குறைவு", high: "இயல்பை விட அதிகம்" },
  gu: { low: "સામાન્ય કરતાં ઓછું", high: "સામાન્ય કરતાં વધારે" },
  ur: { low: "معمول سے کم", high: "معمول سے زیادہ" },
  kn: { low: "ಸಾಮಾನ್ಯಕ್ಕಿಂತ ಕಡಿಮೆ", high: "ಸಾಮಾನ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚು" },
  or: { low: "ସାଧାରଣଠାରୁ କମ୍", high: "ସାଧାରଣଠାରୁ ଅଧିକ" },
  ml: { low: "സാധാരണയിലും കുറവ്", high: "സാധാരണയിലും കൂടുതൽ" },
};

const ALL_NORMAL: Record<Locale, string> = {
  en: "Every value in this report is within its normal range.",
  hi: "इस रिपोर्ट में सभी मान सामान्य सीमा में हैं।",
  bn: "এই রিপোর্টের সমস্ত মান স্বাভাবিক সীমার মধ্যে রয়েছে।",
  mr: "या अहवालातील सर्व मूल्ये सामान्य मर्यादेत आहेत.",
  te: "ఈ రిపోర్టులోని అన్ని విలువలు సాధారణ పరిధిలోనే ఉన్నాయి.",
  ta: "இந்த அறிக்கையில் உள்ள அனைத்து மதிப்புகளும் இயல்பான வரம்பிற்குள் உள்ளன.",
  gu: "આ રિપોર્ટમાંના તમામ મૂલ્યો સામાન્ય શ્રેણીમાં છે.",
  ur: "اس رپورٹ میں تمام اقدار معمول کی حد میں ہیں۔",
  kn: "ಈ ವರದಿಯಲ್ಲಿನ ಎಲ್ಲಾ ಮೌಲ್ಯಗಳು ಸಾಮಾನ್ಯ ವ್ಯಾಪ್ತಿಯಲ್ಲಿವೆ.",
  or: "ଏହି ରିପୋର୍ଟର ସମସ୍ତ ମୂଲ୍ୟ ସାଧାରଣ ସୀମା ମଧ୍ୟରେ ଅଛି।",
  ml: "ഈ റിപ്പോർട്ടിലെ എല്ലാ മൂല്യങ്ങളും സാധാരണ പരിധിക്കുള്ളിലാണ്.",
};

const NOT_A_DIAGNOSIS: Record<Locale, string> = {
  en: "This is background information, not a diagnosis. Please discuss it with your doctor.",
  hi: "यह जानकारी सिर्फ़ समझने के लिए है, निदान नहीं। अपने डॉक्टर से ज़रूर चर्चा करें।",
  bn: "এটি শুধুমাত্র সাধারণ তথ্য, রোগ নির্ণয় নয়। অনুগ্রহ করে আপনার ডাক্তারের সঙ্গে আলোচনা করুন।",
  mr: "ही केवळ सामान्य माहिती आहे, निदान नाही. कृपया तुमच्या डॉक्टरांशी चर्चा करा.",
  te: "ఇది అర్థం చేసుకోవడానికి మాత్రమే, రోగ నిర్ధారణ కాదు. తప్పకుండా మీ వైద్యుడితో చర్చించండి.",
  ta: "இது பின்னணித் தகவல் மட்டுமே, நோய் கண்டறிதல் அல்ல. தயவுசெய்து உங்கள் மருத்துவரிடம் விவாதிக்கவும்.",
  gu: "આ ફક્ત પૃષ્ઠભૂમિ માહિતી છે, નિદાન નથી. કૃપા કરીને તમારા ડૉક્ટર સાથે ચર્ચા કરો.",
  ur: "یہ صرف پس منظر کی معلومات ہے، تشخیص نہیں۔ براہ کرم اپنے ڈاکٹر سے بات کریں۔",
  kn: "ಇದು ಹಿನ್ನೆಲೆ ಮಾಹಿತಿ ಮಾತ್ರ, ರೋಗನಿರ್ಣಯವಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ವೈದ್ಯರೊಂದಿಗೆ ಚರ್ಚಿಸಿ.",
  or: "ଏହା କେବଳ ପୃଷ୍ଠଭୂମି ସୂଚନା, ରୋଗ ନିର୍ଣ୍ଣୟ ନୁହେଁ। ଦୟାକରି ଆପଣଙ୍କ ଡାକ୍ତରଙ୍କ ସହିତ ଆଲୋଚନା କରନ୍ତୁ।",
  ml: "ഇത് പശ്ചാത്തല വിവരം മാത്രമാണ്, രോഗനിർണയമല്ല. നിങ്ങളുടെ ഡോക്ടറുമായി ഇത് ചർച്ച ചെയ്യുക.",
};

export async function explainReport(
  doc: DocumentRecord,
  locale: Locale = "en",
): Promise<AiResult> {
  const flagged = (doc.extracted_values ?? []).filter((v) => v.flag !== "normal");
  try {
    const text = await ask(
      `You are explaining a laboratory report to a patient in ${LANGUAGE_NAME[locale]} at a sixth-grade reading level. For each out-of-range value say what the test measures and what a high or low value can mean in general. You must NOT give a diagnosis, must NOT suggest treatment, and must end with one sentence telling the patient to discuss it with their doctor.`,
      JSON.stringify({ title: doc.title, values: doc.extracted_values }),
      `rep:${doc.id}:${locale}`,
    );
    return wrap(text, "claude");
  } catch {
    const EXPLAIN: Record<string, Record<Locale, string>> = {
      Haemoglobin: {
        en: "Haemoglobin carries oxygen in your blood. A low value often means anaemia, which can cause tiredness and breathlessness.",
        hi: "हीमोग्लोबिन खून में ऑक्सीजन ले जाता है। कम मात्रा अक्सर खून की कमी दिखाती है, जिससे थकान और साँस फूलना हो सकता है।",
        bn: "হিমোগ্লোবিন আপনার রক্তে অক্সিজেন বহন করে। কম মাত্রা প্রায়ই রক্তাল্পতা বোঝায়, যার ফলে ক্লান্তি ও শ্বাসকষ্ট হতে পারে।",
        mr: "हिमोग्लोबिन तुमच्या रक्तात ऑक्सिजन वाहून नेतो. कमी प्रमाण अनेकदा ॲनिमिया दर्शवते, ज्यामुळे थकवा आणि धाप लागू शकते.",
        te: "హీమోగ్లోబిన్ రక్తంలో ఆక్సిజన్‌ను మోసుకెళ్తుంది. తక్కువ ఉంటే చాలావరకు రక్తహీనత అని అర్థం, దీనివల్ల అలసట, ఆయాసం రావచ్చు.",
        ta: "ஹீமோகுளோபின் உங்கள் இரத்தத்தில் ஆக்ஸிஜனைக் கொண்டு செல்கிறது. குறைவான மதிப்பு பெரும்பாலும் இரத்த சோகையைக் குறிக்கிறது, இது சோர்வு மற்றும் மூச்சுத் திணறலை ஏற்படுத்தலாம்.",
        gu: "હિમોગ્લોબિન તમારા લોહીમાં ઓક્સિજન વહન કરે છે. ઓછું મૂલ્ય મોટાભાગે એનિમિયા દર્શાવે છે, જેનાથી થાક અને શ્વાસ ચઢવો થઈ શકે છે.",
        ur: "ہیموگلوبن آپ کے خون میں آکسیجن لے جاتا ہے۔ کم مقدار اکثر خون کی کمی ظاہر کرتی ہے، جس سے تھکاوٹ اور سانس پھولنا ہو سکتا ہے۔",
        kn: "ಹಿಮೋಗ್ಲೋಬಿನ್ ನಿಮ್ಮ ರಕ್ತದಲ್ಲಿ ಆಮ್ಲಜನಕವನ್ನು ಸಾಗಿಸುತ್ತದೆ. ಕಡಿಮೆ ಮೌಲ್ಯ ಸಾಮಾನ್ಯವಾಗಿ ರಕ್ತಹೀನತೆಯನ್ನು ಸೂಚಿಸುತ್ತದೆ, ಇದು ಆಯಾಸ ಮತ್ತು ಉಸಿರಾಟದ ತೊಂದರೆಗೆ ಕಾರಣವಾಗಬಹುದು.",
        or: "ହିମୋଗ୍ଲୋବିନ୍ ଆପଣଙ୍କ ରକ୍ତରେ ଅମ୍ଳଜାନ ବହନ କରେ। କମ୍ ମୂଲ୍ୟ ପ୍ରାୟତଃ ରକ୍ତହୀନତା ଦର୍ଶାଏ, ଯାହା ଦ୍ୱାରା କ୍ଳାନ୍ତି ଏବଂ ନିଶ୍ୱାସ ନେବାରେ ଅସୁବିଧା ହୋଇପାରେ।",
        ml: "ഹീമോഗ്ലോബിൻ നിങ്ങളുടെ രക്തത്തിൽ ഓക്സിജൻ വഹിക്കുന്നു. കുറഞ്ഞ മൂല്യം പലപ്പോഴും വിളർച്ചയെ സൂചിപ്പിക്കുന്നു, ഇത് ക്ഷീണവും ശ്വാസതടസ്സവും ഉണ്ടാക്കാം.",
      },
      Creatinine: {
        en: "Creatinine shows how well your kidneys are clearing waste. A high value can mean the kidneys are under strain.",
        hi: "क्रिएटिनिन बताता है कि आपकी किडनी कचरा कितनी अच्छी तरह निकाल रही है। ज़्यादा मात्रा किडनी पर दबाव दिखा सकती है।",
        bn: "ক্রিয়েটিনিন দেখায় আপনার কিডনি কতটা ভালোভাবে বর্জ্য পরিষ্কার করছে। বেশি মাত্রা কিডনির উপর চাপ বোঝাতে পারে।",
        mr: "क्रिएटिनिन तुमची मूत्रपिंडे कचरा किती चांगल्या प्रकारे स्वच्छ करत आहेत हे दाखवते. जास्त प्रमाण मूत्रपिंडांवर ताण असल्याचे दर्शवू शकते.",
        te: "క్రియాటినిన్ మీ మూత్రపిండాలు వ్యర్థాలను ఎంత బాగా తొలగిస్తున్నాయో చూపుతుంది. ఎక్కువ ఉంటే మూత్రపిండాలపై ఒత్తిడి ఉందని అర్థం కావచ్చు.",
        ta: "க்ரியேட்டினின் உங்கள் சிறுநீரகங்கள் கழிவுகளை எவ்வளவு நன்றாக அகற்றுகின்றன என்பதைக் காட்டுகிறது. அதிக மதிப்பு சிறுநீரகங்கள் அழுத்தத்தில் இருப்பதைக் குறிக்கலாம்.",
        gu: "ક્રિએટિનિન બતાવે છે કે તમારી કિડની કચરો કેટલી સારી રીતે સાફ કરી રહી છે. વધારે મૂલ્ય કિડની પર તાણ દર્શાવી શકે છે.",
        ur: "کریٹینین ظاہر کرتا ہے کہ آپ کے گردے فضلہ کتنی اچھی طرح صاف کر رہے ہیں۔ زیادہ مقدار گردوں پر دباؤ ظاہر کر سکتی ہے۔",
        kn: "ಕ್ರಿಯಾಟಿನಿನ್ ನಿಮ್ಮ ಮೂತ್ರಪಿಂಡಗಳು ತ್ಯಾಜ್ಯವನ್ನು ಎಷ್ಟು ಚೆನ್ನಾಗಿ ತೆರವುಗೊಳಿಸುತ್ತಿವೆ ಎಂಬುದನ್ನು ತೋರಿಸುತ್ತದೆ. ಹೆಚ್ಚಿನ ಮೌಲ್ಯ ಮೂತ್ರಪಿಂಡಗಳ ಮೇಲೆ ಒತ್ತಡವನ್ನು ಸೂಚಿಸಬಹುದು.",
        or: "କ୍ରିଏଟିନିନ୍ ଦର୍ଶାଏ ଯେ ଆପଣଙ୍କ କିଡନୀ ବର୍ଜ୍ୟବସ୍ତୁ କେତେ ଭଲ ଭାବରେ ସଫା କରୁଛି। ଅଧିକ ମୂଲ୍ୟ କିଡନୀ ଉପରେ ଚାପ ସୂଚାଇପାରେ।",
        ml: "ക്രിയാറ്റിനിൻ നിങ്ങളുടെ വൃക്കകൾ മാലിന്യം എത്ര നന്നായി നീക്കം ചെയ്യുന്നു എന്ന് കാണിക്കുന്നു. ഉയർന്ന മൂല്യം വൃക്കകൾക്ക് സമ്മർദ്ദം ഉണ്ടെന്ന് അർത്ഥമാക്കാം.",
      },
      TLC: {
        en: "The white cell count rises when the body is fighting an infection.",
        hi: "शरीर संक्रमण से लड़ता है तो सफ़ेद रक्त कोशिकाओं की संख्या बढ़ जाती है।",
        bn: "শরীর সংক্রমণের বিরুদ্ধে লড়াই করলে সাদা রক্তকণিকার সংখ্যা বেড়ে যায়।",
        mr: "शरीर संसर्गाशी लढत असताना पांढऱ्या पेशींची संख्या वाढते.",
        te: "శరీరం ఇన్ఫెక్షన్‌తో పోరాడుతున్నప్పుడు తెల్ల రక్త కణాల సంఖ్య పెరుగుతుంది.",
        ta: "உடல் ஒரு தொற்றுநோயுடன் போராடும்போது வெள்ளை அணுக்களின் எண்ணிக்கை அதிகரிக்கிறது.",
        gu: "શરીર ચેપ સામે લડે ત્યારે શ્વેત રક્તકણોની સંખ્યા વધે છે.",
        ur: "جب جسم انفیکشن سے لڑتا ہے تو سفید خلیوں کی تعداد بڑھ جاتی ہے۔",
        kn: "ದೇಹ ಸೋಂಕಿನ ವಿರುದ್ಧ ಹೋರಾಡುತ್ತಿರುವಾಗ ಬಿಳಿ ರಕ್ತಕಣಗಳ ಸಂಖ್ಯೆ ಹೆಚ್ಚಾಗುತ್ತದೆ.",
        or: "ଶରୀର ସଂକ୍ରମଣ ସହିତ ଲଢୁଥିବା ବେଳେ ଧଳା ରକ୍ତକଣିକା ସଂଖ୍ୟା ବଢିଯାଏ।",
        ml: "ശരീരം ഒരു അണുബാധയോട് പോരാടുമ്പോൾ വെളുത്ത രക്താണുക്കളുടെ എണ്ണം ഉയരും.",
      },
    };
    const lines = flagged.length
      ? flagged.map((v) => {
          const e = EXPLAIN[v.analyte]?.[locale];
          const dir = DIRECTION[locale][v.flag === "low" ? "low" : "high"];
          return `• ${v.analyte}: ${v.value} ${v.unit} — ${dir} (${v.ref}). ${e ?? ""}`;
        })
      : [ALL_NORMAL[locale]];
    lines.push(NOT_A_DIAGNOSIS[locale]);
    return wrap(lines.join("\n"), "offline");
  }
}

// ── 4 · Symptom structuring (patient) ─────────────────────────
// The patient describes symptoms conversationally; the model structures
// them into complaint + duration + severity and suggests a speciality. It
// pre-fills the doctor's chief-complaint field. It does not diagnose.
export interface StructuredSymptoms {
  redFlag: boolean;
  complaints: { complaint: string; duration_value: number; duration_unit: string }[];
  severity: number | null;
  suggestedSpeciality: string;
  note: string;
}

const SPECIALITY_HINTS: [RegExp, string][] = [
  [/chest|palpitat|heart|breathless on walking/i, "Cardiology"],
  [/child|baby|infant|my son|my daughter/i, "Paediatrics"],
  [/knee|joint|back|shoulder|fracture|sprain/i, "Orthopaedics"],
  [/rash|itch|skin|acne|hair fall/i, "Dermatology"],
  [/pregnan|period|menstru|lmp/i, "Obstetrics & Gynaecology"],
];

export async function structureSymptoms(text: string): Promise<StructuredSymptoms> {
  // The model never triages an emergency. Red flags short-circuit here,
  // before any request is made.
  if (isRedFlag(text)) {
    return {
      redFlag: true, complaints: [], severity: null,
      suggestedSpeciality: "Emergency",
      note: "This sounds like it needs urgent attention. Opening the emergency screen.",
    };
  }

  const duration = /(\d+)\s*(hour|day|week|month|year)/i.exec(text);
  const severity = /(\d+)\s*(?:\/|out of)\s*10/i.exec(text);
  const speciality = SPECIALITY_HINTS.find(([re]) => re.test(text))?.[1] ?? "General Medicine";

  try {
    const raw = await ask(
      "Extract structured symptoms from a patient's description. Reply with JSON only: {complaints:[{complaint,duration_value,duration_unit}],severity:number|null,suggestedSpeciality:string}. Use the patient's own words for the complaint. Never diagnose, never name a disease, never suggest treatment.",
      text,
      `sym:${text.slice(0, 120)}`,
    );
    const parsed = JSON.parse(raw) as Partial<StructuredSymptoms>;
    return {
      redFlag: false,
      complaints: parsed.complaints ?? [],
      severity: parsed.severity ?? null,
      suggestedSpeciality: parsed.suggestedSpeciality ?? speciality,
      note: "Structured from your description. Your doctor will confirm it.",
    };
  } catch {
    const first = text.split(/[.,;]/)[0].trim().slice(0, 60) || text.slice(0, 60);
    return {
      redFlag: false,
      complaints: [{
        complaint: first.charAt(0).toUpperCase() + first.slice(1),
        duration_value: duration ? parseInt(duration[1], 10) : 1,
        duration_unit: duration ? `${duration[2].toLowerCase()}s` : "days",
      }],
      severity: severity ? parseInt(severity[1], 10) : null,
      suggestedSpeciality: speciality,
      note: "Structured from your description. Your doctor will confirm it.",
    };
  }
}

// ── 5 · Voice command matching (any signed-in role) ───────────
// Picks the best-matching option from a menu handed to it — a fixed global
// list of destinations, an in-page list of selectable options, or both
// merged together (see src/components/voice-assistant.tsx). It can never
// return an id outside that menu, so it can never invent a destination or
// an action that wasn't already offered to it.
export interface VoiceMatch {
  commandId: string | null;
  source: "claude" | "offline";
}

// NFC first: Devanagari/Telugu text can arrive as either precomposed or
// decomposed Unicode depending on the browser's speech engine, and two
// visually-identical strings in different forms fail a plain .includes().
// Zero-width joiners/non-joiners are stripped next — proper Telugu
// typesetting inserts a ZWNJ inside "అపాయింట్‌మెంట్" to stop a ligature
// forming, but a spoken transcript of the same word never contains one, so
// without this the written and spoken forms of the same word never match.
const normalize = (s: string) =>
  s.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase().trim();

// Splits on anything that isn't a letter/digit in Latin, Devanagari or
// Telugu script — good enough for the three locales this app supports.
const tokenize = (s: string): string[] =>
  normalize(s).split(/[^a-z0-9ऀ-ॿఀ-౿]+/).filter((w) => w.length > 1);

export async function interpretVoiceCommand(
  transcript: string,
  commands: { id: string; label: string; keywords: string[] }[],
): Promise<VoiceMatch> {
  try {
    const raw = await ask(
      "You choose one option from a menu for a voice-controlled app — this may be a page to navigate to, or an option on the visitor's current screen (e.g. a hospital, doctor or time slot to select). Given a spoken transcript and the menu (id, label, keywords), reply with JSON only: {\"commandId\": string|null}. Pick the single best-matching id, or null if nothing matches well. Never invent an id that is not in the list.",
      JSON.stringify({ transcript, commands: commands.map(({ id, label, keywords }) => ({ id, label, keywords })) }),
      `voice:${transcript.toLowerCase().trim()}`,
    );
    const parsed = JSON.parse(raw) as { commandId: string | null };
    const valid = parsed.commandId && commands.some((c) => c.id === parsed.commandId) ? parsed.commandId : null;
    return { commandId: valid, source: "claude" };
  } catch {
    // A short utterance ("Sanjeevani") naming a long option ("Sanjeevani
    // Multispeciality Hospital") is the common case for in-page targets —
    // plain "does the transcript contain the keyword" fails whenever the
    // keyword is longer than what was actually said. Score three ways and
    // take whichever is strongest: whole-phrase containment in either
    // direction, keyword containment in either direction, and shared words.
    const needle = normalize(transcript);
    const needleWords = new Set(tokenize(transcript));
    // Guards the "keyword contains the (short) needle" direction: that
    // heuristic is meant for a distinctive fragment of one long, unique
    // option (a hospital's first name inside its full name). It misfires
    // when the needle is itself a complete, shared word that also happens
    // to be a keyword elsewhere in the same menu — e.g. a bare "अपॉइंटमेंट"
    // is a whole exact match for "Appointments" and would otherwise ALSO
    // score as a prefix-fragment match against "Book appointment"'s Hindi
    // phrase, purely because that phrase happens to start with the same
    // word. In that case the exact match on the other command should win
    // outright, not tie because this one also picked up a fragment credit.
    const allExactKeywords = new Set(
      commands.flatMap((c) => [normalize(c.label), ...c.keywords.map(normalize)]),
    );
    let best: { id: string; score: number } | null = null;
    for (const c of commands) {
      const phrase = normalize(c.label);
      let score = 0;
      if (phrase && (needle.includes(phrase) || phrase.includes(needle))) score += 3;
      for (const k of c.keywords) {
        const kn = normalize(k);
        if (!kn) continue;
        if (needle.includes(kn)) score += 2;
        else if (kn.includes(needle) && !allExactKeywords.has(needle)) score += 2;
      }
      for (const w of tokenize(`${c.label} ${c.keywords.join(" ")}`)) {
        if (needleWords.has(w)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
    }
    return { commandId: best?.id ?? null, source: "offline" };
  }
}
