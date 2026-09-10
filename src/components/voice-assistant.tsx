"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpretVoiceCommand } from "@/app/actions/voice";
import { AiLabel } from "@/components/ui";
import type { CommandEntry } from "@/lib/commands";

// Navigation only, read-only — this never writes to the record. On no
// confident match it says so and does nothing, rather than guessing.

type SpeechResultEvent = { results: { 0: { transcript: string } }[] };
type SR = {
  lang: string; interimResults: boolean;
  onresult: (e: SpeechResultEvent) => void; onend: () => void; onerror: () => void;
  start: () => void;
};

type State = "idle" | "listening" | "thinking" | "result";

export function VoiceAssistant({ commands, lang = "en-IN" }: { commands: CommandEntry[]; lang?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [heard, setHeard] = useState("");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState<"claude" | "offline" | undefined>();

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const listen = () => {
    const W = window as unknown as { webkitSpeechRecognition?: new () => SR; SpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setHeard(""); setSource(undefined);
      setMessage("Voice isn't supported in this browser. Try Chrome.");
      setState("result");
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setHeard(transcript);
      setState("thinking");
      // Server Actions only accept plain, serializable data — strip each
      // CommandEntry down to id/label/keywords before crossing the boundary
      // (the icon is a React component and cannot be serialized).
      const menu = commands.map(({ id, label, keywords }) => ({ id, label, keywords }));
      interpretVoiceCommand(transcript, menu).then((match) => {
        setSource(match.source);
        const cmd = commands.find((c) => c.id === match.commandId);
        if (cmd) {
          setMessage(`Opening ${cmd.label}.`);
          setState("result");
          speak(`Opening ${cmd.label}`);
          setTimeout(() => router.push(cmd.href), 350);
        } else {
          setMessage("Didn't catch a command for that — try ⌘K or say something like \"open patient lookup\".");
          setState("result");
        }
      });
    };
    rec.onerror = () => setState("idle");
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.start();
    setState("listening");
  };

  return (
    <div className="fixed bottom-20 lg:bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {state !== "idle" && (
        <div className="card-elevated max-w-xs p-3 text-sm">
          {state === "listening" && <p className="text-[var(--color-ink-2)]">Listening…</p>}
          {state === "thinking" && (
            <p className="text-[var(--color-ink-2)]">Heard: &ldquo;{heard}&rdquo;. Thinking…</p>
          )}
          {state === "result" && (
            <>
              {heard && (
                <p className="text-[var(--color-ink-3)] text-xs mb-1">Heard: &ldquo;{heard}&rdquo;</p>
              )}
              <p>{message}</p>
              {source && (
                <div className="mt-1.5">
                  <AiLabel source={source} />
                </div>
              )}
            </>
          )}
        </div>
      )}
      <button
        onClick={listen}
        title="Voice assistant — say a place to go"
        aria-label="Voice assistant"
        className={cn(
          "w-12 h-12 rounded-full grid place-items-center shadow-[var(--shadow-card)] border border-transparent transition-colors",
          state === "listening"
            ? "bg-[var(--color-critical)] text-[var(--color-on-critical)] animate-pulse"
            : "bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:bg-[var(--color-brand-ink)]",
        )}
      >
        <Mic size={20} />
      </button>
    </div>
  );
}
