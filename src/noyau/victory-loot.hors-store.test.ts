import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = (): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', name: 'H', kind: 'heros',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], weapons: [], armour: {}, skills: [], talents: [], movement: 4, items: [],
  })) as unknown as Combatant;

describe('sortie de la victoire — fermeture de l’écran de victoire', () => {
  it('ferme l’écran et revient à l’exploration', () => {
    banc.setState({ party: [hero()], battle: { over: 'victoire' } as never, pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [] } as never });
    banc.getState().fenetreFermer('victoire');
    const st = banc.getState();
    expect(st.pendingVictory).toBeNull();
    expect(st.battle).toBeNull();
    expect(st.mode).toBe('exploration');
  });
});

/**
 * Écran de victoire — ÉQUIPEMENT (giveTrapping) : attribuable au héros choisi, qualités/teinte conservées ;
 * non attribué → 1er héros à la fermeture (rien de perdu).
 */
describe('le butin de victoire (`victoire.ligne`) — équipement attribuable, qualités conservées', () => {
  const gearEntry = () => ({
    uid: 'L1', label: 'Dague', magic: true,
    effect: { type: 'giveTrapping', trappingId: 'dague', qualities: ['devastatrice'], identified: false },
  });
  beforeEach(() => {
    banc.setState({
      party: [hero()],
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [gearEntry()], defeated: [] } as never,
    });
  });

  it('l’équipement n’est PAS donné tant qu’on n’a pas choisi le héros', () => {
    expect(banc.getState().party[0].items?.length ?? 0).toBe(0);
    expect(banc.getState().pendingVictory?.gear?.length).toBe(1);
  });

  it('la ligne prise par le héros de la rangée lui donne l’objet avec ses qualités (non identifié)', () => {
    banc.getState().fenetreChoisir('victoire', 'ligne', 'L1', 'h');
    const it = banc.getState().party[0].items?.find((x) => /dague/i.test(x.label));
    expect(it).toBeTruthy();
    expect(it!.identified).toBe(false); // flag « non identifié » conservé
    expect((it!.qualities ?? []).map((q) => q.id)).toContain('devastatrice'); // qualité magique conservée
    expect(banc.getState().pendingVictory?.gear?.length).toBe(0); // retiré du butin de l'écran
  });

  it('équipement non attribué → 1er héros à la fermeture (rien de perdu)', () => {
    banc.setState({ battle: { over: 'victoire' } as never });
    banc.getState().fenetreFermer('victoire');
    const it = banc.getState().party[0].items?.find((x) => /dague/i.test(x.label));
    expect(it).toBeTruthy();
  });
});
