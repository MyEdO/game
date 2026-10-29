import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resolvePsychAI, fireTurnStartTriggers } from './combat/turnHooks';
import { isFrenzied } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Frénésie — immunité psy & fin (→ Exténué)', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi en Frénésie est immunisé à la Terreur (pas de Brisé)', () => {
    banc.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'enorme'; // Terreur 2
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.characteristics['force-mentale'] = 10;
    resolvePsychAI(banc.getState, banc.setState, E);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.conditions.some((c) => c.id === 'brise')).toBe(false);
    expect(e.psychState ?? []).toEqual([{ type: 'frenesie' }]); // aucune Peur ajoutée (immunisé), la Frénésie demeure
  });

  it('la Frénésie finit (Exténué) quand plus aucun ennemi n’est en Ligne de Vue', () => {
    const { H, E } = setup();
    (E.psychState ??= []).push({ type: 'frenesie' });
    (H as Combatant).dead = true; // plus d'ennemi vivant pour E
    // La sortie est un effet DÉCLENCHÉ `onTurnStart` en données (psychology.json) — joué au début du tour.
    fireTurnStartTriggers(banc.getState, banc.setState, E);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(isFrenzied(e)).toBe(false);
    expect(e.conditions.some((c) => c.id === 'extenue')).toBe(true);
  });
});
