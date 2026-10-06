import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene, type Terrain, type WallClimb } from './scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { engage, disengageFrom } from '../engine/engagement';
import { mountUp } from './mount';
import { computeMoveReach, resolveMovement } from './combatFlow';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { GUEST_INTENTS } from '../net/intents';
import { planFranchissement, phaseDeChute } from './fallMove';
import { REFUS_FRANCHISSEMENT, gesteDArete, type GesteDeplacant } from './gesteDArete';
import { climbMovementCost } from '../engine/movement';
import { sceneMetresPerTile } from './scene';
import { t, type MsgKey } from '../i18n';
import type { Pt } from './path';

/**
 * PORTEUR d'un geste d'arête (#700, #2190) : UNE réponse pour `climbAcross`, `fallAcross`,
 * `windowAcross` (`state/gesteDArete.ts`) — Engagé : LDB 15 l.43-49 ; cavalier : LDB 14 l.179 (#2205) ;
 * `from` falsifié (#2190). Chaque refus est NOMMÉ par `refuserGeste` (`state/refusVisible.ts`) : la bannière
 * `refus` en combat, le journal hors combat.
 */

const g = useGame.getState;
const NET0 = g().net;

/** Pied (2,1) au sol, sommet (2,0) à 4 m ; l'arête N de (2,1) porte `climb` si fourni. */
function falaise(climb?: WallClimb): Scene {
  const s = emptyScene(4, 4);
  const h = new Array(16).fill(0) as number[];
  h[2] = 4;
  s.layers[0].height = h;
  if (climb) s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}
/** Croisée franchissable de plain-pied, E de (1,1) sur (2,1). */
function croisee(): Scene {
  const s = emptyScene(4, 4);
  s.walls = [{ x: 1, y: 1, side: 'E', window: true, crossable: true, allege: 1 }];
  return s;
}
/** Croisée franchissable d'étage : (1,1) à la couche 1 (4 m) sur la rue (2,1) au rez. */
function croiseeDEtage(): Scene {
  const s = emptyScene(4, 3);
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

type CasGeste = { geste: GesteDeplacant; scene: () => Scene; de: Pt; vers: Pt; agir: (de: Pt, vers: Pt) => void };
const CAS: readonly CasGeste[] = [
  { geste: 'escalade', scene: () => falaise({ kind: 'ladder' }), de: foot, vers: top, agir: (de, vers) => g().climbAcross(de, vers) },
  { geste: 'chute', scene: () => falaise(), de: top, vers: foot, agir: (de, vers) => g().fallAcross(de, vers) },
  { geste: 'fenetre', scene: croisee, de: { x: 1, y: 1 }, vers: { x: 2, y: 1 }, agir: (de, vers) => g().windowAcross(de, vers) },
];

/** La surface où le refus se dit (`refuserGeste`) : la bannière en combat, le journal hors combat. */
const dernierMot = (): string | undefined => (g().battle ? g().refus?.texte : g().journal.slice(-1)[0]);
const dit = (cle: MsgKey, vars: Record<string, string | number> = {}) => expect(dernierMot()).toBe(t(cle, vars));

/** Combat : héros actif posté en `pos` sur `scene`, ennemis hors d'action (sauf `foe`, rendu vivant à la demande). */
function combat(scene: Scene, pos: Pt, tour: { movementUsed?: number; acted?: boolean; movedPreAction?: boolean } = {}) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero], net: NET0 });
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const foes = b.combatants.filter((c) => c.kind === 'enemy');
  foes.forEach((e) => (e.dead = true));
  H.engagedWith = [];
  placeCombatant(H, scene, pos);
  useGame.setState({ scene, journal: [], refus: null, pendingFall: null, pendingTest: null, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, ...tour, reachable: new Map(), preview: null } });
  return { H, foe: foes[0] };
}

/** Le geste a-t-il agi ? — le mobile n'est plus sur `de`, ou la modale de chute est ouverte. */
const aAgi = (id: string, de: Pt): boolean => {
  if (g().pendingFall) return true;
  const p = g().battle!.combatants.find((c) => c.id === id)!.pos!;
  return p.x !== de.x || p.y !== de.y;
};

