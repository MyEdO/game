import { describe, expect, it } from 'vitest';
import { emptyScene } from './scene';
import { roomTilesById, occupiedRoomIds, roomFocusAt, roomsByTile } from './rooms';
import { sceneEffectZoneSchema } from '../data/schemas/defs-scenes/scene';

describe('roomFocusAt', () => {
  it('active uniquement une zone descriptive intérieure contenant exactement la position au même étage', () => {
    const scene = emptyScene(4, 4);
    scene.effectZones = [
      {
        id: 'interieur',
        label: 'Salle',
        presentation: 'interior',
        area: { kind: 'rect', x: 0, y: 0, w: 3, h: 3 },
        tiles: [{ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 0 }],
        z: 0,
      },
      {
        id: 'cour',
        label: 'Cour',
        presentation: 'exterior',
        area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
        tiles: [{ x: 1, y: 1, z: 0 }],
        z: 0,
      },
    ];

    expect(roomFocusAt(scene, { x: 1, y: 1, z: 0 })).toBeNull();
    expect(roomFocusAt(scene, { x: 2, y: 2, z: 1 })).toBeNull();
    expect(roomFocusAt(scene, { x: 2, y: 2, z: 0 })).toEqual({
      id: 'interieur',
      z: 0,
      tiles: new Set(['0,0,0', '2,2,0']),
    });
  });

  it('ignore les zones mécaniques même marquées intérieur', () => {
    const scene = emptyScene(2, 2);
    scene.effectZones = [{
      id: 'piege',
      label: 'Piège',
      presentation: 'interior',
      area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 },
      tiles: [{ x: 0, y: 0, z: 0 }],
      z: 0,
      blocksLoS: true,
    }];
    expect(roomFocusAt(scene, { x: 0, y: 0, z: 0 })).toBeNull();
  });
});

describe('occupiedRoomIds', () => {
  it('réunit les pièces occupées par plusieurs héros à leurs étages respectifs', () => {
    const scene = emptyScene(10, 4);
    scene.effectZones = [
      { id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 3, h: 2 }, z: 0 },
      { id: 'cuisine', label: 'Cuisine', presentation: 'interior', area: { kind: 'rect', x: 7, y: 1, w: 2, h: 2 }, z: 1 },
    ];

    expect(occupiedRoomIds(scene, [{ x: 2.75, y: 1.2, z: 0 }, { x: 7.1, y: 1.8, z: 1 }]))
      .toEqual(new Set(['salle', 'cuisine']));
  });

  it('n’unit pas les zones d’un autre étage', () => {
    const scene = emptyScene(4, 4);
    scene.effectZones = [
      { id: 'bas', label: 'Bas', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 }, z: 0 },
      { id: 'haut', label: 'Haut', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 }, z: 1 },
    ];

    expect(occupiedRoomIds(scene, [{ x: 1.5, y: 1.5, z: 1 }])).toEqual(new Set(['haut']));
  });

  it.each([
    [2.49, 'gauche'],
    [2.51, 'droite'],
    [2.51, 'droite'],
    [2.49, 'gauche'],
  ])('bascule à la case visuelle arrondie %s', (x, id) => {
    const scene = emptyScene(5, 1);
    scene.effectZones = [
      { id: 'gauche', label: 'Gauche', presentation: 'interior', area: { kind: 'rect', x: 2, y: 0, w: 1, h: 1 }, z: 0 },
      { id: 'droite', label: 'Droite', presentation: 'interior', area: { kind: 'rect', x: 3, y: 0, w: 1, h: 1 }, z: 0 },
    ];

    expect(occupiedRoomIds(scene, [{ x, y: 0, z: 0 }])).toEqual(new Set([id]));
  });
});

describe('chevauchement de pièces', () => {
  const scene = emptyScene(6, 3);
  scene.effectZones = [
    { id: 'nef', label: 'Nef', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 4, h: 3 }, z: 0 },
    { id: 'choeur', label: 'Chœur', presentation: 'interior', area: { kind: 'rect', x: 3, y: 0, w: 3, h: 3 }, z: 0 },
  ];

  it('une case couverte par deux pièces appartient aux deux, dans l’ordre de `scene.effectZones`', () => {
    expect(roomsByTile(scene).get('3,1')?.zoneIds).toEqual(['nef', 'choeur']);
    expect(occupiedRoomIds(scene, [{ x: 3, y: 1, z: 0 }])).toEqual(new Set(['nef', 'choeur']));
  });

  it('le focus rend la première pièce de cet ordre, avec toutes ses cases', () => {
    expect(roomFocusAt(scene, { x: 3, y: 1, z: 0 })).toEqual({
      id: 'nef',
      z: 0,
      tiles: roomTilesById(scene).get('nef'),
    });
    expect(roomFocusAt(scene, { x: 5, y: 1, z: 0 })?.id).toBe('choeur');
  });
});

describe('ÉTAGE — une pièce vit à `zone.z`', () => {
  const zone = (presentation: 'interior' | 'exterior', tileZ: number) => ({
    id: 'salle', label: 'Salle', presentation, area: { kind: 'rect', x: 0, y: 0, w: 2, h: 1 },
    tiles: [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: tileZ }], z: 1,
  });

  it('une case de zone intérieure à un autre étage que `zone.z` est refusée au parse, nommément', () => {
    const r = sceneEffectZoneSchema.safeParse(zone('interior', 0));
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['tiles.1.z', "zone intérieure « salle » : la case (1,0) est à l'étage 0, la pièce à l'étage 1 (`z`) — une pièce vit à un seul étage"],
    ]);
  });

  it('au même étage, ou hors d’une pièce (zone extérieure), la zone est acceptée', () => {
    expect(sceneEffectZoneSchema.safeParse(zone('interior', 1)).success).toBe(true);
    expect(sceneEffectZoneSchema.safeParse(zone('exterior', 0)).success).toBe(true);
  });
});
