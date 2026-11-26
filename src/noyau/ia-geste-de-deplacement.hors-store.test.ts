import { describe, it, beforeEach, expect } from 'vitest';
import { aiTurnLog, budgetDeCharge, budgetDeCourse, buildAiInput, clearAiTurnLog, computeRunReach, maybeRunEnemyTurn, runEnemyAI } from './combatFlow';
import { chooseEnemyAction } from './monde/ai';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { mountMovement } from './mount';
import { reachable, tileFromKey } from './monde/path';
import { jouerLesFenetresDuPiloteIA } from './cascade';
import { avanceEtapeCascade } from './cascade.testkit';
import type { Combatant, Weapon } from '../engine/types';
import type { Scene } from './monde/scene';
import { chebyshev } from '../engine/grid';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { t } from '../i18n';
import { addCondition } from '../engine/conditions';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { setCadence } from '../engine/cadence';
import { ciblePsy } from '../engine/psych/ciblage';

/**
 * #5042 — le tour de l'IA se joue par les GESTES du joueur (`cliquerLaCase` sous le pilote IA). V1, le déplacement : la
 * Peur (#5043), le chemin et l'empreinte de la monture (#5046), le Vol sous les États (#5045), la Course. V2, l'attaque :
 * la porte du tir (#5048, #5049), la cible de Frénésie (#5050), le Brisé Engagé (#5044), la Charge et son Test de Peur,
 * le Désengagement. Les fenêtres que le geste ouvre à son porteur se jouent d'office toutes cadences, sans toucher à
 * celles d'un héros manuel.
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

const attaquesDe = (id: string, sur?: string) => g().battle!.log.filter((l) => l.kind === 'attaque' && l.actorId === id && (!sur || l.targetId === sur));
const tirsDe = (id: string) => g().battle!.log.filter((l) => l.kind === 'tir' && l.actorId === id);
const chargesDe = (id: string) => g().battle!.log.filter((l) => l.kind === 'charge' && l.actorId === id);
const decision = (id: string) => chooseEnemyAction(buildAiInput(ici(id), g));

describe('#5044 — le Brisé Engagé ne frappe pas : il fuit par le Désengagement du joueur (LDB 16 l.52 ; LDB 15 l.43-61)', () => {
  it('aucune frappe ; son départ du contact passe par l’étape de Désengagement ; le tour passe', () => {
    const e = C('ennemi', 'e', 10, { engagedWith: ['h'] });
    addCondition(e, 'brise');
    const h = C('heros', 'h', 11, { engagedWith: ['e'], aiControlled: true });
    poser([e, h], ['e', 'h']);
    tourDe('e', 1);
    expect(attaquesDe('e'), 'aucune frappe').toEqual([]);
    expect(g().battle!.log.some((l) => l.kind === 'fuite' && l.actorId === 'e'), 'l’étape de Désengagement est jouée').toBe(true);
    expect(g().battle!.turn, 'le tour a passé').not.toBe(0);
  });
});

const ARC: Weapon = { uid: 'arc1', label: 'Arc', type: 'distance', subType: 'arc', damage: { plusBF: false, flat: 7 }, range: 50, qualities: [] } as Weapon;
const PIECE: Weapon = { uid: 'pc1', label: 'Pièce', type: 'distance', damage: { plusBF: false, flat: 10 }, range: 100, minRangeBand: 'courte', qualities: [] } as Weapon;

describe('#5048, #5049 — l’IA passe la porte du tir du joueur, quel que soit le porteur (`firedAttackBlock`)', () => {
  it('#5048 : un héros en Auto-combat sans munition ne tire pas (LDB 62 l.106)', () => {
    const h = C('heros', 'h', 4, { weapons: [ARC], aiControlled: true });
    poser([h, C('ennemi', 'e', 12)], ['h', 'e']);
    expect(decision('h').kind, 'la décision lit la porte').not.toBe('tir');
    tourDe('h', 1);
    expect(tirsDe('h'), 'aucun tir').toEqual([]);
  });

  it('#5049 : un ennemi ne tire pas sa pièce à Bout Portant (ADE II 08 l.253)', () => {
    const e = C('ennemi', 'e', 11, { weapons: [PIECE] });
    poser([e, C('heros', 'h', 8)], ['e', 'h']);
    expect(decision('e').kind, 'la décision lit la porte').not.toBe('tir');
    tourDe('e', 1);
    expect(tirsDe('e'), 'aucun tir').toEqual([]);
  });
});

describe('#5050 — le frénétique vise la cible que la Frénésie impose au joueur (`frenzyTarget`, LDB 21 l.33)', () => {
  it('le plus proche par la distance de combat, pas par Manhattan : il frappe A, jamais B', () => {
    const e = C('ennemi', 'e', 10, { psychState: [{ type: 'frenesie' }] as never });
    const a = C('heros', 'A', 13, { pos: { x: 13, y: 13 }, aiControlled: true });
    const b = C('heros', 'B', 14, { aiControlled: true });
    poser([e, a, b], ['e', 'A', 'B']);
    tourDe('e', 1);
    expect([attaquesDe('e', 'A').length > 0, attaquesDe('e', 'B')], 'il frappe A, jamais B').toEqual([true, []]);
  });
});

describe('la Charge de l’IA est le geste du joueur (`chargeArmee`, LDB 15 l.35-37)', () => {
  it('vers une source de Peur : le Test se joue d’office, et l’échec retient la Charge (LDB 21 l.27)', () => {
    sousLaPeur(9, 5);
    tourDe('e', 1);
    expect(lignes(), 'le Test a été joué, et raté').toContain(t('cs.courageNo', { name: 'e', src: 'h' }));
    expect([chargesDe('e'), attaquesDe('e')], 'ni Charge ni frappe').toEqual([[], []]);
    expect(g().battle!.turn, 'le tour a passé').toBe(1);
  });

  it('un volant Charge par le chemin du geste : déclarée, au contact, il frappe', () => {
    const e = C('ennemi', 'e', 2, { traits: [{ id: 'vol', value: 20 }] as never });
    poser([e, C('heros', 'h', 9, { aiControlled: true })], ['e', 'h']);
    tourDe('e', 1);
    expect(chargesDe('e').length, 'la Charge est déclarée').toBe(1);
    expect(chebyshev(ici('e').pos!, ici('h').pos!), 'au contact').toBe(1);
    expect(attaquesDe('e', 'h').length, 'il frappe').toBe(1);
  });
});

describe('cadence manuelle : l’attaque de l’IA ne bloque jamais son tour (frappe, défense du héros, gratuites)', () => {
  it('le joueur répond à chacune de ses fenêtres ; la frappe et la Morsure partent, le tour passe', () => {
    banc = ouvrirLeBanc({ cadence: 'manuel' });
    const e = C('ennemi', 'e', 10, { traits: [{ id: 'morsure', value: 6 }] as never, advantage: 4 });
    e.characteristics['capacite-de-combat'] = 95;
    const h = C('heros', 'h', 11, { wounds: blessuresDeBase(80) });
    h.characteristics['capacite-de-combat'] = 5; // il perd l'opposition : l'Avantage de `e` paie la Morsure (LDB 85 l.387)
    poser([e, h], ['e', 'h']);
    tourDe('e', 1);
    for (let i = 0; i < 10 && g().battle!.turn === 0; i++) {
      if (g().pendingDefense) { g().jetLancer('defense'); g().jetValider('defense'); } else if (g().pendingCascade) avanceEtapeCascade(g); // ses fenêtres, à lui
      banc.reprendreTout();
    }
    expect(attaquesDe('e', 'h').length, 'la frappe, puis la Morsure').toBe(2);
    expect(g().battle!.turn, 'le tour a passé').toBe(1);
  });
});

describe('non-régression : en Rapide, le Désengagement d’un héros manuel reste à lui', () => {
  it('son menu de Désengagement attend son joueur : l’Auto-cadence n’y touche pas', () => {
    banc = ouvrirLeBanc({ cadence: 'rapide' });
    poser([C('heros', 'h', 10, { engagedWith: ['e'] }), C('ennemi', 'e', 11, { engagedWith: ['h'] })], ['h', 'e']);
    g().cliquerLaCase({ x: 7, y: 10 }, undefined, { confirm: true });
    const menu = g().pendingDisengage;
    expect(menu, 'témoin : le Désengagement du héros est ouvert').toMatchObject({ moverId: 'h' });
    banc.reprendreTout();
    expect(g().pendingDisengage).toBe(menu);
  });
});

/** Le banc joué d'office tant que le premier tour du Round 1 dure. */
function jusquAuTourSuivant(): void {
  for (let i = 0; i < 300 && g().battle!.turn === 0 && g().battle!.round === 1 && !g().battle!.over; i++) if (!banc.jusquALaProchaine()) return;
}