describe('Engagé (LDB 15 l.43-49) : les TROIS gestes refusent, et se rouvrent au Désengagement', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  for (const c of CAS) {
    it(`${c.geste} : refus NOMMÉ engagé, puis permis après \`disengageFrom\``, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      engage(H, foe);
      c.agir(c.de, c.vers);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('geste.refus.engage', { name: H.label });
      expect(resolveMovement(g, c.vers)).toEqual({ status: 'blocked', reason: 'engaged' }); // MÊME préfixe
      disengageFrom(H, foe);
      c.agir(c.de, c.vers);
      expect(aAgi(H.id, c.de)).toBe(true);
    });
  }
});

describe('#2190 — un `from` qui n’est pas la case du mobile est refusé', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: NET0 }); });

  const ailleurs = { x: 0, y: 3 };

  for (const c of CAS) {
    it(`${c.geste} en combat : l’actif reste en place, refus NOMMÉ`, () => {
      const { H } = combat(c.scene(), ailleurs);
      c.agir(c.de, c.vers);
      expect(aAgi(H.id, ailleurs)).toBe(false);
      dit('geste.refus.caseDuMobile', { name: H.label });
    });
  }

  it('exploration : le groupe ne se téléporte pas', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    for (const c of CAS) {
      useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: ailleurs, scene: c.scene(), pendingFall: null, dialogue: null, journal: [] });
      c.agir(c.de, c.vers);
      expect(g().partyPos, c.geste).toEqual(ailleurs);
      expect(g().pendingFall, c.geste).toBeNull();
      dit('geste.refus.caseDuMobile', { name: hero.label });
    }
  });

  it('intent COOP : l’allowlist le laisse passer, le store le refuse — et le vrai `from` passe', () => {
    const c = CAS[2];
    const { H } = combat(c.scene(), ailleurs);
    useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } });
    expect(GUEST_INTENTS.has('windowAcross')).toBe(true);
    expect(intentAllowedFor(g(), 1, 'windowAcross', [c.de, c.vers])).toBe(true);
    withActingSeat(1, () => g().windowAcross(c.de, c.vers));
    expect(aAgi(H.id, ailleurs)).toBe(false);
    dit('geste.refus.caseDuMobile', { name: H.label });
    const b = g().battle!;
    placeCombatant(b.combatants.find((x) => x.id === H.id)!, g().scene!, c.de);
    withActingSeat(1, () => g().windowAcross(c.de, c.vers));
    expect(g().battle!.combatants.find((x) => x.id === H.id)!.pos).toMatchObject(c.vers);
  });
});

describe('couple monté (LDB 14 l.179 ; CRB 032 l.53 ; #2205) : refus NOMMÉ qui désigne « Descendre »', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: NET0 }); });

  for (const c of CAS) {
    it(`${c.geste} : cavalier actif → geste.refus.monte`, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      placeCombatant(foe, g().scene!, c.de);
      mountUp(H, foe);
      c.agir(c.de, c.vers);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('geste.refus.monte', { action: 'Descendre' });
      expect(dernierMot()).toContain('« Descendre »');
    });

    it(`${c.geste} : monture active qui porte son cavalier (ennemi mené par le siège MJ) → geste.refus.monte`, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      placeCombatant(foe, g().scene!, c.de);
      mountUp(H, foe);
      useGame.setState({ net: { ...NET0, gmSeat: 0 }, battle: { ...g().battle!, turn: g().battle!.order.indexOf(foe.id) } });
      c.agir(c.de, c.vers);
      expect(aAgi(foe.id, c.de)).toBe(false);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('geste.refus.monte', { action: 'Descendre' });
    });
  }
});

