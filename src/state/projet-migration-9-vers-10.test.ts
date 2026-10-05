/**
 * GARDE — `PROJECT_MIGRATIONS[9]` : un projet AUTHORÉ AVANT le lot #1687 se charge encore.
 *
 * QUESTION : l'utilisabilité d'une entité se DÉRIVE désormais de ce qu'elle offre (`estUtilisable`,
 * `state/usable.ts`), et l'ASSISE d'un décor dont le TYPE porte des places n'est offerte que si
 * l'INSTANCE est activée (`SceneEntity.usable`). Un `.json` exporté avant ce lot, resté dans une
 * bibliothèque utilisateur, ressort-il avec ses meubles à places encore assis-ables ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 9` — aucune entité n'y porte de
 * `usable`. Il est FIGÉ ; le « moderniser » détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from './scene';

/** Un TYPE de décor qui porte des places au catalogue — le seul cas que ce bump concerne. */
const TYPE_A_PLACES = 'table-ronde-4-tabourets';

/** Document schema 9 — FIGÉ. Ne pas y ajouter `usable` : c'est le sujet de la mesure. */
const PROJET_FORMAT_9 = {
  type: 'projet',
  schema: 9,
  id: 'campagne-gelee-9',
  label: 'Campagne gelée (format 9)',
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
        { id: 'table', kind: 'prop', ref: TYPE_A_PLACES, pos: { x: 1, y: 1 } },
        { id: 'tonneau', kind: 'prop', ref: 'tonneau', pos: { x: 0, y: 0 } },
      ],
    },
  ],
};

describe('PROJECT_MIGRATIONS[9] — un projet format 9 se charge à travers la migration (#1687)', () => {
  it('le document gelé est bien au format ANTÉRIEUR (sans quoi la garde ne mesurerait rien)', () => {
    expect(PROJET_FORMAT_9.schema).toBe(9);
    expect(PROJET_FORMAT_9.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROJET_FORMAT_9.scenes[0].entities[0]).not.toHaveProperty('usable');
  });

  it('il se charge VERT, et le meuble à places ressort ACTIVÉ — il était assis-able avant le lot', () => {
    const doc = parseProject(structuredClone(PROJET_FORMAT_9));
    const [table, tonneau] = doc.scenes[0].entities!;
    // La chaîne ne s'arrête pas à ce bump : la 10→11 NOMME l'enveloppe que celui-ci pose
    // (`projet-migration-10-vers-11.test.ts`). Ce qui se mesure ici est l'ACTIVATION, bout en bout.
    expect(table.usable).toEqual({ assise: true });
    // Un décor SANS place au catalogue n'a rien à activer : l'assise est la seule capacité de TYPE.
    expect(tonneau).not.toHaveProperty('usable');
  });

  it('une entité SANS place que l’auteur avait déjà activée garde son activation', () => {
    const avec = structuredClone(PROJET_FORMAT_9) as Record<string, unknown>;
    const scene = (avec.scenes as Record<string, unknown>[])[0];
    (scene.entities as Record<string, unknown>[])[1].usable = {}; // le tonneau, activé à la main
    expect(parseProject(avec).scenes[0].entities![1].usable).toEqual({ assise: true });
  });

  /**
   * S1 — PARITÉ des DEUX implémentations du même bump (patron `projet-migration-8-vers-9.test.ts`).
   * Le geste 9 → 10 est écrit DEUX FOIS : pour le dépôt
   * (`scripts/migrations/2026-09-10-1687-usable-sieges.mjs`, qui a réécrit les 4 projets committés)
   * et pour le CHARGEMENT (ici, qui rattrape les `.json` de bibliothèque utilisateur). La POSITION de
   * la clé est ce que la parité mesure : les deux la posent en QUEUE de l'entité, place que l'éditeur
   * lui donne (`editEntity`).
   */
  it('S1. PARITÉ : le migrateur de CHARGEMENT rend exactement ce que le script de DÉPÔT écrit', () => {
    const migre = PROJECT_MIGRATIONS[9]!({ ...structuredClone(PROJET_FORMAT_9), version: 9 } as never) as Record<string, unknown>;
    const scene = (migre.scenes as Record<string, unknown>[])[0];
    const entites = scene.entities as Record<string, unknown>[];
    expect(Object.keys(entites[0])).toEqual(['id', 'kind', 'ref', 'pos', 'usable']);
    expect(entites[0].usable).toEqual({});
    // La charge utile est INTACTE : le document d'après, dépouillé de la seule clé posée et rendu à
    // son numéro de forme, rend le document d'avant — ordre des clés compris.
    const { usable: _pose, ...sansPose } = entites[0];
    const inverse = { ...migre, schema: 9, scenes: [{ ...scene, entities: [sansPose, entites[1]] }] };
    delete (inverse as Record<string, unknown>).version;
    expect(JSON.stringify(inverse)).toBe(JSON.stringify(PROJET_FORMAT_9));
  });

  it('S2. IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne pose rien de plus', () => {
    const une = PROJECT_MIGRATIONS[9]!({ ...structuredClone(PROJET_FORMAT_9), version: 9 } as never);
    const deux = PROJECT_MIGRATIONS[9]!({ ...structuredClone(une), version: 9 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('SANS le migrateur, le meuble à places serait MUET — la garde le prouve par le dériveur', async () => {
    // Le même document ANNONCÉ au numéro de forme courant ne migre plus : il PASSE le schéma (le
    // champ est optionnel) et c'est l'OFFRE qui disparaît. C'est le numéro de forme qui commande la
    // migration, et c'est `estUtilisable` qui dit ce que le joueur perd.
    const { estUtilisable } = await import('./usable');
    const bricole = { ...structuredClone(PROJET_FORMAT_9), schema: CURRENT_PROJECT_SCHEMA };
    const sansMigration = parseProject(bricole).scenes[0];
    expect(sansMigration.entities![0].usable).toBeUndefined();
    expect(estUtilisable(sansMigration, sansMigration.entities![0])).toBe(false);
    const migre = parseProject(structuredClone(PROJET_FORMAT_9)).scenes[0];
    expect(estUtilisable(migre, migre.entities![0])).toBe(true);
  });
});
