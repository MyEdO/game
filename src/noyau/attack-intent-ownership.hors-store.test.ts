/**
 * #1013 — possession des verbes d'INFLUENCE d'attaque/défense : elle suit le PORTEUR DU JET
 * (`FLOW_VERBS.attaque/defense.jetOwner`), jamais le owner de la FENÊTRE ACTIVE.
 *
 * Défaut mesuré avant la correction, sur le flux RÉEL (attaque pilotée par le siège MJ, défense
 * SURFACÉE du héros du siège 1, #989) : pendant l'étape `jet:'defense'` le owner de modale est le
 * DÉFENSEUR, donc `attack*` retombait sur LUI — possession exactement inversée (le défenseur
 * dépensait la Chance/la Résilience/le Pacte de l'ATTAQUANT). Miroir mesuré pendant l'étape
 * `jet:'attaque'` : les verbes `defense*` étaient acceptés du siège de l'ATTAQUANT.
 *
 * La clôture (`jetValider`) suit le même porteur ; la fenêtre de Défense interposée (#989 : `jetValider('defense')`
 * ré-entre dans `jetValider('attaque')`) se joue de bout en bout — vérifié ci-dessous.
 */
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { openAttackCascade, maybeOpenDefense } from './combatFlow';
import { intentAllowedFor, ROUTES } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { FLOW_VERBS, NOM_DU_VERBE_DE_JET } from './flowVerbs';
import { COMBAT_INTENTS } from './intentionsDeSiege';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const NET0 = initialNet();

// Fixture mk()/setup() de `defense-surfacage.hors-store.test.ts` (#989) — même arène, mêmes sièges.
const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;

/** Siège 0 = hôte spectateur, siège 1 = joueur du héros `h`, siège 2 = MJ (conduit l'ennemi `e`). */
function setup(net: Record<string, unknown> = {}) {
  seedBattleRng(7);
  const enemy = mk('e', 'ennemi', { x: 1, y: 0 }, [sword]);
  const hero = mk('h', 'heros', { x: 0, y: 0 }, [sword]);
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: 2, ownership: { h: 1 }, slots: [0, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Joueur', 2: 'MJ' }, ...net },
  });
  return { enemy, hero };
}

const g = () => banc.getState();
/** Les gestes d'influence d'un flux, par leur identité `verbe@flux` (`cleDuGeste`). */
const influences = (flux: 'attaque' | 'defense') => ['jetRelancer', 'jetAjouterUnDR', 'jetPactiser', 'jetForcerLaReussite', 'jetImposerLeResultat', 'jetInverser'].map((v) => `${v}@${flux}`);
const ATTACK_VERBS = influences('attaque');
const DEFENSE_VERBS = influences('defense');
/** Le verbe et les arguments du geste `verbe@flux` (`VerbesDeJet`). */
const gesteDe = (cle: string): [string, unknown[]] => {
  const [verbe, flux] = cle.split('@');
  return [verbe, verbe === 'jetImposerLeResultat' ? [flux, 42] : [flux]];
};
const permis = (seat: number, cle: string) => intentAllowedFor(g(), seat, ...gesteDe(cle));
/** Verdict des 3 sièges pour un geste : [hôte, joueur du héros, MJ]. */
const seats = (cle: string) => [0, 1, 2].map((seat) => permis(seat, cle));

/** Attaque PILOTÉE par le siège MJ jusqu'à l'interposition de la défense SURFACÉE du héros (#989). */
function playToDefenseWindow() {
  const { enemy, hero } = setup();
  openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
  g().jetLancer('attaque');
  g().jetValider('attaque');
  return { enemy, hero };
}

describe('#1013 — la table DÉRIVE les intents d’attaque/défense', () => {
  it('les verbes de jet sur les deux flux sont routés par porteur (sinon les gardes ne mesurent rien)', () => {
    expect(FLOW_VERBS.attaque.jetOwner).toEqual({ pending: 'pendingAttack', field: 'attackerId' });
    expect(FLOW_VERBS.defense.jetOwner).toEqual({ pending: 'pendingDefense', field: 'defenderId' });
    // `jetAnnuler('attaque')` ferme la situation : il ne dépense rien, mais il est routé par le porteur comme les autres
    // (#1017) — sur une fenêtre PARTAGÉE (`'*'`), le repli `modalOwnerOf` laissait n'importe quel siège fermer le jet
    // d'autrui.
    for (const i of Object.values(NOM_DU_VERBE_DE_JET)) {
      expect(ROUTES.has(i), `${i} routé`).toBe(true);
      expect(COMBAT_INTENTS.has(i), `${i} exposé comme intent invité`).toBe(true);
    }
  });
});

