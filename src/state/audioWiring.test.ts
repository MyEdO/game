/**
 * Câblage audio de l'hôte : la sélection musicale depuis l'état (`musicSelectionOf`), et les sons
 * ponctuels (#701) — un Effet de scène `playSfx` appliqué joue son son une fois, par `EVT.SFX` ; un id
 * hors registre ne joue rien. ⚠ Suite sous `test.isolate:false` (vite.config.ts) :
 * les sons sont débranchés, `Audio` restauré et le store remis à zéro après chaque test.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { brancherLesSons, musicSelectionOf, type MusicStateSlice } from './audioWiring';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import type { Effect } from '../noyau/monde/scene';

const at = (over: Partial<MusicStateSlice>): MusicStateSlice => ({
  screen: 'campaign',
  mode: 'exploration',
  battle: null,
  scene: { ambiance: 'exterieur' },
  ...over,
});

describe('musicSelectionOf — résolution de la musique (scène > contexte)', () => {
  it('combat en campagne → contexte combat', () => {
    expect(musicSelectionOf(at({ mode: 'battle', battle: {} }))).toEqual({ ctx: 'combat' });
  });
  it('exploration en intérieur → contexte interieur', () => {
    expect(musicSelectionOf(at({ scene: { ambiance: 'interieur' } }))).toEqual({ ctx: 'interieur' });
  });
  it('exploration en extérieur → contexte exploration', () => {
    expect(musicSelectionOf(at({}))).toEqual({ ctx: 'exploration' });
  });
  it('écrans hors campagne → SILENCE (seul l\'écran de jeu expose les contrôles audio — on n\'impose pas une musique incoupable)', () => {
    for (const screen of ['menu', 'party', 'creator', 'coop', 'test', 'interlude', 'editor'] as const) {
      expect(musicSelectionOf(at({ screen, scene: null }))).toBe(null);
    }
  });
  it("la scène impose sa piste d'ambiance (paramétrée dans l'éditeur)", () => {
    expect(musicSelectionOf(at({ scene: { ambiance: 'exterieur', music: { ambient: 'musique-taverne' } } })))
      .toEqual({ def: 'musique-taverne' });
  });
  it('la scène impose sa piste de combat', () => {
    expect(musicSelectionOf(at({ mode: 'battle', battle: {}, scene: { ambiance: 'exterieur', music: { combat: 'musique-ville' } } })))
      .toEqual({ def: 'musique-ville' });
  });
  it('la scène peut forcer le silence (null) — ambiance et combat indépendants', () => {
    const scene = { ambiance: 'exterieur' as const, music: { ambient: null } };
    expect(musicSelectionOf(at({ scene }))).toBe(null);
    // combat non précisé sur cette scène → repli contexte combat
    expect(musicSelectionOf(at({ mode: 'battle', battle: {}, scene }))).toEqual({ ctx: 'combat' });
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
