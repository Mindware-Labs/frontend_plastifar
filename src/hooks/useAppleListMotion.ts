import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

/** Deben coincidir con plf-apple-row-in / plf-apple-row-out en index.css. */
export const APPLE_LIST_ENTER_MS = 480;
export const APPLE_LIST_EXIT_MS = 320;

export type AppleListPhase = "idle" | "from" | "hold" | "in" | "arm" | "out";

interface UseAppleListMotionOptions {
  minItems?: number;
  enterMs?: number;
  exitMs?: number;
}

export function useAppleListMotion(itemKeys: string[], options: UseAppleListMotionOptions = {}) {
  const minItems = options.minItems ?? 1;
  const enterMs = options.enterMs ?? APPLE_LIST_ENTER_MS;
  const exitMs = options.exitMs ?? APPLE_LIST_EXIT_MS;

  const prevKeysRef = useRef<string[]>(itemKeys);
  const prevSigRef = useRef("");
  const justAddedKeyRef = useRef<string | null>(null);
  const [enterKeys, setEnterKeys] = useState<Set<string>>(() => new Set());
  const [enterArmed, setEnterArmed] = useState<Set<string>>(() => new Set());
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [exitKeys, setExitKeys] = useState<Set<string>>(() => new Set());
  const [exitArmed, setExitArmed] = useState<Set<string>>(() => new Set());

  const enterTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const exitTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingRemove = useRef(new Map<string, () => void>());
  const exitKeysRef = useRef(exitKeys);
  exitKeysRef.current = exitKeys;
  const itemKeysRef = useRef(itemKeys);
  itemKeysRef.current = itemKeys;

  const keySignature = itemKeys.join("\0");

  if (keySignature !== prevSigRef.current) {
    const prevSet = new Set(prevKeysRef.current);
    const added = itemKeys.filter((key) => !prevSet.has(key));
    prevKeysRef.current = itemKeys;
    prevSigRef.current = keySignature;
    if (added.length === 1 && !prefersReducedMotion()) {
      justAddedKeyRef.current = added[0];
    }
  }

  useLayoutEffect(() => {
    const next = itemKeys;
    if (justAddedKeyRef.current) {
      const key = justAddedKeyRef.current;
      justAddedKeyRef.current = null;
      setEnterKeys((current) => {
        if (current.has(key)) return current;
        const copy = new Set(current);
        copy.add(key);
        return copy;
      });
    }

    setEnterKeys((current) => {
      let changed = false;
      const copy = new Set(current);
      for (const key of current) {
        if (!next.includes(key)) {
          copy.delete(key);
          changed = true;
        }
      }
      return changed ? copy : current;
    });
  }, [keySignature, itemKeys]);

  useLayoutEffect(() => {
    const pending = [...enterKeys].filter((key) => !enterArmed.has(key) && !exitKeys.has(key));
    if (pending.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setEnterArmed((current) => {
        const next = new Set(current);
        for (const key of pending) next.add(key);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [enterKeys, enterArmed, exitKeys]);

  useLayoutEffect(() => {
    const pending = [...enterKeys].filter(
      (key) => enterArmed.has(key) && !openKeys.has(key) && !exitKeys.has(key),
    );
    if (pending.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setOpenKeys((current) => {
        const next = new Set(current);
        for (const key of pending) next.add(key);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [enterKeys, enterArmed, openKeys, exitKeys]);

  useEffect(() => {
    for (const key of openKeys) {
      if (!enterKeys.has(key) || enterTimers.current.has(key)) continue;
      const timer = setTimeout(() => {
        enterTimers.current.delete(key);
        setEnterKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setOpenKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setEnterArmed((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }, enterMs);
      enterTimers.current.set(key, timer);
    }
  }, [openKeys, enterKeys, enterMs]);

  useLayoutEffect(() => {
    const pending = [...exitKeys].filter((key) => !exitArmed.has(key));
    if (pending.length === 0) return;
    const frame = requestAnimationFrame(() => {
      setExitArmed((current) => {
        const next = new Set(current);
        for (const key of pending) next.add(key);
        return next;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [exitKeys, exitArmed]);

  useEffect(() => {
    for (const key of exitArmed) {
      if (exitTimers.current.has(key)) continue;
      const timer = setTimeout(() => {
        exitTimers.current.delete(key);
        pendingRemove.current.get(key)?.();
        pendingRemove.current.delete(key);
        setExitKeys((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        setExitArmed((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }, exitMs);
      exitTimers.current.set(key, timer);
    }
  }, [exitArmed, exitMs]);

  useEffect(() => {
    const enterTimerMap = enterTimers.current;
    const exitTimerMap = exitTimers.current;
    const pending = pendingRemove.current;
    return () => {
      for (const timer of enterTimerMap.values()) clearTimeout(timer);
      enterTimerMap.clear();
      for (const timer of exitTimerMap.values()) clearTimeout(timer);
      exitTimerMap.clear();
      for (const key of exitKeysRef.current) pending.get(key)?.();
      pending.clear();
    };
  }, []);

  function phaseFor(key: string): AppleListPhase {
    if (exitKeys.has(key)) return exitArmed.has(key) ? "out" : "arm";
    if (!enterKeys.has(key)) return "idle";
    if (!enterArmed.has(key)) return "from";
    return openKeys.has(key) ? "in" : "hold";
  }

  function isEntering(key: string) {
    return enterKeys.has(key) || justAddedKeyRef.current === key;
  }

  function requestRemove(key: string, onComplete: () => void) {
    if (exitKeys.has(key) || exitArmed.has(key)) return;
    const survivors = itemKeys.filter((itemKey) => itemKey !== key && !exitKeys.has(itemKey)).length;
    if (survivors < minItems) return;
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }
    pendingRemove.current.set(key, onComplete);
    setExitKeys((current) => new Set(current).add(key));
  }

  function isExiting(key: string) {
    const phase = phaseFor(key);
    return phase === "out" || phase === "arm";
  }

  return { phaseFor, requestRemove, isExiting, isEntering };
}