describe('#5044 — le héros en Auto-combat Brisé et Engagé se désengage PUIS s’éloigne (LDB 16 l.52 ; LDB 15 l.43-61)', () => {
  it.each([3, 0])('Avantage %s : il quitte le contact et le Déplacement réarmé l’éloigne', (avantage) => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    const h = C('heros', 'h', 10, { engagedWith: ['e'], advantage: avantage });
    addCondition(h, 'brise');
    poser([h, C('ennemi', 'e', 11, { engagedWith: ['h'] })], ['h', 'e']);
    seedBattleRng(1);
    runEnemyAI(g, banc.setState, 'h');
    jusquAuTourSuivant();
    expect([ici('h').engagedWith, ici('h').pos!.x < 10], 'hors du contact, et plus loin que sa case').toEqual([[], true]);
  });
});

describe('une seule règle de re-décision, bornée : le tour dont le geste retombe se redécide (`redeciderLeTour`)', () => {
  /** Le héros `h` en Auto-combat, à 4 cases de `e` : sa décision est une Charge. */
  function charge(): void {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    const h = C('heros', 'h', 4, { pos: { x: 4, y: 0 } });
    poser([h, C('ennemi', 'e', 0, { pos: { x: 0, y: 0 } })], ['h', 'e'], testScene() as never);
    seedBattleRng(3);
    maybeRunEnemyTurn(g, banc.setState);
    for (let i = 0; i < 300 && !g().pendingAttack; i++) if (!banc.jusquALaProchaine()) break;
    expect(g().pendingAttack?.attackerId, 'témoin : la frappe de la Charge attend son jet').toBe('h');
  }
  /** Le joueur reprend la main en manuel, ANNULE la frappe pilotée, puis rend l'Auto. */
  function annulerEnManuel(): void {
    setCadence('manuel'); g().reprendreLaCadence();
    banc.reprendreTout();
    g().jetAnnuler('attaque');
    setCadence('auto'); g().reprendreLaCadence();
  }
  const decisions = () => aiTurnLog().filter((r) => r.id === 'h').length;

  it('la Charge annulée rend son Action : le tour se redécide une fois, et passe', () => {
    charge();
    annulerEnManuel();
    jusquAuTourSuivant();
    expect([decisions(), g().battle!.turn], 'une re-décision, puis le tour suivant').toEqual([2, 1]);
  });

  it('au-delà de la borne, le tour finit sans se redécider encore', () => {
    charge();
    for (let i = 0; i < 6 && g().pendingAttack; i++) {
      annulerEnManuel();
      for (let j = 0; j < 300 && !g().pendingAttack && g().battle!.turn === 0; j++) if (!banc.jusquALaProchaine()) break;
    }
    jusquAuTourSuivant();
    expect([decisions() <= 4, g().battle!.turn], 'la décision et ses trois re-décisions au plus').toEqual([true, 1]);
  });
});

