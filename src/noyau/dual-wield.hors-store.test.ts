import { describe, it, expect, beforeEach, onTestFinished } from 'vitest';
import { setCadence, CADENCE_DEFAULT } from '../engine/cadence';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialFields } from './stateFields';
import { resolveDualSecond, applyAttackResult, advanceTurn, runEnemyAI } from './combatFlow';
import { rollMeleeDefender, type AttackResult } from '../engine/combat';
import { reverseRoll } from '../engine/tests';
import { isOutOfAction } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import type { Combatant, Weapon, Main } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { findTrappingById } from '../data';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { itemFromTrappingById, recomputeLoadout, loadWeapon } from '../engine/items';
import { weaponLoaded } from '../engine/weaponLoad';
import { cliquerSurLeCombattant } from './combatOrParty';
import { fenetreDAttaque } from './fenetreDAttaque';
import { ciblesDeLaDoubleFrappe, paireDesDeuxArmes } from './combatFlow';
import type { ItemInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const W = (uid: string, hand: Main): Weapon =>
  ({ uid, label: hand === 'main' ? 'Épée' : 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand, hands: 1 });

const CHARS = (cc: number) => ({ 'capacite-de-combat': cc, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });

const mkHero = (over: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'h', name: 'H', kind: 'heros', pos: { x: 0, y: 0 }, size: 'moyenne',
  characteristics: CHARS(50), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: blessuresDeBase(12),
  weapons: [W('m', 'main'), W('o', 'secondaire')], armour: ARM(), ...over,
}) as unknown as Combatant);

const mkFoe = (id: string, x: number): Combatant => (blessuresSurLeProfil({
  id, name: id, kind: 'ennemi', pos: { x, y: 0 }, size: 'moyenne',
  characteristics: CHARS(30), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: blessuresDeBase(10),
  weapons: [{ name: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }], armour: ARM(),
}) as unknown as Combatant);

function setupBattle(heroOver: Partial<Combatant> = {}) {
  seedBattleRng(1);
  const h = mkHero(heroOver); const f1 = mkFoe('f1', 1); const f2 = mkFoe('f2', 1);
  banc.setState({
    scene: { ...emptyScene('scene-test', 8, 4), weather: 'clair' },
    gameTime: 0,
    battle: { combatants: [h, f1, f2], order: ['h', 'f1', 'f2'], turn: 0, round: 1, log: [],
      acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as any,
  });
  const b = banc.getState().battle!;
  return {
    h: b.combatants.find((c) => c.id === 'h')!,
    f1: b.combatants.find((c) => c.id === 'f1')!,
    f2: b.combatants.find((c) => c.id === 'f2')!,
  };
}

describe('resolveDualSecond : 2ᵉ attaque du Maniement de deux armes (LDB 10 l.767-773)', () => {
  beforeEach(() => setupBattle());

  it('le jet INVERSÉ de la main directrice est tranché à l’ouverture, puis joué tel quel (34 → 43)', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ attackerRoll: 34, attackerDetail: { roll: 34, target: 50, success: true, sl: 1 } } as never), dualMode: true } as any });
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDualStrike!.jet).toBe(reverseRoll(34));
    banc.getState().frapperDeLaSecondeArme('f2');
    expect(banc.getState().pendingAttack?.result?.attackerRoll).toBe(43);
  });

  it('exception Critique, ldb : le jet est le d100 du tableau des Critiques du Coup Critique appliqué (LDB 10 l.773 ; LDB 18 l.53)', () => {
    const { f1 } = setupBattle(DEUX_ARMES);
    f1.important = true; // LDB 18 l.44 : hors Mort subite
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ critical: true, critLocation: 'corps' }), dualMode: true } as any });
    banc.getState().jetValider('attaque');
    for (let i = 0; i < 20 && !banc.getState().pendingDualStrike; i++) avanceEtapeCascade(banc.getState, undefined, () => 'subir');
    const crits = (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'critique');
    expect(crits.map((s) => s.reveal?.origine)).toEqual(['coup-critique']);
    const jet = banc.getState().pendingDualStrike!.jet;
    expect(jet).toBe(crits[0].reveal!.dice);
    expect(jet, 'la graine rend la mutation visible').not.toBe(reverseRoll(30));
  });

  // Règles d'arme contextuelles de Groupe (LDB 62 l.146-147) AUSSI pour la 2ᵉ frappe : `resolveDualSecond`
  // replie `effectiveWeapon(off, weaponContextOf(attacker, off))` AVANT touche/Dégâts (le `res` est ensuite
  // appliqué tel quel). Cible Surprise → pas de jet de défense → DR déterministe (jet d'attaque forcé = 23).
  const flail = (): Weapon =>
    ({ uid: 'o', label: 'Fléau', type: 'melee', subType: 'fleau', hand: 'secondaire', hands: 1, damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'percutante' }] });

  it('Fléau en main secondaire SANS la Spé → Atouts retirés (Percutante perdue) vs AVEC la Spé', () => {
    const { h, f2 } = setupBattle();
    const off = flail();
    h.weapons = [W('m', 'main'), off];
    f2.conditions = [{ id: 'surpris' } as any]; // ne se défend pas → résolution déterministe
    h.skills = [];
    const rSans = resolveDualSecond(banc.getState, h, f2, off, reverseRoll(32)).res; // jet forcé = 23 (3 unités) → touche
    h.skills = [{ id: 'corps-a-corps', spec: 'fleau', advances: 0 } as any];
    const rAvec = resolveDualSecond(banc.getState, h, f2, off, reverseRoll(32)).res;
    expect([rSans.hit, rAvec.hit]).toEqual([true, true]);
    expect(rAvec.damage! - rSans.damage!).toBe(3); // Percutante (3 unités) conservée AVEC la Spé, retirée SANS
  });
});

