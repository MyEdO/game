/**
 * GARDE — `PROJECT_MIGRATIONS[14]` : un projet AUTHORÉ AVANT #1897 se charge encore.
 *
 * QUESTION : `narratif.presetsPnj[].profil` reprend le def créature, dont `spells` adopte
 * `refs('spell')` — la référence de sort passe de `{ id }` à l'id NU. Un `.json` exporté avant ce lot,
 * resté dans une bibliothèque utilisateur, ressort-il avec les sorts de ses PNJ ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 14` — un preset dont le profil liste
 * ses sorts en `{ id }`, un autre qui les liste déjà nus. Il est FIGÉ ; le « moderniser » détruirait ce
 * que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { depot, efface, joue, lireDans, rienTouche } from '../../scripts/migrations/lib/joue.mjs';

/** Document schema 14 — FIGÉ. Ne pas dénuder `sorcier` : c'est le sujet de la mesure. */
const PROJET_FORMAT_14 = {
  type: 'projet',
  schema: 14,
  id: 'campagne-gelee-14',
  label: 'Campagne gelée (format 14)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: {
    affaires: [],
    indices: [],
    presetsPnj: [
      { id: 'sorcier', base: 'squelette', profil: { spells: [{ id: 'flechette' }, { id: 'alerte' }] } },
      { id: 'deja-nu', base: 'squelette', profil: { spells: ['flechette'] } },
    ],
    objets: [],
  },
  scenes: [
    {
      type: 'scene',
      id: 'quai',
      label: 'Le quai',
      dimensions: { w: 1, h: 1 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe'] }],
      entities: [],
    },
  ],
};

const presetsMigrés = () => parseProject(structuredClone(PROJET_FORMAT_14)).narratif.presetsPnj;

describe('PROJECT_MIGRATIONS[14] — un projet format 14 se charge à travers la migration (#1897)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_14.schema).toBe(14);
    expect(PROJET_FORMAT_14.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_14.narratif.presetsPnj[0].profil.spells[0]).toEqual({ id: 'flechette' });
  });

  it('les sorts `{ id }` d’un preset ressortent en ids NUS, dans leur ORDRE', () => {
    expect(presetsMigrés()[0].profil?.spells).toEqual(['flechette', 'alerte']);
  });

  it('un preset dont les sorts sont DÉJÀ nus traverse INTACT', () => {
    expect(presetsMigrés()[1].profil?.spells).toEqual(['flechette']);
  });

  it('IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne change plus rien', () => {
    const une = PROJECT_MIGRATIONS[14]!({ ...structuredClone(PROJET_FORMAT_14), version: 14 } as never);
    const deux = PROJECT_MIGRATIONS[14]!({ ...structuredClone(une), version: 14 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, le sort `{ id }` serait REFUSÉ au parse', () => {
    const bricole = { ...structuredClone(PROJET_FORMAT_14), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/spells/);
  });

  it('un id de sort MORT n’est pas du ressort de la migration : le schéma le NOMME', () => {
    const mort = structuredClone(PROJET_FORMAT_14);
    mort.narratif.presetsPnj[0].profil.spells = [{ id: 'zzz-disparu' }];
    expect(() => parseProject(mort)).toThrow(/« zzz-disparu » est absent du catalogue des sorts \(spells\.json\)/);
  });
});

/**
 * PARITÉ des DEUX pendants du même bump : la MÊME fixture est jouée par le script de DÉPÔT
 * (`scripts/migrations/2026-09-24-1897-projet-sorts-de-preset-ids-nus.mjs`, dans un dépôt jetable) et
 * par le CHARGEMENT (`parseProject`, donc `PROJECT_MIGRATIONS[14]`). Une forme que le chargement
 * dénude, le script la dénude À L'IDENTIQUE ; une forme que le chargement laisse à `parseProject`
 * pour qu'il la refuse, le script la refuse (sortie 1) — jamais l'un qui avale ce que l'autre refuse.
 */
const SCRIPT_DEPOT = '2026-09-24-1897-projet-sorts-de-preset-ids-nus.mjs';
const REL = `src/scenes/${PROJET_FORMAT_14.id}/${PROJET_FORMAT_14.id}-projet.json`;
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;

/** Le document joué par le script de dépôt : `{ code, sortie, doc, touches }` — `doc` relu après la
 *  sortie 0, `touches` les fautes du témoin d'écriture après un refus. */
function parLeDepot(doc: unknown): { code: number | null; sortie: string; doc: unknown; touches: string[] } {
  const d = depot({ [REL]: canonique(doc) });
  try {
    const r = joue(d.racine, SCRIPT_DEPOT);
    return {
      code: r.code,
      sortie: r.sortie,
      doc: r.code === 0 ? JSON.parse(lireDans(d.racine, REL)) : null,
      touches: r.code === 0 ? [] : rienTouche(d.racine, d.avant),
    };
  } finally {
    efface(d.racine);
  }
}

/** Le document joué par le migrateur de chargement seul, `version` de travail retirée, au `schema` que la
 *  chaîne lui pose (`migreFormeDeProjet`, `worldMap.ts`). */
function parLeChargement(doc: unknown): unknown {
  const { version: _travail, ...migre } = PROJECT_MIGRATIONS[14]!({ ...structuredClone(doc as object), version: 14 } as never) as Record<string, unknown>;
  return { ...migre, schema: 15 };
}

describe('PARITÉ dépôt ⇄ chargement du bump 14 → 15 — une fixture, deux pendants (#1897)', () => {
  it('forme SOURCE et forme CIBLE : le script écrit EXACTEMENT ce que le chargement rend, et `parseProject` l’accepte', () => {
    const r = parLeDepot(PROJET_FORMAT_14);
    expect(r.code, r.sortie).toBe(0);
    expect(JSON.stringify(r.doc)).toBe(JSON.stringify(parLeChargement(PROJET_FORMAT_14)));
    expect(() => parseProject(structuredClone(PROJET_FORMAT_14))).not.toThrow();
  });

  const refusees: [string, (doc: typeof PROJET_FORMAT_14) => unknown][] = [
    ['(1) `{ id, spec }` — la `spec` ne tient pas dans un id nu', (doc) => {
      doc.narratif.presetsPnj[0].profil.spells = [{ id: 'flechette', spec: 'x' } as never];
      return doc;
    }],
    ['(2) `{ id: \'\' }` — un id VIDE', (doc) => {
      doc.narratif.presetsPnj[0].profil.spells = [{ id: '' }];
      return doc;
    }],
    ['(3) projet SANS `narratif` — exigé au format 14 (`narratif: narratifSchema`, `defs-scenes/projet.ts`)', (doc) => {
      const { narratif: _retire, ...sans } = doc;
      return sans;
    }],
  ];

  it.each(refusees)('%s : le chargement la laisse INTACTE et `parseProject` la refuse ; le script la refuse, rien d’écrit', (_cas, fabrique) => {
    const doc = fabrique(structuredClone(PROJET_FORMAT_14));
    const charge = parLeChargement(doc) as { narratif?: { presetsPnj: { profil?: { spells?: unknown } }[] } };
    const avant = (doc as { narratif?: { presetsPnj: { profil?: { spells?: unknown } }[] } }).narratif?.presetsPnj[0].profil?.spells;
    expect(charge.narratif?.presetsPnj[0].profil?.spells).toEqual(avant);
    expect(() => parseProject(structuredClone(doc))).toThrow();
    const r = parLeDepot(doc);
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/ARBITRAGE REQUIS/);
    expect(r.touches).toEqual([]);
  });
});
