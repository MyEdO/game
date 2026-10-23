import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { FLOWS } from '../noyau/rollFlowSpecs';
import { canFixDie, intentAllowedFor } from '../noyau/netOwnership';
import { desFixes, setDesFixes, resetDesFixes, FIXED_ROLL_MAX, clampFixedRoll } from '../engine/fixedDie';
import { PREFERENCES, setPreference, resetPreference } from './preferences';
import { rowForcedDie } from '../ui/forcedDieRow';
import { bestForcedRoll, evaluateTest } from '../engine/tests';
import { startCascade } from '../noyau/cascade';
import { spyApplier } from './cascade.testkit';
import { freeCons } from '../noyau/rollSeam';
import type { CascadeStep } from '../noyau/pendings';
import type { Combatant } from '../engine/types';
import { avecLesTables, cleDeFixture } from '../noyau/noyau.testkit';
import { tablesDuJeu } from '../noyau/tablesDuJeu';

/**
 * Option de confort « Dés fixés » (#939) : saisir soi-même la valeur du d100 d'un jet qu'on CONTRÔLE,
 * avant de le lancer comme après. Ce n'est PAS une règle de WFRP — c'est du confort, et le jet saisi est
 * évalué au NATUREL (réussite, DR, double → Critique), contrairement au dé CHOISI de la Résilience
 * (LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat », qui garantit la
 * réussite). Deux affordances distinctes, UN seul sélecteur — et un seul prédicat de contrôle,
 * `canFixDie`, qui compose `pilotedByHuman`/`controlsCombatant`/`seatOwns`.
 */
const C = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

/** Attaque RATÉE d'un héros (dé 88 vs cible 45), prête à être re-dérivée. */
function setupAttack(attackerOver: Partial<Combatant> = {}, targetOver: Partial<Combatant> = {}) {
  seedBattleRng(7);
  const attacker = C({ id: 'A', label: 'Att', resilience: 2, ...attackerOver });
  const target = C({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 }, ...targetOver });
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

  it('la saisie est bornée aux faces du d100', () => {
    expect(clampFixedRoll(0)).toBe(1);
    expect(clampFixedRoll(999)).toBe(FIXED_ROLL_MAX);
    expect(clampFixedRoll(33.7)).toBe(33);
  });
});

describe('option OFF — aucun sélecteur « dé fixé » nulle part, aucun effet', () => {
  it('AUCUN flux à Résilience ne rend de sélecteur « dé fixé » — la couture les couvre tous', () => {
    setupAttack();
    const row = { actor: useGame.getState().battle!.combatants[0], rolled: true } as never;
    // La couture (`RollShell`) dérive pour TOUT flux : on l'interroge sur les six chemins historiques
    // ET sur des flux qui n'ont jamais eu de code picker — aucun ne doit offrir de dé fixé, option OFF.
    for (const k of ['attack', 'defense', 'cast', 'flee', 'cascade', 'reload', 'heal', 'surgery', 'test'] as const) {
      const die = rowForcedDie(useGame.getState(), k, row, true);
      expect(die.forcedRoll?.fixed, k).toBeFalsy();
    }
    // Avant le jet non plus (c'est là que le dé fixé s'offrirait sans jet à re-dériver).
    const pre = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: false } as never, false);
    expect(pre.forcedRoll).toBeUndefined();
  });

  it('l’option gate l’AFFORDANCE de celui qui clique, pas le geste d’autrui (option CLIENT-SIDE)', () => {
    setupAttack();
    // Option OFF ⇒ aucun champ n'est rendu ici (test ci-dessus) : le joueur local ne PEUT pas cliquer.
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll?.fixed).toBeFalsy();
    // Le VERBE, lui, n'est pas gaté par l'option locale : c'est la seule façon qu'un geste d'invité
    // (dont l'option est ON chez LUI) aboutisse quand l'hôte l'applique — l'autorisation est portée
    // par le siège ÉMETTEUR (`intentAllowedFor`), pas par l'état local de celui qui exécute.
    useGame.getState().attackSetForcedRoll(33);
    expect(attackRoll()).toBe(33);
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });
});

