import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { MELEE, ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeContact } from '../monde/footprint';
import { aretesA } from '../monde/wallIndex';
import { edgeOf, wallBetween, type Scene } from '../monde/scene';
import { lineOfSightCover } from '../monde/lineOfSight';
import { attackEnv, doAttack, previewAttack, resolveAttack } from '../combatFlow';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { seedBattleRng } from '../battleRng';
import { setRule, resetRule } from '../../engine/policy';
import { ligneDe } from '../../engine/modLine.testkit';
import { RULE_REF } from '../../engine/ruleRefs';
import type { Combatant, ModLine, Weapon } from '../../engine/types';

/**
 * #4105 lot 2 : le coup par-dessus un obstacle bas prend le couvert de l'arête qui abrite sa cible, celui du tir.
 * Décision du 2026-11-13 (#4105, commentaire 6849608906) ; AA 10 l.48 ; LDB 14 l.72 ; LDB 14 l.86.
 * Plan de `la-diligence`, chargé par le scénario `ecuries-clayonnage`, combattants posés par `placeCombatant`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const MURET = 'mur-en-pierres-seches';
const COUVERT = RULE_REF['cible-sous-couverture'];
const ARC = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, range: 48, reload: 0, qualities: [], uid: 'arc', loaded: true } as unknown as Weapon;
const HALLEBARDE: Weapon = { ...MELEE, label: 'Hallebarde', reach: 'Très longue' } as Weapon;

const duel = () => ouvrirLeDuel(banc, testScenarios.find((s) => s.id === 'ecuries-clayonnage')!.construire(idsDeTest), 'enc-clayonnage');
const scene = (): Scene => banc.getState().scene!;
const contact = (A: Combatant, B: Combatant) => distanceDeContact(scene(), A, B);
/** Ce que la ligne du jet NOMME : ses modificateurs et la composition de sa Difficulté. */
const nomme = (d: { mods?: readonly ModLine[]; difficultyParts?: readonly ModLine[] }): ModLine[] => [...(d.mods ?? []), ...(d.difficultyParts ?? [])];
const couvertDe = (lignes: readonly ModLine[] | undefined) => ligneDe(lignes, COUVERT)?.value;
const couvertMelee = (A: Combatant, B: Combatant) => couvertDe(attackEnv(banc.getState, A, B, MELEE).env);
const surLArete = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const e = edgeOf(a.x, a.y, b.x, b.y)!;
  return aretesA(scene(), e.x, e.y, e.side, 0);
};

/** Le muret de l'enceinte : la case (1,15) du relais et la case (0,15) du dehors, de part et d'autre de son arête. */
const DEDANS = { x: 1, y: 15, z: 0 };
const DEHORS = { x: 0, y: 15, z: 0 };
/** La croisée ouverte (4,9,E) d'un mur à ossature : (5,9) d'un côté, (4,9) de l'autre. */
const SOUS_LA_CROISEE = { x: 5, y: 9, z: 0 };
const DEVANT_LA_CROISEE = { x: 4, y: 9, z: 0 };

describe('#4105 lot 2 — le muret de l’enceinte de la-diligence', () => {
  it('contact 1 des deux côtés ; l’aperçu et la résolution portent le couvert à −10 ; la vue passe ; le pas reste refusé', () => {
    const { H, E, poser } = duel();
    poser(H, DEDANS);
    poser(E, DEHORS);
    expect(surLArete(DEDANS, DEHORS).map((w) => w.structure), 'le muret sépare les deux cases').toContain(MURET);
    expect(contact(H, E)).toBe(1);
    expect(contact(E, H)).toBe(1);
    expect(couvertDe(nomme(previewAttack(banc.getState, H, E, undefined, { weapon: MELEE })))).toBe(-10);
    expect(couvertMelee(E, H)).toBe(-10);
    seedBattleRng(1);
    const r = resolveAttack(banc.getState, H, E, undefined, false, false, false, MELEE);
    expect(couvertDe(nomme(r!.res.attackerDetail!))).toBe(-10);
    expect(lineOfSightCover(scene(), DEDANS, DEHORS, []).blocked).toBe(false);
    expect(wallBetween(scene(), DEDANS.x, DEDANS.y, DEHORS.x, DEHORS.y, 0)).toBe(true);
  });

  it('tir par-dessus le muret : cible non collée, aucun couvert ; cible collée, −10', () => {
    const { H, E, poser } = duel();
    poser(H, DEHORS);
    poser(E, { x: 2, y: 15, z: 0 });
    const loin = attackEnv(banc.getState, H, E, ARC);
    expect(loin.blocked).toBe(false);
    expect(couvertDe(loin.env)).toBeUndefined();
    poser(H, { x: 4, y: 15, z: 0 });
    poser(E, DEHORS);
    const colle = attackEnv(banc.getState, H, E, ARC);
    expect(colle.blocked).toBe(false);
    expect(couvertDe(colle.env)).toBe(-10);
  });

  it('l’attaque de l’IA (`doAttack`) porte la ligne dans le jet figé de la défense', () => {
    const { H, E, poser } = duel();
    poser(H, DEDANS);
    poser(E, DEHORS);
    seedBattleRng(1);
    doAttack(banc.getState, banc.setState, E, H);
    expect(couvertDe(banc.getState().pendingDefense?.env)).toBe(-10);
  });

  it('la Charge du joueur par-dessus le muret porte la ligne, mesurée de sa case d’arrivée', () => {
    const { H, E, poser } = duel();
    poser(E, DEHORS);
    poser(H, { x: 4, y: 15, z: 0 });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true, intentionId: 'charge' });
    banc.reprendreLesEnAttente();
    expect(banc.getState().pendingAttack?.fromCharge).toBe(true);
    expect(H.pos!.x, 'la case d’arrivée est du côté du relais, au bord du muret').toBe(1);
    banc.getState().jetLancer('attaque');
    banc.reprendreLesEnAttente();
    const detail = banc.getState().pendingAttack?.result?.attackerDetail;
    expect(couvertDe(nomme(detail!))).toBe(-10);
  });

  it('Allonge de deux cases, muret du côté de l’attaquant : à portée, aucune ligne', () => {
    const { H, E, poser } = duel();
    H.weapons = [HALLEBARDE];
    poser(H, DEHORS);
    poser(E, { x: 2, y: 15, z: 0 });
    const p = previewAttack(banc.getState, H, E, undefined, { weapon: HALLEBARDE });
    expect(p.inRange).toBe(true);
    expect(couvertDe(nomme(p))).toBeUndefined();
  });

  it('la diagonale au coin du muret : la cible du dedans, abritée de ses deux arêtes, −10 ; la cible du dehors, aucune', () => {
    const { H, E, poser } = duel();
    const coinDehors = { x: 0, y: 5, z: 0 }, coinDedans = { x: 1, y: 6, z: 0 };
    poser(H, coinDehors);
    poser(E, coinDedans);
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E)).toBe(-10);
    expect(couvertMelee(E, H)).toBeUndefined();
  });
});

