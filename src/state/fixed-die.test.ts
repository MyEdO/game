import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { canFixDie, intentAllowedFor } from '../noyau/netOwnership';
import { desFixes, setDesFixes, resetDesFixes, FIXED_ROLL_MAX } from '../engine/fixedDie';
import { PREFERENCES } from '../noyau/preferences';
import { setPreference, resetPreference } from './preferences';
import { rowForcedDie } from '../ui/forcedDieRow';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * Option de confort « Dés fixés » (#939) : saisir soi-même la valeur du d100 d'un jet qu'on CONTRÔLE,
 * avant de le lancer comme après. Ce n'est PAS une règle de WFRP — c'est du confort, et le jet saisi est
 * évalué au NATUREL (réussite, DR, double → Critique), contrairement au dé CHOISI de la Résilience
 * (LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat », qui garantit la
 * réussite). Deux affordances distinctes, UN seul sélecteur — et un seul prédicat de contrôle,
 * `canFixDie`, qui compose `pilotedByHuman`/`controlsCombatant`/`seatOwns`.
 * Ici, l'affordance de l'écran (`ui/forcedDieRow`) et la préférence du web ; le verbe, la re-dérivation, la
 * possession et le journal se jouent au banc du noyau (`src/noyau/fixed-die.hors-store.test.ts`).
 */
const C = (over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'X', name: 'X', label: 'X', kind: 'heros',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  })) as unknown as Combatant;

/** Attaque RATÉE d'un héros (dé 88 vs cible 45), prête à être re-dérivée. */
function setupAttack(attackerOver: Partial<Combatant> = {}, targetOver: Partial<Combatant> = {}) {
  seedBattleRng(7);
  const attacker = C({ id: 'A', label: 'Att', resilience: 2, ...attackerOver });
  const target = C({ id: 'B', label: 'Cible', kind: 'ennemi', pos: { x: 1, y: 0 }, ...targetOver });
  useGame.setState({
    battle: { combatants: [attacker, target], log: [], order: [attacker.id, target.id], turn: 0, round: 1 } as never,
    pendingAttack: {
      attackerId: attacker.id, targetId: target.id, location: null,
      result: {
        hit: false, attackerRoll: 88, netSL: -4, critical: false, advantageTo: null,
        defenderDefeated: false, log: 'raté',
        attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
      } as never,
    },
  });
}

const attackRoll = () => useGame.getState().pendingAttack!.result!.attackerRoll;

beforeEach(() => {
  resetDesFixes();
  useGame.setState({
    pendingAttack: null, pendingDefense: null, pendingCast: null, battle: null,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
});
afterEach(() => resetDesFixes());

describe('registre — l’option est une PRÉFÉRENCE de confort (zéro ligne d’UI)', () => {
  it('l’entrée `des-fixes` existe, par défaut FAUSSE, et s’écrit par la couture unique', () => {
    const def = PREFERENCES.find((p) => p.id === 'des-fixes');
    expect(def).toBeDefined();
    expect(def!.kind).toBe('flag');
    expect(def!.default).toBe(false);
    expect(desFixes()).toBe(false);
    setPreference('des-fixes', true);
    expect(desFixes()).toBe(true);
    resetPreference('des-fixes');
    expect(desFixes()).toBe(false);
  });
});

describe('option OFF — aucun sélecteur « dé fixé » nulle part, aucun effet', () => {
  it('AUCUN flux à Résilience ne rend de sélecteur « dé fixé » — la couture les couvre tous', () => {
    setupAttack();
    const row = { actor: useGame.getState().battle!.combatants[0], rolled: true } as never;
    // La couture (`RollShell`) dérive pour TOUT flux : on l'interroge sur les six chemins historiques
    // ET sur des flux qui n'ont jamais eu de code picker — aucun ne doit offrir de dé fixé, option OFF.
    for (const k of ['attaque', 'defense', 'incantation', 'fuite', 'cascade', 'rechargement', 'soins', 'chirurgie', 'test'] as const) {
      const die = rowForcedDie(useGame.getState(), k, row, true);
      expect(die.forcedRoll?.fixed, k).toBeFalsy();
    }
    // Avant le jet non plus (c'est là que le dé fixé s'offrirait sans jet à re-dériver).
    const pre = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: false } as never, false);
    expect(pre.forcedRoll).toBeUndefined();
  });

  it('l’option gate l’AFFORDANCE de celui qui clique, pas le geste d’autrui (option CLIENT-SIDE)', () => {
    setupAttack();
    // Option OFF ⇒ aucun champ n'est rendu ici (test ci-dessus) : le joueur local ne PEUT pas cliquer.
    const die = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll?.fixed).toBeFalsy();
    // Le VERBE, lui, n'est pas gaté par l'option locale : c'est la seule façon qu'un geste d'invité
    // (dont l'option est ON chez LUI) aboutisse quand l'hôte l'applique — l'autorisation est portée
    // par le siège ÉMETTEUR (`intentAllowedFor`), pas par l'état local de celui qui exécute.
    useGame.getState().jetImposerLeResultat('attaque', 33);
    expect(attackRoll()).toBe(33);
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });
});

