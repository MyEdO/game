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
 * CRITÈRE D'ENTRÉE : le champ est rendu à l'écran PAR UN PORTEUR DE PROSE (`<Prose>` & co). Les
 * autres `z.string()` de prose des defs de scène ne sont PAS ici parce qu'aucun rendu ne les passe à
 * un porteur de prose (mesuré #1392 T0, corrections point 10) :
 *   `effets.ts:122` `reveal.text`      → `SceneRevealModal.tsx` : texte NU dans un `<p>`.
 *   `effets.ts:196` `dialogue.text`    → `DialogueModal.tsx` : texte NU (réplique jouée).
 *   `effets.ts:198` `dialogue.choices[].text` → libellé de bouton.
 *   `effets.ts:509` `journal.text`     → `CarnetScreen.tsx` : entrée de journal en texte nu.
 *   `narratif.ts:43` `indices[].resume` → libellé court de l'index du carnet.
 *   `scene.ts:424`  `objectives[].label` → libellé d'objectif.
 *   `scene.ts:702`  `hooks[].note`     → note d'authoring, jamais rendue au joueur.
 * Un de ces champs qui passerait un jour par `<Prose>` entre ICI dans le même geste.
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
