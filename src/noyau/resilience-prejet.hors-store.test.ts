import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { blessuresDeBase, combattantDeTest } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Résilience « Je ne faillirai pas ! » = AVANT le jet (LDB 17 l.68, mode principal « au lieu de
 * lancer les dés ») ET après un Test échoué (« Vous pouvez même faire ce choix après un Test qui
 * a échoué ») — les DEUX modes sont RAW et testés ici.
 */
function setPendingTest(over: Partial<any> = {}) {
  banc.setState({
    party: [combattantDeTest({ id: 'h1', label: 'Héros', resilience: 2 })],
    pendingTest: {
      actorId: 'h1', actorName: 'Héros', label: 'Test', skillValue: 40, difficulty: 'intermediaire',
      requireSL: 0, target: 40, roll: null, success: false, sl: 0,
      ...over,
    } as any,
  });
}

describe('jetForcerLaReussite@test — Résilience AVANT le jet', () => {
  it('avant le jet (roll==null) : réussite garantie, DR ≥ 1, dé choisi, 1 Résilience dépensée', () => {
    setPendingTest();
    banc.getState().jetForcerLaReussite('test');
    const pt = banc.getState().pendingTest!;
    expect(pt.success).toBe(true);
    expect(pt.sl).toBeGreaterThanOrEqual(1);
    expect(pt.roll).toBe(1); // « vous choisissez le résultat » → 01
    expect(pt.forcee).toBe(true);
    expect(banc.getState().party[0].resilience).toBe(1);
  });

  it('respecte le DR requis (Test étendu) : DR ≥ requireSL', () => {
    setPendingTest({ requireSL: 3 });
    banc.getState().jetForcerLaReussite('test');
    expect(banc.getState().pendingTest!.sl).toBeGreaterThanOrEqual(3);
  });

  it('APRÈS un Test échoué (RAW l.73 « vous choisissez le résultat ») : dé CHOISI 01 → DR max', () => {
    setPendingTest({ roll: 88, success: false, sl: -2 });
    banc.getState().jetForcerLaReussite('test');
    const pt = banc.getState().pendingTest!;
    expect(pt.success).toBe(true);
    expect(pt.roll).toBe(1); // sans enjeu de double, le choix rationnel est le score le plus bas
    expect(pt.sl).toBe(4); // dizaine(40) − dizaine(01) : le DR maximal atteignable contre une cible de 40
    expect(pt.forcee).toBe(true);
    expect(banc.getState().party[0].resilience).toBe(1);
  });

  it('Test déjà réussi : no-op (pas de gaspillage de Résilience)', () => {
    setPendingTest({ roll: 12, success: true, sl: 2 });
    banc.getState().jetForcerLaReussite('test');
    expect(banc.getState().party[0].resilience).toBe(2);
  });

  it('sans Résilience : no-op', () => {
    setPendingTest();
    banc.setState({ party: [combattantDeTest({ id: 'h1', label: 'Héros', resilience: 0 })] });
    banc.getState().jetForcerLaReussite('test');
    expect(banc.getState().pendingTest!.success).toBe(false);
  });
});

describe('Résilience pré-jet — autres modales (synthèse de succès)', () => {
  it('soin : avant le jet → réussite garantie (01), 1 Résilience dépensée', () => {
    // Hors combat, un soin sans jet est le brouillon de l'infirmerie ouverte sur son patient (`brouillonTenu`).
    banc.setState({
      party: [combattantDeTest({ id: 'h1', label: 'Soigneur', resilience: 1, wounds: blessuresDeBase(12, 4), skills: [{ id: 'guerison', advances: 10, characteristic: 'intelligence' }] })],
      battle: null, medic: { patientId: 'h1' },
      pendingHeal: { healerId: 'h1', healerName: 'Soigneur', targetId: 'h1', targetName: 'Soigneur', mode: 'blessures', intBonus: 3, test: 'guerison', bandagesDe: null, sl: 0, success: false, roll: null, target: 50 } as any,
    });
    banc.getState().jetForcerLaReussite('soins');
    const ph = banc.getState().pendingHeal!;
    expect(ph.success).toBe(true);
    expect(ph.roll).toBe(1);
    expect(banc.getState().party[0].resilience).toBe(0);
  });

  it('frénésie : avant le jet → entrée garantie, 1 Résilience dépensée', () => {
    const brute = { ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brute', seed: 1 }), id: 'e1', resilience: 1 };
    banc.setState({
      battle: { combatants: [brute] } as any,
      pendingFrenzy: { combatantId: 'e1', result: null } as any,
    });
    banc.getState().jetForcerLaReussite('frenesie');
    expect(banc.getState().pendingFrenzy!.result!.success).toBe(true);
    expect(banc.getState().battle!.combatants[0].resilience).toBe(0);
  });
});
