import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

// Entretien de Round groupé (initiative + hémorragie + mort) en UNE révélation témoin.
describe('Entretien de Round en révélation (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('le début de combat MONTRE le champ (plan d’ensemble) — pas de modale d’Initiative (R2)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const st = useGame.getState();
    expect(st.pendingRoundStart?.round).toBe(1); // ouverture = pause du Round 1 : champ visible, IA gelée
    expect(st.battle!.turn).toBe(-1); // PERSONNE n'est actif pendant la pause (confirmRoundStart posera le tour)
    expect(st.pendingCascade).toBeNull(); // aucune fenêtre à l'ouverture : le champ de bataille est visible
    expect(st.battle!.order.length).toBeGreaterThan(1); // l'ordre est posé (frise d'initiative (InitiativeStrip))
  });

  it('un franchissement de Round avec hémorragie pousse UNE révélation « Fin du Round » groupée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.conditions = [{ id: 'hemorragique', value: 2 }];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.wounds = { current: 20, max: 20, base: 20 } as never; // survit à l'hémorragie
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    const order = [...enemyIds, H.id]; // H dernier → battleEndTurn franchit le Round
    // Ennemis neutralisés : le franchissement de Round se joue sans qu'un tour d'IA ne suspende la séquence.
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    useGame.setState({ battle: { ...b, order, turn: order.length - 1 } });

    useGame.getState().battleEndTurn(); // franchit le Round → entretien

    const step = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'round');
    const round = step?.reveal;
    expect(round).toBeTruthy();
    expect(round!.lines.some((l) => /Hémorragique|Blessure/i.test(l))).toBe(true);
    expect(step!.autoCloseMs, 'l’entretien reste à l’écran jusqu’au clic (#1270)').toBeUndefined();
  });
});
