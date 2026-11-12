/**
 * Câblage audio de l'hôte : la musique de la partie en campagne seulement (`musicSelectionOf`), et les sons
 * ponctuels (#701) — un Effet de scène `playSfx` appliqué joue son son une fois, par `EVT.SFX` ; un id
 * hors registre ne joue rien ; régler le volume de la musique le réapplique à la piste en cours. ⚠ Suite sous `test.isolate:false` (vite.config.ts) :
 * les sons sont débranchés, `Audio` restauré et le store remis à zéro après chaque test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { brancherLesSons, musicSelectionOf, type MusicStateSlice } from './audioWiring';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { preferenceDef } from '../noyau/preferences';
import { findSonById } from '../data/sons/registre';
import { playMusic } from '../audio/engine';
import { setPreference } from './preferences';

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
  let volumes: number[] = [];
  let realAudio: unknown;
  let debrancher: () => void = () => {};

  beforeEach(() => {
    created = [];
    volumes = [];
    realAudio = (globalThis as { Audio?: unknown }).Audio;
    (globalThis as { Audio?: unknown }).Audio = class {
      constructor(src: string) { created.push(src); }
      set volume(v: number) { volumes.push(v); }
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

  it('un son joue au volume de son canal, lu dans la table des préférences, fois son volume propre', () => {
    const interface_ = preferenceDef('volume-interface')!;
    interface_.set(0.5);
    try {
      applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'piece' }] as Effect[]);
    } finally {
      interface_.set(interface_.default);
    }
    expect(volumes).toEqual([0.5 * (findSonById('piece')!.volume ?? 1)]);
  });

  it('débranché, plus aucun son', () => {
    debrancher();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'porte-ouvre' }] as Effect[]);
    expect(created).toEqual([]);
  });
});

describe('setPreference — le volume de la musique en cours (#3949)', () => {
  const musique = preferenceDef('volume-musique')!;
  let pistes: { volume: number }[] = [];
  let debrancher: () => void = () => {};

  beforeEach(() => {
    pistes = [];
    vi.stubGlobal('Audio', class {
      volume = 1;
      loop = false;
      constructor() { pistes.push(this); }
      // Lecture jamais confirmée : aucun fondu ne vient réécrire le volume.
      play() { return new Promise<void>(() => {}); }
      pause() {}
    });
    vi.stubGlobal('requestAnimationFrame', () => 0);
    debrancher = brancherLesSons();
  });

  afterEach(() => {
    debrancher();
    playMusic(null);
    musique.set(musique.default);
    vi.unstubAllGlobals();
  });

  it('une musique joue : régler son volume porte la piste à ce volume fois son volume propre', () => {
    playMusic({ def: 'musique-combat' });
    expect(pistes).toHaveLength(1);
    setPreference('volume-musique', 0.5);
    expect(pistes[0].volume).toBe(0.5 * (findSonById('musique-combat')!.volume ?? 1));
  });
});
