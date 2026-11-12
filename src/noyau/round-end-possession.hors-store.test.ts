/**
 * #1262 V1 lot 2 — POSSESSION de l'entretien de FIN DE ROUND. Le franchissement de Round est un circuit
 * à DEUX temps, dont les prédicats doivent rester le MIROIR l'un de l'autre :
 *   (1) les hooks `roundBoundary` (`roundHooks`) + le dispatcher d'effets déclenchés
 *       (`applyTriggeredEffects`, voie `deferInteractiveTest`) résolvent INLINE ce que personne ne tient ;
 *   (2) `openRoundEndCascade` → `collectHeroRoundEndUpkeep` COLLECTE en étapes influençables ce qu'un
 *       siège humain tient.
 * Aucun des deux côtés ne lit `humanControlled` (affordance LOCALE — « qui a la main devant CET
 * écran ») : chez l'hôte, le héros d'un INVITÉ est collecté, ses Tests d'entretien (Résistance à
 * l'Empoisonné, perte de sang AA, effort soutenu, prolongation de sort) deviennent des étapes à son siège
 * et son opt-in de fin de Round (« Vous pouvez… ») lui est offert. `surfaceOf` (`rollSeam`) est
 * SEAT-AGNOSTIQUE : le porteur d'un autre siège surface aussi.
 *
 * Les DEUX temps sont joués ici dans l'ordre RÉEL (hooks PUIS collecte), sur le harnais à deux sièges
 * (#1262 B7) : en SOLO les deux prédicats coïncident (`ownsLocal` vrai pour tous), la régression y est
 * invisible. Chaque cas vérifie l'EXCLUSIVITÉ : rien n'a été résolu inline ET l'étape existe (ni perdu, ni
 * doublé).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { openRoundEndCascade } from './combatFlow';
import { runCombatHooks } from './combatHooks';
import { collectHeroRoundEndUpkeep } from './combat/roundHooks';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { addCondition, stacks, hasCondition, COND } from '../engine/conditions';
import { testValue } from '../engine/skills';
import { setRule } from '../engine/policy';
import { surfaceOf, rollSansPilote } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { ownsLocal, humanControlled } from './netOwnership';
import { seatOwns } from './sieges';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const NET0 = initialNet();
const g = () => banc.getState();

/** Monte un combat réel, puis pose les sièges : HÔTE au siège 0, le héros appartient au siège 1 (invité). */
function setupCoop(withTalent = false): Combatant {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  if (withTalent) hero.talents = [...hero.talents, { talentId: 'controle-de-la-frenesie', times: 1 }];
  banc.setState({ party: [hero] });
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
  enemies.slice(1).forEach((e) => (e.dead = true));
  H.pos = { x: 10, y: 10 };
  enemies[0].pos = { x: 30, y: 30 }; // loin : ni Peur de Taille ni Ligne de Vue
  banc.setState({ battle: { ...b }, pendingCascade: null, suspendedCascades: [] } as never);
  banc.setState({ net: { ...NET0, mode: 'hote', mySeat: 0, ownership: { [H.id]: 1 }, slots: [0, 1, 0, 0] } } as never);
  return H;
}

/** Le franchissement de Round RÉEL : hooks `onRoundEnd` (voie inline) PUIS ouverture de la cascade (voie collectée). */
function franchitLeRound(): void {
  runCombatHooks('onRoundEnd', { get: g, set: banc.setState, battle: g().battle!, sink: () => {} } as never);
  openRoundEndCascade(g, banc.setState);
}

const etapes = () => g().pendingCascade?.participants ?? [];

