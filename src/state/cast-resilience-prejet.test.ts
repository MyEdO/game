/**
 * Résilience « Je ne faillirai pas ! » sur le flux d'INCANTATION — fenêtre PRÉ-JET (`LDB 17 l.68` :
 * « au lieu de lancer les dés pour un Test, vous choisissez le résultat […] Vous pouvez même faire
 * ce choix après un Test qui a échoué »). Le flux `cast` refusait le geste sans jet posé ; il le
 * résout désormais contre la cible que le jet naturel aurait employée (`castTestTarget`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, PREGEN } from '../data/pregens';
import { bestForcedRoll } from '../engine/tests';
import type { Combatant } from '../engine/types';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const SPELL = 'armure-aethyrique';

function sorcier(): Combatant {
  const w = pregen(idNeufDeBanc, PREGEN.sorcier);
  w.characteristics = { ...w.characteristics, intelligence: 55 };
  const sk = w.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  else w.skills.push({ id: 'langue', spec: 'magick', advances: 10 } as never);
  w.resilience = 2;
  return w;
}

const openCast = (w: Combatant) => {
  useGame.setState({ party: [w] });
  useGame.getState().oocCastSpell(w.id, SPELL, w.id);
};

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingFocus: null });
  useGame.getState().seedRng(11);
});

describe('Incantation — Résilience AVANT le jet (LDB 17 l.68)', () => {
  it('aucun jet posé : `castForceSuccess` pose la réussite choisie (dé par défaut) et dépense le Point', () => {
    const w = sorcier();
    openCast(w);
    expect(useGame.getState().pendingCast!.result, 'la fenêtre s’ouvre AVANT le jet').toBeNull();
    useGame.getState().castForceSuccess();
    const res = useGame.getState().pendingCast!.result!;
    expect(res.cast, 'le sort PART (DR ≥ NI, plancher de la réussite achetée)').toBe(true);
    expect(res.roll, '« vous choisissez le résultat » → le dé par défaut est LE MEILLEUR').toBe(bestForcedRoll(res.target));
    expect(useGame.getState().party[0].resilience, 'un Point de Résilience a été dépensé').toBe(1);
  });

  it('la cible du jet FORCÉ pré-jet est celle du jet NATUREL (même Compétence, même ward, même Difficulté)', () => {
    const w = sorcier();
    openCast(w);
    useGame.getState().castRoll();
    const naturel = useGame.getState().pendingCast!.result!.target;

    const w2 = sorcier();
    useGame.setState({ pendingCast: null });
    openCast(w2);
    useGame.getState().castForceSuccess();
    expect(useGame.getState().pendingCast!.result!.target).toBe(naturel);
  });
});
