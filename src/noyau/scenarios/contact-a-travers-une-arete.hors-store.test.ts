import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { heroDuDuel, ouvrirLeDuel } from '../combatDeTest.testkit';
import { COUR, courDeFerme } from '../../scenes/fixtures/plans.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeContact, footprintN, footprintTiles } from '../monde/footprint';
import {
  areteOcculteEntre,
  edgeOf,
  isWalkable,
  porteEnJeu,
  setDoorOpen,
  setStructureDown,
  wallBetween,
  wallOnSight,
  type Scene,
  type WallSeg,
} from '../monde/scene';
import { lineOfSightCover } from '../monde/lineOfSight';
import { aretesA } from '../monde/wallIndex';
import { attackEnv, attackPlan } from '../combatFlow';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { effectifAuContactParmi } from '../combat/surnombre';
import { isStructure } from '../../engine/structures';
import { chebyshev } from '../../engine/grid';
import { t } from '../../i18n';
import { ligneDe } from '../../engine/modLine.testkit';
import { RULE_REF } from '../../engine/ruleRefs';
import type { Combatant, Weapon } from '../../engine/types';

/**
 * #4105 : deux combattants qu'une arête pleine sépare ne sont pas au contact. LDB 13 l.94 ; LDB 13 l.114.
 * Scènes des scénarios `embuscade-fluviale` et `fenetre-ecuries`, plan `courDeFerme` ; combattants posés par `placeCombatant`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const contact = (A: Combatant, B: Combatant) => distanceDeContact(banc.getState().scene, A, B);
const duel = (scenarioId: string, encId: string, tiers?: 'heros' | 'ennemi') =>
  ouvrirLeDuel(banc, testScenarios.find((s) => s.id === scenarioId)!.construire(idsDeTest), encId, tiers);
const duelALaCour = () => ouvrirLeDuel(banc, { scene: courDeFerme(), party: [heroDuDuel()] }, COUR.rencontre);

type Case = { x: number; y: number };
/** Les deux cases que sépare l'arête cardinale `w` de l'étage 0 (`edgeOf`), ou null. */
const casesDe = (w: WallSeg): [Case, Case] | null => {
  if ((w.z ?? 0) !== 0) return null;
  if (w.side === 'N') return [{ x: w.x, y: w.y - 1 }, { x: w.x, y: w.y }];
  if (w.side === 'E') return [{ x: w.x, y: w.y }, { x: w.x + 1, y: w.y }];
  return null;
};
const praticable = (s: Scene, c: Case) => isWalkable(s, c.x, c.y, 0);
const occulte = (s: Scene, a: Case, b: Case) => areteOcculteEntre(s, a.x, a.y, b.x, b.y, 0);
const barre = (s: Scene, a: Case, b: Case) => wallBetween(s, a.x, a.y, b.x, b.y, 0);

/** La première arête de `s` entre deux cases praticables que `garde` retient. */
function areteCherchee(s: Scene, garde: (w: WallSeg, a: Case, b: Case) => boolean): { w: WallSeg; a: Case; b: Case } | undefined {
  for (const w of s.walls ?? []) {
    const cases = casesDe(w);
    if (cases && cases.every((c) => praticable(s, c)) && garde(w, ...cases)) return { w, a: cases[0], b: cases[1] };
  }
  return undefined;
}

/** Combien des deux contournements du coin entre `a` et `b`, en diagonale, une arête occulte (`areteOcculteEntre`). */
function contournementsOccultants(s: Scene, a: Case, b: Case): number {
  const par1 = { x: b.x, y: a.y }, par2 = { x: a.x, y: b.y };
  return Number(occulte(s, a, par1) || occulte(s, par1, b)) + Number(occulte(s, a, par2) || occulte(s, par2, b));
}

