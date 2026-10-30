import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialFields } from './stateFields';
import { resolveDualSecond, applyAttackResult } from './combatFlow';
import { reverseRoll, rollMeleeDefender, type AttackResult } from '../engine/combat';
import { isOutOfAction } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import type { Combatant, Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const W = (uid: string, hand: 'main' | 'off'): Weapon =>
  ({ uid, label: hand === 'main' ? 'Épée' : 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand, hands: 1 });

const CHARS = (cc: number) => ({ 'capacite-de-combat': cc, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });

const mkHero = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', name: 'H', kind: 'hero', pos: { x: 0, y: 0 }, size: 'moyenne',
  characteristics: CHARS(50), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 12, max: 12, current: 12 },
  weapons: [W('m', 'main'), W('o', 'off')], armour: ARM(), ...over,
} as unknown as Combatant);

const mkFoe = (id: string, x: number): Combatant => ({
  id, name: id, kind: 'enemy', pos: { x, y: 0 }, size: 'moyenne',
  characteristics: CHARS(30), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 10, max: 10, current: 10 },
  weapons: [{ name: 'Griffe', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }], armour: ARM(),
} as unknown as Combatant);

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
    setupBattle();
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ attackerRoll: 34, attackerDetail: { roll: 34, target: 50, success: true, sl: 1 } } as never), dualMode: true } as any });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingDualStrike!.jet).toBe(reverseRoll(34));
    banc.getState().dualStrikeAttack('f2');
    expect(banc.getState().pendingAttack?.result?.attackerRoll).toBe(43);
  });

  it('exception Critique, ldb : le jet est le d100 du tableau des Critiques du Coup Critique appliqué (LDB 10 l.773 ; LDB 18 l.53)', () => {
    const { f1 } = setupBattle();
    f1.important = true; // LDB 18 l.44 : hors Mort subite
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ critical: true, critLocation: 'corps' }), dualMode: true } as any });
    banc.getState().attackConfirm();
    for (let i = 0; i < 20 && !banc.getState().pendingDualStrike; i++) avanceEtapeCascade(banc.getState, undefined, () => 'subir');
    const crits = (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'critical');
    expect(crits.map((s) => s.reveal?.origine)).toEqual(['coup-critique']);
    const jet = banc.getState().pendingDualStrike!.jet;
    expect(jet).toBe(crits[0].reveal!.dice);
    expect(jet, 'la graine rend la mutation visible').not.toBe(reverseRoll(30));
  });

  // Règles d'arme contextuelles de Groupe (LDB 62 l.146-147) AUSSI pour la 2ᵉ frappe : `resolveDualSecond`
  // replie `effectiveWeapon(off, weaponContextOf(attacker, off))` AVANT touche/Dégâts (le `res` est ensuite
  // appliqué tel quel). Cible Surprise → pas de jet de défense → DR déterministe (jet d'attaque forcé = 23).
  const flail = (): Weapon =>
    ({ uid: 'o', label: 'Fléau', type: 'melee', subType: 'fleau', hand: 'off', hands: 1, damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'percutante' }] });

  it('Fléau en main secondaire SANS la Spé → Atouts retirés (Percutante perdue) vs AVEC la Spé', () => {
    const { h, f2 } = setupBattle();
    const off = flail();
    h.weapons = [W('m', 'main'), off];
    f2.conditions = [{ id: 'surpris' } as any]; // ne se défend pas → résolution déterministe
    h.skills = [];
    const rSans = resolveDualSecond(banc.getState, h, f2, off, reverseRoll(32)); // jet forcé = 23 (3 unités) → touche
    h.skills = [{ id: 'corps-a-corps', spec: 'fleau', advances: 0 } as any];
    const rAvec = resolveDualSecond(banc.getState, h, f2, off, reverseRoll(32));
    expect([rSans.hit, rAvec.hit]).toEqual([true, true]);
    expect(rAvec.damage! - rSans.damage!).toBe(3); // Percutante (3 unités) conservée AVEC la Spé, retirée SANS
  });
});

describe('applyAttackResult : defer de l’Avantage de l’attaquant', () => {
  it('deferAttackerAdvantage=true → n’incrémente PAS l’Avantage de l’attaquant', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(banc.getState, banc.setState, h, f1, h.weapons[0], res, { suite: { deferAttackerAdvantage: true } });
    expect(h.advantage).toBe(0);
  });
  it('sans defer → incrémente normalement', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
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
  hit: true, attackerRoll: 30, netSL: 2, critical: false, advantageTo: 'attacker', defenderDefeated: false,
  woundsLost: 0, location: 'corps', attackerDetail: { roll: 30, target: 50, success: true, sl: 2 }, log: 'touche', ...over,
} as unknown as AttackResult);

/** L'Action « des deux armes » est celle du talent (LDB 10 l.773). */
const DEUX_ARMES: Partial<Combatant> = { talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] };