describe('#4105 lot 2 — la croisée ouverte en mêlée', () => {
  afterEach(() => resetRule('combat-croisee-melee-difficulte'));
  it('la cible prend la valeur de la règle `combat-croisee-melee-difficulte` : −30 par défaut, −20 au cran Difficile', () => {
    const { H, E, poser } = duel();
    poser(H, SOUS_LA_CROISEE);
    poser(E, DEVANT_LA_CROISEE);
    expect(surLArete(SOUS_LA_CROISEE, DEVANT_LA_CROISEE).some((w) => w.window && !w.shuttered), 'une croisée ouverte sépare les deux cases').toBe(true);
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E)).toBe(-30);
    expect(couvertMelee(E, H)).toBe(-30);
    setRule('combat-croisee-melee-difficulte', 'difficile');
    expect(couvertMelee(H, E)).toBe(-20);
  });

  it('la croisée d’un mur sans Structure prend la même valeur en mêlée, et aucune au tir', () => {
    const { H, E, poser } = duel();
    const s = scene();
    const croisee = surLArete(SOUS_LA_CROISEE, DEVANT_LA_CROISEE).find((w) => w.window)!;
    banc.setState({ scene: { ...s, walls: s.walls!.map((w) => (w === croisee ? { ...w, structure: undefined } : w)) } });
    poser(H, SOUS_LA_CROISEE);
    poser(E, DEVANT_LA_CROISEE);
    expect(couvertMelee(H, E)).toBe(-30);
    poser(H, { x: 8, y: 9, z: 0 });
    expect(couvertDe(attackEnv(banc.getState, H, E, ARC).env)).toBeUndefined();
  });
});

describe('#4105 lot 2 — non-régression (verts avant et après le lot)', () => {
  it('le tir par la croisée ouverte garde un cran de moins que son mur : aucune ligne', () => {
    const { H, E, poser } = duel();
    poser(H, { x: 8, y: 9, z: 0 });
    poser(E, DEVANT_LA_CROISEE);
    const tir = attackEnv(banc.getState, H, E, ARC);
    expect(tir.blocked).toBe(false);
    expect(couvertDe(tir.env)).toBeUndefined();
  });

  it('volets clos : la croisée sépare (`Infinity`)', () => {
    const { H, E, poser } = duel();
    const s = scene();
    const croisee = surLArete(SOUS_LA_CROISEE, DEVANT_LA_CROISEE).find((w) => w.window)!;
    banc.setState({ scene: { ...s, walls: s.walls!.map((w) => (w === croisee ? { ...w, shuttered: true } : w)) } });
    poser(H, SOUS_LA_CROISEE);
    poser(E, DEVANT_LA_CROISEE);
    expect(contact(H, E)).toBe(Infinity);
  });

  it('la clôture en clayonnage d’une box des écuries : contact, aucune ligne', () => {
    const { H, E, poser } = duel();
    const box = { x: 21, y: 29, z: 0 }, allee = { x: 22, y: 29, z: 0 };
    expect(surLArete(box, allee).map((w) => w.structure)).toContain('cloture-en-clayonnage');
    poser(H, allee);
    poser(E, box);
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E)).toBeUndefined();
  });
});