describe('option ON + héros piloté — le dé se saisit AVANT et APRÈS le jet', () => {
  beforeEach(() => setDesFixes(true));

  it('AVANT le jet : le sélecteur est offert sur tout le d100 et sa saisie LANCE puis substitue', () => {
    setupAttack();
    useGame.setState({ pendingAttack: { ...useGame.getState().pendingAttack!, result: null } as never });
    const calls: string[] = [];
    const die = rowForcedDie(useGame.getState(), 'attaque', {
      actor: useGame.getState().battle!.combatants[0], rolled: false, onRoll: () => calls.push('roll'),
    } as never, false);
    expect(die.forcedRoll).toBeDefined();
    expect(die.forcedRoll!.fixed).toBe(true);
    expect(die.forcedRoll!.target).toBe(FIXED_ROLL_MAX);
    die.forcedRoll!.onSet(33);
    expect(calls[0]).toBe('roll'); // on lance PUIS on substitue (geste pré-armé, `withPreRollFixedDie`)
  });
});

describe('contrôle — `canFixDie` décrit l’AFFORDANCE LOCALE (jamais le geste d’autrui)', () => {
  beforeEach(() => setDesFixes(true));

  it('héros piloté localement → oui ; héros d’un AUTRE siège (coop) → pas d’affordance ici', () => {
    setupAttack();
    expect(canFixDie(useGame.getState(), 'A')).toBe(true);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'invite', mySeat: 1, ownership: { A: 0 } } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
    const die = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll?.fixed).toBeFalsy(); // le siège voisin ne voit pas le champ sur MON héros
  });

  it('ennemi SANS siège MJ → aucune affordance (il est à l’IA)', () => {
    setupAttack({ id: 'A', kind: 'ennemi' }, { id: 'B', kind: 'heros' });
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
    const die = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll?.fixed).toBeFalsy();
  });

  it('ennemi AVEC le siège MJ mien → affordance, et le jet ennemi se fixe', () => {
    setupAttack({ id: 'A', kind: 'ennemi' }, { id: 'B', kind: 'heros' });
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: 0 } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(true);
    const die = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll!.fixed).toBe(true);
    die.forcedRoll!.onSet(33);
    expect(attackRoll()).toBe(33);
  });
});

describe('coop — le geste d’un INVITÉ sur SON héros ABOUTIT (jamais un rejet silencieux)', () => {
  it('l’invité voit le champ sur son héros, l’hôte accepte l’intent, et le dé s’applique', () => {
    setupAttack();
    setDesFixes(true);
    // Côté INVITÉ (siège 1, propriétaire de A) : l'affordance est offerte.
    useGame.setState({ net: { ...useGame.getState().net, mode: 'invite', mySeat: 1, ownership: { A: 1 } } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(true);
    const die = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll!.fixed).toBe(true);

    // Côté HÔTE (siège 0) : la validation de possession accepte le geste du siège ÉMETTEUR…
    useGame.setState({ net: { ...useGame.getState().net, mode: 'hote', mySeat: 0, ownership: { A: 1 } } as never });
    expect(intentAllowedFor(useGame.getState(), 1, 'jetImposerLeResultat', ['attaque', 33])).toBe(true);
    // …et l'exécution ABOUTIT, même si l'hôte ne « contrôle » pas ce héros et n'a pas l'option.
    resetDesFixes();
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
    useGame.getState().jetImposerLeResultat('attaque', 33);
    expect(attackRoll()).toBe(33);
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n'), 'combat ouvert : la ligne va au journal de combat (`journaliser`)').toContain('dé fixé');
  });
});

describe('Résilience — le choix du dé reste OFFERT sans l’option (deux affordances, un sélecteur)', () => {
  it('slot `forced` → sélecteur de Résilience (borné à la cible), option OFF', () => {
    setupAttack();
    useGame.getState().jetForcerLaReussite('attaque');
    const die = rowForcedDie(useGame.getState(), 'attaque', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(desFixes()).toBe(false);
    expect(die.forcedRoll).toBeDefined();
    expect(die.forcedRoll!.fixed).toBeFalsy(); // provenance Résilience : le dé doit rester une réussite
    expect(die.forcedRoll!.target).toBe(45);
  });
});

describe('provenance & re-dérivation — le dé courant fait foi (sonde `lens` promue)', () => {
  /** `handGate` : flux à LENTILLE, dé raté 88 vs cible 60. */
  function openHandGate() {
    useGame.setState({
      battle: { combatants: [C({ id: 'H', label: 'Héros', resilience: 3 })], log: [] } as never,
      pendingHandGate: { attackerId: 'H', ligne: { base: 60, mods: [], target: 60, difficulty: 'facile' }, target: 60, roll: 88, sl: -3, success: false } as never,
    });
  }

  it('dé FIXÉ raté PUIS Résilience : la Résilience RE-TIRE le dé → la mention « dé fixé » s’efface', () => {
    openHandGate();
    setDesFixes(true);
    useGame.getState().jetImposerLeResultat('mainEnsanglantee', 95);
    expect(useGame.getState().pendingHandGate!.fixed).toBe(true);
    expect(useGame.getState().pendingHandGate!.success).toBe(false); // évalué au naturel : 95 > 60
    useGame.getState().jetForcerLaReussite('mainEnsanglantee');
    const p = useGame.getState().pendingHandGate!;
    expect(p.forcee).toBe(true);
    expect(p.success).toBe(true);
    expect(p.fixed).toBeFalsy(); // le dé n'est plus celui du joueur : la provenance change AVEC le dé
    const die = rowForcedDie(useGame.getState(), 'mainEnsanglantee', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll!.fixed).toBeFalsy();
    expect(die.fixedMark).toBeFalsy();
  });
});

