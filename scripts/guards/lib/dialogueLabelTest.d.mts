export const RACINE_DEPOT: string;

export function mesurerLibellesDeReponse(
  vocabulaire: Omit<import('../../../src/state/dialogueLibelle').VocabulaireDuTag, 'competence'>,
  root?: string,
): string[];
