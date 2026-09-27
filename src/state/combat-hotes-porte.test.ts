import { describe, it, expect } from 'vitest';
import { useGame, type BattleState } from './store';
import { avanceEtapeCascade } from './cascadeTestKit';
import {
  maybeOpenDefense, openSurfacedDefense, openAttackCascade, startDisengage, openCastCascade,
  openCastOpposition, shareCastStep, applyStructureCriticalToTarget, applyMiscast, resolveDeviation,
  previewCritEntry,
} from './combatFlow';
import { stakeAtTableRow } from './cascade';
import { combatStakeRef } from '../data';
import { modalOwnerOf, seatOwns, ownsLocally } from './netOwnership';
import { seedBattleRng, battleRng } from './battleRng';
import { resolveCritique } from '../engine/critical';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import type { CascadeStep } from './pendings';

/**
 * LES HÔTES DE JET DE COMBAT PAR LA PORTE (#1262 V1 lot 5a) — Désengagement, Défense (×3),
 * Attaque, Maladresse, Incantation. Ce que ces tests verrouillent, site par site :
 *  - l'étape hôte NAÎT du mint (`hostStep`), qui exige le `pending*` porteur de sa donnée : le site
 *    pose donc son pending AVANT d'ouvrir, et une fenêtre fantôme (étape sans donnée, validée à vide
 *    par la cadence auto) n'est plus atteignable depuis ces chemins ;
 *  - la POSSESSION de la fenêtre est celle du porteur, mesurée EN COOP (#1262 B7 : en solo tous les
 *    prédicats de siège coïncident — un test local ne prouve rien) ;
 *  - `groupOwner` du CAST (moment PARTAGÉ d'incantation) ne se pose que par le mint, à l'ouverture
 *    comme à la bascule `shareCastStep` — les autres bascules de possession restent des mutations
 *    d'étape (`combatSlice.ts:638`, désengagement) : elles passent la porte au lot 5b ;
 *  - les AFFICHAGES adossés à ces situations (Imparfaite/Colère, Critique de Structure) passent par
 *    leur mint sans rien perdre de leur en-tête ni de leur enjeu.
 */

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);

const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const bow: Weapon = { name: 'Arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 4 }, range: 60, qualities: [], uid: 'bw' } as unknown as Weapon;

/** Deux sièges : l'HÔTE (0) joue, le héros appartient à l'INVITÉ (1) — la seule configuration où la
 *  possession d'une fenêtre est OBSERVABLE (en local, tout siège possède tout). */
const COOP = { mode: 'host' as const, mySeat: 0, gmSeat: undefined, ownership: { h: 1 } };

function setup(enemyPos: { x: number; y: number }, enemyWeapons: Weapon[], net: Partial<ReturnType<typeof useGame.getState>['net']> = COOP) {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', enemyPos, enemyWeapons);
  const hero = mk('h', 'hero', { x: 0, y: 0 }, [sword]);
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingDisengage: null, pendingCast: null,
    pendingCascade: null, suspendedCascades: [],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {}, ...net },
  } as never);
  return { enemy, hero };
}

const etape = (jet: CascadeStep['jet']): CascadeStep | undefined =>
  useGame.getState().pendingCascade?.participants.find((s) => s.jet === jet);

describe('#1262 lot 5a — DÉFENSE : la fenêtre naît du pending, et va au siège du défenseur', () => {
  it('mêlée réactive : `pendingDefense` posé PUIS l’étape hôte mintée (jamais l’inverse)', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(useGame.getState().pendingDefense, 'la donnée que la fenêtre rend').not.toBeNull();
    const st = etape('defense')!;
    // Id DÉRIVÉ du compteur de la séquence (#1852) : une seconde défense (attaque gratuite) rejoint la
    // même séquence, et deux étapes d'un id constant y seraient in-adressables.
    expect(st.id).toBe('defense-jet-0');
    expect(st.kind).toBe('defenseJet');
    expect(st.actorId, 'le DÉFENSEUR porte l’étape').toBe(hero.id);
    expect(useGame.getState().pendingCascade!.title).toBe('Défense');
  });

  it('COOP : la fenêtre de Défense est au siège de l’INVITÉ, jamais à l’hôte qui attaque', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero);
    expect(modalOwnerOf(useGame.getState())).toBe(hero.id);
    expect(seatOwns(useGame.getState(), 1, hero.id), 'le siège 1 tient le défenseur').toBe(true);
    expect(ownsLocally(useGame.getState(), hero.id), 'chez l’hôte, la fenêtre n’est pas à lui').toBe(false);
  });

  it('tir réactif (Bout Portant) : même mint, même possession', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [bow]);
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(useGame.getState().pendingDefense!.modes).toContain('esquive');
    expect(etape('defense')!.actorId).toBe(hero.id);
    expect(modalOwnerOf(useGame.getState())).toBe(hero.id);
  });

  it('interposition du chemin PILOTÉ (`openSurfacedDefense`) : étape hôte + pending cohérents', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    useGame.getState().attackRoll();
    const pa = useGame.getState().pendingAttack!;
    useGame.setState({ pendingCascade: null } as never); // la fenêtre d'attaque se ferme, la défense s'interpose
    expect(openSurfacedDefense(useGame.getState, useGame.setState, enemy, hero, sword, pa)).toBe(true);
    expect(useGame.getState().pendingDefense).not.toBeNull();
    expect(etape('defense')!.actorId).toBe(hero.id);
  });
});

