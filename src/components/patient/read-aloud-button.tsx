"use client";

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";

// Speaks an already-generated summary back to the patient in the same
// language it was written in — the BCP-47 tag comes from the server (the
// reader's chosen locale), not from the browser's default voice, so a
// Hindi/Telugu explanation isn't read in an English voice.
export function ReadAloudButton({ text, lang }: { text: string; lang: string }) {
  const [speaking, setSpeaking] = useState(false);

  // Stop mid-sentence if the reader navigates away rather than leaving a
  // voice reading the previous page in the background.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggle = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const match = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang === lang || v.lang.startsWith(lang.split("-")[0]));
    if (match) utterance.voice = match;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button
      onClick={toggle}
      className="pill hover:border-[var(--color-brand)] inline-flex items-center gap-1.5"
      aria-label={speaking ? "Stop reading aloud" : "Read this explanation aloud"}
    >
      {speaking ? <Square size={12} /> : <Volume2 size={13} />}
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}
