/**
 * Résilience « Je ne faillirai pas ! » sur le flux d'INCANTATION — fenêtre PRÉ-JET (`LDB 17 l.68` :
 * « au lieu de lancer les dés pour un Test, vous choisissez le résultat […] Vous pouvez même faire
 * ce choix après un Test qui a échoué »). Sans jet posé, le flux `incantation` résout le geste
 * contre la cible que le jet naturel aurait employée (`castTestTarget`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { bestForcedRoll } from '../engine/tests';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const SPELL = 'armure-aethyrique';

function sorcier(): Combatant {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  w.characteristics = { ...w.characteristics, intelligence: 55 };
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  else w.skills.push({ id: 'langue', spec: 'magick', advances: 10 } as never);
  w.resilience = 2;
  return w;
}

const openCast = (w: Combatant) => {
  banc.setState({ party: [w] });
  banc.getState().incanterLeSort(w.id, SPELL, w.id);
};

beforeEach(() => {
  banc.getState().ensemencerLeTirage(11);
});

describe('Incantation — Résilience AVANT le jet (LDB 17 l.68)', () => {
  it('aucun jet posé : `jetForcerLaReussite@incantation` pose la réussite choisie (dé par défaut) et dépense le Point', () => {
    const w = sorcier();
    openCast(w);
    expect(banc.getState().pendingCast!.result, 'la fenêtre s’ouvre AVANT le jet').toBeNull();
    banc.getState().jetForcerLaReussite('incantation');
    const res = banc.getState().pendingCast!.result!;
    expect(res.cast, 'le sort PART (DR ≥ NI, plancher de la réussite achetée)').toBe(true);
    expect(res.roll, '« vous choisissez le résultat » → le dé par défaut est LE MEILLEUR').toBe(bestForcedRoll(res.target));
    expect(banc.getState().party[0].resilience, 'un Point de Résilience a été dépensé').toBe(1);
  });

  it('la cible du jet FORCÉ pré-jet est celle du jet NATUREL (même Compétence, même ward, même Difficulté)', () => {
    const w = sorcier();
    openCast(w);
    banc.getState().jetLancer('incantation');
    const naturel = banc.getState().pendingCast!.result!.target;

    const w2 = sorcier();
    banc.setState({ pendingCast: null });
    openCast(w2);
    banc.getState().jetForcerLaReussite('incantation');
    expect(banc.getState().pendingCast!.result!.target).toBe(naturel);
  });
});
