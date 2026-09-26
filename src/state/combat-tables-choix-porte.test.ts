import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import {
  applyOpposedCritical, applyAttackResult, applyMiscast, applyBladeTrap, startDisengage, STRUCTURE_CRIT_TABLE,
} from './combatFlow';
import { displayStep, hostStep, tableStep } from './rollSeam';
import { stepInteraction, tableStepPosee } from './cascade';
import { fixtureText } from '../i18n/fixtureText';
import { combatStakeRef } from '../data';
import { parseQualityInstance } from '../engine/qualities/normalize';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { seedBattleRng } from './battleRng';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { modalOwnerOf, seatOwns, ownsLocally } from './netOwnership';
import type { Weapon, HitLocation, ArmourPoints } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { CascadeStep } from './pendings';

/**
 * LES TABLES, CHOIX et AFFICHAGES de combat PAR LA PORTE (#1262 V1 lot 5b) — Déviation, Piège-lame,
 * sévérité de Critique, Imparfaite/Colère, conséquence de Piège-lame, reprise de Fuite, Piétinement,
 * bascule de possession du Désengagement. Ce que ces tests verrouillent :
 *  - la CHARGE de l'applier voyage par la DÉCLARATION (`ChoiceSpec.deviation`/`bladeTrap`,
 *    `TableSpec.critSeverity`/`miscast`, `DisplaySpec.fleeMove`) : une charge perdue au mint rendrait
 *    l'étape muette au commit — l'applier ne trouverait plus de quoi appliquer ;
 *  - l'AFFICHAGE pur reste pur : `displayStep` ne peut PAS déclarer `reveal`/`table`/`options`
 *    (interdit au TYPE, cf. les `@ts-expect-error` ci-dessous) — une conséquence sans dé ne se rend
 *    jamais comme un tirage ;
 *  - la POSSESSION vient du mint, mesurée EN COOP (#1262 B7) — en solo tous les prédicats coïncident ;
 *  - la bascule de GROUPE du Désengagement REMINTE au lieu de muter : une étape hôte ne porte que sa
 *    déclaration.
 */

const SANS_PA: ArmourPoints = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
const PA = (pa: number): ArmourPoints => ({ tete: pa, corps: pa, brasG: pa, brasD: pa, jambeG: pa, jambeD: pa });

const hache: Weapon = { label: 'Hache', name: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], uid: 'hache-1' } as unknown as Weapon;

const critHit = (loc: HitLocation, woundsLost = 2): AttackResult => ({
  hit: true, attackerRoll: 44, netSL: 4, location: loc, critLocation: loc, damage: 6, woundsLost,
  critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche',
} as unknown as AttackResult);

const steps = (): CascadeStep[] => useGame.getState().pendingCascade?.participants ?? [];
const parKind = (kind: string) => steps().find((s) => s.kind === kind);
const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

/** Un combat de fixture avec N héros du groupe. `ownership` : héros TENUS par le siège INVITÉ (1). */
function combat(nb: number, seed = 7, invites: number[] = []) {
  useGame.getState().seedRng(seed);
  const heros = Array.from({ length: nb }, (_, i) =>
    createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, rng: makeRNG(seed + i) }));
  useGame.setState({ party: heros });
  useGame.getState().startScene(structuredClone(testScene));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.filter((c) => c.kind === 'hero');
  const E = b.combatants.filter((c) => c.kind === 'enemy');
  // Les ids de héros sont ENGENDRÉS : la table de possession se compose après coup, sinon elle
  // désigne des combattants qui n'existent pas et le mode coop ne mesure plus rien.
  const ownership: Record<string, number> = {};
  for (const i of invites) ownership[H[i].id] = 1;
  useGame.setState({
    battle: { ...b }, pendingCascade: null, suspendedCascades: [], pendingDisengage: null,
    pendingTrample: null, pendingLogQueue: [],
    net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: undefined, ownership },
  } as never);
  return { H, E };
}

