import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { MELEE, ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeContact } from '../monde/footprint';
import { aretesA } from '../monde/wallIndex';
import { edgeOf, wallBetween, type Scene } from '../monde/scene';
import { setEdgeWall } from '../sceneEdit';
import { lineOfSightCover } from '../monde/lineOfSight';
import { attackEnv, doAttack, previewAttack, resolveAttack } from '../combatFlow';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { combatGeomOf } from '../mount';
import { seedBattleRng } from '../battleRng';
import { setRule, resetRule } from '../../engine/policy';
import { ligneDe } from '../../engine/modLine.testkit';
import { RULE_REF } from '../../engine/ruleRefs';
import type { Combatant, ModLine, Weapon } from '../../engine/types';

/**
 * #4105 lot 2 : le coup par-dessus un obstacle bas prend le couvert de l'arête qui abrite sa cible, celui du tir.
 * Décision du 2026-11-13 (#4105, commentaire 6849608906) ; AA 10 l.48 ; LDB 14 l.72 ; LDB 14 l.86.
 * Plan de `la-diligence`, chargé par le scénario `ecuries-clayonnage`, combattants posés par `placeCombatant`. Les
 * murets sont ceux de la fixture : `avecLesMurets` pose `mur-en-pierres-seches` sur les arêtes de l'enceinte qu'elle
 * nomme (`setEdgeWall`).
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const MURET = 'mur-en-pierres-seches';
const COUVERT = RULE_REF['cible-sous-couverture'];
const ARC = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, range: 48, reload: 0, qualities: [], uid: 'arc', loaded: true } as unknown as Weapon;
const HALLEBARDE: Weapon = { ...MELEE, label: 'Hallebarde', reach: 'Très longue' } as Weapon;

/** Les arêtes d'enceinte que la fixture fait muret : DEDANS/DEHORS, le coin (8,12) et la ligne (38,27)–(38,28). */
const ARETES_DE_MURET = [[8, 21, 'E'], [8, 12, 'E'], [9, 12, 'N'], [38, 27, 'E'], [38, 28, 'E']] as const;
const avecLesMurets = (s: Scene): Scene =>
  ARETES_DE_MURET.reduce((acc, [x, y, side]) => setEdgeWall(acc, x, y, side, 0, 'wall', MURET), s);

const duel = () => {
  const contenu = testScenarios.find((s) => s.id === 'ecuries-clayonnage')!.construire(idsDeTest);
  return ouvrirLeDuel(banc, { ...contenu, scene: avecLesMurets(contenu.scene) }, 'enc-clayonnage');
};
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

/** Le muret de la fixture : la case (9,21) du relais et la case (8,21) du dehors, de part et d'autre de son arête. */
const DEDANS = { x: 9, y: 21, z: 0 };
const DEHORS = { x: 8, y: 21, z: 0 };
/** La croisée ouverte (12,15,E) d'un mur à ossature : (13,15) d'un côté, (12,15) de l'autre. */
const SOUS_LA_CROISEE = { x: 13, y: 15, z: 0 };
const DEVANT_LA_CROISEE = { x: 12, y: 15, z: 0 };

