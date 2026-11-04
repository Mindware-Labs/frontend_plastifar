import { useQuery } from "@tanstack/react-query";
import { emailsApi } from "../api/emails";
import { queryClient } from "../lib/queryClient";
import type { ContactResponse } from "../types/api";

const DIRECTORY_TTL_MS = 60 * 60 * 1000;
const DIRECTORY_KEY = ["emails", "contact-directory"] as const;
const EMPTY: ContactResponse[] = [];

/** Tras escribir a alguien nuevo: el siguiente montaje vuelve a pedir la libreta. */
export function invalidateMailContactDirectory() {
  void queryClient.invalidateQueries({ queryKey: DIRECTORY_KEY, refetchType: "none" });
}

/** Libreta de correos con actividad en bandeja; se refresca cada hora. */
export function useMailContactDirectory() {
  // Un fallo conserva la ultima libreta buena: TanStack no borra `data` al fallar.
  const query = useQuery({
    queryKey: DIRECTORY_KEY,
    queryFn: () => emailsApi.contactDirectory(),
    staleTime: DIRECTORY_TTL_MS,
    refetchInterval: DIRECTORY_TTL_MS,
  });

  return query.data ?? EMPTY;
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
