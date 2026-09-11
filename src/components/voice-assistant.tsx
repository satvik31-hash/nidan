"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpretVoiceCommand } from "@/app/actions/voice";
import { AiLabel } from "@/components/ui";
import { signOutCommand, type CommandEntry } from "@/lib/commands";
import { useVoiceTargetList } from "@/lib/voice-targets";

// Picks from a fixed global menu (navigation + sign-out) plus whatever the
// current screen has explicitly registered via lib/voice-targets.tsx (e.g.
// the booking wizard's hospital/doctor/time-slot lists) — never anything
// outside that combined, explicit set. See AGENTS.md invariant 8.

type SpeechResultEvent = { results: { 0: { transcript: string } }[] };
type SR = {
  lang: string; interimResults: boolean;
  onresult: (e: SpeechResultEvent) => void; onend: () => void; onerror: () => void;
  start: () => void;
};

type State = "idle" | "listening" | "thinking" | "result" | "confirm-logout";

export function VoiceAssistant({ commands, lang = "en-IN" }: { commands: CommandEntry[]; lang?: string }) {
  const router = useRouter();
  const targets = useVoiceTargetList();
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

      const globalCommands = [...commands, signOutCommand];
      // Dynamic, on-screen options first, so a page-local option (e.g. a
      // hospital named similarly to a global command) still wins on its own
      // screen — one combined match, not a two-phase fallback, so saying
      // "logout" mid-booking still works rather than being shadowed.
      const menu = [
        ...targets.map(({ id, label, keywords }) => ({ id, label, keywords })),
        ...globalCommands.map(({ id, label, keywords }) => ({ id, label, keywords })),
      ];

      interpretVoiceCommand(transcript, menu).then((match) => {
        setSource(match.source);
        const target = targets.find((t) => t.id === match.commandId);
        const cmd = globalCommands.find((c) => c.id === match.commandId);

        if (target) {
          setMessage(`Selecting ${target.label}.`);
          setState("result");
          speak(`Selecting ${target.label}`);
          setTimeout(() => target.onSelect(), 350);
        } else if (cmd?.id === signOutCommand.id) {
          // Signing out is the one irreversible thing this assistant can
          // trigger, so it gets a confirmation step instead of acting on
          // the first "logout" it hears — a misheard word or a stray
          // "log out" in conversation shouldn't end the session.
          setMessage("Are you sure you want to log out?");
          setState("confirm-logout");
          speak("Are you sure you want to log out?");
        } else if (cmd) {
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

  const confirmLogout = () => {
    setState("idle");
    fetch("/api/signout", { method: "POST" }).finally(() => {
      window.location.href = "/";
    });
  };

  const cancelLogout = () => setState("idle");

  return (
    <div className="fixed bottom-20 lg:bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {state !== "idle" && (
        <div className="card-elevated max-w-xs p-3 text-sm">
          {state === "listening" && <p className="text-[var(--color-ink-2)]">Listening…</p>}
          {state === "thinking" && (
            <p className="text-[var(--color-ink-2)]">Heard: &ldquo;{heard}&rdquo;. Thinking…</p>
          )}
          {state === "confirm-logout" && (
            <>
              <p className="font-medium">{message}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={confirmLogout}
                  className="flex-1 h-9 rounded-[6px] bg-[var(--color-critical)] text-[var(--color-on-critical)] text-sm font-medium"
                >
                  Yes
                </button>
                <button
                  onClick={cancelLogout}
                  className="flex-1 h-9 rounded-[6px] border border-[var(--color-line)] text-sm font-medium hover:bg-[var(--color-paper)]"
                >
                  No
                </button>
              </div>
            </>
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
        title="Voice assistant — say a place to go, or an option on screen"
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
