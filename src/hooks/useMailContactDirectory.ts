import { useEffect, useState } from "react";
import { emailsApi } from "../api/emails";
import type { ContactResponse } from "../types/api";

const DIRECTORY_TTL_MS = 60 * 60 * 1000;

let cached: { loadedAt: number; items: ContactResponse[] } | null = null;
let inflight: Promise<ContactResponse[]> | null = null;

export function invalidateMailContactDirectory() {
  cached = null;
}

async function fetchDirectory(): Promise<ContactResponse[]> {
  if (inflight) return inflight;
  inflight = emailsApi.contactDirectory().finally(() => {
    inflight = null;
  });
  const items = await inflight;
  cached = { loadedAt: Date.now(), items };
  return items;
}

/** Libreta de correos con actividad en bandeja; se refresca cada hora. */
export function useMailContactDirectory() {
  const [directory, setDirectory] = useState<ContactResponse[]>(() => cached?.items ?? []);

  useEffect(() => {
    let cancelled = false;

    async function ensureFresh(force = false) {
      const now = Date.now();
      if (!force && cached && now - cached.loadedAt < DIRECTORY_TTL_MS) {
        if (!cancelled) setDirectory(cached.items);
        return;
      }

      try {
        const items = await fetchDirectory();
        if (!cancelled) setDirectory(items);
      } catch {
        if (!cancelled && cached) setDirectory(cached.items);
      }
    }

    void ensureFresh(false);
    const timer = window.setInterval(() => void ensureFresh(true), DIRECTORY_TTL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return directory;
}

export function filterMailContactDirectory(
  directory: ContactResponse[],
  query: string,
  limit = 10,
): ContactResponse[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];

  return directory
    .map((contact) => {
      const email = contact.email.toLowerCase();
      const name = contact.name?.toLowerCase() ?? "";
      const emailStarts = email.startsWith(term);
      const nameStarts = name.startsWith(term);
      const emailContains = email.includes(term);
      const nameContains = name.includes(term);
      if (!emailStarts && !nameStarts && !emailContains && !nameContains) return null;

      const score = emailStarts ? 0 : nameStarts ? 1 : emailContains ? 2 : 3;
      return { contact, score };
    })
    .filter((row): row is { contact: ContactResponse; score: number } => row !== null)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.contact.email.localeCompare(b.contact.email, "es", { sensitivity: "base" }),
    )
    .slice(0, limit)
    .map((row) => row.contact);
}
