/**
 * L'empreinte d'un décor vient de son TYPE (catalogue `props.json`), jamais d'un `foot` d'instance : la charrette
 * couvre ses deux cases, et chaque instance de l'Opéra garde l'empreinte que le catalogue lui donne au cap et à
 * l'échelle de sa scène (`empreinteDuProp`, #1509). Chaque projet le vérifie sur ses paquets dans sa suite.
 */
import { describe, it, expect } from 'vitest';
import { findPropById } from '../../data/index';
import { empreinteDuProp } from '../../data/schemas/props.types';
import { normalizeScene, emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import { entityBlockedAt } from '../../noyau/monde/sceneRules';
import { buildOperaFloorplan } from './floorplan';
import { scenarioEntities } from './furnished';

/** Empreinte EFFECTIVE d'une instance de l'Opéra : sa ref et les cases que le catalogue lui donne AU CAP ET À
 *  L'ÉCHELLE de la scène — `foot` déclaré pour un billboard, corps tourné pour un décor à recette (`empreinteDuProp`).
 *  Lire le seul `foot` rendrait 1×1 pour les trois tables. */
function empreinteOpera(id: string): [string, number, number] {
  const ent = scenarioEntities().find((e) => e.id === id)!;
  const { w, h } = empreinteDuProp(findPropById(ent.decor?.id), ent.facing, sceneMetresPerTile(buildOperaFloorplan()));
  return [ent.decor!.id, w, h];
}

const sceneWithEntity = (ent: SceneEntity): Scene => ({ ...emptyScene('scene-test', 8, 8), entities: [ent] });

describe('l’empreinte d’un décor vient de son type', () => {
  it('la physique d’un décor vient de son TYPE : la charrette couvre ses deux cases', () => {
    const scene = normalizeScene(sceneWithEntity({ id: 'c', kind: 'prop', pos: { x: 2, y: 2 }, decor: { id: 'charrette' } }));
    expect(entityBlockedAt(scene, scene.entities[0].pos.x + 1, scene.entities[0].pos.y, 0)).toBe(true);
    expect(entityBlockedAt(scene, scene.entities[0].pos.x + 2, scene.entities[0].pos.y, 0)).toBe(false);
  });

  it('chaque instance de l’Opéra garde l’empreinte effective de son type', () => {
    const ids = ['rideau-0', 'rideau-1', 'rideau-2', 'rideau-3', 'rideau-4', 'rideau-5', 'sv-table', 'reg15-bureau', 'b22-bureau', 'b23-bureau', 'c25-table-1', 'c25-table-2', 'c26-etabli'];
    expect(ids.map((id) => [id, ...empreinteOpera(id)])).toEqual([
      ['rideau-0', 'rideau-scene', 3, 1],
      ['rideau-1', 'rideau-scene', 3, 1],
      ['rideau-2', 'rideau-scene', 3, 1],
      ['rideau-3', 'rideau-scene', 3, 1],
      ['rideau-4', 'rideau-scene', 3, 1],
      ['rideau-5', 'rideau-scene', 3, 1],
      ['sv-table', 'table-2x1', 2, 1],
      ['reg15-bureau', 'bureau-2x1', 2, 1],
      ['b22-bureau', 'bureau-2x1', 2, 1],
      ['b23-bureau', 'bureau-2x1', 2, 1],
      ['c25-table-1', 'table-2x1', 2, 1],
      ['c25-table-2', 'table-2x1', 2, 1],
      ['c26-etabli', 'etabli-2x1', 2, 1],
    ]);
    expect(empreinteOpera('salon-d-table')).toEqual(['table', 1, 1]);
    expect(empreinteOpera('salon-s-table')).toEqual(['table', 1, 1]);
  });

  it('aucune instance de l’Opéra ne porte d’empreinte propre', () => {
    expect(scenarioEntities().filter((e) => 'foot' in e).map((e) => e.id)).toEqual([]);
  });
});