describe('applyAttackResult : defer de l’Avantage de l’attaquant', () => {
  it('deferAttackerAdvantage=true → n’incrémente PAS l’Avantage de l’attaquant', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attaquant',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(banc.getState, banc.setState, h, f1, h.weapons[0], res, { suite: { deferAttackerAdvantage: true } });
    expect(h.advantage).toBe(0);
  });
  it('sans defer → incrémente normalement', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attaquant',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(banc.getState, banc.setState, h, f1, h.weapons[0], res);
    expect(h.advantage).toBe(1);
  });
});

describe('−10 à toutes les défenses du dual-wield (LDB 10 l.767-773)', () => {
  it('un défenseur avec le flag pare 10 plus bas (cible) qu’un défenseur sans', () => {
    const { f1 } = setupBattle();
    const withPen = { ...f1, dualStrikeDefensePenalty: -10 } as Combatant;
    const a = rollMeleeDefender(f1, 'parade', makeRNG(1));
    const c = rollMeleeDefender(withPen, 'parade', makeRNG(1));
    expect(a.target - c.target).toBe(10);
  });
  it('s’applique aussi à l’Esquive (« tous vos lancers défensifs »)', () => {
    const { f1 } = setupBattle();
    const withPen = { ...f1, dualStrikeDefensePenalty: -10 } as Combatant;
    const a = rollMeleeDefender(f1, 'esquive', makeRNG(2));
    const c = rollMeleeDefender(withPen, 'esquive', makeRNG(2));
    expect(a.target - c.target).toBe(10);
  });
});

const hitRes = (over: Partial<AttackResult> = {}): AttackResult => ({
  hit: true, attackerRoll: 30, netSL: 2, critical: false, advantageTo: 'attaquant', defenderDefeated: false,
  woundsLost: 0, location: 'corps', attackerDetail: { roll: 30, target: 50, success: true, sl: 2 }, log: 'touche', ...over,
} as unknown as AttackResult);

/** L'Action « des deux armes » est celle du talent (LDB 10 l.773). */
const DEUX_ARMES: Partial<Combatant> = { talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] };

describe('chaînage de l’Action « des deux armes »', () => {
  it('main touche → pendingDualStrike ouvert + −10 défense posé ; frapperDeLaSecondeArme → 2ᵉ frappe pré-résolue ; confirm → fermé', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true } as any });
    banc.getState().jetValider('attaque');
    const ds = banc.getState().pendingDualStrike;
    expect(ds).not.toBeNull();
    expect(ds!.offWeaponUid).toBe('o');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);

    banc.getState().frapperDeLaSecondeArme('f2');
    const pa = banc.getState().pendingAttack;
    expect(pa?.dualSecond).toBe(true);
    expect(pa?.result).not.toBeNull();

    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDualStrike).toBeNull();
  });

  it('main MANQUE → pas de 2ᵉ frappe (pendingDualStrike reste null), mais −10 défense quand même posé', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ hit: false, advantageTo: 'defenseur' }), dualMode: true } as any });
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDualStrike).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);
  });

  it('main touche et TUE la seule cible à portée → aucun « adversaire disponible » (LDB 10 l.773) : pas de 2ᵉ frappe', () => {
    const { f1, f2 } = setupBattle(DEUX_ARMES);
    f2.pos = { x: 7, y: 3 }; // hors d'Allonge de la main secondaire
    f1.wounds.current = 8; // dépassement : Mort Subite du figurant (LDB 18 l.46)
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ damage: 9, woundsLost: 9 }), dualMode: true } as any });
    banc.getState().jetValider('attaque');
    draineCascade(banc.getState); // Blessure Critique du dépassement, Déviation comprise : LDB 18 l.17, LDB 63 l.30
    expect(isOutOfAction(banc.getState().battle!.combatants.find((c) => c.id === 'f1')!), 'pré-requis : la 1re frappe a tué').toBe(true);
    expect(banc.getState().pendingDualStrike).toBeNull();
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(h.advantage, 'une seule frappe a touché : aucun Avantage (LDB 10 l.773)').toBe(0);
    expect(h.dualStrikeDefensePenalty, 'les deux armes ont été choisies : −10 aux défenses (LDB 10 l.773)').toBe(-10);
  });
});

