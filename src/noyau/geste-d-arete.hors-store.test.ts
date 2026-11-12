import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from './monde/scene';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { createHero } from '../engine/character';
import { placeCombatant } from './monde/spawn';
import { testScene } from '../scenes/test-fixture';
import { engage, disengageFrom } from '../engine/engagement';
import { mountUp } from './mount';
import { computeMoveReach, resolveMovement } from './combatFlow';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { GUEST_INTENTS } from './intentionsDeSiege';
import { planFranchissement, phaseDeChute } from './fallMove';
import { REFUS_FRANCHISSEMENT, gesteDArete, type GesteDeplacant } from './gesteDArete';
import { climbMovementCost } from '../engine/movement';
import { sceneMetresPerTile } from './monde/scene';
import { t, type MsgKey } from '../i18n';
import type { Pt } from './monde/path';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * PORTEUR d'un geste d'arête (#700, #2190) : UNE réponse pour `franchirLArete`, quelle que soit la capacité
 * de l'arête (`noyau/gesteDArete.ts`) — Engagé : LDB 15 l.43-49 ; cavalier : LDB 14 l.179 (#2205) ;
 * `from` falsifié (#2190). Chaque refus est NOMMÉ par `refuserGeste` (`noyau/refusVisible.ts`) : la bannière
 * `refus` en combat, le journal hors combat.
 */

const g = () => banc.getState();
const NET0 = initialNet();

/** Pied (2,1) au sol, sommet (2,0) à 4 m ; l'arête N de (2,1) porte `climb` si fourni. */
function falaise(climb?: WallClimb): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const h = new Array(16).fill(0) as number[];
  h[2] = 4;
  s.layers[0].height = h;
  if (climb) s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}
/** Croisée franchissable de plain-pied, E de (1,1) sur (2,1). */
function croisee(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  s.walls = [{ x: 1, y: 1, side: 'E', window: true, crossable: true, allege: 1 }];
  return s;
}
/** Croisée franchissable d'étage : (1,1) à la couche 1 (4 m) sur la rue (2,1) au rez. */
function croiseeDEtage(): Scene {
  const s = emptyScene('scene-test', 4, 3);
  const tiles = new Array(12).fill('vide') as Terrain[];
  tiles[1 * 4 + 1] = s.layers[0].tiles[0];
  const height = new Array(12).fill(0) as number[];
  height[1 * 4 + 1] = 4;
  s.layers.push({ z: 1, tiles, height });
  s.walls = [{ x: 1, y: 1, side: 'E', z: 1, window: true, crossable: true, allege: 1 }];
  return s;
}

const foot = { x: 2, y: 1 };
const top = { x: 2, y: 0 };

type CasGeste = { geste: GesteDeplacant; scene: () => Scene; de: Pt; vers: Pt; agir: (vers: Pt) => void };
const CAS: readonly CasGeste[] = [
  { geste: 'escalade', scene: () => falaise({ kind: 'ladder' }), de: foot, vers: top, agir: (vers) => g().franchirLArete(vers) },
  { geste: 'chute', scene: () => falaise(), de: top, vers: foot, agir: (vers) => g().franchirLArete(vers) },
  { geste: 'fenetre', scene: croisee, de: { x: 1, y: 1 }, vers: { x: 2, y: 1 }, agir: (vers) => g().franchirLArete(vers) },
];

/** La surface où le refus se dit (`refuserGeste`) : la bannière en combat, le journal hors combat. */
const dernierMot = (): string | undefined => (g().battle ? g().refus?.texte : g().journal.slice(-1)[0]);
const dit = (cle: MsgKey, vars: Record<string, string | number> = {}) => expect(dernierMot()).toBe(t(cle, vars));

/** Combat : héros actif posté en `pos` sur `scene`, ennemis hors d'action (sauf `foe`, rendu vivant à la demande). */
function combat(scene: Scene, pos: Pt, tour: { movementUsed?: number; acted?: boolean; movedPreAction?: boolean } = {}) {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero], net: NET0 });
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const foes = b.combatants.filter((c) => c.kind === 'ennemi');
  foes.forEach((e) => (e.dead = true));
  H.engagedWith = [];
  placeCombatant(H, scene, pos);
  banc.setState({ scene, journal: [], refus: null, pendingFall: null, pendingTest: null, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, ...tour, reachable: new Map(), preview: null } });
  return { H, foe: foes[0] };
}

