/** LDB 13 l.45-47 */
import type { Combatant } from '../engine/types';
import type { TriggeredEffect } from '../engine/flowCore';
import { flowHasTest, spellOps } from '../engine/flowCore';
import { endOfRound, bleedDeathRoll, tickDeath } from '../engine/conditions';
import { fateSaveOrDie } from '../engine/fortune';
import { t } from '../i18n';
import { battleRng } from './battleRng';
import { journaliser } from './combatLog';
import { touchActors } from './combatOrParty';
import { comptePorteursDeSuite, confierLaSuite, drainPendingLog, MAIN_RENDUE, type Applique } from './combatEffects';
import { applyTriggeredEffects, sourcesDEtats } from './triggeredEffects';
import { actorIn } from './monde/combatants';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import type { Get, Set } from './flowTypes';
import { nomDe } from '../engine/nom';
import { TIME_COST } from '../engine/timeCost';

interface EffetDEtatEnFinDeRound {
  effet: TriggeredEffect;
  stacks: number;
}

interface EntretienDuPorteur {
  avecAgonie: boolean;
  effetsRestants?: EffetDEtatEnFinDeRound[];
}

export interface RepriseEntretienDesRounds {
  rounds: number;
  porteurs: string[];
  index: number;
  roundActif: boolean;
  entretien?: EntretienDuPorteur;
}

function effetsDEtatEnFinDeRound(get: Get, c: Combatant): EffetDEtatEnFinDeRound[] {
  return sourcesDEtats(c, objetDuNarratif(get().campaignNarratif)).flatMap(({ effects, stacks }) =>
    effects.filter((effet) => effet.trigger === 'onRoundEnd').map((effet) => ({ effet, stacks: stacks ?? 1 })));
}

function infligeDesDegats({ effet }: EffetDEtatEnFinDeRound): boolean {
  return spellOps(effet.flow, 'target').some((op) => op.op === 'wounds');
}

function faitPasserUnRound(c: Combatant): boolean {
  return (c.activeEffects ?? []).some((e) => !e.awaitingExtension && (e.opsPerRound != null || e.duration.scale === 'rounds'))
    || c.conditions.some((x) => x.roundsLeft != null)
    || (c.castPenalties ?? []).some((p) => p.roundsLeft != null);
}

function direLEntretien(get: Get, set: Set, c: Combatant, lignes: string[]): void {
  journaliser(get, set, [...lignes, ...drainPendingLog(get, set).map((event) => event.text)], 'etat', { actorId: c.id });
}

/** LDB 16 l.105 ; LDB 18 l.15 */
function traiterLAgonie(c: Combatant): string[] {
  const { died, log } = bleedDeathRoll(c, battleRng());
  if (!died) return [...log, ...tickDeath(c)];
  const nom = fateSaveOrDie(c) ? 'upkeep.fateSaved' : 'upkeep.succumb';
  return [...log, t(nom, { name: nomDe(c) })];
}

/** Les Rounds que `minutes` font passer hors combat, joués par l'entretien du groupe. */
export function jouerLEntretienDesRoundsEcoules(get: Get, set: Set, minutes: number): Applique {
  const rounds = Math.floor(minutes / TIME_COST.combatRound);
  if (get().battle || rounds <= 0) return undefined;
  return reprendreEntretienDesRounds(get, set, { rounds, porteurs: get().party.map((c) => c.id), index: 0, roundActif: false });
}

/** Les étapes reprennent après la dernière conséquence jouée, avec le lot d'effets du porteur déjà entamé. */
export function reprendreEntretienDesRounds(get: Get, set: Set, reprise: RepriseEntretienDesRounds): Applique {
  const { porteurs } = reprise;
  let { rounds, index, roundActif, entretien } = reprise;
  while (rounds > 0) {
    for (; index < porteurs.length; index++, entretien = undefined) {
      const c = actorIn(get(), porteurs[index]);
      if (!c || c.dead) continue;
      if (!entretien) {
        const effets = effetsDEtatEnFinDeRound(get, c);
        const avecAgonie = c.wounds.current <= 0 || effets.some(infligeDesDegats);
        const aUnTest = effets.some(({ effet }) => flowHasTest(effet.flow));
        if (!avecAgonie && !aUnTest && !faitPasserUnRound(c)) continue;
        entretien = { avecAgonie };
        roundActif = true;
        const avant = comptePorteursDeSuite(get());
        const { forgerUnId, campaignNarratif } = get();
        direLEntretien(get, set, c, endOfRound(c, battleRng(), forgerUnId, objetDuNarratif(campaignNarratif)));
        if (comptePorteursDeSuite(get()) > avant) {
          set(touchActors(get()));
          confierLaSuite(set, [{ verbe: 'reprendreEntretienDesRounds', reprise: { rounds, porteurs, index, roundActif, entretien } }]);
          return MAIN_RENDUE;
        }
      }

      const { avecAgonie } = entretien;
      const effets = entretien.effetsRestants ?? effetsDEtatEnFinDeRound(get, c)
        .filter(({ effet }) => avecAgonie || flowHasTest(effet.flow));
      for (const [position, { effet, stacks }] of effets.entries()) {
        const avant = comptePorteursDeSuite(get());
        const lignes = applyTriggeredEffects(get, c, [effet], 'onRoundEnd', { set, rng: battleRng(), stacks });
        direLEntretien(get, set, c, lignes);
        if (comptePorteursDeSuite(get()) > avant) {
          set(touchActors(get()));
          const enCours = { avecAgonie, effetsRestants: effets.slice(position + 1) };
          confierLaSuite(set, [{ verbe: 'reprendreEntretienDesRounds', reprise: { rounds, porteurs, index, roundActif, entretien: enCours } }]);
          return MAIN_RENDUE;
        }
      }
      if (avecAgonie) direLEntretien(get, set, c, traiterLAgonie(c));
      set(touchActors(get()));
    }
    if (!roundActif) break;
    rounds--;
    index = 0;
    roundActif = false;
  }
  return undefined;
}