describe('Avantage : +1 UNIQUE et seulement si les DEUX frappes touchent (LDB 10 l.767-773)', () => {
  it('les deux touchent → +1 Avantage (pas +1 par frappe)', () => {
    const { h } = setupBattle();
    h.advantage = 0;
    banc.setState({
      pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any,
      pendingAttack: { attackerId: 'h', targetId: 'f2', location: 'corps', result: hitRes(), dualSecond: true, weaponUid: 'o' } as any,
    });
    banc.getState().jetValider('attaque');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.advantage).toBe(1);
    expect(banc.getState().pendingDualStrike).toBeNull();
  });

  it('la 2ᵉ manque → 0 Avantage (pas « les deux »)', () => {
    const { h } = setupBattle();
    h.advantage = 0;
    banc.setState({
      pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any,
      pendingAttack: { attackerId: 'h', targetId: 'f2', location: 'corps', result: hitRes({ hit: false, advantageTo: 'defenseur' }), dualSecond: true, weaponUid: 'o' } as any,
    });
    banc.getState().jetValider('attaque');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.advantage).toBe(0);
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
});

describe('bornage : jamais sur une attaque gratuite / enchaînée (LDB 10 l.767-773 « pour votre Action »)', () => {
  it('attaque d’enchaînement (cleave) avec le talent : pas de pendingDualStrike', () => {
    setupBattle({ talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] as any });
    // Une attaque de balayage (cleave) n'a JAMAIS dualMode (le toggle est masqué si pa.cleave).
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), cleave: true } as any });
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
  it('attaque normale (sans dualMode) avec le talent : pas de pendingDualStrike', () => {
    setupBattle({ talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] as any });
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes() } as any });
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
});

