/**
 * Guérison — Compétence Avancée (Int). Soin de Blessures et arrêt d'Hémorragie.
 * Source : LDB 09 l.254-269 (skills.json), LDB 16 l.103-109, LDB 18 l.298.
 * Pur + testé ; ne dépend que de types/conditions (déjà purs).
 */
import { Combatant, type Difficulty } from './types';
import { hasSurgery } from './combatFeatures/dispatch';
import { loseWounds, addCondition, removeCondition, reprendreConnaissance, recoveredStacks, hasSurgeryLockedCondition, syncDerivedConditions, stacks } from './conditions';
import { hasTreatableTrauma, hasSurgeryTrauma, hasRecoverableTrauma, hasLimbAwaitingAid } from './trauma';
import { contractDisease } from './disease';
import { isAstoundingFailure } from './tests';
import { rule } from './policy';
import { t } from '../i18n';
import type { RNG } from './dice';
import { chebyshev } from './grid';
import { isStructure } from './structures';

/** Id STABLE de la Compétence des actes de soin — source unique des sites qui la testent ou la lisent. */
export const HEAL_SKILL = 'guerison';

/** Le personnage possède-t-il le Talent Chirurgie (LDB 10) ? Prérequis pour opérer une blessure
 *  chirurgicale (amputation, fracture majeure). */
export function hasSurgerySkill(c: Combatant): boolean {
  return hasSurgery(c);
}

/** Cible soignable par la Guérison : blessée (PB perdus) OU porteuse d'≥1 État Hémorragique OU avec une déchirure
 *  traitable ; ni morte ni éjectée, ni Structure (AA 10 l.134). Les cibles Inconscientes/À Terre sont valides
 *  (1 PB lève l'inconscience, LDB 18 l.15). */
export function isHealable(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre || isStructure(c)) return false;
  return c.wounds.current < c.wounds.max || stacks(c, 'hemorragique') > 0 || hasTreatableTrauma(c)
    || hasSurgeryTrauma(c) || hasRecoverableTrauma(c) || hasLimbAwaitingAid(c) || hasSurgeryLockedCondition(c);
}

/** Un soin MAGIQUE (Sort, Miracle) rend-il des Blessures à `c` ? Toujours, hors Structure : règle maison
 *  `structure-soin-magique` (AA 10 l.134). */
export function soinMagiqueOperant(c: Combatant): boolean {
  return !isStructure(c) || rule('structure-soin-magique') === true;
}

/** `recovery` = Test ÉTENDU de Guérison qui rend l'usage d'un membre désactivé (« Épaule luxée »/« Genou
 *  démis », LDB 18 l.120/179), après Aide Médicale — hors combat, cf. `medicFlow`. */
export type HealMode = 'wounds' | 'bleed' | 'trauma' | 'surgery' | 'recovery' | 'ammo';

/** Tous les modes de soin, dans l'ordre où l'infirmerie les présente. */
export const HEAL_MODES: readonly HealMode[] = ['wounds', 'bleed', 'ammo', 'trauma', 'surgery', 'recovery'];

/** Pourquoi `target` n'offre pas le mode de soin `mode` : la raison affichée, ou `null` (le mode s'offre).
 *  Verdict du PATIENT seul — le soigneur, l'offre et la bourse relèvent de `refusDActeDeSoin` (noyau). */
export function raisonDeModeDeSoin(target: Combatant, mode: HealMode): string | null {
  switch (mode) {
    case 'wounds':
      if (target.wounds.current >= target.wounds.max) return t('heal.raisonPleinesBlessures');
      return target.soinRencontreUtilise ? t('heal.raisonSoinDejaRecu') : null; // LDB 09 l.233
    case 'bleed':
      return stacks(target, 'hemorragique') > 0 ? null : t('heal.raisonSansHemorragie');
    case 'trauma':
      return hasTreatableTrauma(target) ? null : t('heal.raisonSansDechirure');
    case 'surgery': // LDB 10 l.184, LDB 18
      return hasSurgeryTrauma(target) || hasSurgeryLockedCondition(target) ? null : t('heal.raisonSansChirurgie');
    case 'recovery': // LDB 18 l.120/179
      return hasRecoverableTrauma(target) || hasLimbAwaitingAid(target) ? null : t('heal.raisonSansMembre');
    case 'ammo': // LDB 62 l.250
      return lodgedAmmoCount(target) > 0 ? null : t('heal.raisonSansMunition');
  }
}

