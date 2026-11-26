import { describe, it, beforeEach, expect } from 'vitest';
import { budgetDeCharge, budgetDeCourse, buildAiInput, computeRunReach, runEnemyAI } from './combatFlow';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { mountMovement } from './mount';
import { reachable, tileFromKey } from './monde/path';
import { jouerLesFenetresDuPiloteIA } from './cascade';
import type { Combatant } from '../engine/types';
import type { Scene } from './monde/scene';
import { chebyshev } from '../engine/grid';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { t } from '../i18n';
import { addCondition } from '../engine/conditions';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * #5042 V1 — le déplacement de l'IA se joue par le GESTE du joueur (`cliquerLaCase` sous le pilote IA) : la Peur
 * (#5043), le chemin et l'empreinte de la monture (#5046), le Vol sous les États (#5045), la Course, et les fenêtres
 * que le geste ouvre à son porteur, jouées d'office toutes cadences sans toucher à celles d'un héros manuel.
 */
let banc: Banc;
const g = () => banc.getState();

/** Une scène d'herbe 30 × 21, `murs` en tuiles de mur. */
function scene(murs: readonly string[] = []): Scene {
  const tiles = Array(630).fill('herbe');
  for (const k of murs) {
    const [x, y] = k.split(',').map(Number);
    tiles[y * 30 + x] = 'mur';
  }
  return { id: 's', label: '', dimensions: { w: 30, h: 21 }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never;
}

const C = (kind: 'heros' | 'ennemi', id: string, x: number, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, label: id, kind, pos: { x, y: 10 }, movement: 4,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    conditions: [], skills: [], wounds: blessuresDeBase(10), advantage: 0, engagedWith: [], psychState: [],
    ...over,
  })) as unknown as Combatant;

/** Le combat de `combattants`, au tour du premier de `ordre`. */
function poser(combattants: Combatant[], ordre: string[], s: Scene = scene()): void {
  banc.setState({ scene: s, party: [], pendingCascade: null, actorMove: null,
    battle: { combatants: combattants, order: ordre, turn: 0, round: 1, log: [], over: null, action: null, reachable: new Map(), acted: false, movementUsed: 0 } as never });
}

/** Le tour de l'IA `id`, joué jusqu'au bout de ses suites. */
function tourDe(id: string, graine: number): void {
  seedBattleRng(graine);
  runEnemyAI(g, banc.setState, id);
  banc.reprendreTout();
}

const lignes = () => g().battle!.log.map((l) => l.text);
const ici = (id: string) => g().battle!.combatants.find((c) => c.id === id)!;

/** Un ennemi `e` sous la Peur du héros `h` (LDB 21 l.27), sa Force Mentale `fm`. */
function sousLaPeur(heroX: number, fm: number): { e: Combatant; h: Combatant } {
  const e = C('ennemi', 'e', 2, { psychState: [{ type: 'peur', sourceId: 'h', indice: 1, calmeDR: 0 }] });
  e.characteristics['force-mentale'] = fm;
  const h = C('heros', 'h', heroX);
  poser([e, h], ['e', 'h']);
  return { e, h };
}

beforeEach(() => { banc = ouvrirLeBanc(); });

describe('#5043 — l’IA sous Peur s’approche par la porte du joueur (`retenuParLaPeur`, LDB 21 l.27)', () => {
  it('Test `calme-d-approche` joué d’office ; l’échec la retient : elle ne se rapproche pas, et son tour finit', () => {
    sousLaPeur(6, 5);
    const avant = chebyshev(ici('e').pos!, ici('h').pos!);
    tourDe('e', 1);
    expect(lignes(), 'le Test a été joué, et raté').toContain(t('cs.courageNo', { name: 'e', src: 'h' }));
    expect(chebyshev(ici('e').pos!, ici('h').pos!), 'retenue').toBeGreaterThanOrEqual(avant);
    expect([g().pendingApproach, g().battle!.turn], 'aucune fenêtre ne reste, le tour a passé').toEqual([null, 1]);
  });

  it('la réussite relance le geste : elle rejoint sa cible', () => {
    sousLaPeur(6, 95);
    tourDe('e', 1);
    expect(lignes()).toContain(t('cs.courageYes', { name: 'e', src: 'h' }));
    expect(chebyshev(ici('e').pos!, ici('h').pos!)).toBe(1);
  });
});

describe('cadence manuelle : le geste de l’IA ne bloque jamais son tour (Course + Peur + continuation)', () => {
  it('la Peur bravée relance la Course, dont le Test se joue d’office ; le tour passe', () => {
    sousLaPeur(14, 95);
    tourDe('e', 1);
    expect(lignes()).toContain(t('cs.courageYes', { name: 'e', src: 'h' }));
    expect(ici('e').pos!.x - 2, 'au-delà de la Marche : elle a Couru').toBeGreaterThan(4);
    expect([g().pendingApproach, g().pendingRun, g().battle!.turn]).toEqual([null, null, 1]);
  });
});

