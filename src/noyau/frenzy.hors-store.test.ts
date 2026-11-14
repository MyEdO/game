import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { fireTurnStartTriggers } from './combat/turnHooks';
import { openRoundStartPsych } from './combatFlow';
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
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  it('un ennemi en Frénésie est immunisé à la Terreur (pas de Brisé)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.size = 'enorme'; // Terreur 2
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.characteristics['force-mentale'] = 10;
    openRoundStartPsych(banc.getState, banc.setState);
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
