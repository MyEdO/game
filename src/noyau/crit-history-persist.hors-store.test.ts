/**
 * #194 — Historique d'occurrence des Blessures critiques (`Combatant.critEntriesSuffered`, LDB 18 l.71) :
 *  - `applyCriticalToTarget` l'APPEND à chaque résolution (le point unique d'application) ;
 *  - il PERSISTE par la save (`snapshotSave` → `chargerLaSave`) : il arme l'escalade `onRepeat`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { applyCriticalToTarget } from './combatFlow';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { lireSave, type SaveGame } from './persistance/save';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const mk = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'T', name: 'Cible', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], traumas: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 }, ...over,
  })) as unknown as Combatant;

describe('#194 — applyCriticalToTarget appende l\'entrée subie à critEntriesSuffered', () => {
  it('une résolution → l\'id de l\'entrée est enregistré (une entrée)', () => {
    seedBattleRng(1);
    const t = mk();
    applyCriticalToTarget(t, 'tete', 0, [], () => {}, { get: banc.getState });
    expect(t.critEntriesSuffered).toHaveLength(1);
    expect(typeof t.critEntriesSuffered![0]).toBe('string');
  });

  it('deux résolutions → deux entrées cumulées (l\'historique croît, jamais réinitialisé)', () => {
    seedBattleRng(1);
    const t = mk();
    applyCriticalToTarget(t, 'tete', 0, [], () => {}, { get: banc.getState });
    applyCriticalToTarget(t, 'corps', 0, [], () => {}, { get: banc.getState });
    expect(t.critEntriesSuffered).toHaveLength(2);
  });
});

describe('#194 — persistance save/load de l\'historique de critiques', () => {
  beforeEach(() => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sourd', seed: 4 });
    banc.setState({ party: [hero], battle: null });
    banc.getState().lancerLaScene(testScene());
  });

  it('critEntriesSuffered survit au round-trip sauver → réinitialiser → charger', () => {
    banc.getState().party[0].critEntriesSuffered = ['blessure-majeure-a-l-oreille'];
    const save = sauverLeBanc(banc);
    // La save porte bien le champ (snapshot JSON).
    const persisted = ((lireSave(save) as SaveGame).data.party as Combatant[])[0];
    expect(persisted.critEntriesSuffered).toEqual(['blessure-majeure-a-l-oreille']);
    // « Nouvelle partie » puis chargement.
    banc.setState({ party: [], scene: null, screen: 'menu' });
    chargerSurLeBanc(banc, save);
    expect(banc.getState().party[0]?.critEntriesSuffered).toEqual(['blessure-majeure-a-l-oreille']);
  });
});