describe('#4105 — la coque de la barge d’embuscade-fluviale', () => {
  it('cale (3,6,0) et dehors (2,6,0) : ni contact, ni mêlée, ni Charge, ni Engagement, ni Surnombre', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(H, { x: 3, y: 6, z: 0 });
    poser(E, { x: 2, y: 6, z: 0 });
    expect(wallBetween(banc.getState().scene!, 3, 6, 2, 6, 0), 'la coque sépare les deux cases').toBe(true);
    expect(contact(H, E)).toBe(Infinity);
    expect(attackPlan(banc.getState, H, E).kind).toBe('bloque');
    expect(attackPlan(banc.getState, E, H).kind).toBe('bloque');
    expect(effectifAuContactParmi(banc.getState().scene, banc.getState().battle!.combatants, E, 'heros')).toBe(0);
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true, intentionId: 'charge' });
    banc.reprendreLesEnAttente();
    expect(banc.getState().pendingAttack).toBeFalsy();
    expect(H.engagedWith ?? []).not.toContain(E.id);
    expect(E.engagedWith ?? []).not.toContain(H.id);
  });

  it('l’entrée du soin refuse l’allié que la coque sépare du soigneur, et s’ouvre sur le même allié au contact', () => {
    const { H, T, poser } = duel('embuscade-fluviale', 'enc-fluvial', 'heros');
    const H2 = T!;
    H.skills = [...H.skills, { id: 'guerison', characteristic: 'intelligence', advances: 5 }];
    H.wounds = { ...H.wounds, current: 1 };
    H2.wounds = { ...H2.wounds, current: 1 };
    poser(H, { x: 3, y: 6, z: 0 });
    poser(H2, { x: 2, y: 6, z: 0 });
    expect(wallBetween(banc.getState().scene!, 3, 6, 2, 6, 0), 'la coque sépare les deux cases').toBe(true);
    banc.jouerLaCase('soins');
    expect(banc.getState().battle!.action, 'le Soin armé par sa case').toBe('soins');
    banc.getState().ouvrirLaGuerison(H2.id);
    expect(banc.getState().pendingHeal).toBeFalsy();
    expect(banc.getState().refus?.texte).toBe(t('cf.horsDePortee'));
    expect(banc.getState().battle!.action, 'le refus laisse le Soin armé').toBe('soins');
    poser(H2, { x: 4, y: 6, z: 0 });
    expect(contact(H, H2), 'la case voisine de la cale est au contact').toBe(1);
    banc.getState().ouvrirLaGuerison(H2.id);
    expect(banc.getState().pendingHeal?.targetId).toBe(H2.id);
  });

  it('pont (6,7,1) et cale voisine (6,6,0) : l’arête se lit à la couche la plus haute, le contact tient', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(H, { x: 6, y: 7, z: 1 });
    poser(E, { x: 6, y: 6, z: 0 });
    expect(wallOnSight(banc.getState().scene!, { x: 6, y: 6 }, { x: 6, y: 7 }, 0), 'une arête à la couche basse').toBe(true);
    expect(contact(H, E)).toBe(1);
  });

  it('le navire posé sur ses ponts reste au contact des cases du dehors que sa coque borde', () => {
    duel('embuscade-fluviale', 'enc-fluvial');
    const scene = banc.getState().scene!;
    const navire = banc.getState().battle!.combatants.find((c) => c.surSesPonts)!;
    const coque = footprintTiles(navire.pos!, footprintN(navire));
    const z = navire.pos!.z ?? 0;
    const dehors: Combatant[] = [];
    for (const c of coque) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const p = { x: c.x + dx, y: c.y + dy };
      if (coque.some((t) => t.x === p.x && t.y === p.y) || !isWalkable(scene, p.x, p.y, z)) continue;
      if (!coque.every((t) => chebyshev(t, p) > 1 || wallOnSight(scene, p, t, z))) continue;
      dehors.push({ ...navire, id: `dehors-${p.x}-${p.y}`, surSesPonts: undefined, footprint: undefined, size: undefined, pos: { x: p.x, y: p.y, z } } as Combatant);
    }
    expect(dehors.length, 'des cases du dehors que la coque sépare de chaque case du navire').toBeGreaterThan(0);
    for (const d of dehors) expect(contact(d, navire), d.id).toBe(1);
  });
});