describe('#1262 lot 2 — l’entretien de fin de Round du héros d’un INVITÉ ne se roule pas chez l’hôte', () => {
  it('les deux prédicats DIVERGENT sur ce harnais — c’est l’énoncé du fix (en solo ils coïncident)', () => {
    const H = setupCoop();
    expect({
      ownsLocal: ownsLocal(g(), H.id),
      humanControlled: humanControlled(g(), H),
      surfaceOf: surfaceOf(g, H.id),
    }).toEqual({ ownsLocal: false, humanControlled: false, surfaceOf: true });
  });

  it('Empoisonné (LDB 16 l.70-72) : le Test de Résistance n’est pas jeté inline, il devient une étape au siège du porteur', () => {
    seedBattleRng(5); // graine où la Résistance RÉUSSIT : un jet inline aurait déjà retiré le poison ici
    const H = setupCoop();
    H.characteristics.endurance = 90;
    addCondition(H, COND.empoisonne, 1);

    franchitLeRound();

    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(stacks(h, COND.empoisonne), 'le dé n’est pas tombé chez l’hôte : le pion est intact').toBe(1);
    expect(hasCondition(h, COND.extenue), 'aucune conséquence de succès appliquée en silence').toBe(false);

    const step = etapes().find((s) => s.kind === 'testDeclenche' && s.rollLabel === 'Résistance');
    expect(step, 'l’étape influençable existe : le Test n’est ni perdu ni doublé').toBeTruthy();
    expect(step!.actorId).toBe(H.id);
    expect(step!.result, 'c’est la fenêtre de l’invité qui le jette').toBeFalsy();
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });

  it('opt-in « Vous pouvez… » (Contrôle de la Frénésie, LDB 10 l.251-255) : l’étape de CHOIX survit au siège du porteur', () => {
    const H = setupCoop(true);
    (H.psychState ??= []).push({ type: 'frenesie' });

    franchitLeRound();

    const choix = etapes().find((s) => s.kind === 'choixDeclenche');
    expect(choix, 'l’opt-in de l’invité n’est plus jeté : sa fenêtre de décision existe').toBeTruthy();
    expect(choix!.actorId).toBe(H.id);
    expect(choix!.defaultChoice, 'Renoncer par défaut — personne ne décide à sa place').toBe('non');
    expect(modalOwnerOf(g())).toBe(H.id);
  });

  it('Effort soutenu (règle optionnelle) : aucun Exténué posé en silence, une étape `fatigue` à la place', () => {
    seedBattleRng(4);
    setRule('combat-se-fatiguer', true);
    const H = setupCoop();
    H.characteristics.endurance = 1; // seuil bas + Résistance ratée garantie
    H.effortRounds = 9;

    franchitLeRound();

    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, COND.extenue), 'le hook n’a pas jeté le dé à la place de l’invité').toBe(false);
    const step = etapes().find((s) => s.kind === 'fatigue');
    expect(step).toBeTruthy();
    expect(step!.actorId).toBe(H.id);
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });

  it('Perte de sang AA (AA 07 l.5) : l’Inconscience n’est pas prononcée inline, le Test devient une étape', () => {
    seedBattleRng(4);
    setRule('combat-aa-blessures', 'aa');
    const H = setupCoop();
    H.characteristics.endurance = 10; // BE 1 : 1 Round à 0 n’excède pas BE (LDB 18 l.15), `tick-death` le laisse conscient
    H.wounds.current = 0;
    addCondition(H, COND.hemorragique, 1);

    franchitLeRound();

    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, COND.inconscient), 'l’hôte ne fait pas tomber le héros de l’invité sans fenêtre').toBe(false);
    const step = etapes().find((s) => s.kind === 'hemorragieInconscient');
    expect(step).toBeTruthy();
    expect(step!.actorId).toBe(H.id);
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });

  it('Perte de sang AA, à 0 PB depuis plus de BE Rounds : `tick-death` (LDB 18 l.15 ; #1595 c.6219559935) le fait tomber, pas de Test', () => {
    seedBattleRng(4);
    setRule('combat-aa-blessures', 'aa');
    const H = setupCoop();
    H.characteristics.endurance = 1; // BE 0 : dès le 1er Round à 0
    H.wounds.current = 0;
    addCondition(H, COND.hemorragique, 1);

    franchitLeRound();

    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, COND.inconscient)).toBe(true);
    expect(etapes().some((s) => s.kind === 'hemorragieInconscient'), 'déjà Inconscient : aucun Test à lui soumettre').toBe(false);
  });

  it('Durée « + » (LDB 47 l.311) : la prolongation n’est pas tentée d’office, elle devient un CHOIX du porteur', () => {
    seedBattleRng(4);
    const H = setupCoop();
    H.activeEffects = [
      ...(H.activeEffects ?? []),
      { label: 'Ailes de l’aigle', sourceSpellId: 'ailes-de-l-aigle', awaitingExtension: true, duration: { scale: 'rounds', left: 0 } },
    ] as Combatant['activeEffects'];

    franchitLeRound();

    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.activeEffects!.some((e) => e.awaitingExtension), 'l’offre est encore ouverte : rien n’a été tranché chez l’hôte').toBe(true);
    const choix = etapes().find((s) => s.kind === 'sortProlongeChoix');
    expect(choix).toBeTruthy();
    expect(choix!.actorId).toBe(H.id);
    expect(choix!.defaultChoice).toBe('non');
    expect(modalOwnerOf(g())).toBe(H.id);
    expect(seatOwns(g(), 1, H.id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });
});

