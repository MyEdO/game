/**
 * Effets DÉCLENCHÉS génériques (`TriggeredEffect`) — preuve que le MÊME système flow+déclencheur sert
 * les Traits de créature (Toile) ET les Atouts d'arme (Immobilisante), via UN dispatcher (`fireTriggers`)
 * réutilisant l'exécuteur des sorts (`runPureFlowLines`), sans handler en dur par trait/atout.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fireTriggers, applyTriggeredEffects } from './triggeredEffects';
import { findConditionById } from '../data';
import { runPureFlowLines } from './combat/flowEval';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';

import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { evalCondition, spellEffectOps } from '../engine/flowCore';
import { applyOps } from '../engine/ops';
import { makeRNG } from '../engine/dice';
import type { Combatant, Weapon } from '../engine/types';
import type { Flow } from '../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', label: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
  wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

// `get` est une FONCTION (getter de l'état) ; un stub hors-combat renvoie donc `() => ({ battle: undefined })`.
const noBattle = () => (() => ({ battle: undefined })) as never;
const empetre = (c: Combatant) => c.conditions.find((x) => x.id === 'empetre');

describe('fireTriggers — Traits et Atouts sur le même système flow+déclencheur', () => {
  it('TRAIT Toile : à la touche, la victime gagne Empêtré (Force d’évasion = Force de l’attaquant)', () => {
    const spider = mk({ id: 'sp', traits: [{ id: 'toile', value: 40 }] }); // l'Indice est descriptif ; l'effet est en donnée
    const prey = mk({ id: 'pr' });
    fireTriggers(noBattle(), spider, 'onHit', { rng: desDuTest, victim: prey });
    expect(empetre(prey)?.value).toBe(1);
    expect(empetre(prey)?.escapeStrength).toBe(spider.characteristics.force); // {charOf:'force'} résolu vs l’attaquant
  });

  it('ATOUT Immobilisante : l’arme qui touche pose Empêtré — MÊME chemin que le trait', () => {
    const knight = mk({ id: 'kn' });
    const foe = mk({ id: 'fo' });
    const weapon: Weapon = { label: 'Fléau à chaîne', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'immobilisante' }] } as Weapon;
    fireTriggers(noBattle(), knight, 'onHit', { rng: desDuTest, victim: foe, weapon });
    expect(empetre(foe)?.value).toBe(1);
  });

  it('ATOUT Taillade : effet sur CRITIQUE (déclencheur onCrit générique) → Hémorragique ; PAS à la touche simple', () => {
    const knight = mk({ id: 'kn' });
    const foe = mk({ id: 'fo' });
    const weapon: Weapon = { label: 'Hache de Taillade', type: 'melee', damage: { plusBF: true, flat: 6 }, qualities: [{ id: 'taillade' }] } as Weapon;
    const hemo = (c: Combatant) => c.conditions.find((x) => x.id === 'hemorragique');
    fireTriggers(noBattle(), knight, 'onHit', { rng: desDuTest, victim: foe, weapon }); // touche simple → RIEN (Taillade ne déclenche que sur Critique)
    expect(hemo(foe)).toBeUndefined();
    fireTriggers(noBattle(), knight, 'onCrit', { rng: desDuTest, victim: foe, weapon }); // Critique → Hémorragique, via le MÊME dispatcher data-driven
    expect(hemo(foe)?.value).toBe(1);
  });

  /**
   * SANS routeur cadence-aware (`ctx.set` absent — entretien hors combat), un Flow n'a pas de voie
   * d'interaction : ses parties PURES jouent, un `choice` n'est pas offert. Un `test` ENFOUI sous un
   * `choice`, lui, ne doit JAMAIS passer en silence : `runPureFlowLines` n'a aucun `case 'choice'` — il
   * traverserait le nœud sans rien faire, et la branche de jet serait perdue sans un mot.
   */
  it('#1874 — SANS routeur, la branche `on:caster` d’un Test subi par la CIBLE tombe sur le PORTEUR (parité avec la voie routée)', () => {
    const porteur = mk({ id: 'po' });
    const victime = mk({ id: 'vi' });
    // Les DEUX branches portent la même feuille : l'issue du jet (tiré par la voie inline) n'entre pas dans la mesure.
    const surLePorteur = { kind: 'do', effect: { type: 'ops', on: 'caster', ops: [{ op: 'condition', id: 'a-terre' }] } };
    const flow = { kind: 'test', test: { characteristic: 'force' }, success: surLePorteur, fail: surLePorteur } as unknown as Flow;
    applyTriggeredEffects(noBattle(), porteur, [{ trigger: 'onHit', on: 'victim', flow }], 'onHit', { victim: victime, rng: makeRNG(1) });
    expect(porteur.conditions.map((c) => c.id), 'la feuille `on:caster` doit atteindre le PORTEUR').toEqual(['a-terre']);
    expect(victime.conditions, 'la cible a reçu la conséquence du porteur').toEqual([]);
  });

  it('CHOICE sans routeur : un `test` ENFOUI sous le choix LÈVE (jamais une branche de jet muette)', () => {
    const porteur = mk({ id: 'po' });
    const victime = mk({ id: 'vi' });
    const flow: Flow = {
      kind: 'choice', prompt: 'Renverser', advantageCost: 2,
      yes: {
        kind: 'test',
        test: { characteristic: 'force', skill: { id: 'athletisme' } },
        success: { kind: 'seq', steps: [] },
        fail: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'a-terre' }] } },
      },
      no: { kind: 'seq', steps: [] },
    } as Flow;
    expect(
      () => applyTriggeredEffects(noBattle(), porteur, [{ trigger: 'onHit', on: 'victim', flow }], 'onHit', { rng: desDuTest, victim: victime }),
      'un Test enfoui sous un `choice` a été traversé en SILENCE — aucune branche jouée, aucune levée.',
    ).toThrow(/routeur cadence-aware/);
    expect(victime.conditions, 'la cible a subi une conséquence alors qu’aucun jet n’a été joué.').toEqual([]);
  });

  it('CHOICE sans routeur, cas Taillade (`choice{yes:do}`) : l’État AUTOMATIQUE joue, le choix n’est pas offert, aucune levée', () => {
    const porteur = mk({ id: 'po' });
    const victime = mk({ id: 'vi' });
    const flow: Flow = {
      kind: 'seq',
      steps: [
        { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'hemorragique' }] } },
        {
          kind: 'choice', prompt: 'Ouvrir la plaie', advantageCost: 1,
          yes: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'hemorragique' }] } },
        },
      ],
    } as Flow;
    porteur.advantage = 5;
    applyTriggeredEffects(noBattle(), porteur, [{ trigger: 'onCrit', on: 'victim', flow }], 'onCrit', { rng: desDuTest, victim: victime });
    expect(victime.conditions.find((c) => c.id === 'hemorragique')?.value, 'l’État automatique du Critique manque, ou le choix a été joué GRATUITEMENT.').toBe(1);
    expect(porteur.advantage, 'un Avantage a été dépensé sans que personne n’ait choisi.').toBe(5);
  });

  it('ATOUT Empaleuse : Critique à DISTANCE pose 1 munition logée (marqueur, LDB 62 l.250, #473) ; PAS en mêlée', () => {
    const archer = mk({ id: 'ar' });
    const foe = mk({ id: 'fo' });
    const logee = (c: Combatant) => c.conditions.find((x) => x.id === 'munition-logee');
    const arc: Weapon = { label: 'Arc long', type: 'ranged', damage: { plusBF: false, flat: 4 }, qualities: [{ id: 'empaleuse' }] } as Weapon;
    fireTriggers(noBattle(), archer, 'onCrit', { rng: desDuTest, victim: foe, weapon: arc, attackType: 'ranged', origine: 'coup-critique' });
    expect(logee(foe)?.value).toBe(1);
    fireTriggers(noBattle(), archer, 'onCrit', { rng: desDuTest, victim: foe, weapon: arc, attackType: 'ranged', origine: 'coup-critique' }); // 2e flèche → empile
    expect(logee(foe)?.value).toBe(2);
    const lance: Weapon = { label: 'Lance de Taillade empaleuse', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'empaleuse' }] } as Weapon;
    const melee = mk({ id: 'me' });
    fireTriggers(noBattle(), archer, 'onCrit', { rng: desDuTest, victim: melee, weapon: lance, attackType: 'melee', origine: 'coup-critique' });
    expect(logee(melee)).toBeUndefined(); // « Si l'empalement vient d'une arme à DISTANCE » — mêlée = rien
  });

  it('déjà Empêtré → pas de re-application (unlessCondition)', () => {
    const spider = mk({ traits: [{ id: 'toile' }] });
    const prey = mk({ conditions: [{ id: 'empetre', value: 2 }] });
    fireTriggers(noBattle(), spider, 'onHit', { rng: desDuTest, victim: prey });
    expect(empetre(prey)?.value).toBe(2); // inchangé
  });

  it('TRAIT Nerveux : déclencheur onStartled (magie/bruit) → +3 Brisé sur soi', () => {
    const skittish = mk({ traits: [{ id: 'nerveux' }] });
    fireTriggers(noBattle(), skittish, 'onStartled', { rng: desDuTest });
    expect(skittish.conditions.find((c) => c.id === 'brise')?.value).toBe(3);
  });

  it('TRAIT Sang corrosif : onWoundLoss → les Engagés subissent 1d10 (BE+PA, min 1)', () => {
    const acid = mk({ id: 'ac', traits: [{ id: 'sang-corrosif' }] });
    const foe = mk({ id: 'fo', engagedWith: ['ac'], characteristics: { ...mk().characteristics, endurance: 80 } }); // BE élevé → mitigation forte
    const get = () => ({ battle: { combatants: [acid, foe] } }) as never;
    const before = foe.wounds.current;
    fireTriggers(get, acid, 'onWoundLoss', { rng: makeRNG(1) });
    expect(foe.wounds.current).toBeLessThan(before); // au moins 1 (min) malgré BE 80
    expect(before - foe.wounds.current).toBeGreaterThanOrEqual(1);
  });

  // NB : Affamé porte un nœud Flow `test` (Lot 4a) → routé cadence-aware. Testé sur une VRAIE bataille
  // dans le describe « Affamé — Test de trigger routé » ci-dessous.

  it('TRAIT Vampirique : Morsure infligeant N PB → l’attaquant draine N PB (Vol de vie, gaté par attackKind)', () => {
    const vampire = mk({ id: 'vp', traits: [{ id: 'vampirique' }], wounds: blessuresDeBase(30, 10) });
    const prey = mk({ id: 'pr' });
    // onHit d'une Morsure ayant infligé 6 PB → lifeSteal 1/1 sur l'attaquant (ctx.caster).
    fireTriggers(noBattle(), vampire, 'onHit', { rng: desDuTest, victim: prey, attackKind: 'morsure', woundsDealt: 6 });
    expect(vampire.wounds.current).toBe(16); // 10 + 6, plafonné au max (30)
  });

  it('TRAIT Vampirique : un coup d’ARME (≠ Morsure) ne draine PAS (Condition attackKind)', () => {
    const vampire = mk({ id: 'vp', traits: [{ id: 'vampirique' }], wounds: blessuresDeBase(30, 10) });
    const prey = mk({ id: 'pr' });
    fireTriggers(noBattle(), vampire, 'onHit', { rng: desDuTest, victim: prey, attackKind: 'arme', woundsDealt: 6 });
    expect(vampire.wounds.current).toBe(10); // attackKind ≠ 'morsure' → branche then non prise
  });

  it('op loseTurn : pose les drapeaux lus au début du Round', () => {
    const c = mk();
    runPureFlowLines(c, c, { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'loseTurn' }] } }, { rng: makeRNG(1), caster: c });
    expect(c.loseNextAction).toBe(true);
    expect(c.loseNextMovement).toBe(true);
  });

  it('Condition `compare` générique : who (cible/lanceur) × donnée/État · opérateur · valeur (const ou acteur)', () => {
    const target = { id: 't', woundsCurrent: 5, woundsMax: 15, size: 2, advantage: 0, camp: 'hostile' as const, groups: ['Morts-vivants'], talents: [], traits: ['mort-vivant'], immunities: ['poison'], conditions: { brise: 3 }, chars: {} as Record<string, number> }; // Petite (2), ennemi mort-vivant (conditions keyées par id)
    const caster = { id: 'c', woundsCurrent: 12, woundsMax: 12, size: 4, advantage: 1, camp: 'party' as const, groups: [], talents: [{ id: 'magie-des-arcanes', spec: 'Feu' }], traits: [], conditions: {} as Record<string, number>, chars: {} as Record<string, number> }; // Grande (4), mage de Feu
    const ctx = { flags: {}, gameTime: 0, target, caster };
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', condition: 'brise' }, op: '>=', value: 3 }, ctx)).toBe(true); // valeur d'État (stacks)
    expect(evalCondition({ kind: 'compare', subject: { who: 'caster', field: 'woundsCurrent' }, op: '>', value: 10 }, ctx)).toBe(true); // données du LANCEUR
    // ACTEUR-vs-ACTEUR : « cible plus petite que l'attaquant » (Attaque caudale)
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', field: 'size' }, op: '<', value: { who: 'caster', field: 'size' } }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'compare', subject: { who: 'caster', field: 'size' }, op: '<', value: { who: 'target', field: 'size' } }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 }, { flags: {}, gameTime: 0 })).toBe(false); // acteur absent
    // Condition `relation` : camp ABSOLU (kind) + relation RELATIVE au lanceur.
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'hostile' }, ctx)).toBe(true); // la cible EST un ennemi (absolu)
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'opponent' }, ctx)).toBe(true); // adversaire du lanceur (camp ≠)
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'ally' }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'relation', who: 'caster', is: 'party' }, ctx)).toBe(true); // le lanceur est du groupe
    expect(evalCondition({ kind: 'relation', who: 'target', is: 'self' }, ctx)).toBe(false); // cible ≠ lanceur
    // Condition `has` : appartenance Groupe / Talent (spec) / Trait.
    expect(evalCondition({ kind: 'has', who: 'target', what: 'group', value: 'Morts-vivants' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'has', who: 'target', what: 'trait', value: 'mort-vivant' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'has', who: 'target', what: 'immunity', value: 'poison' }, ctx)).toBe(true); // LDB 85 l.174
    expect(evalCondition({ kind: 'has', who: 'caster', what: 'immunity', value: 'poison' }, ctx)).toBe(false);
    expect(evalCondition({ kind: 'has', who: 'caster', what: 'talent', value: 'magie-des-arcanes', spec: 'Feu' }, ctx)).toBe(true);
    expect(evalCondition({ kind: 'has', who: 'caster', what: 'talent', value: 'magie-des-arcanes', spec: 'Mort' }, ctx)).toBe(false); // spec ≠
  });

  it('op rollThreshold : UN d10 → soin = la valeur du dé via Formula {rolled}', () => {
    const c = mk({ wounds: blessuresDeBase(20, 0) });
    applyOps(c, [{ op: 'rollThreshold', sides: 10, thresholds: [{ atLeast: 1, ops: [{ op: 'heal', amount: { rolled: true } }] }] }], { rng: makeRNG(3) });
    expect(c.wounds.current).toBeGreaterThanOrEqual(1); // a soigné le dé (1..10)
    expect(c.wounds.current).toBeLessThanOrEqual(10);
  });

  it('TRAIT Régénération : onRoundStart, PB>0 → régénère la valeur du dé (if « état de soi » + rollThreshold)', () => {
    const troll = mk({ traits: [{ id: 'regeneration' }], wounds: blessuresDeBase(30, 5) });
    fireTriggers(noBattle(), troll, 'onRoundStart', { rng: makeRNG(2) });
    expect(troll.wounds.current).toBeGreaterThan(5); // branche PB>0 → heal {rolled}
  });

  it('Atout authorable « à la touche : 1d10 Dégâts + Empêtré » — le Flow applique les DEUX ops', () => {
    // L'exemple exact demandé : un Flow de feuille EffectOp porté par un Atout (édité au Codex).
    const flow: Flow = {
      kind: 'seq',
      steps: [{
        kind: 'do',
        effect: { type: 'ops', on: 'target', ops: [
          { op: 'wounds', amount: { dice: { n: 1, sides: 10 } } },
          { op: 'condition', id: 'empetre', value: 1 },
        ] },
      }],
    };
    const attacker = mk({ id: 'a' });
    const victim = mk({ id: 'v', wounds: blessuresDeBase(15) });
    runPureFlowLines(victim, attacker, flow, { rng: makeRNG(3), caster: attacker });
    expect(victim.wounds.current).toBeLessThan(15); // 1d10 Dégâts appliqués (ignore BE/PA par défaut)
    expect(empetre(victim)?.value).toBe(1);
  });
});

