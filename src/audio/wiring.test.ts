/**
 * Câblage des sons ponctuels (#701) : un Effet de scène `playSfx` appliqué joue son son une fois, par
 * `EVT.SFX` ; un id hors registre ne joue rien. ⚠ Suite sous `test.isolate:false` (vite.config.ts) :
 * les sons sont débranchés, `Audio` restauré et le store remis à zéro après chaque test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { brancherLesSons } from './wiring';
import { useGame } from '../state/store';
import { applyEffects } from '../state/combatEffects';
import type { Effect } from '../noyau/monde/scene';

describe('brancherLesSons — Effet playSfx (#701)', () => {
  let created: string[] = [];
  let realAudio: unknown;
  let debrancher: () => void = () => {};

  beforeEach(() => {
    created = [];
    realAudio = (globalThis as { Audio?: unknown }).Audio;
    (globalThis as { Audio?: unknown }).Audio = class {
      volume = 1;
      constructor(src: string) { created.push(src); }
      play() { return Promise.resolve(); }
    };
    debrancher = brancherLesSons();
  });

  afterEach(() => {
    debrancher();
    if (realAudio === undefined) delete (globalThis as { Audio?: unknown }).Audio;
    else (globalThis as { Audio?: unknown }).Audio = realAudio;
    useGame.setState(useGame.getInitialState());
  });

  it('joue le son du registre, une seule fois', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'porte-ouvre' }] as Effect[]);
    expect(created).toHaveLength(1);
    expect(created[0]).toContain('porte-ouvre');
  });

  it('id hors registre : aucune lecture', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'inexistant-xyz' }] as Effect[]);
    expect(created).toEqual([]);
  });

  it('débranché, plus aucun son', () => {
    debrancher();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'porte-ouvre' }] as Effect[]);
    expect(created).toEqual([]);
  });
});
