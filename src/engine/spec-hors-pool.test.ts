import { describe, it, expect } from 'vitest';
import { byId, specPoolOf, specCatalogOf, specResolves, specLabel } from '../data';
import { wildcardSpecs } from './careerSlots';
import { createHero, adresseDeCreation } from './character';
import { testValue } from './skills';
import { makeRNG } from './dice';
import type { Combatant, SkillInstance } from './types';

/**
 * #1342 L3 — VALIDITÉ ⊇ POOL sur les `specs[]` inline. Une entrée `pool: false` est VALIDE partout
 * (résolution d'un id, `testValue` par spec, round-trip libellé→id, écran de référence) et n'est PAS
 * proposée d'office par le créateur/l'avancement (`LDB 09 l.40`).
 *
 * Étalon nominatif : `savoir/local` — `MCLB 02 l.1322`, employée par 94 statblocs de `creatures.json`,
 * par aucune ligne de carrière/espèce (mesure du 2026-08-23, cf. la migration du même jour).
 */
const HORS_POOL = { skillId: 'savoir', specId: 'local', label: 'Local' };

const hero = (skills: { id: string; advances: number; spec?: string }[]): Combatant =>
  ({
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'intelligence' }) as SkillInstance),
  }) as unknown as Combatant;

describe('#1342 L3 — spécialisation hors pool : valide partout, jamais proposée', () => {
  const savoir = byId('skill', HORS_POOL.skillId)!;

  it('la donnée porte le marqueur et sa source', () => {
    const entry = savoir.specs!.find((e) => e.id === HORS_POOL.specId)!;
    expect(entry.pool).toBe(false);
    expect(entry.source?.book).toBeTruthy();
    expect(specLabel('skills', savoir.id, HORS_POOL.specId)).toBe(HORS_POOL.label);
  });

  it('VALIDITÉ : l\'id résout, et le catalogue de référence (Codex/éditeur) l\'imprime', () => {
    expect(specResolves(savoir, HORS_POOL.specId)).toBe(true);
    expect(specCatalogOf(savoir)).toContain(HORS_POOL.specId);
  });

  it('POOL : ni `specPoolOf`, ni le joker « (Au choix) » du créateur/avancement ne la proposent', () => {
    expect(specPoolOf(savoir)).not.toContain(HORS_POOL.specId);
    expect(wildcardSpecs({ optionId: savoir.id }, 'skill')).not.toContain(HORS_POOL.specId);
    expect(wildcardSpecs({ optionId: savoir.id }, 'skill').length).toBeGreaterThan(0); // le pool existe, il est juste amputé de l'entrée
  });

  it('`testValue` calcule la spécialisation hors pool comme n\'importe quelle autre', () => {
    const c = hero([{ id: HORS_POOL.skillId, spec: HORS_POOL.specId, advances: 12 }]);
    expect(testValue(c, HORS_POOL.skillId, undefined, HORS_POOL.specId)).toBe(52);
  });

  it('un héros créé sur « Savoir (Local) » stocke l\'id de la spécialisation', () => {
    const h = createHero({
      speciesId: 'humains-reiklander', careerId: 'erudit', label: 'É', rng: makeRNG(7),
      specChoices: { [adresseDeCreation.carriereCompetence(7)]: HORS_POOL.specId }, // erudit : « Savoir (Au choix) »
    });
    const inst = h.skills.filter((s) => s.id === HORS_POOL.skillId);
    expect(inst.map((s) => s.spec)).toContain(HORS_POOL.specId);
    expect(inst.map((s) => s.spec)).not.toContain(HORS_POOL.label);
  });
});