/**
 * COMPOSABILITÉ « rendre un effet de zone depuis N'IMPORTE QUELLE source » (S3) : l'aire n'est PAS réservée
 * aux armes (`areaFire`/`explosion`). Le canal GÉNÉRIQUE `TriggeredEffect.on = {near, radiusMeters}` — déjà
 * data-driven (Trait/Talent/Atout/État, GameOps) — pose une zone SOURCE-AGNOSTIQUE qui passe par
 * l'ORCHESTRATEUR d'aire PARTAGÉ (`combatantsWithinRadius`) puis applique ses `GameOp[]` à CHAQUE cible.
 */
describe('Aire source-agnostique — un TRAIT pose `on:{near}` → GameOps à TOUTES les cibles du rayon', () => {
  // Un effet déclenché AUTHORÉ porté par un trait : à la touche, 12 PB de zone (rayon 4 m = 2 cases) autour
  // de la VICTIME. Aucune arme : c'est la donnée du trait (comme l'« arc d'Azyr » du domaine) qui pose l'aire.
  const burstEffect = {
    trigger: 'onHit' as const,
    on: { near: 'victim' as const, radiusMeters: 4 }, // 4 m → 2 cases (Chebyshev d'empreinte)
    flow: { kind: 'do' as const, effect: { type: 'ops' as const, on: 'target' as const, ops: [{ op: 'wounds' as const, amount: 12 }] } },
  };

  it('applique les GameOps à TOUS les combattants du rayon (exclut le centre/porteur), pas au combattant hors rayon', () => {
    const attacker = mk({ id: 'atk', pos: { x: 0, y: 0 } });
    const victim = mk({ id: 'vic', pos: { x: 6, y: 6 }, wounds: blessuresDeBase(20) });    // le CENTRE (exclu)
    const nearA = mk({ id: 'nA', pos: { x: 7, y: 6 }, wounds: blessuresDeBase(20) });        // 1 case du centre → dans le rayon
    const nearB = mk({ id: 'nB', pos: { x: 6, y: 8 }, wounds: blessuresDeBase(20) });        // 2 cases → dans le rayon
    const far = mk({ id: 'far', pos: { x: 6, y: 12 }, wounds: blessuresDeBase(20) });        // 6 cases → hors rayon
    const get = () => ({ battle: { combatants: [attacker, victim, nearA, nearB, far] } }) as never;

    const lines = applyTriggeredEffects(get, attacker, [burstEffect], 'onHit', { victim, rng: makeRNG(1) });

    expect(nearA.wounds.current).toBe(8);  // 20 − 12
    expect(nearB.wounds.current).toBe(8);  // 20 − 12
    expect(victim.wounds.current).toBe(20); // le centre est EXCLU (`c.id !== center.id`)
    expect(far.wounds.current).toBe(20);    // hors rayon → intact
    expect(lines.length).toBeGreaterThan(0);
  });

  it('un combattant HORS DE COMBAT dans le rayon n’est pas touché (pas d’éclaboussure sur un cadavre)', () => {
    const attacker = mk({ id: 'atk', pos: { x: 0, y: 0 } });
    const victim = mk({ id: 'vic', pos: { x: 6, y: 6 } });
    const dead = mk({ id: 'dd', pos: { x: 7, y: 6 }, wounds: blessuresDeBase(20, 0), conditions: [{ id: 'inconscient', value: 1 }] });
    const get = () => ({ battle: { combatants: [attacker, victim, dead] } }) as never;

    applyTriggeredEffects(get, attacker, [burstEffect], 'onHit', { victim, rng: makeRNG(1) });

    expect(dead.wounds.current).toBe(0); // intact : `isOutOfAction` l'exclut de la collecte d'aire
  });
});