describe('Main ensanglantée (AA 07 l.117) — 2ᵉ frappe « des deux armes » : un SEUL Test avant l\'Action', () => {
  // « Des deux armes » = UNE Action impliquant les DEUX mains (main directrice + 2nde). La directrice est testée
  // à la déclaration (`openAttackCascade`) ; si SEULE la 2nde est gatée, la 2ᵉ frappe joue le Test avant de se
  // résoudre. Sur Échec, l'objet de la 2nde main glisse (`disarm`) ; la 2ᵉ frappe est renoncée.
  const gatedHero = (hands: Main[]): Partial<Combatant> => ({
    handGates: hands, activeLoadoutId: 'lo',
    loadouts: [{ id: 'lo', main: 'm', secondaire: 'o' }] as never,
    items: [{ uid: 'm', name: 'Épée', kind: 'melee', qualities: [] }, { uid: 'o', name: 'Dague', kind: 'melee', qualities: [] }] as never,
  });

  it('SEULE la 2nde main gatée → la 2ᵉ frappe interpose le Test (pas encore résolue)', () => {
    setupBattle(gatedHero(['secondaire']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().frapperDeLaSecondeArme('f2');
    const s = banc.getState();
    expect(s.pendingHandGate?.hand).toBe('secondaire');
    expect(s.pendingAttack).toBeNull();
    expect(s.pendingDualStrike).not.toBeNull(); // le sous-flux dual reste ouvert pour la reprise
  });

  it('RÉUSSITE → la 2ᵉ frappe se résout (dualSecond pré-résolu)', () => {
    setupBattle(gatedHero(['secondaire']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().frapperDeLaSecondeArme('f2');
    const pg = banc.getState().pendingHandGate!;
    banc.setState({ pendingHandGate: { ...pg, roll: pg.target, success: true, sl: 0 } });
    banc.getState().jetValider('mainEnsanglantee');
    const s = banc.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack?.dualSecond).toBe(true);
    expect(s.pendingAttack?.result).not.toBeNull();
  });

  it('ÉCHEC → l\'objet de la 2nde main glisse (pas la directrice) ; 2ᵉ frappe renoncée, sous-flux clos', () => {
    setupBattle(gatedHero(['secondaire']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().frapperDeLaSecondeArme('f2');
    const pg = banc.getState().pendingHandGate!;
    banc.setState({ pendingHandGate: { ...pg, roll: 99, success: false, sl: -3 } });
    banc.getState().jetValider('mainEnsanglantee');
    const s = banc.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack).toBeNull();
    expect(s.pendingDualStrike).toBeNull();
    const hero = s.battle!.combatants.find((c) => c.id === 'h')!;
    expect(hero.loadouts![0].secondaire).toBeUndefined(); // 2nde arme lâchée
    expect(hero.loadouts![0].main).toBe('m');       // main directrice CONSERVÉE
  });

  it('un SEUL Test par Action : main directrice AUSSI gatée → la 2nde n\'est PAS re-testée', () => {
    setupBattle(gatedHero(['main', 'secondaire']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().frapperDeLaSecondeArme('f2');
    const s = banc.getState();
    expect(s.pendingHandGate).toBeNull();           // le Test de la directrice a déjà couvert l'Action
    expect(s.pendingAttack?.dualSecond).toBe(true); // la 2ᵉ frappe se résout directement
  });
});

describe('purge du −10 au début du prochain Tour du porteur', () => {
  it('survit aux Tours adverses puis est purgé quand le porteur (order[0]) rejoue', () => {
    const { h } = setupBattle();
    h.dualStrikeDefensePenalty = -10;
    banc.setState({ battle: { ...banc.getState().battle!, turn: 0 } });
    advanceTurn(banc.getState, banc.setState); banc.abandonner(); // → f1 : flag de h conservé
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);
    advanceTurn(banc.getState, banc.setState); banc.abandonner(); // → f2 : conservé
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);
    advanceTurn(banc.getState, banc.setState); // franchissement de Round → h (order[0]) : purgé
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBeUndefined();
  });
});

describe('#998 — la 2ᵉ frappe opposée à un défenseur SURFACÉ passe par SA fenêtre (LDB 10 l.773)', () => {
  it('siège MJ : 2ᵉ frappe résolue en attaquant seul, la fenêtre s’interpose, la fermeture l’applique', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    // La 1ʳᵉ frappe revient de SA fenêtre (`pa.defended`, posé par `jetValider('defense')`) : elle touche.
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true, defended: true } as any });
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDualStrike).not.toBeNull();
    banc.getState().frapperDeLaSecondeArme('f2');
    expect(banc.getState().pendingAttack?.result?.defenderDetail, 'aucun jet de défense roulé en silence').toBeUndefined();
    banc.getState().jetValider('attaque');
    const pd = banc.getState().pendingDefense;
    expect(pd?.defenderId, 'la fenêtre de f2 s’interpose').toBe('f2');
    expect(pd?.suite.mode === 'pilotee' && pd.suite.pa.dualSecond, 'la 2ᵉ frappe voyage sur la fenêtre').toBe(true);
    banc.getState().jetLancer('defense');
    banc.getState().jetValider('defense');
    expect(banc.getState().pendingDefense).toBeNull();
    expect(banc.getState().pendingDualStrike, 'la 2ᵉ frappe est appliquée').toBeNull();
  });

  it('défenseur non surfacé : la 2ᵉ frappe garde son jet de défense neuf', () => {
    const { h, f2 } = setupBattle();
    const res = resolveDualSecond(banc.getState, h, f2, h.weapons[1], reverseRoll(34)).res;
    expect(res.defenderDetail).toBeDefined();
  });

  it('le jet tranché à l’ouverture survit à la fenêtre du défenseur surfacé', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true, defended: true } as any });
    banc.getState().jetValider('attaque');
    banc.setState({ pendingDualStrike: { ...banc.getState().pendingDualStrike!, jet: 56 } });
    banc.getState().frapperDeLaSecondeArme('f2');
    expect(banc.getState().pendingAttack?.result?.attackerDetail?.roll, 'la 2ᵉ frappe prend le jet tranché').toBe(56);
    banc.getState().jetValider('attaque');
    expect((banc.getState().pendingDefense as any)?.atk?.roll, 'le jet figé voyage sur la fenêtre').toBe(56);
    banc.getState().jetLancer('defense');
    expect(banc.getState().pendingDefense?.result?.attackerDetail?.roll, 'l’opposition garde le jet de l’attaquant').toBe(56);
  });

  it('DR net identique, défenseur surfacé ou non, à dés égaux', () => {
    const { h, f2 } = setupBattle();
    const inline = resolveDualSecond(banc.getState, h, f2, h.weapons[1], reverseRoll(34)).res;
    const deDefense = (inline.defenderDetail as any).roll as number;
    banc.setState({ ...initialFields(), battle: null });
    setupBattle(DEUX_ARMES);
    banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ attackerRoll: 43, attackerDetail: { roll: 43, target: 50, success: true, sl: 0 } } as any), dualMode: true, defended: true } as any });
    banc.getState().jetValider('attaque');
    banc.setState({ pendingDualStrike: { ...banc.getState().pendingDualStrike!, jet: reverseRoll(34) } });
    banc.getState().frapperDeLaSecondeArme('f2');
    banc.getState().jetValider('attaque');
    banc.getState().jetLancer('defense');
    banc.getState().jetImposerLeResultat('defense', deDefense);
    expect(banc.getState().pendingDefense?.result?.netSL).toBe(inline.netSL);
  });
});

