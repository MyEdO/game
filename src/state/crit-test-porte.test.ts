import { describe, it, expect } from 'vitest';
import { useGame, type BattleState } from './store';
import { avanceEtapeCascade } from './cascadeTestKit';
import { applyCriticalToTarget, openCombatEndCascade } from './combatFlow';
import { resolveCritique } from '../engine/critical';
import { runPureFlowLines } from './combatEffects';
import { testValue } from '../engine/skills';
import { addCondition } from '../engine/conditions';
import { CRITIQUE_DOCS } from '../data/criticals';
import type { Flow } from '../engine/flowCore';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import { resolveStake } from '../data';
import { stacks } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, HitLocation, Trauma } from '../engine/types';
import type { CascadeStep } from './pendings';

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

const mk = (id: string, kind: 'hero' | 'enemy'): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [], items: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, bodyShape: 'humanoide',
     traumas: [], critEntriesSuffered: [] } as unknown as Combatant);

/** Combat MINIMAL avec un héros TENU par le siège local — la cadence manuelle est la condition de
 *  surfaçage (`surfaceOf`), rien d'autre. */
function combat(hero: Combatant, enemy: Combatant): void {
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingDefense: null, pendingAttack: null, pendingDisengage: null, pendingCast: null,
    pendingCascade: null, suspendedCascades: [], pendingLogQueue: [],
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
}

const etapeTest = (): CascadeStep | undefined =>
  useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'triggeredTest');

/** Applique un Critique à `loc` sur `hero`, dé de sévérité POSÉ (`forcedRoll` = le dé NATUREL). */
function subirCritique(hero: Combatant, loc: HitLocation, deSeverite: number): void {
  const crit = resolveCritique('ldb', hero, loc, battleRng(), { forcedRoll: deSeverite });
  applyCriticalToTarget(hero, loc, true, 0, [], useGame.setState, {
    prerolled: crit, ctx: { attackerId: 'e', attackerKind: 'enemy' }, get: useGame.getState,
  });
}