/**
 * Affamé (LDB 85) porte un nœud Flow `test` (Lot 4a) : `onKill` → Test de FM Accessible →
 * échec = `loseTurn`. Routé cadence-aware par les actions du noyau (un `test` non routé LÈVE) : une créature ENNEMIE
 * → jet INLINE + branche. On le vérifie sur une VRAIE bataille (FM basse → échec → perd Action+Mouvement).
 */
describe('Affamé — Test de trigger onKill routé (cadence-aware)', () => {
  it('créature ENNEMIE Affamée tue → Test de FM inline ; échec (FM basse) → loseTurn', () => {
    seedBattleRng(1); // → jet de FM 97 / 21 → échec → festoie (loseTurn)
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const hungry = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    hungry.traits = [...(hungry.traits ?? []), { id: 'affame' }];
    hungry.characteristics['force-mentale'] = 1; // FM minimale → Test Accessible (+20) échoué → festoie (loseTurn)
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });

    fireTriggers(banc.getState, hungry, 'onKill', { rng: makeRNG(1), set: banc.setState });

    const live = banc.getState().battle!.combatants.find((c) => c.id === hungry.id)!;
    expect(live.loseNextAction).toBe(true);   // échec FM → festoie (op loseTurn)
    expect(live.loseNextMovement).toBe(true);
    expect(banc.getState().pendingLogQueue.some((q) => /Force Mentale/.test(q.line))).toBe(true);
  });
});

