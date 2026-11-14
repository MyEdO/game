/**
 * LE GABARIT DE ZONE SOUS LE CURSEUR au noyau (#3059) : `zoneSousLeCurseur` rend le rayon et la validité de la pose —
 * zone EN POSE (`placingZoneOf`) ou aperçu du sort de ZdE sélectionné — que le gabarit du plateau peint.
 * Portée et Ligne de Vue : LDB 46 l.121.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { zoneSousLeCurseur } from './combatFlow';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0 (gabarit de `cast-los.hors-store.test.ts`). */
function wallScene() {
  const w = 20, h = 8;
  const tiles: string[] = new Array(w * h).fill('herbe');
  for (let y = 1; y < h; y++) tiles[y * w + 10] = 'mur';
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
}

/** Lanceuse en (2,0), Force Mentale `fm`, au tour de jeu ; `explosion` sélectionnée, sans modale. */
function poser(fm: number, battle: Record<string, unknown> = {}): Combatant {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  w.pos = { x: 2, y: 0 };
  w.characteristics['force-mentale'] = fm;
  const e = spawnEnemy({ ref: 'humain' }, 'e-1', { x: 16, y: 0 });
  banc.setState({
    mode: 'battle', scene: wallScene(), party: [], pendingCast: null, pendingSiegeAim: null,
    battle: {
      combatants: [w, e], order: [w.id, 'e-1'], baseOrder: [w.id, 'e-1'], turn: 0, round: 1,
      action: 'incantation', selectedSpellId: 'explosion', reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
      ...battle,
    } as never,
  });
  return w;
}

const sous = (x: number, y: number) => zoneSousLeCurseur(banc.getState, { x, y });

describe('zoneSousLeCurseur — zone en pose (pilonnage)', () => {
  it('portée chiffrée depuis le servant : en deçà valide, au-delà invalide', () => {
    const w = poser(40, { action: null, selectedSpellId: null });
    banc.setState({ pendingSiegeAim: { gunnerId: w.id, weaponUid: 'canon', radius: 2, rangeTiles: 5 } });
    expect(sous(7, 0)).toEqual({ radius: 2, valide: true });
    expect(sous(8, 0)).toEqual({ radius: 2, valide: false });
  });

  it('sans cap de portée, seule la Ligne de Vue compte', () => {
    const w = poser(40, { action: null, selectedSpellId: null });
    banc.setState({ pendingSiegeAim: { gunnerId: w.id, weaponUid: 'canon', radius: 1, rangeTiles: null } });
    expect(sous(16, 0)).toEqual({ radius: 1, valide: true });
    expect(sous(16, 4)).toEqual({ radius: 1, valide: false });
  });
});

describe('zoneSousLeCurseur — aperçu du sort de ZdE sélectionné', () => {
  it('à portée et en vue : valide ; derrière le mur : invalide', () => {
    poser(40);
    expect(sous(16, 0)).toEqual({ radius: 1, valide: true });
    expect(sous(16, 4)).toEqual({ radius: 1, valide: false });
  });

  it('hors de portée (Force Mentale 20) : invalide', () => {
    poser(20);
    expect(sous(12, 0)).toEqual({ radius: 0, valide: true });
    expect(sous(13, 0)).toEqual({ radius: 0, valide: false });
  });

  it('aucun gabarit : modale ouverte, hors combat, autre action, ou tour d’un non-héros', () => {
    poser(40);
    banc.setState({ pendingCast: {} as never });
    expect(sous(4, 0)).toBeNull();
    poser(40);
    banc.setState({ mode: 'exploration' });
    expect(sous(4, 0)).toBeNull();
    poser(40, { action: 'attack' });
    expect(sous(4, 0)).toBeNull();
    poser(40, { turn: 1 });
    expect(sous(4, 0)).toBeNull();
  });
});
