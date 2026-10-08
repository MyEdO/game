/** #2427 — chemins en notation `scripts/source/adresses.mjs`. */
export const PROSES_NOMMEES = {
  'narratif.ouverture.pitch': { champ: 'pitch', label: 'texte', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'narratif.indices[].stades[].prose': { champ: 'prose', label: 'texte', regime: 'narration', presence: 'optionnel', porteur: 'folio' },
  'narratif.documents[].prose': { champ: 'prose', label: 'texte', regime: 'document', presence: 'requis', porteur: 'folio' },
  'massBattle.terrain': { champ: 'terrain', label: 'terrain', regime: 'narration', presence: 'optionnel', porteur: 'folio' },
  'scenes[].startMessage.texte': { champ: 'texte', label: 'message d’introduction', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'worldMap.routes[].refus.texte': { champ: 'texte', label: 'raison du refus', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'narratif.ouverture.sousTitre.texte': { champ: 'texte', label: 'sous-titre', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'narratif.cloture.sousTitre.texte': { champ: 'texte', label: 'sous-titre', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'setObjective.desc': { champ: 'desc', label: 'objectif', regime: 'narration', presence: 'requis', porteur: 'adresse' },
  'grantFavor.desc': { champ: 'desc', label: 'faveur', regime: 'narration', presence: 'requis', porteur: 'adresse' },
  'stake.authored': { champ: 'authored', label: 'enjeu rédigé', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'narrative.text': { champ: 'text', label: 'texte', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'flow.choice.prompt': { champ: 'prompt', label: 'invite', regime: 'narration', presence: 'requis', porteur: 'folio' },
  'dialogues[].nodes[].desc': { champ: 'desc', label: 'réplique', regime: 'narration', presence: 'requis', porteur: 'adresse' },
  'journal.desc': { champ: 'desc', label: 'texte', regime: 'narration', presence: 'requis', porteur: 'adresse' },
} as const;

export type CheminProseDeScene = keyof typeof PROSES_NOMMEES;
export type ProseNommee = (typeof PROSES_NOMMEES)[CheminProseDeScene];
export const CHAMPS_PROSE_DE_SCENE = Object.keys(PROSES_NOMMEES) as CheminProseDeScene[];

/** Les chemins de prose d'un document de projet, en notation `adresses.mjs`. */
export function champsProseDeScene(): readonly CheminProseDeScene[] {
  return CHAMPS_PROSE_DE_SCENE;
}
