import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Focalisation par modale (LDB — Test étendu).
describe('Focalisation en modale (store)', () => {
  it('focaliserLeSort ouvre pendingFocus sans tirer ; jetLancer@focalisation tire ; jetValider@focalisation cumule le DR + consomme l’Action', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    hero.characteristics['force-mentale'] = 80;
    hero.spells = ['arme-aethyrique'];
    if (!hero.skills.some((s) => s.id === 'focalisation')) hero.skills.push({ id: 'focalisation', advances: 20, characteristic: 'force-mentale' } as never);
    banc.setState({ party: [hero] });
    banc.getState().ensemencerLeTirage(2);
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    let st = banc.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'heros')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, selectedSpellId: 'arme-aethyrique', acted: false } });

    banc.getState().focaliserLeSort(heroC.id, 'arme-aethyrique');
    expect(banc.getState().pendingFocus).toBeTruthy();
    expect(banc.getState().pendingFocus!.result).toBeNull(); // pas encore lancé

    banc.getState().jetLancer('focalisation');
    expect(banc.getState().pendingFocus!.result).toBeTruthy(); // jet figé

    banc.getState().jetValider('focalisation');
    st = banc.getState();
    expect(st.pendingFocus).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === heroC.id)!.focus?.spell).toBe('arme-aethyrique'); // DR cumulé (id stable)
    expect(st.battle!.acted).toBe(true); // la Focalisation consomme l'Action
  });

  it('IA : un ennemi ACTIF peut focaliser pour lui-même ; jetValider@focalisation pose le DR et reprend son tour', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'PJ', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().ensemencerLeTirage(7);
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    let st = banc.getState();
    const enemy = st.battle!.combatants.find((c) => c.kind === 'ennemi')!;
    // Dote l'ennemi d'un sort arcanique focalisable + la Compétence de Focalisation (DONNÉE, pas un nom).
    enemy.spells = ['carreau'];
    enemy.characteristics['force-mentale'] = 80;
    enemy.skills = [...(enemy.skills ?? []),
      { id: 'focalisation', advances: 30, characteristic: 'force-mentale' } as never,
      { id: 'langue', spec: 'magick', advances: 30, characteristic: 'intelligence' } as never];
    // Donne le TOUR à l'ennemi (acted:false → il peut agir).
    const turn = st.battle!.order.indexOf(enemy.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, acted: false, combatants: [...st.battle!.combatants] } });

    banc.getState().focaliserLeSort(enemy.id, 'carreau'); // garde héros-only relâchée → autorisé pour l'IA active
    expect(banc.getState().pendingFocus).toBeTruthy();

    banc.getState().jetLancer('focalisation');
    expect(banc.getState().pendingFocus!.result).toBeTruthy();

    banc.getState().jetValider('focalisation');
    st = banc.getState();
    expect(st.pendingFocus).toBeNull();
    const e2 = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(e2.focus?.spell).toBe('carreau'); // DR de Focalisation cumulé
    expect(st.battle!.acted).toBe(true); // l'Action est consommée
    // La reprise du tour de l'IA (resumeEnemyTurn) est armée : faire courir les timers ne doit pas crasher.
    expect(() => banc.reprendreLesEnAttente()).not.toThrow();
  });

  it('un sort non focalisable (Magie mineure) n’ouvre pas la modale', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    hero.spells = ['flechette'];
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const st = banc.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'heros')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    banc.setState({ battle: { ...st.battle!, turn, action: null, acted: false } });
    banc.getState().focaliserLeSort(heroC.id, 'flechette'); // Magie mineure → non focalisable
    expect(banc.getState().pendingFocus).toBeNull();
  });
});
