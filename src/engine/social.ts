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
 *  - `social-reaction-au-statut` (l.38-46) : table `reaction-au-statut.json`.
 *  - `social-mendicite-statut` (l.92) : un Bronze qui mendie auprès d'un Argent (« juste au-dessus »)
 *    obtient +10 au lieu de −10.
 *  - `social-statut-meme-echelon` (l.88, « Le MJ peut décider, plus rarement, d'appliquer ces
 *    modificateurs à ceux qui sont de Standing différent au sein d'un même Échelon ») : ±10 entre
 *    deux personnes du MÊME Échelon selon leur Standing.
 *
 * Module FEUILLE pur : réutilise `Status`/`statutDeDonnee` de `money.ts` (PAS de re-parsing) et
 * `rule` de `policy.ts` ; les tables tirées le sont au RNG INJECTÉ.
 */
import { libelleDEchelon, statutDeDonnee, type Status } from './money';
import { rule } from './policy';
import { rollDice, type RNG } from './dice';
import { findTableEntry } from './tables';
import capricieuxJson from '../data/tableau-capricieux.json';
import reactionAuStatutJson from '../data/reaction-au-statut.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from '../data/rangees';
import type * as capricieux from '../data/schemas/defs/tableau-capricieux';
import type * as reactionAuStatut from '../data/schemas/defs/reaction-au-statut';
import { findCareerById, levelsForCareer } from '../data';
import { t } from '../i18n';

/** Rang numérique d'un Échelon (Bronze < Argent < Or) pour la comparaison RAW. */
const TIER_RANK: Record<Status['tier'], number> = { bronze: 0, argent: 1, or: 2 };

/** Ce que lisent les Statuts d'un personnage : carrière, niveau, effets actifs (forme structurelle, que la
 *  Condition PARTY-level `status` de `flowCore.ts` partage avec `Combatant`). */
export interface PorteurDeStatut {
  career?: string;
  careerLevel?: number;
  activeEffects?: readonly { statusMod?: number }[];
}

/** Statut d'un personnage dont la carrière ou le niveau est introuvable dans la donnée. */
const STATUT_SANS_CARRIERE: Status = { tier: 'bronze', standing: 1 };

/** Statut de CARRIÈRE (`CareerLevelData.status` du niveau atteint), brique d'`actorStatus`. LDB 08 l.9 */
export function statutDeCarriere(c: PorteurDeStatut): Status {
  const levels = levelsForCareer(c.career ?? '');
  const lvl = findCareerById(c.career ?? '') ? levels[Math.max(0, (c.careerLevel ?? 1) - 1)] : undefined;
  return lvl ? statutDeDonnee(lvl.status) : STATUT_SANS_CARRIERE;
}

/** Échelons du plus bas au plus haut. LDB 08 l.9 */
const ECHELONS: readonly Status['tier'][] = ['bronze', 'argent', 'or'];

/** Le Statut `statut` décalé de `delta` Points de Standing ; vers le haut, sans changement d'Échelon.
 *  LDB 08 l.9, l.101 */
export function decalerLeStatut(statut: Status, delta: number): Status {
  if (delta >= 0) return { tier: statut.tier, standing: statut.standing + delta };
  let { tier, standing } = statut;
  for (let i = 0; i > delta && standing > 0; i--) {
    standing -= 1;
    const rang = ECHELONS.indexOf(tier);
    if (standing === 0 && rang > 0) {
      tier = ECHELONS[rang - 1];
      standing = 5;
    }
  }
  return { tier, standing };
}

/** Statut EFFECTIF : le Statut de carrière décalé de la SOMME des `statusMod` actifs. SEUL lecteur du
 *  Statut d'un personnage. LDB 08 l.101, LDB 23 l.234 */
export function actorStatus(c: PorteurDeStatut): Status {
  return decalerLeStatut(statutDeCarriere(c), (c.activeEffects ?? []).reduce((s, e) => s + (e.statusMod ?? 0), 0));
}

/** Le Statut `actual` atteint-il AU MOINS `atLeast` (« Argent 2 », `parseStatus`) ? Compare l'Échelon
 *  via `TIER_RANK` puis, à Échelon égal, le Standing — utilisé par la Condition PARTY-level `status`
 *  (#711, `flowCore.ts`), SOURCE UNIQUE de comparaison de palier (partagée avec `statusCharmMod`). */
export function statusMeets(actual: Status, atLeast: string): boolean {
  const need = statutDeDonnee(atLeast);
  const da = TIER_RANK[actual.tier], dn = TIER_RANK[need.tier];
  if (da !== dn) return da > dn;
  return actual.standing >= need.standing;
}

/** La table Capricieux VIVANTE (MSRC 15 l.149-159) — la collection que le Codex édite (`tableauCapricieux`, `data/overrides.ts`). */
export const TABLE_DU_CAPRICIEUX = rangeesDe<typeof capricieux>(capricieuxJson);
/** Le dé de la table Capricieux, lu sur sa table. */
export const deDuCapricieux = () => deDeTirageDe<typeof capricieux>(capricieuxJson);

/** Un tirage sur la table Capricieux (MSRC 15 l.151-159) : le jet et le modificateur de DR de sa rangée. PUR. */
export function tirerLeCapricieux(rng: RNG): { roll: number; dr: number } {
  const roll = rollDice(deDuCapricieux(), rng);
  return { roll, dr: findTableEntry(TABLE_DU_CAPRICIEUX, roll).dr };
}

/** La table de Réaction au Statut VIVANTE (LDB 08 l.38-46) — la collection que le Codex édite (`reactionAuStatut`). */
export const TABLE_DE_REACTION_AU_STATUT = rangeesDe<typeof reactionAuStatut>(reactionAuStatutJson);

/** L'issue d'un tirage de Réaction au Statut. */
export type IssueDeReaction = RangeeDe<typeof reactionAuStatut>['issue'];

/** Un tirage sur la table de Réaction au Statut (LDB 08 l.40-46) : l'issue de sa rangée. PUR. */
export function tirerLaReactionAuStatut(rng: RNG): IssueDeReaction {
  return findTableEntry(TABLE_DE_REACTION_AU_STATUT, rollDice(deDeTirageDe<typeof reactionAuStatut>(reactionAuStatutJson), rng)).issue;
}

/** Le mod de Statut `mod` sous l'issue de réaction `issue` (LDB 08 l.43-45). */
const MOD_SOUS_LA_REACTION: Record<IssueDeReaction, (mod: number) => number> = {
  'braver-le-statut': () => 0,
  'reactions-classiques': (mod) => mod,
  'opinions-extremes': (mod) => -mod,
};

/** Mod social RAW (LDB 08) d'un `actor` envers une `target`, options de `policy.ts` comprises.
 *  - (a) inter-Échelon : actor > target → +10, < → −10, = → 0 (RAW de base, toujours actif).
 *  - (b) si même Échelon ET règle `social-statut-meme-echelon` : ±10 selon le Standing.
 *  - (c) règle `social-mendicite-statut` + actor Bronze + target Argent + `opts.begging` → force +10.
 *  - (d) règle `social-reaction-au-statut` : enveloppe le résultat selon l'issue PRÉ-TIRÉE par
 *        l'appelant (`opts.reaction`, `tirerLaReactionAuStatut`). PUR : aucun tirage ici. */
export function statusCharmMod(
  actor: Status,
  target: Status,
  opts?: { begging?: boolean; reaction?: IssueDeReaction },
): number {
  let mod: number;
  const da = TIER_RANK[actor.tier], dt = TIER_RANK[target.tier];
  if (da !== dt) {
    // (a) Inter-Échelon : ±10 selon le sens (RAW de base, LDB 08 l.57).
    mod = da > dt ? 10 : -10;
    // (c) Mendicité (LDB 08 l.63) : Bronze → Argent « juste au-dessus » → +10 au lieu de −10.
    if (
      rule('social-mendicite-statut') && opts?.begging &&
      actor.tier === 'bronze' && target.tier === 'argent'
    ) {
      mod = 10;
    }
  } else if (rule('social-statut-meme-echelon') && actor.standing !== target.standing) {
    // (b) Intra-Échelon (option, l.88) : ±10 selon le Standing.
    mod = actor.standing > target.standing ? 10 : -10;
  } else {
    mod = 0; // même Échelon (et option intra-Échelon off ou Standing égal) → aucun mod.
  }

  // (d) LDB 08 l.38-46
  return opts?.reaction ? MOD_SOUS_LA_REACTION[opts.reaction](mod) : mod;
}

/** Libellé d'affichage du mod de Statut pour la modale (sur le modèle de `socialPsychLabel`), ou
 *  undefined si aucun mod. Le tirage de Réaction au Statut n'est PAS retiré ici (effet caché du MJ) :
 *  on décrit la base RAW. Ex. « Statut (Argent>Bronze) +10 ». */
export function statusCharmLabel(
  actor: Status,
  target: Status,
  opts?: { begging?: boolean },
): string | undefined {
  const mod = statusCharmMod(actor, target, opts); // affichage = base RAW (jamais la réaction cachée)
  if (!mod) return undefined;
  const sign = mod > 0 ? '+' : '−';
  const cmp = mod > 0 ? '>' : '<'; // le comparateur SUIT le sens du mod (cohérent même en mendicité)
  const beg = rule('social-mendicite-statut') && opts?.begging && actor.tier === 'bronze' && target.tier === 'argent';
  const side = actor.tier === target.tier && !beg
    ? `${libelleDEchelon(actor.tier)} ${actor.standing}${cmp}${target.standing}` // intra-Échelon : compare le Standing
    : `${libelleDEchelon(actor.tier)}${cmp}${libelleDEchelon(target.tier)}`;
  return t('social.statusMod', { beg: beg ? t('social.fragBegging') : '', side, sign, mod: Math.abs(mod) });
}
