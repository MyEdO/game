import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { avanceEtapeCascade, draineEtapes } from './cascade.testkit';
import { applyAttackResult, applyCriticalToTarget, openCombatEndCascade } from './combatFlow';
import type { AttackResult } from '../engine/combat';
import { resolveCritique } from '../engine/critical';
import { testValue } from '../engine/skills';
import { addCondition, stacks } from '../engine/conditions';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import { resolveStake } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, HitLocation, Trauma, Weapon } from '../engine/types';
import type { CascadeStep } from './pendings';
import { chargerLaSave, exporterLaSauvegarde, lireSave, refusDeSauvegarde, snapshotSave } from './persistance/save';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { avecSequelles } from '../engine/trauma';
import { actorIn } from './monde/combatants';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc({ desFixes: true }); });

/**
 * #1657 B3-1 — LE TEST D'UNE BLESSURE CRITIQUE PASSE PAR LA PORTE.
 *
 * Doctrine des jets (utilisateur 2026-08-24, `user-doctrine-forme-canonique-unique-jets`) : « A partir
 * du moment ou je dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" si je suis a
 * l'initiative, que je le subit, face a un adversaire ou face a ... une maladie ».
 *
 * Le Test que la rangée exige (LDB 18 l.72 « Réussissez un Test de Résistance Intermédiaire (+0), ou
 * gagnez l'État Sonné ») était joué DANS le moteur, avec le RNG du combat, à l'intérieur de la fenêtre
 * du d100 de sévérité — donc sans Chance, sans Pacte, sans Résilience, et sans les États du jeteur.
 * Il naît désormais comme une ÉTAPE, et c'est le socle (`resolveFlowTest`) qui décide de sa surface.
 */

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const POINGS = { label: 'Poings', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as unknown as Weapon;

const mk = (id: string, kind: 'heros' | 'ennemi'): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [], items: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: blessuresDeBase(18),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, bodyShape: 'humanoide',
     traumas: [], critEntriesSuffered: [] }) as unknown as Combatant);

/** Combat MINIMAL avec un héros TENU par le siège local — la cadence manuelle est la condition de
 *  surfaçage (`surfaceOf`), rien d'autre. */
function combat(hero: Combatant, enemy: Combatant): void {
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingDisengage: null, pendingCast: null,
    pendingCascade: null, suspendedCascades: [], pendingLogQueue: [],
    net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
}

const etapeTest = (): CascadeStep | undefined =>
  banc.getState().pendingCascade?.participants.find((s) => s.kind === 'testDeclenche');

/** Applique un Critique à `loc` sur `hero`, dé de sévérité POSÉ (`forcedRoll` = le dé NATUREL). */
function subirCritique(hero: Combatant, loc: HitLocation, deSeverite: number): void {
  const crit = resolveCritique('ldb', hero, loc, battleRng(), { forcedRoll: deSeverite });
  applyCriticalToTarget(hero, loc, 0, [], banc.setState, {
    prerolled: crit, ctx: { attackerId: 'e', attackerKind: 'ennemi' }, get: banc.getState,
  });
}