describe('#4105 — une porte de fenetre-ecuries', () => {
  it('fermée par `setDoorOpen` : pas de contact ; rouverte : contact, sans reposer personne', () => {
    const { H, E, poser } = duel('fenetre-ecuries', 'enc-homme-de-main');
    const s0 = banc.getState().scene!;
    const porte = areteCherchee(s0, (w, a, b) => porteEnJeu(s0, w)
      && occulte(setDoorOpen(s0, w.x, w.y, w.side, 0, false), a, b) && !occulte(setDoorOpen(s0, w.x, w.y, w.side, 0, true), a, b));
    expect(porte, 'fenetre-ecuries ne porte plus de porte en jeu entre deux cases praticables, qui occulte fermée et laisse voir ouverte').toBeDefined();
    const { w, a, b } = porte!;
    poser(H, { ...a, z: 0 });
    poser(E, { ...b, z: 0 });
    banc.setState({ scene: setDoorOpen(banc.getState().scene!, w.x, w.y, w.side, 0, false) });
    expect(barre(banc.getState().scene!, a, b), 'la porte est fermée').toBe(true);
    expect(contact(H, E)).toBe(Infinity);
    expect(attackPlan(banc.getState, H, E).kind).not.toBe('attaque');
    const avant = { h: { ...H.pos }, e: { ...E.pos } };
    banc.setState({ scene: setDoorOpen(banc.getState().scene!, w.x, w.y, w.side, 0, true) });
    expect({ h: H.pos, e: E.pos }).toEqual(avant);
    expect(contact(H, E)).toBe(1);
    expect(attackPlan(banc.getState, H, E).kind).toBe('attaque');
  });
});

describe('#4105 — coins et arêtes que la vue traverse (courDeFerme)', () => {
  it('diagonale au bout d’un mur (un contournement occulté) : contact ; coin plein (les deux occultés) : aucun', () => {
    const { H, E, poser } = duelALaCour();
    const s = banc.getState().scene!;
    const bout = { a: COUR.auBoutDuMur, b: COUR.sousLaCroisee };
    const coin = { a: COUR.angleDehors, b: COUR.angleDedans };
    expect([bout, coin].map(({ a, b }) => [praticable(s, a) && praticable(s, b), contournementsOccultants(s, a, b)])).toEqual([[true, 1], [true, 2]]);
    poser(H, bout.a);
    poser(E, bout.b);
    expect(contact(H, E)).toBe(1);
    poser(H, coin.a);
    poser(E, coin.b);
    expect(contact(H, E)).toBe(Infinity);
  });

  it('croisée ouverte et clôture en clayonnage, qui barrent le pas sans occulter : contact inchangé', () => {
    const { H, E, poser } = duelALaCour();
    const s = banc.getState().scene!;
    const croisee = { a: COUR.devantLaCroisee, b: COUR.sousLaCroisee };
    const cloture = { a: COUR.box, b: COUR.allee };
    const arete = ({ a, b }: { a: Case; b: Case }) => { const e = edgeOf(a.x, a.y, b.x, b.y)!; return aretesA(s, e.x, e.y, e.side, 0); };
    expect(arete(croisee).some((w) => w.window && !w.shuttered), 'une croisée ouverte').toBe(true);
    expect(arete(cloture).map((w) => w.structure)).toContain('cloture-en-clayonnage');
    for (const { a, b } of [croisee, cloture]) {
      expect([praticable(s, a), praticable(s, b), barre(s, a, b), occulte(s, a, b)], `${a.x},${a.y} ~ ${b.x},${b.y}`).toEqual([true, true, true, false]);
      poser(H, a);
      poser(E, b);
      expect(contact(H, E), `${a.x},${a.y} ~ ${b.x},${b.y}`).toBe(1);
    }
  });

  it('une structure de siège est au contact des deux côtés de son arête', () => {
    const { H, poser } = duelALaCour();
    const s = banc.getState().scene!;
    const { x, y } = COUR.angleDedans;
    const mur = banc.getState().battle!.combatants.find((c) => isStructure(c) && c.pos?.x === x && c.pos.y === y && wallBetween(s, x, y, x, y - 1, 0))!;
    expect(mur, 'la structure de l’arête nord de l’angle de la cabane').toBeTruthy();
    expect([isWalkable(s, x, y, 0), isWalkable(s, x, y - 1, 0)]).toEqual([true, true]);
    poser(H, { x, y, z: 0 });
    expect(contact(H, mur)).toBeLessThanOrEqual(1);
    poser(H, { x, y: y - 1, z: 0 });
    expect(contact(H, mur)).toBeLessThanOrEqual(1);
  });
});