describe('option ON + héros piloté — le dé se saisit AVANT et APRÈS le jet', () => {
  beforeEach(() => setDesFixes(true));

  it('APRÈS le jet : le dé saisi remplace le jet et l’issue se re-dérive AU NATUREL (33 = double → Critique)', () => {
    setupAttack();
    useGame.getState().attackSetForcedRoll(33);
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.attackerRoll).toBe(33);
    expect(res.hit).toBe(true);
    expect(res.critical).toBe(true); // 33 = double réussi → Coup Critique, comme un vrai dé
    expect(res.attackerDetail!.sl).toBe(1); // dizaine(45) − dizaine(33)
    expect(useGame.getState().pendingAttack!.fixed).toBe(true);
  });

  it('un dé fixé peut ÉCHOUER (≠ Résilience, qui garantit la réussite)', () => {
    setupAttack();
    useGame.getState().attackSetForcedRoll(99);
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.attackerRoll).toBe(99);
    expect(res.hit).toBe(false);
    expect(res.attackerDetail!.success).toBe(false);
  });

  it('ne dépense NI Résilience NI Chance', () => {
    setupAttack();
    const before = useGame.getState().battle!.combatants.find((c) => c.id === 'A')!;
    const resil = before.resilience;
    useGame.getState().attackSetForcedRoll(33);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'A')!.resilience).toBe(resil);
  });

  it('AVANT le jet : le sélecteur est offert sur tout le d100 et sa saisie LANCE puis substitue', () => {
    setupAttack();
    useGame.setState({ pendingAttack: { ...useGame.getState().pendingAttack!, result: null } as never });
    const calls: string[] = [];
    const die = rowForcedDie(useGame.getState(), 'attack', {
      actor: useGame.getState().battle!.combatants[0], rolled: false, onRoll: () => calls.push('roll'),
    } as never, false);
    expect(die.forcedRoll).toBeDefined();
    expect(die.forcedRoll!.fixed).toBe(true);
    expect(die.forcedRoll!.target).toBe(FIXED_ROLL_MAX);
    die.forcedRoll!.onSet(33);
    expect(calls[0]).toBe('roll'); // on lance PUIS on substitue (geste pré-armé, `withPreRollFixedDie`)
  });

  it('le journal porte la mention « dé fixé »', () => {
    setupAttack();
    useGame.getState().attackSetForcedRoll(33);
    const log = useGame.getState().journal.join('\n');
    expect(log).toContain('dé fixé');
    // La valeur JOURNALISÉE est celle RÉELLEMENT appliquée au jet, relue sur le slot après commit.
    expect(log).toContain(String(attackRoll()));
    expect(log).toContain('33');
  });
});

describe('contrôle — `canFixDie` décrit l’AFFORDANCE LOCALE (jamais le geste d’autrui)', () => {
  beforeEach(() => setDesFixes(true));

  it('héros piloté localement → oui ; héros d’un AUTRE siège (coop) → pas d’affordance ici', () => {
    setupAttack();
    expect(canFixDie(useGame.getState(), 'A')).toBe(true);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1, ownership: { A: 0 } } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll?.fixed).toBeFalsy(); // le siège voisin ne voit pas le champ sur MON héros
  });

  it('ennemi SANS siège MJ → aucune affordance (il est à l’IA)', () => {
    setupAttack({ id: 'A', kind: 'enemy' }, { id: 'B', kind: 'hero' });
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll?.fixed).toBeFalsy();
  });

  it('ennemi AVEC le siège MJ mien → affordance, et le jet ennemi se fixe', () => {
    setupAttack({ id: 'A', kind: 'enemy' }, { id: 'B', kind: 'hero' });
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: 0 } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(true);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll!.fixed).toBe(true);
    die.forcedRoll!.onSet(33);
    expect(attackRoll()).toBe(33);
  });

  it('siège MJ d’un AUTRE joueur → l’ennemi ne s’affiche pas comme fixable ici', () => {
    setupAttack({ id: 'A', kind: 'enemy' }, { id: 'B', kind: 'hero' });
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1, gmSeat: 0 } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
  });

  it('étape MONDE (sans acteur) → siège MJ s’il existe, hôte sinon', () => {
    setupAttack();
    expect(canFixDie(useGame.getState(), undefined)).toBe(true); // solo/hôte = siège 0
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1 } as never });
    expect(canFixDie(useGame.getState(), undefined)).toBe(false);
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: 1 } as never });
    expect(canFixDie(useGame.getState(), undefined)).toBe(true);
  });

  it('un `ownerId` inconnu ne donne JAMAIS l’affordance', () => {
    setupAttack();
    expect(canFixDie(useGame.getState(), 'inconnu')).toBe(false);
  });
});