describe('#1657 B3-1 — le Test d’une Blessure critique naît comme une ÉTAPE, sur le porteur', () => {
  it('(i) héros TENU, « Nez cassé » (dé 66) : une étape de Test influençable est poussée, et son enjeu se résout', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'tete', 66);

    const st = etapeTest();
    expect(st, 'aucune étape de Test : le jet de la rangée est resté silencieux').toBeTruthy();
    expect(st!.actorId, 'la fenêtre appartient au porteur qui subit').toBe('h');
    expect(st!.rollLabel).toBe('Résistance'); // LDB 18 l.72 — la COMPÉTENCE, pas l'Endurance nue
    expect(st!.target, 'la cible du jet est calculée par le monteur canonique').toBeGreaterThan(0);
    expect(st!.result, 'l’étape est OUVERTE : aucun dé n’est encore tombé').toBeFalsy();

    // L'enjeu descend à la RANGÉE tirée (fiche « Nez cassé »), jamais au chapitre des Critiques.
    const enjeu = resolveStake(st!.stake!);
    expect(enjeu.rule).toEqual({ category: 'criticalsTete', id: 'nez-casse' });

    // L'effet IMMÉDIAT de la rangée, lui, est déjà appliqué (LDB 18 l.72 : « Gagnez 2 États Hémorragique »).
    expect(stacks(hero, 'hemorragique')).toBe(2);
    expect(stacks(hero, 'sonne'), 'l’issue du Test n’est pas tranchée avant le jet').toBe(0);
  });

  it('(ii) la branche `fail` s’applique sur un résultat INJECTÉ dans l’étape (jamais tiré au moteur)', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'tete', 66);

    const st = etapeTest()!;
    // Les étapes qui PRÉCÈDENT le jet (révélation du Critique) se jouent normalement — le curseur doit
    // être SUR l'étape de Test pour que son commit passe par l'applier.
    for (let i = 0; i < 10; i++) {
      const p0 = banc.getState().pendingCascade!;
      if (p0.participants[p0.cursor]?.id === st.id) break;
      avanceEtapeCascade(banc.getState);
    }
    // Résultat POSÉ du dehors : c'est la porte qui tranche, la conséquence n'a aucun dé propre.
    const p = banc.getState().pendingCascade!;
    banc.setState({
      pendingCascade: {
        ...p,
        participants: p.participants.map((s) => (s.id === st.id
          ? { ...s, result: { roll: 99, target: st.target!, success: false, sl: -6, crit: false, fumble: false } }
          : s)),
      },
    } as never);
    banc.getState().jetValider('cascade');

    expect(stacks(hero, 'sonne'), 'la branche `fail` (LDB 18 l.72 : « ou gagnez l’État Sonné ») n’a pas joué').toBe(1);
  });

  it('(iii) MORSURE INVERSE — sous dé de sévérité POSÉ, l’issue n’est plus décidée par la seed', () => {
    // Sonde d'origine (design B3, 2026-09-02) : « Nez cassé », dé de sévérité posé à 66, 30 seeds du
    // RNG de combat → 2 formes d'ops distinctes. L'issue du Test se décidait donc dans le moteur, à
    // l'insu du joueur. Inverse mesuré ici : les ops rendues sont CONSTANTES, et le nœud sort intact.
    const formes = new Set<string>();
    let avecNoeud = 0;
    for (let s = 1; s <= 30; s++) {
      const crit = resolveCritique('ldb', mk('h', 'heros'), 'tete', makeRNG(s), { forcedRoll: 66 });
      formes.add(JSON.stringify(crit.ops));
      if (crit.testFlow) avecNoeud++;
    }
    expect(formes.size, 'l’issue varie encore avec la seed : un dé est resté dans le moteur').toBe(1);
    expect(avecNoeud, 'le nœud de la rangée doit sortir sur les 30 seeds').toBe(30);

    // Et, sur le chemin RÉEL, l'étape est POUSSÉE quelle que soit la seed du combat.
    for (let s = 1; s <= 30; s++) {
      seedBattleRng(s);
      const hero = mk('h', 'heros');
      combat(hero, mk('e', 'ennemi'));
      subirCritique(hero, 'tete', 66);
      expect(etapeTest(), `seed ${s} : aucune étape de Test poussée`).toBeTruthy();
    }
  });

  it('(v) ENNEMI sans siège : la voie INLINE de la porte résout le Test — et le JOURNAL le porte', () => {
    // La voie inline (`resolveFlowTest`, ennemi / cadence auto) est une BRANCHE de la porte, pas une
    // exemption : c'est le SOCLE qui choisit la surface (`surfaceOf`), et le jet reste dit — le
    // journal est la seule surface d'un porteur que personne ne tient, il PORTE donc les deux lignes.
    seedBattleRng(1);
    const enemy = mk('e', 'ennemi');
    combat(mk('h', 'heros'), enemy);
    subirCritique(enemy, 'tete', 66);

    expect(etapeTest(), 'un porteur sans siège ne reçoit pas de fenêtre : la voie inline tranche').toBeFalsy();
    expect(banc.getState().pendingLogQueue.map((l) => l.line)).toEqual([
      'e — Test de Résistance Intermédiaire (+0) : 63/35 → échec (DR -3).', // valeur NUE de la porte, pas un calcul maison
      'e reçoit 1 État Sonné.', // LDB 18 l.72 — la branche `echec`, appliquée sur l'issue de la porte
    ]);
    expect(stacks(enemy, 'sonne')).toBe(1);
  });

  it('(iv) `critTrigger` — la Commotion cérébrale (LDB 18 l.74) pousse SON Test par la même porte', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    // Séquelle DÉJÀ armée par une Commotion antérieure + l'État Exténué qui la garde active.
    const armee = resolveCritique('ldb', mk('h', 'heros'), 'tete', makeRNG(1), { forcedRoll: 78 })
      .traumas.find((t) => t.critTrigger)!;
    (hero as unknown as { traumas: Trauma[] }).traumas = avecSequelles([], [armee]);
    hero.conditions.push({ id: 'extenue', value: 1 } as never);
    combat(hero, mk('e', 'ennemi'));

    // Un critique tête SUBSÉQUENT (dé 28 « Frappe à l'oreille » : la rangée n'a pas de nœud propre).
    subirCritique(hero, 'tete', 28);

    const st = etapeTest();
    expect(st, 'le déclencheur de séquelle n’a poussé aucune fenêtre').toBeTruthy();
    expect(st!.actorId).toBe('h');
    expect(st!.difficulty).toBe('accessible'); // LDB 18 l.74 : « Test de Résistance Accessible (+20) »
    expect(resolveStake(st!.stake!).rule).toEqual({ category: 'criticalsTete', id: 'commotion-cerebrale' });
  });
});