describe('#1262 lot 5b — CHOIX : la charge de l’applier voyage par la déclaration', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); });

  it('DÉVIATION (Critique opposé, héros blindé) : options + charge `deviation` + révélation, aucun `groupOwner`', () => {
    const { H, E } = combat(1, 7, [0]);
    const hero = H[0];
    hero.armour = PA(3); // PA déviable partout : le choix Dévier/Subir s'offre quelle que soit la loc tirée
    hero.wounds = { current: 40, max: 40, base: 40 } as never;
    seedBattleRng(5);
    applyOpposedCritical(useGame.getState, useGame.setState, hero, 33, { attackerId: E[0].id, weapon: 'Hache' }, []);

    const st = parKind('deviation')!;
    expect(st, 'le choix Dévier/Subir est une étape de la séquence').toBeTruthy();
    expect(stepInteraction(st)).toBe('choix');
    expect(st.options!.map((o) => o.key)).toEqual(['devier', 'subir']);
    expect(st.defaultChoice).toBe('devier');
    expect(st.actorId, 'le PORTEUR de la décision est la victime').toBe(hero.id);
    expect(st.deviation, 'sans sa charge, `resolveDeviation` n’a plus de coup à rejouer').toBeTruthy();
    expect(st.deviation!.targetId).toBe(hero.id);
    expect(st.deviation!.crit, 'le Critique est PRÉ-TIRÉ : le choix est éclairé').toBeTruthy();
    expect(st.reveal, 'la charge riche se lit SOUS les options, sans seconde étape').toBeTruthy();
    expect(st.groupOwner, 'un choix n’est jamais de GROUPE (`ChoiceSpec.groupOwner?: never`)').toBeUndefined();
    // COOP : la fenêtre revient au siège de la victime, jamais à l'hôte qui tient l'attaquant.
    expect(modalOwnerOf(useGame.getState())).toBe(hero.id);
    expect(seatOwns(useGame.getState(), 1, hero.id)).toBe(true);
    expect(ownsLocally(useGame.getState(), hero.id), 'chez l’hôte, la décision n’est pas à lui').toBe(false);
  });

  it('PIÈGE-LAME (Critique en parant) : options + charge `bladeTrap` + enjeu des deux voies, défaut « Critique »', () => {
    const { H, E } = combat(1, 7, [0]);
    const defenseur = H[0];
    const attaquant = E[0];
    const lame = { label: 'Épée', name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], uid: 'lame-atk', bladed: true } as unknown as Weapon;
    const parade = { label: 'Dague-épée', name: 'Dague-épée', type: 'melee', damage: { plusBF: true, flat: 2 }, qualities: [parseQualityInstance('piege-lame')!], uid: 'parade-1' } as unknown as Weapon;
    attaquant.weapons = [lame];
    defenseur.weapons = [parade];
    // Test opposé PERDU par l'attaquant, avec un DOUBLE RÉUSSI du défenseur en PARADE (LDB 13 l.183).
    const res = {
      hit: false, attackerRoll: 61, netSL: -2, location: 'corps', damage: 0, woundsLost: 0, critical: false,
      advantageTo: 'defender', defenderDefeated: false, log: 'paré',
      attackerDetail: { roll: 61, target: 45, success: false, sl: -2, isDouble: false },
      defenderDetail: { roll: 22, target: 45, success: true, sl: 2, isDouble: true },
      parryWeapon: parade,
    } as unknown as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, attaquant, defenseur, lame, res);

    const st = parKind('bladeTrap')!;
    expect(st, 'le choix Piéger/Critique est une étape de la séquence').toBeTruthy();
    expect(stepInteraction(st)).toBe('choix');
    expect(st.options!.map((o) => o.key)).toEqual(['trap', 'crit']);
    expect(st.defaultChoice, 'la résolution immédiate retient le Coup Critique').toBe('crit');
    expect(st.actorId).toBe(defenseur.id);
    expect(st.bladeTrap, 'sans sa charge, l’applier n’a plus de Test opposé à router').toBeTruthy();
    expect(st.bladeTrap!.defenderId).toBe(defenseur.id);
    expect(st.bladeTrap!.attackerId).toBe(attaquant.id);
    expect(st.bladeTrap!.parryWeaponUid).toBe('parade-1');
    expect(st.bladeTrap!.defSL, 'le DR de la défense entre dans le Test opposé (LDB 62 l.280)').toBe(2);
    expect(st.outcome!.length, 'ce que chaque voie coûte est écrit sous les options').toBeGreaterThan(0);
    expect(modalOwnerOf(useGame.getState()), 'COOP : le piégeur tranche SA parade').toBe(defenseur.id);
    expect(ownsLocally(useGame.getState(), defenseur.id), 'chez l’hôte, la décision n’est pas à lui').toBe(false);
  });
});