describe('coûts et refus NOMMÉS (A4)', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('escalade, combat : Mouvement restant sous le coût → refus NOMMÉ, rien ne bouge', () => {
    const { H } = combat(falaise({ kind: 'ladder' }), foot, { movementUsed: 3 });
    g().climbAcross(foot, top);
    expect(aAgi(H.id, foot)).toBe(false);
    expect(g().battle!.movementUsed).toBe(3);
    dit('climb.mouvementInsuffisant', { name: H.label, cout: climbMovementCost(4, sceneMetresPerTile(g().scene!)) });
  });

  it('escalade/chute, combat : Mouvement épuisé (`canMove`) → refus NOMMÉ', () => {
    for (const c of CAS.slice(0, 2)) {
      const { H } = combat(c.scene(), c.de, { movementUsed: 4 });
      c.agir(c.de, c.vers);
      expect(aAgi(H.id, c.de), c.geste).toBe(false);
      dit('geste.refus.mouvementEpuise', { name: H.label });
    }
  });

  it('escalade à Test, Action déjà prise → refus NOMMÉ (pas d’Action gratuite)', () => {
    const { H } = combat(falaise({ kind: 'surface' }), foot, { acted: true });
    g().climbAcross(foot, top);
    expect(aAgi(H.id, foot)).toBe(false);
    dit('climb.actionDejaPrise', { name: H.label });
  });

  it('chute : « Tenter » avec l’Action déjà prise → refus NOMMÉ, la modale reste au choix', () => {
    const { H } = combat(falaise(), top, { acted: true });
    g().fallAcross(top, foot);
    expect(phaseDeChute(g().pendingFall!)).toBe('choice');
    g().fallChoose(H.id, true);
    expect(phaseDeChute(g().pendingFall!)).toBe('choice');
    dit('fall.actionDejaPrise', { name: H.label });
    g().fallChoose(H.id, false); // sauter sans Test reste permis
    expect(g().battle!.combatants.find((x) => x.id === H.id)!.pos).toMatchObject(foot);
    expect(g().battle!.acted).toBe(true);
  });

  it('exploration : dialogue ouvert → refus NOMMÉ pour les trois gestes', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    for (const c of CAS) {
      useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: c.de, scene: c.scene(), pendingFall: null, dialogue: {} as never, journal: [] });
      expect('refus' in gesteDArete(g()), c.geste).toBe(true);
      c.agir(c.de, c.vers);
      expect(g().partyPos, c.geste).toEqual(c.de);
      dit('geste.refus.dialogue');
    }
    useGame.setState({ dialogue: null });
  });

  it('plans refusés : arête non grimpable, sommet inaccessible, plan `none`, croisée d’étage enjambée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const explorer = (scene: Scene, pos: Pt) => useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: pos, scene, pendingFall: null, dialogue: null, journal: [] });
    explorer(falaise(), foot);
    g().climbAcross(foot, top);
    dit('climb.pasGrimpable');
    const creux = falaise({ kind: 'ladder' });
    creux.layers[0].tiles[2] = 'vide' as Terrain;
    explorer(creux, foot);
    g().climbAcross(foot, top);
    expect(g().partyPos).toEqual(foot);
    dit('climb.sommetInaccessible', { name: hero.label });
    explorer(falaise(), foot);
    const plan = planFranchissement(falaise(), foot, top);
    if (plan.kind !== 'none') throw new Error('le sens ascendant doit être un plan `none`');
    g().fallAcross(foot, top);
    dit(REFUS_FRANCHISSEMENT[plan.raison]);
    explorer(croiseeDEtage(), { x: 1, y: 1, z: 1 });
    g().windowAcross({ x: 1, y: 1, z: 1 }, { x: 2, y: 1 });
    dit('franchir.refus.pasDePlainPied');
  });
});

describe('refus du PRÉFIXE (`mobileDuTour`), dits par le geste', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: NET0 }); });

  const c = CAS[2];
  it('combat terminé → geste.refus.combatTermine', () => {
    const { H } = combat(c.scene(), c.de);
    useGame.setState({ battle: { ...g().battle!, over: 'victory' } });
    c.agir(c.de, c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.combatTermine');
  });
  it('action armée → geste.refus.ciblage', () => {
    const { H } = combat(c.scene(), c.de);
    useGame.setState({ battle: { ...g().battle!, action: 'cast' } });
    c.agir(c.de, c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.ciblage');
  });
  it('aucun actif → geste.refus.aucunActif', () => {
    const { H } = combat(c.scene(), c.de);
    useGame.setState({ battle: { ...g().battle!, turn: g().battle!.order.length } });
    c.agir(c.de, c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.aucunActif');
  });
  it('actif mené par un autre siège → geste.refus.pasLaMain', () => {
    const { H } = combat(c.scene(), c.de);
    useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } });
    c.agir(c.de, c.vers);
    expect(aAgi(H.id, c.de)).toBe(false);
    dit('geste.refus.pasLaMain', { name: H.label });
  });
  it('refus en combat : dit à la bannière (`refus`), jamais au seul journal', () => {
    combat(c.scene(), { x: 0, y: 3 });
    c.agir(c.de, c.vers);
    expect(g().journal).toEqual([]);
    expect(g().refus?.texte).toBe(t('geste.refus.caseDuMobile', { name: 'H' }));
  });
});