// ── Trigger `onOwnTestFailed` (MSRC 16 — Crampes abdominales) + symptômes comme SOURCE du dispatcher ──
import { fireOwnTestFailed, effectSourcesOf } from './triggeredEffects';

const withCrampes = (over: Partial<Combatant> = {}): Combatant => mk({
  id: 'cr', kind: 'hero',
  diseases: [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 100000, durationMinutes: 100000 }],
  ...over,
} as Partial<Combatant>);
const cond = (c: Combatant, name: string) => c.conditions.find((x) => x.id === name);

describe('onOwnTestFailed — Crampes abdominales (MSRC 16 l.152-158)', () => {
  it('symptôme ACTIF = SOURCE du dispatcher (effectSourcesOf) : 3 effets, tous onOwnTestFailed', () => {
    const c = withCrampes();
    const src = effectSourcesOf(c).find((s) => s.key === 'symptom:crampes-abdominales');
    expect(src).toBeTruthy();
    expect(src!.effects.length).toBe(3);
    expect(src!.effects.every((e) => e.trigger === 'onOwnTestFailed')).toBe(true);
  });

  it('EARLY-OUT : un combattant sans source onOwnTestFailed → aucun effet, aucune ligne', () => {
    const c = mk({ id: 'sain' });
    expect(fireOwnTestFailed(noBattle(), c, { sl: -6, rng: makeRNG(1) })).toEqual([]);
    expect(c.conditions).toEqual([]);
  });

  it('palier « échec normal » (DR ≤ −2) → Sonné seul (ctx.margin lu par slThreshold)', () => {
    const c = withCrampes();
    fireOwnTestFailed(noBattle(), c, { sl: -2, rng: makeRNG(1) });
    expect(cond(c, 'sonne')?.value).toBe(1);
    expect(cond(c, 'a-terre')).toBeUndefined();
    expect(cond(c, 'inconscient')).toBeUndefined();
  });

  it('palier « Impressionnant » (DR ≤ −4) → Sonné + Test de FM raté → À Terre (résolu INLINE)', () => {
    const c = withCrampes();
    // rng FM raté (jet haut) : le sous-Test se résout inline, sa branche fail pose À Terre.
    fireOwnTestFailed(noBattle(), c, { sl: -4, rng: deFixe(98) });
    expect(cond(c, 'sonne')?.value).toBe(1);
    expect(cond(c, 'a-terre')?.value).toBe(1);
  });

  it('palier « Impressionnant » — Test de FM RÉUSSI → pas d’À Terre (branche success vide)', () => {
    const c = withCrampes();
    fireOwnTestFailed(noBattle(), c, { sl: -4, rng: deFixe(1) }); // jet bas → réussite
    expect(cond(c, 'sonne')?.value).toBe(1);
    expect(cond(c, 'a-terre')).toBeUndefined();
  });

  it('palier « Stupéfiant » (DR ≤ −6) : les trois paliers tirent cumulativement (« ou pire »)', () => {
    const c = withCrampes();
    fireOwnTestFailed(noBattle(), c, { sl: -6, rng: deFixe(98) }); // FM raté
    expect(cond(c, 'sonne')?.value).toBe(1);
    expect(cond(c, 'a-terre')?.value).toBe(1);
    expect(cond(c, 'inconscient')?.value).toBe(1);
  });

  it('RÉ-ENTRANCE : le Test de FM (palier 2) résolu pendant le traitement NE ré-émet PAS le trigger', () => {
    const c = withCrampes();
    // Le FM raté a un DR très négatif (cible basse ≈ FM−20) : sans garde, il ré-émettrait onOwnTestFailed
    // et empilerait un 2ᵉ Sonné. La garde de ré-entrance le bloque → Sonné reste à 1 pion.
    fireOwnTestFailed(noBattle(), c, { sl: -4, rng: deFixe(99) });
    expect(cond(c, 'sonne')?.value).toBe(1);
  });
});