describe('#1657 B3-1 — le Test d’une Blessure critique naît comme une ÉTAPE, sur le porteur', () => {
  it('(i) héros TENU, « Nez cassé » (dé 66) : une étape de Test influençable est poussée, et son enjeu se résout', () => {
    seedBattleRng(1);
    const hero = mk('h', 'hero');
    combat(hero, mk('e', 'enemy'));
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
    const hero = mk('h', 'hero');
    combat(hero, mk('e', 'enemy'));
    subirCritique(hero, 'tete', 66);

    const st = etapeTest()!;
    // Les étapes qui PRÉCÈDENT le jet (révélation du Critique) se jouent normalement — le curseur doit
    // être SUR l'étape de Test pour que son commit passe par l'applier.
    for (let i = 0; i < 10; i++) {
      const p0 = useGame.getState().pendingCascade!;
      if (p0.participants[p0.cursor]?.id === st.id) break;
      avanceEtapeCascade(useGame.getState);
    }
    // Résultat POSÉ du dehors : c'est la porte qui tranche, la conséquence n'a aucun dé propre.
    const p = useGame.getState().pendingCascade!;
    useGame.setState({
      pendingCascade: {
        ...p,
        participants: p.participants.map((s) => (s.id === st.id
          ? { ...s, result: { roll: 99, target: st.target!, success: false, sl: -6, crit: false, fumble: false } }
          : s)),
      },
    } as never);
    useGame.getState().cascadeNext();

    expect(stacks(hero, 'sonne'), 'la branche `fail` (LDB 18 l.72 : « ou gagnez l’État Sonné ») n’a pas joué').toBe(1);
  });

  it('(iii) MORSURE INVERSE — sous dé de sévérité POSÉ, l’issue n’est plus décidée par la seed', () => {
    // Sonde d'origine (design B3, 2026-09-02) : « Nez cassé », dé de sévérité posé à 66, 30 seeds du
    // RNG de combat → 2 formes d'ops distinctes. L'issue du Test se décidait donc dans le moteur, à
    // l'insu du joueur. Inverse mesuré ici : les ops rendues sont CONSTANTES, et le nœud sort intact.
    const formes = new Set<string>();
    let avecNoeud = 0;
    for (let s = 1; s <= 30; s++) {
      const crit = resolveCritique('ldb', mk('h', 'hero'), 'tete', makeRNG(s), { forcedRoll: 66 });
      formes.add(JSON.stringify(crit.ops));
      if (crit.testFlow) avecNoeud++;
    }
    expect(formes.size, 'l’issue varie encore avec la seed : un dé est resté dans le moteur').toBe(1);
    expect(avecNoeud, 'le nœud de la rangée doit sortir sur les 30 seeds').toBe(30);

    // Et, sur le chemin RÉEL, l'étape est POUSSÉE quelle que soit la seed du combat.
    for (let s = 1; s <= 30; s++) {
      seedBattleRng(s);
      const hero = mk('h', 'hero');
      combat(hero, mk('e', 'enemy'));
      subirCritique(hero, 'tete', 66);
      expect(etapeTest(), `seed ${s} : aucune étape de Test poussée`).toBeTruthy();
    }
  });

  it('(v) ENNEMI sans siège : la voie INLINE de la porte résout le Test — et le JOURNAL le porte', () => {
    // La voie inline (`resolveFlowTest`, ennemi / cadence auto) est une BRANCHE de la porte, pas une
    // exemption : c'est le SOCLE qui choisit la surface (`surfaceOf`), et le jet reste dit — le
    // journal est la seule surface d'un porteur que personne ne tient, il PORTE donc les deux lignes.
    seedBattleRng(1);
    const enemy = mk('e', 'enemy');
    combat(mk('h', 'hero'), enemy);
    subirCritique(enemy, 'tete', 66);

    expect(etapeTest(), 'un porteur sans siège ne reçoit pas de fenêtre : la voie inline tranche').toBeFalsy();
    expect(useGame.getState().pendingLogQueue.map((l) => l.line)).toEqual([
      'e — Test de Résistance Intermédiaire (+0) : 63/35 → échec (DR -3).', // valeur NUE de la porte, pas un calcul maison
      'e reçoit 1 État Sonné.', // LDB 18 l.72 — la branche `fail`, appliquée sur l'issue de la porte
    ]);
    expect(stacks(enemy, 'sonne')).toBe(1);
  });

  it('(iv) `critTrigger` — la Commotion cérébrale (LDB 18 l.74) pousse SON Test par la même porte', () => {
    seedBattleRng(1);
    const hero = mk('h', 'hero');
    // Séquelle DÉJÀ armée par une Commotion antérieure + l'État Exténué qui la garde active.
    const armee = resolveCritique('ldb', mk('h', 'hero'), 'tete', makeRNG(1), { forcedRoll: 78 })
      .traumas.find((t) => t.critTrigger)!;
    (hero as unknown as { traumas: Trauma[] }).traumas = [armee];
    hero.conditions.push({ id: 'extenue', value: 1 } as never);
    combat(hero, mk('e', 'enemy'));

    // Un critique tête SUBSÉQUENT (dé 28 « Frappe à l'oreille » : la rangée n'a pas de nœud propre).
    subirCritique(hero, 'tete', 28);

    const st = etapeTest();
    expect(st, 'le déclencheur de séquelle n’a poussé aucune fenêtre').toBeTruthy();
    expect(st!.actorId).toBe('h');
    expect(st!.difficulty).toBe('accessible'); // LDB 18 l.74 : « Test de Résistance Accessible (+20) »
    expect(resolveStake(st!.stake!).rule).toEqual({ category: 'criticalsTete', id: 'commotion-cerebrale' });
  });
});


/**
 * #1657 B3-1b — LES 28 TESTS D'AMPUTATION (LDB 18 l.237) PASSENT PAR LA MÊME PORTE.
 *
 * RAW l.237, verbatim : « À chaque fois que vous subissez une Blessure critique où il est indiqué
 * *Amputation (Difficulté)*, vous devez réussir un Test de **Résistance** (la difficulté est indiquée
 * entre parenthèses) ou gagner 1 État *À Terre*. Sur un échec (-2 DR) ou pire, vous recevez également
 * un État *Sonné*. Si vous échouez avec au moins -4 DR, gagnez un État *Inconscient*. »
 *
 * Le moteur les roulait, sur une valeur calculée à la main (Endurance + Avances de Résistance) qui
 * ignorait les États du jeteur — donc sans Chance, sans Pacte, sans Résilience. Ils naissent désormais
 * comme des étapes, et la valeur testée est celle de la PORTE (`rollLine` → `testValue`).
 */
