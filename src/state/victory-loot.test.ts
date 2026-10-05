import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], weapons: [], armour: {}, skills: [], talents: [], movement: 4, items: [],
  }) as unknown as Combatant;

describe('dismissVictory — fermeture de l’écran de victoire', () => {
  it('ferme l’écran et revient à l’exploration', () => {
    useGame.setState({ party: [hero()], battle: { over: 'victory' } as never, pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, defeated: [] } as never });
    useGame.getState().dismissVictory();
    const st = useGame.getState();
    expect(st.pendingVictory).toBeNull();
    expect(st.battle).toBeNull();
    expect(st.mode).toBe('exploration');
  });
});

/**
 * Écran de victoire — ÉQUIPEMENT (giveTrapping) : attribuable au héros choisi, qualités/skin conservés
 * (ne part plus d'office au 1er héros) ; non attribué → 1er héros à la fermeture (rien de perdu).
 */
describe('assignVictoryGear — équipement attribuable, qualités conservées', () => {
  const gearEntry = () => ({
    label: 'Dague', magic: true,
    effect: { type: 'giveTrapping', trappingId: 'dague', qualities: [{ id: 'devastatrice' }], identified: false },
  });
  beforeEach(() => {
    useGame.setState({
      party: [hero()],
      pendingVictory: { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [gearEntry()], defeated: [] } as never,
    });
  });

  it('l’équipement n’est PAS donné tant qu’on n’a pas choisi le héros', () => {
    expect(useGame.getState().party[0].items?.length ?? 0).toBe(0);
    expect(useGame.getState().pendingVictory?.gear?.length).toBe(1);
  });

  it('assignVictoryGear donne l’objet au héros choisi avec ses qualités (non identifié)', () => {
    useGame.getState().assignVictoryGear(0, 'h');
    const it = useGame.getState().party[0].items?.find((x) => /dague/i.test(x.label));
    expect(it).toBeTruthy();
    expect(it!.identified).toBe(false); // flag « non identifié » conservé
    expect((it!.qualities ?? []).map((q) => q.id)).toContain('devastatrice'); // qualité magique conservée
    expect(useGame.getState().pendingVictory?.gear?.length).toBe(0); // retiré du butin de l'écran
  });

  it('équipement non attribué → 1er héros à la fermeture (rien de perdu)', () => {
    useGame.setState({ battle: { over: 'victory' } as never });
    useGame.getState().dismissVictory();
    const it = useGame.getState().party[0].items?.find((x) => /dague/i.test(x.label));
    expect(it).toBeTruthy();
  });
});