describe('#1013 — fenêtre de DÉFENSE ouverte : les verbes `attack*` n’appartiennent PLUS au défenseur', () => {
  it('sonde A — défense SURFACÉE interposée (attaque du siège MJ sur le héros du siège 1)', () => {
    const { hero } = playToDefenseWindow();
    expect(g().pendingDefense, 'précondition : la fenêtre de défense s’est interposée').toBeTruthy();
    expect(modalOwnerOf(g()), 'le owner de la fenêtre est le DÉFENSEUR').toBe(hero.id);
    expect(g().pendingAttack, 'le jet d’attaque est CLOS pendant la fenêtre du défenseur').toBeNull();
    for (const i of ATTACK_VERBS) {
      expect(seats(i), `${i} : aucun siège ne dépense les ressources de l’attaquant par la fenêtre du défenseur`).toEqual([false, false, false]);
    }
  });

  it('sonde A bis — défense RÉACTIVE (`maybeOpenDefense`) : même verdict', () => {
    const { enemy, hero } = setup();
    expect(maybeOpenDefense(banc.getState, banc.setState, enemy, hero)).toBe(true);
    expect(modalOwnerOf(g())).toBe(hero.id);
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, false, false]);
  });

  it('sonde A ter — défense de l’ENNEMI (attaque du héros du siège 1) : l’attaquant ne récupère rien non plus', () => {
    const { enemy, hero } = setup();
    banc.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, banc.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    g().jetValider('attaque');
    expect(g().pendingDefense!.defenderId).toBe(enemy.id);
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, false, false]);
  });
});

describe('#1013 — symétrique : fenêtre d’ATTAQUE ouverte, les verbes `defense*` n’appartiennent PLUS à l’attaquant', () => {
  it('aucune défense n’est en jeu : les trois sièges sont refusés', () => {
    const { enemy, hero } = setup();
    openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    expect(modalOwnerOf(g()), 'le owner de la fenêtre est l’ATTAQUANT').toBe(enemy.id);
    expect(g().pendingDefense).toBeNull();
    for (const i of DEFENSE_VERBS) expect(seats(i), `${i} : le siège de l’attaquant ne tient pas les verbes de défense`).toEqual([false, false, false]);
  });
});

describe('#1013 — quadrants du POSSESSEUR LÉGITIME (la correction ne ferme rien de dû)', () => {
  it('fenêtre d’attaque : seul le siège du porteur (MJ, qui conduit l’ennemi) dépense', () => {
    const { enemy, hero } = setup();
    openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, false, true]);
  });

  it('fenêtre d’attaque d’un HÉROS : son siège dépense, l’hôte et le MJ non', () => {
    const { enemy, hero } = setup();
    banc.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, banc.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, true, false]);
  });

  it('fenêtre de défense : seul le siège du DÉFENSEUR dépense (héros du siège 1)', () => {
    playToDefenseWindow();
    for (const i of DEFENSE_VERBS) expect(seats(i), i).toEqual([false, true, false]);
  });

  it('fenêtre de défense de l’ENNEMI : seul le siège MJ dépense', () => {
    const { enemy, hero } = setup();
    banc.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, banc.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    g().jetValider('attaque');
    for (const i of DEFENSE_VERBS) expect(seats(i), i).toEqual([false, false, true]);
  });

  it('SOLO : l’attaquant du joueur garde ses dépenses, la défense aussi', () => {
    const { enemy, hero } = setup({ mode: 'local', mySeat: 0, gmSeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    banc.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, banc.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    g().jetLancer('attaque');
    for (const i of ATTACK_VERBS) expect(permis(0, i), i).toBe(true);
    g().jetValider('attaque');
    expect(g().pendingDefense, 'l’ennemi conduit par le MJ local défend').toBeTruthy();
    for (const i of DEFENSE_VERBS) expect(permis(0, i), i).toBe(true);
  });
});

describe('#1013/#2961/#3324 — le jet d’attaque suit l’attaquant, clôture comprise', () => {
  it('`jetLancer(\'attaque\')` et `jetValider(\'attaque\')` sont routés par l’attaquant', () => {
    const { enemy, hero } = setup();
    openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attaquer');
    expect(seats('jetLancer@attaque'), 'seul le siège MJ, qui conduit l’attaquant, jette').toEqual([false, false, true]);
    expect(seats('jetValider@attaque'), 'la clôture suit le même porteur').toEqual([false, false, true]);
  });

  it('la fenêtre interposée se joue de bout en bout : le défenseur roule, applique, et le tour n’avance pas', () => {
    const { hero } = playToDefenseWindow();
    const turnBefore = g().battle!.turn;
    expect(permis(1, 'jetLancer@defense'), 'le siège du défenseur roule SA défense').toBe(true);
    expect(permis(2, 'jetLancer@defense'), 'le MJ ne roule pas la défense du héros').toBe(false);
    expect(permis(1, 'jetValider@defense'), 'le défenseur clôt SA défense').toBe(true);
    expect(permis(2, 'jetValider@defense'), 'le MJ ne clôt pas la défense du héros').toBe(false);
    g().jetLancer('defense');
    g().jetValider('defense');
    expect(g().pendingDefense, 'la fenêtre est refermée').toBeNull();
    expect(g().battle!.turn, 'la reprise `jetValider(\'attaque\')` n’a pas fait avancer le tour').toBe(turnBefore);
    expect(g().battle!.combatants.some((c) => c.id === hero.id)).toBe(true);
  });
});