describe('#4105 lot 2 — un muret de l’enceinte de la-diligence', () => {
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
    const r = resolveAttack(banc.getState, H, E, MELEE, undefined, false, false, false);
    expect(couvertDe(nomme(r!.res.attackerDetail!))).toBe(-10);
    expect(lineOfSightCover(scene(), DEDANS, DEHORS, []).blocked).toBe(false);
    expect(wallBetween(scene(), DEDANS.x, DEDANS.y, DEHORS.x, DEHORS.y, 0)).toBe(true);
  });

  it('tir par-dessus le muret : cible non collée, aucun couvert ; cible collée, −10', () => {
    const { H, E, poser } = duel();
    poser(H, DEHORS);
    poser(E, { x: 10, y: 21, z: 0 });
    const loin = attackEnv(banc.getState, H, E, ARC);
    expect(loin.blocked).toBe(false);
    expect(couvertDe(loin.env)).toBeUndefined();
    poser(H, { x: 12, y: 21, z: 0 });
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
    poser(H, { x: 12, y: 21, z: 0 });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true, intentionId: 'charge' });
    banc.reprendreLesEnAttente();
    expect(banc.getState().pendingAttack?.fromCharge).toBe(true);
    expect(H.pos!.x, 'la case d’arrivée est du côté du relais, au bord du muret').toBe(9);
    banc.getState().jetLancer('attaque');
    banc.reprendreLesEnAttente();
    const detail = banc.getState().pendingAttack?.result?.attackerDetail;
    expect(couvertDe(nomme(detail!))).toBe(-10);
  });

  it('Allonge de deux cases, muret du côté de l’attaquant : à portée, aucune ligne', () => {
    const { H, E, poser } = duel();
    H.weapons = [HALLEBARDE];
    poser(H, DEHORS);
    poser(E, { x: 10, y: 21, z: 0 });
    const p = previewAttack(banc.getState, H, E, undefined, { weapon: HALLEBARDE });
    expect(p.inRange).toBe(true);
    expect(couvertDe(nomme(p))).toBeUndefined();
  });

  it('la diagonale au coin du muret : la cible du dedans, abritée de ses deux arêtes, −10 ; la cible du dehors, aucune', () => {
    const { H, E, poser } = duel();
    const coinDehors = { x: 8, y: 11, z: 0 }, coinDedans = { x: 9, y: 12, z: 0 };
    poser(H, coinDehors);
    poser(E, coinDedans);
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E)).toBe(-10);
    expect(couvertMelee(E, H)).toBeUndefined();
  });
});

describe('#4105 lot 2 — les corps de part et d’autre d’un muret', () => {
  /** Grande : côté 2 (`sizes.json` `footprintSide`) ; ancrée en (37,27), elle borde le muret par (38,27) et (38,28). */
  const ANCRE_GRANDE = { x: 37, y: 27, z: 0 };
  it('cible Grande ancrée (37,27) : frappée de (39,27) puis de (39,28), −10', () => {
    const { H, E, poser } = duel();
    expect(surLArete({ x: 38, y: 28 }, { x: 39, y: 28 }).map((w) => w.structure)).toContain(MURET);
    E.size = 'grande';
    poser(E, ANCRE_GRANDE);
    for (const h of [{ x: 39, y: 27, z: 0 }, { x: 39, y: 28, z: 0 }]) {
      poser(H, h);
      expect(contact(H, E)).toBe(1);
      expect(couvertMelee(H, E), `attaquant en (${h.x},${h.y})`).toBe(-10);
    }
  });

  it('cible Grande ancrée (37,27), tir à bout portant de (39,28) : −10', () => {
    const { H, E, poser } = duel();
    E.size = 'grande';
    poser(E, ANCRE_GRANDE);
    poser(H, { x: 39, y: 28, z: 0 });
    const tir = attackEnv(banc.getState, H, E, ARC);
    expect(tir.blocked).toBe(false);
    expect(couvertDe(tir.env)).toBe(-10);
  });

  it('attaquant Grand ancré (21,8), cible Moyenne en (20,8), muret sous la cible seule : sa case (21,9) le regarde, −10', () => {
    const { H, E, poser } = duel();
    const s = scene();
    banc.setState({ scene: { ...s, walls: [...s.walls!, { x: 20, y: 9, side: 'N', structure: MURET }] } });
    poser(E, { x: 20, y: 8, z: 0 });
    H.size = 'grande';
    poser(H, { x: 21, y: 8, z: 0 });
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E)).toBe(-10);
  });

  it('une seule arête de muret entre deux Grands, (38,27,E) ou (38,28,E) : le même −10, en mêlée et au tir', () => {
    const { H, E, poser } = duel();
    const s = scene();
    /** Le relevé quand le muret de la ligne `y` est retiré. */
    const releve = (y: number) => {
      const retiree = surLArete({ x: 38, y }, { x: 39, y }).find((w) => w.structure === MURET)!;
      banc.setState({ scene: { ...s, walls: s.walls!.filter((w) => w !== retiree) } });
      E.size = 'grande';
      H.size = 'grande';
      poser(E, ANCRE_GRANDE);
      poser(H, { x: 39, y: 27, z: 0 });
      return { contact: contact(H, E), melee: couvertMelee(H, E), tir: couvertDe(attackEnv(banc.getState, H, E, ARC).env) };
    };
    expect(releve(28), 'muret seul en (38,27,E)').toEqual({ contact: 1, melee: -10, tir: -10 });
    expect(releve(27), 'muret seul en (38,28,E)').toEqual({ contact: 1, melee: -10, tir: -10 });
  });

  it('chef d’un bélier derrière le muret, sa coque 2×2 au loin sur la route : le tir le couvre de −10, sur son propre corps', () => {
    const { H, E, poser } = duel();
    const belier = { uid: 'ram-w', trappingId: 'belier-test', name: 'Bélier', kind: 'melee', damage: { plusBF: true, flat: 10 }, qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'machine-de-guerre' };
    const poste = { item: belier, crewIds: [E.id] } as unknown as NonNullable<Combatant['mannedPoste']>;
    const coque = { ...E, id: 'coque', name: 'Affût', pos: { x: 20, y: 8, z: 0 }, conditions: [], postes: [poste], footprint: 2, size: undefined, bodyShape: 'engin', inert: true } as unknown as Combatant;
    poser(E, { x: 38, y: 27, z: 0 });
    poser(H, { x: 40, y: 27, z: 0 });
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, combatants: [...b.combatants, coque] } });
    E.mannedPoste = poste;
    expect(combatGeomOf(banc.getState().battle!, E).id, 'la géométrie de combat du chef est sa coque').toBe('coque');
    expect(couvertDe(attackEnv(banc.getState, H, E, ARC).env)).toBe(-10);
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
    poser(H, { x: 16, y: 15, z: 0 });
    expect(couvertDe(attackEnv(banc.getState, H, E, ARC).env)).toBeUndefined();
  });
});

