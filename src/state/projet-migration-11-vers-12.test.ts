/**
 * GARDE — `PROJECT_MIGRATIONS[11]` : un projet AUTHORÉ AVANT #877 se charge encore.
 *
 * QUESTION : le TYPE d'un décor n'est plus facultatif. `ref` est REQUISE sur une entité
 * `kind:'prop'` et résolue au registre `props.json` — une ref de décor se DIT ou se REFUSE, jamais ne
 * se remplace. Avant ce lot, le rendu substituait un id en dur à la ref absente. Un `.json` exporté
 * avant ce lot, resté dans une bibliothèque utilisateur, ressort-il avec ses décors DESSINÉS COMME
 * AVANT ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 11` — un décor SANS `ref` (le point
 * d'interaction authoré nu, la population du bump) et un décor qui NOMME déjà son type. Il est FIGÉ ;
 * le « moderniser » (lui poser une `ref`) détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';

/** Le type que le rendu DONNAIT à un décor sans `ref` avant #877 — ce que la migration ÉCRIT. */
const REF_DU_RENDU_AVANT_877 = 'tonneau';
/** Un type de décor qui NOMME déjà le sien : il doit traverser INTACT. */
const TYPE_NOMME = 'table-ronde-4-tabourets';
const FLOW = { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'openWorldMap' } }] };

/** Document schema 11 — FIGÉ. Ne pas poser de `ref` sur `jetee` : c'est le sujet de la mesure. */
const PROJET_FORMAT_11 = {
  type: 'projet',
  schema: 11,
  id: 'campagne-gelee-11',
  label: 'Campagne gelée (format 11)',
  versionContenu: 4,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'quai',
      label: 'Le quai',
      dimensions: { w: 2, h: 2 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }],
      entities: [
        { id: 'jetee', kind: 'prop', pos: { x: 0, y: 0 }, label: 'La jetée', usable: { actions: [{ id: 'fouiller', flow: FLOW, unique: true }] } },
        { id: 'table', kind: 'prop', ref: TYPE_NOMME, pos: { x: 1, y: 1 } },
      ],
    },
  ],
};

const scèneMigrée = () => parseProject(structuredClone(PROJET_FORMAT_11)).scenes[0];

describe('PROJECT_MIGRATIONS[11] — un projet format 11 se charge à travers la migration (#877)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_11.schema).toBe(11);
    expect(PROJET_FORMAT_11.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_11.scenes[0].entities[0]).not.toHaveProperty('ref');
  });

  it('le décor sans type NOMME celui que le rendu lui donnait — même dessin qu’avant', () => {
    const [jetee] = scèneMigrée().entities!;
    expect(jetee.ref).toBe(REF_DU_RENDU_AVANT_877);
  });

  it('un décor qui NOMMAIT déjà son type traverse INTACT', () => {
    expect(scèneMigrée().entities![1].ref).toBe(TYPE_NOMME);
  });

  it('le geste authoré du décor migré survit (c’est la seule chose que le joueur voyait)', () => {
    expect(scèneMigrée().entities![0].usable).toEqual({ actions: [{ id: 'fouiller', flow: FLOW, unique: true }] });
  });

  /**
   * S1 — PARITÉ des DEUX implémentations du même bump (patron `projet-migration-10-vers-11.test.ts`).
   * Le geste 11 → 12 est écrit DEUX FOIS : pour le dépôt
   * (`scripts/migrations/2026-09-21-877-ref-de-decor-nommee.mjs`, qui a réécrit les 4 projets committés)
   * et pour le CHARGEMENT (ici, qui rattrape les `.json` de bibliothèque utilisateur). La POSITION de
   * la clé est ce que la parité mesure : les deux posent `ref` en QUEUE de l'entité.
   */
  it('S1. PARITÉ : le migrateur de CHARGEMENT rend exactement ce que le script de DÉPÔT écrit', () => {
    const migre = PROJECT_MIGRATIONS[11]!({ ...structuredClone(PROJET_FORMAT_11), version: 11 } as never) as Record<string, unknown>;
    expect(migre.schema).toBe(12);
    const scene = (migre.scenes as Record<string, unknown>[])[0];
    const entites = scene.entities as Record<string, unknown>[];
    expect(Object.keys(entites[0])).toEqual(['id', 'kind', 'pos', 'label', 'usable', 'ref']);
    expect(Object.keys(entites[1])).toEqual(['id', 'kind', 'ref', 'pos']);
  });

  it('S2. IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne change plus rien', () => {
    const une = PROJECT_MIGRATIONS[11]!({ ...structuredClone(PROJET_FORMAT_11), version: 11 } as never);
    const deux = PROJECT_MIGRATIONS[11]!({ ...structuredClone(une), version: 11 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, le décor sans type serait REFUSÉ au parse, en NOMMANT l’entité', () => {
    // Le même document ANNONCÉ au numéro de forme courant ne migre plus : le schéma EXIGE le type
    // d'un décor et nomme l'entité fautive, au lieu de lui substituer un id en dur.
    const bricole = { ...structuredClone(PROJET_FORMAT_11), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/entities « jetee » › ref: « ref » absente/);
  });

  it('une ref MORTE n’est pas du ressort de la migration : le schéma la NOMME, personne ne la remplace', () => {
    const mort = { ...structuredClone(PROJET_FORMAT_11), schema: CURRENT_PROJECT_SCHEMA };
    mort.scenes[0].entities = [{ ...mort.scenes[0].entities[1], ref: 'zzz-disparu' }] as never;
    expect(() => parseProject(mort)).toThrow(/entities « table » › ref: « zzz-disparu » est absent du catalogue des décors \(props\.json\)/);
  });
});
