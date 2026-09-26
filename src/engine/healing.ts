/**
 * Guérison — Compétence Avancée (Int). Soin de Blessures et arrêt d'Hémorragie.
 * Source : LDB 09 l.254-269 (skills.json), LDB 16 l.103-109, LDB 18 l.298.
 * Pur + testé ; ne dépend que de types/conditions (déjà purs).
 */
import { Combatant, type Difficulty } from './types';
import { hasSurgery } from './combatFeatures/dispatch';
import { loseWounds, addCondition, removeCondition, hasCondition, recoveredStacks, hasSurgeryLockedCondition, syncDerivedConditions } from './conditions';
import { hasTreatableTrauma, hasSurgeryTrauma, hasRecoverableTrauma, hasLimbAwaitingAid } from './trauma';
import { contractDisease } from './disease';
import { isAstoundingFailure } from './tests';
import { rule } from './policy';
import { t } from '../i18n';
import type { RNG } from './dice';
import { chebyshev } from './grid';

/** Pions d'un État (local — `stacks` n'est pas exporté par conditions.ts). */
const condStacks = (c: Combatant, name: string) => c.conditions.find((x) => x.id === name)?.value ?? 0;

/** Id STABLE de la Compétence des actes de soin — source unique des sites qui la testent ou la lisent. */
export const HEAL_SKILL = 'guerison';

/** Le combattant possède-t-il la Compétence (Avancée) Guérison ? Sans Augmentation, « aucune idée
 *  de comment soigner » (LDB 09 l.30, l.32). */
export function hasHealSkill(c: Combatant): boolean {
  return (c.skills ?? []).some((s) => s.id === HEAL_SKILL);
}

/** Le personnage possède-t-il le Talent Chirurgie (LDB 10) ? Prérequis pour opérer une blessure
 *  chirurgicale (amputation, fracture majeure). */
export function hasSurgerySkill(c: Combatant): boolean {
  return hasSurgery(c);
}

/** Cible soignable : blessée (PB perdus) OU porteuse d'≥1 État Hémorragique OU avec une déchirure traitable ;
 *  ni morte ni éjectée. Les cibles Inconscientes/À Terre sont valides (1 PB lève l'inconscience, LDB 18 l.15). */
export function isHealable(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  return c.wounds.current < c.wounds.max || condStacks(c, 'hemorragique') > 0 || hasTreatableTrauma(c)
    || hasSurgeryTrauma(c) || hasRecoverableTrauma(c) || hasLimbAwaitingAid(c) || hasSurgeryLockedCondition(c);
}

/** `recovery` = Test ÉTENDU de Guérison qui rend l'usage d'un membre désactivé (« Épaule luxée »/« Genou
 *  démis », LDB 18 l.120/179), après Aide Médicale — hors combat, cf. `medicFlow`. */
export type HealMode = 'wounds' | 'bleed' | 'trauma' | 'surgery' | 'recovery' | 'ammo';

/** Modes disponibles pour soigner `target`, compte tenu de la limite « 1 soin de Blessures / rencontre ».
 *  Le mode `trauma` (accélérer la convalescence d'une déchirure, LDB 18 l.222) est hors-combat — les
 *  consommateurs en combat le filtrent. */
export function availableHealModes(target: Combatant): HealMode[] {
  const modes: HealMode[] = [];
  if (target.wounds.current < target.wounds.max && !target.soinRencontreUtilise) modes.push('wounds');
  if (condStacks(target, 'hemorragique') > 0) modes.push('bleed');
  if (hasTreatableTrauma(target)) modes.push('trauma');
  if (hasSurgeryTrauma(target) || hasSurgeryLockedCondition(target)) modes.push('surgery'); // Blessure Critique chirurgicale OU État verrouillé « par Chirurgie » (Hémorragie interne, LDB 18) ; gate Talent Chirurgie côté action
  // Récupération d'usage : proposée dès qu'un membre est désactivé (Test étendu de Guérison), MAIS bloquée tant
  // que l'Aide Médicale n'a pas été reçue (`actBlockReason` : « Aide Médicale d'abord », LDB 18 l.120/179).
  if (hasRecoverableTrauma(target) || hasLimbAwaitingAid(target)) modes.push('recovery');
  // Retrait de munition Empaleuse logée (LDB 62 l.250) : proposé dès qu'au moins une flèche/carreau/balle
  // reste plantée — même patron que `bleed` (compte de pions → mode). #494 raffinera la distinction
  // flèches/carreaux (Guérison) vs balles (Chirurgien), non tracée aujourd'hui.
  if (lodgedAmmoCount(target) > 0) modes.push('ammo');
  return modes;
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

/** Modes de soin applicables EN COMBAT : Blessures + Hémorragie + retrait de munition logée (allow-list
 *  explicite ; `trauma` convalescence et `surgery` chirurgie sont hors-combat). SOURCE UNIQUE — consommée
 *  par le ciblage-carte (mode par défaut) ET le sélecteur de la modale de soin. */
export function combatHealModes(target: Combatant): HealMode[] {
  return availableHealModes(target).filter((m) => m === 'wounds' || m === 'bleed' || m === 'ammo');
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
  return condStacks(target, 'munition-logee');
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
  if (wake && target.wounds.current > 0 && hasCondition(target, 'inconscient')) {
    removeCondition(target, 'inconscient', condStacks(target, 'inconscient')); // reprend connaissance (LDB 18 l.15)
    log.push(t('heal.awake', { name: target.label }));
  }
  if (wake && target.wounds.current > 0) target.roundsAtZero = 0;
  // Le réveil ci-dessus retire TOUT l'Inconscient : celui qu'un fait toujours vivant PORTE (Fièvre
  // (Grave), LDB 20 l.170) revient par la réconciliation — un soin ne guérit pas la fièvre.
  log.push(...syncDerivedConditions(target));
  return log;
}

/** Applique l'arrêt d'Hémorragie (mutation). `dr` = DR du Test réussi. */
export function applyStopBleed(target: Combatant, dr: number): string[] {
  const { removed, gainExtenue } = stopBleedOutcome(dr, condStacks(target, 'hemorragique'), true);
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
