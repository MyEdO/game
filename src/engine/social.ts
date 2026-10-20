/**
 * Modificateurs sociaux de **Statut** (LDB 08) — couche PURE (zéro accès store).
 *
 * Le Statut (Échelon Bronze < Argent < Or + Standing) module les Tests sociaux : « ceux de
 * l'Échelon supérieur obtiennent un bonus de +10 à leur Test de Charme lorsque ce dernier a pour
 * cible des personnes appartenant à un Échelon inférieur. De la même façon, les personnes
 * appartenant à un Échelon inférieur subissent une pénalité de -10 lorsqu'ils doivent influencer
 * des personnes d'Échelon supérieur. » (LDB 08 l.57). Ce ±10 INTER-Échelon est le RAW de base :
 * il s'applique TOUJOURS dès que la couche est présente (ce n'est pas une option).
 *
 * Trois règles optionnelles l'enrichissent (registre `policy.ts`, groupe « Social ») :
 *  - `social-status-reaction-roll` (l.54 + l.63-67/90) : 1d10 avant le Test → 1-2 « Braver le
 *    Statut » (aucun mod), 3-8 réactions classiques (mod normal), 9-10 « Opinions extrêmes »
 *    (mod inversé).
 *  - `social-begging-bonus` (l.92) : un Bronze qui mendie auprès d'un Argent (« juste au-dessus »)
 *    obtient +10 au lieu de −10.
 *  - `social-charm-intra-tier` (l.88, « Le MJ peut décider, plus rarement, d'appliquer ces
 *    modificateurs à ceux qui sont de Standing différent au sein d'un même Échelon ») : ±10 entre
 *    deux personnes du MÊME Échelon selon leur Standing.
 *
 * Module FEUILLE pur : réutilise `Status`/`parseStatus` de `creation.ts` (PAS de re-parsing) et
 * `rule` de `policy.ts` ; le RNG du jet de réaction est INJECTÉ (`opts.rng`) pour rester testable.
 */
import { Status, parseStatus } from './creation';
import { rule } from './policy';
import type { Combatant } from './types';
import { findCareerById, levelsForCareer } from '../data';
import { t } from '../i18n';

/** Rang numérique d'un Échelon (Bronze < Argent < Or) pour la comparaison RAW. */
const TIER_RANK: Record<Status['tier'], number> = { Bronze: 0, Argent: 1, Or: 2 };

/** Statut DÉRIVÉ d'une carrière + niveau (`CareerLevelData.status`, ex. « Argent 2 ») — couche PURE,
 *  découplée de `Combatant` (id de carrière + niveau bruts) pour servir aussi la Condition PARTY-level
 *  `status` (#711, `flowCore.ts`) sans dépendre du type complet. Repli « Bronze 1 » si la carrière/le
 *  niveau est introuvable (personnage anonyme = Bronze, LDB 08 l.115). */
export function statusOf(career: string | undefined, careerLevel: number | undefined): Status {
  const levels = levelsForCareer(career ?? '');
  const lvl = findCareerById(career ?? '') ? levels[Math.max(0, (careerLevel ?? 1) - 1)] : undefined;
  return parseStatus(lvl?.status ?? 'Bronze 1');
}

/** Statut d'un Combatant DÉRIVÉ de sa carrière + niveau — voir `statusOf`. */
export function actorStatus(c: Combatant): Status {
  return statusOf(c.career, c.careerLevel);
}

/** Le Statut `actual` atteint-il AU MOINS `atLeast` (« Argent 2 », `parseStatus`) ? Compare l'Échelon
 *  via `TIER_RANK` puis, à Échelon égal, le Standing — utilisé par la Condition PARTY-level `status`
 *  (#711, `flowCore.ts`), SOURCE UNIQUE de comparaison de palier (partagée avec `statusCharmMod`). */
export function statusMeets(actual: Status, atLeast: string): boolean {
  const need = parseStatus(atLeast);
  const da = TIER_RANK[actual.tier], dn = TIER_RANK[need.tier];
  if (da !== dn) return da > dn;
  return actual.standing >= need.standing;
}

