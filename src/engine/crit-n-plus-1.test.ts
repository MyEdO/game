import { describe, it, expect, afterEach } from 'vitest';
import { resolveCritique, findCritEntrySuffered, critEntryCodexCategory, REGIMES_DE_CRITIQUE } from './critical';
import { CRITIQUE_DOCS, critiqueDoc, critiqueTable, critiqueEntries, type CritDoc, type JeuDeCritique } from '../data/criticals';
import { bumperDataset } from '../data/versionDataset';
import type { Combatant } from './types';
import type { RNG } from './dice';
import { desEnSuite } from './dice.testkit';

/**
 * MORSURE « N+1 » (#1657 B2a) — un 9ᵉ document-table se lit SANS une ligne de moteur.
 *
 * L'invariant du socle : la séquence de résolution, le lookup d100, la lecture d'un id subi et la
 * projection Codex sont pilotés par la DONNÉE (les documents-tables de `criticals.json`). Ce que
 * coûte un tableau de plus se mesure ici, et nulle part ailleurs : sa DÉCLARATION de régime (sa
 * sévérité, son libellé de journal) quand il inaugure un JEU. Un tableau d'un jeu déjà déclaré ne
 * coûte rien du tout.
 *
 * Le test POSE un 9ᵉ document en mémoire, le joue, puis le retire — l'arbre de donnée n'est pas touché.
 * Pose et retrait versionnent `criticalsTete` (`src/data/versionDataset.ts`).
 */

const seq = (...values: number[]): RNG => desEnSuite(values, { borne: true });

const cible = (): Combatant =>
  ({
    id: 't', name: 'Cible', label: 'Cible', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, conditions: [], skills: [], traumas: [], critEntriesSuffered: [], bodyShape: 'humanoide',
  }) as unknown as Combatant;

const JEU_NEUF = 'jeu-de-morsure' as JeuDeCritique;

/** Le 9ᵉ document — même forme que les 8 authorés, aucune clé de plus. */
const NEUVIEME: CritDoc = {
  id: 'criticals-morsure-tete',
  type: 'criticals',
  label: 'Critiques — Tête (tableau de morsure)',
  jeu: JEU_NEUF,
  localisation: 'tete',
  entries: [
    {
      id: 'morsure-tete-01', min: 1, max: 100, label: 'Entaille de morsure',
      ops: [{ op: 'wounds', amount: 4, ignoreTB: true, ignoreAP: true }],
      test: {
        kind: 'test',
        test: { difficulty: 'accessible' },
        success: { kind: 'seq', steps: [] },
        fail: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'condition', id: 'sonne', value: 1 }], on: 'target' } },
      },
      desc: 'Rangée de morsure — jamais authorée, posée en mémoire par ce test.',
      source: { book: 'livre-de-base', page: 174 },
    },
  ],
};

const poser = () => {
  CRITIQUE_DOCS.push(NEUVIEME);
  bumperDataset('criticalsTete');
};
const retirer = () => {
  const i = CRITIQUE_DOCS.indexOf(NEUVIEME);
  if (i >= 0) {
    CRITIQUE_DOCS.splice(i, 1);
    bumperDataset('criticalsTete');
  }
  delete REGIMES_DE_CRITIQUE[JEU_NEUF];
};

const instantane = () => ({
  documents: CRITIQUE_DOCS.length,
  rangees: CRITIQUE_DOCS.reduce((n, d) => n + d.entries.length, 0),
  regimes: Object.keys(REGIMES_DE_CRITIQUE).sort(),
});
const AU_CHARGEMENT = instantane();

describe('N+1 — un 9ᵉ document-table lu sans une ligne de moteur', () => {
  afterEach(retirer);

  it('les LECTURES le servent immédiatement : document, table, rangées, id subi, catégorie Codex', () => {
    poser();
    expect(critiqueDoc(JEU_NEUF, 'tete')).toBe(NEUVIEME);
    expect(critiqueTable(JEU_NEUF, 'tete')).toBe(NEUVIEME.entries);
    expect(critiqueEntries('criticals-morsure-tete')).toBe(NEUVIEME.entries);
    const trouve = findCritEntrySuffered('morsure-tete-01')!;
    expect(trouve.entry.label).toBe('Entaille de morsure');
    expect(trouve.table).toBe('tete');
    expect(trouve.jeu).toBe(JEU_NEUF);
    expect(critEntryCodexCategory(trouve.table, trouve.jeu)).toBe('criticalsTete');
  });

  it('la RÉSOLUTION le joue dès que son régime est déclaré — UNE déclaration, aucune branche', () => {
    poser();
    REGIMES_DE_CRITIQUE[JEU_NEUF] = { severite: () => 0, journal: 'Blessure de morsure' };
    const r = resolveCritique(JEU_NEUF, cible(), 'tete', seq(50));
    expect(r.entryId).toBe('morsure-tete-01');
    expect(r.roll).toBe(50);
    expect(r.ops).toEqual([{ op: 'wounds', amount: 4, ignoreTB: true, ignoreAP: true }]); // effet IMMÉDIAT seul
    // Le nœud de la rangée sort par `testFlow` (la porte le joue) — le 9ᵉ tableau n'a rien de spécial à déclarer.
    expect(r.testFlow?.kind).toBe('test');
    expect(r.log.startsWith('Blessure de morsure (')).toBe(true);
  });

  it('MORSURE : sans sa déclaration de régime, la résolution REFUSE en nommant le jeu', () => {
    poser();
    expect(() => resolveCritique(JEU_NEUF, cible(), 'tete', seq(50))).toThrow(/jeu-de-morsure/);
  });

  it('l’arbre de donnée est intact après la morsure : documents, rangées et régimes du chargement', () => {
    expect(instantane()).toEqual(AU_CHARGEMENT);
  });
});