/** Modes disponibles pour soigner `target` : ceux dont `raisonDeModeDeSoin` est `null`. Le mode `trauma`
 *  (LDB 18 l.222) est hors-combat — les consommateurs en combat le filtrent (`combatHealModes`). */
export function availableHealModes(target: Combatant): HealMode[] {
  return HEAL_MODES.filter((m) => raisonDeModeDeSoin(target, m) === null);
}

/** Difficulté du Test de Guérison selon le mode de soin. Blessures : Intermédiaire (+0, LDB 09 l.269)
 *  toujours. Hémorragie : Accessible (+20) en variante `combat-aa-blessures: 'aa'` (AA 07 l.9,
 *  applicable en et hors combat — le texte ne borne pas au combat), Intermédiaire (+0) sinon
 *  (LDB, comportement par défaut inchangé). Munition logée : Intermédiaire (+0) toujours (LDB 62
 *  l.250 — aucune variante AA ne couvre le retrait). SOURCE UNIQUE — combat (`combatSlice`) ET
 *  Infirmerie (`medicFlow`). */
export function healDifficulty(mode: HealMode): Difficulty {
  return mode === 'bleed' && rule('combat-aa-blessures') === 'aa' ? 'accessible' : 'intermediaire';
}

/** Actes IMMÉDIATS (un jet, une Action) : seuls offerts en combat et pendant une opération armée ; `trauma`,
 *  `surgery` et `recovery` sont des actes au long cours. SOURCE UNIQUE du partage. */
const ACTES_IMMEDIATS: readonly HealMode[] = ['wounds', 'bleed', 'ammo'];
export const estActeImmediat = (mode: HealMode): boolean => ACTES_IMMEDIATS.includes(mode);

/** `raisonDeModeDeSoin` en combat : un mode hors-combat y est fermé. Verdict UNIQUE des gestes de soin en
 *  combat (`battleHeal`, `healSetMode`) et de `combatHealModes`. */
export function raisonDeModeDeSoinEnCombat(target: Combatant, mode: HealMode): string | null {
  return estActeImmediat(mode) ? raisonDeModeDeSoin(target, mode) : t('heal.raisonHorsCombat');
}

/** Modes de soin offerts EN COMBAT : ceux dont `raisonDeModeDeSoinEnCombat` est `null`. Consommée par le
 *  ciblage-carte (mode par défaut) ET le sélecteur de la modale de soin. */
export function combatHealModes(target: Combatant): HealMode[] {
  return HEAL_MODES.filter((m) => raisonDeModeDeSoinEnCombat(target, m) === null);
}

/** Cibles soignables atteignables par `healer`. En combat : soi + adjacents (Chebyshev ≤ 1).
 *  Hors combat : tout le `pool`. */
export function healableTargets(healer: Combatant, pool: Combatant[], opts: { adjacency: boolean }): Combatant[] {
  return pool.filter((t) => {
    if (!isHealable(t)) return false;
    if (!opts.adjacency || t.id === healer.id) return true;
    if (!healer.pos || !t.pos) return false;
    return chebyshev(healer.pos, t.pos) <= 1;
  });
}

/** Soin de Blessures (LDB 09 l.260) : succès ⇒ BI+DR (plancher 0) ; échec ⇒ si BI+DR<0, perte de
 *  |BI+DR| PB (sinon 0). Renvoie le delta de PB (positif = soin, négatif = dégât). */
export function healWoundsDelta(intBonus: number, dr: number, success: boolean): number {
  const total = intBonus + dr;
  if (success) return Math.max(0, total);
  return total < 0 ? total : 0;
}

