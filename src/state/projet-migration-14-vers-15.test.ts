/**
 * GARDE — `PROJECT_MIGRATIONS[14]` : un projet AUTHORÉ AVANT la graphie `talent: { id, spec? }` des ops de
 * Talent (#1473, train 2a) se charge encore.
 *
 * QUESTION : un `.json` exporté avant ce lot, resté dans une bibliothèque utilisateur, dont une action
 * de scène octroie un Talent par `{ op: 'grantTalent', talentId, spec? }`, ressort-il à la graphie typée
 * — au lieu d'être refusé par le payload strict de l'op ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 14`. Il est FIGÉ ; le « moderniser »
 * détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { depot, efface, joue, lireDans, rienTouche } from '../../scripts/migrations/lib/joue.mjs';

/** Flow d'une action authorée : deux ops de Talent à l'ANCIENNE graphie, l'une spécialisée. */
const flowDeLAutel = () => ({
  kind: 'seq',
  steps: [
    {
      kind: 'do',
      effect: {
        type: 'ops',
        on: 'party',
        ops: [
          { op: 'grantTalent', talentId: 'chanceux' },
          { op: 'grantTalent', talentId: 'sens-aiguise', spec: 'odorat' },
        ],
      },
    },
  ],
});

/** Document schema 14 — FIGÉ. Ne pas y réécrire les ops : c'est le sujet de la mesure. */
const PROJET_FORMAT_14 = {
  type: 'projet',
  schema: 14,
  id: 'campagne-gelee-14',
  label: 'Campagne gelée (format 14)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'chapelle',
      label: 'La chapelle',
      dimensions: { w: 1, h: 1 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe'] }],
      entities: [
        { id: 'autel', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 }, usable: { actions: [{ id: 'prier', flow: flowDeLAutel() }] } },
      ],
    },
  ],
};

const charge = () => parseProject(structuredClone(PROJET_FORMAT_14));

describe('PROJECT_MIGRATIONS[14] — un projet format 14 qui octroie un Talent se charge (#1473)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_14.schema).toBe(14);
    expect(PROJET_FORMAT_14.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
  });

  it('chaque op de Talent porte `talent: { id, spec? }`', () => {
    const [autel] = charge().scenes[0].entities!;
    expect(autel.usable?.actions?.[0].flow).toEqual({
      kind: 'seq',
      steps: [
        {
          kind: 'do',
          effect: {
            type: 'ops',
            on: 'party',
            ops: [
              { op: 'grantTalent', talent: { id: 'chanceux' } },
              { op: 'grantTalent', talent: { id: 'sens-aiguise', spec: 'odorat' } },
            ],
          },
        },
      ],
    });
  });

  it('SANS le migrateur, l’op à l’ancienne graphie serait REFUSÉE au parse', () => {
    const bricole = { ...structuredClone(PROJET_FORMAT_14), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/GameOp « grantTalent »/);
  });
});

/**
 * PARITÉ des DEUX pendants du même bump : la MÊME fixture est jouée par le script de DÉPÔT
 * (`scripts/migrations/2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs`, dans un dépôt jetable) et
 * par le CHARGEMENT (`PROJECT_MIGRATIONS[14]`). Le script écrit EXACTEMENT ce que le chargement rend.
 */
const SCRIPT_DEPOT = '2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs';
const REL = `src/scenes/${PROJET_FORMAT_14.id}/${PROJET_FORMAT_14.id}-projet.json`;
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;

/** Le document joué par le script de dépôt, qui importe la primitive (`src/data/graphieOpsDeTalent.ts`). */
function parLeDepot(doc: unknown): { code: number | null; sortie: string; doc: unknown; touches: string[] } {
  const d = depot({ [REL]: canonique(doc) }, ['src/data/graphieOpsDeTalent.ts']);
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

/** Le document joué par le migrateur de chargement seul, `version` de travail retirée. */
function parLeChargement(doc: unknown): unknown {
  const { version: _travail, ...migre } = PROJECT_MIGRATIONS[14]!({ ...structuredClone(doc as object), version: 14 } as never) as Record<string, unknown>;
  return migre;
}

describe('PARITÉ dépôt ⇄ chargement du bump 14 → 15 — une fixture, deux pendants (#1473)', () => {
  it('le script écrit EXACTEMENT ce que le chargement rend, et `parseProject` accepte ce qu’il écrit', () => {
    const r = parLeDepot(PROJET_FORMAT_14);
    expect(r.code, r.sortie).toBe(0);
    expect(JSON.stringify(r.doc)).toBe(JSON.stringify(parLeChargement(PROJET_FORMAT_14)));
    expect(() => parseProject(r.doc)).not.toThrow();
  });

  it('schema 13 : le script le refuse (sa borne basse), rien d’écrit', () => {
    const r = parLeDepot({ ...structuredClone(PROJET_FORMAT_14), schema: 13 });
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/ARBITRAGE REQUIS/);
    expect(r.sortie).toContain('`schema` inattendu 13');
    expect(r.touches).toEqual([]);
  });
});
