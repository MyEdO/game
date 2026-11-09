/**
 * LA HAUTEUR DE L'ŒIL SOUS UN PLAFOND (#3808, `hauteurDeLOeil`) : debout à ciel ouvert, abaissée sous le plancher
 * qui couvre sa case et chaque case où un pas la mène, de la marge ; un mur qui barre le pas ne l'abaisse pas.
 */
import { describe, expect, it } from 'vitest';
import { EYE_H, hauteurDeLOeil, MARGE_SOUS_PLAFOND_M } from './iso';
import { emptyScene, tileAt, type Scene } from './scene';
import { addLayer, paintHeight, paintTiles } from '../sceneEdit';

/** Un couloir de quatre cases au rez, la dernière, (3, 0), couverte d'un plancher à `plancher` m sur la couche 1. */
function couloir(plancher: number): Scene {
  const rez = emptyScene('couloir', 4, 1);
  const etage = paintTiles(addLayer(rez, 1), { x: 3, y: 0 }, tileAt(rez, 3, 0, 0), 1, 1);
  return paintHeight(etage, { x: 3, y: 0 }, plancher, 1, 1);
}

describe('hauteurDeLOeil', () => {
  const plancher = 1.8;
  const sous = plancher - MARGE_SOUS_PLAFOND_M;

  it('sous le plancher, l’œil garde la marge ; la case d’avant s’abaisse de même ; plus loin, et sur le plancher, debout', () => {
    const s = couloir(plancher);
    expect([0, 1, 2, 3].map((x) => hauteurDeLOeil(s, { x, y: 0, z: 0 }))).toEqual([EYE_H, EYE_H, sous, sous]);
    expect(hauteurDeLOeil(s, { x: 3, y: 0, z: 1 })).toBe(EYE_H);
  });

  it('un mur entre la case d’avant et la case couverte ne l’abaisse pas', () => {
    const s = { ...couloir(plancher), walls: [{ x: 2, y: 0, side: 'E' as const }] };
    expect(hauteurDeLOeil(s, { x: 2, y: 0, z: 0 })).toBe(EYE_H);
    expect(hauteurDeLOeil(s, { x: 3, y: 0, z: 0 })).toBe(sous);
  });

  it('un plancher assez haut laisse l’œil debout', () => {
    expect(hauteurDeLOeil(couloir(EYE_H + MARGE_SOUS_PLAFOND_M), { x: 3, y: 0, z: 0 })).toBe(EYE_H);
  });
});
