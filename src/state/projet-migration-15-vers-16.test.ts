/**
 * GARDE — `PROJECT_MIGRATIONS[15]` : un projet AUTHORÉ AVANT la fusion des sorts de #1897 se charge encore.
 *
 * QUESTION : 54 ids de sort du livre fan sont FUSIONNÉS dans l'entrée qui les double
 * (`SORTS_FUSIONNES_1897`, `src/data/sortsFusionnes.ts`) et n'existent plus au catalogue. Un `.json`
 * exporté avant ce lot, resté dans une bibliothèque utilisateur, qui cite l'un d'eux à une place de sort
 * (statbloc, rôle de combat, effets `learnSpell`/`castSpell`, preset de PNJ), ressort-il avec l'entrée
 * absorbante — au lieu d'être refusé par `idDe('spell')` ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 15`, un id fusionné à chaque place de
 * sort, et `nuee` (id fusionné) en TRAIT, hors place de sort. Il est FIGÉ ; le « moderniser » détruirait
 * ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { depot, efface, joue, lireDans, rienTouche } from '../../scripts/migrations/lib/joue.mjs';

/** Flow d'une action authorée : un effet `learnSpell` et un effet `castSpell`, chacun sur un id fusionné. */
const flowDAutel = () => ({
  kind: 'seq',
  steps: [
    { kind: 'do', effect: { type: 'learnSpell', spell: 'alarme' } },
    { kind: 'do', effect: { type: 'castSpell', casterId: 'sorcier', spellId: 'projectile' } },
  ],
});

/** Document schema 15 — FIGÉ. Ne pas y remplacer les ids fusionnés : c'est le sujet de la mesure. */
const PROJET_FORMAT_15 = {
  type: 'projet',
  schema: 15,
  id: 'campagne-gelee-15',
  label: 'Campagne gelée (format 15)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: {
    affaires: [],
    indices: [],
    presetsPnj: [{ id: 'mage', base: 'squelette', profil: { spells: ['alarme', 'alerte'] } }],
    objets: [],
  },
  scenes: [
    {
      type: 'scene',
      id: 'crypte',
      label: 'La crypte',
      dimensions: { w: 2, h: 1 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe', 'herbe'] }],
      entities: [
        {
          id: 'sorcier',
          kind: 'personnage',
          pos: { x: 0, y: 0 },
          statblock: { type: 'statblock', label: 'Sorcier', char: {}, spells: ['alarme', 'flamme'], traits: [{ id: 'nuee' }] },
          combat: { spells: ['alarme'] },
        },
        { id: 'autel', kind: 'prop', ref: 'tonneau', pos: { x: 1, y: 0 }, usable: { actions: [{ id: 'prier', flow: flowDAutel() }] } },
      ],
    },
  ],
};

const charge = () => parseProject(structuredClone(PROJET_FORMAT_15));

describe('PROJECT_MIGRATIONS[15] — un projet format 15 qui cite un sort fusionné se charge (#1897)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_15.schema).toBe(15);
    expect(PROJET_FORMAT_15.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
  });

  it('chaque place de sort cite l’entrée ABSORBANTE ; le trait homonyme traverse intact', () => {
    const doc = charge();
    const [sorcier, autel] = doc.scenes[0].entities!;
    expect(sorcier.statblock?.spells).toEqual(['alerte', 'flamme-magique']);
    expect(sorcier.statblock?.traits).toEqual([{ id: 'nuee' }]);
    expect(sorcier.combat?.spells).toEqual(['alerte']);
    expect(autel.usable?.actions?.[0].flow).toEqual({
      kind: 'seq',
      steps: [
        { kind: 'do', effect: { type: 'learnSpell', spell: 'alerte' } },
        { kind: 'do', effect: { type: 'castSpell', casterId: 'sorcier', spellId: 'carreau' } },
      ],
    });
    expect(doc.narratif.presetsPnj[0].profil?.spells, 'dédoublonnée : `alarme` ET `alerte` n’en font qu’un').toEqual(['alerte']);
  });

  it('IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne change plus rien', () => {
    const une = PROJECT_MIGRATIONS[15]!({ ...structuredClone(PROJET_FORMAT_15), version: 15 } as never);
    const deux = PROJECT_MIGRATIONS[15]!({ ...structuredClone(une), version: 15 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, l’id fusionné serait REFUSÉ au parse', () => {
    const bricole = { ...structuredClone(PROJET_FORMAT_15), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/« alarme » est absent du catalogue des sorts \(spells\.json\)/);
  });
});

/**
 * PARITÉ des DEUX pendants du même bump : la MÊME fixture est jouée par le script de DÉPÔT
 * (`scripts/migrations/2026-09-24-1897-projet-sorts-fusionnes.mjs`, dans un dépôt jetable) et par le
 * CHARGEMENT (`PROJECT_MIGRATIONS[15]`). Le script écrit EXACTEMENT ce que le chargement rend.
 */
const SCRIPT_DEPOT = '2026-09-24-1897-projet-sorts-fusionnes.mjs';
const REL = `src/scenes/${PROJET_FORMAT_15.id}/${PROJET_FORMAT_15.id}-projet.json`;
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;

/** Le document joué par le script de dépôt, qui importe la primitive (`src/data/sortsFusionnes.ts`). */
function parLeDepot(doc: unknown): { code: number | null; sortie: string; doc: unknown; touches: string[] } {
  const d = depot({ [REL]: canonique(doc) }, ['src/data/sortsFusionnes.ts']);
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
  const { version: _travail, ...migre } = PROJECT_MIGRATIONS[15]!({ ...structuredClone(doc as object), version: 15 } as never) as Record<string, unknown>;
  return migre;
}

describe('PARITÉ dépôt ⇄ chargement du bump 15 → 16 — une fixture, deux pendants (#1897)', () => {
  it('le script écrit EXACTEMENT ce que le chargement rend, et `parseProject` accepte ce qu’il écrit', () => {
    const r = parLeDepot(PROJET_FORMAT_15);
    expect(r.code, r.sortie).toBe(0);
    expect(JSON.stringify(r.doc)).toBe(JSON.stringify(parLeChargement(PROJET_FORMAT_15)));
    expect(() => parseProject(r.doc)).not.toThrow();
  });

  it('schema 14 : le script le refuse (sa borne basse), rien d’écrit', () => {
    const r = parLeDepot({ ...structuredClone(PROJET_FORMAT_15), schema: 14 });
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/ARBITRAGE REQUIS/);
    expect(r.sortie).toContain('`schema` inattendu 14');
    expect(r.touches).toEqual([]);
  });
});
