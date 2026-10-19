import { describe, it, expect, vi, afterEach } from 'vitest';
import { rollLine, rollStep, withDifficulty, type RollLineSpec } from '../noyau/rollSeam';
import { testValue, skillBaseValue, partyAssisted, soutienMod, testValueSplit } from '../engine/skills';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { clampTarget } from '../engine/tests';

/**
 * MONTEUR CANONIQUE de ligne de jet (#1153) — sondes du juge PROMUES en tests.
 *
 * Ce qui est jugé ici n'est PAS l'égalité `base + Σ mods + Difficulté === target` : elle est
 * TAUTOLOGIQUE (la base sort d'une soustraction, elle absorbe n'importe quelle erreur de poche).
 * Les deux gardes qui MORDENT ensemble :
 *   1. `base === skillBaseValue(acteur, …)` — la base est le Niveau de Compétence NU (`LDB 09 l.17`),
 *      pas une valeur reconstituée ;
 *   2. la reconstruction EXACTE : une poche mal remplie (modificateur annoncé mais jamais fondu, ou
 *      fondu ET redéclaré) est REFUSÉE au lieu de produire une ligne cohérente et fausse.
 */
const hero = (over: Partial<Combatant> = {}, adv = 10, skillId = 'ramer'): Combatant => ({
  id: 'h1', label: 'Barreur', kind: 'hero',
  characteristics: {
    'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
    agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
  },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [{ id: skillId, characteristic: 'force', advances: adv }], talents: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as unknown as Combatant);

const sum = (mods: { value: number }[]) => mods.reduce((s, m) => s + m.value, 0);

afterEach(() => { vi.restoreAllMocks(); });

describe('rollLine — base NUE et cible dérivée de la valeur FONDUE (sonde 1 du juge)', () => {
  it('A. nominal : base = Niveau de Compétence nu, aucune chip, cible = base + Difficulté', () => {
    const c = hero();
    const p = rollLine({ actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire' });
    expect(p.base).toBe(skillBaseValue(c, 'ramer'));
    expect(p.mods).toEqual([]);
    expect(p.target).toBe(testValue(c, 'ramer') + DIFFICULTY_MODIFIERS.intermediaire);
  });

  it('B. modificateur DE CIBLE (`surLaCible`) : chip nommée ET comprise dans la cible, base intacte', () => {
    const c = hero();
    const p = rollLine({ actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire', surLaCible: [{ label: 'Dérive', value: -10, famille: 'jet' }] });
    expect(p.base).toBe(skillBaseValue(c, 'ramer'));
    expect(p.mods.map((m) => m.label)).toEqual(['Dérive']);
    expect(p.target).toBe(testValue(c, 'ramer') - 10 + DIFFICULTY_MODIFIERS.intermediaire);
  });

  it('E. modificateur DÉJÀ FONDU (`dansLaValeur`) : il SORT de la base et devient chip — base nue', () => {
    const c = hero();
    const p = rollLine({
      actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire',
      valeur: testValue(c, 'ramer') - 10, dansLaValeur: [{ label: 'Charpentier', value: -10, famille: 'jet' }],
    });
    expect(p.base).toBe(skillBaseValue(c, 'ramer'));
    expect(p.mods.map((m) => m.label)).toEqual(['Charpentier']);
    expect(p.target).toBe(testValue(c, 'ramer') - 10 + DIFFICULTY_MODIFIERS.intermediaire);
  });

  it('l’État est NOMMÉ et la base ne bouge pas (aucune chip « autres »)', () => {
    const c = hero({ conditions: [{ id: 'empoisonne', value: 1 }] as never });
    expect(testValue(c, 'ramer')).toBeLessThan(skillBaseValue(c, 'ramer')); // l'État mord bien le jet
    const p = rollLine({ actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire' });
    expect(p.base).toBe(skillBaseValue(c, 'ramer'));
    expect(sum(p.mods)).toBe(testValue(c, 'ramer') - skillBaseValue(c, 'ramer'));
    expect(p.mods.every((m) => m.label.length > 0)).toBe(true);
  });

  it('ÉCRÊTAGE : la cible est bornée par la MÊME primitive que `rollTest`, et l’écart est MESURÉ', () => {
    const c = hero({}, 65); // Force 30 + 65 Augmentations = 95 : la cible franchit le plafond
    const p = rollLine({ actor: c, test: { skill: 'ramer' }, difficulty: 'accessible', surLaCible: [{ label: 'Bonus', value: 30, famille: 'circonstance' }] });
    const attendu = clampTarget(testValue(c, 'ramer') + DIFFICULTY_MODIFIERS.accessible + 30);
    expect(p.target).toBe(attendu.target);
    expect(p.clamped).toBe(attendu.clamped);
  });

  it('côté MONDE (aucun acteur) : la valeur POSÉE est la base — rien à décomposer, aucune chip inventée', () => {
    const p = rollLine({ difficulty: 'intermediaire', valeur: 55 });
    expect(p.base).toBe(55);
    expect(p.mods).toEqual([]);
    expect(p.target).toBe(55 + DIFFICULTY_MODIFIERS.intermediaire);
  });
});

describe('rollLine — GARDE D’EXACTITUDE : une poche mal remplie est REFUSÉE (sonde 1, cas C et D)', () => {
  it('C. modificateur DÉCLARÉ mais jamais fondu dans la valeur : refusé (base fausse sinon)', () => {
    const c = hero();
    expect(() => rollLine({
      actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire',
      valeur: testValue(c, 'ramer'), dansLaValeur: [{ label: 'Dérive', value: -10, famille: 'jet' }],
    })).toThrow(/ne se reconstruit pas/);
  });

  it('D. modificateur FONDU dans la valeur ET redéclaré ailleurs : refusé (double compte sinon)', () => {
    const c = hero();
    expect(() => rollLine({
      actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire',
      valeur: testValue(c, 'ramer') - 10, surLaCible: [{ label: 'Dérive', value: -10, famille: 'jet' }],
    })).toThrow(/ne se reconstruit pas/);
  });

  it('une valeur d’une AUTRE formule est ACCEPTÉE quand elle est déclarée (`valeurEtrangere`)', () => {
    const c = hero();
    const p = rollLine({ actor: c, test: { skill: 'ramer' }, difficulty: 'intermediaire', valeur: 77, valeurEtrangere: true });
    expect(p.target).toBe(77 + DIFFICULTY_MODIFIERS.intermediaire);
    expect(p.base).toBe(77); // base = la valeur assumée, PAS un Niveau de Compétence
  });

  it('Difficulté INCONNUE : refusée (sans quoi la cible serait `NaN`, en silence)', () => {
    const c = hero();
    expect(() => rollLine({ actor: c, test: { skill: 'ramer' }, difficulty: 'tres-facile' as Difficulty }))
      .toThrow(/Difficulté inconnue/);
  });

  it('`testValueSplit` DIT si la reconstruction a tenu (`exact`) — sans quoi la garde est aveugle', () => {
    const c = hero();
    expect(testValueSplit(c, testValue(c, 'ramer'), { skill: 'ramer' }).exact).toBe(true);
    expect(testValueSplit(c, testValue(c, 'ramer') + 7, { skill: 'ramer' }).exact).toBe(false);
  });
});

describe('rollLine — GRILLE D’INVARIANCE : la cible ne bouge pas d’un point (sonde 3 du juge)', () => {
  /** Ce que l'ANCIEN contrat calculait : cible = valeur FONDUE + Difficulté (+ mods de cible), écrêtée. */
  const cibleLegacy = (valeur: number, difficulty: Difficulty, surLaCible: { value: number }[] = []) =>
    clampTarget(valeur + DIFFICULTY_MODIFIERS[difficulty] + sum(surLaCible)).target;

  const solo = hero({ id: 'A', label: 'A' }, 20, 'ragot');
  const aide1 = hero({ id: 'B', label: 'B' }, 5, 'ragot');
  const aide2 = hero({ id: 'C', label: 'C' }, 5, 'ragot');
  const malade = hero({ id: 'D', label: 'D', conditions: [{ id: 'empoisonne', value: 1 }] as never }, 20, 'ragot');
  const colosse = hero({ id: 'E', label: 'E' }, 90, 'ragot');

  const cas: { nom: string; spec: RollLineSpec; valeur: number }[] = [
    { nom: 'acteur seul, Intermédiaire', spec: { actor: solo, test: { skill: 'ragot' }, difficulty: 'intermediaire' }, valeur: testValue(solo, 'ragot') },
    { nom: 'acteur seul, Difficile', spec: { actor: solo, test: { skill: 'ragot' }, difficulty: 'difficile' }, valeur: testValue(solo, 'ragot') },
    { nom: 'acteur sous État', spec: { actor: malade, test: { skill: 'ragot' }, difficulty: 'intermediaire' }, valeur: testValue(malade, 'ragot') },
    { nom: 'caractéristique pure', spec: { actor: solo, test: { char: 'sociabilite' }, difficulty: 'facile' }, valeur: testValue(solo, undefined, 'sociabilite') },
    { nom: 'côté monde (seuil)', spec: { difficulty: 'intermediaire', valeur: 55 }, valeur: 55 },
    { nom: 'malus de cible nommé', spec: { actor: solo, test: { skill: 'ragot' }, difficulty: 'intermediaire', surLaCible: [{ label: 'Hors de contrôle', value: -20, famille: 'jet' }] }, valeur: testValue(solo, 'ragot') },
  ];

  for (const c of cas) {
    it(`cible INVARIANTE — ${c.nom}`, () => {
      const p = rollLine(c.spec);
      expect(p.target).toBe(cibleLegacy(c.valeur, c.spec.difficulty, c.spec.surLaCible ?? []));
    });
  }

  it('Test de GROUPE soutenu : base nue, Soutien nommé, cible SOUTENUE inchangée', () => {
    const party = [solo, aide1, aide2];
    const picked = partyAssisted(party, 'ragot')!;
    expect(picked.support.bonus).toBeGreaterThan(0);
    const p = rollLine({ actor: picked.actor, test: { skill: 'ragot' }, valeur: picked.value, soutien: picked.support, difficulty: 'intermediaire' });
    expect(p.base).toBe(skillBaseValue(picked.actor, 'ragot'));
    expect(p.mods).toContainEqual(soutienMod(picked.support));
    expect(p.target).toBe(cibleLegacy(picked.value, 'intermediaire'));
  });

  it('base SOUTENUE qui franchit le plafond : la cible est écrêtée et l’écart est NOMMABLE', () => {
    const party = [colosse, aide1, aide2];
    const picked = partyAssisted(party, 'ragot')!;
    const p = rollLine({ actor: picked.actor, test: { skill: 'ragot' }, valeur: picked.value, soutien: picked.support, difficulty: 'tresFacile' });
    expect(p.target).toBe(99);
    expect(p.clamped).toBe(cibleLegacy(picked.value, 'tresFacile') - (picked.value + DIFFICULTY_MODIFIERS.tresFacile));
  });

  it('`rollStep` n’émet `mods`/`clamped` que s’ils existent (aucune clé vide sur l’étape)', () => {
    const nu = rollStep({ actor: solo, test: { skill: 'ragot' }, difficulty: 'intermediaire' });
    expect(Object.keys(nu).sort()).toEqual(['base', 'target']);
  });

  it('`withDifficulty` conserve la déclaration (le Soutien reste lié à sa valeur)', () => {
    const picked = partyAssisted([solo, aide1], 'ragot')!;
    const decl = { actor: picked.actor, test: { skill: 'ragot' }, valeur: picked.value, soutien: picked.support };
    const p = rollLine(withDifficulty(decl, 'complexe'));
    expect(p.target).toBe(cibleLegacy(picked.value, 'complexe'));
    expect(p.mods).toContainEqual(soutienMod(picked.support));
  });
});