/** Le geste a-t-il agi ? — le mobile n'est plus sur `de`, ou la modale de chute est ouverte. */
const aAgi = (id: string, de: Pt): boolean => {
  if (g().pendingFall) return true;
  const p = g().battle!.combatants.find((c) => c.id === id)!.pos!;
  return p.x !== de.x || p.y !== de.y;
};

describe('Engagé (LDB 15 l.43-49) : les TROIS gestes refusent, et se rouvrent au Désengagement', () => {
  for (const c of CAS) {
    it(`${c.geste} : refus NOMMÉ engagé, puis permis après \`disengageFrom\``, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      engage(H, foe);
      c.agir(c.vers);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('geste.refus.engage', { name: H.label });
      expect(resolveMovement(g, c.vers)).toEqual({ status: 'bloque', reason: 'engage' }); // MÊME préfixe
      disengageFrom(H, foe);
      c.agir(c.vers);
      expect(aAgi(H.id, c.de)).toBe(true);
    });
  }
});

describe('#2190, #3611 — la case de départ se lit dans l’état : une destination sans arête franchissable depuis la case du mobile est refusée', () => {
  const ailleurs = { x: 0, y: 3 };
  /** Ce que dit le pas de `ailleurs` vers la destination du geste `c` : il n'a pas d'arête à franchir. */
  const refusDuPas = (c: CasGeste): MsgKey => {
    const plan = planFranchissement(c.scene(), ailleurs, c.vers);
    if (plan.kind !== 'none') throw new Error(`${c.geste} : le pas depuis ailleurs doit être un plan \`none\``);
    return REFUS_FRANCHISSEMENT[plan.raison];
  };

  for (const c of CAS) {
    it(`${c.geste} en combat : l’actif reste en place, refus NOMMÉ`, () => {
      const { H } = combat(c.scene(), ailleurs);
      c.agir(c.vers);
      expect(aAgi(H.id, ailleurs)).toBe(false);
      dit(refusDuPas(c));
    });
  }

  it('exploration : le groupe ne se téléporte pas', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    for (const c of CAS) {
      banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: ailleurs, scene: c.scene(), pendingFall: null, dialogue: null, journal: [] });
      c.agir(c.vers);
      expect(g().partyPos, c.geste).toEqual(ailleurs);
      expect(g().pendingFall, c.geste).toBeNull();
      dit(refusDuPas(c));
    }
  });

  it('intent COOP : l’allowlist le laisse passer, le store le refuse loin de l’arête — et depuis la case de l’arête il passe', () => {
    const c = CAS[2];
    const { H } = combat(c.scene(), ailleurs);
    banc.setState({ net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } });
    expect(GUEST_INTENTS.has('franchirLArete')).toBe(true);
    expect(intentAllowedFor(g(), 1, 'franchirLArete', [c.vers])).toBe(true);
    withActingSeat(1, () => g().franchirLArete(c.vers));
    expect(aAgi(H.id, ailleurs)).toBe(false);
    dit(refusDuPas(c));
    const b = g().battle!;
    placeCombatant(b.combatants.find((x) => x.id === H.id)!, g().scene!, c.de);
    withActingSeat(1, () => g().franchirLArete(c.vers));
    expect(g().battle!.combatants.find((x) => x.id === H.id)!.pos).toMatchObject(c.vers);
  });
});

describe('#3611 — toute destination hostile se refuse, dite, sans lever ni déplacer', () => {
  it.each([
    ['la case même du mobile', { x: 2, y: 2 }],
    ['hors de la carte, loin', { x: 50, y: 50 }],
    ['en diagonale', { x: 3, y: 3 }],
    ['voisine, sans arête', { x: 2, y: 3 }],
    ['hors de la carte, coordonnée négative', { x: -3, y: 2 }],
  ] as const)('%s', (_cas, vers) => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const scene = emptyScene('scene-test', 6, 6);
    banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: { x: 2, y: 2 }, scene, pendingFall: null, dialogue: null, journal: [] });
    const plan = planFranchissement(scene, { x: 2, y: 2 }, vers);
    if (plan.kind !== 'none') throw new Error('une scène sans arête ne planifie aucun franchissement');
    expect(() => g().franchirLArete(vers)).not.toThrow();
    expect(g().partyPos).toEqual({ x: 2, y: 2 });
    dit(REFUS_FRANCHISSEMENT[plan.raison]);
  });
});