/** #4105 lot 3 : décision de Clément du 2026-11-13 (commentaire 6861489526), « Non, pas de coup ». Herse posée sur
 *  l'arête libre de `courDeFerme`, entre `COUR.enHaut` et `COUR.enBas`. LDB 13 l.114 ; AA 10 l.42. */
describe('#4105 lot 3 — la herse baissée sépare pour le corps à corps', () => {
  const HAUT = COUR.enHaut, BAS = COUR.enBas;
  const ARC = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, range: 48, reload: 0, qualities: [], uid: 'arc', loaded: true } as unknown as Weapon;
  /** Le duel, la herse posée sur l'arête (porte fermée par défaut : baissée), H en haut et E en bas. */
  const herse = (patch: Partial<WallSeg> = {}) => {
    const d = duelALaCour();
    const s = banc.getState().scene!;
    expect(barre(s, HAUT, BAS), 'l’arête est libre avant la herse').toBe(false);
    banc.setState({ scene: { ...s, walls: [...s.walls!, { x: BAS.x, y: BAS.y, side: 'N', structure: 'herse', door: true, closed: true, ...patch }] } });
    d.poser(d.H, HAUT);
    d.poser(d.E, BAS);
    return d;
  };

  it('baissée : ni contact, ni coup sur place, ni Surnombre ; une Charge doit la contourner', () => {
    const { H, E } = herse();
    expect(contact(H, E)).toBe(Infinity);
    expect(contact(E, H)).toBe(Infinity);
    for (const [A, B] of [[H, E], [E, H]] as const) {
      const plan = attackPlan(banc.getState, A, B);
      expect(plan.kind, `${A.id} ne frappe pas à travers`).not.toBe('attaque');
      if (plan.kind === 'charge') expect(plan.dest, `la Charge de ${A.id} ne s’arrête pas sur sa case`).not.toMatchObject({ x: A.pos!.x, y: A.pos!.y });
    }
    expect(effectifAuContactParmi(banc.getState().scene, banc.getState().battle!.combatants, E, 'heros')).toBe(0);
  });

  it('baissée : la vue passe, et le tir à travers reste offert sans couvert', () => {
    const { H, E } = herse();
    expect(lineOfSightCover(banc.getState().scene!, HAUT, BAS, []).blocked).toBe(false);
    const tir = attackEnv(banc.getState, H, E, ARC);
    expect(tir.blocked).toBe(false);
    expect(ligneDe(tir.env, RULE_REF['cible-sous-couverture'])).toBeUndefined();
  });

  it('posée en mur, sans porte : elle sépare de même', () => {
    const { H, E } = herse({ door: undefined, closed: undefined });
    expect(contact(H, E)).toBe(Infinity);
  });

  it('levée (porte ouverte) puis abattue : le contact revient', () => {
    const { H, E } = herse();
    banc.setState({ scene: setDoorOpen(banc.getState().scene!, BAS.x, BAS.y, 'N', 0, true) });
    expect(contact(H, E)).toBe(1);
    banc.setState({ scene: setStructureDown(setDoorOpen(banc.getState().scene!, BAS.x, BAS.y, 'N', 0, false), BAS.x, BAS.y, 'N', 0, true) });
    expect(contact(H, E)).toBe(1);
  });

  it('en diagonale au coin de la herse, un contournement libre : le contact tient', () => {
    const { H, E, poser } = herse();
    poser(H, { x: HAUT.x - 1, y: HAUT.y, z: 0 });
    expect(contact(H, E)).toBe(1);
  });
});
