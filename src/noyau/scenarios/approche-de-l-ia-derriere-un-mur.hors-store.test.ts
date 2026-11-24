import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { heroDuDuel, ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
import { COUR, courDeFerme } from '../../scenes/fixtures/plans.testkit';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeContact } from '../monde/footprint';
import { isWalkable, wallOnSight, type Scene } from '../monde/scene';
import { plancherGrimpable } from '../monde/escalade.testkit';
import { setEncounters } from '../../scenes/test-scenarios/_shared';
import { reachable, tileKey, type Pt } from '../monde/path';
import { occupied } from '../monde/combatGeometry';
import { placeCombatant } from '../monde/spawn';
import { chooseEnemyAction } from '../monde/ai';
import { aiApproachPlan, bestAdjacentReachable, buildAiInput } from '../combatFlow';
import { canMount } from '../mount';
import { makeRNG } from '../../engine/dice';
import type { Combatant, Weapon } from '../../engine/types';

/**
 * #4105 : l'ennemi mené par l'IA rejoint par la route une cible qu'un mur plein sépare de lui, sans frapper à travers ;
 * sans route, il n'approche rien. On n'enfourche pas à travers un mur. LDB 13 l.114 ; LDB 15 l.12 ; LDB 14.
 * Plan `courDeFerme`, combattants posés par `placeCombatant`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const duel = () => ouvrirLeDuel(banc, { scene: courDeFerme(), party: [heroDuDuel()] }, COUR.rencontre);
const scene = (): Scene => banc.getState().scene!;
const contact = (A: Combatant, B: Combatant) => distanceDeContact(scene(), A, B);
const memeCase = (a: Pt | undefined, b: Pt) => !!a && a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);

/** Longueur de la route de marche de `E` jusqu'à une case de contact de `H` (`bestAdjacentReachable`), ou null. */
function routeDeContact(H: Combatant, E: Combatant): number | null {
  const reach = reachable(scene(), E.pos!, 200, { blocked: occupied(banc.getState().battle!, E) });
  const d = bestAdjacentReachable(reach, scene(), E, H);
  return d ? reach.get(tileKey(d.x, d.y, d.z ?? 0))! : null;
}

/** Les paires posées de part et d'autre d'un mur plein : le mur isolé, qu'une route contourne ; la cabane close, sans route. */
const PAIRES_CONTOURNABLES = [{ h: COUR.auNordDuMur, e: COUR.auSudDuMur }, { h: COUR.loinAuNordDuMur, e: COUR.loinAuSudDuMur }];
const PAIRE_SANS_ROUTE = { h: COUR.contreLaCabane, e: COUR.dansLaCabane };

/** Pose H et E sur la paire, et rend la route de E au contact après avoir vérifié la paire : praticable, séparée par un
 *  mur plein, hors de contact. */
function poserLaPaire(H: Combatant, E: Combatant, poser: (c: Combatant, p: Pt) => void, { h, e }: { h: Pt; e: Pt }): number | null {
  const s = scene();
  expect([isWalkable(s, h.x, h.y, 0), isWalkable(s, e.x, e.y, 0), wallOnSight(s, h, e, 0)], `${JSON.stringify(h)} | ${JSON.stringify(e)}`).toEqual([true, true, true]);
  poser(H, h); poser(E, e);
  expect([memeCase(H.pos, h), memeCase(E.pos, e), contact(H, E)]).toEqual([true, true, Infinity]);
  return routeDeContact(H, E);
}

/** Un tour de l'ennemi par la chaîne réelle (`buildAiInput` → `chooseEnemyAction` → `aiApproachPlan`), son déplacement
 *  posé par `placeCombatant`. Rend l'action choisie et le Mouvement du tour. */
function tourDeLEnnemi(E: Combatant, rng: ReturnType<typeof makeRNG>): { action: ReturnType<typeof chooseEnemyAction>['kind']; movement: number } {
  const input = buildAiInput(E, banc.getState);
  const action = chooseEnemyAction(input);
  const { plan } = aiApproachPlan(input, E, action, rng);
  if (plan.kind === 'deplacement') placeCombatant(E, scene(), plan.to);
  return { action: action.kind, movement: input.movement };
}

