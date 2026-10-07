/** #2427 — chemins en notation `scripts/source/adresses.mjs`. */
export const PROSES_NOMMEES = {
  'narratif.ouverture.pitch': { champ: 'pitch', label: 'texte', regime: 'narration', presence: 'requis' },
  'narratif.indices[].stades[].prose': { champ: 'prose', label: 'texte', regime: 'narration', presence: 'optionnel' },
  'narratif.documents[].prose': { champ: 'prose', label: 'texte', regime: 'document', presence: 'requis' },
  'massBattle.terrain': { champ: 'terrain', label: 'terrain', regime: 'narration', presence: 'optionnel' },
} as const;

export type CheminProseDeScene = keyof typeof PROSES_NOMMEES;
export type ProseNommee = (typeof PROSES_NOMMEES)[CheminProseDeScene];
export const CHAMPS_PROSE_DE_SCENE = Object.keys(PROSES_NOMMEES) as CheminProseDeScene[];

/** Les chemins de prose d'un document de projet, en notation `adresses.mjs`. */
export function champsProseDeScene(): readonly CheminProseDeScene[] {
  return CHAMPS_PROSE_DE_SCENE;
}
