/**
 * #4821 — porte d'entrée : en Auto-combat, un Sorcier de Collège qui connaît un Sort mineur offensif focalise un sort
 * de sa voie face à une cible robuste, puis le lance au NI 0. LDB 46 l.128-132
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiTurnLog, clearAiTurnLog } from './combatFlow';
import { fenetreDuJeu } from './combatAuto';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

/** Joue le drive de chaque fenêtre qui tient la main jusqu'à l'issue du combat. */
function jouerJusquALIssue(banc: Banc, plafond: number): void {
  for (let n = 0; n < plafond && !banc.getState().battle?.over; n++) {
    banc.reprendreTout();
    const suite = fenetreDuJeu(banc.getState())?.drive ?? [];
    if (!suite.length) return;
    const actions = banc.getState() as unknown as Record<string, (...args: unknown[]) => void>;
    for (const g of suite) actions[g.verbe](...(g.flux ? [g.flux] : g.fenetre ? [g.fenetre] : []));
  }
}

it('Auto-combat : Fléchette connue, le Sorcier focalise Grands feux d’U’Zhul puis le lance', () => {
  const [w] = groupeDeScenario(idsDeTest, 'sorcier');
  w.spells = ['flechette', 'grands-feux-d-u-zhul'];
  w.skills = w.skills.map((s) => (s.id === 'focalisation' ? { ...s, advances: 30 } : s));
  const banc = ouvrirLeBanc({ graine: 3, cadence: 'auto', etat: { party: [w] } });
  clearAiTurnLog();
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  // Une seule cible, robuste et qui ne s'approche pas : rien ne perturbe la Focalisation (LDB 46 l.144).
  const cible = 'enemy-enc-mutants-0';
  const b = banc.getState().battle!;
  banc.setState({ battle: {
    ...b,
    combatants: b.combatants.filter((c) => c.kind === 'heros' || c.id === cible)
      .map((c) => (c.id === cible ? { ...c, movement: 0, wounds: blessuresDeBase(40, 40, c) } : c)),
    order: b.order.filter((id) => id === w.id || id === cible),
  } });
  jouerJusquALIssue(banc, 400);
  const gestes = aiTurnLog().filter((r) => r.id === w.id).map((r) => r.action);
  const lance = gestes.indexOf(`incantation grands-feux-d-u-zhul→${cible}`);
  expect(lance, `le sort de voie est lancé : ${gestes.join(' · ')}`).toBeGreaterThan(0);
  expect(gestes.slice(0, lance), 'il est d’abord focalisé, sans Fléchette').toEqual(Array(lance).fill('focalisation grands-feux-d-u-zhul'));
});