describe('coop — le geste d’un INVITÉ sur SON héros ABOUTIT (jamais un rejet silencieux)', () => {
  it('l’invité voit le champ sur son héros, l’hôte accepte l’intent, et le dé s’applique', () => {
    setupAttack();
    setDesFixes(true);
    // Côté INVITÉ (siège 1, propriétaire de A) : l'affordance est offerte.
    useGame.setState({ net: { ...useGame.getState().net, mode: 'guest', mySeat: 1, ownership: { A: 1 } } as never });
    expect(canFixDie(useGame.getState(), 'A')).toBe(true);
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll!.fixed).toBe(true);

    // Côté HÔTE (siège 0) : la validation de possession accepte le geste du siège ÉMETTEUR…
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { A: 1 } } as never });
    expect(intentAllowedFor(useGame.getState(), 1, 'attackSetForcedRoll', [33])).toBe(true);
    // …et l'exécution ABOUTIT, même si l'hôte ne « contrôle » pas ce héros et n'a pas l'option.
    resetDesFixes();
    expect(canFixDie(useGame.getState(), 'A')).toBe(false);
    useGame.getState().attackSetForcedRoll(33);
    expect(attackRoll()).toBe(33);
    expect(useGame.getState().journal.join('\n')).toContain('dé fixé');
  });
});

