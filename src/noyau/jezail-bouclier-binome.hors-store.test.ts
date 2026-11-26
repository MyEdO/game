/**
 * Le bouclier du binôme du jezaïl à malepierre : Protectrice 2 au tireur et à son partenaire au contact, ni Course ni
 * Fuite volontaires, et la fuite forcée qui fait tomber le bouclier. ZI 13 l.193 ; #4202
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { itemFromTrappingById, laisserTomber, recomputeLoadout } from '../engine/items';
import { addCondition, COND } from '../engine/conditions';
import { defaultParryWeapon, finishMelee, rangedDefenseModes } from '../engine/combat';
import { protectriceAP } from '../engine/qualities/dispatch';
import { evaluateTest } from '../engine/tests';
import { makeRNG } from '../engine/dice';
import type { Combatant, Weapon } from '../engine/types';
import { findCreatureById, findTrappingById } from '../data';
import { t } from '../i18n';
import { spawnEnemy } from './monde/spawn';
import { applyShipPostes } from './monde/shipPostes';
import { chooseEnemyAction, type EnemyTurnInput } from './monde/ai';
import { aiApproachPlan, refusDeDefenseReactive, runEnemyAI, tireSansEquipe } from './combatFlow';
import { auContactParmi, bouclierDuBinome, effectifAuContactParmi } from './combat/surnombre';
import { mountUp } from './mount';
import { buildScene } from './mapSpec';
import { buildEncounters } from './monde/encounterAuthoring';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { budgetsDAllure, refusDeCourse, refusDuBinome } from './refusDuTour';
import { peutFuir, refusDEsquiveDeDesengagement } from './combat/desengagement';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { nomDe } from '../engine/nom';

const JEZAIL = 'jezail-a-malepierre';
const BOUCLIER = 'bouclier-de-jezail';
const LIBELLE = 'Bouclier de jezaïl';

/** `id`, du camp `kind`, en `pos`, qui tient en main le premier des objets `objets` du catalogue. */
function porteur(id: string, kind: Combatant['kind'], pos: { x: number; y: number }, objets: string[]): Combatant {
  const items = objets.map((o) => ({ ...itemFromTrappingById(o, idsDeTest)!, ...(o === JEZAIL ? { loaded: true } : {}) }));
  const c = combattantDeTest({ id, label: id, kind, pos, movement: 4, items, loadouts: [{ id: 'l', main: items[0].uid }] as never, activeLoadoutId: 'l' });
  recomputeLoadout(c);
  return c;
}

/** Le Technomage du bestiaire, armé de son jezaïl. */
function technomage(pos: { x: number; y: number }): Combatant {
  return spawnEnemy({ presetCreature: findCreatureById('technomage')!, presetId: 'technomage' }, 'technomage-1', pos);
}

const tenu = (c: Combatant, trappingId: string): Weapon => c.weapons.find((w) => w.trappingId === trappingId)!;
const adverse = (kind: Combatant['kind']): Combatant['kind'] => (kind === 'heros' ? 'ennemi' : 'heros');
const combat = (combatants: Combatant[]) => ({ combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, movementUsed: 0, action: null, reachable: new Map(), log: [] }) as unknown as BattleState;
const ARC: Weapon = { label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, range: 50, qualities: [] } as Weapon;
const EPEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 12 }, qualities: [] } as Weapon;