/**
 * Le COUPLAGE des deux prédicats, figé (sonde M2 du juge promue). Ce que les tests ci-dessus montrent
 * en positif, celui-ci le montre par la négative SANS toucher au code : le collecteur est rejoué
 * derrière un gate `humanControlled` — corps strictement équivalent (`humanControlled` implique
 * `surfaceOf`, le gate est la seule différence) — et l'étape disparaît alors que RIEN n'a été résolu
 * inline. C'est l'état exact qu'aurait produit un lot 2 limité à `triggeredEffects` : le Test PERDU.
 */
describe('#1262 lot 2 — les deux prédicats du circuit sont COUPLÉS (le décaler d’un côté perd le Test)', () => {
  it('collecteur re-gaté `humanControlled` → zéro étape ET poison intact : ni roulé, ni collecté', () => {
    seedBattleRng(5);
    const H = setupCoop();
    H.characteristics.endurance = 90;
    addCondition(H, COND.empoisonne, 1);

    runCombatHooks('onRoundEnd', { get: g, set: banc.setState, battle: g().battle!, sink: () => {} } as never);
    const h = g().battle!.combatants.find((c) => c.id === H.id)!;
    expect(stacks(h, COND.empoisonne), 'la voie inline a bien sauté ce porteur').toBe(1);

    expect(humanControlled(g(), h), 'affordance LOCALE : chez l’hôte, il ne pilote pas ce héros').toBe(false);
    expect(surfaceOf(g, h.id), 'SURFACE : un siège humain le tient, donc son jet remonte').toBe(true);

    const collecteurRegate = humanControlled(g(), h) ? collectHeroRoundEndUpkeep(g, h) : [];
    expect(collecteurRegate, 'le Test n’est nulle part : perdu entre les deux voies').toHaveLength(0);
    expect(collectHeroRoundEndUpkeep(g, h).length, 'le collecteur RÉEL, lui, le produit').toBeGreaterThan(0);
  });
});

/**
 * #1262 V1 lot 4 — les PRODUCTEURS de `roundHooks` passent par la porte. Les étapes montées à la main
 * (`base: res, target: res`, sans Difficulté ni ligne) sont MINTÉES : la possession et la surface
 * viennent du mint, la ligne du MONTEUR CANONIQUE. Le mint ne change AUCUNE valeur de règle —
 * c'est ce que ces assertions figent : la cible vaut EXACTEMENT `testValue`, la base est NUE et les
 * États passent en chips (lignes nommées).
 *
 * Le porteur est chargé d'États choisis pour que le CANAL de la ligne se voie à la CIBLE, pas
 * seulement au découpage : 2 Sonné (−10/pion) et une aura de combat −20 (LDB 85 l.262). Hors canal
 * combat — celui du montage manuscrit — le pool retient le Sonné (−20) et ignore l'aura ; le canal
 * `combat` y somme l'aura, son propre pool (LDB 14 l.95). Une ligne montée sur l'autre canal rate donc
 * la cible de 20 points, et ces tests tombent.
 */
