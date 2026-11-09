/**
 * Effets `moveEntity` et `playSfx` (#701) — mise en scène scriptée : repositionner/retirer une
 * entité de scène posée, jouer un son ponctuel. Handlers du registre `EFFECT_HANDLERS`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyEffects } from './combatEffects';
import { emptyScene } from './monde/scene';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { bus, EVT } from './bus';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

function sceneWithNpc() {
  const sc = emptyScene('scene-test', 10, 10);
  sc.id = 'move-sfx-scene';
  sc.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 2 } });
  return sc;
}

describe('Effet moveEntity (#701)', () => {
  beforeEach(() => { banc.setState({ scene: sceneWithNpc() }); });

  it('repositionne l’entité vers la case cible', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 5, y: 6 } }] as Effect[]);
    const ent = banc.getState().scene!.entities.find((e) => e.id === 'pnj')!;
    expect(ent.pos).toEqual({ x: 5, y: 6 });
  });

  it('entité introuvable : no-op (scène inchangée)', () => {
    const before = banc.getState().scene;
    applyEffects(banc.getState, banc.setState, [{ type: 'moveEntity', id: 'fantome', to: { x: 1, y: 1 } }] as Effect[]);
    expect(banc.getState().scene).toBe(before);
  });

  it('retire l’entité de la scène', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'moveEntity', id: 'pnj', remove: true }] as Effect[]);
    expect(banc.getState().scene!.entities.find((e) => e.id === 'pnj')).toBeUndefined();
  });

  it('to + remove : repositionnée PUIS retirée (l’entité quitte la scène)', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 9, y: 9 }, remove: true }] as Effect[]);
    expect(banc.getState().scene!.entities.find((e) => e.id === 'pnj')).toBeUndefined();
  });

  it('#803 — `to.z` déplace l’entité vers l’étage 1 (pas le rez)', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 5, y: 6, z: 1 } }] as Effect[]);
    const ent = banc.getState().scene!.entities.find((e) => e.id === 'pnj')!;
    expect(ent.pos).toEqual({ x: 5, y: 6 });
    expect(ent.z).toBe(1);
  });

  it('#803 — `to` sans `z` conserve l’étage courant de l’entité', () => {
    const sc = sceneWithNpc();
    sc.entities[0].z = 1;
    banc.setState({ scene: sc });
    applyEffects(banc.getState, banc.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 3, y: 3 } }] as Effect[]);
    const ent = banc.getState().scene!.entities.find((e) => e.id === 'pnj')!;
    expect(ent.z).toBe(1);
  });
});

describe('Effet playSfx (#701)', () => {
  it('émet `EVT.SFX` avec l\'id du son, que l\'hôte joue', () => {
    const recus: unknown[] = [];
    const off = bus.on(EVT.SFX, (p) => recus.push(p));
    try {
      applyEffects(banc.getState, banc.setState, [{ type: 'playSfx', id: 'porte-ouvre' }] as Effect[]);
    } finally {
      off();
    }
    expect(recus).toEqual([{ id: 'porte-ouvre' }]);
  });
});

