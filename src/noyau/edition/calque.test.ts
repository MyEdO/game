/**
 * Le calque de référence d'une couche (#3508) : son plan, la hauteur la plus fréquente de sa couche ; ses coins sur la
 * carte ; les calques que l'hôte garde, relus seulement du format courant.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene } from '../monde/scene';
import { addLayer } from '../sceneEdit';
import { calqueNeuf, calquesAStocker, calquesLus, coinsDuCalque, planDuCalque } from './calque';

describe('le calque de référence', () => {
  it('son plan est la hauteur la plus fréquente de sa couche, la plus basse à égalité', () => {
    const scene = addLayer(emptyScene('calque', 4, 2), 1);
    const etage = scene.layers.find((l) => l.z === 1)!;
    const etagee = { ...scene, layers: [scene.layers[0], { ...etage, height: [4, 4, 4, 0, 0, 2, 4, 0] }] };
    expect([planDuCalque(etagee, 0), planDuCalque(etagee, 1)]).toEqual([0, 4]);
    const egalite = { ...scene, layers: [scene.layers[0], { ...etage, height: [3, 3, 1, 1, 5, 6, 7, 8] }] };
    expect(planDuCalque(egalite, 1)).toBe(1);
  });

  it('neuf, l’image entière sur la carte, son coin haut-gauche au coin de la case 0, 0, sans déformation', () => {
    expect(coinsDuCalque(calqueNeuf(emptyScene('calque', 10, 4), 200, 100))).toEqual([
      { x: -0.5, y: -0.5 }, { x: 7.5, y: -0.5 }, { x: 7.5, y: 3.5 }, { x: -0.5, y: 3.5 },
    ]);
  });

  it('les calques gardés se relisent du format courant seulement, entiers', () => {
    const calques = { scene: { 1: calqueNeuf(emptyScene('calque', 10, 4), 200, 100) } };
    const gardes = JSON.parse(JSON.stringify(calquesAStocker(calques)));
    expect(calquesLus(gardes)).toEqual(calques);
    expect(calquesLus({ ...gardes, version: 'ancien' })).toBeNull();
    expect(calquesLus({ ...gardes, calques: { scene: { haut: calques.scene[1] } } }), 'une couche qui n’est pas un entier').toBeNull();
    expect(calquesLus({ ...gardes, calques: { scene: { 1: { ...calques.scene[1], opacite: 2 } } } })).toBeNull();
  });
});
