import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { isFrenzied } from '../engine/psychology';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Entrée en Frénésie du héros — modale (Test de FM)', () => {
  beforeEach(() => {
    banc.setState({ pendingFrenzy: null, battle: null });
  });

  it('battleFrenzy ouvre pendingFrenzy (héros capable, pas déjà frenzied, pas acted)', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    banc.getState().battleFrenzy();
    const pf = banc.getState().pendingFrenzy;
    expect(pf).toBeTruthy();
    expect(pf!.combatantId).toBe(H.id);
    expect(pf!.result).toBeNull();
  });

  it('héros NON capable → battleFrenzy n’ouvre rien', () => {
    heroFaceAUnEnnemi(banc, testScene()); // pas de trait/talent « Frénésie »
    banc.getState().battleFrenzy();
    expect(banc.getState().pendingFrenzy).toBeNull();
  });

  it('héros déjà frenzied → battleFrenzy n’ouvre rien', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    (H.psychState ??= []).push({ type: 'frenesie' });
    banc.getState().battleFrenzy();
    expect(banc.getState().pendingFrenzy).toBeNull();
  });

  it('frenzyRoll lance le Test de FM ; frenzyForceSuccess + frenzyConfirm → frenzied + Action consommée', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    H.resilience = 1; // Résilience pour forcer le succès
    banc.getState().battleFrenzy();
    banc.getState().frenzyRoll();
    const r = banc.getState().pendingFrenzy!.result!;
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
    banc.getState().frenzyForceSuccess(); // garantit le succès (Résilience)
    banc.getState().frenzyConfirm();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(isFrenzied(h)).toBe(true);
    expect(banc.getState().battle!.acted).toBe(true);
    expect(banc.getState().pendingFrenzy).toBeNull();
  });

  it('frenzyConfirm sur échec → pas frenzied mais Action consommée', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    H.characteristics['force-mentale'] = 1; // Test de FM raté quasi sûr
    banc.getState().seedRng(3);
    banc.getState().battleFrenzy();
    banc.getState().frenzyRoll();
    const r = banc.getState().pendingFrenzy!.result!;
    banc.getState().frenzyConfirm();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(isFrenzied(h)).toBe(r.success); // suit le résultat (FM 1 → échec attendu)
    expect(banc.getState().battle!.acted).toBe(true);
  });
});
