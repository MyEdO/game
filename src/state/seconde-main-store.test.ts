/**
 * LA VALEUR DE LA 2ᵉ FRAPPE DU MANIEMENT DE DEUX ARMES, jouée par le store (`attackConfirm` → `jouerLaSuiteDuCoup`).
 * LDB 10 l.773 ; LDB 18 l.53 ; LDB 13 l.183 ; #1595 c.6229354257, c.6229550544.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { seedBattleRng } from './battleRng';
import { avanceEtapeCascade } from './cascadeTestKit';
import { emptyScene } from './scene';
import { initialFields } from './stateFields';
import { setRule, resetRule } from '../engine/policy';
import { rederivePassiveAttack, resolveMelee, type AttackResult } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import { recomputeLoadout } from '../engine/items';
import type { CascadeStep } from './pendings';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ARM = (pa: number) => ({ tete: pa, brasG: pa, brasD: pa, corps: pa, jambeG: pa, jambeD: pa });

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, important: true, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne', armour: ARM(0),
    ...over,
  } as unknown as Combatant);

const epee = { uid: 'm', label: 'Épée', type: 'melee', hand: 'main', hands: 1, damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
const rapiere = { ...epee, label: 'Rapière', qualities: [{ id: 'empaleuse' }] } as unknown as Weapon;
const dague = { uid: 'o', label: 'Dague', type: 'melee', hand: 'off', hands: 1, damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
const piece = (qualites: string[], pa: number): ItemInstance =>
  ({ uid: 'p1', label: 'Pièce', kind: 'armor', equipped: true, pa, locs: ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'], qualities: qualites.map((id) => ({ id })) }) as unknown as ItemInstance;

const GRAINE = 11;

interface Frappe {
  /** Le jet de la main directrice. */
  roll: number;
  cible?: Partial<Combatant>;
  pieces?: ItemInstance[];
  arme?: Weapon;
  retenu?: boolean;
  /** Un humain tient la cible (siège MJ) : sa fenêtre de Déviation s'ouvre. */
  tenu?: boolean;
  /** La touche, résolue par le moteur à la place de `rederivePassiveAttack`. */
  resoudre?: (heros: Combatant, cible: Combatant, arme: Weapon) => AttackResult;
}

/** La 1ʳᵉ frappe d'un Maniement de deux armes, confirmée par `attackConfirm`. */
function premiereFrappe({ roll, cible: over = {}, pieces = [], arme = epee, retenu = false, tenu = false, resoudre }: Frappe) {
  const heros = mk('hero', 'bretteur', { weapons: [arme, dague] } as never);
  const cible = mk('enemy', 'cible', { pos: { x: 1, y: 0 }, ...over } as never);
  const voisin = mk('enemy', 'voisin', { pos: { x: 0, y: 1 } } as never); // LDB 10 l.773
  if (pieces.length) { cible.items = structuredClone(pieces); recomputeLoadout(cible); }
  const battle = {
    combatants: [heros, cible, voisin], order: ['bretteur', 'cible', 'voisin'], baseOrder: ['bretteur', 'cible', 'voisin'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: emptyScene(), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [],
    net: { ...useGame.getState().net, mode: tenu ? 'host' : 'local', mySeat: 0, gmSeat: tenu ? 1 : undefined },
  });
  const result = resoudre
    ? resoudre(heros, cible, arme)
    : rederivePassiveAttack(heros, cible, arme, { roll, target: 90, success: true, sl: 3, isDouble: roll % 11 === 0 } as never, 'melee', 'corps', retenu);
  seedBattleRng(GRAINE);
  useGame.setState({ pendingAttack: { attackerId: heros.id, targetId: cible.id, location: 'corps', dualMode: true, result } as never });
  useGame.getState().attackConfirm();
  return result;
}

const etapeCourante = (): CascadeStep | undefined => {
  const p = useGame.getState().pendingCascade;
  return p?.participants[p.cursor];
};
const jet = () => useGame.getState().pendingDualStrike?.jet;
const vivant = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
const critiques = () => (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'critical');

/** Les d100 tirés à l'ouverture de la Seconde main sous `GRAINE`, figés : le chemin de la mort-auto consomme un tirage de moins. */
const D100_AU_BESOIN = 53;
const D100_AU_BESOIN_MORT_AUTO = 52;

