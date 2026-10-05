/**
 * GARDE — `PROJECT_MIGRATIONS[17]` (#1988 B4a) : un projet AUTHORÉ AVANT les dons d'objet en FK se charge
 * encore, ou il est refusé en NOMMANT ce qu'il ne sait pas monter.
 *
 * QUESTION : un `.json` exporté avant ce lot, resté dans une bibliothèque utilisateur, dont un Effet
 * `giveTrapping` porte des qualités en CHAÎNES et un objet libre (`custom`), et dont une Condition
 * `hasItem` nomme cet objet libre par son libellé, ressort-il keyé par id — sans qu'aucun objet ne soit
 * inventé ?
 *
 * Le sort de chaque classe héritée :
 *  - qualité connue (id, ou libellé d'authoring) → `{ id }` ;
 *  - qualité inconnue → refus nommé ;
 *  - `custom` résolu (objet du projet, sinon du catalogue, par son libellé) → `trappingId` ;
 *  - `custom` non résolu (aucun objet, ou des homonymes) → refus nommé ;
 *  - Condition `hasItem` qui nommait un objet libre → l'id de cet objet.
 *
 * FIXTURE GELÉE : les documents ci-dessous portent la forme `schema: 17`. Ils sont FIGÉS ; les
 * « moderniser » détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, migreSceneDeProjet, CURRENT_PROJECT_SCHEMA, ProjetRefuse } from './worldMap';
import type { TrappingData } from '../data';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { depot, efface, joue, lireDans, rienTouche } from '../../scripts/migrations/lib/joue.mjs';

/** L'objet libre « Clé du caveau », que le projet déclare dans `narratif.objets`. */
const CLE_DU_PROJET = { id: 'projet-cle-du-caveau', label: 'Clé du caveau', categorie: 'trapping', subType: null };

/** Flow du coffre : un don magique (qualité par id ET par libellé), deux objets libres. */
const flowDuCoffre = (dons: object[]) => ({ kind: 'seq', steps: dons.map((effect) => ({ kind: 'do', effect })) });

/** Document schema 17 — FIGÉ. `dons` et `herse` : ce que chaque cas fait varier. */
const projetFormat17 = (dons: object[], herse: object = { kind: 'flag', expr: 'ouverte' }) => ({
  type: 'projet',
  schema: 17,
  id: 'campagne-gelee-17',
  label: 'Campagne gelée (format 17)',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [CLE_DU_PROJET] },
  scenes: [
    {
      type: 'scene',
      id: 'caveau',
      label: 'Le caveau',
      dimensions: { w: 1, h: 1 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe'] }],
      entities: [
        { id: 'coffre', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 }, usable: { actions: [{ id: 'fouiller', flow: flowDuCoffre(dons) }] } },
      ],
      triggers: [{ id: 'herse', rect: { x: 0, y: 0, w: 1, h: 1 }, when: herse, flow: { kind: 'seq', steps: [] } }],
    },
  ],
});

const DONS_HERITES = [
  { type: 'giveTrapping', trappingId: 'epee-batarde', qualities: ['magique', 'De plaies atroces'], identified: false },
  { type: 'giveTrapping', custom: 'Clé du caveau' },
  { type: 'giveTrapping', custom: 'Corde' },
];
const charge = (doc: object) => parseProject(structuredClone(doc));
const coffre = (doc: ReturnType<typeof parseProject>) => doc.scenes[0].entities![0].usable!.actions![0].flow;
const refusDe = (doc: object): ProjetRefuse => {
  try {
    charge(doc);
  } catch (e) {
    if (e instanceof ProjetRefuse) return e;
    throw e;
  }
  throw new Error('le document devait être refusé');
};

describe('PROJECT_MIGRATIONS[17] — un projet format 17 aux dons d’objet libres se charge keyé par id (#1988 B4a)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(projetFormat17(DONS_HERITES).schema).toBe(17);
    expect(projetFormat17(DONS_HERITES).schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
  });

  it('qualité connue, par id ou par libellé → `{ id }` ; `custom` résolu → `trappingId`, objet du projet d’abord', () => {
    expect(coffre(charge(projetFormat17(DONS_HERITES)))).toEqual(flowDuCoffre([
      { type: 'giveTrapping', trappingId: 'epee-batarde', qualities: [{ id: 'magique' }, { id: 'de-plaies-atroces' }], identified: false },
      { type: 'giveTrapping', trappingId: CLE_DU_PROJET.id },
      { type: 'giveTrapping', trappingId: 'corde' },
    ]));
  });

  it('une Condition `hasItem` qui nommait l’objet libre désigne son id', () => {
    const doc = charge(projetFormat17(DONS_HERITES, { kind: 'hasItem', trappingId: 'Clé du caveau' }));
    expect(doc.scenes[0].triggers![0].when).toEqual({ kind: 'hasItem', trappingId: CLE_DU_PROJET.id });
  });

  it('qualité inconnue → refus NOMMÉ', () => {
    const refus = refusDe(projetFormat17([{ type: 'giveTrapping', trappingId: 'dague', qualities: ['luisante'] }]));
    expect(refus.message).toContain('giveTrapping.qualities : « luisante » n\'est aucune qualité du catalogue des qualités (qualities.json).');
  });

  it.each([
    ['aucun objet', 'Babiole onirique', 'giveTrapping.custom : « Babiole onirique » ne nomme aucun objet du projet (narratif.objets) ni du catalogue des objets'],
    ['des homonymes', 'Couteau', 'giveTrapping.custom : « Couteau » nomme plusieurs objets (couteau, couteau-2)'],
  ])('`custom` non résolu (%s) → refus NOMMÉ, aucun objet inventé', (_cas, libelle, attendu) => {
    expect(refusDe(projetFormat17([{ type: 'giveTrapping', custom: libelle }])).message).toContain(attendu);
  });

  it('SANS le migrateur, les dons hérités seraient REFUSÉS par le schéma', () => {
    const bricole = { ...projetFormat17(DONS_HERITES), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(structuredClone(bricole))).toThrow(ProjetRefuse);
  });
});

