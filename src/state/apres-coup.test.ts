/**
 * L'APRÈS-COUP D'UN COUP, EN UNE ÉCRITURE (#1508 T3b-4) — `applyAttackResult` = application + après-coup
 * (`APRES_COUP` : Maladresse de l'attaquant, Maladresse du défenseur, réaction, suite) ; une fenêtre
 * ouverte par l'application ou par un temps emporte le TEMPS où reprendre, et sa reprise rejoue le reste.
 *
 * Contrat : pour chaque CHARGE (ce que l'après-coup doit jouer) et chaque SUSPENSION (ce qui interrompt
 * le coup — sauvegarde `LDB 85 l.98`, Déviation `LDB 63 l.30`, casse d'arme `LDB 60 l.30`), la trace du
 * CAS, moins l'étape de suspension, est celle du TÉMOIN non suspendu : mêmes fenêtres, même ordre, même
 * état final. Les dés de suspension sont posés pour que le cas rejoigne l'état du témoin (sauvegarde et
 * sauvegarde Solide ratées, Critique subi).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { maybeOpenDefense, openAttackCascade, applyAttackResult, jouerLApresCoup } from './combatFlow';
import { battleRng, seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { resetCadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';

const g = useGame.getState;
const CH = { 'capacite-de-combat': 45, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const arme = (uid: string, label: string, qualities: { id: string; value?: number }[] = []): Weapon =>
  ({ uid, name: label, label, type: 'melee', damage: { plusBF: true, flat: 4 }, qualities }) as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...CH }, conditions: [], engagedWith: [], skills: [], talents: [], traits: [],
     weapons, items: [], advantage: 0, size: 'moyenne', pos, wounds: { current: 200, max: 200 }, criticalWounds: 0, traumas: [],
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, fate: 0 } as unknown as Combatant);

type Suspension = 'sauvegarde' | 'deviation' | 'casseAttaquant' | 'casseDefenseur';
type Charge = 'maladresseHeros' | 'maladresseEnnemiMJ' | 'balayage' | 'reaction' | 'repriseIA';

/** LE COUP, monté selon la charge et la suspension, puis ouvert par la porte réelle (`maybeOpenDefense`).
 *  `temoin` : le MÊME coup, sans ce qui le suspend (ni Trait de sauvegarde, ni PA à dévier, ni Solide). */