describe('#1262 lot 5b — TABLES : le dé reste À POSER, la charge dit de quoi il décide', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); });

  it('SÉVÉRITÉ d’un Critique : étape à table NON résolue + charge `critSeverity` (attaque suspendue)', () => {
    // La fenêtre de POSE n'existe que pour le siège qui contrôle la victime (`canFixDie`) : la victime
    // est donc tenue par l'HÔTE, et le second héros par l'invité — la possession se mesure des deux côtés.
    const { H, E } = combat(2, 7, [1]);
    const hero = H[0];
    hero.armour = { ...SANS_PA }; // aucune PA → aucune voie de Déviation : on isole le seul tirage
    setDesFixes(true);
    const suspendu = applyAttackResult(useGame.getState, useGame.setState, E[0], hero, hache, critHit('corps'));
    expect(suspendu).toBe(true);

    const st = parKind('deviation')!;
    expect(stepInteraction(st), 'le dé n’est PAS tombé : c’est la fenêtre qui le pose').toBe('table');
    expect(st.table!.result).toBeUndefined();
    expect(st.options, 'rien à sacrifier : cette fenêtre ne porte QUE le tirage').toBeUndefined();
    expect(st.stake, 'l’enjeu du TABLEAU est déclaré avant le dé').toBeTruthy();
    expect(st.critSeverity, 'sans sa charge, l’applier ne saurait plus quel coup rejouer').toBeTruthy();
    expect(st.critSeverity!.targetId).toBe(hero.id);
    expect(st.critSeverity!.attackerId).toBe(E[0].id);
    expect(modalOwnerOf(useGame.getState()), 'le d100 subi va à la VICTIME').toBe(hero.id);
    expect(seatOwns(useGame.getState(), 1, hero.id), 'COOP : l’autre siège ne pose pas ce dé').toBe(false);
    expect(seatOwns(useGame.getState(), 1, H[1].id), 'prémisse : ce siège tient bien un héros').toBe(true);
  });

  it('TABLE + OPTIONS : la SEULE combinaison de formes autorisée, et le mint la RECOPIE (#1426)', () => {
    // Un tirage dont la DÉCISION se prend devant son résultat (sévérité d'une Blessure critique →
    // Dévier/Subir) est UNE étape : `stepInteraction` est une chaîne de PRIORITÉ, donc elle se présente
    // en `'table'` puis, le dé tombé, en `'choix'`. Aucune autre combinaison de formes n'est ouverte.
    const st = tableStep({
      id: 'x', kind: 'deviation', label: fixtureText('Blessure critique'), actorId: 'a',
      table: { tableId: STRUCTURE_CRIT_TABLE, spec: { n: 1, sides: 100 } },
      options: [{ key: 'devier', label: fixtureText('Dévier') }, { key: 'subir', label: fixtureText('Subir') }],
      defaultChoice: 'devier',
      stake: combatStakeRef('critSeverity'),
    })!;
    expect(stepInteraction(st), 'tant que le dé n’est pas tombé, c’est un TIRAGE').toBe('table');
    expect(st.options!.map((o) => o.key), 'les voies sont RECOPIÉES par le mint').toEqual(['devier', 'subir']);
    expect(st.defaultChoice, 'la résolution immédiate retient une voie authorée').toBe('devier');
    // Le dé tombé, la MÊME étape offre ses voies — aucune 2ᵉ étape à enchaîner.
    const posee = tableStepPosee(st, st.table!, { roll: 40, die: 40, id: 'x', lines: [] });
    expect(stepInteraction(posee)).toBe('choix');
    expect(posee.id).toBe(st.id);
    // Un `defaultChoice` étranger aux voies est REFUSÉ à la porte (calque de `choiceStep`).
    expect(() => tableStep({
      id: 'y', kind: 'deviation', label: fixtureText('Blessure critique'), actorId: 'a',
      table: { tableId: STRUCTURE_CRIT_TABLE, spec: { n: 1, sides: 100 } },
      options: [{ key: 'subir', label: fixtureText('Subir') }], defaultChoice: 'devier',
      stake: combatStakeRef('critSeverity'),
    })).toThrow(/defaultChoice/);
  });

  it('IMPARFAITE : étape à table NON résolue + charge `miscast` (sévérité à appliquer au dé posé)', () => {
    // Même porte que la sévérité : le tirage ne devient une étape à poser que chez le siège qui tient
    // le LANCEUR — l'hôte ici, l'invité tenant le second héros.
    const { H } = combat(2, 7, [1]);
    setDesFixes(true);
    seedBattleRng(3);
    applyMiscast(useGame.getState, useGame.setState, H[0], 'mineure');

    const st = parKind('miscastTable')!;
    expect(stepInteraction(st)).toBe('table');
    expect(st.table!.result).toBeUndefined();
    expect(st.miscast, 'sans sa charge, l’applier n’a plus de contrecoup à résoudre').toBeTruthy();
    expect(st.miscast!.severity).toBe('mineure');
    expect(st.actorId).toBe(H[0].id);
    expect(modalOwnerOf(useGame.getState()), 'COOP : l’Imparfaite est celle du LANCEUR').toBe(H[0].id);
  });
});

