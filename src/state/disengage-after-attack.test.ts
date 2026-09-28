import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

/**
 * Bug playtest « pas le droit de bouger après avoir attaqué » : une attaque de mêlée Engage,
 * et le Désengagement était bloqué dès que l'Action était dépensée — y compris l'option A
 * (« Sacrifier l'Avantage ») qui, elle, NE coûte PAS l'Action (LDB 15 l.47). On vérifie
 * qu'après avoir agi, un héros Engagé avec l'Avantage supérieur peut encore partir via l'option A.
 */
describe('Désengagement après avoir attaqué (option A — LDB 15 l.47)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingDisengage: null }); });

  it('héros Engagé ayant DÉJÀ agi peut se désengager en sacrifiant l’Avantage', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id]; E.engagedWith = [H.id];
    H.advantage = 2; E.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    // L'Action est DÉJÀ dépensée (le héros vient d'attaquer) :
    useGame.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, acted: true } });

    useGame.getState().battleDisengage(); // doit ouvrir le menu malgré l'Action dépensée
    const pd = useGame.getState().pendingDisengage;
    expect(pd).not.toBeNull();
    expect(pd!.canSacrifice).toBe(true);
    expect(pd!.canEsquive).toBe(false); // Esquive indisponible (coûte l'Action) → pas de boucle infinie

    useGame.getState().disengageConfirmA();
    st = useGame.getState();
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // mouvement libre rouvert (budget posé)
    expect(st.battle!.acted).toBe(true); // l'option A NE consomme PAS l'Action (préservée)
    expect(st.pendingDisengage).toBeNull();
  });
});
