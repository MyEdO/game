import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { emptyScene } from './scene';
import { applyEffects } from './combatFlow';
import { carryOverState } from '../engine/persistence';

/**
 * Acquisition de Traits psychologiques — ADE II Annexe I « Troubles psychologiques » (règle facultative
 * `psych-acquisition-optional`). Vérifie le CÂBLAGE d'état (le noyau pur `animositeOrHaine`/`gainPhobieIfThreshold`
 * est testé dans engine/psychology.test) : dépense de Destin → Animosité/Haine ; persistance des Traits acquis.
 * Graines d100 (cf. bleed-death.test) : seedBattleRng(1) → 1ᵉʳ jet > 30 (Calme FM 30 ÉCHOUE → acquisition) ;
 * seedBattleRng(7) → 1ᵉʳ jet ≤ 10 (Calme RÉUSSIT → aucun Trait).
 */

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h1', name: 'Hardi', kind: 'hero', characteristics: CHARS,
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 2,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[], fateSave: BattleState extends never ? never : { heroId: string; source: 'hit' | 'slow'; foeCible?: string }): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: fateSave as never });
}

describe('#62 — Animosité & Haine sur dépense de Destin (fateSurvive / fateNegate)', () => {
  beforeEach(() => { setRule('psych-acquisition-optional', true); });
  afterEach(() => resetRule('psych-acquisition-optional'));

  it('règle ON + Calme ÉCHOUE → Animosité envers la Cible ; un 2ᵉ échec même Cible → Haine (remplace)', () => {
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'hit', foeCible: 'skavens' });
    seedBattleRng(1); // Calme (FM 30) échoue
    useGame.getState().fateSurvive();
    let got = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits).toEqual([{ type: 'animosite', cible: 'skavens' }]);

    // Deuxième frôlement de la mort face aux mêmes Skavens → l'Animosité devient une Haine.
    setBattle([got], { heroId: 'h1', source: 'hit', foeCible: 'skavens' });
    seedBattleRng(1);
    useGame.getState().fateSurvive();
    got = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits).toEqual([{ type: 'haine', cible: 'skavens' }]); // Animosité remplacée, pas doublée
  });

  it('règle ON + Calme RÉUSSIT → aucun Trait acquis', () => {
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'hit', foeCible: 'skavens' });
    seedBattleRng(7); // Calme (FM 30) réussit
    useGame.getState().fateSurvive();
    const got = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });

  it('règle OFF → aucune acquisition même sur échec de Calme', () => {
    resetRule('psych-acquisition-optional'); // défaut = OFF
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'hit', foeCible: 'skavens' });
    seedBattleRng(1);
    useGame.getState().fateSurvive();
    const got = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });

  it('mort lente (source slow, sans Cible identifiée) → pas d’Animosité (perte de sang, aucun individu)', () => {
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'slow' }); // pas de foeCible
    seedBattleRng(1);
    useGame.getState().fateSurvive();
    const got = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });
});

describe('#62 — Trauma sur Ambition anéantie (Effet d’auteur `ambitionLost`)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });
  afterEach(() => resetRule('psych-acquisition-optional'));

  it('règle ON + Calme Accessible (+20) ÉCHOUE → Trauma posé sur le héros visé', () => {
    setRule('psych-acquisition-optional', true);
    const h = hero({ id: 'h1', characteristics: { ...CHARS, FM: 10 } as never }); // Calme +20 → cible 30
    useGame.setState({ party: [h] });
    seedBattleRng(1); // 1ᵉʳ jet > 30 → Calme échoue
    applyEffects(useGame.getState, useGame.setState, [{ type: 'ambitionLost', heroId: 'h1' }]);
    expect(useGame.getState().party[0].psychTraits).toEqual([{ type: 'trauma' }]);
  });

  it('règle OFF → effet inerte (aucun Trauma)', () => {
    const h = hero({ id: 'h1' });
    useGame.setState({ party: [h] });
    seedBattleRng(1);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'ambitionLost', heroId: 'h1' }]);
    expect(useGame.getState().party[0].psychTraits ?? []).toEqual([]);
  });
});

describe('#62 — persistance des Traits psy acquis + compteur de Phobie (writeback de combat)', () => {
  it('carryOverState reporte psychTraits acquis SANS mutation + le compteur briseFromTerreur', () => {
    const h = hero({ psychTraits: [{ type: 'phobie', cible: 'Morts-vivants', indice: 1 }], briseFromTerreur: 2 });
    const co = carryOverState(h);
    expect(co.psychTraits).toEqual([{ type: 'phobie', cible: 'Morts-vivants', indice: 1 }]);
    expect(co.briseFromTerreur).toBe(2);
  });

  it('carryOverState : le combattant EST le héros — un compteur absent revient absent (#2312)', () => {
    expect(carryOverState(hero({})).briseFromTerreur).toBeUndefined();
    expect(carryOverState(hero({ psychTraits: [] })).psychTraits).toEqual([]);
  });
});
