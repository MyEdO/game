import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { fireTriggers, effectSourcesOf } from './triggeredEffects';
import { createHero } from '../engine/character';
import { addCondition, hasCondition, isOutOfAction, COND } from '../engine/conditions';
import {
  cibleEnVue,
  clearPsychOf,
  isAfflictionActive,
  psychBranchOps,
  refreshAllDefendedPsych,
  targetedTrigger,
  type PsychAffliction,
  sourceCombattant,
} from '../engine/psychology';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { spawnEnemy } from './monde/spawn';
import { emptyScene, type Scene } from './monde/scene';
import { parseWalledAscii } from './monde/asciiMap';
import { ciblePsy, estCibleType } from '../engine/psych/ciblage';
import { applyOps } from '../engine/ops';
import { psychologies } from '../data';
import { applyAttackResult } from './combatFlow';
import { sourcesPsyEnVue } from './monde/porteurs';
import type { AttackResult } from '../engine/combat';
import { seedBattleRng, battleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Héros H face à deux ennemis E et F en Ligne de Vue ; les autres ennemis du combat sont morts. */
function setup() {
  seedBattleRng(3);
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const [E, F, ...autres] = b.combatants.filter((c) => c.kind === 'ennemi');
  autres.forEach((e) => (e.dead = true));
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 11, y: 10 };
  F.pos = { x: 12, y: 11 };
  banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
  return { H, E, F };
}

const live = (id: string): Combatant => banc.getState().battle!.combatants.find((x) => x.id === id)!;
const visant = (type: 'haine' | 'animosite' | 'prejuge', cibleId: string): PsychAffliction =>
  ({ type, cible: ciblePsy.individu(cibleId), active: true });
const finDeRound = (c: Combatant) => fireTriggers(banc.getState, live(c.id), 'onRoundEnd', { rng: battleRng(), set: banc.setState });
const etat = (c: Combatant, type: string, cibleId?: string) =>
  (live(c.id).psychState ?? []).find((p) => p.type === type && (cibleId === undefined || p.cible === ciblePsy.individu(cibleId)));

describe('Fin d’une affliction ciblée en fin de Round : la Condition `cibleEnVue` de l’instance (LDB 21 l.19, l.39, l.48)', () => {
  it('Haine : la Cible morte, l’instance se DÉSACTIVE et garde son marqueur de rencontre (LDB 21 l.9, l.39)', () => {
    const { H, E } = setup();
    H.psychState = [visant('haine', E.id)];
    E.dead = true;
    finDeRound(H);
    expect(live(H.id).psychState).toHaveLength(1);
    expect(isAfflictionActive(etat(H, 'haine')!)).toBe(false);
  });

  it('Haine et Préjugé : un membre Inconscient reste en vue, l’instance continue (#3045)', () => {
    const { H, E } = setup();
    H.psychState = [visant('haine', E.id), visant('prejuge', E.id)];
    addCondition(E, COND.inconscient);
    finDeRound(H);
    expect(isAfflictionActive(etat(H, 'haine')!)).toBe(true);
    expect(isAfflictionActive(etat(H, 'prejuge')!)).toBe(true);
  });

  it('Préjugé : la Cible a quitté la rencontre, l’instance finit (LDB 21 l.48)', () => {
    const { H, E } = setup();
    H.psychState = [visant('prejuge', E.id)];
    E.outOfRencontre = true;
    finDeRound(H);
    expect(isAfflictionActive(etat(H, 'prejuge')!)).toBe(false);
  });

  it('seule l’instance dont la Cible a disparu finit : l’autre instance du même type continue', () => {
    const { H, E, F } = setup();
    H.psychState = [visant('haine', E.id), visant('haine', F.id)];
    E.dead = true;
    finDeRound(H);
    expect(isAfflictionActive(etat(H, 'haine', E.id)!)).toBe(false);
    expect(isAfflictionActive(etat(H, 'haine', F.id)!)).toBe(true);
  });

  it('Animosité : un adversaire déclaré en vue est hostile, l’instance continue (LDB 85 l.383 ; Q11 A, #3045)', () => {
    const { H, E } = setup();
    H.psychState = [visant('animosite', E.id)];
    finDeRound(H);
    expect(isAfflictionActive(etat(H, 'animosite')!)).toBe(true);
  });

  it('Animosité : la Cible Brisée s’est calmée, l’instance finit (LDB 21 l.19 ; #3045)', () => {
    const { H, E } = setup();
    H.psychState = [visant('animosite', E.id)];
    addCondition(E, COND.brise);
    finDeRound(H);
    expect(isAfflictionActive(etat(H, 'animosite')!)).toBe(false);
  });

  it('une instance INACTIVE n’émet aucun effet (marqueur seul)', () => {
    const { H, E } = setup();
    H.psychState = [{ ...visant('haine', E.id), active: false }];
    expect(effectSourcesOf(live(H.id)).filter((s) => s.key.startsWith('psy:'))).toEqual([]);
  });
});