describe('#1262 lot 5a — ATTAQUE : l’étape hôte suit son `pendingAttack`', () => {
  it('l’étape `attack-jet` est mintée sur le pending posé, et porte l’ATTAQUANT', () => {
    const { hero, enemy } = setup({ x: 1, y: 0 }, [sword]);
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    expect(useGame.getState().pendingAttack).not.toBeNull();
    const st = etape('attack')!;
    expect(st.id).toBe('attack-jet-0'); // id DÉRIVÉ du compteur de la séquence d'accueil (#1852)
    expect(st.kind).toBe('attackJet');
    expect(st.actorId).toBe(hero.id);
  });

  it('COOP : l’attaque d’un héros de l’INVITÉ s’ouvre à SON siège', () => {
    const { hero, enemy } = setup({ x: 1, y: 0 }, [sword]);
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    expect(modalOwnerOf(useGame.getState())).toBe(hero.id);
    expect(seatOwns(useGame.getState(), 1, hero.id)).toBe(true);
  });
});

describe('#1262 lot 5a — DÉSENGAGEMENT : le menu est hôté sur `pendingDisengage`', () => {
  it('l’étape `disengage` est mintée après la pose du pending, et porte le fuyard', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    hero.engagedWith = [enemy.id];
    enemy.engagedWith = [hero.id];
    startDisengage(useGame.getState, useGame.setState, hero);
    expect(useGame.getState().pendingDisengage!.moverId).toBe(hero.id);
    const st = etape('disengage')!;
    expect(st.id).toBe('disengage');
    expect(st.kind).toBe('disengageStep');
    expect(st.actorId).toBe(hero.id);
    expect(modalOwnerOf(useGame.getState()), 'COOP : le fuyard de l’invité tranche SON désengagement').toBe(hero.id);
  });
});