describe('Résilience — le choix du dé reste OFFERT sans l’option (deux affordances, un sélecteur)', () => {
  it('slot `forced` → sélecteur de Résilience (borné à la cible), option OFF', () => {
    setupAttack();
    useGame.getState().attackForceSuccess();
    const die = rowForcedDie(useGame.getState(), 'attack', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(desFixes()).toBe(false);
    expect(die.forcedRoll).toBeDefined();
    expect(die.forcedRoll!.fixed).toBeFalsy(); // provenance Résilience : le dé doit rester une réussite
    expect(die.forcedRoll!.target).toBe(45);
  });

  it('le choix du dé n’est plus le privilège des flux à `caps.picker` : un flux à LENTILLE l’expose aussi', () => {
    // `reload`/`recover`/`appraise`/`heal` ne déclarent AUCUN `caps.picker` — la fabrique le dérive de
    // leur lentille (`dieTarget` + `actorTR`), suggestion `bestForcedRoll` avant le jet.
    for (const key of ['reload', 'handGate', 'appraise', 'heal', 'steamSave', 'surgery', 'dispel', 'shanty'] as const) {
      expect(typeof FLOWS[key].picker, key).toBe('function');
    }
  });
});

describe('provenance & re-dérivation — le dé courant fait foi (sonde `lens` promue)', () => {
  /** `handGate` : flux à LENTILLE, dé raté 88 vs cible 60. */
  function openHandGate() {
    useGame.setState({
      battle: { combatants: [C({ id: 'H', label: 'Héros', resilience: 3 })], log: [] } as never,
      pendingHandGate: { attackerId: 'H', skillValue: 60, difficulty: 'facile', target: 60, roll: 88, sl: -3, success: false } as never,
    });
  }

  it('Résilience puis DEUX changements de dé successifs : chacun re-dérive (la cible reste lisible)', () => {
    openHandGate();
    useGame.getState().handGateForceSuccess();
    expect(useGame.getState().pendingHandGate!.roll).toBe(bestForcedRoll(60));
    useGame.getState().handGateSetForcedRoll(11);
    expect(useGame.getState().pendingHandGate!.roll).toBe(11);
    useGame.getState().handGateSetForcedRoll(55);
    const p = useGame.getState().pendingHandGate!;
    expect(p.roll).toBe(55);
    expect(p.sl).toBe(Math.max(evaluateTest(55, 60).sl, 1));
    expect(p.success).toBe(true);
  });

  it('pending FERMÉ (post-Appliquer) : le verbe est inerte, aucun crash', () => {
    openHandGate();
    setDesFixes(true);
    useGame.setState({ pendingHandGate: null });
    expect(() => useGame.getState().handGateSetForcedRoll(11)).not.toThrow();
    expect(useGame.getState().pendingHandGate).toBeNull();
  });

  it('dé FIXÉ raté PUIS Résilience : la Résilience RE-TIRE le dé → la mention « dé fixé » s’efface', () => {
    openHandGate();
    setDesFixes(true);
    useGame.getState().handGateSetForcedRoll(95);
    expect(useGame.getState().pendingHandGate!.fixed).toBe(true);
    expect(useGame.getState().pendingHandGate!.success).toBe(false); // évalué au naturel : 95 > 60
    useGame.getState().handGateForceSuccess();
    const p = useGame.getState().pendingHandGate!;
    expect(p.forced).toBe(true);
    expect(p.success).toBe(true);
    expect(p.fixed).toBeFalsy(); // le dé n'est plus celui du joueur : la provenance change AVEC le dé
    const die = rowForcedDie(useGame.getState(), 'handGate', { actor: useGame.getState().battle!.combatants[0], rolled: true } as never, true);
    expect(die.forcedRoll!.fixed).toBeFalsy();
    expect(die.fixedMark).toBeFalsy();
  });

  it('un dé FIXÉ ne consomme ni ne marque la Résilience', () => {
    openHandGate();
    setDesFixes(true);
    useGame.getState().handGateSetForcedRoll(41);
    expect(useGame.getState().pendingHandGate!.forced).toBeFalsy();
    expect(useGame.getState().battle!.combatants[0].resilience).toBe(3);
  });

  it('journal : mention NOMINATIVE de la valeur appliquée', () => {
    openHandGate();
    setDesFixes(true);
    useGame.getState().handGateSetForcedRoll(41);
    expect(useGame.getState().journal.join('\n')).toMatch(/Héros : dé fixé à 41/);
  });
});

describe('Test OPPOSÉ — plancher de Résilience vs évaluation naturelle du dé fixé', () => {
  /** Attaque ratée (88/45) contre un défenseur à DR 5. */
  function setupOpposed() {
    seedBattleRng(7);
    useGame.setState({
      battle: { combatants: [C({ id: 'A', label: 'Att', resilience: 2 }), C({ id: 'B', label: 'Def', kind: 'enemy', pos: { x: 1, y: 0 } })], log: [] } as never,
      pendingAttack: {
        attackerId: 'A', targetId: 'B', location: null,
        result: {
          hit: false, attackerRoll: 88, netSL: -9, critical: false, advantageTo: 'defender', defenderDefeated: false, log: 'raté',
          attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 88, success: false, sl: -4 },
          defenderDetail: { label: 'Esquive', base: 55, modifier: 0, target: 55, roll: 5, success: true, sl: 5 },
        } as never,
      },
    });
  }

  it('Résilience : « vous l’emportez avec au moins DR +1 » (LDB 17 l.68) — DR 6 contre un DR 5', () => {
    setupOpposed();
    useGame.getState().attackForceSuccess();
    const r = useGame.getState().pendingAttack!.result!;
    expect(r.attackerDetail!.sl).toBe(6);
    expect(r.hit).toBe(true);
  });

  it('dé CHOISI ensuite (11) : le plancher opposé TIENT et le double donne son Critique', () => {
    setupOpposed();
    useGame.getState().attackForceSuccess();
    useGame.getState().attackSetForcedRoll(11);
    const r = useGame.getState().pendingAttack!.result!;
    expect(r.attackerRoll).toBe(11);
    expect(r.attackerDetail!.sl).toBe(6);
    expect(r.critical).toBe(true);
  });

  it('dé FIXÉ 11 (option, sans Résilience) : AUCUN plancher — le DR est celui du dé', () => {
    setupOpposed();
    setDesFixes(true);
    useGame.getState().attackSetForcedRoll(11);
    const r = useGame.getState().pendingAttack!.result!;
    expect(r.attackerRoll).toBe(11);
    expect(r.attackerDetail!.sl).toBe(evaluateTest(11, 45).sl);
    expect(useGame.getState().pendingAttack!.forced).toBeFalsy();
  });
});

