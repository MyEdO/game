export const RACINE_DEPOT: string;
export const RACINE_SCENES: { readonly dossier: string; readonly suffixe: string };

export function mesurerLibellesDeReponse(
  vocabulaire?: { carac?: Record<string, string>; difficultes?: Record<string, string> },
  root?: string,
): string[];
