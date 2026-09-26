/**
 * Noyade et Suffocation (LDB 18 l.346) : « si vous n'avez pas eu le temps de vous préparer et
 * que vous vous retrouvez brutalement privé d'air, vous suffoquez immédiatement. Vous perdez
 * 1 Point de blessure par Round que vous passez à suffoquer. Si vos Points de blessure passent
 * à 0, gagnez immédiatement l'État Inconscient. Après cela, et au bout d'un nombre de Rounds
 * égal à votre Bonus d'Endurance, vous mourez par suffocation ou par noyade. »
 *
 * Le drapeau `suffocates` est porté par un ActiveEffect (sorts : Ombres étrangleuses,
 * Transmutation de Chamon) OU dérivé POSITIONNELLEMENT (`offTerrainSuffocates`, `engine/ops.ts` —
 * Créature marine hors de l'eau, « sinon elles se mettent à suffoquer », MDG 16 l.19). `noBreath`
 * (Bénédiction de Souffle, LDB 41 : « n'a pas besoin de respirer et ignore les règles de
 * suffocation ») immunise. La MORT passe par le canal mort-lente existant (`inDeathCondition` lit
 * `suffocationCountdown`) → un héros à Destin est suspendu (pendingFateSave) comme pour toute mort
 * lente.
 *
 * Rétention de souffle (LDB 18 l.346) : « si vous êtes suffisamment préparé, vous pouvez retenir
 * votre souffle pendant un nombre de secondes égal à votre Bonus d'Endurance x 10 sans avoir à
 * effectuer un Test. À l'inverse, si vous n'avez pas eu le temps de vous préparer et que vous vous
 * retrouvez brutalement privé d'air, vous suffoquez immédiatement. » Une plongée ANTICIPÉE appelle
 * `prepareBreathHold` (pose `breathHoldSeconds = BE×10`) : tant que ce crédit dure, la suffocation ne
 * fait perdre aucune Blessure. Le crédit est décompté par Round via la règle `combat-round-seconds`
 * (LDB 13 l.13 — « c'est le MJ qui décide » de la durée d'un Round ; hypothèse de calibrage 10 s,
 * non RAW). Privé d'air brutalement (`breathHoldSeconds` absent) = suffocation immédiate.
 *
 * Contre-mesure « aspergée d'eau » (Créature marine, MDG 16 l.19 : « elles doivent être
 * régulièrement aspergées d'eau, sinon elles se mettent à suffoquer ») — le RAW nomme le geste mais
 * ne chiffre AUCUNE mécanique (pas de Test, pas de coût, pas de cadence en Rounds) : `c.wateredThisRound`
 * est un drapeau MAISON qui immunise le Round où il est posé, puis se consomme (« régulièrement » =
 * à reposer chaque Round pour rester immunisé). Posé par l'Action de combat « Asperger d'eau »
 * (#497, `battleWater`/`WATER_MODE`, `state/targetingModes.ts`) : une main PORTE un contenant d'eau
 * (capacité `waterContainer`, `hasWaterContainer` ci-dessous) et cible une Créature marine adjacente
 * hors de l'eau (`offTerrainSuffocates`) — aucun jet, aucun décompte de doses (l'eau se repuise, le
 * RAW n'en chiffre aucune).
 */
import type { Combatant } from './types';
import { hasActiveFlag } from './activeFlags';
import { addCondition, hasCondition, loseWounds } from './conditions';
import { bonus, effectiveChar } from './characteristics';
import { rule } from './policy';
import { offTerrainSuffocates } from './ops';
import { itemCapability } from './capabilities';
import { t } from '../i18n';
import { chebyshev } from './grid';

/** Une main porte-t-elle un contenant d'eau (Outre à eau, LDB 64 l.35 / Seau, LDB 67 l.59) ? Capacité par-OBJET
 *  `waterContainer`, NON gatée sur le port — on le sort du sac pour asperger, comme `isRation`
 *  (`engine/provisions.ts`). Gate de l'Action « Asperger d'eau » (#497). */
export function hasWaterContainer(c: Combatant): boolean {
  return (c.items ?? []).some((it) => itemCapability(it, 'waterContainer'));
}

/** Cible ÉLIGIBLE à « Asperger d'eau » (#497) : Créature marine hors de l'eau et en train de
 *  suffoquer pour cette raison — MÊME prédicat que `suffocationTick` (`offTerrainSuffocates`),
 *  jamais une re-dérivation. */
export function isWaterSprayTarget(target: Combatant): boolean {
  return offTerrainSuffocates(target);
}