/** Arrêt d'Hémorragie (LDB 09 l.261 / LDB 16 l.107-109) : succès ⇒ retire 1+DR pions (borné) ;
 *  tous retirés ⇒ Exténué. Échec ⇒ rien. */
export function stopBleedOutcome(dr: number, stacks: number, success: boolean): { removed: number; gainExtenue: boolean } {
  const removed = recoveredStacks(dr, stacks, success); // « 1 + DR » borné, partagé avec Empêtré/En flammes
  return { removed, gainExtenue: removed > 0 && removed >= stacks };
}

/** Munitions Empaleuses logées (LDB 62 l.250) : nombre de flèches/carreaux/balles non retirés — pions de
 *  l'État `munition-logee` (`etats.json`), posé par l'Atout Empaleuse à distance sur Critique. */
export function lodgedAmmoCount(target: Combatant): number {
  return stacks(target, 'munition-logee');
}

/** Options de routage d'`applyHealWounds` — chaque chemin de gain de PB (Guérison, sorts/potions,
 *  drain, repos) porte ses propres à-côtés sans dupliquer le plafond de munition logée. */
export interface HealWoundsOptions {
  /** Verrous « 1 soin de Blessures / rencontre » + matériel stérile (LDB 09 l.260 / LDB 18 l.298) —
   *  SEUL le chemin compétence Guérison les pose. Défaut `true` (comportement historique de la
   *  fonction, chemin Guérison). */
  skillCheck?: boolean;
  /** Lève l'Inconscient et remet l'horloge de mort à zéro dès qu'on repasse > 0 PB (LDB 18 l.15).
   *  Défaut `true` (comportement historique). Le repos gère sa PROPRE réanimation (+ À Terre, non
   *  couvert ici) — `false` pour éviter un double traitement partiel. */
  wake?: boolean;
  /** Libellé de journal spécifique au chemin (reçoit le nombre de PB EFFECTIVEMENT rendus, déjà
   *  plafonné) — sinon le libellé par défaut du chemin Guérison. */
  log?: (healed: number) => string[];
}

/** Montant de PB effectivement rendus par un `delta` positif (plafond munitions Empaleuses logées,
 *  LDB 62 l.250) — calcul PUR, SOURCE UNIQUE partagée par `applyHealWounds` (mutation) et la
 *  PRÉVISUALISATION du jet (`describeHeal`, #473 : la popin annonçait le brut, pas le plafonné). */
export function cappedHealAmount(target: Combatant, delta: number): number {
  if (delta <= 0) return delta;
  const before = target.wounds.current;
  const cap = Math.max(before, target.wounds.max - lodgedAmmoCount(target));
  return Math.min(cap, before + delta) - before;
}

/** SOURCE UNIQUE de gain de Blessures (mutation) — routée par les 4 chemins qui rendent des PB
 *  (Guérison, sorts/prières/potions `heal`/`healCaster`, drain `lifeSteal`, repos naturel). Lève
 *  l'Inconscient et remet l'horloge de mort à zéro quand on repasse > 0 PB (LDB 18 l.15, `wake`).
 *  Plafonné par les munitions Empaleuses logées, sans exception de chemin : « Chaque flèche ou
 *  balle non retirée vous empêche de guérir 1 de vos Blessures » (LDB 62 l.250 — formulation
 *  générale, aucune restriction au Test de Guérison). Renvoie un journal. */