describe.each([
  { camp: 'héros', kind: 'heros' as const, tireur: (pos: { x: number; y: number }) => porteur('tireur', 'heros', pos, [JEZAIL]) },
  { camp: 'PNJ', kind: 'ennemi' as const, tireur: technomage },
])('le binôme au bouclier du jezaïl, $camp — ZI 13 l.193', ({ kind, tireur }) => {
  function binome(): { T: Combatant; P: Combatant } {
    return { T: tireur({ x: 5, y: 5 }), P: porteur('partenaire', kind, { x: 6, y: 5 }, [BOUCLIER]) };
  }

  it('formé : le tireur et le partenaire parent un tir en Ligne de Vue, et gagnent 2 PA en Parade', () => {
    const { T, P } = binome();
    const archer = combattantDeTest({ id: 'archer', label: 'archer', kind: adverse(kind), pos: { x: 15, y: 5 } });
    expect(rangedDefenseModes(findTrappingById, archer, T, ARC, 10, true, 2), 'le jezaïl seul ne pare aucun tir').not.toContain('parade');
    for (const X of [T, P]) {
      const b = bouclierDuBinome(null, [T, P], X);
      expect(b?.trappingId).toBe(BOUCLIER);
      expect(b).toBe(tenu(P, BOUCLIER));
      expect(rangedDefenseModes(findTrappingById, archer, X, ARC, 10, true, 2, b)).toContain('parade');
      expect(protectriceAP(defaultParryWeapon(X), b)).toBe(2);
      const atk = evaluateTest(11, 90, 50);
      const def = evaluateTest(96, 30, 30);
      const coup = (bb?: Weapon) => finishMelee(archer, X, EPEE, atk, def, 'parade', { rng: makeRNG(1) }, 'corps', [], [], undefined, defaultParryWeapon(X), false, undefined, undefined, bb);
      expect(coup(undefined).woundsLost! - coup(b).woundsLost!).toBe(X === P ? 0 : 2); // P pare déjà de son bouclier
    }
  });

  it('pas de binôme : partenaire à 2 cases, Bouclier du livre de base, partenaire hors de combat, adversaire', () => {
    const T = tireur({ x: 5, y: 5 });
    const loin = porteur('loin', kind, { x: 7, y: 5 }, [BOUCLIER]);
    const ordinaire = porteur('ordinaire', kind, { x: 6, y: 5 }, ['bouclier']);
    const inconscient = porteur('inconscient', kind, { x: 4, y: 5 }, [BOUCLIER]);
    addCondition(inconscient, COND.inconscient);
    const ennemi = porteur('ennemi', adverse(kind), { x: 5, y: 6 }, [BOUCLIER]);
    const tous = [T, loin, ordinaire, inconscient, ennemi];
    expect(tous.map((c) => bouclierDuBinome(null, tous, c))).toEqual(tous.map(() => undefined));
  });

  it('le partenaire pose le bouclier, ou le tireur lâche le jezaïl : le binôme cesse, la Course revient', () => {
    for (const lacher of [(_T: Combatant, P: Combatant) => laisserTomber(P, tenu(P, BOUCLIER), idsDeTest), (T: Combatant) => laisserTomber(T, tenu(T, JEZAIL), idsDeTest)]) {
      const { T, P } = binome();
      const battle = combat([T, P]);
      expect([refusDeCourse(null, battle, T), refusDeCourse(null, battle, P)]).toEqual([
        t('agate.binomeCouvert', { bouclier: LIBELLE }), t('agate.binomeTientLeBouclier', { bouclier: LIBELLE }),
      ]);
      lacher(T, P);
      expect([bouclierDuBinome(null, [T, P], T), bouclierDuBinome(null, [T, P], P)]).toEqual([undefined, undefined]);
      expect([refusDeCourse(null, battle, T), refusDeCourse(null, battle, P)]).toEqual([null, null]);
    }
  });

  it('sa propre monture n’est pas son partenaire : seul un autre allié au contact l’est — arbitrage du 2026-11-16, #4202', () => {
    const T = tireur({ x: 5, y: 5 });
    const monture = porteur('monture', kind, { x: 5, y: 5 }, [BOUCLIER]);
    mountUp(T, monture);
    const jezail = tenu(T, JEZAIL);
    expect(tireSansEquipe(null, T, jezail, [T, monture]), 'monté, sans autre allié : sans équipe').toBe(true);
    expect(bouclierDuBinome(null, [T, monture], T), 'le bouclier de sa monture ne forme pas le binôme').toBeUndefined();
    const P = porteur('partenaire', kind, { x: 6, y: 5 }, [BOUCLIER]);
    expect(tireSansEquipe(null, T, jezail, [T, monture, P]), 'un allié à pied au contact fait l’équipe').toBe(false);
    expect(bouclierDuBinome(null, [T, monture, P], T)).toBe(tenu(P, BOUCLIER));
  });

  it('le servant d’une baliste avec ce bouclier n’est pas en binôme', () => {
    const servant = combattantDeTest({ id: 'servant', kind, pos: { x: 5, y: 5 } });
    const P = porteur('partenaire', kind, { x: 6, y: 5 }, [BOUCLIER]);
    const affut = spawnEnemy({ engin: 'baliste' }, 'affut', { x: 5, y: 4 }, {
      postes: [{ engin: { id: 'baliste' }, crewIds: [servant.id] }],
    });
    const tous = [affut, servant, P];
    applyShipPostes(tous);
    expect(tenu(servant, 'baliste')).toBeDefined();
    expect([bouclierDuBinome(null, tous, servant), bouclierDuBinome(null, tous, P)]).toEqual([undefined, undefined]);
  });

  it('en binôme et Engagés : la Fuite fermée, le Désengagement par l’Esquive offert ; Brisé, la fuite forcée l’ouvre', () => {
    const { T, P } = binome();
    const ennemi = porteur('ennemi', adverse(kind), { x: 5, y: 4 }, ['bouclier']);
    const battle = combat([T, P, ennemi]);
    for (const X of [T, P]) {
      X.engagedWith = [ennemi.id];
      ennemi.engagedWith = [...(ennemi.engagedWith ?? []), X.id];
      expect(peutFuir({ active: X, battle, scene: null })).toBe(false);
      expect(refusDEsquiveDeDesengagement({ active: X, battle })).toBeNull();
      addCondition(X, COND.brise);
      expect(refusDuBinome(null, battle, X)).toBeNull();
      expect(peutFuir({ active: X, battle, scene: null })).toBe(true);
    }
  });

  it('IA : le partenaire en binôme charge encore, mais ne court pas', () => {
    const scene = { id: 's', label: '', dimensions: { w: 30, h: 21 }, layers: [{ z: 0, tiles: Array(630).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never;
    const plan = (cibleX: number, avecTireur: boolean) => {
      const P = porteur('partenaire', kind, { x: 2, y: 10 }, [BOUCLIER]);
      const T = tireur({ x: 2, y: 11 });
      const cible = combattantDeTest({ id: 'cible', label: 'cible', kind: adverse(kind), pos: { x: cibleX, y: 10 } });
      const input: EnemyTurnInput = { enemy: P, heroes: [cible], scene, env: { blocked: new Set([`${cibleX},10`, '2,11']) }, movement: 4, spells: [], squad: avecTireur ? [T] : [] };
      const action = chooseEnemyAction(input);
      // Les budgets que la porte du joueur laisse (`budgetsDAllure`), comme le tour de l'IA les passe.
      const battle = { combatants: [P, ...(avecTireur ? [T] : []), cible], acted: false, movementUsed: 0 } as unknown as BattleState;
      return { action, ...aiApproachPlan(input, action, budgetsDAllure(scene, battle, P, { charge: 8, course: 12 })) };
    };
    const charge = plan(8, true);
    expect(charge.allure).toBe('charge');
    expect((charge.plan as { to: { x: number } }).to.x).toBe(7);
    expect(plan(25, false).allure, 'hors binôme, il court').toBe('course');
    const course = plan(25, true);
    expect(course.allure).toBe('marche');
    expect(course.plan).toBe(course.action);
  });
});

describe('le Surnombre compte un cavalier et sa monture pour un — LDB 14 l.110 ; arbitrage du 2026-11-16, #4202', () => {
  it('cavalier + monture au contact : 1 ; + un allié à pied : 2 ; une monture libre compte', () => {
    const cible = combattantDeTest({ id: 'cible', label: 'cible', kind: 'heros', pos: { x: 5, y: 5 } });
    const cavalier = combattantDeTest({ id: 'cavalier', label: 'cavalier', kind: 'ennemi', pos: { x: 6, y: 5 } });
    const monture = combattantDeTest({ id: 'monture', label: 'monture', kind: 'ennemi', pos: { x: 6, y: 5 } });
    const libre = combattantDeTest({ id: 'libre', label: 'libre', kind: 'ennemi', pos: { x: 4, y: 4 } });
    expect(auContactParmi(null, [cible, cavalier, monture, libre], cible, 'ennemi').map((c) => c.id), 'monture libre : un combattant').toEqual(['cavalier', 'monture', 'libre']);
    mountUp(cavalier, monture);
    expect(effectifAuContactParmi(null, [cible, cavalier, monture], cible, 'ennemi')).toBe(1);
    const fantassin = combattantDeTest({ id: 'fantassin', label: 'fantassin', kind: 'ennemi', pos: { x: 5, y: 6 } });
    expect(auContactParmi(null, [cible, cavalier, monture, fantassin], cible, 'ennemi').map((c) => c.id)).toEqual(['cavalier', 'fantassin']);
  });

  it('un PNJ allié de la rencontre (`side: \'allie\'`) compte au contact pour le camp des héros', () => {
    const scene = buildScene({ id: 'allie-au-contact', label: 'Allié au contact', desc: 'test', size: [12, 12], terrain: 'herbe', heroStart: [1, 1] });
    const { entities, encounters } = buildEncounters([{ id: 'enc', enemies: [
      { creature: { id: 'brute' }, pos: { x: 8, y: 8 } },
      { creature: { id: 'brute' }, pos: { x: 9, y: 8 }, side: 'allie' },
    ] }]);
    scene.entities.push(...entities);
    scene.encounters = encounters;
    const banc = ouvrirLeBanc();
    banc.setState({ party: groupeDeScenario(idsDeTest, 'soldat') });
    banc.getState().lancerLaScene(scene);
    banc.getState().lancerLeCombat('enc');
    const { combatants } = banc.getState().battle!;
    const [ennemi, allie] = ['enemy-enc-0', 'enemy-enc-1'].map((id) => combatants.find((c) => c.id === id)!);
    expect(auContactParmi(banc.getState().scene, combatants, ennemi, 'heros')).toEqual([allie]);
  });
});

describe('la fuite forcée du partenaire : le bouclier tombe au sol, il fuit — ZI 13 l.193', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });

  it('un partenaire PNJ Brisé lâche le bouclier à sa case et s’éloigne', () => {
    const P = porteur('partenaire', 'ennemi', { x: 6, y: 5 }, [BOUCLIER]);
    addCondition(P, COND.brise);
    const T = technomage({ x: 5, y: 5 });
    const heros = combattantDeTest({ id: 'h', label: 'H', kind: 'heros', pos: { x: 9, y: 5 } });
    const scene = { id: 's', label: '', dimensions: { w: 14, h: 12 }, layers: [{ z: 0, tiles: Array(168).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never;
    banc.setState({ scene, party: [], pendingCascade: null, actorMove: null, battle: { ...combat([P, T, heros]), over: null } as never });
    runEnemyAI(banc.getState, banc.setState, P.id);
    banc.reprendreLesEnAttente();
    const p = banc.getState().battle!.combatants.find((c) => c.id === P.id)!;
    expect(p.weapons.some((w) => w.trappingId === BOUCLIER)).toBe(false);
    expect((p.items ?? []).some((i) => i.trappingId === BOUCLIER)).toBe(false);
    expect(Object.values(banc.getState().objetsAuSol).map((lot) => lot[0].trappingId)).toEqual([BOUCLIER]);
    expect(banc.getState().scene!.entities.some((e) => e.kind === 'prop' && e.pos.x === 6 && e.pos.y === 5)).toBe(true);
    expect(p.pos!.x).toBeLessThan(6);
    expect(banc.getState().battle!.log.map((l) => l.text)).toContain(t('cf.bouclierLacheEnFuyant', { name: nomDe(P), weapon: LIBELLE }));
  });
});

describe('la fenêtre de Défense du héros contre un tir s’ouvre par le bouclier du binôme — ZI 13 l.193', () => {
  it('le tireur héros seul ne pare pas le tir ; au contact de son partenaire, la fenêtre s’ouvre', () => {
    const banc = ouvrirLeBanc();
    const T = porteur('tireur', 'heros', { x: 5, y: 5 }, [JEZAIL]);
    const P = porteur('partenaire', 'heros', { x: 6, y: 5 }, [BOUCLIER]);
    const archer = combattantDeTest({ id: 'archer', label: 'archer', kind: 'ennemi', pos: { x: 12, y: 5 }, weapons: [ARC] });
    const scene = { id: 's', label: '', dimensions: { w: 14, h: 12 }, layers: [{ z: 0, tiles: Array(168).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never;
    banc.setState({ scene, party: [T, P], battle: { ...combat([archer, T, P]), over: null } as never });
    expect(refusDeDefenseReactive(banc.getState(), archer, T, ARC)).toBeNull();
    P.pos = { x: 8, y: 8 };
    expect(refusDeDefenseReactive(banc.getState(), archer, T, ARC)).toBe('tir-non-opposable');
  });
});

describe('donnée : le bouclier d’équipe du jezaïl — ZI 13 l.193', () => {
  it('`bouclierDEquipe` se résout vers un bouclier à la seule Protectrice 2', () => {
    const b = findTrappingById(findTrappingById(JEZAIL)!.bouclierDEquipe!.id)!;
    expect(b.shield).toBe(true);
    expect(b.qualities).toEqual([{ id: 'protectrice', value: 2 }]);
  });
});
