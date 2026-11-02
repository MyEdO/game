/**
 * #194 — Historique d'occurrence des Blessures critiques (`Combatant.critEntriesSuffered`, LDB 18 l.71) :
 *  - `applyCriticalToTarget` l'APPEND à chaque résolution (le point unique d'application) ;
 *  - il PERSISTE via le save/load (snapshot JSON du store) — c'est lui qui arme l'escalade `onRepeat`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyCriticalToTarget } from '../noyau/combatFlow';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { stockageDesSauvegardes } from './saves';
import { lireLaSauvegarde } from '../hote/sauvegardes';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { poserLeLocalStorage } from '../lib/stockage.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'T', name: 'Cible', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], traumas: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 }, ...over,
  })) as unknown as Combatant;

describe('#194 — applyCriticalToTarget appende l\'entrée subie à critEntriesSuffered', () => {
  it('une résolution → l\'id de l\'entrée est enregistré (une entrée)', () => {
    seedBattleRng(1);
    const t = mk();
    applyCriticalToTarget(t, 'tete', 0, [], () => {}, { get: useGame.getState });
    expect(t.critEntriesSuffered).toHaveLength(1);
    expect(typeof t.critEntriesSuffered![0]).toBe('string');
  });

  it('deux résolutions → deux entrées cumulées (l\'historique croît, jamais réinitialisé)', () => {
    seedBattleRng(1);
    const t = mk();
    applyCriticalToTarget(t, 'tete', 0, [], () => {}, { get: useGame.getState });
    applyCriticalToTarget(t, 'corps', 0, [], () => {}, { get: useGame.getState });
    expect(t.critEntriesSuffered).toHaveLength(2);
  });
});

describe('#194 — persistance save/load de l\'historique de critiques', () => {
  beforeEach(() => {
    poserLeLocalStorage();
    vi.useFakeTimers();
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sourd', seed: 4 });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(testScene());
    vi.clearAllTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('critEntriesSuffered survit au round-trip sauver → réinitialiser → charger', () => {
    useGame.getState().party[0].critEntriesSuffered = ['blessure-majeure-a-l-oreille'];
    expect(useGame.getState().saveGame(1)).toBe(true);
    // La save porte bien le champ (snapshot JSON).
    const persisted = (lireLaSauvegarde(stockageDesSauvegardes(), 1)!.data.party as Combatant[])[0];
    expect(persisted.critEntriesSuffered).toEqual(['blessure-majeure-a-l-oreille']);
    // « Nouvelle partie » puis chargement.
    useGame.setState({ party: [], scene: null, screen: 'menu' });
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().party[0]?.critEntriesSuffered).toEqual(['blessure-majeure-a-l-oreille']);
  });
});
