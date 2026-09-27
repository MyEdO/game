import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

// Focalisation par modale (LDB — Test étendu).
describe('Focalisation en modale (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingFocus: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('battleFocusSpell ouvre pendingFocus sans tirer ; focusRoll tire ; focusConfirm cumule le DR + consomme l’Action', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    hero.characteristics['force-mentale'] = 80;
    hero.spells = ['arme-aethyrique'];
    if (!hero.skills.some((s) => s.id === 'focalisation')) hero.skills.push({ id: 'focalisation', advances: 20, characteristic: 'force-mentale' } as never);
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, selectedSpellId: 'arme-aethyrique', acted: false } });

    useGame.getState().battleFocusSpell('arme-aethyrique');
    expect(useGame.getState().pendingFocus).toBeTruthy();
    expect(useGame.getState().pendingFocus!.result).toBeNull(); // pas encore lancé

    useGame.getState().focusRoll();
    expect(useGame.getState().pendingFocus!.result).toBeTruthy(); // jet figé

    useGame.getState().focusConfirm();
    st = useGame.getState();
    expect(st.pendingFocus).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === heroC.id)!.focus?.spell).toBe('arme-aethyrique'); // DR cumulé (id stable)
    expect(st.battle!.acted).toBe(true); // la Focalisation consomme l'Action
  });

  it('IA : un ennemi ACTIF peut focaliser pour lui-même ; focusConfirm pose le DR et reprend son tour', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'PJ', seed: 3 });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(7);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let st = useGame.getState();
    const enemy = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    // Dote l'ennemi d'un sort arcanique focalisable + la Compétence de Focalisation (DONNÉE, pas un nom).
    enemy.spells = ['carreau'];
    enemy.characteristics['force-mentale'] = 80;
    enemy.skills = [...(enemy.skills ?? []),
      { id: 'focalisation', advances: 30, characteristic: 'force-mentale' } as never,
      { id: 'langue', spec: 'magick', advances: 30, characteristic: 'intelligence' } as never];
    // Donne le TOUR à l'ennemi (acted:false → il peut agir).
    const turn = st.battle!.order.indexOf(enemy.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, acted: false, combatants: [...st.battle!.combatants] } });

    useGame.getState().battleFocusSpell('carreau'); // garde héros-only relâchée → autorisé pour l'IA active
    expect(useGame.getState().pendingFocus).toBeTruthy();

    useGame.getState().focusRoll();
    expect(useGame.getState().pendingFocus!.result).toBeTruthy();

    useGame.getState().focusConfirm();
    st = useGame.getState();
    expect(st.pendingFocus).toBeNull();
    const e2 = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(e2.focus?.spell).toBe('carreau'); // DR de Focalisation cumulé
    expect(st.battle!.acted).toBe(true); // l'Action est consommée
    // La reprise du tour de l'IA (resumeEnemyTurn) est armée : faire courir les timers ne doit pas crasher.
    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
  });

  it('un sort non focalisable (Magie mineure) n’ouvre pas la modale', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    hero.spells = ['flechette'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: null, acted: false } });
    useGame.getState().battleFocusSpell('flechette'); // Magie mineure → non focalisable
    expect(useGame.getState().pendingFocus).toBeNull();
  });
});
