/**
 * Câblage audio de l'hôte : la musique de la partie en campagne seulement (`musicSelectionOf`), et les sons
 * ponctuels (#701) — un Effet de scène `playSfx` appliqué joue son son une fois, par `EVT.SFX` ; un id
 * hors registre ne joue rien. ⚠ Suite sous `test.isolate:false` (vite.config.ts) :
 * les sons sont débranchés, `Audio` restauré et le store remis à zéro après chaque test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { brancherLesSons, musicSelectionOf, type MusicStateSlice } from './audioWiring';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import type { Effect } from '../data/schemas/defs-scenes/effets';

const at = (over: Partial<MusicStateSlice>): MusicStateSlice => ({
  screen: 'campaign',
  mode: 'exploration',
  battle: null,
  scene: { ambiance: 'exterieur' },
  ...over,
});

describe('musicSelectionOf — la musique de la partie (`selectionDeLaMusique`), en campagne seulement', () => {
  it('en campagne, celle de la partie', () => {
    expect(musicSelectionOf(at({ mode: 'battle', battle: {} }))).toEqual({ ctx: 'combat' });
  });
  it('écrans hors campagne → SILENCE (seul l\'écran de jeu expose les contrôles audio — on n\'impose pas une musique incoupable)', () => {
    for (const screen of ['menu', 'party', 'creator', 'coop', 'test', 'interlude', 'editor'] as const) {
      expect(musicSelectionOf(at({ screen, scene: null }))).toBe(null);
    }
  });
});

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
