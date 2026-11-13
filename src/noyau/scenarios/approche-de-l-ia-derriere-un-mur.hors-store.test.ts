import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
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
 * Paires CHERCHÉES dans la scène réelle d'`ecuries-clayonnage`, combattants posés par `placeCombatant`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const duel = () => ouvrirLeDuel(banc, testScenarios.find((s) => s.id === 'ecuries-clayonnage')!.construire(idsDeTest), 'enc-clayonnage');
const scene = (): Scene => banc.getState().scene!;
const contact = (A: Combatant, B: Combatant) => distanceDeContact(scene(), A, B);
const memeCase = (a: Pt | undefined, b: Pt) => !!a && a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);

/** Longueur de la route de marche de `E` jusqu'à une case de contact de `H` (`bestAdjacentReachable`), ou null. */
function routeDeContact(H: Combatant, E: Combatant): number | null {
  const reach = reachable(scene(), E.pos!, 200, { blocked: occupied(banc.getState().battle!, E) });
  const d = bestAdjacentReachable(reach, scene(), E, H);
  return d ? reach.get(tileKey(d.x, d.y, d.z ?? 0))! : null;
}

/** Les paires de cases cardinales praticables au sol, qu'un mur plein sépare, où H et E posés ne sont pas au contact
 *  et dont la route de E au contact satisfait `garde` (au plus `max`). */
function pairesDerriereUnMur(H: Combatant, E: Combatant, poser: (c: Combatant, p: Pt) => void, garde: (route: number | null) => boolean, max: number): { h: Pt; e: Pt; route: number | null }[] {
  const s = scene();
  const out: { h: Pt; e: Pt; route: number | null }[] = [];
  for (let y = 0; y < s.dimensions.h; y++) for (let x = 0; x < s.dimensions.w; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const h = { x, y }, e = { x: x + dx, y: y + dy };
    if (!isWalkable(s, h.x, h.y, 0) || !isWalkable(s, e.x, e.y, 0) || !wallOnSight(s, h, e, 0)) continue;
    poser(H, h); poser(E, e);
    if (!memeCase(H.pos, h) || !memeCase(E.pos, e) || contact(H, E) !== Infinity) continue;
    const route = routeDeContact(H, E);
    if (garde(route)) out.push({ h, e, route });
    if (out.length >= max) return out;
  }
  return out;
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
    const paires = pairesDerriereUnMur(H, E, poser, (route) => route !== null && route >= 5, 12);
    expect(paires.length, 'des paires mur plein + route ≥ 5').toBeGreaterThan(0);
    for (const { h, e, route } of paires) {
      poser(H, h); poser(E, e);
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
    const [paire] = pairesDerriereUnMur(H, E, poser, (route) => route === null, 1);
    expect(paire, 'une paire mur plein sans route').toBeDefined();
    const rng = makeRNG(3);
    for (let tour = 1; tour <= 4; tour++) {
      expect(tourDeLEnnemi(E, rng).action, `tour ${tour}`).toBe('fin');
      expect(E.pos).toEqual(paire.e);
    }
  });

  it('tireur sans route vers le contact : il approche encore (sa portée se mesure à vol d’oiseau)', () => {
    const ARC: Weapon = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] };
    const { H, E, poser } = duel();
    const [paire] = pairesDerriereUnMur(H, E, poser, (route) => route === null, 1);
    expect(paire, 'une paire mur plein sans route').toBeDefined();
    E.weapons = [ARC];
    const { action } = tourDeLEnnemi(E, makeRNG(3));
    expect(action).toBe('deplacement');
    expect(E.pos).not.toEqual(paire.e);
  });

  it('canMount passe par la mesure : refus à travers un mur plein, accord à une case sans arête', () => {
    const { H, E, poser } = duel();
    const [paire] = pairesDerriereUnMur(H, E, poser, () => true, 1);
    expect(paire, 'une paire mur plein').toBeDefined();
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
