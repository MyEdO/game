import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { emptyScene } from './monde/scene';
import { applyEffects } from './combatEffects';
import { carryOverState } from '../engine/persistence';
import { finalizeHeroDeath } from './combatFlow';
import { applierDe } from './cascade';
import { bandStep } from './rollSeam';
import { groupLabel } from '../data';
import { t } from '../i18n';
import { ciblePsy } from '../engine/psych/ciblage';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Acquisition de Traits psychologiques — ADE II Annexe I « Troubles psychologiques » (règle facultative
 * `psych-acquisition-optional`). Vérifie le CÂBLAGE d'état (le noyau pur `animositeOrHaine`/`gainPhobieIfThreshold`
 * est testé dans engine/psychology.test) : dépense de Destin → Animosité/Haine ; persistance des Traits acquis.
 * Graines d100 (cf. combat/bleed-death.hors-store.test) : seedBattleRng(1) → 1ᵉʳ jet > 30 (Calme FM 30 ÉCHOUE → acquisition) ;
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

function setBattle(combatants: Combatant[], fateSave: ReturnType<typeof banc.getState>['pendingFateSave']): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: fateSave });
}

describe('#62 — Animosité & Haine sur dépense de Destin (fateSurvive / fateNegate)', () => {
  beforeEach(() => { setRule('psych-acquisition-optional', true); });
  afterEach(() => resetRule('psych-acquisition-optional'));

  it('règle ON + Calme ÉCHOUE → Animosité envers la Cible ; un 2ᵉ échec même Cible → Haine (remplace)', () => {
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'hit', foeCible: ciblePsy.groupe('skaven') });
    seedBattleRng(1); // Calme (FM 30) échoue
    banc.getState().fateSurvive();
    let got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('skaven') }]);

    // Deuxième frôlement de la mort face aux mêmes Skavens → l'Animosité devient une Haine.
    setBattle([got], { heroId: 'h1', source: 'hit', foeCible: ciblePsy.groupe('skaven') });
    seedBattleRng(1);
    banc.getState().fateSurvive();
    got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits).toEqual([{ type: 'haine', cible: ciblePsy.groupe('skaven') }]); // Animosité remplacée, pas doublée
  });

  it('règle ON + Calme RÉUSSIT → aucun Trait acquis', () => {
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'hit', foeCible: ciblePsy.groupe('skaven') });
    seedBattleRng(7); // Calme (FM 30) réussit
    banc.getState().fateSurvive();
    const got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });

  it('règle OFF → aucune acquisition même sur échec de Calme', () => {
    resetRule('psych-acquisition-optional'); // défaut = OFF
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'hit', foeCible: ciblePsy.groupe('skaven') });
    seedBattleRng(1);
    banc.getState().fateSurvive();
    const got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });

  it('mort lente (source slow, sans Cible identifiée) → pas d’Animosité (perte de sang, aucun individu)', () => {
    const h = hero();
    setBattle([h], { heroId: 'h1', source: 'slow' }); // pas de foeCible
    seedBattleRng(1);
    banc.getState().fateSurvive();
    const got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });
});

describe('ADE II (VO) 09 l.14 — la Cible est le Groupe de l’adversaire (finalizeHeroDeath → fateSurvive)', () => {
  beforeEach(() => { setRule('psych-acquisition-optional', true); });
  afterEach(() => resetRule('psych-acquisition-optional'));

  /** Un héros frôle la mort sous les coups de `foe`, dépense son Destin et rate son Calme. */
  const traitsApres = (foe: Combatant) => {
    const h = hero({ groups: ['humain'] });
    setBattle([h, foe], null);
    finalizeHeroDeath(banc.getState, banc.setState, h, 'hit', 10, foe);
    seedBattleRng(1); // Calme (FM 30) échoue
    banc.getState().fateSurvive();
    return banc.getState().battle!.combatants.find((c) => c.id === 'h1')!.psychTraits ?? [];
  };
  const adversaire = (groups: string[]) => hero({ id: 'e1', label: 'Brigand de Reikland', kind: 'enemy', fate: 0, groups } as Partial<Combatant>);

  it('adversaire porteur d’un Groupe → Animosité envers ce Groupe', () => {
    expect(traitsApres(adversaire(['skaven']))).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('skaven') }]);
  });

  it('adversaire sans Groupe → aucun Trait, jamais son libellé', () => {
    expect(traitsApres(adversaire([]))).toEqual([]);
  });
});

