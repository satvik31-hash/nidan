"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square, AlertCircle } from "lucide-react";

// Speaks an already-generated summary back to the patient in the same
// language it was written in — the BCP-47 tag comes from the server (the
// reader's chosen locale), not from the browser's default voice, so a
// Hindi/Telugu explanation isn't read in an English voice.
//
// Two real Web Speech API quirks made this silently do nothing for
// Hindi/Telugu in practice, neither of which throws an error you'd notice:
//  1. getVoices() returns [] until the voice list has loaded async, which on
//     a cold first click can race — the code would find no match and fall
//     back to an unset voice. Fixed by loading voices once on mount instead
//     of inside the click handler.
//  2. Calling cancel() immediately before speak() is a long-standing Chrome
//     bug that can silently drop the very utterance you just queued. Fixed
//     by only cancelling when something is actually speaking/pending, and
//     letting the cancellation flush on the next tick before speaking.
export function ReadAloudButton({ text, lang }: { text: string; lang: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Stop mid-sentence if the reader navigates away rather than leaving a
  // voice reading the previous page in the background.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakNow = () => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const short = lang.split("-")[0].toLowerCase();
    const match = voicesRef.current.find(
      (v) => v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase()
        || v.lang.toLowerCase().startsWith(short),
    );
    if (match) utterance.voice = match;
    // No installed voice for this language at all — rather than queue an
    // utterance that plays in the wrong language or not at all, say so.
    else if (short !== "en") { setUnavailable(true); return; }
    utterance.onstart = () => setUnavailable(false);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setUnavailable(true); };
    synth.speak(utterance);
    setSpeaking(true);
  };

  const toggle = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    setUnavailable(false);
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(speakNow, 60);
    } else {
      speakNow();
    }
  };

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <button
        onClick={toggle}
        className="pill hover:border-[var(--color-brand)] inline-flex items-center gap-1.5"
        aria-label={speaking ? "Stop reading aloud" : "Read this explanation aloud"}
      >
        {speaking ? <Square size={12} /> : <Volume2 size={13} />}
        {speaking ? "Stop" : "Read aloud"}
      </button>
      {unavailable && (
        <span className="text-xs text-[var(--color-ink-3)] inline-flex items-center gap-1">
          <AlertCircle size={12} />
          This device has no voice installed for this language yet.
        </span>
      )}
    </div>
  );
}
