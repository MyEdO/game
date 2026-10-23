/**
 * FAÇADE des couleurs d'IDENTITÉ d'unité (anneaux des pions + portraits HUD) et de la couleur d'une
 * barre de vie. Utilisée par le rendu de carte (`SurcoucheIso`, surcouche de jetons) ET par le HUD
 * React (CombatConsole, CampaignView) — pas de duplication. La DONNÉE vit dans `src/data/teintesJeu.json`
 * (schéma et invariants : `src/data/schemas/defs/teintesJeu.ts`), qui sert aussi les surbrillances
 * d'arène par l'autre façade (`highlightTints.ts`).
 */
import { teintesJeu } from '../data';

/** Anneau jaune de l'unité active sur le terrain (réservé : ne JAMAIS l'utiliser pour une équipe). */
export const ACTIVE_RING = teintesJeu['anneau-actif'];

/** Anneau des ennemis (rouge — réservé : ne JAMAIS l'utiliser pour un héros) : le cran NON-HÉROS de
 *  l'axe d'identité par unité, frère des quatre `HERO_RING`. Son octet égale celui d'`ENEMY_TINT`
 *  (axe d'APPARTENANCE) ; le partage est déclaré au schéma (`PARTAGES_NOMMES`) et les deux entrées
 *  restent distinctes — retirer le rouge de l'anneau ne retire pas le rouge de la case. */
export const ENEMY_RING = teintesJeu['anneau-ennemi'];

/**
 * Anneaux d'identité des héros (un par héros, cyclique). 4 couleurs FROIDES distinctes,
 * choisies pour qu'AUCUNE ne puisse se confondre avec le rouge ennemi ni le jaune actif
 * (c'était le bug « un allié a un rond rouge » : l'or et le magenta tiraient vers le chaud).
 * La séparation des quatre est un INVARIANT mesuré au schéma (`SEUIL_IDENTITE_HEROS`).
 */
export const HERO_RING = [
  teintesJeu['identite-heros-1'],
  teintesJeu['identite-heros-2'],
  teintesJeu['identite-heros-3'],
  teintesJeu['identite-heros-4'],
];

/**
 * Teintes SÉMANTIQUES d'équipe — case sous le pion + voile léger sur le modèle :
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
/** Cible NEUTRE (npc) : or/jaune — distinct du jaune ACTIF réservé (`anneau-actif`) ; son partage
 *  d'octet avec l'or du joueur est NOMMÉ au schéma (`PARTAGES_NOMMES`, `schemas/defs/teintesJeu.ts`). */
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
 * encode l'équipe en plus de sa couleur. Héros = anneau PLEIN (undefined) ; ennemi = anneau POINTILLÉ.
 * Renvoie un `strokeDasharray` SVG (ou undefined pour un trait plein). Source unique consommée par les
 * pions de terrain (`stage/TokenChromeOverlay`) et les portraits HUD (RigPortrait).
 */
export function teamShape(isHero: boolean): string | undefined {
  return isHero ? undefined : '5 3';
}

/** Couleur du VOILE d'équipe sur le modèle (encode l'équipe ; l'« actif » est porté par le halo/la case). */
export function veilTint(isHero: boolean): string {
  return isHero ? ALLY_TINT : ENEMY_TINT;
}

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