describe('ADE II 09 l.9-11 — Phobie du noir en combat (bande `combatPsych`, Terreur ratée)', () => {
  beforeEach(() => { setRule('psych-acquisition-optional', true); });
  afterEach(() => resetRule('psych-acquisition-optional'));

  /** Le héros (FM 30 → BFM 3, déjà 2 Brisé de Terreur) rate son Calme de 1 DR face à `foe` (Terreur 1 → 2 Brisé). */
  const terreurRatee = (foe: Combatant) => {
    setBattle([hero({ label: 'Hardi', briseFromTerreur: 2 }), foe], null);
    const decl = { kind: 'terreur' as const, sourceId: foe.id, sourceName: foe.label, indice: 1 };
    const step = bandStep({ id: 'combatPsych', kind: 'combatPsych', combatPsych: decl }, [{ id: 'h1', interactive: true, result: { success: false, sl: -1 } } as never])!;
    applierDe(step.kind)!(banc.getState, banc.setState, step, undefined, { steps: [step], index: 0 });
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    return { h, lignes: step.participants![0].outcome?.map((l) => l.text) ?? [] };
  };
  const source = (groups: string[]) => hero({ id: 'e1', label: 'Spectre', kind: 'enemy', fate: 0, groups } as Partial<Combatant>);

  it('source à Groupe → Phobie sur l’id de Groupe, journal au libellé, compteur remis à zéro', () => {
    const { h, lignes } = terreurRatee(source(['mort-vivant']));
    expect(h.psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant'), indice: 1 }]);
    expect(h.briseFromTerreur).toBe(0);
    expect(lignes).toContain(t('cf.phobieGain', { name: 'Hardi', groupe: groupLabel('mort-vivant') }));
    expect(groupLabel('mort-vivant')).not.toBe('mort-vivant');
  });

  it('source sans Groupe → aucune Phobie, compteur conservé', () => {
    const { h } = terreurRatee(source([]));
    expect(h.psychTraits ?? []).toEqual([]);
    expect(h.briseFromTerreur).toBe(4);
  });
});

describe('#62 — Trauma sur Ambition anéantie (Effet d’auteur `ambitionLost`)', () => {
  beforeEach(() => { banc.setState({ battle: null, mode: 'exploration', journal: [] }); });
  afterEach(() => resetRule('psych-acquisition-optional'));

  it('règle ON + Calme Accessible (+20) ÉCHOUE → Trauma posé sur le héros visé', () => {
    setRule('psych-acquisition-optional', true);
    const h = hero({ id: 'h1', characteristics: { ...CHARS, 'force-mentale': 10 } }); // Calme +20 → cible 30
    banc.setState({ party: [h] });
    seedBattleRng(1); // 1ᵉʳ jet > 30 → Calme échoue
    applyEffects(banc.getState, banc.setState, [{ type: 'ambitionLost', heroId: 'h1' }]);
    expect(banc.getState().party[0].psychTraits).toEqual([{ type: 'trauma' }]);
  });

  it('règle OFF → effet inerte (aucun Trauma)', () => {
    const h = hero({ id: 'h1' });
    banc.setState({ party: [h] });
    seedBattleRng(1);
    applyEffects(banc.getState, banc.setState, [{ type: 'ambitionLost', heroId: 'h1' }]);
    expect(banc.getState().party[0].psychTraits ?? []).toEqual([]);
  });
});

describe('#62 — persistance des Traits psy acquis + compteur de Phobie (writeback de combat)', () => {
  it('carryOverState reporte psychTraits acquis SANS mutation + le compteur briseFromTerreur', () => {
    const h = hero({ psychTraits: [{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant'), indice: 1 }], briseFromTerreur: 2 });
    const co = carryOverState(h);
    expect(co.psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant'), indice: 1 }]);
    expect(co.briseFromTerreur).toBe(2);
  });

  it('carryOverState : le combattant EST le héros — un compteur absent revient absent (#2312)', () => {
    expect(carryOverState(hero({})).briseFromTerreur).toBeUndefined();
    expect(carryOverState(hero({ psychTraits: [] })).psychTraits).toEqual([]);
  });
});