function monte(charge: Charge, susp: Suspension | null, temoin = false): void {
  seedBattleRng(11);
  const bacle = (uid: string, label: string) => arme(uid, label, temoin ? [{ id: 'bacle' }] : [{ id: 'bacle' }, { id: 'solide', value: 1 }]);
  const ennemiDefend = charge === 'maladresseEnnemiMJ';
  const griffe = susp === 'casseAttaquant' ? bacle('gr', 'Griffe') : arme('gr', 'Griffe');
  const e = mk('e', 'enemy', { x: 1, y: 0 }, [griffe, susp === 'casseDefenseur' ? bacle('dg', 'Dague') : arme('dg', 'Dague')]);
  const h = mk('h', 'hero', { x: 0, y: 0 }, [arme('sw', 'Épée')]);
  const combattants = [e, h];
  if (charge === 'balayage') {
    // Taille « grande » contre deux « moyenne » : la touche d'un plus grand balaie (LDB 85 l.362), et le
    // Piétinement s'y mêle (LDB 85 l.387) — le cas réel, jamais une Taille égale au `cleave` forcé.
    e.size = 'grande';
    e.characteristics['capacite-de-combat'] = 95;
    combattants.push(mk('h2', 'hero', { x: 1, y: 1 }, [arme('sw2', 'Épée')]));
  }
  const bouclier = arme('sh', 'Bouclier', [{ id: 'protectrice', value: 2 }]);
  if (charge === 'reaction') {
    h.weapons = [h.weapons[0], bouclier];
    h.talents = [{ talentId: 'porte-bouclier', times: 1 }] as never;
  }
  const [attaquant, defenseur] = ennemiDefend ? [h, e] : [e, h];
  if (susp === 'sauvegarde' && !temoin) defenseur.traits = [{ id: 'demoniaque', value: 9 }] as never;
  if (susp === 'deviation' && !temoin) defenseur.armour = { ...defenseur.armour, corps: 2 };
  const battle = {
    combatants: combattants, order: combattants.map((c) => c.id), baseOrder: combattants.map((c) => c.id),
    turn: combattants.indexOf(attaquant), round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    ...(charge === 'reaction' ? { advantagePools: { allies: 3, foes: 0 } } : {}),
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene, party: combattants.filter((c) => c.kind === 'hero'),
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [], pendingLogQueue: [], journal: [],
    net: { ...g().net, mode: 'local', mySeat: 0, gmSeat: ennemiDefend ? 0 : undefined, ownership: {} },
  } as never);
  const parade = charge === 'reaction' ? bouclier : ennemiDefend ? defenseur.weapons[1] : defenseur.weapons[0];
  const doubleRate = charge === 'maladresseHeros' || charge === 'maladresseEnnemiMJ' || susp === 'casseDefenseur';
  const res = {
    hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 5, woundsLost: 3,
    critical: susp === 'deviation', advantageTo: null, defenderDefeated: false, log: 'touche.',
    attackerDetail: susp === 'casseAttaquant' ? { roll: 33, success: false, sl: -2 } : { roll: 30, success: true, sl: 1 },
    defenderDetail: { roll: doubleRate ? 44 : 57, success: false, sl: -3, mode: 'parade' },
    parryWeapon: parade,
    ...(charge === 'balayage' ? { cleave: true } : {}), // `resolveMelee` le pose : `sizeGap(grande, moyenne) >= 1`
  } as unknown as AttackResult;
  const suite = ennemiDefend ? { enchainement: { mode: 'aucun' as const } } : undefined;
  expect(maybeOpenDefense(g, useGame.setState, attaquant, defenseur, attaquant.weapons[0], suite), 'la fenêtre du défenseur s’ouvre').toBe(true);
  g().defenseRoll();
  useGame.setState({ pendingDefense: {
    ...g().pendingDefense!, result: res, mode: 'parade', parryWeaponUid: parade.uid,
    ...(charge === 'reaction' ? { shieldReaction: 'push' as const } : {}),
  } });
}

/** Rejoue chaque fenêtre COMME UN JOUEUR et rend la trace STRUCTURELLE : les fenêtres de défense et de
 *  Maladresse, dans l'ordre, puis l'état final. Les étapes de suspension ne sont pas tracées. */
function jouer(): string[] {
  const trace: string[] = [];
  for (let k = 0; k < 40; k++) {
    const pd = g().pendingDefense;
    if (pd) {
      trace.push(`defense(${pd.weapon.label}→${pd.defenderId})`);
      if (!pd.result) { g().defenseRoll(); g().defenseSetForcedRoll(97); }
      g().defenseConfirm();
      continue;
    }
    const pc = g().pendingCascade;
    const st = pc?.participants[pc.cursor];
    if (!pc || !st) break;
    if (st.jet === 'fumble') {
      trace.push(`fumbleJet:${st.actorId}(${st.fumble!.weapon.label})`);
      if (!st.fumble!.result) g().fumbleRoll();
      g().fumbleConfirm();
      continue;
    }
    if (st.options && !st.chosen) g().cascadeChoose(st.id, 'subir');
    if (st.de && !st.de.result) g().cascadeDieSetForcedRoll(st.id, 1);
    if (st.table && !st.table.result) g().cascadeTableSetForcedRoll(st.id, 1);
    g().cascadeNext();
  }
  vi.runAllTimers();
  const b = g().battle!;
  const e = b.combatants.find((c) => c.id === 'e');
  trace.push(`turn=${b.turn}`, `cascade=${g().pendingCascade === null}`, `acted=${b.acted}`, `engagé(e)=${!!e?.engagedWith?.includes('h')}`);
  return trace;
}

/** Les PLAGES des tirages du RNG de combat pendant `f` (`1..100`, `1..10`…), dans l'ordre. */
function tiragesPendant(f: () => unknown): string[] {
  const rng = battleRng();
  const int0 = rng.int.bind(rng);
  const plages: string[] = [];
  rng.int = (min, max) => { plages.push(`${min}..${max}`); return int0(min, max); };
  try { f(); } finally { rng.int = int0; }
  return plages;
}