/** Candidats ADJACENTS éligibles à « Asperger d'eau » (#497) dans le camp de l'aspergeur — MÊME
 *  filtre d'adjacence (`chebyshev` <= 1, `engine/grid.ts`) que `healableTargets`, cible = une
 *  Créature marine hors de l'eau (`isWaterSprayTarget`). */
export function waterSprayCandidates(active: Combatant, pool: Combatant[]): Combatant[] {
  return pool.filter((t) => {
    if (t.id === active.id || !isWaterSprayTarget(t)) return false;
    if (!active.pos || !t.pos) return false;
    return chebyshev(active.pos, t.pos) <= 1;
  });
}

/** Durée d'un Round de combat en secondes — LDB 13 l.13 : « c'est le MJ qui décide » ; hypothèse de
 *  calibrage maison (règle `combat-round-seconds`), PAS une certitude canon. Utilisée pour décompter
 *  la rétention de souffle. */
const secondsPerRound = (): number => Number(rule('combat-round-seconds'));

/** Souffle retenable sans Test (LDB 18 l.346) : Bonus d'Endurance × 10 secondes. Pur. */
export function breathHoldSeconds(c: Combatant): number {
  return Math.max(0, bonus(effectiveChar(c, 'endurance'))) * 10;
}

/** Anticipation d'une privation d'air (plongée volontaire, apnée préparée) : pose le crédit de souffle
 *  BE×10 s (LDB 18 l.346). À appeler AVANT que le combattant se retrouve privé d'air pour qu'il ne
 *  suffoque pas immédiatement. Mute `c`. Sans cet appel, la privation brutale suffoque tout de suite. */
export function prepareBreathHold(c: Combatant): void {
  c.breathHoldSeconds = breathHoldSeconds(c);
}

/** Tick de fin de Round d'un combattant qui suffoque. Mute `c`, retourne le journal. */
export function suffocationTick(c: Combatant): string[] {
  if (c.dead || c.outOfRencontre) return [];
  // Contre-mesure MAISON « aspergée d'eau » (MDG 16 l.19) : immunise CE Round, puis se consomme —
  // à reposer chaque Round pour rester immunisé (« régulièrement »).
  const wateredThisRound = !!c.wateredThisRound;
  if (wateredThisRound) delete c.wateredThisRound;
  const marineSuffocating = offTerrainSuffocates(c) && !wateredThisRound;
  if ((!hasActiveFlag(c, 'suffocates') && !marineSuffocating) || hasActiveFlag(c, 'noBreath')) {
    // L'air revient (effet expiré / immunité / de retour dans l'eau / aspergée) : on arrête de mourir
    // ET on récupère son souffle.
    if (c.suffocationCountdown != null) delete c.suffocationCountdown;
    if (c.breathHoldSeconds != null) delete c.breathHoldSeconds;
    return [];
  }
  // Rétention de souffle (l.346) : tant que le crédit dure, aucune Blessure perdue — on l'entame.
  if ((c.breathHoldSeconds ?? 0) > 0) {
    c.breathHoldSeconds = Math.max(0, c.breathHoldSeconds! - secondsPerRound());
    return [c.breathHoldSeconds > 0
      ? t('suff.holding', { name: c.label, s: c.breathHoldSeconds })
      : t('suff.noAir', { name: c.label })];
  }
  const lines: string[] = [];
  const be = Math.max(1, bonus(effectiveChar(c, 'endurance')));
  if (c.wounds.current > 0) {
    loseWounds(c, 1);
    lines.push(t('suff.lose', { name: c.label }));
    if (c.wounds.current <= 0) {
      if (!hasCondition(c, 'inconscient')) addCondition(c, 'inconscient');
      c.suffocationCountdown = be;
      lines.push(t('suff.faints', { name: c.label, n: be }));
    }
    return lines;
  }
  // Déjà à 0 PB : décompte vers la mort (BE Rounds après l'Inconscient, LDB 18 l.346).
  if (c.suffocationCountdown == null) {
    if (!hasCondition(c, 'inconscient')) addCondition(c, 'inconscient');
    c.suffocationCountdown = be;
    lines.push(t('suff.unconscious', { name: c.label, n: be }));
    return lines;
  }
  c.suffocationCountdown -= 1;
  lines.push(c.suffocationCountdown <= 0
    ? t('suff.dies', { name: c.label })
    : t('suff.countdown', { name: c.label, n: c.suffocationCountdown }));
  return lines;
}
