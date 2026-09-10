"use server";

// A thin server-side wrapper. `src/lib/ai.ts` touches ANTHROPIC_API_KEY and
// must never be imported into a "use client" bundle — every other AI
// function in this app is reached the same way, via a server action or a
// Server Component, never a direct client import.
import { interpretVoiceCommand as _interpretVoiceCommand, type VoiceMatch } from "@/lib/ai";

export async function interpretVoiceCommand(
  transcript: string,
  commands: { id: string; label: string; keywords: string[] }[],
): Promise<VoiceMatch> {
  return _interpretVoiceCommand(transcript, commands);
}