export function applyHealWounds(target: Combatant, delta: number, opts: HealWoundsOptions = {}): string[] {
  const { skillCheck = true, wake = true, log: customLog } = opts;
  if (delta < 0) {
    const lost = loseWounds(target, -delta); // perte centralisée (−Avantage + À Terre à 0)
    return [t('heal.backfire', { name: target.label, lost })];
  }
  if (delta === 0) return customLog ? customLog(0) : [t('heal.nothing', { name: target.label })];
  const before = target.wounds.current;
  target.wounds.current = before + cappedHealAmount(target, delta);
  if (skillCheck) {
    target.soinRencontreUtilise = true; // a bénéficié de SON soin de cette rencontre (LDB 09 l.260)
    target.woundDressed = true; // matériel stérile : « aucune Infection » suite à la blessure (LDB 09 l.260 / LDB 18 l.298)
  }
  const healed = target.wounds.current - before;
  const log = customLog ? customLog(healed) : (healed > 0
    ? [t('heal.gain', { name: target.label, n: healed, cur: target.wounds.current, max: target.wounds.max })]
    : [t('heal.lodgedBlocks', { name: target.label })]);
  if (wake && target.wounds.current > 0 && reprendreConnaissance(target)) log.push(t('heal.awake', { name: target.label }));
  if (wake && target.wounds.current > 0) target.roundsAtZero = 0;
  // Le réveil ci-dessus retire TOUT l'Inconscient : celui qu'un fait toujours vivant PORTE (Fièvre
  // (Grave), LDB 20 l.170) revient par la réconciliation — un soin ne guérit pas la fièvre.
  log.push(...syncDerivedConditions(target));
  return log;
}

/** Applique l'arrêt d'Hémorragie (mutation). `dr` = DR du Test réussi. */
export function applyStopBleed(target: Combatant, dr: number): string[] {
  const { removed, gainExtenue } = stopBleedOutcome(dr, stacks(target, 'hemorragique'), true);
  if (removed <= 0) return [t('heal.bleedResists', { name: target.label })];
  removeCondition(target, 'hemorragique', removed);
  const log = [t('heal.bleedStopped', { name: target.label, n: removed })];
  if (gainExtenue) {
    addCondition(target, 'extenue');
    log.push(t('heal.bleedExtenue', { name: target.label }));
  }
  return log;
}

/** SOURCE UNIQUE de l'application d'un soin de Blessures (Guérison) : delta BI+DR appliqué (mutation),
 *  + Infection Mineure sur Échec Stupéfiant (DR ≤ −6, LDB 09). Partagée par le soin de combat, le
 *  médecin payant ET la chirurgie (bandage). Renvoie le journal + le nombre de PB rendus. */
export function resolveWoundsHeal(target: Combatant, intBonus: number, sl: number, success: boolean, rng: RNG): { log: string[]; healed: number } {
  // « Un patient ne peut bénéficier que d'UN JET de Guérison après chaque rencontre » (LDB 09
  // l.260) : le jet est consommé même raté — sans MJ, on relancerait gratuitement jusqu'au succès.
  target.soinRencontreUtilise = true;
  const healed = healWoundsDelta(intBonus, sl, success);
  const log = applyHealWounds(target, healed);
  if (isAstoundingFailure(success, sl)) {
    const dz = contractDisease('infection-mineure', rng);
    if (dz && !(target.diseases ?? []).some((d) => d.id === dz.id)) {
      target.diseases = [...(target.diseases ?? []), dz];
      log.push(t('heal.astoundingFail', { name: target.label }));
    }
  }
  return { log, healed };
}

/** SOURCE UNIQUE de l'arrêt d'Hémorragie (Guérison) : applique si réussi, message d'échec sinon. */
export function resolveBleedHeal(target: Combatant, sl: number, success: boolean): string[] {
  return success ? applyStopBleed(target, sl) : [t('heal.bleedResists', { name: target.label })];
}

/** Retrait d'une munition Empaleuse logée (LDB 62 l.250 : « Les flèches et les carreaux nécessitent
 *  un Test de Guérison Intermédiaire pour être retirés »). Un succès retire 1 munition (`munition-logee`,
 *  la plus ancienne pion) ; un échec ne retire rien. */
export function resolveExtractLodgedAmmo(target: Combatant, success: boolean): string[] {
  const before = lodgedAmmoCount(target);
  if (before <= 0) return [t('heal.noLodged', { name: target.label })];
  if (!success) return [t('heal.lodgedResists', { name: target.label })];
  removeCondition(target, 'munition-logee', 1);
  return [t('heal.lodgedRemoved', { name: target.label, left: before - 1 })];
}
