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

  it('entrerEnFrenesie ouvre pendingFrenzy (héros capable, pas déjà frenzied, pas acted)', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    banc.getState().entrerEnFrenesie();
    const pf = banc.getState().pendingFrenzy;
    expect(pf).toBeTruthy();
    expect(pf!.combatantId).toBe(H.id);
    expect(pf!.result).toBeNull();
  });

  it('héros NON capable → entrerEnFrenesie n’ouvre rien', () => {
    heroFaceAUnEnnemi(banc, testScene()); // pas de trait/talent « Frénésie »
    banc.getState().entrerEnFrenesie();
    expect(banc.getState().pendingFrenzy).toBeNull();
  });

  it('héros déjà frenzied → entrerEnFrenesie n’ouvre rien', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    (H.psychState ??= []).push({ type: 'frenesie' });
    banc.getState().entrerEnFrenesie();
    expect(banc.getState().pendingFrenzy).toBeNull();
  });

  it('jetLancer@frenesie lance le Test de FM ; jetForcerLaReussite@frenesie + jetValider@frenesie → frenzied + Action consommée', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    H.resilience = 1; // Résilience pour forcer le succès
    banc.getState().entrerEnFrenesie();
    banc.getState().jetLancer('frenesie');
    const r = banc.getState().pendingFrenzy!.result!;
    expect(typeof r.success).toBe('boolean');
    expect(typeof r.roll).toBe('number');
    banc.getState().jetForcerLaReussite('frenesie'); // garantit le succès (Résilience)
    banc.getState().jetValider('frenesie');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(isFrenzied(h)).toBe(true);
    expect(banc.getState().battle!.acted).toBe(true);
    expect(banc.getState().pendingFrenzy).toBeNull();
  });

  it('jetValider@frenesie avant le jet : la clôture est fermée (`jetNonLance`), rien ne bouge', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    banc.getState().entrerEnFrenesie();
    banc.getState().jetValider('frenesie');
    expect(banc.getState().pendingFrenzy, 'la fenêtre reste ouverte').toBeTruthy();
    expect(banc.getState().battle!.acted).toBe(false);
  });

  it('jetValider@frenesie sur échec → pas frenzied mais Action consommée', () => {
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    H.traits = [{ id: 'frenesie' }];
    H.characteristics['force-mentale'] = 1; // Test de FM raté quasi sûr
    banc.getState().ensemencerLeTirage(3);
    banc.getState().entrerEnFrenesie();
    banc.getState().jetLancer('frenesie');
    const r = banc.getState().pendingFrenzy!.result!;
    banc.getState().jetValider('frenesie');
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(isFrenzied(h)).toBe(r.success); // suit le résultat (FM 1 → échec attendu)
    expect(banc.getState().battle!.acted).toBe(true);
  });
});
