/**
 * PORTEUR par défaut d'un aperçu rig au Codex — foyer UNIQUE du clivage « fragment porté » vs
 * « entité autonome ».
 *
 * Une `appearance` de mutation/trait (`mutations.json`, `traits.json`) n'est pas une entité : c'est un
 * FRAGMENT de surcouche (`features`/`parts`/`colors`/`eyes`, jamais `species`) que le rendu réel applique
 * sur le rig d'un PORTEUR (`src/gameIso/rig/parts/combatantVisuals.ts:23-39`). Prévisualisé seul, il
 * n'offre aucune espèce à résoudre et son libellé FR n'est l'id d'aucun record : `resolveRender` retombe
 * sur la race par défaut en CRIANT une donnée manquante (`src/gameIso/rig/bodyPlan.ts:190-195`).
 *
 * PORTÉE MESURÉE : le geste est DIAGNOSTIC-ONLY — il éteint le cri, il ne change aucun pixel.
 * `resolveRender` rend le même verdict sur les 628 items du Codex avec et sans porteur, et le SVG des
 * mutations à `appearance` est identique des deux côtés (garde `codex-apercu-porteur.test.ts`, volet
 * « le porteur n'est pas un rendu »). Seule `mutations` porte de l'`appearance` en donnée aujourd'hui ;
 * `traits.json` et `psychology.json` en portent 0 (mesuré) — leur déclaration sert l'authoring
 * (`CodexEdit`, champ `porteur` d'`AppearanceField`) et le jour où une entrée en porte une.
 *
 * La correction est une DÉCLARATION, pas une branche : la catégorie déclare ici l'espèce du porteur sur
 * lequel son fragment se prévisualise, et cette espèce alimente l'argument `species` que `resolveRender`
 * consulte DÉJÀ en premier. Une catégorie sans déclaration (créatures) garde le diagnostic : chez elle,
 * une espèce introuvable reste un défaut de donnée.
 */
import { DEFAULT_RACE_ID } from '../../data';

/** Espèce du porteur par défaut : la race par défaut DÉCLARÉE en donnée (`speciesRace.json`). */
export const PORTEUR_PAR_DEFAUT: string = DEFAULT_RACE_ID;

/** Catégories du Codex dont l'`appearance` est un FRAGMENT porté → espèce du porteur d'aperçu. */
const PORTEUR_PAR_CATEGORIE: Record<string, string> = {
  traits: PORTEUR_PAR_DEFAUT,
  psychologie: PORTEUR_PAR_DEFAUT, // même projection que `traits` (`traitItem`), même fragment
  mutations: PORTEUR_PAR_DEFAUT,
};

/** Espèce du porteur d'aperçu déclarée par une catégorie ; `undefined` = entité autonome. */
export const porteurDApercu = (categoryKey: string): string | undefined => PORTEUR_PAR_CATEGORIE[categoryKey];