describe('Maniement de deux armes au tir (LDB 10 l.767-773 ; LDB 14 l.138)', () => {
  const objet = (id: string, uid: string, over: Partial<ItemInstance> = {}): ItemInstance =>
    ({ ...itemFromTrappingById(id, idsDeTest)!, uid, equipped: true, ...over });

  /** Héros au Talent tenant `main` et `secondaire` (objets réels, armes de tir chargées), munitions `munitions` ;
   *  f1 et f2 à 3 cases, `loin` hors de portée de pistolet. */
  function tireur(main: ItemInstance, secondaire: ItemInstance, munitions: ItemInstance[]) {
    seedBattleRng(1);
    const h = mkHero({ ...DEUX_ARMES, characteristics: { ...CHARS(50), 'capacite-de-tir': 60 } });
    h.items = [main, secondaire, ...munitions];
    h.loadouts = [{ id: 'lo', main: main.uid, secondaire: secondaire.uid }];
    h.activeLoadoutId = 'lo';
    recomputeLoadout(h);
    for (const w of h.weapons) if (w.type === 'distance') loadWeapon(findTrappingById, h, w);
    const f1 = mkFoe('f1', 3); const f2 = mkFoe('f2', 3); f2.pos = { x: 3, y: 1 };
    const loin = mkFoe('loin', 39);
    banc.setState({
      mode: 'battle', scene: { ...emptyScene('scene-test', 40, 4), weather: 'clair' }, gameTime: 0, party: [h],
      battle: { combatants: [h, f1, f2, loin], order: ['h', 'f1', 'f2', 'loin'], baseOrder: ['h', 'f1', 'f2', 'loin'], turn: 0, round: 1, log: [],
        action: null, acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map(), over: null } as any,
    });
    return h;
  }
  const g = () => banc.getState();
  const vivant = (id: string) => g().battle!.combatants.find((c) => c.id === id)!;
  const munition = (qty: number) => objet('balle-et-poudre', 'bp', { equipped: false, qty });
  const deuxArmesOffert = (cible: string): boolean => {
    cliquerSurLeCombattant(g, cible, { confirm: true });
    return !!fenetreDAttaque(g())?.deuxArmes;
  };

  it('deux pistolets chargés : 1re frappe au principal, 2e au secondaire au jet inversé avec la main secondaire ; les deux déchargés, deux munitions décomptées', () => {
    tireur(objet('pistolet', 'p1'), objet('pistolet', 'p2'), [munition(5)]);
    expect(deuxArmesOffert('f1')).toBe(true);
    g().jetRegler('attaque', 'deuxArmes', true);
    expect(g().pendingAttack?.weaponUid).toBe('p1');
    g().jetLancer('attaque');
    g().jetImposerLeResultat('attaque', 21);
    g().jetValider('attaque');
    draineCascade(g);
    expect(g().pendingDualStrike).toMatchObject({ offWeaponUid: 'p2', jet: 12 });
    const cibles = ciblesDeLaDoubleFrappe(g()).map((c) => c.id);
    expect(cibles).toContain('f2');
    expect(cibles, 'hors de portée du pistolet secondaire (LDB 13 l.114)').not.toContain('loin');
    g().frapperDeLaSecondeArme('f2');
    const pa = g().pendingAttack!;
    expect(pa).toMatchObject({ weaponUid: 'p2', dualSecond: true, targetId: 'f2' });
    expect(pa.result?.attackerRoll).toBe(12);
    expect(pa.result?.attackerDetail?.label).toMatch(/Projectiles/);
    const lignes = [...(pa.result?.attackerDetail?.mods ?? []), ...(pa.result?.attackerDetail?.difficultyParts ?? [])];
    expect(lignes.map((m) => m.ref?.id), 'LDB 14 l.78').toContain('main-secondaire');
    g().jetValider('attaque');
    draineCascade(g);
    expect(g().pendingDualStrike).toBeNull();
    const h = vivant('h');
    expect(h.weapons.filter((w) => w.type === 'distance').map((w) => weaponLoaded(h, w))).toEqual([false, false]);
    expect(h.items!.find((i) => i.uid === 'bp')?.qty).toBe(3);
  });

  it('pistolet secondaire vide ou sans munition : « des deux armes » n’est pas offert', () => {
    const h = tireur(objet('pistolet', 'p1'), objet('pistolet', 'p2'), [munition(5)]);
    const p2 = h.weapons.find((w) => w.uid === 'p2')!;
    h.items!.find((i) => i.uid === 'p2')!.loaded = false;
    expect(weaponLoaded(h, p2)).toBe(false);
    expect(deuxArmesOffert('f1')).toBe(false);
    tireur(objet('pistolet', 'p1'), objet('pistolet', 'p2'), []);
    expect(deuxArmesOffert('f1')).toBe(false);
  });

  it('une seule munition : la 1re frappe la dépense, la 2e n’a pas de cible', () => {
    tireur(objet('pistolet', 'p1'), objet('pistolet', 'p2'), [munition(1)]);
    expect(deuxArmesOffert('f1')).toBe(true);
    g().jetRegler('attaque', 'deuxArmes', true);
    g().jetLancer('attaque');
    g().jetImposerLeResultat('attaque', 21);
    g().jetValider('attaque');
    draineCascade(g);
    expect(g().pendingDualStrike).toBeNull();
  });

  it('ennemi épée et pistolet, sans munition suivie (#126) : la paire est admise', () => {
    const e = tireur(objet('arme-simple', 'e1'), objet('pistolet', 'p2'), []);
    expect(paireDesDeuxArmes(g, e), 'le héros sans munition ne tire pas').toBeUndefined();
    e.kind = 'ennemi';
    expect(paireDesDeuxArmes(g, e)?.secondaire.uid).toBe('p2');
  });

  it('arc en main secondaire : « des deux armes » n’est pas offert', () => {
    tireur(objet('pistolet', 'p1'), objet('arc', 'a2'), [munition(5), objet('fleche', 'fl', { equipped: false, qty: 5 })]);
    expect(vivant('h').weapons.find((w) => w.uid === 'a2')?.hand).toBe('secondaire');
    expect(deuxArmesOffert('f1')).toBe(false);
  });

  it('épée en main, pistolet en secondaire : la 2e frappe part au tir', () => {
    tireur(objet('arme-simple', 'e1'), objet('pistolet', 'p2'), [munition(5)]);
    const f1 = vivant('f1'); f1.pos = { x: 1, y: 0 };
    expect(deuxArmesOffert('f1')).toBe(true);
    g().jetRegler('attaque', 'deuxArmes', true);
    expect(g().pendingAttack?.weaponUid).toBe('e1');
    g().jetLancer('attaque');
    g().jetImposerLeResultat('attaque', 21);
    g().jetValider('attaque');
    draineCascade(g);
    expect(ciblesDeLaDoubleFrappe(g()).map((c) => c.id)).toContain('f2');
    g().frapperDeLaSecondeArme('f2');
    expect(g().pendingAttack?.result?.attackerDetail?.label).toMatch(/Projectiles/);
  });

  it('cible Inconsciente : la 2e frappe touche d’office, à la mêlée comme au tir (LDB 16 l.113)', () => {
    const { h, f2 } = setupBattle(DEUX_ARMES);
    f2.conditions = [{ id: 'inconscient' } as any];
    expect(resolveDualSecond(banc.getState, h, f2, h.weapons[1], 96).res.hit).toBe(true);
    const tir = tireur(objet('pistolet', 'p1'), objet('pistolet', 'p2'), [munition(5)]);
    const cible = vivant('f2');
    cible.conditions = [{ id: 'inconscient' } as any];
    expect(resolveDualSecond(banc.getState, tir, cible, tir.weapons.find((w) => w.uid === 'p2')!, 96).res.hit).toBe(true);
  });

  it('2e frappe au tir dans la mêlée, manquée par sa seule pénalité : elle dévie sur l’allié Engagé (LDB 14 l.116)', () => {
    const h = tireur(objet('pistolet', 'p1'), objet('pistolet', 'p2'), [munition(5)]);
    const allie = mkHero({ id: 'a', pos: { x: 4, y: 1 }, engagedWith: ['f2'] });
    vivant('f2').engagedWith = ['a'];
    g().battle!.combatants.push(allie);
    const p2 = h.weapons.find((w) => w.uid === 'p2')!;
    const cible = resolveDualSecond(banc.getState, h, vivant('f2'), p2, 1).res.attackerDetail!.target;
    expect(deuxArmesOffert('f1')).toBe(true);
    g().jetRegler('attaque', 'deuxArmes', true);
    g().jetLancer('attaque');
    g().jetImposerLeResultat('attaque', 21);
    g().jetValider('attaque');
    draineCascade(g);
    banc.setState({ pendingDualStrike: { ...g().pendingDualStrike!, jet: cible + 10 } });
    g().frapperDeLaSecondeArme('f2');
    expect(g().pendingAttack).toMatchObject({ targetId: 'f2', victimId: 'a' });
    expect(g().pendingAttack?.result?.hit).toBe(true);
  });
});