// ── Correction 1 : cadence-aware (héros → cascade influençable, PNJ → inline) + ré-entrance en cascade ──
import { hasCondition } from '../engine/conditions';

const addCrampes = (c: Combatant) => { c.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }]; };

describe('onOwnTestFailed — cadence-aware + seam central de cascade (corrections coordinateur)', () => {
  function combat() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.filter((c) => c.kind === 'enemy');
    E.slice(1).forEach((e) => (e.dead = true));
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E: E[0] };
  }

  it('HÉROS en combat : le FM de palier 2 (DR ≤ −4) devient une ÉTAPE de cascade (influençable, tamponnée noOwnTestFailed)', () => {
    seedBattleRng(1);
    const { H } = combat();
    addCrampes(H);
    fireOwnTestFailed(banc.getState, H, { rng: desDuTest, sl: -4, set: banc.setState });
    expect(hasCondition(H, 'sonne')).toBe(true);   // palier 1 inline
    expect(hasCondition(H, 'a-terre')).toBe(false); // palier 2 DIFFÉRÉ en cascade (pas résolu inline)
    const step = banc.getState().pendingCascade?.participants.find((s) => s.kind === 'triggeredTest');
    expect(step).toBeTruthy();
    expect(step?.meta?.noOwnTestFailed).toBe(true); // garde de ré-entrance portée par l'étape
  });

  it('RÉ-ENTRANCE en cascade : résoudre le FM raté n’empile PAS un 2ᵉ Sonné (le sous-Test ne ré-émet pas)', () => {
    seedBattleRng(1);
    const { H } = combat();
    H.characteristics['force-mentale'] = 1; // FM minimale → le Test de FM échoue à coup sûr
    addCrampes(H);
    fireOwnTestFailed(banc.getState, H, { rng: desDuTest, sl: -4, set: banc.setState });
    const before = cond(H, 'sonne')?.value ?? 0;
    banc.getState().cascadeResolveAll(); // résout le FM (échec) → À Terre, PAS un 2ᵉ Sonné
    const H2 = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(H2, 'a-terre')).toBe(true);
    expect(cond(H2, 'sonne')?.value ?? 0).toBe(before); // ré-entrance : aucun nouveau Sonné
  });

  it('PNJ en combat : le FM de palier 2 est résolu INLINE (jamais une étape de cascade)', () => {
    seedBattleRng(1);
    const { E } = combat();
    E.characteristics['force-mentale'] = 1; // FM minimale → échec inline → À Terre
    addCrampes(E);
    fireOwnTestFailed(banc.getState, E, { rng: desDuTest, sl: -4, set: banc.setState });
    expect(banc.getState().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest')).toBeFalsy();
    expect(hasCondition(E, 'a-terre')).toBe(true); // résolu inline (PNJ)
  });

  it('SEAM CENTRAL `commitStep` (cumulard) : un Test d’ENTRETIEN raté déclenche les Crampes du porteur', () => {
    seedBattleRng(3);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    addCrampes(hero);
    banc.setState({
      party: [hero], battle: null,
      pendingCascade: cascadeDeTest([
        { id: 'dt', kind: 'diseaseTick', actorId: hero.id, base: 0, target: 5, rollLabel: 'Endurance', result: null, meta: { diseaseName: 'x' } },
      ], { title: 'Entretien' }),
    });
    banc.getState().cascadeResolveAll();
    expect(hasCondition(banc.getState().party[0], 'sonne')).toBe(true); // Crampes réagissent au Test d'Endurance raté
  });
});