const CAS: [Charge, Suspension][] = [
  ...(['maladresseHeros', 'reaction', 'repriseIA'] as const).flatMap((c) =>
    (['sauvegarde', 'deviation', 'casseAttaquant'] as const).map((s): [Charge, Suspension] => [c, s])),
  ['balayage', 'sauvegarde'], ['balayage', 'casseAttaquant'],
  ['maladresseEnnemiMJ', 'sauvegarde'], ['maladresseEnnemiMJ', 'casseDefenseur'],
];

describe('après-coup — le cas suspendu rejoint le témoin (#1508 T3b-4)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); setRule('combat-aa-avantage-groupe', true); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); resetRule('combat-aa-avantage-groupe'); });

  it.each(CAS)('%s — suspendu par %s : même trace que le témoin', (charge, susp) => {
    monte(charge, susp, true);
    const temoin = jouer();
    monte(charge, susp);
    expect(jouer()).toEqual(temoin);
  });

  it('casse de l’attaquant sous balayage : le cas ne tire, en plus du témoin, QUE le d10 de Sauvegarde Solide (LDB 60 l.30)', () => {
    // Le d10 décale le flux du RNG : les tirages qui le suivent (maillon sur h2) diffèrent en VALEUR, d'où
    // un état final distinct du témoin — la trace, elle, est la même (matrice ci-dessus).
    monte('balayage', 'casseAttaquant', true);
    const temoin = tiragesPendant(jouer);
    monte('balayage', 'casseAttaquant');
    const cas = tiragesPendant(jouer);
    const k = cas.indexOf('1..10');
    expect(k, cas.join(' ')).toBeGreaterThanOrEqual(0);
    expect([...cas.slice(0, k), ...cas.slice(k + 1)], `cas : ${cas.join(' ')} | témoin : ${temoin.join(' ')}`).toEqual(temoin);
  });

  it('ordre choisi : la Maladresse du défenseur PRÉCÈDE le maillon de balayage (`APRES_COUP`)', () => {
    monte('balayage', null);
    const pd = g().pendingDefense!;
    useGame.setState({ pendingDefense: { ...pd, result: { ...pd.result!, defenderDetail: { roll: 44, success: false, sl: -3, mode: 'parade' } } as AttackResult } });
    expect(jouer().slice(0, 3)).toEqual(['defense(Griffe→h)', 'fumbleJet:h(Épée)', 'defense(Griffe→h2)']);
  });

  it('défenseur ENNEMI tenu par un siège MJ, parade ratée sur un double : UNE Maladresse, sur l’arme de PARADE', () => {
    monte('maladresseEnnemiMJ', null);
    const trace = jouer();
    expect(trace.filter((t) => t.startsWith('fumbleJet:')), trace.join(' | ')).toEqual(['fumbleJet:e(Dague)']);
    const log = g().battle!.log.map((l) => l.text);
    expect(log.filter((l) => l.startsWith('e — Maladresse !')), log.join(' | ')).toHaveLength(1);
  });

  it('réaction de Porte-Bouclier sur un coup suspendu : jouée APRÈS l’application, le repoussé reste désengagé', () => {
    monte('reaction', 'sauvegarde');
    g().defenseConfirm();
    expect(g().battle!.combatants.find((c) => c.id === 'e')!.pos, 'rien ne bouge devant le dé de sauvegarde').toEqual({ x: 1, y: 0 });
    const trace = jouer();
    expect(trace, trace.join(' | ')).toContain('engagé(e)=false');
  });

  it('balayage Taille sur deux héros, suspendu au 2ᵉ maillon : la reprise reste sur SA cible', () => {
    monte('balayage', null);
    const h2 = g().battle!.combatants.find((c) => c.id === 'h2')!;
    h2.traits = [{ id: 'demoniaque', value: 9 }] as never;
    const trace = jouer();
    expect(trace.filter((t) => t.startsWith('defense(')), trace.join(' | ')).toEqual(['defense(Griffe→h)', 'defense(Griffe→h2)']);
    expect(g().battle!.combatants.find((c) => c.id === 'h2')!.wounds.current, 'le maillon suspendu a porté sur h2').toBeLessThan(200);
    expect(g().pendingCascade).toBeNull();
  });
});

