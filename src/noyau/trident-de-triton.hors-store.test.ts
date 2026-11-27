import { describe, it, expect, beforeEach } from 'vitest';
import type { Combatant, Weapon } from '../engine/types';
import { toucheAuJetPose } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { buildActorView } from '../engine/actorView';
import { evalCondition } from '../engine/flowCore';
import { stacks } from '../engine/conditions';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { spawnEnemy } from './monde/spawn';
import { seedBattleRng } from './battleRng';
import { applyAttackResult } from './combatFlow';
import { emptyScene } from './monde/scene';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Naufrageuse du Trident de Triton par la chaîne d'attaque réelle (`applyAttackResult`) : MDG 16 l.327 ;
 * arbitrage du 2026-11-15, #4202 ; MDG 13 l.584.
 */
const triton = (): Combatant => {
  const t = spawnEnemy({ ref: 'triton' }, 'tri', { x: 5, y: 5 });
  t.label = 'Triton';
  return t;
};
const trident = (t: Combatant): Weapon => t.weapons!.find((w) => w.trappingId === 'trident-de-triton')!;
/** Une cogue à Endurance 1 : ses Tests d'Endurance échouent hors réussite automatique. */
const cogue = (): Combatant => {
  const c = spawnEnemy({ vehicule: 'cogue' }, 'nav', { x: 6, y: 5 });
  c.characteristics.endurance = 1;
  return c;
};
const humain = (id: string, label: string): Combatant => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 2 });
  h.id = id; h.kind = 'ennemi'; h.pos = { x: 6, y: 6 };
  return h;
};
const poser = (combatants: Combatant[]): void => {
  banc.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: combatants.filter((c) => c.kind === 'heros'), scene: emptyScene('scene-test', 20, 20), travelPlan: null, facing: {}, vessel: null,
    journal: [], pendingCascade: null, suspendedCascades: [], pendingFateSave: null,
  } as never);
};
/** CC réussi, DR 2 : 43 sans double, 44 en double (Coup Critique, LDB 13). */
const jet = (roll: number) => ({ label: 'CC', base: 60, modifier: 0, target: 60, roll, success: true, sl: 2 });
/** Graines du dé de Localisation du Critique de navire : 3 → Équipements ; 7 → Équipage. */
const SEED_COQUE = 3;
const SEED_EQUIPAGE = 7;

/** Un héros du groupe au contact de la coque : le journal nomme ce que le groupe voit (#4017). */
const temoin = (): Combatant => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Témoin', seed: 3 });
  h.id = 'temoin'; h.pos = { x: 7, y: 5 };
  return h;
};
const frapper = (cible: Combatant, roll: number, seed: number, autres: Combatant[] = []): Combatant => {
  const t = triton();
  poser([t, cible, temoin(), ...autres]);
  seedBattleRng(seed);
  const w = trident(t);
  applyAttackResult(banc.getState, banc.setState, t, cible, w, toucheAuJetPose(t, cible, w, jet(roll), 2, { rng: makeRNG(1) }));
  return banc.getState().battle!.combatants.find((c) => c.id === cible.id)!;
};
const journal = (): string[] => banc.getState().battle!.log.map((e) => e.entree.texte);
const testsDEndurance = (): string[] => journal().filter((l) => /Test d’Endurance/.test(l)).map((l) => (/Difficile/.test(l) ? 'difficile' : /Complexe/.test(l) ? 'complexe' : l));

describe('Naufrageuse (MDG 16 l.327) — coque ennemie, jets résolus', () => {
  it('touche avec Dégâts : un Test Complexe, échec → Voie d’eau 1', () => {
    const nav = frapper(cogue(), 43, SEED_COQUE);
    expect(testsDEndurance()).toEqual(['complexe']);
    expect(journal().find((l) => /Test d’Endurance/.test(l)), 'le testeur est nommé par son label').toMatch(/^Cogue — Test d’Endurance Complexe/);
    expect(stacks(nav, 'voie-d-eau')).toBe(1);
  });

  it('touche critique de coque : les deux Tests, échecs → Voie d’eau 3 puis 1', () => {
    const nav = frapper(cogue(), 44, SEED_COQUE);
    expect(journal().some((l) => /^Critique navire/.test(l)), 'le Critique est pris par la coque').toBe(true);
    expect(testsDEndurance()).toEqual(['difficile', 'complexe']);
    expect(stacks(nav, 'voie-d-eau')).toBe(4);
  });

  it('Critique encaissé par un marin (MDG 13 l.584) : le seul Test Complexe', () => {
    const marin = humain('mar', 'Marin');
    const coque = cogue();
    coque.crewIds = [marin.id];
    const nav = frapper(coque, 44, SEED_EQUIPAGE, [marin]);
    expect(journal().some((l) => /Marin encaisse le coup/.test(l)), 'le marin encaisse').toBe(true);
    expect(testsDEndurance()).toEqual(['complexe']);
    expect(stacks(nav, 'voie-d-eau')).toBe(1);
  });

  it('touche critique sur une créature non navire : aucun Test', () => {
    const cible = humain('cible', 'Cible');
    cible.characteristics.endurance = 1;
    cible.wounds = blessuresDeBase(200, 200, cible);
    const apres = frapper(cible, 44, SEED_COQUE);
    expect(apres.dead || apres.wounds.current <= 0, 'la cible survit au coup').toBe(false);
    expect(testsDEndurance()).toEqual([]);
    expect(stacks(apres, 'voie-d-eau')).toBe(0);
  });
});

describe('Naufrageuse — coque du groupe, cadence manuelle', () => {
  it('chaque Test est une étape `testDeclenche` de la coque, à sa difficulté', () => {
    const coque = cogue();
    coque.kind = 'heros';
    frapper(coque, 44, SEED_COQUE);
    const etapes = banc.getState().pendingCascade!.participants.filter((p) => p.kind === 'testDeclenche');
    expect(etapes.map((p) => [p.actorId, p.difficulty])).toEqual([['nav', 'difficile'], ['nav', 'complexe']]);
  });
});

describe('Condition `navire` (#4202)', () => {
  const navire = (c: Combatant): boolean => evalCondition({ kind: 'navire', who: 'target' }, { flags: {}, gameTime: 0, target: buildActorView(c) });
  it('vraie pour une coque de navire, fausse pour un personnage et pour une armée', () => {
    expect(navire(cogue())).toBe(true);
    expect(navire(humain('h', 'H'))).toBe(false);
    const armee = humain('a', 'Armée');
    armee.bodyShape = 'army';
    expect(navire(armee)).toBe(false);
  });
});
