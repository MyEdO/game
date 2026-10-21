import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Combatant } from '../engine/types';
import { useGame } from './store';
import { spawnEnemy } from '../noyau/monde/spawn';
import { seedBattleRng } from '../noyau/battleRng';
import { applyCriticalToTarget, runEnemyAI } from '../noyau/combatFlow';
import { buildApi } from './devtools';
import { emptyScene } from '../noyau/monde/scene';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { t } from '../i18n';

/** Une coque qui n'est PAS un navire (`profilNavalDe` : pas de facette `ship`) — EDOC 07 l.334, MDG 13 l.656. */
const diligence = (id = 'dil', pos = { x: 7, y: 5 }): Combatant => spawnEnemy({ ref: 'diligence' }, id, pos);
const cogue = (id = 'nav', pos = { x: 5, y: 5 }): Combatant => spawnEnemy({ ref: 'cogue' }, id, pos);

const poser = (combatants: Combatant[], over: Record<string, unknown> = {}): void => {
  useGame.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: [], scene: emptyScene('scene-test', 20, 20), travelPlan: null, facing: {}, vessel: null, journal: [], ...over,
  } as never);
};

describe('coque routière (EDOC 07 l.334) : ni Critique, ni collision, ni IA de navire', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seedBattleRng(7);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('un Critique sur une diligence ne lève pas, ne compte aucune Blessure Critique, ne pose aucun État et journalise le refus', () => {
    const dil = diligence();
    poser([dil]);
    const avant = { conditions: [...dil.conditions], criticalWounds: dil.criticalWounds };
    const log: string[] = [];
    const mort = applyCriticalToTarget(dil, 'corps', 0, log, useGame.setState, { get: useGame.getState });
    expect(mort).toBe(false);
    expect(dil.criticalWounds).toBe(avant.criticalWounds);
    expect(dil.conditions).toEqual(avant.conditions);
    expect(log).toEqual([t('cf.coqueSansCritique', { name: dil.label })]);
  });

  it('le banc shipCrit sur un trajet terrestre (diligence au plan de voyage) rend ✗ sans lever', () => {
    const coche = vehicleCombatant(findVehicleById('diligence')!)!;
    poser([], { travelPlan: { vehicle: coche } });
    const api = buildApi();
    expect(api.shipCrit('coque')).toBe('✗ aucune coque de NAVIRE en jeu (lance un scénario naval, ou appareille)');
    expect(api.shipCrit('coque', { hullId: coche.id })).toBe(`✗ « ${coche.label} » n'est pas une coque de NAVIRE : aucun Critique de navire`);
  });

  it("un navire qui avance sur une diligence ne résout aucune collision : aucune des deux coques n'encaisse", () => {
    const nav = cogue();
    const dil = diligence();
    poser([nav, dil], { facing: { nav: 'E' } });
    const avant = { nav: nav.wounds.current, dil: dil.wounds.current };
    useGame.getState().shipAdvance('nav', 3);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'dil')!.wounds.current).toBe(avant.dil);
    expect(b.combatants.find((c) => c.id === 'nav')!.wounds.current).toBe(avant.nav);
  });

  it("une diligence ENNEMIE à son tour face à un navire de héros ne joue pas l'IA de navire et ne lève pas", () => {
    const nav = cogue('nav', { x: 3, y: 5 });
    nav.kind = 'hero';
    const dil = diligence('dil', { x: 10, y: 5 });
    poser([nav, dil], { facing: { nav: 'E', dil: 'W' } });
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: 1 } });
    expect(() => runEnemyAI(useGame.getState, useGame.setState, 'dil')).not.toThrow();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'dil')!.pos).toEqual({ x: 10, y: 5 });
  });
});