/** Deux combattants au contact, `h` (héros manuel) à son tour ; `e` (ennemi de la machine). */
function duel(): { h: Combatant; e: Combatant } {
  seedBattleRng(5);
  const h = mk('h', 'hero', { x: 0, y: 0 }, [arme('sw', 'Épée')]);
  const e = mk('e', 'enemy', { x: 1, y: 0 }, [arme('gr', 'Griffe')]);
  const battle = {
    combatants: [h, e], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: testScene, party: [h], pendingCascade: null, suspendedCascades: [], pendingLogQueue: [], journal: [],
    pendingAttack: null, pendingDefense: null, net: { ...g().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } } as never);
  return { h, e };
}

describe('Maladresse de l’ATTAQUANT : une écriture, au temps `oupsAttaquant` (LDB 14 l.19)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  it('héros qui rate sur un double : UNE Maladresse, AVANT la suite (Action de la manœuvre rendue ensuite)', () => {
    const { h, e } = duel();
    openAttackCascade(g, useGame.setState, { attackerId: h.id, targetId: e.id, location: null, result: null, weaponUid: 'sw', freeKind: 'morsure' }, 'Attaque', 'action/attack');
    g().attackRoll();
    useGame.setState({ pendingAttack: { ...g().pendingAttack!, result: {
      hit: true, attackerRoll: 33, netSL: 1, location: 'corps', damage: 5, woundsLost: 3, critical: false, advantageTo: null,
      defenderDefeated: false, log: 'touche.', attackerDetail: { roll: 33, success: false, sl: -2 },
    } as unknown as AttackResult } });
    g().attackConfirm();
    const maladresses = () => (g().pendingCascade?.participants ?? []).filter((st) => st.jet === 'fumble' && st.actorId === h.id);
    expect(maladresses(), 'une seule étape de Maladresse pour l’attaquant').toHaveLength(1);
    expect(g().battle!.acted, 'la suite attend la Maladresse').toBe(true);
    const pc = g().pendingCascade!;
    expect(pc.participants[pc.cursor].jet, 'le curseur est sur la Maladresse').toBe('fumble');
    g().fumbleRoll();
    g().fumbleConfirm();
    expect(g().battle!.acted, 'la suite (Action de la manœuvre gratuite rendue) joue après la Maladresse').toBe(false);
    const log = g().battle!.log.map((l) => l.text);
    expect(log.filter((l) => l.startsWith('h — Maladresse !')), log.join(' | ')).toHaveLength(1);
  });
});

describe('mise hors de combat automatique (`autoKill`, LDB 16 l.113) : l’après-coup joue', () => {
  it('la suite d’une frappe gratuite rend l’Action après la mort-auto', () => {
    const { h, e } = duel();
    (h as { fate?: number }).fate = 0;
    const res = { hit: true, autoKill: true, attackerRoll: 20, netSL: 2, location: 'corps', damage: 5, woundsLost: 3, critical: false,
      advantageTo: null, defenderDefeated: false, log: 'achève.' } as unknown as AttackResult;
    applyAttackResult(g, useGame.setState, e, h, e.weapons[0], res, { sousAttaque: true, suite: { freeAttack: { kind: 'morsure', prevActed: false }, enchainement: { mode: 'aucun' } } });
    expect(g().battle!.combatants.find((c) => c.id === 'h')!.wounds.current, 'la cible est mise hors de combat').toBe(0);
    expect(g().battle!.acted, 'frappe GRATUITE : la suite rend l’Action consommée par la mort-auto').toBe(false);
  });
});