describe('#1657 B3-1b — le Test d’AMPUTATION naît comme une étape, à la valeur de la porte', () => {
  /** Le nœud `test` d'un Flow qui EN EST un — rouge nommé sinon. */
  const noeudDeTest = (f: Flow | undefined) => {
    if (!f || f.kind !== 'test') throw new Error(`noeud test attendu, recu : ${f ? f.kind : 'rien'}`);
    return f;
  };
  const etapes = (f: Flow | undefined): Flow[] => (f && f.kind === 'seq' ? f.steps : f ? [f] : []);

  it('(vi) héros 2× Sonné, « Doigt sectionné » (dé 83) : la cible est celle de la PORTE, États compris', () => {
    seedBattleRng(1);
    const hero = mk('h', 'hero');
    addCondition(hero, 'sonne', 2); // LDB 16 l.125 : « une pénalité de -10 à tous les Tests », ×2
    combat(hero, mk('e', 'enemy'));
    subirCritique(hero, 'brasD', 83); // LDB bras 81-85 « Doigt sectionné » — Amputation (Accessible)

    const st = etapeTest();
    expect(st, 'aucune étape : le Test d’Amputation est resté silencieux au moteur').toBeTruthy();
    expect(st!.actorId).toBe('h');
    expect(st!.rollLabel).toBe('Résistance');       // l.237 — la COMPÉTENCE, jamais l'Endurance nue
    expect(st!.difficulty).toBe('accessible');
    // Endurance 35 → Niveau de Résistance 35 ; 2× Sonné = −20 ⇒ 15 (LDB 16 l.125). Une valeur calculée
    // hors de la porte (Endurance + Avances) rendrait 35 : elle ne voit aucun État.
    expect(testValue(hero, 'resistance')).toBe(15);
    expect(st!.target, 'la cible ignore les États : la valeur maison est revenue').toBe(15 + 20);
    expect(hero.traumas, 'ni plaie ni séquelle avant le jet').toEqual([]);
  });

  it('(vii) POST-RENCONTRE (l.171) : le nœud ARMÉ part par la porte à la fin du combat, jamais en silence', () => {
    seedBattleRng(1);
    const hero = mk('h', 'hero');
    const coupure = CRITIQUE_DOCS.flatMap((d) => d.entries).find((e) => e.id === 'coupure-a-l-orteil')!;
    // Marqueur ARMÉ par un critique antérieur (« Coupure à l'orteil » : « Une fois la rencontre terminée… »).
    (hero as unknown as { traumas: Trauma[] }).traumas =
      resolveCritique('ldb', mk('h', 'hero'), 'jambeD', makeRNG(1), { forcedRoll: coupure.min }).traumas;
    combat(hero, mk('e', 'enemy'));

    openCombatEndCascade(useGame.getState, useGame.setState);

    const st = etapeTest();
    expect(st, 'le Test différé s’est joué en silence : aucune fenêtre au bilan de combat').toBeTruthy();
    expect(st!.actorId).toBe('h');
    expect(st!.rollLabel).toBe('Résistance');
    expect(st!.difficulty).toBe('intermediaire'); // l.171 : le GATE, « un Test de Résistance Intermédiaire (+0) »
    expect(resolveStake(st!.stake!).rule).toEqual({ category: 'criticalsJambe', id: 'coupure-a-l-orteil' });
    expect(hero.traumas!.some((t) => t.pendingAmputation), 'le marqueur doit être CONSOMMÉ').toBe(false);
    // La cascade porte la borne de fin de combat : sans elle, sa fermeture rejouerait le bilan.
    expect(useGame.getState().pendingCascade!.combatEndBoundary).toBe(true);
  });

  it('(viii) « Coupure à l’orteil » : gate RÉUSSI = rien ; gate raté puis Test raté à −2 DR = Sonné + amputation', () => {
    seedBattleRng(1);
    const hero = mk('h', 'hero');
    const coupure = CRITIQUE_DOCS.flatMap((d) => d.entries).find((e) => e.id === 'coupure-a-l-orteil')!;
    const gate = noeudDeTest(
      resolveCritique('ldb', hero, 'jambeD', makeRNG(1), { forcedRoll: coupure.min })
        .traumas.find((t) => t.pendingAmputation)!.pendingAmputation,
    );

    // Gate RÉUSSI (l.171 : la perte n'a lieu que « sur un échec ») — aucune conséquence, pas même un État.
    const sauf = mk('h', 'hero');
    runPureFlowLines(sauf, sauf, gate.success, { sl: 3 });
    expect(sauf.traumas).toEqual([]);
    expect(stacks(sauf, 'a-terre')).toBe(0);

    // Gate RATÉ → le Test d'Amputation (l.237) ; RATÉ à −2 DR → À Terre + Sonné + la perte de l'orteil.
    const [interne, perte] = etapes(gate.fail);
    const touche = mk('h', 'hero');
    runPureFlowLines(touche, touche, noeudDeTest(interne).fail, { sl: -2 });
    runPureFlowLines(touche, touche, perte, { sl: -2 });
    expect(stacks(touche, 'a-terre')).toBe(1);
    expect(stacks(touche, 'sonne')).toBe(1);
    expect(stacks(touche, 'inconscient'), 'l’Inconscient n’arrive qu’à −4 DR').toBe(0);
    expect(touche.traumas!.some((t) => t.traumaId === 'orteil-ampute')).toBe(true);
    expect(touche.traumas!.some((t) => t.needsSurgery)).toBe(true);
  });
});