describe('couple monté (LDB 14 l.179 ; CRB 032 l.53 ; #2205) : refus NOMMÉ qui désigne « Descendre »', () => {
  for (const c of CAS) {
    it(`${c.geste} : cavalier actif → geste.refus.monte`, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      placeCombatant(foe, g().scene!, c.de);
      mountUp(H, foe);
      c.agir(c.vers);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('geste.refus.monte', { action: 'Descendre' });
      expect(dernierMot()).toContain('« Descendre »');
    });

    it(`${c.geste} : monture active qui porte son cavalier (ennemi mené par le siège MJ) → geste.refus.monte`, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      placeCombatant(foe, g().scene!, c.de);
      mountUp(H, foe);
      banc.setState({ net: { ...NET0, gmSeat: 0 }, battle: { ...g().battle!, turn: g().battle!.order.indexOf(foe.id) } });
      c.agir(c.vers);
      expect(aAgi(foe.id, c.de)).toBe(false);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('geste.refus.monte', { action: 'Descendre' });
    });
  }
});

describe('coûts et refus NOMMÉS (A4)', () => {
  it('escalade, combat : Mouvement restant sous le coût → refus NOMMÉ, rien ne bouge', () => {
    const { H } = combat(falaise({ kind: 'ladder' }), foot, { movementUsed: 3 });
    g().franchirLArete(top);
    expect(aAgi(H.id, foot)).toBe(false);
    expect(g().battle!.movementUsed).toBe(3);
    dit('climb.mouvementInsuffisant', { name: H.label, cout: climbMovementCost(4, sceneMetresPerTile(g().scene!)) });
  });

  it('escalade/chute, combat : Mouvement épuisé (`canMove`) → refus NOMMÉ', () => {
    for (const c of CAS.slice(0, 2)) {
      const { H } = combat(c.scene(), c.de, { movementUsed: 4 });
      c.agir(c.vers);
      expect(aAgi(H.id, c.de), c.geste).toBe(false);
      dit('geste.refus.mouvementEpuise', { name: H.label });
    }
  });

  it('escalade à Test, Action déjà prise → refus NOMMÉ (pas d’Action gratuite)', () => {
    const { H } = combat(falaise({ kind: 'surface' }), foot, { acted: true });
    g().franchirLArete(top);
    expect(aAgi(H.id, foot)).toBe(false);
    dit('climb.actionDejaPrise', { name: H.label });
  });

  it('chute : « Tenter » avec l’Action déjà prise → refus NOMMÉ, la modale reste au choix', () => {
    const { H } = combat(falaise(), top, { acted: true });
    g().franchirLArete(foot);
    expect(phaseDeChute(g().pendingFall!)).toBe('choix');
    g().jetRegler('chute', 'tenter', true, H.id);
    expect(phaseDeChute(g().pendingFall!)).toBe('choix');
    dit('fall.actionDejaPrise', { name: H.label });
    g().jetRegler('chute', 'tenter', false, H.id); // sauter sans Test reste permis
    expect(g().battle!.combatants.find((x) => x.id === H.id)!.pos).toMatchObject(foot);
    expect(g().battle!.acted).toBe(true);
  });

  it('exploration : dialogue ouvert → refus NOMMÉ pour les trois gestes', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    for (const c of CAS) {
      banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: c.de, scene: c.scene(), pendingFall: null, dialogue: {} as never, journal: [] });
      expect('refus' in gesteDArete(g()), c.geste).toBe(true);
      c.agir(c.vers);
      expect(g().partyPos, c.geste).toEqual(c.de);
      dit('geste.refus.dialogue');
    }
    banc.setState({ dialogue: null });
  });

  it('plans refusés : sommet inaccessible, pas sans capacité (plan `none`) ; la croisée d’étage se lit en chute', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const explorer = (scene: Scene, pos: Pt) => banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: pos, scene, pendingFall: null, dialogue: null, journal: [] });
    const creux = falaise({ kind: 'ladder' });
    creux.layers[0].tiles[2] = 'vide' as Terrain;
    explorer(creux, foot);
    g().franchirLArete(top);
    expect(g().partyPos).toEqual(foot);
    dit('climb.sommetInaccessible', { name: hero.label });
    explorer(falaise(), foot);
    const plan = planFranchissement(falaise(), foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    g().franchirLArete(top);
    dit(REFUS_FRANCHISSEMENT[plan.raison]);
    explorer(croiseeDEtage(), { x: 1, y: 1, z: 1 });
    g().franchirLArete({ x: 2, y: 1 });
    expect(g().pendingFall, 'la capacité de la croisée d’étage est la chute').toBeTruthy();
  });
});

