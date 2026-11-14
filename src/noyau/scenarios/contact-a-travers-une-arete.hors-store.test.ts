import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeContact, footprintN, footprintTiles } from '../monde/footprint';
import { areteOcculteEntre, isWalkable, porteEnJeu, setDoorOpen, wallBetween, wallOnSight, type Scene, type WallSeg } from '../monde/scene';
import { attackPlan } from '../combatFlow';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { effectifAuContact } from '../combat/surnombre';
import { isStructure } from '../../engine/structures';
import { chebyshev } from '../../engine/grid';
import { t } from '../../i18n';
import type { Combatant } from '../../engine/types';

/**
 * #4105 : deux combattants qu'une arête pleine sépare ne sont pas au contact. LDB 13 l.94 ; LDB 13 l.114.
 * Scènes réelles chargées par le jeu, combattants posés par `placeCombatant`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const contact = (A: Combatant, B: Combatant) => distanceDeContact(banc.getState().scene, A, B);
const duel = (scenarioId: string, encId: string, tiers?: 'heros' | 'ennemi') =>
  ouvrirLeDuel(banc, testScenarios.find((s) => s.id === scenarioId)!.construire(idsDeTest), encId, tiers);

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

/** La première paire de cases praticables en diagonale, au bord d'une arête de `s`, dont `n` contournements sont occultés. */
function diagonaleCherchee(s: Scene, n: 1 | 2): { a: Case; b: Case } | undefined {
  for (const w of s.walls ?? []) for (const a of casesDe(w) ?? []) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const b = { x: a.x + dx, y: a.y + dy };
    if (praticable(s, a) && praticable(s, b) && contournementsOccultants(s, a, b) === n) return { a, b };
  }
  return undefined;
}

describe('#4105 — la coque de la barge d’embuscade-fluviale', () => {
  it('cale (3,7,0) et dehors (3,8,0) : ni contact, ni mêlée, ni Charge, ni Engagement, ni Surnombre', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(H, { x: 3, y: 7, z: 0 });
    poser(E, { x: 3, y: 8, z: 0 });
    expect(wallBetween(banc.getState().scene!, 3, 7, 3, 8, 0), 'la coque sépare les deux cases').toBe(true);
    expect(contact(H, E)).toBe(Infinity);
    expect(attackPlan(banc.getState, H, E).kind).toBe('bloque');
    expect(attackPlan(banc.getState, E, H).kind).toBe('bloque');
    expect(effectifAuContact(banc.getState().scene, banc.getState().battle!, E, 'heros')).toBe(0);
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
    poser(H, { x: 3, y: 7, z: 0 });
    poser(H2, { x: 3, y: 8, z: 0 });
    expect(wallBetween(banc.getState().scene!, 3, 7, 3, 8, 0), 'la coque sépare les deux cases').toBe(true);
    banc.jouerLaCase('soins');
    expect(banc.getState().battle!.action, 'le Soin armé par sa case').toBe('soins');
    banc.getState().ouvrirLaGuerison(H2.id);
    expect(banc.getState().pendingHeal).toBeFalsy();
    expect(banc.getState().refus?.texte).toBe(t('cf.horsDePortee'));
    expect(banc.getState().battle!.action, 'le refus laisse le Soin armé').toBe('soins');
    poser(H2, { x: 3, y: 6, z: 0 });
    expect(contact(H, H2), 'la case voisine de la cale est au contact').toBe(1);
    banc.getState().ouvrirLaGuerison(H2.id);
    expect(banc.getState().pendingHeal?.targetId).toBe(H2.id);
  });

  it('pont (4,4,1) et cale voisine (3,4,0) : l’arête se lit à la couche la plus haute, le contact tient', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(H, { x: 4, y: 4, z: 1 });
    poser(E, { x: 3, y: 4, z: 0 });
    expect(wallOnSight(banc.getState().scene!, { x: 3, y: 4 }, { x: 4, y: 4 }, 0), 'une arête à la couche basse').toBe(true);
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

describe('#4105 — coins et arêtes que la vue traverse (ecuries-clayonnage)', () => {
  it('diagonale au bout d’un mur (un contournement occulté) : contact ; coin plein (les deux occultés) : aucun', () => {
    const { H, E, poser } = duel('ecuries-clayonnage', 'enc-clayonnage');
    const s = banc.getState().scene!;
    const bout = diagonaleCherchee(s, 1);
    const coin = diagonaleCherchee(s, 2);
    expect(bout, 'ecuries-clayonnage ne porte plus de diagonale praticable dont un seul contournement est occulté').toBeDefined();
    expect(coin, 'ecuries-clayonnage ne porte plus de diagonale praticable dont les deux contournements sont occultés').toBeDefined();
    poser(H, { ...bout!.a, z: 0 });
    poser(E, { ...bout!.b, z: 0 });
    expect(contact(H, E)).toBe(1);
    poser(H, { ...coin!.a, z: 0 });
    poser(E, { ...coin!.b, z: 0 });
    expect(contact(H, E)).toBe(Infinity);
  });

  it('croisée ouverte et clôture en clayonnage, qui barrent le pas sans occulter : contact inchangé', () => {
    const { H, E, poser } = duel('ecuries-clayonnage', 'enc-clayonnage');
    const s = banc.getState().scene!;
    const sansOcculter = (a: Case, b: Case) => barre(s, a, b) && !occulte(s, a, b);
    const croisee = areteCherchee(s, (w, a, b) => !!w.window && !w.shuttered && sansOcculter(a, b));
    const cloture = areteCherchee(s, (w, a, b) => w.structure === 'cloture-en-clayonnage' && sansOcculter(a, b));
    expect(croisee, 'ecuries-clayonnage ne porte plus de croisée ouverte qui barre le pas sans occulter entre deux cases praticables').toBeDefined();
    expect(cloture, 'ecuries-clayonnage ne porte plus de clôture en clayonnage qui barre le pas sans occulter entre deux cases praticables').toBeDefined();
    for (const { a, b } of [croisee!, cloture!]) {
      poser(H, { ...a, z: 0 });
      poser(E, { ...b, z: 0 });
      expect(contact(H, E), `${a.x},${a.y} ~ ${b.x},${b.y}`).toBe(1);
    }
  });

  it('une structure de siège est au contact des deux côtés de son arête', () => {
    const { H, poser } = duel('ecuries-clayonnage', 'enc-clayonnage');
    const s = banc.getState().scene!;
    const mur = banc.getState().battle!.combatants.find((c) => isStructure(c) && c.pos
      && wallBetween(s, c.pos.x, c.pos.y, c.pos.x, c.pos.y - 1, 0) && isWalkable(s, c.pos.x, c.pos.y, 0) && isWalkable(s, c.pos.x, c.pos.y - 1, 0))!;
    expect(mur, 'une structure d’arête nord entre deux cases praticables').toBeTruthy();
    poser(H, { x: mur.pos!.x, y: mur.pos!.y, z: 0 });
    expect(contact(H, mur)).toBeLessThanOrEqual(1);
    poser(H, { x: mur.pos!.x, y: mur.pos!.y - 1, z: 0 });
    expect(contact(H, mur)).toBeLessThanOrEqual(1);
  });
});
