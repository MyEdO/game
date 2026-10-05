/**
 * GARDE — `PROJECT_MIGRATIONS[7]` : un projet AUTHORÉ AVANT le lot #1691 se charge encore.
 *
 * QUESTION : la matière de chaque partie de relief est passée en DONNÉE (`Scene.reliefDefaults`,
 * EXIGÉE par `sceneSchema` — `gameIso/builders/floors.ts` ne choisit plus rien). Un `.json` exporté
 * avant ce lot, resté dans une bibliothèque utilisateur, traverse-t-il encore `parseProject` ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 7` — aucune scène n'y porte de
 * `reliefDefaults`. Il est FIGÉ ; le « moderniser » détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';

/**
 * ATTENDU GELÉ (#1716) — les matières que la migration 7 → 8 pose, écrites ICI en LITTÉRAL et non
 * lues à la semence du jour (`semences-de-scene.json`, éditable au Codex) : une migration
 * reconstitue ce qu'un projet AVAIT avant #1691, pas ce qu'une scène neuve recevrait aujourd'hui.
 */
const RELIEF_1691 = { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' };

/** Document schema 7 — FIGÉ. Ne pas y ajouter `reliefDefaults` : c'est le sujet de la mesure. */
const PROJET_FORMAT_7 = {
  type: 'projet',
  schema: 7,
  id: 'campagne-gelee-7',
  label: 'Campagne gelée (format 7)',
  versionContenu: 4,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'quai',
      label: 'Le quai',
      dimensions: { w: 2, h: 2 },
      layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }],
      entities: [{ id: 'tonneau', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'tonneau' }],
    },
  ],
};

describe('PROJECT_MIGRATIONS[7] — un projet format 7 se charge à travers la migration (#1691)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_7.schema).toBe(7);
    expect(PROJET_FORMAT_7.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_7.scenes[0]).not.toHaveProperty('reliefDefaults');
  });

  it('il se charge VERT, et chaque scène ressort avec les matières de relief que le builder posait', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_7));
    expect(doc.scenes[0].reliefDefaults).toEqual(RELIEF_1691);
    expect(doc.scenes[0].label).toBe('Le quai');
    expect(doc.scenes[0].entities![0].ref).toBe('tonneau');
  });

  it('une scène qui en porte DÉJÀ un le garde — la migration ne réécrit aucune matière authorée', () => {
    const authore = { cliff: 'pierre', ramp: 'pierre', deck: 'terre', pilier: 'pilier' };
    const avec = structuredClone(PROJET_FORMAT_7) as Record<string, unknown>;
    (avec.scenes as Record<string, unknown>[])[0].reliefDefaults = authore;
    expect(parseProject(avec).scenes[0].reliefDefaults).toEqual(authore);
  });

  /**
   * S1 — PARITÉ des DEUX implémentations du même bump (patron `projet-migration-5-vers-6.test.ts`).
   * Le geste 7 → 8 est écrit DEUX FOIS : pour le dépôt
   * (`scripts/migrations/2026-09-07-1691-relief-defaults-scenes.mjs`, qui a réécrit les 4 projets
   * committés) et pour le CHARGEMENT (ici, qui rattrape les `.json` de bibliothèque utilisateur).
   * La POSITION de la clé est ce que la parité mesure : le script de dépôt la pose juste avant
   * `layers`, place que lui donne la création (`emptyScene`) — un artefact re-généré à l'octet
   * diverge de son `build()` si la clé part en queue.
   */
  it('S1. PARITÉ : le migrateur de CHARGEMENT rend exactement ce que le script de DÉPÔT écrit', () => {
    const migre = PROJECT_MIGRATIONS[7]!({ ...structuredClone(PROJET_FORMAT_7), version: 7 } as never) as Record<string, unknown>;
    const scene = (migre.scenes as Record<string, unknown>[])[0];
    expect(Object.keys(scene)).toEqual(['type', 'id', 'label', 'dimensions', 'reliefDefaults', 'layers', 'entities']);
    expect(scene.reliefDefaults).toEqual(RELIEF_1691);
    // La charge utile est INTACTE : le document d'après, dépouillé de la seule clé posée et rendu à
    // son numéro de forme, rend le document d'avant — ordre des clés compris.
    const { reliefDefaults: _pose, ...sansPose } = scene;
    const inverse = { ...migre, schema: 7, scenes: [sansPose] };
    delete (inverse as Record<string, unknown>).version;
    expect(JSON.stringify(inverse)).toBe(JSON.stringify(PROJET_FORMAT_7));
  });

  it('S2. IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne pose rien de plus', () => {
    const une = PROJECT_MIGRATIONS[7]!({ ...structuredClone(PROJET_FORMAT_7), version: 7 } as never);
    const deux = PROJECT_MIGRATIONS[7]!({ ...structuredClone(une), version: 7 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, ce document ne passerait PAS la porte — la garde le prouve par le message', () => {
    // Le même document ANNONCÉ au numéro de forme courant ne migre plus : le schéma le refuse, en
    // NOMMANT le champ manquant. C'est le numéro de forme qui commande la migration.
    const bricole = { ...structuredClone(PROJET_FORMAT_7), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/reliefDefaults/);
  });
});