const etapeCourante = (): CascadeStep | undefined => {
  const cascade = banc.getState().pendingCascade;
  return cascade?.participants[cascade.cursor];
};

function attendreLeTestDe(entryId: string): CascadeStep {
  for (let i = 0; i < 10; i++) {
    const etape = etapeCourante();
    if (!etape) break;
    if (etape.kind === 'testDeclenche' && etape.stake && resolveStake(etape.stake).rule?.id === entryId) return etape;
    avanceEtapeCascade(banc.getState);
  }
  throw new Error(`Aucun Test de la rangée « ${entryId} » dans la cascade.`);
}

function relireLaSauvegarde(): void {
  const json = exporterLaSauvegarde(snapshotSave(banc.getState(), '2512-01-01'));
  const lue = lireSave(json);
  if (typeof lue === 'string') throw new Error(lue);
  banc.setState(chargerLaSave(lue).etat);
}

const porteur = () => actorIn(banc.getState(), 'h')!;
const orteilsPerdus = () => porteur().traumas?.filter((t) => t.traumaId === 'orteil-ampute') ?? [];
const plaies = () => porteur().traumas?.filter((t) => t.needsSurgery) ?? [];

// LDB 18 l.121,171,180,237–239.
describe('#1675 — le Flow de la rangée passe par la porte et reprend en ordre', () => {
  it.each(['en combat', 'hors combat'])('Doigt sectionné %s : la perte du côté touché précède l’unique Test de plaie', (milieu) => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    addCondition(hero, 'sonne', 2);
    if (milieu === 'en combat') combat(hero, mk('e', 'ennemi'));
    else banc.setState({ party: [hero], scene: testScene() });
    subirCritique(hero, 'brasG', 83);

    const test = attendreLeTestDe('doigt-sectionne');
    expect(test).toMatchObject({ actorId: 'h', rollLabel: 'Résistance', difficulty: 'accessible' });
    expect(test.target).toBe(testValue(hero, { skill: { id: 'resistance' } }) + 20);
    expect(test.target).toBe(35);
    expect(porteur().traumas).toEqual(expect.arrayContaining([
      expect.objectContaining({ traumaId: 'doigt-ampute', location: 'brasG', count: 1 }),
      expect.objectContaining({ needsSurgery: true, location: 'brasG' }),
    ]));

    avanceEtapeCascade(banc.getState, () => 7);
    expect(draineEtapes(banc.getState).filter((s) => s.kind === 'testDeclenche')).toEqual([]);
    expect(stacks(porteur(), 'sonne')).toBe(2);
    expect(stacks(porteur(), 'a-terre')).toBe(0);
    expect(porteur().traumas?.filter((t) => t.traumaId === 'doigt-ampute')).toMatchObject([{ location: 'brasG', count: 1 }]);
  });

  it('Main mutilée : les deux Tests à −20 ont chacun leur rôle', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'brasG', 95);

    const rangee = attendreLeTestDe('main-mutilee');
    expect(rangee).toMatchObject({ label: 'Résistance', difficulty: 'difficile' });
    avanceEtapeCascade(banc.getState, () => 7);

    const plaie = attendreLeTestDe('main-mutilee');
    expect(plaie).toMatchObject({ label: 'Plaie d’amputation', difficulty: 'difficile' });
    expect(porteur().traumas).toEqual(expect.arrayContaining([
      expect.objectContaining({ traumaId: 'main-bras-ampute', location: 'brasG' }),
    ]));
  });

  it('Main mutilée d’un ennemi sans siège : le journal nomme le Test de plaie et dit l’amputation en une ligne (#4911)', () => {
    seedBattleRng(1);
    const enemy = mk('e', 'ennemi');
    combat(mk('h', 'heros'), enemy);
    subirCritique(enemy, 'brasG', 95);
    expect(banc.getState().pendingLogQueue.map((l) => l.line)).toEqual([
      'e — Test de Résistance Difficile (−20) : 63/15 → échec (DR -5).',
      'e reçoit 1 État Sonné.',
      'e reçoit 1 État À Terre.',
      'e : Amputation et Main/bras amputé (Bras gauche).',
      'e — Test de Résistance (Plaie d’amputation) Difficile (−20) : 1/5 → réussi (DR +1).',
    ]);
  });

  it('Main mutilée d’un ennemi sans siège, par le coup : touche, Critique, ses conséquences en `detail`, puis « hors de combat » (#4911)', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    const enemy = mk('e', 'ennemi');
    enemy.wounds.current = 2;
    enemy.important = true; // hors Mort subite : LDB 18 l.46
    combat(hero, enemy);
    const crit = resolveCritique('ldb', enemy, 'brasG', battleRng(), { forcedRoll: 95 });
    const coup: AttackResult = { hit: true, attackerRoll: 33, netSL: 3, location: 'brasG', damage: 20, woundsLost: 20, critical: false, advantageTo: null, defenderDefeated: false, log: 'h touche e.' };
    applyAttackResult(banc.getState, banc.setState, hero, enemy, POINGS, coup, { critiques: [{ crit, deviation: 'subir' }] });
    const journal = banc.getState().battle!.log.map(({ kind, text }) => ({ kind, text }));
    const critique = journal.findIndex((e) => e.text === 'Blessure critique (Bras gauche) — Main mutilée.');
    const test = journal.findIndex((e) => e.text === 'e — Test de Résistance Difficile (−20) : 63/15 → échec (DR -5).');
    expect(journal[0]).toEqual({ kind: 'attaque', text: 'h touche e.' });
    expect(journal[critique]?.kind).toBe('critique');
    expect(test, 'le Test du Critique suit sa ligne').toBeGreaterThan(critique);
    expect(journal.slice(test, test + 6)).toEqual([
      { kind: 'detail', text: 'e — Test de Résistance Difficile (−20) : 63/15 → échec (DR -5).' },
      { kind: 'detail', text: 'e reçoit 1 État Sonné.' },
      { kind: 'detail', text: 'e reçoit 1 État À Terre.' },
      { kind: 'detail', text: 'e : Amputation et Main/bras amputé (Bras gauche).' },
      { kind: 'detail', text: 'e — Test de Résistance (Plaie d’amputation) Difficile (−20) : 1/5 → réussi (DR +1).' },
      { kind: 'mort', text: 'e est mis hors de combat !' },
    ]);
  });

  it('Coupure à l’orteil : le report survit à la save et une réussite écarte le Test de plaie', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'jambeG', 48);
    expect(etapeTest()).toBeUndefined();
    expect(orteilsPerdus()).toEqual([]);
    expect(plaies()).toEqual([]);
    expect(stacks(porteur(), 'hemorragique')).toBe(1);
    draineEtapes(banc.getState);
    relireLaSauvegarde();

    openCombatEndCascade(banc.getState, banc.setState);
    const gate = attendreLeTestDe('coupure-a-l-orteil');
    expect(gate).toMatchObject({ actorId: 'h', rollLabel: 'Résistance', difficulty: 'intermediaire' });
    expect(resolveStake(gate.stake!).rule).toEqual({ category: 'criticalsJambe', id: 'coupure-a-l-orteil' });
    expect(porteur().traumas?.some((t) => t.pendingAmputation)).toBe(false);
    expect(banc.getState().pendingCascade!.combatEndBoundary).toBe(true);

    avanceEtapeCascade(banc.getState, () => 7);
    expect(draineEtapes(banc.getState).filter((s) => s.kind === 'testDeclenche' && s.stake
      && resolveStake(s.stake).rule?.id === 'coupure-a-l-orteil')).toEqual([]);
    expect(orteilsPerdus()).toEqual([]);
    expect(plaies()).toEqual([]);
    expect(stacks(porteur(), 'a-terre')).toBe(0);
  });

  it('Coupure à l’orteil : l’échec du Test reporté pose un orteil perdu avant la plaie', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'jambeG', 48);
    draineEtapes(banc.getState);
    openCombatEndCascade(banc.getState, banc.setState);

    attendreLeTestDe('coupure-a-l-orteil');
    avanceEtapeCascade(banc.getState, () => 93);
    const plaie = attendreLeTestDe('coupure-a-l-orteil');
    expect(plaie.difficulty).toBe('accessible');
    expect(orteilsPerdus()).toMatchObject([{ location: 'jambeG', count: 1 }]);
    expect(plaies()).toMatchObject([{ location: 'jambeG' }]);
    expect(stacks(porteur(), 'a-terre')).toBe(0);

    avanceEtapeCascade(banc.getState, () => 78);
    expect(stacks(porteur(), 'a-terre')).toBe(1);
    expect(stacks(porteur(), 'sonne')).toBe(1);
    expect(stacks(porteur(), 'inconscient')).toBe(0);
    expect(orteilsPerdus()).toMatchObject([{ location: 'jambeG', count: 1 }]);
  });

  it('Pied écrasé : la réussite du premier +20 écarte la perte et laisse l’échéance de Chirurgie', () => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'jambeG', 92);

    const gate = attendreLeTestDe('pied-ecrase');
    expect(gate).toMatchObject({ rollLabel: 'Résistance', difficulty: 'accessible' });
    expect(orteilsPerdus()).toEqual([]);
    expect(plaies()).toMatchObject([{ location: 'jambeG', amputateAfterDays: expect.any(Number) }]);
    expect(stacks(porteur(), 'hemorragique')).toBe(2);
    avanceEtapeCascade(banc.getState, () => 7);
    expect(draineEtapes(banc.getState).filter((s) => s.kind === 'testDeclenche')).toEqual([]);
    expect(orteilsPerdus()).toEqual([]);
    expect(plaies()).toMatchObject([{ location: 'jambeG', amputateAfterDays: expect.any(Number) }]);
    expect(stacks(porteur(), 'a-terre')).toBe(0);
  });

  it.each([
    { jet: 58, dr: 0, unites: 1, horsCombat: false },
    { jet: 84, dr: -3, unites: 4, horsCombat: true },
  ])('Pied écrasé : une perte de $unites au premier +20 (DR $dr) survit à la reprise et au succès de la plaie', ({ jet, dr, unites, horsCombat }) => {
    seedBattleRng(1);
    const hero = mk('h', 'heros');
    if (horsCombat) banc.setState({ party: [hero], scene: testScene() });
    else combat(hero, mk('e', 'ennemi'));
    subirCritique(hero, 'jambeG', 92);

    const get = banc.getState;
    const gate = attendreLeTestDe('pied-ecrase');
    expect(gate).toMatchObject({ label: 'Perte de l’orteil', difficulty: 'accessible', target: 55 });
    get().jetLancer('cascade', gate.id);
    get().jetImposerLeResultat('cascade', jet, gate.id);
    expect(etapeCourante()?.result).toMatchObject({ roll: jet, success: false, sl: dr });
    get().jetValider('cascade');
    const plaie = attendreLeTestDe('pied-ecrase');
    expect(plaie).toMatchObject({ label: 'Plaie d’amputation', difficulty: 'accessible' });
    expect(orteilsPerdus()).toMatchObject([{ location: 'jambeG', count: unites }]);
    expect(plaies()).toMatchObject([{ location: 'jambeG', amputateAfterDays: expect.any(Number) }]);
    expect(stacks(porteur(), 'a-terre')).toBe(1);
    expect(stacks(porteur(), 'sonne')).toBe(0);

    if (horsCombat) expect(refusDeSauvegarde(banc.getState(), 0)).toBeNull();
    relireLaSauvegarde();
    const reprise = attendreLeTestDe('pied-ecrase');
    expect(reprise).toMatchObject({ id: plaie.id, label: plaie.label, stake: plaie.stake });
    expect(orteilsPerdus()).toMatchObject([{ location: 'jambeG', count: unites }]);

    avanceEtapeCascade(banc.getState, () => 7);
    expect(draineEtapes(banc.getState).filter((s) => s.kind === 'testDeclenche')).toEqual([]);
    expect(orteilsPerdus()).toMatchObject([{ location: 'jambeG', count: unites }]);
    expect(plaies()).toMatchObject([{ location: 'jambeG', amputateAfterDays: expect.any(Number) }]);
    expect(stacks(porteur(), 'a-terre')).toBe(1);
    expect(stacks(porteur(), 'sonne')).toBe(0);
    expect(stacks(porteur(), 'inconscient')).toBe(0);
  });
});
