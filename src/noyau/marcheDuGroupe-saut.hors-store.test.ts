/**
 * Le SAUT du groupe en exploration (`sauter`, `marcheDuGroupe.ts`) : `LDB 15 l.76`. Saut libre à Mouvement/3 m, au-delà
 * le Test de la fiche `saut`, et le refus nommé d'un saut qui ne part pas du groupe ou ne mène nulle part.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { t } from '../i18n';
import type { Terrain } from '../data/schemas/defs-scenes/scene';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Deux plateformes à 4 m (couche 1) séparées d'un gouffre en x=2, un parterre marchable dessous (couche 0). */
function gouffre(): Scene {
  const s = emptyScene('scene-saut', 7, 3);
  const z1 = new Array(21).fill('vide') as Terrain[];
  const h1 = new Array(21).fill(0) as number[];
  for (const x of [0, 1, 3, 4, 5, 6]) for (let y = 0; y < 3; y++) { z1[y * 7 + x] = 'plancher'; h1[y * 7 + x] = 4; }
  s.layers.push({ z: 1, tiles: z1, height: h1 });
  return s;
}

/** Le groupe d'un héros de Mouvement `m`, en exploration sur le bord du gouffre (1, 1, étage 1). */
function auBord(m: number) {
  const heros = combattantDeTest({ id: 'h', label: 'H', kind: 'heros', movement: m });
  banc.setState({ mode: 'exploration', scene: gouffre(), party: [heros], partyPos: { x: 1, y: 1, z: 1 }, dialogue: null, battle: null } as never);
}
const depart = { x: 1, y: 1, z: 1 };
const derniereLigne = () => banc.getState().journal[banc.getState().journal.length - 1];

describe('sauter — LDB 15 l.76', () => {
  it('dans la portée libre (Mouvement/3 m) : le groupe franchit d’office, sans Test', () => {
    auBord(12);
    const arrivee = { x: 3, y: 1, z: 1 };
    expect(banc.getState().sauter([depart, arrivee], 1)).toBe(true);
    expect(banc.getState().partyPos).toMatchObject(arrivee);
  });

  it('au-delà de la portée libre : le groupe atterrit, et le Test d’Athlétisme se joue (le pas suivant attend)', () => {
    auBord(6);
    const arrivee = { x: 3, y: 1, z: 1 };
    expect(banc.getState().sauter([depart, arrivee], 1)).toBe(false);
    expect(banc.getState().partyPos).toMatchObject({ x: 3, y: 1 });
  });

  it('un saut qui ne part pas de la case du groupe se refuse, et le dit', () => {
    auBord(12);
    expect(banc.getState().sauter([{ x: 0, y: 1, z: 1 }, { x: 3, y: 1, z: 1 }], 1)).toBe(false);
    expect(banc.getState().partyPos).toMatchObject(depart);
    expect(derniereLigne()).toBe(t('saut.horsDuGroupe'));
  });

  it('un atterrissage hors de la portée tentable se refuse, et le dit', () => {
    auBord(6);
    expect(banc.getState().sauter([depart, { x: 4, y: 1, z: 1 }], 1)).toBe(false);
    expect(banc.getState().partyPos).toMatchObject(depart);
    expect(derniereLigne()).toBe(t('saut.horsDePortee'));
  });
});