describe('refus du PRÉFIXE (`mobileDuTour`), dits par le geste', () => {
  const c = CAS[2];
  it('combat terminé → geste.refus.combatTermine', () => {
    const { H } = combat(c.scene(), c.de);
    banc.setState({ battle: { ...g().battle!, over: 'victoire' } });
    c.agir(c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.combatTermine');
  });
  it('action armée → geste.refus.ciblage', () => {
    const { H } = combat(c.scene(), c.de);
    banc.setState({ battle: { ...g().battle!, action: 'incantation' } });
    c.agir(c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.ciblage');
  });
  it('aucun actif → geste.refus.aucunActif', () => {
    const { H } = combat(c.scene(), c.de);
    banc.setState({ battle: { ...g().battle!, turn: g().battle!.order.length } });
    c.agir(c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.aucunActif');
  });
  it('actif mené par un autre siège → geste.refus.pasLaMain', () => {
    const { H } = combat(c.scene(), c.de);
    banc.setState({ net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } });
    c.agir(c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.pasLaMain', { name: H.label });
  });
  it('refus en combat : dit à la bannière (`refus`), jamais au seul journal', () => {
    const { H } = combat(c.scene(), c.de);
    banc.setState({ battle: { ...g().battle!, action: 'incantation' } });
    c.agir(c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    expect(g().journal).toEqual([]);
    expect(g().refus?.texte).toBe(t('geste.refus.ciblage'));
  });
});

describe('`computeMoveReach` consomme le préfixe : une action armée éteint la marche affichée', () => {
  it('action nulle → cases ; action armée → aucune (comme `resolveMovement`)', () => {
    combat(croisee(), { x: 0, y: 0 });
    expect(computeMoveReach(g).size).toBeGreaterThan(0);
    banc.setState({ battle: { ...g().battle!, action: 'incantation' } });
    expect(computeMoveReach(g).size).toBe(0);
    expect(resolveMovement(g, { x: 0, y: 1 })).toEqual({ status: 'bloque', reason: 'designation' });
  });
});

describe('case d’arrivée occupée, en combat', () => {
  for (const c of CAS.slice(0, 2)) {
    it(`${c.geste} : arrivée occupée → franchir.caseOccupee`, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      foe.engagedWith = [];
      placeCombatant(foe, g().scene!, c.vers);
      c.agir(c.vers);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('franchir.caseOccupee', { name: H.label });
    });
  }
});

describe('Test d’Escalade (LDB 15 l.57) : celui du GRIMPEUR', () => {
  /** Deux héros : `H` (actif, sans Escalade) et `S` (fort en Escalade), `S` loin du pied. */
  function deuxHeros() {
    const H = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const S = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'S', seed: 2 });
    S.skills = [...S.skills.filter((k) => k.id !== 'escalade'), { id: 'escalade', characteristic: 'force', advances: 60 }];
    H.skills = H.skills.filter((k) => k.id !== 'escalade');
    banc.setState({ party: [H, S], net: NET0 });
    g().lancerLaScene(testScene());
    g().lancerLeCombat('enc-mutants');
    g().fenetreValider('debutDuRound');
    const b = g().battle!;
    const cH = b.combatants.find((x) => x.id === H.id)!;
    const cS = b.combatants.find((x) => x.id === S.id)!;
    const foes = b.combatants.filter((x) => x.kind === 'ennemi');
    foes.forEach((e) => { e.dead = true; e.engagedWith = []; });
    cH.engagedWith = []; cS.engagedWith = [];
    const scene = falaise({ kind: 'surface' });
    placeCombatant(cH, scene, foot);
    placeCombatant(cS, scene, { x: 0, y: 3 });
    banc.setState({ scene, journal: [], refus: null, pendingTest: null, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H: cH, S: cS, foe: foes[0] };
  }

  it('un héros faible grimpe : le Test est le sien, pas celui du meilleur du groupe', () => {
    const { H } = deuxHeros();
    g().franchirLArete(top);
    expect(g().pendingTest?.actorId).toBe(H.id);
  });

  it('un ennemi mené par le siège MJ grimpe : le Test est le sien', () => {
    const { H, foe } = deuxHeros();
    foe.dead = false;
    placeCombatant(H, g().scene!, { x: 3, y: 3 });
    placeCombatant(foe, g().scene!, foot);
    banc.setState({ net: { ...NET0, gmSeat: 0 }, battle: { ...g().battle!, turn: g().battle!.order.indexOf(foe.id) } });
    g().franchirLArete(top);
    expect(g().pendingTest?.actorId).toBe(foe.id);
  });
});
