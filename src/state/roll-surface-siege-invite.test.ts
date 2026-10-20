/**
 * SURFACE D'UN JET EN COOP (#1262 V0) — un jet SE SURFACE dès qu'un siège humain QUELCONQUE possède
 * son porteur (`sieges.jetSurfaced`, seat-agnostique), jamais seulement le siège LOCAL.
 *
 * Le chemin mesuré : chez l'HÔTE (siège 0), le héros `H1` appartient au siège 1 (invité). Le jet de
 * `H1` a un joueur — c'est l'invité qui le roulera — donc il doit remonter en fenêtre (surface `M`)
 * et non se résoudre en silence chez l'hôte. Même invariant pour la porte de repli sans-pilote
 * (`rollSansPilote`), qui garde le MÊME prédicat que la porte de surface.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { spyApplier } from './cascade.testkit';
import { setGmSeat } from './netFlow';
import { openRoll, rollSansPilote, type RollRequest } from '../noyau/rollSeam';
import { humanControlled } from '../noyau/netOwnership';
import { jetSurfaced } from '../noyau/sieges';
import type { Combatant } from '../engine/types';

const KIND = 'sonde-siege-invite';

const hero = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: `Héros ${id}`, kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    skills: [{ id: 'resistance', characteristic: 'endurance', advances: 20 }],
    conditions: [], talents: [], fortune: 1, resilience: 1,
    ...over,
  }) as unknown as Combatant;

const req = (actorId: string): RollRequest => ({
  side: { actorId },
  actionLabel: 'Résistance',
  test: { skill: 'resistance', char: 'endurance' },
  difficulty: 'intermediaire',
});

/** HÔTE au siège 0 ; `H1` attribué au siège 1 (invité) — la configuration coop la plus simple. */
function hoteAvecHerosDInvite(): void {
  useGame.setState({ party: [hero('H1')], pendingCascade: null } as never);
  useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { H1: 1 } } } as never);
}

describe('#1262 — le jet du héros d’un AUTRE siège se surface (jamais roulé en silence)', () => {
  const applied: { kind: string }[] = [];

  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, party: [], pendingCascade: null, journal: [], travelPlan: null } as never);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } } as never);
    setGmSeat(useGame.getState, useGame.setState, null);
    spyApplier(KIND, applied, (step) => ({ kind: step.kind }));
  });

  it('précondition MESURÉE : le prédicat d’affordance LOCALE ferme le jet de l’invité, le prédicat de SURFACE l’ouvre', () => {
    hoteAvecHerosDInvite();
    const s = useGame.getState();
    const h = s.party[0];
    expect(humanControlled(s, h), 'affordance locale : l’hôte ne pilote pas le héros de l’invité').toBe(false);
    expect(jetSurfaced(s, h), 'surface : ce héros a un joueur, son jet doit remonter').toBe(true);
  });

  it('openRoll pose une FENÊTRE pour le héros d’un siège invité (aucune conséquence appliquée d’office)', () => {
    hoteAvecHerosDInvite();
    openRoll(useGame.getState, useGame.setState, req('H1'), KIND);
    expect(useGame.getState().pendingCascade, 'jet de l’invité résolu en silence chez l’hôte').toBeTruthy();
    expect(applied).toHaveLength(0);
  });

  it('rollSansPilote REFUSE le héros d’un siège invité (il a un pilote — ailleurs)', () => {
    hoteAvecHerosDInvite();
    const h = useGame.getState().party[0];
    expect(() => rollSansPilote(useGame.getState, h, 45)).toThrow(/jet silencieux/);
  });

  it('un héros conduit par l’IA (aiControlled) n’a AUCUN pilote : il reste inline, et le repli l’accepte', () => {
    useGame.setState({ party: [hero('H1', { aiControlled: true } as Partial<Combatant>)], pendingCascade: null } as never);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { H1: 1 } } } as never);
    openRoll(useGame.getState, useGame.setState, req('H1'), KIND);
    expect(useGame.getState().pendingCascade, 'aucun pilote : aucune fenêtre').toBeNull();
    expect(applied, 'résolu d’office, conséquence appliquée').toHaveLength(1);
    const h = useGame.getState().party[0];
    expect(() => rollSansPilote(useGame.getState, h, 45)).not.toThrow();
  });
});
