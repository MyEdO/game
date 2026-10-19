/**
 * Le passage au Round suivant (pause d'initiative `pendingRoundStart`, LDB 17 l.25) doit être
 * jouable au CLAVIER/MANETTE — sinon un joueur sans souris reste bloqué à chaque frontière de Round.
 * Le binding `round-start` (Espace/Entrée, partagé par la manette via runBindingById) appelle
 * `confirmRoundStart` en solo, et n'est actif QUE pendant la pause.
 */
import { describe, it, expect } from 'vitest';
import { KEYBINDINGS, runBindingById } from './clavier/keybindings';
import type { GameState } from './store';

const binding = () => KEYBINDINGS.find((k) => k.id === 'round-start')!;

/** État minimal (combat en cours) — `pendingRoundStart` posé ou non selon le cas. */
const fake = (over: Partial<GameState> = {}): GameState =>
  ({ mode: 'battle', battle: { over: null }, pendingRoundStart: null, net: { mode: 'local', mySeat: 0 }, ...over }) as never;

describe('binding round-start', () => {
  it('existe et est inactif HORS pause', () => {
    const b = binding();
    expect(b).toBeTruthy();
    expect(b.when(fake({ pendingRoundStart: null }))).toBe(false);
  });

  it('est actif pendant la pause (solo)', () => {
    expect(binding().when(fake({ pendingRoundStart: { round: 2 } as never }))).toBe(true);
  });

  it('run appelle confirmRoundStart en solo', () => {
    let called = 0;
    const get = () => fake({ pendingRoundStart: { round: 2 } as never, confirmRoundStart: () => { called++; } } as never);
    binding().run(get);
    expect(called).toBe(1);
  });

  it('inactif hors combat (pas de battle)', () => {
    expect(binding().when(fake({ mode: 'exploration', battle: null }))).toBe(false);
  });

  it('runBindingById n’exécute PAS round-start sans pause', () => {
    let called = 0;
    const get = () => fake({ pendingRoundStart: null, confirmRoundStart: () => { called++; } } as never);
    runBindingById('round-start', get);
    expect(called).toBe(0);
  });

  it('INACTIF quand une visée Tir rapide est armée (Entrée doit TIRER via le curseur, pas « commencer »)', () => {
    expect(binding().when(fake({ pendingRoundStart: { round: 2 } as never, preemptAiming: 'h1' }))).toBe(false);
  });

  it('le binding clavier de Tir rapide (`preempt-arm`, touche T) existe', () => {
    expect(KEYBINDINGS.find((k) => k.id === 'preempt-arm')).toBeTruthy();
  });
});
