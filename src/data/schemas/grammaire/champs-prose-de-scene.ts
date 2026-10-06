/**
 * Les CHAMPS DE PROSE d'un document de PROJET (scène/campagne) — la prose y vit dans la structure du
 * document, pas dans l'enveloppe `desc`/`descRef` d'une entrée. Chemins en notation
 * `scripts/source/adresses.mjs` (clés par `.`, index accolés — `[]` quand la position est libre).
 *
 * FEUILLE sans dépendance (pas même `zod`) : ses deux lecteurs sont la grammaire des scènes
 * (`prose.ts`, qui en fait le type du déclarateur `proseDeScene()`) et le périmètre du liage
 * (`CHEMINS_ADRESSES`, `src/ui/liage.ts`) — un module d'UI n'a pas à tirer le parseur pour lire une
 * liste de chaînes. Hôte UNIQUE : pas de second inventaire qui divergerait au premier champ ajouté.
 *
 * CRITÈRE D'ENTRÉE : le champ appartient au périmètre du LIAGE automatique (`CHEMINS_ADRESSES`,
 * `src/ui/liage.ts`) — une prose que `<Prose>` rend avec son `Porteur`, qui arme les liens du Codex.
 * Hors catalogue, rendus sans porteur ou hors `<Prose>` :
 *   `journal.desc` (`effets.ts`, `champsProse`) → `EFFECT_HANDLERS.journal` (`state/combatEffects.ts`).
 *   `dialogues[].nodes[].desc` (`scene.ts`, `champsProse`) → `DialogueBox.tsx` (texte nu, #2428),
 *     `DialogueHistoryScreen.tsx` (`<Prose>` sans porteur).
 *   `setObjective.desc`, `grantFavor.desc` (`effets.ts`) → `store.objectives`, `BackgroundPanel.tsx`.
 *   `choice.prompt` (`effets.ts`, `sceneFlowSchema`), `dialogues[].nodes[].choices[].label` (`scene.ts`) → libellés.
 *   `narratif.affaires[].desc` (`narratif.ts`), `desc` de scène (`scene.ts`) → jamais rendus au joueur.
 * Un de ces champs rendu un jour par `<Prose>` AVEC son porteur entre ICI dans le même geste.
 */
export const CHAMPS_PROSE_DE_SCENE = [
  'narratif.ouverture.pitch',
  'narratif.indices[].stades[].prose',
  'narratif.documents[].prose',
  'massBattle.terrain',
] as const;

export type CheminProseDeScene = (typeof CHAMPS_PROSE_DE_SCENE)[number];

/** Les chemins de prose d'un document de projet, en notation `adresses.mjs`. */
export function champsProseDeScene(): readonly CheminProseDeScene[] {
  return CHAMPS_PROSE_DE_SCENE;
}