describe('#5046 — le cavalier de l’IA prend le chemin et l’empreinte de sa monture (LDB 14 l.179 ; LDB 15 l.12)', () => {
  it('une brèche d’une case, trop étroite pour la monture : le couple ne la franchit pas', () => {
    const mur = Array.from({ length: 21 }, (_, y) => y).filter((y) => y !== 10).map((y) => `6,${y}`);
    const cavalier = C('ennemi', 'c', 2, { mountId: 'm' });
    const monture = C('ennemi', 'm', 2, { riderId: 'c', footprint: 2, movement: 8, weapons: [] });
    const h = C('heros', 'h', 9);
    poser([cavalier, monture, h], ['c', 'h'], scene(mur));
    const entree = buildAiInput(ici('c'), g);
    const auDela = [...reachable(g().scene!, ici('c').pos!, entree.movement, entree.env).keys()].filter((k) => tileFromKey(k).x > 6);
    expect([entree.env.foot, auDela], 'la décision lit l’empreinte de la monture : rien au-delà de la brèche').toEqual([2, []]);
    tourDe('c', 1);
    expect(ici('c').pos!.x + 1, 'le couple reste en deçà du mur').toBeLessThan(6);
    expect(ici('m').pos).toEqual(ici('c').pos);
  });
});

describe('#5045 — le Vol de l’IA se plie aux États (`mouvementDeVol`, LDB 16 l.35, l.64 ; LDB 85 l.433)', () => {
  it('Empêtré : ni Vol ni Marche, il reste sur sa case', () => {
    const e = C('ennemi', 'e', 2, { traits: [{ id: 'vol', value: 20 }] });
    addCondition(e, 'empetre');
    poser([e, C('heros', 'h', 25)], ['e', 'h']);
    tourDe('e', 1);
    expect(ici('e').pos).toEqual({ x: 2, y: 10 });
  });

  it('À Terre : il ne vole pas, il rampe de la moitié de sa Marche', () => {
    const e = C('ennemi', 'e', 2, { traits: [{ id: 'vol', value: 20 }] });
    addCondition(e, 'a-terre');
    poser([e, C('heros', 'h', 25)], ['e', 'h']);
    tourDe('e', 1);
    expect(chebyshev(ici('e').pos!, { x: 2, y: 10 })).toBeLessThanOrEqual(2);
  });
});

describe('non-régression : la fenêtre d’un héros manuel reste à lui, en Rapide', () => {
  it('le jeu d’office du pilote IA ne touche pas la Course ouverte d’un héros qu’il ne conduit pas', () => {
    banc = ouvrirLeBanc({ cadence: 'rapide' });
    const h = C('heros', 'h', 2);
    poser([h, C('ennemi', 'e', 25)], ['h', 'e']);
    g().ouvrirLaCourse({ x: 12, y: 10 });
    expect(g().pendingRun, 'témoin : la Course du héros est ouverte').toMatchObject({ combatantId: 'h', result: null });
    jouerLesFenetresDuPiloteIA(g);
    expect(g().pendingRun).toMatchObject({ combatantId: 'h', result: null });
  });
});

/** Le héros `H` d'un combat de la scène de test, seul à son tour en (10,10), Vol `vol` s'il en a un. */
function heroAuTour(vol: number | null): Combatant {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  if (vol != null) hero.traits = [...(hero.traits ?? []), { id: 'vol', value: vol } as never];
  banc.setState({ party: [hero] });
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  H.pos = { x: 10, y: 10 };
  H.engagedWith = [];
  for (const e of b.combatants) if (e.kind === 'ennemi') e.pos = { x: 28, y: 1 };
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0, action: null, preview: null }, pendingRun: null });
  return H;
}

describe('le Vol porte le Déplacement, pas la Course ni la Charge (LDB 85 l.433 ; LDB 15 l.18-31)', () => {
  it('Vol 20, M 4 : les budgets de Course et de Charge sont ceux de M 4 ; le Déplacement, celui du Vol', () => {
    const marcheur = heroAuTour(null);
    const aPied = { charge: budgetDeCharge(g().battle!, marcheur), course: budgetDeCourse(g().battle!, marcheur) };
    const volant = heroAuTour(20);
    expect({ charge: budgetDeCharge(g().battle!, volant), course: budgetDeCourse(g().battle!, volant) }).toEqual(aPied);
    expect(mountMovement(g().battle!, volant), 'Vol 20 m : 10 cases de Déplacement').toBe(10);
  });

  it('la Course d’un volant que le jet porte moins loin s’arrête au plus loin de sa ligne, comme celle d’un marcheur', () => {
    const H = heroAuTour(8);
    const [cle] = [...computeRunReach(g)].sort((a, b) => b[1] - a[1])[0];
    const [x, y] = cle.split(',').map(Number);
    g().cliquerLaCase({ x, y }, undefined, { confirm: true, intentionId: 'course' });
    const pr = g().pendingRun!;
    banc.setState({ pendingRun: { ...pr, result: { success: false, roll: 96, target: 40, dr: -3, bonusCases: 1 } } as never });
    g().jetValider('course');
    const h = ici(H.id);
    expect(chebyshev(h.pos!, { x: 10, y: 10 }), 'il a avancé sur sa ligne').toBeGreaterThan(0);
    expect(lignes()).not.toContain(t('cs.runStumble', { name: 'H' }));
  });
});
