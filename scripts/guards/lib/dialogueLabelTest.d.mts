export const RACINE_DEPOT: string;
export const RACINE_SCENES: { readonly dossier: string; readonly suffixe: string };

export function mesurerLibellesDeReponse(
  vocabulaire: Omit<import('../../../src/state/dialogueLibelle').VocabulaireDuTag, 'competence'>,
  root?: string,
): string[];
