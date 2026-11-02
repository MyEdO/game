import { describe, it, expect } from 'vitest';
import { sourcesEnVue } from './porteurs';
import { emptyScene, type Scene } from './scene';
import { parseWalledAscii } from './asciiMap';
import type { BattleState } from '../etat';
import { combattantDeTest } from '../../engine/combattantDeTest.testkit';

/** Couloir de 3 cases, un mur plein entre la 2ᵉ et la 3ᵉ. */
const COULOIR = ['+-+-+-+', '|. .|.|', '+-+-+-+'];
const couloir = (): Scene => {
  const { w, h, tiles, walls } = parseWalledAscii(COULOIR, 'plancher', {});
  return { ...emptyScene('scene-test', w, h), layers: [{ z: 0, tiles }], walls } as unknown as Scene;
};

describe('sourcesEnVue — les combattants en Ligne de Vue du porteur', () => {
  const porteur = combattantDeTest({ id: 'p', pos: { x: 0, y: 0 } });
  const voisin = combattantDeTest({ id: 'v', pos: { x: 1, y: 0 } });
  const derriere = combattantDeTest({ id: 'm', pos: { x: 2, y: 0 } });
  const horsCarte = combattantDeTest({ id: 'h' });
  const mort = combattantDeTest({ id: 'x', pos: { x: 1, y: 0 }, dead: true });
  const battle = { combatants: [porteur, voisin, derriere, horsCarte, mort], zones: [] } as unknown as BattleState;

  it('le porteur exclu, le mur coupe la vue, sans position rien n’est en vue ; hors d’action compris', () => {
    expect([...sourcesEnVue(battle, couloir(), porteur)].map((c) => c.id)).toEqual(['v', 'x']);
  });

  it('un porteur sans position ne voit personne', () => {
    expect([...sourcesEnVue(battle, couloir(), horsCarte)]).toEqual([]);
  });

  it('une zone de fumée opaque coupe la vue ; un feu transparent, non', () => {
    const OUVERT = ['+-+-+-+-+', '|. . . .|', '+-+-+-+-+'];
    const { w, h, tiles, walls } = parseWalledAscii(OUVERT, 'plancher', {});
    const plaine = { ...emptyScene('scene-test', w, h), layers: [{ z: 0, tiles }], walls } as unknown as Scene;
    const loin = combattantDeTest({ id: 'l', pos: { x: 3, y: 0 } });
    const sous = (zone: object) => ({ combatants: [porteur, loin], zones: [{ label: 'Z', tiles: [{ x: 1, y: 0 }, { x: 2, y: 0 }], rounds: 2, ...zone }] }) as unknown as BattleState;
    expect([...sourcesEnVue(sous({ blocksLoS: true }), plaine, porteur)]).toEqual([]);
    expect([...sourcesEnVue(sous({}), plaine, porteur)].map((c) => c.id)).toEqual(['l']);
  });
});
