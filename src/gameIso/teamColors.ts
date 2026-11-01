/**
 * FAÇADE des couleurs d'IDENTITÉ d'unité (anneaux des pions), de la couleur d'une barre de vie et du
 * ton d'alarme du repli visible. Utilisée par le rendu de carte (`SurcoucheIso`, surcouche de jetons) ET par le HUD
 * React (CombatConsole, CampaignView) — pas de duplication. La DONNÉE vit dans `src/data/teintesJeu.json`
 * (schéma et invariants : `src/data/schemas/defs/teintesJeu.ts`), qui sert aussi les surbrillances
 * d'arène par l'autre façade (`highlightTints.ts`).
 */
import { teintesJeu } from '../data';

/** Anneau jaune de l'unité active sur le terrain (réservé : ne JAMAIS l'utiliser pour une équipe). */
export const ACTIVE_RING = teintesJeu['anneau-actif'];

/** Anneau des ennemis (rouge — réservé : ne JAMAIS l'utiliser pour un héros ou un PNJ) : le cran ENNEMI de
 *  l'axe d'identité par unité, frère des quatre `HERO_RING`. Son octet égale celui d'`ENEMY_TINT`
 *  (axe d'APPARTENANCE) ; le partage est déclaré au schéma (`PARTAGES_NOMMES`) et les deux entrées
 *  restent distinctes — retirer le rouge de l'anneau ne retire pas le rouge de la case. */
export const ENEMY_RING = teintesJeu['anneau-ennemi'];

/** Identité des unités hors groupe : héros sans rang et PNJ, indépendante de leur relation. */
export const OUT_OF_PARTY_RING = teintesJeu['anneau-hors-groupe'];

/**
 * Anneaux d'identité des quatre héros du groupe, dans l'ordre du groupe.
 * Ces quatre couleurs froides se distinguent du rouge ennemi et du jaune actif.
 * La séparation des quatre est un INVARIANT mesuré au schéma (`SEUIL_IDENTITE_HEROS`).
 */
export const HERO_RING = [
  teintesJeu['identite-heros-1'],
  teintesJeu['identite-heros-2'],
  teintesJeu['identite-heros-3'],
  teintesJeu['identite-heros-4'],
];

/**
 * Teintes SÉMANTIQUES d'équipe (Lot 1) — case sous le pion + voile léger sur le modèle :
 * allié = vert, ennemi = rouge, unité active = jaune (prime sur la couleur d'équipe pour la case).
 * Distinct des anneaux d'IDENTITÉ par héros (HERO_RING), qui restent un indice secondaire.
 */
export const ALLY_TINT = teintesJeu['equipe-allie'];
/** Appartenance ENNEMIE d'une case, d'un voile, d'un marqueur de station (`topoMarkers.stationTint`) —
 *  axe distinct de l'anneau d'unité `ENEMY_RING`, avec lequel elle partage son octet (partage déclaré). */
export const ENEMY_TINT = teintesJeu['equipe-ennemi'];
/** MÊME entrée que `ACTIVE_RING` et que le halo de case (`ACTIVE_HALO_TINT`, `highlightTints.ts`) :
 *  un seul signal « voici l'unité qui joue », trois surfaces. */
export const ACTIVE_TINT = teintesJeu['anneau-actif'];
/** Relation NEUTRE : or/jaune ; son partage d'octet avec l'or du joueur est NOMMÉ au schéma
 *  (`PARTAGES_NOMMES`, `schemas/defs/teintesJeu.ts`). L'identité hors groupe lit `OUT_OF_PARTY_RING`. */
export const NEUTRAL_TINT = teintesJeu['equipe-neutre'];

/** Couleur de la RELATION d'une cible au survol/visée (réticule + halo) : adversaire rouge, allié
 *  vert, neutre or. Source unique consommée par le rendu de ciblage (`SurcoucheIso`). */
export function relationColor(kind: 'hero' | 'enemy' | 'npc'): string {
  return kind === 'enemy' ? ENEMY_TINT : kind === 'hero' ? ALLY_TINT : NEUTRAL_TINT;
}

/** Couleur de teinte d'une CASE selon l'appartenance (l'actif prime). */
export function tileTint(isHero: boolean, active: boolean): string {
  return active ? ACTIVE_TINT : isHero ? ALLY_TINT : ENEMY_TINT;
}

/**
 * Canal d'appartenance INDÉPENDANT de la teinte (R9 — daltonisme ~8 % des hommes) : la FORME de l'anneau
 * encode l'équipe en plus de sa couleur. Ennemi = anneau POINTILLÉ ; toute autre unité = trait PLEIN.
 * Renvoie un `strokeDasharray` SVG (ou undefined pour un trait plein). Source unique consommée par les
 * pions de terrain (`stage/TokenChromeOverlay`).
 */
export function teamShape(isEnemy: boolean): string | undefined {
  return isEnemy ? '5 3' : undefined;
}

/** Couleur du VOILE d'équipe sur le modèle (encode l'équipe ; l'« actif » est porté par le halo/la case). */
export function veilTint(isHero: boolean): string {
  return isHero ? ALLY_TINT : ENEMY_TINT;
}

/** Ton d'ALARME du repli visible (#223, #877) — SOURCE UNIQUE, partagée par l'art de repli
 *  (`catalog/viewArt.ts` `MISSING_ART`) et les entrées de repli des catalogues (`catalog/missing.ts`). */
export const MISSING_TONE = '#ff2fb0';
/** Fond sourd de la caisse d'alarme (contraste du ton criard). */
export const MISSING_TONE_DARK = '#2a0820';

/**
 * Couleur PLEINE d'une barre de vie selon le ratio (PB courant / max) :
 * rouge sombre à 0, rouge en zone critique, orange entamé, vert sain.
 * (Corrige l'ancien dégradé rouge→vert figé qui laissait le bord vert même blessé.)
 */
export function hpColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r <= 0) return '#922b21'; // mort / 0 PB
  if (r <= 0.34) return '#e74c3c'; // critique
  if (r <= 0.67) return '#e8a33d'; // entamé
  return '#2ecc71'; // sain
}
