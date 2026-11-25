/** L'opacité des arêtes sur la carte livrée de La Diligence (`src/scenes/arete-opacite.test.ts` pour les contrats). */
import { describe, it, expect } from 'vitest';
import { wallBetween, wallOnSight, type Scene } from '../../../src/noyau/monde/scene';
import { couvertDArete } from '../../../src/noyau/monde/lineOfSight';
import { cranDeCouvertEnMoins } from '../../../src/engine/cover';
import { findStructureById } from '../../../src/data';
import { paquetDuJeu } from '../../../src/noyau/index';
import { diligenceCampaign } from '../campagnes';

/**
 * LES SIX SÉPARATIONS DE BOX DES ÉCURIES (migration 2026-09-04) — ce que change RÉELLEMENT le passage
 * de `mur-a-ossature-en-bois` à `cloture-en-clayonnage` sur la carte livrée. Le profil AA se prend en
 * ENTIER : l'opacité tombe, mais le couvert et la solidité tombent AUSSI. Ce banc les mesure sur la
 * scène réelle et les compare à la structure d'avant, pour qu'aucun des quatre deltas ne passe muet.
 */
describe('La Diligence — les six box migrées prennent le profil AA du clayonnage EN ENTIER', () => {
  const BOX = [
    { x: 27, y: 37 }, { x: 27, y: 38 }, { x: 29, y: 35 },
    { x: 29, y: 36 }, { x: 31, y: 35 }, { x: 31, y: 36 },
  ];
  const scene = paquetDuJeu(diligenceCampaign).scenes[0];
  const segDe = ({ x, y }: { x: number; y: number }) =>
    scene.walls!.find((w) => w.x === x && w.y === y && w.side === 'E' && (w.z ?? 0) === 0)!;

  it('les six arêtes portent le clayonnage, et son profil AA est bien celui d’AA 10 l.41', () => {
    expect(BOX.map((b) => segDe(b)?.structure)).toEqual(new Array(6).fill('cloture-en-clayonnage'));
    const clay = findStructureById('cloture-en-clayonnage')!;
    expect({ char: clay.char, couvertPenalty: clay.couvertPenalty, encLimit: clay.encLimit, occulte: clay.occulte })
      .toEqual({ char: { BE: 2, B: 10 }, couvertPenalty: 'intermediaire', encLimit: undefined, occulte: false });
  });

  it('le couvert se PERD : la cible derrière une de ces arêtes n’est plus abritée, et la vue passe', () => {
    // Tireur et cible de part et d'autre de l'arête (29,35,E) — le couple exact que l'arête sépare.
    const from = { x: 29, y: 35 };
    const to = { x: 30, y: 35 };
    expect(couvertDArete(scene, { pos: from }, { pos: to }, cranDeCouvertEnMoins)).toBe('none');
    expect(wallOnSight(scene, from, to, 0)).toBe(false);
  });

  it('AVANT la migration, la même arête abritait la cible ET coupait la vue (delta mesuré, pas supposé)', () => {
    const avant: Scene = {
      ...scene,
      walls: scene.walls!.map((w) =>
        BOX.some((b) => b.x === w.x && b.y === w.y) && w.side === 'E' && (w.z ?? 0) === 0
          ? { ...w, structure: 'mur-a-ossature-en-bois' }
          : w),
    };
    const from = { x: 29, y: 35 };
    const to = { x: 30, y: 35 };
    expect(couvertDArete(avant, { pos: from }, { pos: to }, cranDeCouvertEnMoins)).toBe('imparfaite');
    expect(wallOnSight(avant, from, to, 0)).toBe(true);
    // Et la Structure d'avant était deux fois plus solide, avec une Limite d'Encombrement.
    const mur = findStructureById('mur-a-ossature-en-bois')!;
    expect({ char: mur.char, encLimit: mur.encLimit }).toEqual({ char: { BE: 4, B: 20 }, encLimit: 30 });
  });

  it('le PASSAGE, lui, est le même des deux côtés de la migration', () => {
    expect(wallBetween(scene, 29, 35, 30, 35, 0)).toBe(true);
  });
});