describe('coop — un siège TIERS ne fixe le dé de personne (sonde S4 promue)', () => {
  it('la validation de possession accepte le PROPRIÉTAIRE et refuse le tiers', () => {
    setupAttack();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, roomCode: 'R', ownership: { A: 1 } } as never });
    expect(intentAllowedFor(useGame.getState(), 1, 'attackSetForcedRoll', [33])).toBe(true);
    expect(intentAllowedFor(useGame.getState(), 2, 'attackSetForcedRoll', [33])).toBe(false);
  });
});

describe('journal — la mention « dé fixé » suit le jet jusqu’à sa ligne persistée', () => {
  /** Attaque fixée puis APPLIQUÉE : la ligne du moteur (« touche … CRITIQUE ! ») doit porter la mention. */
  it('la ligne d’issue produite par l’Appliquer porte la mention', () => {
    setupAttack();
    setDesFixes(true);
    useGame.getState().attackSetForcedRoll(33); // double ≤ cible → touche + Critique
    useGame.setState({ journal: [] });
    // Le pending est ENCORE ouvert pendant que l'applicateur compose : c'est la fenêtre du marquage.
    useGame.getState().log('Att touche Cible à la tête · CRITIQUE !');
    expect(useGame.getState().journal.join('\n')).toContain('(dé fixé)');
  });

  it('un jet NATUREL ne marque rien', () => {
    setupAttack(); // aucun dé saisi
    useGame.setState({ journal: [] });
    useGame.getState().log('Att touche Cible à la tête · CRITIQUE !');
    expect(useGame.getState().journal.join('\n')).not.toContain('dé fixé');
  });

  it('aucun doublon : la ligne de fixation n’est pas re-marquée', () => {
    setupAttack();
    setDesFixes(true);
    useGame.setState({ journal: [] });
    useGame.getState().attackSetForcedRoll(33);
    const ligne = useGame.getState().journal.find((l) => l.includes('dé fixé'))!;
    expect(ligne).toBe('Att : dé fixé à 33.');
  });

  it('pending REFERMÉ (hors modale) : plus aucune ligne n’est marquée', () => {
    setupAttack();
    setDesFixes(true);
    useGame.getState().attackSetForcedRoll(33);
    useGame.setState({ pendingAttack: null, journal: [] });
    useGame.getState().log('Le Gobelin se relève.');
    expect(useGame.getState().journal.join('\n')).not.toContain('dé fixé');
  });
});

/**
 * GRANULARITÉ de la marque (#973) : la mention appartient à l'ÉTAPE qui émet, pas au slot entier. Une
 * séquence porte N étapes ; marquer tout le slot faisait porter « (dé fixé) » aux lignes d'une étape
 * tirée au NATUREL — mensonge d'autant plus visible depuis que les tirages sur table (#942 L4-L7)
 * gardent une séquence ouverte pendant tout un dénouement.
 */
