/**
 * Effets `moveEntity` et `playSfx` (#701) — mise en scène scriptée : repositionner/retirer une
 * entité de scène posée, jouer un son ponctuel. Handlers du registre `EFFECT_HANDLERS`.
 * ⚠ Suite sous `test.isolate:false` (vite.config.ts) : AUCUN `vi.mock`/`vi.spyOn`, et ce fichier
 * NETTOIE intégralement derrière lui (reset du singleton `useGame`, restauration d'`Audio`) pour ne
 * PAS fuiter d'état aux fichiers du même worker (sinon un test aval — ex. `campaign-snapshot` — casse).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { applyEffects, CIBLES_D_EFFET_DE_SCENE } from './combatEffects';
import { emptyScene } from './scene';
import type { Effect } from './scene';
import { effectSummary } from '../ui/editor/EffectList';

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
  let created: string[] = [];
  let realAudio: unknown;

  beforeEach(() => {
    useGame.setState({ scene: sceneWithNpc() });
    created = [];
    // Capture juste AVANT de remplacer (et non au chargement du module) : la restauration rend
    // toujours la valeur d'`Audio` d'avant CE test, quel que soit l'ordre des fichiers du worker.
    realAudio = (globalThis as { Audio?: unknown }).Audio;
    (globalThis as { Audio?: unknown }).Audio = class {
      volume = 1;
      constructor(src: string) { created.push(src); }
      play() { return Promise.resolve(); }
    };
  });

  afterEach(() => {
    if (realAudio === undefined) delete (globalThis as { Audio?: unknown }).Audio;
    else (globalThis as { Audio?: unknown }).Audio = realAudio;
  });

  it('joue réellement le son du registre par son id (câblage sur audio/engine.playSfx)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'porte-ouvre' }] as Effect[]);
    expect(created.some((src) => src.includes('porte-ouvre'))).toBe(true);
  });

  it('id hors registre : aucune lecture (no-op silencieux)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'playSfx', id: 'inexistant-xyz' }] as Effect[]);
    expect(created).toEqual([]);
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
