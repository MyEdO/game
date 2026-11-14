import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { advanceTurn } from './combatFlow';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Entretien de Round groupé (initiative + hémorragie + mort) en UNE révélation témoin.
describe('Entretien de Round en révélation (store)', () => {
  it('le début de combat MONTRE le champ (plan d’ensemble) — pas de modale d’Initiative (R2)', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    const st = banc.getState();
    expect(st.pendingRoundStart?.round).toBe(1); // ouverture = pause du Round 1 : champ visible, IA gelée
    expect(st.battle!.turn).toBe(-1); // PERSONNE n'est actif pendant la pause (`lancerLeRound` posera le tour)
    expect(st.pendingCascade).toBeNull(); // aucune fenêtre à l'ouverture : le champ de bataille est visible
    expect(st.battle!.order.length).toBeGreaterThan(1); // l'ordre est posé (frise d'initiative (InitiativeStrip))
  });

  it('un franchissement de Round avec hémorragie pousse UNE révélation « Fin du Round » groupée', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.conditions = [{ id: 'hemorragique', value: 2 }];
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    H.wounds = blessuresDeBase(20, 20, H); // survit à l'hémorragie
    const enemyIds = b.combatants.filter((c) => c.kind === 'ennemi').map((c) => c.id);
    const order = [...enemyIds, H.id]; // H dernier → terminerLeTour franchit le Round
    // Ennemis neutralisés : le franchissement de Round se joue sans qu'un tour d'IA ne suspende la séquence.
    b.combatants.filter((c) => c.kind === 'ennemi').forEach((e) => (e.dead = true));
    banc.setState({ battle: { ...b, order, turn: order.length - 1 } });

    advanceTurn(banc.getState, banc.setState); // franchit le Round → entretien

    const step = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'round');
    const round = step?.reveal;
    expect(round).toBeTruthy();
    expect(round!.lines.some((l) => /Hémorragique|Blessure/i.test(l))).toBe(true);
  });
});
