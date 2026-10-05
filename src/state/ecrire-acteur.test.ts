import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { BattleState } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { applyEffects, nePeutPasDifferer } from './combatEffects';
import { finalizeBattle } from './combatFlow';
import { ecrireActeur, inBattleId } from './combatants';
import { seedBattleRng } from './battleRng';
import { bourseOf } from './bourseFlow';
import { ACTION_CANDIDATES } from './actionRegistry';
import { resetRule, setRule } from '../engine/policy';
import type { Effect } from './scene';
import type { Combatant } from '../engine/types';

// #2312 : un effet de jeu joué en combat écrit le combattant ET le héros du groupe (`ecrireActeur`).

const SOLDAT = { speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 } as const;

function poserGroupe(): Combatant {
  const hero = createHero(SOLDAT);
  hero.talents.push({ talentId: 'magie-mineure', times: 1 });
  hero.spells = [];
  useGame.setState({ battle: null, party: [hero], pendingCascade: null, pendingRoundStart: null, journal: [] });
  useGame.getState().startScene(testScene());
  return hero;
}

function entrerEnCombat(): void {
  seedBattleRng(777);
  useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
  vi.clearAllTimers();
}

const jouer = (e: Effect) => nePeutPasDifferer(applyEffects(() => useGame.getState(), useGame.setState, [e]), 'ecrire-acteur.test');
const auGroupe = (id: string) => useGame.getState().party.find((h) => h.id === id)!;
const auCombat = (id: string) => inBattleId(useGame.getState().battle, id)!;

/** Chaque handler migré : l'effet, et ce qu'il a écrit sur une copie du héros. */
const HANDLERS: { nom: string; effet: (id: string) => Effect; ecrit: (c: Combatant) => unknown; avant?: (id: string) => void }[] = [
  { nom: 'giveTrapping', effet: (id) => ({ type: 'giveTrapping', trappingId: 'corde', heroId: id }), ecrit: (c) => (c.items ?? []).filter((i) => i.trappingId === 'corde').length },
  { nom: 'giveXp', effet: () => ({ type: 'giveXp', amount: 70 }), ecrit: (c) => c.xp },
  { nom: 'learnSpell', effet: (id) => ({ type: 'learnSpell', spell: 'sommeil', heroId: id }), ecrit: (c) => (c.spells ?? []).includes('sommeil') },
  {
    nom: 'restoreFortune',
    avant: (id) => useGame.setState((s) => ecrireActeur(s, id, (h) => ({ ...h, fortune: 0 }))),
    effet: () => ({ type: 'restoreFortune' }),
    ecrit: (c) => c.fortune,
  },
  { nom: 'mealParty', effet: () => ({ type: 'mealParty' }), ecrit: (c) => c.hunger?.coveredDay === true },
  { nom: 'inflictDisease', effet: (id) => ({ type: 'inflictDisease', disease: 'vers-de-carie', heroId: id }), ecrit: (c) => (c.diseases ?? []).some((d) => d.id === 'vers-de-carie') },
  { nom: 'inflictTrauma', effet: (id) => ({ type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: id }), ecrit: (c) => [c.criticalWounds, (c.traumas ?? []).length] },
  { nom: 'inflictNightmares', effet: (id) => ({ type: 'inflictNightmares', heroId: id }), ecrit: (c) => c.nightmares === true },
  { nom: 'giveSin', effet: (id) => ({ type: 'giveSin', amount: 2, heroId: id }), ecrit: (c) => c.sinPoints },
  { nom: 'giveMoney', effet: () => ({ type: 'giveMoney', montant: { gold: 3 } }), ecrit: (c) => bourseOf(c).gold },
];

describe('ecrireActeur — chaque handler migré écrit là où le jeu lit (#2312)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  for (const h of HANDLERS) {
    it(`${h.nom} hors combat : le héros du groupe change`, () => {
      const hero = poserGroupe();
      h.avant?.(hero.id);
      const avant = h.ecrit(auGroupe(hero.id));
      jouer(h.effet(hero.id));
      expect(h.ecrit(auGroupe(hero.id))).not.toEqual(avant);
    });

    it(`${h.nom} en combat : le combattant ET le héros du groupe changent, à l'identique`, () => {
      const hero = poserGroupe();
      entrerEnCombat();
      h.avant?.(hero.id);
      const avant = h.ecrit(auCombat(hero.id));
      jouer(h.effet(hero.id));
      expect(h.ecrit(auCombat(hero.id)), 'le combattant, que le jeu lit en combat').not.toEqual(avant);
      expect(h.ecrit(auGroupe(hero.id)), 'le héros du groupe, qui survit au combat').toEqual(h.ecrit(auCombat(hero.id)));
    });
  }

  it('ambitionLost en combat : le Trauma acquis atteint le combattant ET le groupe', () => {
    setRule('psych-acquisition-optional', true);
    try {
      const hero = poserGroupe();
      entrerEnCombat();
      // Le Test de Calme se tire au dé de bataille : on rejoue jusqu'au premier échec.
      for (let graine = 1; graine < 200 && !(auCombat(hero.id).psychTraits ?? []).length; graine++) {
        seedBattleRng(graine);
        jouer({ type: 'ambitionLost', heroId: hero.id });
      }
      expect(auCombat(hero.id).psychTraits?.length).toBeGreaterThan(0);
      expect(auGroupe(hero.id).psychTraits).toEqual(auCombat(hero.id).psychTraits);
    } finally {
      resetRule('psych-acquisition-optional');
    }
  });

  it('un objet donné en combat est sur le combattant, puis sur le héros après finalizeBattle', () => {
    const hero = poserGroupe();
    entrerEnCombat();
    const avant = (auGroupe(hero.id).items ?? []).length;
    jouer({ type: 'giveTrapping', trappingId: 'corde', heroId: hero.id });
    expect((auCombat(hero.id).items ?? []).length).toBe(avant + 1);
    finalizeBattle(() => useGame.getState(), useGame.setState);
    expect((auGroupe(hero.id).items ?? []).length).toBe(avant + 1);
  });

  it('un sort appris en combat est lançable dans ce combat, et gardé après lui', () => {
    const hero = poserGroupe();
    entrerEnCombat();
    jouer({ type: 'learnSpell', spell: 'sommeil', heroId: hero.id });
    const battle = useGame.getState().battle as BattleState;
    const sorts = ACTION_CANDIDATES['sorts-du-heros']({ active: auCombat(hero.id), battle, state: useGame.getState() } as never);
    expect(sorts).toContain('sommeil');
    finalizeBattle(() => useGame.getState(), useGame.setState);
    expect(auGroupe(hero.id).spells).toContain('sommeil');
  });

  it('setShipRole en combat : le combattant ET le groupe portent le rôle', () => {
    const hero = poserGroupe();
    entrerEnCombat();
    useGame.getState().setShipRole(hero.id, 'vigie');
    expect(auCombat(hero.id).shipRole).toBe('vigie');
    expect(auGroupe(hero.id).shipRole).toBe('vigie');
  });
});