describe('Fin d’une affliction en gagnant un État (`onGainCondition`, LDB 21 l.19, l.35, l.39, l.48)', () => {
  it('Sonné : finit Animosité et Préjugé, pas la Haine (LDB 21 l.39)', () => {
    const { H, E } = setup();
    H.psychState = [visant('haine', E.id), visant('animosite', E.id), visant('prejuge', E.id)];
    addCondition(live(H.id), COND.sonne);
    expect(isAfflictionActive(etat(H, 'haine')!)).toBe(true);
    expect(isAfflictionActive(etat(H, 'animosite')!)).toBe(false);
    expect(isAfflictionActive(etat(H, 'prejuge')!)).toBe(false);
  });

  it('Inconscient : finit la Haine (LDB 21 l.39)', () => {
    const { H, E } = setup();
    H.psychState = [visant('haine', E.id)];
    addCondition(live(H.id), COND.inconscient);
    expect(isAfflictionActive(etat(H, 'haine')!)).toBe(false);
  });

  it.each([COND.sonne, COND.inconscient])('Frénésie : %s la finit, et le porteur gagne Exténué (LDB 21 l.35)', (gagne) => {
    const { H } = setup();
    H.psychState = [{ type: 'frenesie' }];
    addCondition(live(H.id), gagne);
    expect(etat(H, 'frenesie')).toBeUndefined();
    expect(hasCondition(live(H.id), COND.extenue)).toBe(true);
  });
});

describe('cibleEnVue — verdict pur d’une instance parmi les combattants en vue (#3045)', () => {
  it('un neutre ni Engagé ni attaquant est présent mais calmé ; Engagé avec le porteur, il est hostile', () => {
    const { H, E } = setup();
    E.kind = 'pnj';
    const animosite = visant('animosite', E.id);
    expect(cibleEnVue(H, animosite, [sourceCombattant(E)])).toEqual({ present: true, hostile: false });
    E.engagedWith = [H.id];
    expect(cibleEnVue(H, animosite, [sourceCombattant(E)])).toEqual({ present: true, hostile: true });
  });

  it('un membre Inconscient est présent sans être hostile ; un mort n’est plus présent', () => {
    const { H, E } = setup();
    const haine = visant('haine', E.id);
    addCondition(E, COND.inconscient);
    expect(cibleEnVue(H, haine, [sourceCombattant(E)])).toEqual({ present: true, hostile: false });
    E.dead = true;
    expect(cibleEnVue(H, haine, [sourceCombattant(E)])).toEqual({ present: false, hostile: false });
  });
});

/** L'op `endPsych` qui finit l'entrée `id` : son instance courante, ou son type. */
const finitLEntree = (v: unknown, id: string): boolean => {
  if (Array.isArray(v)) return v.some((x) => finitLEntree(x, id));
  if (!v || typeof v !== 'object') return false;
  const o = v as { op?: unknown; instance?: unknown; type?: { id?: unknown } };
  if (o.op === 'endPsych' && (o.instance === 'courante' || o.type?.id === id)) return true;
  return Object.values(v).some((x) => finitLEntree(x, id));
};

describe('Inventaire : toute affliction ciblée a un chemin de fin (LDB 21 l.9)', () => {
  const ciblees = psychologies.filter((p) => estCibleType(p.id));
  /** Une affliction naît de l'échec de son PROPRE Test ; une entrée sans Test (Phobie, `targetCauses`) n'en pose aucune. */
  const afflictions = ciblees.filter((p) => p.test !== undefined);
  /** La chute de la source d'une instance active, telle que la jouent les chemins de chute (`cloreLeCoup`). */
  const finitALaChuteDeSaSource = (id: string): boolean => {
    const source = combattantDeTest({ id: 'src', dead: true });
    const porteur = combattantDeTest({ id: 'h', psychState: [{ type: id as PsychAffliction['type'], cible: ciblePsy.individu('src'), sourceId: 'src', active: true }] });
    clearPsychOf([porteur, source], source.id);
    refreshAllDefendedPsych([porteur, source]);
    return !(porteur.psychState ?? []).some(isAfflictionActive);
  };

  it('chaque affliction ciblée finit par sa donnée (`endPsych`) ou à la chute de sa source (`clearPsychOf` ; #3045)', () => {
    expect(afflictions.length).toBeGreaterThan(0);
    const sansFin = afflictions.filter((p) => !finitLEntree(p.effects, p.id) && !finitALaChuteDeSaSource(p.id)).map((p) => p.id);
    expect(sansFin).toEqual([]);
  });

  it('une entrée ciblée écartée n’a ni Test, ni résolution, ni effet : elle ne devient jamais affliction', () => {
    const ecartees = ciblees.filter((p) => !afflictions.includes(p));
    for (const p of ecartees) expect({ id: p.id, test: p.test, resolution: p.resolution, effects: p.effects }).toEqual({ id: p.id, test: undefined, resolution: undefined, effects: undefined });
  });
});