describe('`computeMoveReach` consomme le préfixe : une action armée éteint la marche affichée', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('action nulle → cases ; action armée → aucune (comme `resolveMovement`)', () => {
    combat(croisee(), { x: 0, y: 0 });
    expect(computeMoveReach(g).size).toBeGreaterThan(0);
    useGame.setState({ battle: { ...g().battle!, action: 'cast' } });
    expect(computeMoveReach(g).size).toBe(0);
    expect(resolveMovement(g, { x: 0, y: 1 })).toEqual({ status: 'blocked', reason: 'targeting' });
  });
});

describe('case d’arrivée occupée et chute refusée, en combat', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  for (const c of CAS.slice(0, 2)) {
    it(`${c.geste} : arrivée occupée → franchir.caseOccupee`, () => {
      const { H, foe } = combat(c.scene(), c.de);
      foe.dead = false;
      foe.engagedWith = [];
      placeCombatant(foe, g().scene!, c.vers);
      c.agir(c.de, c.vers);
      expect(aAgi(H.id, c.de)).toBe(false);
      dit('franchir.caseOccupee', { name: H.label });
    });
  }
  it('chute sur une croisée de plain-pied → franchir.refus.pasUneChute', () => {
    const { H } = combat(croisee(), { x: 1, y: 1 });
    g().fallAcross({ x: 1, y: 1 }, { x: 2, y: 1 });
    expect(aAgi(H.id, { x: 1, y: 1 })).toBe(false);
    dit('franchir.refus.pasUneChute');
  });
});

describe('Test d’Escalade (LDB 15 l.57) : celui du GRIMPEUR', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: NET0, pendingTest: null }); });

  /** Deux héros : `H` (actif, sans Escalade) et `S` (fort en Escalade), `S` loin du pied. */
  function deuxHeros() {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const S = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'S', seed: 2 });
    S.skills = [...S.skills.filter((k) => k.id !== 'escalade'), { id: 'escalade', characteristic: 'force', advances: 60 }];
    H.skills = H.skills.filter((k) => k.id !== 'escalade');
    useGame.setState({ party: [H, S], net: NET0 });
    g().startScene(testScene());
    g().startCombat('enc-mutants');
    g().confirmRoundStart();
    vi.clearAllTimers();
    const b = g().battle!;
    const cH = b.combatants.find((x) => x.id === H.id)!;
    const cS = b.combatants.find((x) => x.id === S.id)!;
    const foes = b.combatants.filter((x) => x.kind === 'enemy');
    foes.forEach((e) => { e.dead = true; e.engagedWith = []; });
    cH.engagedWith = []; cS.engagedWith = [];
    const scene = falaise({ kind: 'surface' });
    placeCombatant(cH, scene, foot);
    placeCombatant(cS, scene, { x: 0, y: 3 });
    useGame.setState({ scene, journal: [], refus: null, pendingTest: null, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H: cH, S: cS, foe: foes[0] };
  }

  it('un héros faible grimpe : le Test est le sien, pas celui du meilleur du groupe', () => {
    const { H } = deuxHeros();
    g().climbAcross(foot, top);
    expect(g().pendingTest?.actorId).toBe(H.id);
  });

  it('un ennemi mené par le siège MJ grimpe : le Test est le sien', () => {
    const { H, foe } = deuxHeros();
    foe.dead = false;
    placeCombatant(H, g().scene!, { x: 3, y: 3 });
    placeCombatant(foe, g().scene!, foot);
    useGame.setState({ net: { ...NET0, gmSeat: 0 }, battle: { ...g().battle!, turn: g().battle!.order.indexOf(foe.id) } });
    g().climbAcross(foot, top);
    expect(g().pendingTest?.actorId).toBe(foe.id);
  });
});
