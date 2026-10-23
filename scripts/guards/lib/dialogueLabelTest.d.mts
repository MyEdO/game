export const RACINE_DEPOT: string;

export function mesurerLibellesDeReponse(
  vocabulaire: Omit<import('../../../src/noyau/dialogueLibelle').VocabulaireDuTag, 'competence'>,
  root?: string,
): string[];