// ── Correction 1 (recette) : seams d'ATTAQUE — attaquant qui rate son jet + défenseur qui rate sa défense ──
import { applyAttackResult } from './combatFlow';
import type { AttackResult } from '../engine/combat';
import { cascadeDeTest } from './cascade.testkit';
import { deFixe, desDuTest } from '../engine/dice.testkit';
import { blessuresDeBase } from '../engine/characteristics';

describe('onOwnTestFailed — jets d’ATTAQUE (attaquant ET défenseur, MSRC 16)', () => {
  function combat() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.filter((c) => c.kind === 'enemy');
    E.slice(1).forEach((e) => (e.dead = true));
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E: E[0] };
  }
  const wpn = (c: Combatant): Weapon => c.weapons?.[0] ?? ({ label: 'Poing', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as Weapon);
  const missDetail = (sl: number) => ({ label: 'CC', base: 40, modifier: 0, target: 40, roll: 99, success: false, sl });

  it('ATTAQUANT porteur qui RATE son jet d’attaque (CC) → Crampes (Sonné)', () => {
    seedBattleRng(1);
    const { H, E } = combat();
    addCrampes(H);
    const res: AttackResult = { hit: false, attackerRoll: 99, netSL: -2, critical: false, advantageTo: null, defenderDefeated: false, attackerDetail: missDetail(-2), log: `${H.label} rate.` };
    applyAttackResult(banc.getState, banc.setState, H, E, wpn(H), res);
    expect(hasCondition(banc.getState().battle!.combatants.find((c) => c.id === H.id)!, 'sonne')).toBe(true);
  });

  it('DÉFENSEUR porteur qui RATE sa Parade/Esquive (Test opposé) → Crampes (Sonné)', () => {
    seedBattleRng(1);
    const { H, E } = combat();
    addCrampes(H); // H se défend
    const res: AttackResult = { hit: true, attackerRoll: 20, defenderRoll: 99, netSL: 3, critical: false, advantageTo: 'attacker', defenderDefeated: false, defenderDetail: { ...missDetail(-2), mode: 'parade' }, woundsLost: 0, log: `${E.label} touche.` };
    applyAttackResult(banc.getState, banc.setState, E, H, wpn(E), res);
    expect(hasCondition(banc.getState().battle!.combatants.find((c) => c.id === H.id)!, 'sonne')).toBe(true);
  });
});

