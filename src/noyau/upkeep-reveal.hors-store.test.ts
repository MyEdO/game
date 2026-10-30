import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Entretien de Round groupé (initiative + hémorragie + mort) en UNE révélation témoin.
describe('Entretien de Round en révélation (store)', () => {
  it('le début de combat MONTRE le champ (plan d’ensemble) — pas de modale d’Initiative (R2)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    const st = banc.getState();
    expect(st.pendingRoundStart?.round).toBe(1); // ouverture = pause du Round 1 : champ visible, IA gelée
    expect(st.battle!.turn).toBe(-1); // PERSONNE n'est actif pendant la pause (confirmRoundStart posera le tour)
    expect(st.pendingCascade).toBeNull(); // aucune fenêtre à l'ouverture : le champ de bataille est visible
    expect(st.battle!.order.length).toBeGreaterThan(1); // l'ordre est posé (frise d'initiative (InitiativeStrip))
  });

  it('un franchissement de Round avec hémorragie pousse UNE révélation « Fin du Round » groupée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.conditions = [{ id: 'hemorragique', value: 2 }];
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.wounds = { current: 20, max: 20, base: 20 } as never; // survit à l'hémorragie
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    const order = [...enemyIds, H.id]; // H dernier → battleEndTurn franchit le Round
    // Ennemis neutralisés : le franchissement de Round se joue sans qu'un tour d'IA ne suspende la séquence.
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    banc.setState({ battle: { ...b, order, turn: order.length - 1 } });

    banc.getState().battleEndTurn(); // franchit le Round → entretien

    const step = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'round');
    const round = step?.reveal;
    expect(round).toBeTruthy();
    expect(round!.lines.some((l) => /Hémorragique|Blessure/i.test(l))).toBe(true);
    expect(step!.autoCloseMs, 'l’entretien reste à l’écran jusqu’au clic (#1270)').toBeUndefined();
  });
});
