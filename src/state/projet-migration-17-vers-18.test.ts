/**
 * GARDE — `PROJECT_MIGRATIONS[17]` : un projet dont une entité de scène porte son arme en LIBELLÉ se charge
 * encore, ou se fait refuser en NOMMANT l'arme (#1897).
 *
 * QUESTION : `SceneEntity.weapon` passe à l'id d'une arme (sous-listes `melee`/`ranged` de
 * `idDe('trapping', …)`). Le sélecteur de l'éditeur écrivait des libellés (`EDITOR_WEAPONS`, de 7e00116bf à 8cc29d3e3). Un `.json` exporté avant, resté dans une
 * bibliothèque utilisateur, ressort-il avec l'id de son arme — ou, sans id à son libellé, refusé au chemin ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 17`. Il est FIGÉ ; le « moderniser »
 * détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { depot, efface, joue, lireDans, rienTouche } from '../../scripts/migrations/lib/joue.mjs';

/** Document schema 17 — FIGÉ. Ne pas y réécrire les `weapon` : c'est le sujet de la mesure. */
const PROJET_FORMAT_17 = {
  type: 'projet',
  schema: 17,
  id: 'campagne-gelee-17',
  label: 'Campagne gelée (format 17)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'poste',
      label: 'Le poste de garde',
      dimensions: { w: 2, h: 1 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe', 'herbe'] }],
      entities: [
        { id: 'archer', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, weapon: 'Arc' },
        { id: 'sergent', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 0 }, weapon: 'hallebarde' },
      ],
    },
  ],
};

type Fixture = typeof PROJET_FORMAT_17 & { scenes: { entities: { weapon?: string }[] }[] };
const fixture = (): Fixture => structuredClone(PROJET_FORMAT_17) as Fixture;
const armes = (doc: { scenes: { entities?: { weapon?: string }[] }[] }) => doc.scenes[0].entities!.map((e) => e.weapon);

describe('PROJECT_MIGRATIONS[17] — l’arme d’une entité de scène en libellé (#1897)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_17.schema).toBe(17);
    expect(PROJET_FORMAT_17.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
  });

  it('un libellé de la table ressort en id, un id traverse INTACT', () => {
    expect(armes(parseProject(fixture()))).toEqual(['arc', 'hallebarde']);
  });

  it('SANS le migrateur, le libellé est REFUSÉ au parse, au chemin de l’arme', () => {
    const bricole = { ...fixture(), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/scenes « poste » › entities « archer » › weapon: « Arc » n'est pas une arme/);
  });

  it('un libellé SANS id au catalogue (« Épée ») traverse la migration et le parse le refuse en le nommant', () => {
    const epee = fixture();
    epee.scenes[0].entities[0].weapon = 'Épée';
    expect(armes(parLeChargement(epee) as Fixture)).toEqual(['Épée', 'hallebarde']);
    expect(() => parseProject(epee)).toThrow(/scenes « poste » › entities « archer » › weapon: « Épée » n'est pas une arme/);
  });
});

/**
 * PARITÉ des DEUX pendants du même bump : la MÊME fixture est jouée par le script de DÉPÔT
 * (`scripts/migrations/2026-09-27-1897-projet-armes-d-entite-ids.mjs`, dans un dépôt jetable) et par le
 * CHARGEMENT (`PROJECT_MIGRATIONS[17]`). Le script écrit EXACTEMENT ce que le chargement rend ; ce que le
 * chargement laisse à `parseProject` pour qu'il le refuse, le script le refuse.
 */
const SCRIPT_DEPOT = '2026-09-27-1897-projet-armes-d-entite-ids.mjs';
const REL = `src/scenes/${PROJET_FORMAT_17.id}/${PROJET_FORMAT_17.id}-projet.json`;
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;

/** Le document joué par le script de dépôt, qui importe la primitive et lit les ids de trapping. */
function parLeDepot(doc: unknown): { code: number | null; sortie: string; doc: unknown; touches: string[] } {
  const d = depot({ [REL]: canonique(doc) }, ['src/data/armesDEntiteEnIds.ts', 'src/data/trappings.json']);
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
  const { version: _travail, ...migre } = PROJECT_MIGRATIONS[17]!({ ...structuredClone(doc as object), version: 17 } as never) as Record<string, unknown>;
  return migre;
}

describe('PARITÉ dépôt ⇄ chargement du bump 17 → 18 — une fixture, deux pendants (#1897)', () => {
  it('le script écrit EXACTEMENT ce que le chargement rend, et `parseProject` accepte ce qu’il écrit', () => {
    const r = parLeDepot(PROJET_FORMAT_17);
    expect(r.code, r.sortie).toBe(0);
    expect(JSON.stringify(r.doc)).toBe(JSON.stringify(parLeChargement(PROJET_FORMAT_17)));
    expect(() => parseProject(r.doc)).not.toThrow();
  });

  it('« Épée » (hors table, hors catalogue) : le chargement la laisse et `parseProject` la refuse ; le script la refuse, rien d’écrit', () => {
    const epee = fixture();
    epee.scenes[0].entities[0].weapon = 'Épée';
    expect(() => parseProject(structuredClone(epee))).toThrow();
    const r = parLeDepot(epee);
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/ARBITRAGE REQUIS/);
    expect(r.sortie).toContain('scenes[0].entities[0].weapon : "Épée" n\'est pas un id de trapping');
    expect(r.touches).toEqual([]);
  });

  it('schema 16 : le script le refuse (sa borne basse), rien d’écrit', () => {
    const r = parLeDepot({ ...fixture(), schema: 16 });
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toContain('`schema` inattendu 16');
    expect(r.touches).toEqual([]);
  });
});
