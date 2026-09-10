"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// The first React Context in this codebase — kept deliberately small and
// single-purpose rather than a general store. It lets the current screen
// tell the voice assistant "here is what's on screen right now that you
// can select" without the assistant (mounted in the shell) needing any
// direct knowledge of page content.

export interface VoiceTarget {
  id: string;
  label: string;
  keywords: string[];
  onSelect: () => void;
}

interface VoiceTargetsCtx {
  targets: VoiceTarget[];
  register: (scopeId: string, targets: VoiceTarget[]) => void;
  unregister: (scopeId: string) => void;
}

const VoiceTargetsContext = createContext<VoiceTargetsCtx | null>(null);

export function VoiceTargetsProvider({ children }: { children: React.ReactNode }) {
  const [scopes, setScopes] = useState<Record<string, VoiceTarget[]>>({});

  // A caller's target list is a fresh array every render (usually built with
  // `.map()`), so bailing out here on *content* equality — not just skipping
  // when nothing changed — is what actually stops this from looping: every
  // registration triggers a state update, which hands the provider a new
  // context value, which re-runs the registration effect below. Returning
  // the same `s` reference tells React's setState to skip the re-render
  // entirely, which is what breaks the cycle once a scope's ids settle.
  const register = useCallback((scopeId: string, targets: VoiceTarget[]) => {
    setScopes((s) => {
      const prev = s[scopeId];
      const unchanged = prev && prev.length === targets.length &&
        prev.every((t, i) => t.id === targets[i].id);
      return unchanged ? s : { ...s, [scopeId]: targets };
    });
  }, []);

  const unregister = useCallback((scopeId: string) => {
    setScopes((s) => {
      if (!(scopeId in s)) return s;
      const next = { ...s };
      delete next[scopeId];
      return next;
    });
  }, []);

  const targets = useMemo(() => Object.values(scopes).flat(), [scopes]);
  const value = useMemo(() => ({ targets, register, unregister }), [targets, register, unregister]);

  return (
    <VoiceTargetsContext.Provider value={value}>
      {children}
    </VoiceTargetsContext.Provider>
  );
}

/**
 * Call once per "step" of a page (never inside a `.map()` — that breaks the
 * rules of hooks) with the options that step currently wants to be
 * voice-selectable. Pass `[]` when that step isn't the one on screen, so
 * only what the visitor can actually see is ever selectable by voice.
 */
export function useVoiceTargets(scopeId: string, targets: VoiceTarget[]) {
  const ctx = useContext(VoiceTargetsContext);
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  // Two separate effects on purpose. register()/unregister() are stable
  // (useCallback with no deps in the provider), so this only re-registers
  // when the *content* the caller passed actually needs to update, and only
  // unregisters on true unmount — not, e.g., every time some other scope's
  // registration causes this provider to re-render. Combining them into one
  // effect with `targets` in the cleanup's dependency array was an infinite
  // loop: cleanup deletes the scope, the effect re-adds it, both are real
  // state changes, and every scope in the tree does this to every other one.
  useEffect(() => {
    register?.(scopeId, targets);
  }, [register, scopeId, targets]);

  useEffect(() => {
    return () => unregister?.(scopeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unregister, scopeId]);
}

/** Read by the voice assistant to get every currently-registered option. */
export function useVoiceTargetList(): VoiceTarget[] {
  return useContext(VoiceTargetsContext)?.targets ?? [];
}