describe('chaînage de l’Action « des deux armes »', () => {
  it('main touche → pendingDualStrike ouvert + −10 défense posé ; dualStrikeAttack → 2ᵉ frappe pré-résolue ; confirm → fermé', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true } as any });
    banc.getState().attackConfirm();
    const ds = banc.getState().pendingDualStrike;
    expect(ds).not.toBeNull();
    expect(ds!.offWeaponUid).toBe('o');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);

    banc.getState().dualStrikeAttack('f2');
    const pa = banc.getState().pendingAttack;
    expect(pa?.dualSecond).toBe(true);
    expect(pa?.result).not.toBeNull();

    banc.getState().attackConfirm();
    expect(banc.getState().pendingDualStrike).toBeNull();
  });

  it('main MANQUE → pas de 2ᵉ frappe (pendingDualStrike reste null), mais −10 défense quand même posé', () => {
    setupBattle(DEUX_ARMES);
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ hit: false, advantageTo: 'defender' }), dualMode: true } as any });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingDualStrike).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);
  });

  it('main touche et TUE la seule cible à portée → aucun « adversaire disponible » (LDB 10 l.773) : pas de 2ᵉ frappe', () => {
    const { f1, f2 } = setupBattle(DEUX_ARMES);
    f2.pos = { x: 7, y: 3 }; // hors d'Allonge de la main secondaire
    f1.wounds.current = 8; // dépassement : Mort Subite du figurant (LDB 18 l.46)
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ damage: 9, woundsLost: 9 }), dualMode: true } as any });
    banc.getState().attackConfirm();
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
    banc.getState().attackConfirm();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.advantage).toBe(1);
    expect(banc.getState().pendingDualStrike).toBeNull();
  });

  it('la 2ᵉ manque → 0 Avantage (pas « les deux »)', () => {
    const { h } = setupBattle();
    h.advantage = 0;
    banc.setState({
      pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any,
      pendingAttack: { attackerId: 'h', targetId: 'f2', location: 'corps', result: hitRes({ hit: false, advantageTo: 'defender' }), dualSecond: true, weaponUid: 'o' } as any,
    });
    banc.getState().attackConfirm();
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.advantage).toBe(0);
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
});

describe('bornage : jamais sur une attaque gratuite / enchaînée (LDB 10 l.767-773 « pour votre Action »)', () => {
  it('attaque d’enchaînement (cleave) avec le talent : pas de pendingDualStrike', () => {
    setupBattle({ talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] as any });
    // Une attaque de balayage (cleave) n'a JAMAIS dualMode (le toggle est masqué si pa.cleave).
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), cleave: true } as any });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
  it('attaque normale (sans dualMode) avec le talent : pas de pendingDualStrike', () => {
    setupBattle({ talents: [{ talentId: 'maniement-de-deux-armes', times: 1 }] as any });
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes() } as any });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
});