beforeEach(() => useGame.setState({ ...initialFields(), battle: null, scene: null, gameTime: 0, party: [] }));

describe('la 2ᵉ frappe après un Coup Critique prend un d100 du tableau, jamais le jet inversé (LDB 10 l.773 ; LDB 18 l.53)', () => {
  it('automate qui dévie (PA 2), double 33 : aucune table lancée, le d100 est tiré à l’ouverture', () => {
    const res = premiereFrappe({ roll: 33, cible: { armour: ARM(2) } });
    expect(res.critical).toBe(true);
    expect(vivant('cible').armour.corps, 'l’automate a dévié').toBe(1);
    expect(vivant('cible').criticalWounds ?? 0).toBe(0);
    expect(jet()).toBe(D100_AU_BESOIN);
    expect(jet(), 'le double inversé est le double lui-même').not.toBe(33);
  });

  it('fenêtre humaine, d100 56, « Dévier » : la 2ᵉ frappe vaut 56', () => {
    premiereFrappe({ roll: 33, cible: { armour: ARM(2), conditions: [{ id: 'surpris' }] } as never, tenu: true });
    for (let i = 0; i < 20 && !useGame.getState().pendingDualStrike; i++) avanceEtapeCascade(useGame.getState, () => 56, () => 'devier');
    expect(vivant('cible').armour.corps, 'la Blessure est déviée').toBe(1);
    expect(vivant('cible').criticalWounds ?? 0).toBe(0);
    expect(jet()).toBe(56);
  });

  it('Impénétrable, double impair 33 : la Blessure est ignorée, le d100 est tiré à l’ouverture (LDB 63 l.78)', () => {
    const res = premiereFrappe({ roll: 33, pieces: [piece(['impenetrable'], 1)] });
    expect(res.critical).toBe(true);
    expect(vivant('cible').criticalWounds ?? 0).toBe(0);
    expect(jet()).toBe(D100_AU_BESOIN);
  });

  it('coup retenu, 33 : le double ne fait pas de Coup Critique, la 2ᵉ frappe vaut le jet inversé (LDB 18 l.30)', () => {
    const res = premiereFrappe({ roll: 33, retenu: true });
    expect(res.critical).toBe(false);
    expect(jet()).toBe(33);
  });

  it('sauvegarde démoniaque réussie sur un double : le coup est ignoré, le Critique obtenu reste, d100 tiré (LDB 85 l.98)', () => {
    premiereFrappe({ roll: 33, cible: { traits: [{ id: 'demoniaque', value: 8 }] } as never });
    const st = etapeCourante();
    expect(st?.kind).toBe('sauvegarde');
    useGame.getState().cascadeDieSetForcedRoll(st!.id, 8);
    useGame.getState().cascadeNext();
    expect(vivant('cible').wounds.current, 'le coup est ignoré').toBe(30);
    expect(jet()).toBe(D100_AU_BESOIN);
  });

  describe('mort-auto (LDB 16 l.113)', () => {
    beforeEach(() => setRule('combat-helpless-mode', 'mort-auto'));
    afterEach(() => resetRule('combat-helpless-mode'));

    it('cible Inconsciente achevée : aucune table, le d100 est tiré à l’ouverture', () => {
      const res = premiereFrappe({
        roll: 0, cible: { conditions: [{ id: 'inconscient', value: 1 }] } as never,
        resoudre: (h, c, a) => resolveMelee(h, c, a, makeRNG(3), { defense: 'none' }),
      });
      expect(res.autoKill).toBe(true);
      expect(res.critical).toBe(true);
      expect(vivant('cible').dead).toBe(true);
      expect(jet()).toBe(D100_AU_BESOIN_MORT_AUTO);
    });
  });

  it('Empaleuse sur 30 : Coup Critique sans double, la 2ᵉ frappe vaut le d100 de la table (LDB 62 l.248)', () => {
    const res = premiereFrappe({ roll: 30, arme: rapiere });
    expect(res.critical).toBe(true);
    for (let i = 0; i < 20 && !useGame.getState().pendingDualStrike; i++) avanceEtapeCascade(useGame.getState);
    const crits = critiques();
    expect(crits.map((s) => s.reveal?.origine)).toEqual(['coup-critique']);
    expect(jet()).toBe(crits[0].reveal!.dice);
    expect(jet()).not.toBe(3);
  });
});
