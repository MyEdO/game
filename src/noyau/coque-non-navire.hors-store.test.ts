/**
 * Une coque routière n'est pas un navire (EDOC 07 l.334, MDG 13 l.656).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Combatant } from '../engine/types';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { spawnEnemy } from './monde/spawn';
import { applyCriticalToTarget, runEnemyAI } from './combatFlow';
import { emptyScene } from './monde/scene';
import { t } from '../i18n';
import { nomDe } from '../engine/nom';

/** Une coque qui n'est PAS un navire (`profilNavalDe` : pas de facette `ship`) — EDOC 07 l.334, MDG 13 l.656. */
const diligence = (id = 'dil', pos = { x: 7, y: 5 }): Combatant => spawnEnemy({ vehicule: 'diligence' }, id, pos);
const cogue = (id = 'nav', pos = { x: 5, y: 5 }): Combatant => spawnEnemy({ vehicule: 'cogue' }, id, pos);

let banc: Banc;

const poser = (combatants: Combatant[], over: Record<string, unknown> = {}): void => {
  banc.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: [], scene: emptyScene('scene-test', 20, 20), travelPlan: null, facing: {}, vessel: null, journal: [], ...over,
  } as never);
};

describe('coque routière (EDOC 07 l.334) : ni Critique, ni collision, ni IA de navire', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc();
    banc.getState().ensemencerLeTirage(7);
  });

  it('un Critique sur une diligence ne lève pas, ne compte aucune Blessure Critique, ne pose aucun État et journalise le refus', () => {
    const dil = diligence();
    poser([dil]);
    const avant = { conditions: [...dil.conditions], criticalWounds: dil.criticalWounds };
    const log: string[] = [];
    const mort = applyCriticalToTarget(dil, 'corps', 0, log, banc.setState, { get: banc.getState });
    expect(mort).toBe(false);
    expect(dil.criticalWounds).toBe(avant.criticalWounds);
    expect(dil.conditions).toEqual(avant.conditions);
    expect(log).toEqual([t('cf.coqueSansCritique', { name: nomDe(dil) })]);
  });

  it("un navire qui avance sur une diligence ne résout aucune collision : aucune des deux coques n'encaisse", () => {
    const nav = cogue();
    const dil = diligence();
    poser([nav, dil], { facing: { nav: 'E' } });
    const avant = { nav: nav.wounds.current, dil: dil.wounds.current };
    banc.getState().avancerLeNavire('nav', 3);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'dil')!.wounds.current).toBe(avant.dil);
    expect(b.combatants.find((c) => c.id === 'nav')!.wounds.current).toBe(avant.nav);
  });

  it("une diligence ENNEMIE à son tour face à un navire de héros ne joue pas l'IA de navire et ne lève pas", () => {
    const nav = cogue('nav', { x: 3, y: 5 });
    nav.kind = 'heros';
    const dil = diligence('dil', { x: 10, y: 5 });
    poser([nav, dil], { facing: { nav: 'E', dil: 'W' } });
    banc.setState({ battle: { ...banc.getState().battle!, turn: 1 } });
    expect(() => runEnemyAI(banc.getState, banc.setState, 'dil')).not.toThrow();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'dil')!.pos).toEqual({ x: 10, y: 5 });
  });
});