/** Capricieux (Trait de créature, MSRC 15 l.149-159) : « Le tempérament de la créature passe d'un
 *  extrême à l'autre. Lorsqu'un Personnage effectue un Test de Sociabilité en traitant avec la
 *  créature, lancez un dé selon le Tableau suivant : » — « 1 → Soustraire 2 au DR ; 2-3 → Soustraire
 *  1 au DR ; 4-7 → Utiliser le DR indiqué ; 8-9 → Ajouter 1 au DR ; 10 → Ajouter 2 au DR ».
 *  Rend le DELTA de DR de la table (le d10 est tiré UNE fois par Test, RNG seedé, par l'appelant). */
export function capriciousDR(roll: number): number {
  if (roll <= 1) return -2;
  if (roll <= 3) return -1;
  if (roll <= 7) return 0;
  if (roll <= 9) return 1;
  return 2;
}

/** Mod social RAW (LDB 08) d'un `actor` envers une `target`, options de `policy.ts` comprises.
 *  - (a) inter-Échelon : actor > target → +10, < → −10, = → 0 (RAW de base, toujours actif).
 *  - (b) si même Échelon ET règle `social-charm-intra-tier` : ±10 selon le Standing.
 *  - (c) règle `social-begging-bonus` + actor Bronze + target Argent + `opts.begging` → force +10.
 *  - (d) règle `social-status-reaction-roll` : enveloppe le résultat via un 1d10 PRÉ-TIRÉ par l'appelant
 *        (`opts.reactionRoll`, RNG SEEDÉ, UN seul tirage par Test) — 1-2 → 0, 3-8 → mod, 9-10 → −mod.
 *        PUR : aucun tirage ici. */
export function statusCharmMod(
  actor: Status,
  target: Status,
  opts?: { begging?: boolean; reactionRoll?: number },
): number {
  let mod: number;
  const da = TIER_RANK[actor.tier], dt = TIER_RANK[target.tier];
  if (da !== dt) {
    // (a) Inter-Échelon : ±10 selon le sens (RAW de base, LDB 08 l.57).
    mod = da > dt ? 10 : -10;
    // (c) Mendicité (LDB 08 l.63) : Bronze → Argent « juste au-dessus » → +10 au lieu de −10.
    if (
      rule('social-begging-bonus') && opts?.begging &&
      actor.tier === 'Bronze' && target.tier === 'Argent'
    ) {
      mod = 10;
    }
  } else if (rule('social-charm-intra-tier') && actor.standing !== target.standing) {
    // (b) Intra-Échelon (option, l.88) : ±10 selon le Standing.
    mod = actor.standing > target.standing ? 10 : -10;
  } else {
    mod = 0; // même Échelon (et option intra-Échelon off ou Standing égal) → aucun mod.
  }

  // (d) Au-delà de la norme sociale (option, l.54/90) : 1d10 enveloppant PRÉ-TIRÉ par l'appelant
  // (UN tirage seedé par Test, gaté par la règle au point d'appel — plus de tirage par candidat ici).
  if (opts?.reactionRoll != null) {
    if (opts.reactionRoll <= 2) return 0;     // Braver le Statut : aucun modificateur.
    if (opts.reactionRoll >= 9) return -mod;  // Opinions extrêmes : modificateurs inversés.
    // 3-8 : réactions classiques → mod inchangé.
  }
  return mod;
}

/** Libellé d'affichage du mod de Statut pour la modale (sur le modèle de `socialPsychLabel`), ou
 *  undefined si aucun mod. Le 1d10 de la règle de réaction n'est PAS retiré ici (effet caché du MJ) :
 *  on décrit la base RAW. Ex. « Statut (Argent>Bronze) +10 ». */
export function statusCharmLabel(
  actor: Status,
  target: Status,
  opts?: { begging?: boolean },
): string | undefined {
  const mod = statusCharmMod(actor, target, opts); // affichage = base RAW (jamais le 1d10 caché)
  if (!mod) return undefined;
  const sign = mod > 0 ? '+' : '−';
  const cmp = mod > 0 ? '>' : '<'; // le comparateur SUIT le sens du mod (cohérent même en mendicité)
  const beg = rule('social-begging-bonus') && opts?.begging && actor.tier === 'Bronze' && target.tier === 'Argent';
  const side = actor.tier === target.tier && !beg
    ? `${actor.tier} ${actor.standing}${cmp}${target.standing}` // intra-Échelon : compare le Standing
    : `${actor.tier}${cmp}${target.tier}`;
  return t('social.statusMod', { beg: beg ? t('social.fragBegging') : '', side, sign, mod: Math.abs(mod) });
}