describe('Main ensanglantée (AA 07 l.117) — 2ᵉ frappe « des deux armes » : un SEUL Test avant l\'Action', () => {
  // « Des deux armes » = UNE Action impliquant les DEUX mains (main directrice + 2nde). La directrice est testée
  // à la déclaration (`openAttackCascade`) ; si SEULE la 2nde est gatée, la 2ᵉ frappe joue le Test avant de se
  // résoudre. Sur Échec, l'objet de la 2nde main glisse (`disarm`) ; la 2ᵉ frappe est renoncée.
  const gatedHero = (hands: ('main' | 'off')[]): Partial<Combatant> => ({
    handGates: hands, activeLoadoutId: 'lo',
    loadouts: [{ id: 'lo', main: 'm', off: 'o' }] as never,
    items: [{ uid: 'm', name: 'Épée', kind: 'melee', qualities: [] }, { uid: 'o', name: 'Dague', kind: 'melee', qualities: [] }] as never,
  });

  it('SEULE la 2nde main gatée → la 2ᵉ frappe interpose le Test (pas encore résolue)', () => {
    setupBattle(gatedHero(['off']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().dualStrikeAttack('f2');
    const s = banc.getState();
    expect(s.pendingHandGate?.hand).toBe('off');
    expect(s.pendingAttack).toBeNull();
    expect(s.pendingDualStrike).not.toBeNull(); // le sous-flux dual reste ouvert pour la reprise
  });

  it('RÉUSSITE → la 2ᵉ frappe se résout (dualSecond pré-résolu)', () => {
    setupBattle(gatedHero(['off']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().dualStrikeAttack('f2');
    const pg = banc.getState().pendingHandGate!;
    banc.setState({ pendingHandGate: { ...pg, roll: pg.target, success: true, sl: 0 } });
    banc.getState().handGateConfirm();
    const s = banc.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack?.dualSecond).toBe(true);
    expect(s.pendingAttack?.result).not.toBeNull();
  });

  it('ÉCHEC → l\'objet de la 2nde main glisse (pas la directrice) ; 2ᵉ frappe renoncée, sous-flux clos', () => {
    setupBattle(gatedHero(['off']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().dualStrikeAttack('f2');
    const pg = banc.getState().pendingHandGate!;
    banc.setState({ pendingHandGate: { ...pg, roll: 99, success: false, sl: -3 } });
    banc.getState().handGateConfirm();
    const s = banc.getState();
    expect(s.pendingHandGate).toBeNull();
    expect(s.pendingAttack).toBeNull();
    expect(s.pendingDualStrike).toBeNull();
    const hero = s.battle!.combatants.find((c) => c.id === 'h')!;
    expect(hero.loadouts![0].off).toBeUndefined(); // 2nde arme lâchée
    expect(hero.loadouts![0].main).toBe('m');       // main directrice CONSERVÉE
  });

  it('un SEUL Test par Action : main directrice AUSSI gatée → la 2nde n\'est PAS re-testée', () => {
    setupBattle(gatedHero(['main', 'off']));
    banc.setState({ pendingDualStrike: { attackerId: 'h', offWeaponUid: 'o', jet: 3 } as any });
    banc.getState().dualStrikeAttack('f2');
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
    banc.getState().battleEndTurn(); banc.abandonner(); // → f1 : flag de h conservé
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);
    banc.getState().battleEndTurn(); banc.abandonner(); // → f2 : conservé
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBe(-10);
    banc.getState().battleEndTurn(); // franchissement de Round → h (order[0]) : purgé
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h')!.dualStrikeDefensePenalty).toBeUndefined();
  });
});

describe('#998 — la 2ᵉ frappe opposée à un défenseur SURFACÉ passe par SA fenêtre (LDB 10 l.773)', () => {
  it('siège MJ : 2ᵉ frappe résolue en attaquant seul, la fenêtre s’interpose, la fermeture l’applique', () => {
    setupBattle();
    banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    // La 1ʳᵉ frappe revient de SA fenêtre (`pa.defended`, posé par `defenseConfirm`) : elle touche.
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true, defended: true } as any });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingDualStrike).not.toBeNull();
    banc.getState().dualStrikeAttack('f2');
    expect(banc.getState().pendingAttack?.result?.defenderDetail, 'aucun jet de défense roulé en silence').toBeUndefined();
    banc.getState().attackConfirm();
    const pd = banc.getState().pendingDefense;
    expect(pd?.defenderId, 'la fenêtre de f2 s’interpose').toBe('f2');
    expect(pd?.suite.mode === 'pilotee' && pd.suite.pa.dualSecond, 'la 2ᵉ frappe voyage sur la fenêtre').toBe(true);
    banc.getState().defenseRoll();
    banc.getState().defenseConfirm();
    expect(banc.getState().pendingDefense).toBeNull();
    expect(banc.getState().pendingDualStrike, 'la 2ᵉ frappe est appliquée').toBeNull();
  });

  it('défenseur non surfacé : la 2ᵉ frappe garde son jet de défense neuf', () => {
    const { h, f2 } = setupBattle();
    const res = resolveDualSecond(banc.getState, h, f2, h.weapons[1], reverseRoll(34));
    expect(res.defenderDetail).toBeDefined();
  });

  it('le jet tranché à l’ouverture survit à la fenêtre du défenseur surfacé', () => {
    setupBattle();
    banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes(), dualMode: true, defended: true } as any });
    banc.getState().attackConfirm();
    banc.setState({ pendingDualStrike: { ...banc.getState().pendingDualStrike!, jet: 56 } });
    banc.getState().dualStrikeAttack('f2');
    expect(banc.getState().pendingAttack?.result?.attackerDetail?.roll, 'la 2ᵉ frappe prend le jet tranché').toBe(56);
    banc.getState().attackConfirm();
    expect((banc.getState().pendingDefense as any)?.atk?.roll, 'le jet figé voyage sur la fenêtre').toBe(56);
    banc.getState().defenseRoll();
    expect(banc.getState().pendingDefense?.result?.attackerDetail?.roll, 'l’opposition garde le jet de l’attaquant').toBe(56);
  });

  it('DR net identique, défenseur surfacé ou non, à dés égaux', () => {
    const { h, f2 } = setupBattle();
    const inline = resolveDualSecond(banc.getState, h, f2, h.weapons[1], reverseRoll(34));
    const deDefense = (inline.defenderDetail as any).roll as number;
    banc.setState({ ...initialFields(), battle: null });
    setupBattle();
    banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } });
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'f1', location: 'corps', result: hitRes({ attackerRoll: 43, attackerDetail: { roll: 43, target: 50, success: true, sl: 0 } } as any), dualMode: true, defended: true } as any });
    banc.getState().attackConfirm();
    banc.setState({ pendingDualStrike: { ...banc.getState().pendingDualStrike!, jet: reverseRoll(34) } });
    banc.getState().dualStrikeAttack('f2');
    banc.getState().attackConfirm();
    banc.getState().defenseRoll();
    banc.getState().defenseSetForcedRoll(deDefense);
    expect(banc.getState().pendingDefense?.result?.netSL).toBe(inline.netSL);
  });
});