/**
 * Une scène d'AUTOSAVE (`editorAutosave.ts`) au format 17 monte par la même chaîne, avec les objets du
 * projet OUVERT (`migreSceneDeProjet`) : l'id d'un objet du projet y reste un id.
 */
describe('PROJECT_MIGRATIONS[17] — une scène d’autosave monte avec les objets du projet ouvert', () => {
  const sceneGelee = () => structuredClone(projetFormat17([], { kind: 'hasItem', trappingId: CLE_DU_PROJET.id }).scenes[0]);

  it('`hasItem` qui désigne un objet du projet ouvert par son id : la scène est reprise telle quelle', () => {
    const scene = migreSceneDeProjet(sceneGelee(), 17, [CLE_DU_PROJET as TrappingData]);
    expect(scene.triggers![0].when).toEqual({ kind: 'hasItem', trappingId: CLE_DU_PROJET.id });
  });

  it('un projet ouvert qui ne porte pas cet objet : refus NOMMÉ, qui dit ce qui manque', () => {
    expect(() => migreSceneDeProjet(sceneGelee(), 17, [])).toThrow(/« projet-cle-du-caveau » ne nomme aucun objet du projet \(narratif\.objets\) ni du catalogue des objets/);
  });
});

/**
 * PARITÉ des DEUX pendants du même bump : la MÊME fixture est jouée par le script de DÉPÔT
 * (`scripts/migrations/2026-10-05-1988-projet-dons-d-objet-en-fk.mjs`, dans un dépôt jetable) et par le
 * CHARGEMENT (`PROJECT_MIGRATIONS[17]`). Le script écrit EXACTEMENT ce que le chargement rend. Le dépôt ne
 * résout que par id (en-tête du script) : la fixture de parité ne porte que des ids.
 */
const SCRIPT_DEPOT = '2026-10-05-1988-projet-dons-d-objet-en-fk.mjs';
const PROJET_PAR_IDS = projetFormat17([{ type: 'giveTrapping', trappingId: 'rapiere', qualities: ['raffine'] }, { op: 'giveTrapping', trappingId: 'ration' }]);
const REL = `src/scenes/${PROJET_PAR_IDS.id}/${PROJET_PAR_IDS.id}-projet.json`;
const canonique = (doc: unknown) => `${JSON.stringify(doc, null, 1)}\n`;

/** Le document joué par le script de dépôt, avec la primitive et les catalogues qu'il lit. */
function parLeDepot(doc: unknown): { code: number | null; sortie: string; doc: unknown; touches: string[] } {
  const d = depot({ [REL]: canonique(doc) }, ['src/data/donsDObjet.ts', 'src/data/qualities.json', 'src/data/trappings.json']);
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
  const { version: _travail, ...migre } = PROJECT_MIGRATIONS[17]!({ ...structuredClone(doc as object), version: 17 } as never) as Record<string, unknown>;
  return { ...migre, schema: 18 };
}

describe('PARITÉ dépôt ⇄ chargement du bump 17 → 18 — une fixture, deux pendants (#1988 B4a)', () => {
  it('le script écrit EXACTEMENT ce que le chargement rend', () => {
    const r = parLeDepot(PROJET_PAR_IDS);
    expect(r.code, r.sortie).toBe(0);
    expect(JSON.stringify(r.doc)).toBe(JSON.stringify(parLeChargement(PROJET_PAR_IDS)));
  });

  it('un `custom` au dépôt : le dépôt DIT ne pas résoudre un libellé, rien d’écrit', () => {
    const r = parLeDepot(projetFormat17([{ type: 'giveTrapping', custom: 'Corde' }]));
    expect(r.code, r.sortie).toBe(1);
    expect(r.sortie).toMatch(/ARBITRAGE REQUIS/);
    expect(r.sortie).toContain("le dépôt ne résout pas un libellé (« Corde ») : charger le projet par l'éditeur (`parseProject`)");
    expect(r.touches).toEqual([]);
  });
});
