/**
 * Entretien de fin de Round HORS COMBAT (couture A de l'audit « combat-only »).
 *
 * LDB 13 l.45-47 : « En dehors d'un Combat, la mesure du temps […] est bien plus flexible. Mais
 * il est quelquefois utile d'utiliser les Rounds même en dehors d'un Combat. » Les États qui « tickent »
 * (Hémorragique l.105 / Empoisonné l.66 / En flammes l.77) et l'agonie (0 PB → Inconscient après BE
 * Rounds, LDB 18 l.15) ne doivent pas geler dès qu'on sort du combat : on les fait progresser au fil de
 * l'horloge (1 Round ≈ TIME_COST.combatRound minute). En combat, c'est la frontière de Round qui s'en charge.
 *
 * Échapper à l'agonie par Hémorragie hors combat : Test de Guérison réussi retire l'État (LDB 09
 * l.261, LDB 16 l.107-109) — infirmerie hors combat (`ouvrirLeMedecin`, acte `bleed`, `noyau/medicFlow.ts`,
 * bouton « Soins » de `CharacterSheet.tsx`), n'avance pas le temps. Sans soigneur au Talent ni Destin,
 * l'agonie ci-dessus va à son terme.
 */
import type { FabriqueDId } from '../engine/fabriqueDId';
import { Combatant } from '../engine/types';
import { RNG } from '../engine/dice';
import { endOfRound, bleedDeathRoll, tickDeath, hasCondition } from '../engine/conditions';
import { fateSaveOrDie } from '../engine/fortune';
import { fireConditionEffects } from './triggeredEffects';
import { degatsDeLEtatIgnores } from '../engine/traits/dispatch';
import { spellOps } from '../engine/flowCore';
import { findConditionById } from '../data';
import { t } from '../i18n';
import { nomDe } from '../engine/nom';

/** L'État `id` inflige-t-il des Dégâts à chaque fin de Round (un effet `onRoundEnd` porteur de `wounds`) ? */
const degatsPeriodiques = (id: string): boolean =>
  (findConditionById(id)?.effects ?? []).some((e) => e.trigger === 'onRoundEnd' && spellOps(e.flow, 'target').some((o) => o.op === 'wounds'));

/** Porte-t-il un État à Dégâts périodiques dont il ne soit pas immunisé aux Dégâts (`degatsDeLEtatIgnores`,
 *  LDB 85 l.174) OU est-il à 0 PB (progression vers l'Inconscience) ? */
function needsUpkeep(c: Combatant): boolean {
  return c.wounds.current <= 0
    || c.conditions.some((x) => hasCondition(c, x.id) && degatsPeriodiques(x.id) && !degatsDeLEtatIgnores(c.traits, x.id));
}

/** Porte-t-il quelque chose que la FRONTIÈRE DE ROUND fait avancer — ops récurrentes à rejouer, durées
 *  en Rounds à écouler (effets actifs, États de sort, contrecoups d'incantation) ? C'est exactement le
 *  périmètre d'`endOfRound` (`engine/conditions.ts`) et rien d'autre. Un contrecoup peut naître hors
 *  combat (`interludeFlow`) : sans ce tic, sa durée en Rounds ne s'écoulerait jamais. Un effet GELÉ en
 *  attente de prolongation (`awaitingExtension`, `LDB 47 l.311`) ne compte pas : ni sa durée ni ses ops
 *  n'avancent plus, il ferait tourner la boucle jusqu'à `rounds` pour rien. */
function hasRoundTick(c: Combatant): boolean {
  return (c.activeEffects ?? []).some((e) => !e.awaitingExtension && (e.opsPerRound != null || e.duration.scale === 'rounds'))
    || c.conditions.some((x) => x.roundsLeft != null)
    || (c.castPenalties ?? []).some((p) => p.roundsLeft != null);
}

/**
 * Rejoue jusqu'à `rounds` Rounds d'entretien sur les membres du groupe qui en ont besoin. Mute `party`.
 * S'arrête dès que plus personne n'a besoin d'entretien (évite les longues boucles sur de grands sauts de
 * temps). Un héros qui mourrait par hémorragie est sauvé par un Point de Destin s'il en a. Retourne le journal.
 */
export function outOfCombatUpkeep(party: Combatant[], rounds: number, rng: RNG, idNeuf: FabriqueDId): string[] {
  const log: string[] = [];
  for (let r = 0; r < rounds; r++) {
    let active = false;
    for (const c of party) {
      if (c.dead) continue;
      if (!needsUpkeep(c)) {
        // TIC SEUL : la frontière de Round avance (ops récurrentes, durées), SANS l'entretien du porteur
        // en péril (Test de récupération du Sonné, auto-dissipation d'États, agonie) — celui-ci reste
        // réservé aux causes de `needsUpkeep`.
        if (!hasRoundTick(c)) continue;
        active = true;
        endOfRound(c, rng, idNeuf).forEach((l) => log.push(l));
        continue;
      }
      active = true;
      endOfRound(c, rng, idNeuf).forEach((l) => log.push(l)); // MÊME tic que ci-dessus (ops récurrentes + durées)
      // Dégâts périodiques d'État (Empoisonné/En Flammes/Hémorragique) MIGRÉS en données (effects: onRoundEnd
      // → wounds) : MÊME chemin qu'en combat, ils tickent AUSSI hors-combat. La cible 'self' ne touche pas
      // `battle` (targetsFor) → `get` stub suffit ; pas de `set` (flow sans test interactif hors combat).
      fireConditionEffects((() => ({ battle: undefined })) as never, c, 'onRoundEnd', { rng }).forEach((l) => log.push(l));
      const bd = bleedDeathRoll(c, rng); // mort par Hémorragique (10 %/pion, double = coagule)
      bd.log.forEach((l) => log.push(l));
      if (bd.died) {
        log.push(fateSaveOrDie(c) ? t('upkeep.fateSaved', { name: nomDe(c) }) : t('upkeep.succumb', { name: nomDe(c) }));
        continue;
      }
      tickDeath(c).forEach((l) => log.push(l)); // LDB 18 l.15, en 'aa' aussi (#1595 c.6219559935)
    }
    if (!active) break;
  }
  return log;
}