describe('#1262 lot 5b — AFFICHAGES : une conséquence sans dé ne se rend pas comme un tirage', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); });

  it('conséquence de PIÈGE-LAME : étape d’affichage (lignes seules), ni table ni révélation', () => {
    const { H, E } = combat(1, 7, [0]);
    const defenseur = H[0];
    const attaquant = E[0];
    attaquant.weapons = [{ ...hache, uid: 'lame-visee' } as Weapon];
    applyBladeTrap(useGame.getState, useGame.setState, defenseur,
      { attackerId: attaquant.id, weaponUid: 'lame-visee', defSL: 0, attackerSL: 0 }, 2);

    const st = parKind('bladeTrapResult')!;
    expect(st, 'la conséquence est EMPILÉE comme étape propre').toBeTruthy();
    expect(stepInteraction(st), 'zéro dé, zéro décision : l’étape s’acquitte').toBe('affichage');
    expect(st.outcome!.length).toBeGreaterThan(0);
    expect(st.actorId, 'le piégeur possède la fenêtre en coop').toBe(defenseur.id);
    expect(st.reveal, 'aucune charge de RÉVÉLATION : il n’y a pas eu de tirage').toBeUndefined();
    expect(st.table).toBeUndefined();
    expect(st.options).toBeUndefined();
    expect(live(attaquant.id).weapons.find((w) => w.uid === 'lame-visee'), 'la lame est arrachée').toBeUndefined();
  });

  it('reprise de FUITE : étape d’affichage + charge `fleeMove` (la fuite attend le coup gratuit)', () => {
    // Duel de HÉROS : c'est la configuration où le Critique du coup dans le dos OFFRE la Déviation au
    // fuyard blindé — donc où l'application est SUSPENDUE et où la fuite a besoin de son étape de
    // reprise. Le fuyard est tenu par l'HÔTE : l'offre de Déviation d'`applyAttackResult` est gardée
    // par `pilotedByHuman` (affordance LOCALE), le frappeur va donc au siège invité.
    const { H } = combat(2, 7, [0]);
    const frappeur = H[0];
    const fuyard = H[1];
    frappeur.pos = { x: 6, y: 10 };
    fuyard.pos = { x: 7, y: 10 };
    fuyard.armour = PA(2); // PA → le Critique du coup dans le dos OFFRE la Déviation → suspension
    fuyard.wounds = { current: 40, max: 40, base: 40 } as never;
    fuyard.engagedWith = [frappeur.id];
    frappeur.engagedWith = [fuyard.id];
    useGame.setState({
      battle: { ...useGame.getState().battle! },
      pendingDisengage: {
        moverId: fuyard.id, foeId: frappeur.id, canSacrifice: false, phase: 'fuir', atk: null, def: null, result: null,
        fuir: {
          participants: [
            { id: frappeur.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 33, netSL: 2, location: 'corps', critLocation: 'corps', damage: 6, woundsLost: 6, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: fuyard.id, kind: 'calme', interactive: true, calme: { success: false, roll: 70, target: 50, sl: -1 } },
          ],
        },
      },
    } as never);
    useGame.getState().fleeConfirm();

    const st = parKind('fleeMove')!;
    expect(st, 'la fuite a son étape de REPRISE').toBeTruthy();
    expect(stepInteraction(st)).toBe('affichage');
    expect(st.fleeMove, 'sans sa charge, `completeFlee` ne saurait plus qui fuit ni combien de Brisé').toBeTruthy();
    expect(st.fleeMove!.moverId).toBe(fuyard.id);
    expect(st.fleeMove!.foeId).toBe(frappeur.id);
    expect(st.fleeMove!.broken, 'Calme raté DR −1 → 1 + 1 États Brisés (LDB 15 l.66)').toBe(2);
    expect(st.reveal).toBeUndefined();
    expect(st.options).toBeUndefined();
    expect(st.actorId, 'la reprise appartient au FUYARD').toBe(fuyard.id);
    expect(seatOwns(useGame.getState(), 1, fuyard.id), 'COOP : le siège du frappeur ne l’acquitte pas').toBe(false);
    expect(seatOwns(useGame.getState(), 1, frappeur.id), 'prémisse : ce siège tient bien le frappeur').toBe(true);
  });

  it('le TYPE interdit à un affichage de se donner la forme d’un tirage ou d’une décision', () => {
    const base = { id: 'x', kind: 'x', label: 'x', actorId: 'a' };
    // @ts-expect-error une révélation est une FORME (dé + lignes de tirage), pas un affichage nu
    expect(() => displayStep({ ...base, reveal: { kind: 'critical', title: 't', lines: [], subjectId: 'a' } })).not.toThrow();
    // @ts-expect-error un tirage à poser passe par `tableStep` (il a son cycle et son enjeu)
    expect(() => displayStep({ ...base, table: { tableId: 't', spec: { n: 1, sides: 100 } } })).not.toThrow();
    // @ts-expect-error une décision passe par `choiceStep` (elle a un porteur et un défaut)
    expect(() => displayStep({ ...base, options: [{ key: 'k', label: 'l' }] })).not.toThrow();
  });

  it('…et le MINT les DROPPE au runtime : le type seul ne suffit pas à tenir la porte', () => {
    // Les `@ts-expect-error` ci-dessus ne mesurent que le contrôle de propriétés EXCÉDENTAIRES, qui ne
    // joue que sur un littéral écrit sur place : une valeur passée par une VARIABLE déjà élargie
    // traverse le type sans erreur. Ce que la porte garantit vraiment est ici — le mint ne recopie
    // que ce qu'il déclare, et une contrebande de forme n'atteint jamais l'étape.
    const contrebande = {
      id: 'x', kind: 'x', label: 'x', actorId: 'a',
      reveal: { kind: 'critical', title: 't', lines: [], subjectId: 'a' },
      table: { tableId: 't', spec: { n: 1, sides: 100 } },
      options: [{ key: 'k', label: 'l' }],
      target: 40,
    } as never;
    const st = displayStep(contrebande) as unknown as Record<string, unknown>;
    expect(Object.keys(st).sort(), 'l’affichage minté, et rien d’autre').toEqual(['actorId', 'id', 'kind', 'label']);
    expect(stepInteraction(st as unknown as CascadeStep), 'aucune des formes de contrebande ne prend').toBe('affichage');
  });
});

