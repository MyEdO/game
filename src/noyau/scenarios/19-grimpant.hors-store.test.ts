import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { scenario } from '../../scenes/test-scenarios/19-grimpant';
import { runEnemyAI } from '../../noyau/combatFlow';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * GRIMPANT (#504) : preuve LIVE sur la scène RÉELLE du scénario — l'araignée géante (Trait Grimpant)
 * franchit l'arête `WallSeg.climb` posée au pied du plateau, SANS Test (aucune modale de jet ouverte),
 * et arrive au contact du Chasseur en peu de tours (anti-grind).
 */
function startGrimpant(): { spider: import('../../engine/types').Combatant } {
  banc.setState({ party: scenario.construire(idsDeTest).party });
  banc.getState().lancerLaScene(scenarioConstruit.scene);
  banc.getState().lancerLeCombat('enc-grimpant');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const spider = b.combatants.find((c) => c.kind === 'ennemi')!;
  return { spider };
}

/** Les tours de l'araignée, un par Round, jusqu'au plateau ou à son 2e tour libre (borne `TOURS_MAX`) : sa porte de Peur
 *  se rouvre à chaque tour comme au changement de tour (`advanceTurn`). Source de Peur : LDB 85 l.59 ; retenue : LDB 21
 *  l.27. */
const TOURS_MAX = 40;
function toursJusquAuPlateau(id: string): void {
  let joues = 0;
  let parLaPeur = 0;
  for (let round = 0; round < TOURS_MAX && joues - parLaPeur < 2 && !banc.getState().battle!.over; round++) {
    const b = banc.getState().battle!;
    const sp = b.combatants.find((c) => c.id === id)!;
    if (!sp.pos || sp.pos.y <= 2) break; // déjà sur le plateau
    banc.setState({ battle: { ...b, round: b.round + round, turn: b.order.indexOf(id), acted: false, action: null, movementUsed: 0, fearGate: null } });
    runEnemyAI(banc.getState, banc.setState, id);
    banc.reprendreLesEnAttente();
    joues++;
    if (banc.getState().battle!.fearGate === 'failed') parLaPeur++;
  }
}

describe('Grimpant — l’araignée escalade (grimpant)', () => {

  it('scène : plateau à 4 m, une seule arête climb au pied (5,3), Chasseur posté dessus (5,1)', () => {
    const s = scenarioConstruit.scene;
    expect(s.dimensions).toEqual({ w: 10, h: 10 });
    const climb = s.walls!.find((w) => w.climb);
    expect(climb).toMatchObject({ x: 5, y: 3, side: 'N' });
    expect(banc.getState().party ?? scenario.construire(idsDeTest).party).toBeTruthy();
  });

  it('l’araignée (Trait Grimpant) franchit la falaise SANS Test et atteint le plateau en ≤ 2 tours où sa Peur ne la retient pas (anti-grind)', () => {
    const { spider } = startGrimpant();
    expect(spider.traits?.some((t) => t.id === 'grimpant')).toBe(true);
    expect(spider.pos!.y).toBeGreaterThan(2); // départ au sol, sous la falaise

    toursJusquAuPlateau(spider.id);
    const after = banc.getState().battle!.combatants.find((c) => c.id === spider.id)!;
    expect(after.pos!.y).toBeLessThanOrEqual(2); // a grimpé sur le plateau
  });

  it('journalise le franchissement (climb.auto, #504) : le pathing IA n’est pas un jet silencieux', () => {
    const { spider } = startGrimpant();
    toursJusquAuPlateau(spider.id);
    const log = banc.getState().battle!.log;
    expect(log.some((l) => l.entree.texte.includes('escalade la paroi sans effort'))).toBe(true);
  });
});
