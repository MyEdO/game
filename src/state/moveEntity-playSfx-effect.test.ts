/**
 * Effets `moveEntity` et `playSfx` (#701) — mise en scène scriptée : repositionner/retirer une
 * entité de scène posée, jouer un son ponctuel. Handlers du registre `EFFECT_HANDLERS`.
 * ⚠ Suite sous `test.isolate:false` (vite.config.ts) : AUCUN `vi.mock`/`vi.spyOn`, et ce fichier
 * NETTOIE intégralement derrière lui (reset du singleton `useGame`, désabonnement du bus) pour ne
 * PAS fuiter d'état aux fichiers du même worker (sinon un test aval — ex. `campaign-snapshot` — casse).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { applyEffects, CIBLES_D_EFFET_DE_SCENE } from '../noyau/combatEffects';
import { emptyScene } from '../noyau/monde/scene';
import type { Effect } from '../noyau/monde/scene';
import { effectSummary } from '../ui/editor/EffectList';
import { bus, EVT } from '../noyau/bus';

// Reset du store APRÈS CHAQUE test (isolate:false) : rend au singleton `useGame` son état initial,
// pour qu'aucune scène/donnée posée ici ne survive au fichier suivant du worker partagé.
afterEach(() => { useGame.setState(useGame.getInitialState()); });

function sceneWithNpc() {
  const sc = emptyScene(10, 10);
  sc.id = 'move-sfx-scene';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 } });
  return sc;
}

describe('Effet moveEntity (#701)', () => {
  beforeEach(() => { useGame.setState({ scene: sceneWithNpc() }); });

  it('repositionne l’entité vers la case cible', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 5, y: 6 } }] as Effect[]);
    const ent = useGame.getState().scene!.entities.find((e) => e.id === 'pnj')!;
    expect(ent.pos).toEqual({ x: 5, y: 6 });
  });

  it('entité introuvable : no-op (scène inchangée)', () => {
    const before = useGame.getState().scene;
    applyEffects(useGame.getState, useGame.setState, [{ type: 'moveEntity', id: 'fantome', to: { x: 1, y: 1 } }] as Effect[]);
    expect(useGame.getState().scene).toBe(before);
  });

  it('retire l’entité de la scène', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'moveEntity', id: 'pnj', remove: true }] as Effect[]);
    expect(useGame.getState().scene!.entities.find((e) => e.id === 'pnj')).toBeUndefined();
  });

  it('to + remove : repositionnée PUIS retirée (l’entité quitte la scène)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 9, y: 9 }, remove: true }] as Effect[]);
    expect(useGame.getState().scene!.entities.find((e) => e.id === 'pnj')).toBeUndefined();
  });

  it('#803 — `to.z` déplace l’entité vers l’étage 1 (pas le rez)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 5, y: 6, z: 1 } }] as Effect[]);
    const ent = useGame.getState().scene!.entities.find((e) => e.id === 'pnj')!;
    expect(ent.pos).toEqual({ x: 5, y: 6 });
    expect(ent.z).toBe(1);
  });

  it('#803 — `to` sans `z` conserve l’étage courant de l’entité', () => {
    const sc = sceneWithNpc();
    sc.entities[0].z = 1;
    useGame.setState({ scene: sc });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'moveEntity', id: 'pnj', to: { x: 3, y: 3 } }] as Effect[]);
    const ent = useGame.getState().scene!.entities.find((e) => e.id === 'pnj')!;
    expect(ent.z).toBe(1);
  });
});

describe('Effet playSfx (#701)', () => {
  it('émet `EVT.SFX` avec l\'id du son, que l\'hôte joue (`audio/wiring`)', () => {
    const recus: unknown[] = [];
    const off = bus.on(EVT.SFX, (p) => recus.push(p));
    try {
      applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'porte-ouvre' }] as Effect[]);
    } finally {
      off();
    }
    expect(recus).toEqual([{ id: 'porte-ouvre' }]);
  });
});

describe('effectSummary — moveEntity / playSfx', () => {
  it('résume un déplacement', () => {
    expect(effectSummary({ type: 'moveEntity', id: 'garde', to: { x: 3, y: 4 } } as Effect, { cibles: CIBLES_D_EFFET_DE_SCENE })).toMatch(/garde.*3.*4/);
  });

  it('résume un retrait', () => {
    expect(effectSummary({ type: 'moveEntity', id: 'garde', remove: true } as Effect, { cibles: CIBLES_D_EFFET_DE_SCENE })).toMatch(/[Rr]etirer garde/);
  });

  it('résume un son', () => {
    expect(effectSummary({ type: 'playSfx', id: 'gong-victoire' } as Effect, { cibles: CIBLES_D_EFFET_DE_SCENE })).toMatch(/gong-victoire/);
  });
});