describe('#4105 — approche de l’IA derrière un mur plein', () => {
  it('une route mène au contact : l’ennemi la suit et rejoint sa cible en tours bornés par la route, sans frapper à travers le mur', () => {
    const { H, E, poser } = duel();
    for (const { h, e } of PAIRES_CONTOURNABLES) {
      const route = poserLaPaire(H, E, poser, { h, e });
      expect(route, `route de ${JSON.stringify(e)}`).toBeGreaterThanOrEqual(5);
      const rng = makeRNG(3);
      let tours = 0;
      let borne = Infinity;
      while (contact(H, E) > 1 && tours < 20) {
        const { action, movement } = tourDeLEnnemi(E, rng);
        expect(action, `H=${JSON.stringify(h)} E=${JSON.stringify(e)} tour ${tours + 1} : aucune frappe hors contact`).not.toBe('melee');
        borne = Math.ceil(route! / movement);
        tours++;
      }
      expect(contact(H, E), `H=${JSON.stringify(h)} E=${JSON.stringify(e)} route=${route}`).toBeLessThanOrEqual(1);
      expect(tours, `H=${JSON.stringify(h)} E=${JSON.stringify(e)} route=${route}`).toBeLessThanOrEqual(borne);
    }
  });

  it('aucune route : l’ennemi ne frappe pas et reste sur sa case (aucune approche, aucune navette)', () => {
    const { H, E, poser } = duel();
    const paire = PAIRE_SANS_ROUTE;
    expect(poserLaPaire(H, E, poser, paire), 'aucune route').toBeNull();
    const rng = makeRNG(3);
    for (let tour = 1; tour <= 4; tour++) {
      expect(tourDeLEnnemi(E, rng).action, `tour ${tour}`).toBe('fin');
      expect(memeCase(E.pos, paire.e), `tour ${tour} : E en ${JSON.stringify(E.pos)}`).toBe(true);
    }
  });

  it('tireur sans route vers le contact : il approche encore (sa portée se mesure à vol d’oiseau)', () => {
    const ARC: Weapon = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] };
    const { H, E, poser } = duel();
    const paire = PAIRE_SANS_ROUTE;
    expect(poserLaPaire(H, E, poser, paire), 'aucune route').toBeNull();
    E.weapons = [ARC];
    const { action } = tourDeLEnnemi(E, makeRNG(3));
    expect(action).toBe('deplacement');
    expect(memeCase(E.pos, paire.e), 'le tireur a quitté sa case').toBe(false);
  });

  it('canMount passe par la mesure : refus à travers un mur plein, accord à une case sans arête', () => {
    const { H, E, poser } = duel();
    E.traits = [...(E.traits ?? []), { id: 'dresse-monture' }];
    const paire = PAIRE_SANS_ROUTE;
    poserLaPaire(H, E, poser, paire);
    expect(canMount(scene(), H, E)).toBe(false);
    const s = scene();
    let libre: Pt | undefined;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const p = { x: paire.e.x + dx, y: paire.e.y + dy };
      if (isWalkable(s, p.x, p.y, 0) && !wallOnSight(s, p, paire.e, 0)) { libre = p; break; }
    }
    expect(libre, 'une case voisine de la monture sans arête').toBeDefined();
    poser(H, libre!);
    expect(contact(H, E)).toBe(1);
    expect(canMount(scene(), H, E)).toBe(true);
  });
});

/** #4156 : `plancherGrimpable`, où l'araignée géante (Trait Grimpant, `creatures.json`) part du rez ; sa cible se tient au
 *  bout du plancher, hors de la case d'arrivée de l'escalade. */
function sceneAuPlancherGrimpable(): Scene {
  const s = plancherGrimpable();
  setEncounters(s, [{ id: 'enc-plancher', enemies: [{ creature: { id: 'araignee-geante' }, pos: { x: 2, y: 3 }, facing: 'N' }] }]);
  return s;
}

describe('#4156 — l’ennemi grimpeur rejoint par l’arête escaladable sa cible de la couche du dessus', () => {
  it('au rez, il se déplace vers la cible du plancher, sans frapper hors contact, et l’atteint en tours bornés', () => {
    const { party } = testScenarios.find((s) => s.id === 'grimpant')!.construire(idsDeTest);
    const { H, E, poser } = ouvrirLeDuel(banc, { scene: sceneAuPlancherGrimpable(), party }, 'enc-plancher');
    poser(H, { x: 4, y: 0, z: 1 }); poser(E, { x: 2, y: 3, z: 0 });
    expect([memeCase(H.pos, { x: 4, y: 0, z: 1 }), memeCase(E.pos, { x: 2, y: 3, z: 0 })]).toEqual([true, true]);
    const rng = makeRNG(3);
    const actions: string[] = [];
    while (contact(H, E) > 1 && actions.length < 4) {
      const { action } = tourDeLEnnemi(E, rng);
      expect(action, `tour ${actions.length + 1} : aucune frappe hors contact`).not.toBe('melee');
      actions.push(action);
    }
    expect(actions[0]).toBe('deplacement');
    expect(contact(H, E), `actions ${actions.join(' ')}, E=${JSON.stringify(E.pos)}`).toBeLessThanOrEqual(1);
  });
});