describe('#4291 — le couvert du coup porte sur son passage, dans les deux sens', () => {
  afterEach(() => resetRule('combat-croisee-melee-difficulte'));
  it('en diagonale par le coin de la croisée, l’arête du côté de l’attaquant couvre la cible comme celle de son côté', () => {
    const { H, E, poser } = duel();
    poser(H, SOUS_LA_CROISEE);
    poser(E, { x: 12, y: 14, z: 0 });
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E), 'la croisée est du côté de l’attaquant').toBe(-30);
    expect(couvertMelee(E, H), 'la croisée est du côté de la cible').toBe(-30);
    setRule('combat-croisee-melee-difficulte', 'difficile');
    expect(couvertMelee(H, E)).toBe(-20);
  });
});

describe('#4105 lot 2 — non-régression (verts avant et après le lot)', () => {
  it('le tir par la croisée ouverte garde un cran de moins que son mur : aucune ligne', () => {
    const { H, E, poser } = duel();
    poser(H, { x: 16, y: 15, z: 0 });
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

  it('volets clos au bout du mur (4,8,E retirée) : la croisée couvre comme son mur, en mêlée et au tir', () => {
    const { H, E, poser } = duel();
    const s = scene();
    const croisee = surLArete(SOUS_LA_CROISEE, DEVANT_LA_CROISEE).find((w) => w.window)!;
    const bout = surLArete({ x: 12, y: 14 }, { x: 13, y: 14 })[0]!;
    const releve = (patch: Partial<typeof croisee>) => {
      banc.setState({ scene: { ...s, walls: s.walls!.filter((w) => w !== bout).map((w) => (w === croisee ? { ...w, ...patch } : w)) } });
      poser(E, SOUS_LA_CROISEE);
      poser(H, { x: 12, y: 14, z: 0 });
      const melee = { contact: contact(H, E), couvert: couvertMelee(H, E) };
      poser(H, { x: 9, y: 12, z: 0 });
      return { ...melee, tir: couvertDe(attackEnv(banc.getState, H, E, ARC).env) };
    };
    const mur = releve({ window: undefined });
    expect(mur).toEqual({ contact: 1, couvert: -10, tir: -10 });
    expect(releve({ shuttered: true })).toEqual(mur);
  });

  it('la clôture en clayonnage d’une box des écuries : contact, aucune ligne', () => {
    const { H, E, poser } = duel();
    const box = { x: 29, y: 35, z: 0 }, allee = { x: 30, y: 35, z: 0 };
    expect(surLArete(box, allee).map((w) => w.structure)).toContain('cloture-en-clayonnage');
    poser(H, allee);
    poser(E, box);
    expect(contact(H, E)).toBe(1);
    expect(couvertMelee(H, E)).toBeUndefined();
  });
});