describe('#1262 lot 4 — les producteurs mintés : la CIBLE ne bouge pas, la base se DÉCOMPOSE', () => {
  /** Le porteur du lot, à États actifs (cf. en-tête). Le collecteur est appelé DIRECTEMENT : c'est le
   *  producteur sous test, et le circuit hooks→collecte est déjà figé par les cas du lot 2. */
  function porteurCharge(): Combatant {
    const H = setupCoop();
    H.characteristics.endurance = 45;
    addCondition(H, COND.sonne, 2);
    H.auraMods = [{ op: { op: 'testMod', amount: -20 } }];
    return H;
  }
  /** `base + Σ mods` — l'invariant du monteur canonique, Difficulté Intermédiaire (+0) comprise. */
  const sommeLigne = (s: { base?: number; mods?: { value: number }[] }): number =>
    (s.base ?? 0) + (s.mods ?? []).reduce((t, m) => t + m.value, 0);

  it('Perte de sang AA (AA 07 l.5) : cible INCHANGÉE (`testValue`), base NUE et États en lignes nommées', () => {
    setRule('combat-aa-blessures', 'aa');
    const H = porteurCharge();
    H.wounds.current = 0;
    addCondition(H, COND.hemorragique, 1);

    const step = collectHeroRoundEndUpkeep(g, H).find((s) => s.kind === 'hemorragieInconscient')!;
    expect(step, 'l’étape est produite').toBeTruthy();
    expect(step.target, 'CIBLE inchangée : celle du montage manuscrit (`base: res, target: res`)').toBe(testValue(H, { skill: { id: 'resistance' } }));
    expect(step.base, 'la base n’est plus la valeur fondue : c’est le Niveau de Compétence NU').toBeGreaterThan(step.target!);
    expect(sommeLigne(step), 'base + Σ mods = cible : aucun écart « autres »').toBe(step.target);
    expect(step.mods?.some((m) => m.value === -20), 'les 2 Sonné sortent en ligne NOMMÉE').toBe(true);
    expect(step.rollLabel, 'Compétence dérivée du catalogue — même libellé qu’avant').toBe('Résistance');
    expect(step.difficulty, 'AA 07 l.5 : « Test de Résistance Intermédiaire (+0) »').toBe('intermediaire');
    expect({ actorId: step.actorId, stake: !!step.stake })
      .toEqual({ actorId: H.id, stake: true });
  });

  it('Effort soutenu (LDB 16 l.97) : cible INCHANGÉE (`testValue`), base NUE et États en lignes nommées', () => {
    setRule('combat-se-fatiguer', true);
    const H = porteurCharge();
    H.effortRounds = 9;

    const step = collectHeroRoundEndUpkeep(g, H).find((s) => s.kind === 'fatigue')!;
    expect(step, 'l’étape est produite').toBeTruthy();
    expect(step.target, 'CIBLE inchangée : celle du montage manuscrit (`base: res, target: res`)').toBe(testValue(H, { skill: { id: 'resistance' } }));
    expect(step.base).toBeGreaterThan(step.target!);
    expect(sommeLigne(step), 'base + Σ mods = cible : aucun écart « autres »').toBe(step.target);
    expect(step.mods?.some((m) => m.value === -20), 'les 2 Sonné sortent en ligne NOMMÉE').toBe(true);
    expect(step.rollLabel).toBe('Résistance');
    expect(step.difficulty, 'aucune Difficulté n’est indiquée au RAW → Intermédiaire, comme le jumeau inline').toBe('intermediaire');
    expect({ actorId: step.actorId, stake: !!step.stake })
      .toEqual({ actorId: H.id, stake: true });
  });

  it('Durée « + » (LDB 47 l.311) : le CHOIX reste un choix — aucun dé, aucune cible, le porteur possède', () => {
    const H = porteurCharge();
    H.activeEffects = [
      ...(H.activeEffects ?? []),
      { label: 'Ailes de l’aigle', sourceSpellId: 'ailes-de-l-aigle', awaitingExtension: true, duration: { scale: 'rounds', left: 0 } },
    ] as Combatant['activeEffects'];

    const step = collectHeroRoundEndUpkeep(g, H).find((s) => s.kind === 'sortProlongeChoix')!;
    expect(step, 'l’étape est produite').toBeTruthy();
    expect({ target: step.target, base: step.base }, 'un choix ne lance aucun dé : ni cible ni base')
      .toEqual({ target: undefined, base: undefined });
    expect(step.options?.map((o) => o.key)).toEqual(['oui', 'non']);
    expect(step.defaultChoice).toBe('non');
    expect(step.meta?.sourceSpellId, 'l’effet visé reste désigné par son id STABLE (#142)').toBe('ailes-de-l-aigle');
    expect({ actorId: step.actorId, groupOwner: step.groupOwner })
      .toEqual({ actorId: H.id, groupOwner: undefined });
  });
});

/**
 * Le domaine du silence, émulé (sonde M3 du juge promue) : des hooks gatés `humanControlled`
 * laisseraient passer le héros de l'invité jusqu'à `rollSansPilote`, dont la garde DEV (sur
 * `surfaceOf`) nomme elle-même cette classe de bug. `humanControlled` implique `surfaceOf`, jamais
 * l'inverse : la porte par siège est la plus étroite.
 */
describe('#1262 lot 2 — le garde-fou du socle nommait déjà le bug que ce lot ferme', () => {
  it('`rollSansPilote` sur le héros d’un invité : la garde DEV mord (le hook pré-lot y passait)', () => {
    const H = setupCoop();
    expect(humanControlled(g(), H), 'le gate pré-lot laissait donc entrer ce porteur dans la voie inline').toBe(false);
    expect(surfaceOf(g, H.id)).toBe(true);
    expect(() => rollSansPilote(g, H, 40, 'intermediaire', makeRNG(3))).toThrow(/jet silencieux/);
  });
});