describe('Test déclenché INLINE : la pénalité d’État lit la Compétence testée (LDB 16 l.35)', () => {
  const de20 = deFixe(20);
  const issue = (victimeATerre: boolean) => {
    const porteur = mk({ id: 'po' });
    const victime = mk({ id: 'vi' });
    if (victimeATerre) victime.conditions = [{ id: 'a-terre', value: 1 }] as never;
    const sur = (id: string) => ({ kind: 'do', effect: { type: 'ops', on: 'caster', ops: [{ op: 'condition', id }] } });
    const flow = { kind: 'test', test: { characteristic: 'agilite', skill: { id: 'athletisme' } }, success: sur('sonne'), fail: sur('aveugle') } as unknown as Flow;
    applyTriggeredEffects(noBattle(), porteur, [{ trigger: 'onHit', on: 'victim', flow }], 'onHit', { victim: victime, rng: de20 });
    return porteur.conditions.map((c) => c.id);
  };
  it('Athlétisme (déplacement) À Terre : 20 contre 30 réussit debout, rate à −20', () => {
    expect(issue(false)).toEqual(['sonne']);
    expect(issue(true)).toEqual(['aveugle']);
  });
});

/** ZI 03 l.75, l.77 ; LDB 16 l.70 ; MDG 16 l.226 */
describe('Traits conférés par une attaque, Difficulté portée par l’État', () => {
  const cles = (c: Combatant, w?: Weapon) => effectSourcesOf(c, w).map((s) => s.key);
  it('un Trait conféré est une source de la touche de l’attaque qui le confère, et d’elle seule', () => {
    const porteur = mk({ id: 'po' });
    const arme = { label: 'Arme', type: 'melee', damage: { plusBF: true, flat: 0 }, traitsConferes: [{ id: 'venin' }] } as Weapon;
    expect(cles(porteur, arme)).toContain('trait:venin');
    expect(cles(porteur, { ...arme, traitsConferes: undefined })).not.toContain('trait:venin');
    expect(cles(porteur)).not.toContain('trait:venin');
  });
  it('l’op `condition` fige sa Difficulté sur l’État posé', () => {
    const cible = mk({ id: 'ci' });
    applyOps(cible, [{ op: 'condition', id: 'empoisonne', difficulte: 'difficile' }], { rng: makeRNG(1) });
    expect(cible.conditions.find((x) => x.id === 'empoisonne')?.difficulte).toBe('difficile');
  });
  // (#3060 ; LDB 16 l.70) Difficulté la plus dure des poisons cumulés.
  it('des poisons de Difficultés différentes laissent à l’État la plus dure, dans les deux ordres', () => {
    for (const ordre of [['facile', 'difficile'], ['difficile', 'facile']] as const) {
      const cible = mk({ id: 'ci' });
      for (const difficulte of ordre) applyOps(cible, [{ op: 'condition', id: 'empoisonne', difficulte }], { rng: makeRNG(1) });
      expect(cible.conditions.find((x) => x.id === 'empoisonne'), ordre.join(' puis ')).toMatchObject({ value: 2, difficulte: 'difficile' });
    }
  });
  it('l’État `argDifficulty` d’un Trait prend la Difficulté de l’arg, et reste posé sans arg (LDB 85 l.423, l.425)', () => {
    const opsDuVenin = (arg?: string) => effectSourcesOf(mk({ traits: [{ id: 'venin', ...(arg ? { arg } : {}) }] }))
      .find((s) => s.key === 'trait:venin')!.effects.flatMap((e) => spellEffectOps(e.flow));
    expect(opsDuVenin('difficile')).toEqual([{ op: 'condition', id: 'empoisonne', difficulte: 'difficile' }]);
    expect(opsDuVenin()).toEqual([{ op: 'condition', id: 'empoisonne' }]);
  });
  it('le Test qui élimine Empoisonné prend la Difficulté que l’État porte', () => {
    const difficulteDuTest = (c: Combatant) => effectSourcesOf(c).find((s) => s.key === 'cond:empoisonne')!.effects
      .map((e) => e.flow).find((f): f is Extract<Flow, { kind: 'test' }> => f.kind === 'test')!.test.difficulty;
    expect(difficulteDuTest(mk({ conditions: [{ id: 'empoisonne', value: 1, difficulte: 'tresDifficile' }] }))).toBe('tresDifficile');
    const sansDifficulte = mk({ conditions: [{ id: 'empoisonne', value: 1 }] });
    const auteur = findConditionById('empoisonne')!.effects!.map((e) => e.flow).find((f): f is Extract<Flow, { kind: 'test' }> => f.kind === 'test')!.test.difficulty;
    expect(difficulteDuTest(sansDifficulte)).toBe(auteur);
  });
});