const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] } as unknown as Weapon;
const coupMortel = (blessures: number): AttackResult => ({
  hit: true, attackerRoll: 41, netSL: 2, location: 'corps', damage: blessures, woundsLost: blessures,
  critical: false, advantageTo: 'attaquant', defenderDefeated: false, log: 'touche',
}) as AttackResult;

describe('Famille défense, telle qu’avant #1463 : fin à la chute (LDB 21 l.75, l.81 ; #3045)', () => {
  it('l’orphelin A menacé la déclenche ; A tombe, B et C restent : la Camaraderie est levée', () => {
    const { H, E: A, F: B } = setup();
    const C = banc.getState().battle!.combatants.filter((c) => c.kind === 'ennemi')[2];
    C.dead = false;
    C.pos = { x: 12, y: 9 };
    for (const o of [A, B, C]) o.groups = ['criminel'];
    const menace = spawnEnemy({ ref: 'mutant' }, 'menace', { x: 11, y: 11 });
    banc.getState().battle!.combatants.push(menace);
    menace.engagedWith = [A.id];
    A.engagedWith = [menace.id];
    H.psychTraits = [{ type: 'camaraderie', cible: ciblePsy.groupe('criminel') }];
    const b = banc.getState().battle!;
    const declenche = targetedTrigger(live(H.id), sourcesPsyEnVue(b, banc.getState().scene!, live(H.id), (v) => !isOutOfAction(v)));
    expect(declenche).toMatchObject({ type: 'camaraderie', sourceId: A.id });
    applyOps(live(H.id), psychBranchOps({ kind: declenche!.type, cible: declenche!.cible, sourceId: declenche!.sourceId, indice: 0 }, { success: false }), { idNeuf: idsDeTest, rng: battleRng() });
    expect(isAfflictionActive(etat(H, 'camaraderie')!)).toBe(true);

    applyAttackResult(banc.getState, banc.setState, live(menace.id), live(A.id), hache, coupMortel(live(A.id).wounds.current + 30));
    if (banc.getState().pendingCascade) { banc.getState().jetLancer('cascade'); banc.getState().fenetreFermer('cascade'); }
    expect(isOutOfAction(live(A.id))).toBe(true);
    expect([B, C].map((o) => isOutOfAction(live(o.id)))).toEqual([false, false]);
    expect(etat(H, 'camaraderie')).toBeUndefined();
  });

  it('Amour : le seul aimé tombe sous un coup, l’Amour se désactive sur-le-champ (LDB 21 l.75)', () => {
    const { H, E: aime, F: menace } = setup();
    H.psychState = [{ type: 'amour', cible: ciblePsy.individu(aime.id), sourceId: aime.id, active: true }];
    applyAttackResult(banc.getState, banc.setState, live(menace.id), live(aime.id), hache, coupMortel(live(aime.id).wounds.current + 30));
    if (banc.getState().pendingCascade) { banc.getState().jetLancer('cascade'); banc.getState().fenetreFermer('cascade'); }
    expect(isOutOfAction(live(aime.id))).toBe(true);
    expect(etat(H, 'amour'), 'désactivée, pas levée').toMatchObject({ type: 'amour', active: false });
  });
});

/** Couloir de 3 cases, un mur plein entre la 2ᵉ et la 3ᵉ. */
const COULOIR = ['+-+-+-+', '|. .|.|', '+-+-+-+'];

describe('Fin en fin de Round : la Ligne de Vue de la scène, murs compris (LDB 21 l.39 ; #3045)', () => {
  const dansLeCouloir = (xCible: number) => {
    const { H, E, F } = setup();
    const { w, h, tiles, walls } = parseWalledAscii(COULOIR, 'plancher', {});
    banc.setState({ scene: { ...emptyScene('couloir', w, h), layers: [{ z: 0, tiles }], walls } as unknown as Scene });
    F.dead = true;
    H.pos = { x: 0, y: 0 };
    E.pos = { x: xCible, y: 0 };
    H.psychState = [visant('haine', E.id)];
    finDeRound(H);
    return isAfflictionActive(etat(H, 'haine')!);
  };

  it('le seul membre, vivant et présent, derrière un mur : la Haine finit', () => {
    expect(dansLeCouloir(2)).toBe(false);
  });

  it('le même membre en vue : la Haine continue', () => {
    expect(dansLeCouloir(1)).toBe(true);
  });
});

describe('Frénésie entrée déjà Sonné : finie au début du Tour (LDB 21 l.35)', () => {
  it('l’État déjà tenu ne se « gagne » pas ; le début du Tour finit la Frénésie, et le porteur gagne Exténué', () => {
    const { H } = setup();
    addCondition(live(H.id), COND.sonne);
    live(H.id).psychState = [{ type: 'frenesie' }];
    fireTriggers(banc.getState, live(H.id), 'onTurnStart', { rng: battleRng(), set: banc.setState });
    expect(etat(H, 'frenesie')).toBeUndefined();
    expect(hasCondition(live(H.id), COND.extenue)).toBe(true);
  });
});
