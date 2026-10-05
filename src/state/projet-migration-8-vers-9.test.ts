/**
 * GARDE — `PROJECT_MIGRATIONS[8]` : un projet AUTHORÉ AVANT le lot #1715 se charge encore.
 *
 * QUESTION : la toiture par défaut est passée en DONNÉE (`Scene.roofDefaults`, EXIGÉE par
 * `sceneSchema` — `toitureEffective`/`deriveArchitectureMasses` ne choisissent plus rien). Un `.json`
 * exporté avant ce lot, resté dans une bibliothèque utilisateur, traverse-t-il encore `parseProject` ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 8` — aucune scène n'y porte de
 * `roofDefaults`. Il est FIGÉ ; le « moderniser » détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';

/**
 * ATTENDU GELÉ (#1716) — la valeur que la migration 8 → 9 pose, écrite ICI en LITTÉRAL et non lue
 * à la semence du jour (`semences-de-scene.json`, éditable au Codex) : une migration reconstitue ce
 * qu'un projet AVAIT avant #1715, pas ce qu'une scène neuve recevrait aujourd'hui. Comparer la
 * migration à une donnée que l'auteur peut changer ne prouverait plus rien.
 */
const TOITURE_1715 = { material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1 };
const RELIEF_1691 = { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' };

/** Document schema 8 — FIGÉ. Ne pas y ajouter `roofDefaults` : c'est le sujet de la mesure. */
const PROJET_FORMAT_8 = {
  type: 'projet',
  schema: 8,
  id: 'campagne-gelee-8',
  label: 'Campagne gelée (format 8)',
  versionContenu: 4,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'quai',
      label: 'Le quai',
      dimensions: { w: 2, h: 2 },
      reliefDefaults: { ...RELIEF_1691 },
      layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }],
      entities: [{ id: 'tonneau', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'tonneau' }],
    },
  ],
};

describe('PROJECT_MIGRATIONS[8] — un projet format 8 se charge à travers la migration (#1715)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_8.schema).toBe(8);
    expect(PROJET_FORMAT_8.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_8.scenes[0]).not.toHaveProperty('roofDefaults');
  });

  it('il se charge VERT, et chaque scène ressort avec la toiture que la dérivation appliquait', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_8));
    expect(doc.scenes[0].roofDefaults).toEqual(TOITURE_1715);
    expect(doc.scenes[0].label).toBe('Le quai');
    expect(doc.scenes[0].entities![0].ref).toBe('tonneau');
  });

  it('une scène qui en porte DÉJÀ une la garde — la migration ne réécrit aucune toiture authorée', () => {
    const authore = { material: 'chaume', pitchDeg: 30, riseMaxStoreys: 2 };
    const avec = structuredClone(PROJET_FORMAT_8) as Record<string, unknown>;
    (avec.scenes as Record<string, unknown>[])[0].roofDefaults = authore;
    expect(parseProject(avec).scenes[0].roofDefaults).toEqual(authore);
  });

  /**
   * S1 — PARITÉ des DEUX implémentations du même bump (patron `projet-migration-7-vers-8.test.ts`).
   * Le geste 8 → 9 est écrit DEUX FOIS : pour le dépôt
   * (`scripts/migrations/2026-09-09-1715-roof-defaults-scenes.mjs`, qui a réécrit les 4 projets
   * committés) et pour le CHARGEMENT (ici, qui rattrape les `.json` de bibliothèque utilisateur).
   * La POSITION de la clé est ce que la parité mesure : le script de dépôt la pose juste après
   * `reliefDefaults`, place que lui donne la création (`emptyScene`) — un artefact re-généré à
   * l'octet diverge de son `build()` si la clé part en queue.
   */
  it('S1. PARITÉ : le migrateur de CHARGEMENT rend exactement ce que le script de DÉPÔT écrit', () => {
    const migre = PROJECT_MIGRATIONS[8]!({ ...structuredClone(PROJET_FORMAT_8), version: 8 } as never) as Record<string, unknown>;
    const scene = (migre.scenes as Record<string, unknown>[])[0];
    expect(Object.keys(scene)).toEqual(['type', 'id', 'label', 'dimensions', 'reliefDefaults', 'roofDefaults', 'layers', 'entities']);
    expect(scene.roofDefaults).toEqual(TOITURE_1715);
    // La charge utile est INTACTE : le document d'après, dépouillé de la seule clé posée et rendu à
    // son numéro de forme, rend le document d'avant — ordre des clés compris.
    const { roofDefaults: _pose, ...sansPose } = scene;
    const inverse = { ...migre, schema: 8, scenes: [sansPose] };
    delete (inverse as Record<string, unknown>).version;
    expect(JSON.stringify(inverse)).toBe(JSON.stringify(PROJET_FORMAT_8));
  });

  it('S2. IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne pose rien de plus', () => {
    const une = PROJECT_MIGRATIONS[8]!({ ...structuredClone(PROJET_FORMAT_8), version: 8 } as never);
    const deux = PROJECT_MIGRATIONS[8]!({ ...structuredClone(une), version: 8 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, ce document ne passerait PAS la porte — la garde le prouve par le message', () => {
    // Le même document ANNONCÉ au numéro de forme courant ne migre plus : le schéma le refuse, en
    // NOMMANT le champ manquant. C'est le numéro de forme qui commande la migration.
    const bricole = { ...structuredClone(PROJET_FORMAT_8), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/roofDefaults/);
  });
});
