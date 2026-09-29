/**
 * GARDE — `PROJECT_MIGRATIONS[10]` : un projet AUTHORÉ AVANT le lot 3 de #1687 se charge encore.
 *
 * QUESTION : la fouille d'un décor n'est plus un CHAMP de l'entité (`interact`, que le schéma refuse
 * désormais en clé inconnue) mais une ACTION AUTHORÉE de l'enveloppe `usable` — et cette enveloppe,
 * VIDE, ne dit plus « assise activée » par sa seule présence. Un `.json` exporté avant ce lot, resté
 * dans une bibliothèque utilisateur, ressort-il avec ses décors encore fouillables et ses meubles
 * encore assis-ables ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 10` — un décor à `interact` (avec et
 * sans `consume`) et un meuble à `usable: {}`. Il est FIGÉ ; le « moderniser » détruirait ce que la
 * garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';
import { actionsDe, estUtilisable } from './usable';

/** Un TYPE de décor qui porte des places au catalogue — la population du bump précédent. */
const TYPE_A_PLACES = 'table-ronde-4-tabourets';
const FLOW = { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'giveMoney', montant: { gold: 1 } } }] };

/** Document schema 10 — FIGÉ. Ne pas y remplacer `interact` : c'est le sujet de la mesure. */
const PROJET_FORMAT_10 = {
  type: 'projet',
  schema: 10,
  id: 'campagne-gelee-10',
  label: 'Campagne gelée (format 10)',
  versionContenu: 4,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'salle',
      label: 'La salle',
      dimensions: { w: 2, h: 2 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }],
      entities: [
        { id: 'cadavre', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 }, interact: { flow: FLOW } },
        { id: 'coffre', kind: 'prop', ref: 'tonneau', pos: { x: 1, y: 0 }, interact: { flow: FLOW, consume: true } },
        { id: 'table', kind: 'prop', ref: TYPE_A_PLACES, pos: { x: 1, y: 1 }, usable: {} },
      ],
    },
  ],
};

const scèneMigrée = () => parseProject(structuredClone(PROJET_FORMAT_10)).scenes[0];

describe('PROJECT_MIGRATIONS[10] — un projet format 10 se charge à travers la migration (#1687)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_10.schema).toBe(10);
    expect(PROJET_FORMAT_10.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_10.scenes[0].entities[0]).toHaveProperty('interact');
  });

  it('la fouille devient une ACTION AUTHORÉE : `consume` traverse, son absence devient `unique`', () => {
    const [cadavre, coffre] = scèneMigrée().entities!;
    expect(cadavre).not.toHaveProperty('interact');
    expect(cadavre.usable).toEqual({ actions: [{ id: 'fouiller', flow: FLOW, unique: true }] });
    expect(coffre.usable).toEqual({ actions: [{ id: 'fouiller', flow: FLOW, consume: true }] });
  });

  it('l’enveloppe VIDE du bump précédent se NOMME `assise` — sans quoi le meuble deviendrait muet', () => {
    const sc = scèneMigrée();
    const table = sc.entities![2];
    expect(table.usable).toEqual({ assise: true });
    expect(actionsDe(sc, table).map((a) => a.id)).toEqual(['sasseoir']);
  });

  it('les décors migrés OFFRENT encore leur geste (c’est la seule chose que le joueur voyait)', () => {
    const sc = scèneMigrée();
    for (const e of sc.entities!) expect(estUtilisable(sc, e), `${e.id} est devenu muet`).toBe(true);
  });

  /**
   * S1 — PARITÉ des DEUX implémentations du même bump (patron `projet-migration-9-vers-10.test.ts`).
   * Le geste 10 → 11 est écrit DEUX FOIS : pour le dépôt
   * (`scripts/migrations/2026-09-11-1687-actions-authorees.mjs`, qui a réécrit les 4 projets committés)
   * et pour le CHARGEMENT (ici, qui rattrape les `.json` de bibliothèque utilisateur). La POSITION de
   * la clé est ce que la parité mesure : les deux posent `usable` à la PLACE de l'`interact` remplacé.
   */
  it('S1. PARITÉ : le migrateur de CHARGEMENT rend exactement ce que le script de DÉPÔT écrit', () => {
    const migre = PROJECT_MIGRATIONS[10]!({ ...structuredClone(PROJET_FORMAT_10), version: 10 } as never) as Record<string, unknown>;
    expect(migre.schema).toBe(11);
    const scene = (migre.scenes as Record<string, unknown>[])[0];
    const entites = scene.entities as Record<string, unknown>[];
    // `usable` prend la place qu'occupait `interact` — en queue ici, comme dans la fixture.
    expect(Object.keys(entites[0])).toEqual(['id', 'kind', 'ref', 'pos', 'usable']);
    expect(Object.keys(entites[2])).toEqual(['id', 'kind', 'ref', 'pos', 'usable']);
  });

  it('S2. IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne change plus rien', () => {
    const une = PROJECT_MIGRATIONS[10]!({ ...structuredClone(PROJET_FORMAT_10), version: 10 } as never);
    const deux = PROJECT_MIGRATIONS[10]!({ ...structuredClone(une), version: 10 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, le décor serait REFUSÉ au parse et le meuble MUET — la garde le prouve', () => {
    // Le même document ANNONCÉ au numéro de forme courant ne migre plus : `interact` est une clé
    // INCONNUE du schéma, qui la NOMME, et l'enveloppe vide n'offre plus rien.
    const bricole = { ...structuredClone(PROJET_FORMAT_10), schema: CURRENT_PROJECT_SCHEMA, narratif: { ...PROJET_FORMAT_10.narratif, documents: [] } };
    expect(() => parseProject(bricole)).toThrow(/interact/);
    const sansFouille = structuredClone(bricole) as typeof bricole;
    sansFouille.scenes[0].entities = [sansFouille.scenes[0].entities[2]];
    const sc = parseProject(sansFouille).scenes[0];
    expect(estUtilisable(sc, sc.entities![0])).toBe(false);
  });
});