describe('Maniement de deux armes de la machine (LDB 10 l.767-773 ; LDB 14 l.138 ; AA 07 l.117)', () => {
  const objet = (id: string, uid: string, over: Partial<ItemInstance> = {}): ItemInstance =>
    ({ ...itemFromTrappingById(id, idsDeTest)!, uid, equipped: true, ...over });
  const g = () => banc.getState();
  const vivant = (id: string) => g().battle!.combatants.find((c) => c.id === id)!;

  /** `porteur` au Talent tient `main` et `secondaire` (armes de tir chargées) ; les adversaires `cibles`, posés où
   *  la fixture le dit ; c'est le tour du porteur. */
  function arene(porteur: Combatant, main: ItemInstance, secondaire: ItemInstance, cibles: Combatant[], seed: number, munitions: ItemInstance[] = []) {
    seedBattleRng(seed);
    porteur.talents = [{ talentId: 'maniement-de-deux-armes', times: 1 }] as Combatant['talents'];
    porteur.characteristics = { ...CHARS(95), 'capacite-de-tir': 95 } as Combatant['characteristics'];
    porteur.items = [main, secondaire, ...munitions];
    porteur.loadouts = [{ id: 'lo', main: main.uid, secondaire: secondaire.uid }];
    porteur.activeLoadoutId = 'lo';
    recomputeLoadout(porteur);
    for (const w of porteur.weapons) if (w.type === 'distance') loadWeapon(findTrappingById, porteur, w);
    const tous = [porteur, ...cibles];
    banc.setState({
      mode: 'battle', scene: { ...emptyScene('scene-test', 40, 12), weather: 'clair' }, gameTime: 0,
      party: tous.filter((c) => c.kind === 'heros'),
      battle: { combatants: tous, order: tous.map((c) => c.id), baseOrder: tous.map((c) => c.id), turn: 0, round: 1, log: [],
        action: null, acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map(), over: null } as any,
    });
  }
  const ennemiAuTalent = (): Combatant => { const e = mkFoe('e', 5); e.pos = { x: 5, y: 5 }; return e; };
  const herosAuto = (id: string, pos: { x: number; y: number }): Combatant => mkHero({ id, pos, aiControlled: true, weapons: [W(`${id}-m`, 'main')] });
  const aLaMain = (id: string) => g().battle!.order[g().battle!.turn] === id;
  /** Poursuit le tour du porteur, étape par étape, jusqu'à ce qu'il rende la main ou qu'une fenêtre de défense la
   *  tienne. */
  const poursuivre = (id: string) => {
    for (let i = 0; i < 100 && aLaMain(id) && !g().pendingDefense; i++) {
      const avant = g();
      if (avant.pendingCascade) draineCascade(g, 1);
      else if (!banc.jusquA((s) => !!s.pendingCascade || s.battle!.order[s.battle!.turn] !== id, 50)) break;
      if (g() === avant && !banc.jusquALaProchaine()) break; // l'étape d'un héros en Auto-combat se joue au tick de la cadence
    }
  };
  const jouerLeTour = (id: string) => { runEnemyAI(g, banc.setState, id); poursuivre(id); };
  const charges = (id: string) => { const c = vivant(id); return c.weapons.filter((w) => w.type === 'distance').map((w) => weaponLoaded(c, w)); };

  const deuxPistolets = () => [objet('pistolet', 'p1'), objet('pistolet', 'p2')] as const;
  const coupsPortes = (id: string) => g().battle!.log.filter((l) => l.actorId === id && /touche|manque|rate son attaque/.test(l.text));

  it('ennemi à deux pistolets contre des héros non surfacés : deux tirs, les deux pistolets déchargés, −10 aux défenses, +1 Avantage quand les deux touchent', () => {
    arene(ennemiAuTalent(), ...deuxPistolets(), [herosAuto('h1', { x: 5, y: 8 }), herosAuto('h2', { x: 6, y: 8 })], 1);
    jouerLeTour('e');
    const e = vivant('e');
    expect(aLaMain('e'), 'le tour de la machine a repris jusqu’au bout').toBe(false);
    expect(g().pendingDualStrike, 'la machine ne tient aucune fenêtre').toBeNull();
    expect(charges('e')).toEqual([false, false]);
    expect(e.dualStrikeDefensePenalty).toBe(-10);
    expect(coupsPortes('e').map((l) => /touche/.test(l.text))).toEqual([true, true]);
    expect(e.advantage).toBe(1);
  });

  it('la 2e frappe manque : aucun Avantage (LDB 10 l.773)', () => {
    arene(ennemiAuTalent(), ...deuxPistolets(), [herosAuto('h1', { x: 5, y: 8 }), herosAuto('h2', { x: 6, y: 8 })], 5);
    jouerLeTour('e');
    expect(coupsPortes('e').map((l) => /touche/.test(l.text))).toEqual([true, false]);
    expect(charges('e')).toEqual([false, false]);
    expect(vivant('e').advantage).toBe(0);
  });

  it('la 1re frappe manque : pas de 2e frappe, le pistolet secondaire reste chargé, −10 aux défenses quand même', () => {
    arene(ennemiAuTalent(), ...deuxPistolets(), [herosAuto('h1', { x: 5, y: 8 }), herosAuto('h2', { x: 6, y: 8 })], 36);
    jouerLeTour('e');
    expect(coupsPortes('e').map((l) => /touche/.test(l.text))).toEqual([false]);
    expect(charges('e')).toEqual([false, true]);
    expect(vivant('e').dualStrikeDefensePenalty).toBe(-10);
    expect(aLaMain('e')).toBe(false);
  });


  it('défenseur héros surfacé : la fenêtre de la 2e frappe s’ouvre au jet figé, puis le tour de la machine reprend', () => {
    arene(ennemiAuTalent(), ...deuxPistolets(), [mkHero({ pos: { x: 6, y: 5 }, wounds: blessuresDeBase(40) })], 1);
    jouerLeTour('e');
    const premiere = g().pendingDefense!;
    expect([premiere.defenderId, premiere.suite], 'la 1re frappe, des deux armes, s’oppose dans la fenêtre du héros').toMatchObject(['h', { mode: 'pilotee', pa: { dualMode: true, weaponUid: 'p1' } }]);
    const jet = premiere.atk!.roll;
    g().jetLancer('defense');
    g().jetImposerLeResultat('defense', 100);
    g().jetValider('defense');
    poursuivre('e');
    const seconde = g().pendingDefense!;
    expect(seconde.defenderId).toBe('h');
    expect(seconde.suite).toMatchObject({ mode: 'machine', coup: { secondeFrappe: true } });
    expect(seconde.atk!.roll, 'LDB 10 l.773 : le jet de la 1re frappe, inversé').toBe(reverseRoll(jet));
    g().jetLancer('defense');
    g().jetImposerLeResultat('defense', 100);
    g().jetValider('defense');
    poursuivre('e');
    expect(g().pendingDefense).toBeNull();
    expect(charges('e')).toEqual([false, false]);
    expect(vivant('e').advantage, 'les deux frappes ont touché').toBe(1);
    expect(aLaMain('e'), 'le tour de la machine a repris jusqu’au bout').toBe(false);
  });

  it('épée et pistolet : la mêlée, puis le tir de la main secondaire', () => {
    arene(ennemiAuTalent(), objet('arme-simple', 'e1'), objet('pistolet', 'p2'), [herosAuto('h1', { x: 6, y: 5 }), herosAuto('h2', { x: 5, y: 8 })], 2);
    jouerLeTour('e');
    expect(coupsPortes('e').map((l) => /touche/.test(l.text))).toEqual([true, true]);
    expect(charges('e'), 'le pistolet secondaire a tiré').toEqual([false]);
    expect(vivant('e').dualStrikeDefensePenalty).toBe(-10);
    expect(vivant('e').advantage).toBe(1);
  });

  it('gratuites « à la touche » de la 1re frappe jouées après la 2e, même quand elle suspend sur un défenseur surfacé (LDB 10 l.72)', () => {
    for (const surface of [false, true]) {
      const h = surface ? mkHero({ pos: { x: 6, y: 5 }, wounds: blessuresDeBase(40) }) : herosAuto('h', { x: 6, y: 5 });
      h.wounds = blessuresDeBase(40);
      arene(ennemiAuTalent(), objet('arme-simple', 'e1'), objet('dague', 'd2'), [h], 2);
      const e = vivant('e');
      e.talents = [...e.talents!, { talentId: 'assaut-feroce', times: 1 }] as Combatant['talents'];
      e.advantage = 3;
      jouerLeTour('e');
      for (let i = 0; i < 5 && g().pendingDefense; i++) {
        g().jetLancer('defense');
        g().jetImposerLeResultat('defense', 100);
        g().jetValider('defense');
        poursuivre('e');
      }
      expect(coupsPortes('e').map((l) => /touche/.test(l.text)), surface ? 'surfacé' : 'non surfacé').toEqual([true, true, true]);
      expect(aLaMain('e')).toBe(false);
    }
  });

  it('cible Sonnée : +1 Avantage avant chacune des deux frappes de mêlée (LDB 16 l.125)', () => {
    const h = herosAuto('h', { x: 6, y: 5 });
    h.wounds = blessuresDeBase(40);
    h.conditions = [{ id: 'sonne', stacks: 1 } as any];
    arene(ennemiAuTalent(), objet('arme-simple', 'e1'), objet('dague', 'd2'), [h], 2);
    jouerLeTour('e');
    expect(coupsPortes('e').map((l) => /touche/.test(l.text))).toEqual([true, true]);
    expect(vivant('e').advantage, 'Sonnée ×2, les deux touchent ×1').toBe(3);
  });

  it('Main ensanglantée de la seule main secondaire : Test à la 2e frappe, Échec → l’arme glisse et la 2e frappe est renoncée (AA 07 l.117)', () => {
    const e = ennemiAuTalent();
    e.handGates = ['secondaire'];
    arene(e, ...deuxPistolets(), [herosAuto('h1', { x: 5, y: 8 }), herosAuto('h2', { x: 6, y: 8 })], 2);
    vivant('e').characteristics.dexterite = 0;
    jouerLeTour('e');
    expect(coupsPortes('e').map((l) => /touche/.test(l.text))).toEqual([true]);
    expect(vivant('e').loadouts![0].secondaire).toBeUndefined();
    expect(aLaMain('e')).toBe(false);
  });

  it('héros en Auto-combat : la machine joue la 2e frappe, aucune fenêtre ouverte, deux munitions décomptées', () => {
    setCadence('auto');
    onTestFinished(() => setCadence(CADENCE_DEFAULT));
    const f1 = mkFoe('f1', 5); f1.pos = { x: 5, y: 8 };
    const f2 = mkFoe('f2', 6); f2.pos = { x: 6, y: 8 };
    arene(mkHero({ pos: { x: 5, y: 5 } }), ...deuxPistolets(), [f1, f2], 1, [objet('balle-et-poudre', 'bp', { equipped: false, qty: 5 })]);
    jouerLeTour('h');
    expect(g().pendingDualStrike).toBeNull();
    expect(coupsPortes('h').map((l) => /touche/.test(l.text))).toEqual([true, true]);
    expect(charges('h')).toEqual([false, false]);
    expect(vivant('h').items!.find((i) => i.uid === 'bp')?.qty).toBe(3);
  });
});