describe('journal — la marque appartient à l’ÉTAPE qui émet, pas au slot (#973)', () => {
  const TBL = 'test-table-marque';
  const applied: string[] = [];

  const etape = (id: string): CascadeStep =>
    ({ id, kind: cleDeFixture('markSpy'), label: fixtureText('Tirage'), icon: 'nav/dice', table: { tableId: TBL }});

  beforeEach(() => {
    applied.length = 0;
    setDesFixes(true);
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    avecLesTables({ tablesTirables: { ...tablesDuJeu().tablesTirables, [TBL]: {
      label: 'Table de la marque',
      die: 100,
      rows: [{ min: 1, max: 50, id: 'basse', label: 'Ligne basse' }, { min: 51, max: 100, id: 'haute', label: 'Ligne haute' }],
      lines: (die) => [`ligne (dé ${die})`],
    } }, appliers: { ...tablesDuJeu().appliers, markSpy: spyApplier(applied, (s) => `conséquence de ${s.id} (dé ${s.table!.result!.roll})`, (s) => ({ consequences: freeCons([`conséquence de ${s.id} (dé ${s.table!.result!.roll})`]) })) } });
  });

  it('E1 dé POSÉ + E2 dé NATUREL : seule la ligne d’E1 porte la mention', () => {
    useGame.getState().seedRng(4);
    startCascade(useGame.getState, useGame.setState, { title: 'Séquence', purpose: 'test', steps: [etape('e1'), etape('e2')] });
    useGame.getState().cascadeTableSetForcedRoll('e1', 33);
    useGame.setState({ journal: [] });
    useGame.getState().cascadeNext(); // conséquence d'E1 : dé SAISI
    const apresE1 = useGame.getState().journal.join('\n');
    expect(apresE1).toContain('conséquence de e1');
    expect(apresE1, 'la ligne du dé posé a perdu sa mention').toContain('dé fixé');
    useGame.setState({ journal: [] });
    useGame.getState().cascadeTableRoll('e2'); // dé NATUREL
    expect(useGame.getState().pendingCascade!.participants[1].fixed).toBeUndefined();
    useGame.getState().cascadeNext(); // conséquence d'E2
    const apresE2 = useGame.getState().journal.join('\n');
    expect(apresE2).toContain('conséquence de e2');
    expect(apresE2, 'la marque d’E1 a contaminé la ligne d’E2').not.toContain('dé fixé');
  });

  it('slot MULTI à participants : un seul dé saisi ne marque pas les lignes du lot', () => {
    // Deux contributeurs, un seul dé saisi : aucune ligne n'est imputable au seul dé saisi — la
    // mention se tait plutôt que de mentir sur le jet du voisin (sous-marquer, jamais sur-marquer).
    useGame.setState({
      journal: [],
      pendingCascade: null,
      pendingForceDoor: {
        participants: [
          { id: 'A', interactive: true, fixed: true, result: { roll: 33, target: 45, sl: 1, success: true } },
          { id: 'B', interactive: true, result: { roll: 54, target: 45, sl: -1, success: false } },
        ],
      } as never,
    });
    useGame.getState().log('La porte cède.');
    expect(useGame.getState().journal.join('\n')).not.toContain('dé fixé');
    // Le MONO reste le cas N=1 : seul participant, dé saisi → la ligne porte la mention.
    useGame.setState({
      journal: [],
      pendingForceDoor: { participants: [{ id: 'A', interactive: true, fixed: true, result: { roll: 33, target: 45, sl: 1, success: true } }] } as never,
    });
    useGame.getState().log('La porte cède.');
    expect(useGame.getState().journal.join('\n')).toContain('dé fixé');
    useGame.setState({ pendingForceDoor: null });
  });
});