const ARBALETE: Weapon = { uid: 'xb', label: 'Arbalète', type: 'distance', subType: 'arbalete', damage: { plusBF: false, flat: 9 }, range: 60, reload: 1, loaded: false, qualities: [] } as unknown as Weapon;

describe('une seule source d’arme entre la décision et la porte du tir (`offreDuGeste`, `firedAttackBlock`)', () => {
  it.each([
    ['arc puis arbalète vide', [ARC, ARBALETE], true],
    ['arbalète vide puis arc', [ARBALETE, ARC], false],
  ] as const)('%s : la décision dit ce que le geste fait, sans refus ni re-décision', (_, armes, tire) => {
    const e = C('ennemi', 'e', 4, { weapons: [...armes] });
    poser([e, C('heros', 'h', 16, { aiControlled: true })], ['e', 'h']);
    expect(decision('e').kind === 'tir', 'la décision lit la porte du geste').toBe(tire);
    seedBattleRng(1);
    runEnemyAI(g, banc.setState, 'e');
    const tour = g().battle!.tourEnCours;
    expect([tour?.ciblesRefusees ?? [], tour?.redecisions ?? 0], 'la porte ne refuse rien à la décision').toEqual([[], 0]);
    jusquAuTourSuivant();
    expect(tirsDe('e').length > 0, 'le tir part ssi la décision l’a dit').toBe(tire);
  });
});

describe('la cible d’attaque du joueur lit sa pulsion (`cibleDAttaque` : LDB 21 l.21 Animosité, l.41 Haine ; #3045)', () => {
  it.each(['animosite', 'haine'])('%s : son clic frappe l’allié visé, jamais un autre allié', (type) => {
    banc = ouvrirLeBanc({ cadence: 'manuel' });
    const h = C('heros', 'h', 10, { psychState: [{ type, cible: ciblePsy.groupe('elfe'), active: true }] as never });
    const vise = C('heros', 'a', 11, { groups: ['elfe'] } as never);
    const autre = C('heros', 'b', 9, { groups: ['nain'] } as never);
    poser([h, vise, autre, C('ennemi', 'e', 25)], ['h', 'a', 'b', 'e']);
    g().cliquerLaCase({ x: 9, y: 10 }, 'b', { confirm: true });
    expect([g().pendingAttack, g().pendingCascade], 'l’allié hors de la pulsion n’est pas une cible').toEqual([null, null]);
    g().cliquerLaCase({ x: 11, y: 10 }, 'a', { confirm: true });
    expect(g().pendingAttack?.targetId ?? g().pendingDefense?.defenderId, 'l’allié que vise la pulsion l’est').toBe('a');
  });
});