describe('#1262 lot 5a — INCANTATION : `groupOwner` ne se pose QUE par le mint', () => {
  function poseCast(casterId: string, targetId: string) {
    useGame.setState({ pendingCast: { casterId, targetId, spellId: 'chute', missile: false, focused: false, result: null } } as never);
  }

  it('lanceur HÉROS : l’étape porte le lanceur, pas de possession partagée', () => {
    const { hero, enemy } = setup({ x: 1, y: 0 }, [sword]);
    poseCast(hero.id, enemy.id);
    openCastCascade(useGame.getState, useGame.setState, hero);
    const st = etape('cast')!;
    expect(st.id).toBe(`cast-${hero.id}-0`); // id DÉRIVÉ du compteur de la séquence d'accueil (#1852)
    expect(st.kind).toBe('cast');
    expect(st.groupOwner).toBeUndefined();
    expect(modalOwnerOf(useGame.getState()), 'COOP : la fenêtre est au siège du lanceur').toBe(hero.id);
  });

  it('lanceur ENNEMI : le MINT pose `groupOwner` (moment partagé), l’arbitre ouvre à tous', () => {
    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    poseCast(enemy.id, hero.id);
    openCastCascade(useGame.getState, useGame.setState, enemy);
    expect(etape('cast')!.groupOwner, 'posé par le mint, jamais à la main au call-site').toBe(true);
    expect(modalOwnerOf(useGame.getState())).toBe('*');
  });

  /** Deux HÉROS de sièges distincts : la cible du Sort est JOUÉE, donc sa rangée d'opposition est
   *  interactive — la seule configuration où `shareCastStep` bascule sur le chemin RÉEL. */
  function deuxHeros() {
    const wiz = mk('h', 'hero', { x: 0, y: 0 }, [sword]);
    const cible = mk('h2', 'hero', { x: 1, y: 0 }, [sword]);
    const battle = {
      combatants: [wiz, cible], order: [wiz.id, cible.id], baseOrder: [wiz.id, cible.id],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    useGame.setState({
      battle, mode: 'battle', scene: testScene(), party: [wiz, cible],
      pendingCast: null, pendingCastOpposition: null, pendingCascade: null, suspendedCascades: [],
      net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { h2: 1 } },
    } as never);
    return { wiz, cible };
  }

  it('CHEMIN RÉEL (opposition de cible, jet posé) : le remint ne perd AUCUN champ de l’étape', () => {
    const { wiz, cible } = deuxHeros();
    useGame.setState({ pendingCast: { casterId: wiz.id, targetId: cible.id, spellId: 'fauche-demon', missile: false, focused: false, result: null } } as never);
    openCastCascade(useGame.getState, useGame.setState, wiz);
    // `castRoll` pose le résultat DANS `pendingCast` (jamais sur l'étape hôte) : l'état d'avant-bascule
    // est donc celui d'un jet DÉJÀ lancé, pas celui d'une cascade fraîche.
    const pc0 = useGame.getState().pendingCast!;
    useGame.setState({ pendingCast: { ...pc0, result: { cast: true, roll: 21, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' } } } as never);
    const avant = { ...etape('cast')! };
    expect(openCastOpposition(useGame.getState, useGame.setState, useGame.getState().pendingCast!, [cible])).toBe(true);
    const apres = etape('cast')!;
    expect(Object.keys(avant).filter((k) => !(k in apres)), 'aucun champ de l’étape réelle n’est perdu au remint').toEqual([]);
    expect({ ...apres, groupOwner: undefined }, 'seule la possession change').toEqual({ ...avant, groupOwner: undefined });
    expect(apres.groupOwner).toBe(true);
    expect(modalOwnerOf(useGame.getState()), 'la fenêtre porte les jets de DEUX sièges').toBe('*');
  });

  it('CONTRAT du remint : une étape hôte ne porte QUE sa déclaration — le reste ne survit pas', () => {
    const { wiz, cible } = deuxHeros();
    useGame.setState({ pendingCast: { casterId: wiz.id, targetId: cible.id, spellId: 'fauche-demon', missile: false, focused: false, result: null } } as never);
    openCastCascade(useGame.getState, useGame.setState, wiz);
    // Champs POSÉS À LA MAIN sur l'étape hôte — ce qu'aucune couture de cast ne fait (la situation vit
    // dans `pendingCast`). Le remint les DÉTRUIT : c'est le contrat, pas un accident.
    const p = useGame.getState().pendingCascade!;
    useGame.setState({ pendingCascade: { ...p, participants: p.participants.map((s, i) => (i === 0
      ? { ...s, result: { roll: 12, target: 60, sl: 4, success: true }, outcome: [{ text: 'déjà affiché' }], fixed: true } : s)) } } as never);
    shareCastStep(useGame.getState, useGame.setState, [wiz.id, cible.id], wiz.id);
    const apres = etape('cast')! as unknown as Record<string, unknown>;
    expect(apres.groupOwner).toBe(true);
    expect(apres.result, 'un jet n’est jamais scellé sur l’étape hôte (il vit dans le pending)').toBeUndefined();
    expect(apres.outcome).toBeUndefined();
    expect(apres.fixed).toBeUndefined();
    expect(Object.keys(apres).sort(), 'la déclaration, et rien d’autre').toEqual(['actorId', 'groupOwner', 'id', 'jet', 'kind']);
  });

  it('`shareCastStep` SANS `pendingCast` ne bascule rien (le mint refuse la fenêtre orpheline)', () => {
    const { hero, enemy } = setup({ x: 1, y: 0 }, [sword]);
    poseCast(hero.id, enemy.id);
    openCastCascade(useGame.getState, useGame.setState, hero);
    useGame.setState({ pendingCast: null } as never); // la donnée a disparu : plus rien à partager
    expect(() => shareCastStep(useGame.getState, useGame.setState, [hero.id, enemy.id], hero.id)).toThrow(/pendingCast/);
    expect(etape('cast')!.groupOwner, 'l’étape n’a PAS été mutée par un chemin de secours').toBeUndefined();
  });
});

describe('#1262 lot 5a — MALADRESSE : le seul hôte dont la donnée vit sur l’étape', () => {
  it('reprise après suspension : l’étape `fumble` est mintée avec sa charge (aucun pending)', () => {
    // Graine DÉTERMINISTE d'une défense RATÉE sur un double (LDB 14 l.13), jouée sur le chemin réel.
    let seed = 0;
    for (let sd = 1; sd <= 800 && !seed; sd++) {
      const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
      seedBattleRng(sd);
      if (!maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)) continue;
      useGame.getState().defenseRoll();
      const pd = useGame.getState().pendingDefense!;
      const d = pd.result?.defenderDetail;
      if (d && !d.success && d.roll % 11 === 0) seed = sd;
    }
    expect(seed, 'une graine de Maladresse de défense existe').toBeGreaterThan(0);

    const { enemy, hero } = setup({ x: 1, y: 0 }, [sword]);
    seedBattleRng(seed);
    maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero);
    useGame.getState().defenseRoll();
    const res = useGame.getState().pendingDefense!.result!;
    const crit = resolveCritique('ldb', hero, 'corps', battleRng(), { forcedRoll: 30 });
    // Reprise d'une attaque SUSPENDUE par la fenêtre de Critique de la victime (`resolveDeviation` est
    // le corps de l'applier `deviation`) : c'est là que la Maladresse du défenseur s'appende.
    useGame.setState({ pendingDefense: null, pendingCascade: null } as never);
    resolveDeviation(useGame.getState, useGame.setState, {
      mode: 'melee', attackerId: enemy.id, targetId: hero.id, weapon: sword, res,
      crit, reveal: previewCritEntry(hero, crit, { attackerId: enemy.id, weapon: sword.label }), resumeAfter: false,
    }, true);
    const st = etape('fumble');
    expect(st, 'la Maladresse du défenseur est une étape de la séquence').toBeTruthy();
    expect(st!.kind).toBe('fumbleJet');
    expect(st!.actorId).toBe(hero.id);
    expect(st!.fumble!.weapon.uid, 'sa charge (arme + Oups ! à tirer) vit SUR l’étape').toBe('sw');
    expect(st!.fumble!.result).toBeNull();
  });
});

describe('#1262 lot 5a — AFFICHAGES adossés aux situations de combat', () => {
  it('Imparfaite : le mint de révélation garde l’en-tête de la RANGÉE (label court + icône de sévérité)', () => {
    const { hero } = setup({ x: 1, y: 0 }, [sword]);
    seedBattleRng(3);
    applyMiscast(useGame.getState, useGame.setState, hero, 'mineure');
    avanceEtapeCascade(useGame.getState); // le dé du Tableau tombe à son étape → la révélation suit
    const st = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'miscast')!;
    expect(st.label).toBe('Imparfaite');
    expect(st.icon).toBe('fire/blast');
    expect(st.actorId).toBe(hero.id);
    expect(st.reveal!.title, 'la CHARGE garde son titre long').toBe('Incantation Imparfaite');
    expect(st.outcome!.length).toBeGreaterThan(0);
  });

  it('Colère des dieux : label et icône de la gravité supérieure', () => {
    const { hero } = setup({ x: 1, y: 0 }, [sword]);
    seedBattleRng(3);
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    avanceEtapeCascade(useGame.getState);
    const st = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'miscast')!;
    expect(st.label).toBe('Colère des dieux');
    expect(st.icon).toBe('magic/power');
  });

  it('Critique de Structure : table RÉSOLUE + charge riche, enjeu DESCENDU à la ligne tirée', () => {
    const { hero } = setup({ x: 1, y: 0 }, [sword]);
    seedBattleRng(11);
    const structure = mk('s', 'enemy', { x: 2, y: 0 }, []);
    const log: string[] = [];
    applyStructureCriticalToTarget(useGame.setState, structure, { attackerId: hero.id, attackerKind: 'hero', weapon: 'Épée' }, log, 42);
    const st = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'critical')!;
    expect(st.actorId).toBe(structure.id);
    expect(st.table!.result!.roll, 'le dé est POSÉ : la fenêtre ne le re-jette pas').toBe(42);
    expect(st.reveal!.title).toBe('Critique de Structure');
    // L'enjeu du mint est ÉGAL à celui que le site composait à la main avant migration : même
    // référence de règle, même descente à la ligne tirée (`stakeAtTableRow`), au champ près.
    const decl = st.table!;
    expect(st.stake).toEqual(stakeAtTableRow(combatStakeRef('structureCritical'), { ...decl, result: undefined } as never, decl.result!));
    expect(st.stake!.key!.entryId, 'l’enjeu descend à la LIGNE jouée, pas au `kind`').toBeTruthy();
  });
});