describe('Piétinement suspendu : aucun balayage parasite, Action rendue (`enchainement: aucun`)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  for (const suspendu of [false, true]) {
    it(`héros en Auto-combat, plus grand, qui piétine (${suspendu ? 'sauvegarde à la porte' : 'direct'})`, () => {
      seedBattleRng(3);
      const h = mk('h', 'hero', { x: 1, y: 0 }, [arme('sw', 'Épée')]);
      h.size = 'enorme'; (h as { aiControlled?: boolean }).aiControlled = true; h.advantage = 2;
      const e1 = mk('e1', 'enemy', { x: 0, y: 0 }, [arme('gr', 'Griffe')]);
      const e2 = mk('e2', 'enemy', { x: 1, y: 1 }, [arme('gr2', 'Griffe')]);
      if (suspendu) e1.traits = [{ id: 'demoniaque', value: 9 }] as never;
      const battle = {
        combatants: [h, e1, e2], order: ['h', 'e1', 'e2'], baseOrder: ['h', 'e1', 'e2'], turn: 0, round: 1, action: null,
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
      } as unknown as BattleState;
      useGame.setState({ battle, mode: 'battle', scene: testScene, party: [h], pendingCascade: null, suspendedCascades: [], pendingLogQueue: [], journal: [],
        net: { ...g().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
        pendingTrample: { attackerId: 'h', targetId: 'e1', result: {
          hit: true, attackerRoll: 20, netSL: 3, location: 'corps', damage: 6, woundsLost: 4, critical: false, advantageTo: null,
          defenderDefeated: false, log: 'piétine.', cleave: true,
        } as unknown as AttackResult } } as never);
      g().trampleConfirm();
      jouer();
      const b = g().battle!;
      expect(b.combatants.find((c) => c.id === 'e1')!.wounds.current, 'le Piétinement a porté').toBeLessThan(200);
      expect(b.combatants.find((c) => c.id === 'e2')!.wounds.current, 'aucun balayage ne suit un Piétinement').toBe(200);
      expect(b.acted, 'action GRATUITE : l’Action retrouve sa valeur').toBe(false);
    });
  }
});

/**
 * L'ID D'UNE MALADRESSE (#1852) : il dérive du rang de la séquence, jamais du seul porteur — deux
 * Maladresses du MÊME porteur dans UNE séquence (deux coups parés sur un double) sont deux étapes.
 */
describe('deux Maladresses du même porteur dans une séquence', () => {
  it('défenseur ennemi tenu par un siège MJ : deux étapes distinctes, chacune résolue sur SA fenêtre', () => {
    seedBattleRng(11);
    const e = mk('e', 'enemy', { x: 1, y: 0 }, [arme('dg', 'Dague')]);
    const h = mk('h', 'hero', { x: 0, y: 0 }, [arme('sw', 'Épée')]);
    const battle = {
      combatants: [h, e], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    useGame.setState({ battle, mode: 'battle', scene: testScene, party: [h], pendingDefense: null, pendingAttack: null, pendingCascade: null,
      suspendedCascades: [], pendingLogQueue: [], journal: [], net: { ...g().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} } } as never);
    const res = {
      hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 0, woundsLost: 0, critical: false, advantageTo: null, defenderDefeated: false, log: 't',
      attackerDetail: { roll: 30, success: true, sl: 1 }, defenderDetail: { roll: 44, success: false, sl: -3, mode: 'parade' }, parryWeapon: e.weapons[0],
    } as unknown as AttackResult;
    const coup = { attackerId: 'h', targetId: 'e', weapon: h.weapons[0], res, depuis: 'oupsDefenseur' as const, suite: { enchainement: { mode: 'aucun' as const } } };
    jouerLApresCoup(g, useGame.setState, coup);
    jouerLApresCoup(g, useGame.setState, coup);
    const maladresses = () => g().pendingCascade!.participants.filter((s) => s.jet === 'fumble');
    expect(maladresses().map((s) => s.actorId)).toEqual(['e', 'e']);
    expect(new Set(maladresses().map((s) => s.id)).size, maladresses().map((s) => s.id).join(',')).toBe(2);
    for (const attendu of maladresses().map((s) => s.id)) {
      const pc = g().pendingCascade!;
      expect(pc.participants[pc.cursor].id, 'la fenêtre courante est CETTE Maladresse').toBe(attendu);
      g().fumbleRoll();
      g().fumbleConfirm();
      expect(g().pendingCascade?.participants.find((s) => s.id === attendu)?.committed ?? true, `${attendu} résolue`).toBe(true);
    }
    expect(g().battle!.log.filter((l) => l.text.startsWith('e — Maladresse !'))).toHaveLength(2);
  });
});
