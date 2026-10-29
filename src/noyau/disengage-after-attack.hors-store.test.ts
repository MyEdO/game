import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { t } from '../i18n';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Bug playtest « pas le droit de bouger après avoir attaqué » : une attaque de mêlée Engage,
 * et le Désengagement était bloqué dès que l'Action était dépensée — y compris l'option A
 * (« Sacrifier l'Avantage ») qui, elle, NE coûte PAS l'Action (LDB 15 l.47). On vérifie
 * qu'après avoir agi, un héros Engagé avec l'Avantage supérieur peut encore partir via l'option A.
 */
describe('Désengagement après avoir attaqué (option A — LDB 15 l.47)', () => {
  it('héros Engagé ayant DÉJÀ agi peut se désengager en sacrifiant l’Avantage', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(3);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    let st = banc.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id]; E.engagedWith = [H.id];
    H.advantage = 2; E.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    // L'Action est DÉJÀ dépensée (le héros vient d'attaquer) :
    banc.setState({ battle: { ...st.battle!, turn, action: null, movementUsed: 0, acted: true } });

    banc.getState().battleDisengage(); // doit ouvrir le menu malgré l'Action dépensée
    const pd = banc.getState().pendingDisengage;
    expect(pd).not.toBeNull();
    expect(pd!.canSacrifice).toBe(true);
    expect(pd!.refusEsquive).toBe(t('agate.actionSpent')); // Esquive indisponible (coûte l'Action, LDB 15 l.49) → pas de boucle infinie

    banc.getState().disengageConfirmA();
    st = banc.getState();
    expect(st.battle!.action).toBeNull(); expect(st.battle!.reachable.size).toBeGreaterThan(0); // mouvement libre rouvert (budget posé)
    expect(st.battle!.acted).toBe(true); // l'option A NE consomme PAS l'Action (préservée)
    expect(st.pendingDisengage).toBeNull();
  });
});