describe('#1262 lot 5b — HÔTES du store : le pending d’abord, le mint ensuite', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); });

  it('la GARDE du mint hôte mord sur `trample` : sans son pending, aucune fenêtre n’est montée', () => {
    // L'ordre « pending puis mint » n'est pas une convention d'écriture : c'est ce que la garde
    // EXIGE. Figé ici sans dépendre du nombre de suites que l'inversion ferait rougir.
    useGame.setState({ pendingTrample: null } as never);
    expect(() => hostStep(useGame.getState, { id: 'trample-jet', kind: 'trampleJet', jet: 'trample', actorId: 'x' }))
      .toThrowError(/pendingTrample/);
    useGame.setState({ pendingTrample: { attackerId: 'a', targetId: 'b', result: null } } as never);
    const st = hostStep(useGame.getState, { id: 'trample-jet', kind: 'trampleJet', jet: 'trample', actorId: 'a' });
    expect(st, 'le pending posé, le mint rend l’étape').toBeTruthy();
    expect(st!.jet).toBe('trample');
    useGame.setState({ pendingTrample: null } as never);
  });

  it('PIÉTINEMENT : `pendingTrample` est posé AVANT l’étape hôte, qui va au siège du piétineur', () => {
    // Le piétineur est tenu par l'HÔTE (c'est lui qui déclenche l'action) ; un SECOND héros appartient
    // au siège invité — la table de possession est donc réelle, et « la fenêtre est à son porteur » se
    // mesure : le siège 1 ne la tient PAS.
    const { H, E } = combat(2, 7, [1]);
    const hero = H[0];
    const cible = E[0];
    E.slice(1).forEach((e) => { (e as { dead?: boolean }).dead = true; });
    hero.pos = { x: 10, y: 10 };
    cible.pos = { x: 11, y: 10 };
    hero.size = 'grande';
    hero.advantage = 2;
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(hero.id), action: null, movementUsed: 0, acted: false } } as never);

    useGame.getState().battleTrample(cible.id);

    expect(useGame.getState().pendingTrample, 'la donnée que la fenêtre rend').not.toBeNull();
    const st = steps().find((s) => s.jet === 'trample')!;
    expect(st.id).toBe('trample-jet');
    expect(st.kind).toBe('trampleJet');
    expect(st.actorId).toBe(hero.id);
    expect(modalOwnerOf(useGame.getState()), 'la fenêtre est celle du piétineur').toBe(hero.id);
    expect(seatOwns(useGame.getState(), 1, hero.id), 'COOP : le siège invité ne tient PAS ce jet').toBe(false);
    expect(seatOwns(useGame.getState(), 1, H[1].id), 'prémisse : ce siège tient bien un héros').toBe(true);
  });

  it('DÉSENGAGEMENT partagé : la bascule REMINTE — l’étape ne porte que sa déclaration, l’owner devient partagé', () => {
    const { H } = combat(2, 7, [1]); // le FUYARD (H[1]) est tenu par le siège invité, le frappeur par l'hôte
    const fuyard = H[1];
    const frappeur = H[0];
    fuyard.pos = { x: 7, y: 10 };
    frappeur.pos = { x: 6, y: 10 };
    fuyard.engagedWith = [frappeur.id];
    frappeur.engagedWith = [fuyard.id];
    fuyard.advantage = 2;
    frappeur.advantage = 0;
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(fuyard.id), acted: false, action: null } } as never);

    startDisengage(useGame.getState, useGame.setState, fuyard);
    const avant = { ...steps()[useGame.getState().pendingCascade!.cursor] };
    expect(avant.jet).toBe('disengage');
    expect(avant.groupOwner, 'à l’ouverture, la fenêtre est celle du seul fuyard').toBeUndefined();
    expect(modalOwnerOf(useGame.getState())).toBe(fuyard.id);

    useGame.getState().disengageFlee();

    const apres = steps()[useGame.getState().pendingCascade!.cursor] as unknown as Record<string, unknown>;
    expect(apres.groupOwner, 'deux acteurs JOUÉS → moment partagé, posé par le mint').toBe(true);
    expect(modalOwnerOf(useGame.getState()), 'chacun des deux sièges voit la fenêtre où se tient SA rangée').toBe('*');
    expect(Object.keys(apres).sort(), 'une étape hôte ne porte que sa déclaration').toEqual(['actorId', 'groupOwner', 'id', 'jet', 'kind']);
    expect(apres.id).toBe(avant.id);
    expect(apres.kind).toBe(avant.kind);
    expect(apres.actorId).toBe(fuyard.id);
    expect(Object.keys(avant).filter((k) => !(k in apres)), 'aucun champ de l’étape réelle n’est perdu au remint').toEqual([]);
  });
});
