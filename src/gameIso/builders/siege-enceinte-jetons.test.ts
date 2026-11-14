import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from '../../scenes/test-scenarios/siege-enceinte';
import { buildTokens } from './tokens';
import { isOverhang, capsSolid } from '../../noyau/monde/volume/floors';
import { computeStateVisibleAndLight } from '../../noyau/visionState';

const scenarioConstruit = scenario.construire(idsDeTest);

describe('Siège — défendre la muraille (siege-enceinte)', () => {
  /**
   * Décision de dessiner la garnison du chemin de ronde vue depuis la cour (#1567) : la loi d'étage
   * laisse sortir le jeton d'une case dont le sol de z1 coiffe la MASSE PLEINE du rempart
   * (`capsSolid`), cas distinct du surplomb sur pilotis (`isOverhang`). La vue mesurée est celle de
   * l'écran : brouillard réel et `activeZ` du combattant actif.
   */
  it('RENDU : depuis la cour, la garnison du chemin de ronde (défenseurs ET pièces servies) sort en jetons', () => {
    useGame.setState({ party: scenario.construire(idsDeTest).party });
    useGame.getState().lancerLaScene(scenarioConstruit.scene);
    useGame.getState().lancerLeCombat('assaut');
    useGame.getState().fenetreValider('debutDuRound');
    const st = useGame.getState();
    const b = st.battle!;
    const scene = st.scene!;
    const vl = computeStateVisibleAndLight({ scene, battle: b, party: st.party, partyPos: st.partyPos, gameTime: st.gameTime, lightLevel: st.lightLevel });
    const actif = b.combatants.find((c) => c.id === b.order[b.turn])!;
    const activeZ = actif.pos?.z ?? 0;
    expect(activeZ).toBe(0); // le combat s'ouvre au sol : c'est de là qu'on regarde le rempart
    const rendus = new Set(buildTokens(scene, vl.visible, b, { activeZ, viewZ: null, top: false }, st.party.map((h) => h.id)).map((t) => t.id));
    // Les 2 PIÈCES du rempart (emplacements posés par `bind: { emplacement }`) et leurs 2 servants.
    const piecesRempart = b.combatants.filter((c) => c.bodyShape === 'engin' && (c.pos?.z ?? 0) === 1);
    expect(piecesRempart.length).toBe(2);
    for (const p of piecesRempart) {
      expect(capsSolid(scene, p.pos!.x, p.pos!.y, 1)).toBe(true); // dessus de la masse, pas un surplomb
      expect(isOverhang(scene, p.pos!.x, p.pos!.y, 1)).toBe(false);
      expect(rendus.has(p.id)).toBe(true);
    }
    for (const id of ['crew-baliste', 'crew-canon']) expect(rendus.has(id)).toBe(true);
    // Contre-épreuve : la batterie ENNEMIE au fond du champ reste coupée par le BROUILLARD (loi
    // inchangée) — ce test mesure l'étage, pas la vue.
    for (const c of b.combatants.filter((x) => x.bodyShape === 'engin' && (x.pos?.z ?? 0) === 0)) expect(rendus.has(c.id)).toBe(false);
  });
});
