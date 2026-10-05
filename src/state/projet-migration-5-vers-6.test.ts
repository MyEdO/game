/**
 * GARDE — `PROJECT_MIGRATIONS[5]` : un projet AUTHORÉ AVANT le lot #1467 L1b V-P7 se charge encore.
 *
 * QUESTION : le libellé d'une scène et de la carte du monde a pris sa graphie canonique (`label`),
 * et un statbloc EMBARQUÉ s'annonce désormais (`type: 'statblock'`, EXIGÉ par `customStatblockSchema`).
 * Un `.json` exporté avant ce lot, resté dans une bibliothèque utilisateur, traverse-t-il encore
 * `parseProject` ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 5` — clé `nom` et statbloc muet
 * inclus. Il est FIGÉ ; le « moderniser » détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';

/** Document schema 5 — FIGÉ. Ne pas renommer `nom` : c'est le sujet de la mesure. */
const PROJET_FORMAT_5 = {
  schema: 5,
  id: 'campagne-gelee-5',
  label: 'Campagne gelée (format 5)',
  icon: 'scenario/village',
  versionContenu: 7,
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      id: 'quai',
      nom: 'Le quai',
      desc: 'Un quai de chargement, format 5.',
      dimensions: { w: 4, h: 4 },
      entities: [
        { id: 'rat', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: { label: 'Rat géant', char: { B: 5 } } },
        { id: 'tonneau', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' },
      ],
    },
  ],
  worldMap: { id: 'carte', nom: 'La côte', places: [], routes: [] },
};

describe('PROJECT_MIGRATIONS[5] — un projet format 5 se charge à travers la migration (#1467 L1b V-P7)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_5.schema).toBe(5);
    expect(PROJET_FORMAT_5.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_5.scenes[0]).toHaveProperty('nom');
    expect(PROJET_FORMAT_5.worldMap).toHaveProperty('nom');
    expect(PROJET_FORMAT_5.scenes[0].entities[0].statblock).not.toHaveProperty('type');
  });

  it('il se charge VERT, et le libellé de scène ressort sous sa graphie canonique', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_5));
    expect(doc.scenes[0].label).toBe('Le quai');
    expect(doc.scenes[0]).not.toHaveProperty('nom');
    expect(doc.scenes[0].desc).toBe('Un quai de chargement, format 5.');
    expect(doc.label).toBe('Campagne gelée (format 5)');
  });

  it('la carte du monde suit la MÊME graphie', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_5));
    expect(doc.worldMap!.label).toBe('La côte');
    expect(doc.worldMap!).not.toHaveProperty('nom');
  });

  it('le statbloc EMBARQUÉ s’annonce, et l’entité SANS statbloc traverse intacte', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_5));
    const ents = doc.scenes[0].entities;
    expect(ents[0].statblock).toEqual({ type: 'statblock', label: 'Rat géant', char: { B: 5 } });
    expect(ents[1]).not.toHaveProperty('statblock');
    expect(ents[1].ref).toBe('tonneau');
  });

  /**
   * S1 — PARITÉ des DEUX implémentations du même bump. Le geste 5 → 6 est écrit DEUX FOIS : une fois
   * pour le dépôt (`scripts/migrations/2026-08-29-l1b-15b-projet-forme-6.mjs`, qui a réécrit les 4
   * projets committés) et une fois pour le CHARGEMENT (`PROJECT_MIGRATIONS[5]`, qui rattrape les `.json`
   * de bibliothèque utilisateur). Rien ne les liait : le jour où l'une évolue sans l'autre, un projet
   * importé se chargerait DIFFÉREMMENT d'un projet embarqué, sans une seule erreur.
   *
   * La fixture est GELÉE ici (jamais un `git show` : un test qui en dépend casse en clone superficiel).
   * On compare la SORTIE du migrateur applicatif au document ATTENDU — celui que le script de dépôt a
   * effectivement produit sur les projets committés, à la même forme (`label`, `type: 'statblock'`,
   * clés à leur POSITION).
   */
  it('S1. PARITÉ : le migrateur de CHARGEMENT rend exactement ce que le script de DÉPÔT écrit', () => {
    const migre = PROJECT_MIGRATIONS[5]!({ ...structuredClone(PROJET_FORMAT_5), version: 5 } as never) as Record<string, unknown>;
    // L'ORDRE des clés est celui du script de dépôt : `label` occupe la place de la clé de libellé.
    const scene = (migre.scenes as Record<string, unknown>[])[0];
    expect(Object.keys(scene)).toEqual(['id', 'label', 'desc', 'dimensions', 'entities']);
    expect(Object.keys(migre.worldMap as object)).toEqual(['id', 'label', 'places', 'routes']);
    const ents = scene.entities as Record<string, unknown>[];
    expect(Object.keys(ents[0].statblock as object)).toEqual(['type', 'label', 'char']);
    // Et la charge utile est INTACTE : le document d'après, renommé en sens INVERSE et dépouillé du
    // `type` posé, rend le document d'avant — ordre des clés compris.
    const inverse = {
      ...migre,
      schema: 5,
      scenes: [{ id: scene.id, nom: scene.label, desc: scene.desc, dimensions: scene.dimensions, entities: [
        { ...ents[0], statblock: (({ type: _t, ...r }) => r)(ents[0].statblock as Record<string, unknown>) },
        ents[1],
      ] }],
      worldMap: (({ label, ...r }) => ({ id: r.id, nom: label, places: r.places, routes: r.routes }))(migre.worldMap as Record<string, unknown>),
    };
    delete (inverse as Record<string, unknown>).version;
    expect(JSON.stringify(inverse)).toBe(JSON.stringify(PROJET_FORMAT_5));
  });

  it('SANS le migrateur, ce document ne passerait PAS la porte — la garde le prouve par le message', () => {
    // Un document schema 5 dont le libellé a été « modernisé » à la main SANS bump reste refusé :
    // c'est le numéro de forme qui commande la migration, jamais la forme devinée.
    const bricole = { ...structuredClone(PROJET_FORMAT_5), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/sch[eé]ma/);
  });
});
