import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { inexplique } from './cascade.testkit';
import { rollLine, assertSeparabilite, SEPARABILITE, type RollLineCombat } from '../noyau/rollSeam';
import { openCombatEndCascade, openContractionCascade, openAttackCascade } from '../noyau/combatFlow';
import { resolveActGates } from '../noyau/combat/turnHooks';
import { forceCrewRole } from '../noyau/shipManeuver';
import { combatBaseValue, combatValue, combatValueMods, combineMods, type ModLine } from '../engine/combat';
import { combatTestPenalty, testStatePenalty, testStatePenaltyParts } from '../engine/conditions';
import { testValue, testValueParts, skillBaseValue, rawCombatTestBase } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { crewRoleValue } from '../engine/crewMorale';
import { clampTarget, exactDifficultyFromModifier } from '../engine/tests';
import { rule, setRule, resetRule } from '../engine/policy';
import { findCrewRoleById } from '../data';
import { RULE_REF } from '../engine/ruleRefs';
import { DIFFICULTY_MODIFIERS, DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { propulsionDuNavire } from '../engine/shipBuild';
import { refDeRegle } from '../engine/reglesChiffrees';

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/**
 * MONTEUR CANONIQUE — les sites de COMBAT (#1153 L1b). Chaque site migré est jugé sur DEUX grandeurs
 * indissociables, jamais relues du site :
 *  1. la CIBLE reste celle que `rollTest` jettera — RECALCULÉE ICI à la main depuis les jumelles du
 *     moteur (`combatValue`/`rawCombatTestBase` + `combatTestPenalty` + Difficulté, écrêtée par
 *     `clampTarget`) ;
 *  2. l'écart base→cible est INTÉGRALEMENT nommé (`inexplique === 0`) : plus une chip « autres ».
 * Chaque acteur PORTE un État (LDB 16) : sans lui, une base FONDUE se confondrait avec la valeur nue
 * et le test passerait sur un monteur faux.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Héros', kind: 'hero',
    characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 35, endurance: 40, initiative: 30, agilite: 30, dexterite: 32, intelligence: 40, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

/** État PORTÉ par toute fixture (LDB 16 : −10 par valeur) — c'est lui qui sépare la valeur NUE de la
 *  valeur jetée ; un acteur sain ne prouverait rien du canal. */
const ETAT = [{ id: 'empoisonne', value: 1 }] as never;

/** Effet ACTIF à `testMod` char-QUALIFIÉ : il vit DANS la valeur de combat (`combatValueModParts`) et
 *  PAS dans la pénalité d'États — c'est la composante qui distingue les deux canaux. */
const effetCT = [{ id: 'fx1', label: 'Mystracine', testModChar: 'capacite-de-tir', testMod: -10 }] as never;

const epee = { uid: 'w2', label: 'Épée', type: 'melee', damage: 4, qualities: [] } as never;

const arbalete = {
  uid: 'w1', label: 'Arbalète', type: 'ranged', damage: 4, qualities: [], reload: 1, range: 60,
} as never;

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle', party: combatants.filter((c) => c.kind === 'hero'),
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    },
    pendingHeal: null, pendingReload: null, pendingHandGate: null, pendingCascade: null,
  } as never);
}

beforeEach(() => { seedBattleRng(1); });

describe('Rechargement (combatSlice) — canal COMBAT du monteur', () => {
  it('base = valeur de combat NUE, l’effet char-qualifié est une chip NOMMÉE, cible INCHANGÉE', () => {
    const tireur = hero({
      id: 'tir', label: 'Tireur', conditions: ETAT, activeEffects: effetCT,
      skills: [{ id: 'projectiles', advances: 20, characteristic: 'capacite-de-tir' }] as never,
      weapons: [arbalete],
    });
    setBattle([tireur], 'tir');

    // ORACLE recalculé à la main depuis les jumelles du moteur (jamais relu du site).
    const nue = combatBaseValue(tireur, 'ranged', tireur.weapons[0]);
    const jetee = combatValue(tireur, 'ranged', tireur.weapons[0]);
    expect(jetee, 'l’effet char-qualifié sépare la nue de la valeur jetée — sinon le test ne prouve rien').toBeLessThan(nue);
    expect(jetee, 'la valeur de COMBAT n’est pas la valeur hors combat : le canal a un sens')
      .not.toBe(testValue(tireur, 'projectiles', 'capacite-de-tir'));

    get().battleReload();
    const pr = get().pendingReload!;
    expect(pr.target).toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS.intermediaire).target);

    const ligne = rollLine({ actor: tireur, difficulty: 'intermediaire', valeur: pr.skillValue, combat: { kind: 'ranged', weapon: tireur.weapons[0] } });
    expect(ligne.base, 'Niveau de combat NU (LDB 09 l.17 sur CC/CT + Spé du Groupe)').toBe(nue);
    expect(ligne.mods.reduce((s, m) => s + m.value, 0)).toBe(combatValueMods(tireur, 'ranged', tireur.weapons[0]));
    expect(inexplique({ ...ligne, difficulty: pr.difficulty }), 'aucune chip « autres »').toBe(0);
  });
});

describe('Main ensanglantée (`poserLeTestDeMain`) — cible montée sur la valeur de Test', () => {
  it('le gate de Dextérité se jette sur sa valeur de Test (`testValue`, États compris, LDB 16 l.125), cible = valeur + Accessible', () => {
    const brute = hero({ id: 'br', label: 'Brute', conditions: ETAT, handGates: ['main'] as never, weapons: [] });
    setBattle([brute], 'br');
    const dex = testValue(brute, undefined, 'dexterite');
    expect(dex, 'l’État sépare la Dextérité nue de la valeur jetée').toBeLessThan(effectiveChar(brute, 'dexterite'));

    openAttackCascade(get, set, { attackerId: 'br', targetId: 'br', location: null, result: null } as never, 'Attaquer', 'action/attack');
    const pg = get().pendingHandGate!;
    expect(pg.skillValue).toBe(dex);
    expect(pg.target).toBe(clampTarget(dex + DIFFICULTY_MODIFIERS.accessible).target);
    expect(inexplique({ base: pg.skillValue, target: pg.target, difficulty: pg.difficulty }), 'aucun écart muet').toBe(0);
  });
});

describe('Guérison en combat (combatSlice) — canal HORS COMBAT (`testValue`), inchangé', () => {
  it('cible = testValue + Difficulté, et le changement de mode la re-monte à l’identique', () => {
    const doc = hero({
      id: 'doc', label: 'Doc', conditions: ETAT,
      skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] as never,
    });
    const blesse = hero({ id: 'bl', label: 'Blessé', wounds: { current: 3, max: 12 }, conditions: [{ id: 'hemorragique', value: 2 }] as never, pos: { x: 2, y: 1 } });
    setBattle([doc, blesse], 'doc');

    const v = testValue(doc, 'guerison');
    const nue = skillBaseValue(doc, 'guerison');
    expect(v, 'l’État sépare la nue de la valeur jetée').toBeLessThan(nue);

    get().battleHeal('bl', 'wounds');
    const ph = get().pendingHeal!;
    expect(ph.target).toBe(clampTarget(v + DIFFICULTY_MODIFIERS[ph.difficulty]).target);

    get().healSetMode('bleed');
    const ph2 = get().pendingHeal!;
    expect(ph2.target).toBe(clampTarget(v + DIFFICULTY_MODIFIERS[ph2.difficulty]).target);

    const ligne = rollLine({ actor: doc, test: { skill: 'guerison' }, difficulty: ph2.difficulty, valeur: ph2.skillValue });
    expect(ligne.base).toBe(nue);
    expect(inexplique({ ...ligne, difficulty: ph2.difficulty })).toBe(0);
  });
});

describe('Fin de rencontre (combatFlow) — Contraction et Corruption', () => {
  it('Contraction hors combat (`openContractionCascade`) : base NUE, Hémorragique −10 à résister à l’Infection mineure (LDB 16 l.105)', () => {
    const patient = hero({
      id: 'pa', label: 'Patient', conditions: [{ id: 'hemorragique', value: 1 }] as never,
      skills: [{ id: 'resistance', advances: 10, characteristic: 'endurance' }] as never,
    });
    useGame.setState({ party: [patient], battle: null, pendingCascade: null } as never);
    const resVal = effectiveChar(patient, 'endurance') + 10; // `combatEndResistVal` : E effective + avances
    const diff: Difficulty = 'difficile';

    openContractionCascade(get, set, patient, 'infection-mineure', diff, 'Infection');
    // #1117 L4 : bande d'UN porteur — l'arithmétique du jet vit sur la RANGÉE.
    const row = get().pendingCascade!.participants[0].participants![0];
    expect(row.base).toBe(resVal);
    expect(row.target).toBe(clampTarget(resVal + DIFFICULTY_MODIFIERS[diff] - 10).target);
    expect(inexplique(row), 'aucune chip « autres »').toBe(0);
  });

  it('Cascade de fin de combat : Contraction ET Corruption portent la pénalité de COMBAT en chips NOMMÉES', () => {
    const survivant = hero({
      id: 'sv', label: 'Survivant', conditions: ETAT, tookCriticalThisFight: true,
      skills: [{ id: 'resistance', advances: 10, characteristic: 'endurance' }] as never,
    } as never);
    const bete = hero({ id: 'be', label: 'Bête', kind: 'enemy', dead: true, traits: [{ id: 'corruption', arg: 'mineure' }] } as never);
    setBattle([survivant, bete], 'sv');
    survivant.diseaseExposure = [{ disease: 'courante-galopante', difficulty: 'intermediaire' }] as never;

    openCombatEndCascade(get, set);
    const steps = get().pendingCascade?.participants ?? [];
    const penalite = combatTestPenalty(survivant);
    expect(penalite, 'l’État doit peser sur les Tests de COMBAT — sinon la fixture ne prouve rien').toBeLessThan(0);

    const maladie = steps.find((s) => s.kind === 'combatEndDisease')?.participants?.find((r) => r.id === 'sv');
    if (maladie) {
      const resVal = effectiveChar(survivant, 'endurance') + 10;
      expect(maladie.base).toBe(resVal);
      expect(maladie.target).toBe(clampTarget(resVal + DIFFICULTY_MODIFIERS[maladie.difficulty!] + penalite).target);
      expect(inexplique(maladie), 'la pénalité de combat est NOMMÉE, pas « autres »').toBe(0);
    }
    const corruption = steps.find((s) => s.kind === 'combatEndCorruption')?.participants?.find((r) => r.id === 'sv');
    if (corruption) {
      expect(corruption.base, 'base = Niveau de Compétence NU (l’État sort en chip)').toBe(skillBaseValue(survivant, 'resistance'));
      expect(corruption.target, 'pénalité de combat comptée UNE fois').toBe(clampTarget(rawCombatTestBase(survivant, 'resistance') + DIFFICULTY_MODIFIERS.intermediaire + penalite).target);
      expect(inexplique(corruption)).toBe(0);
    }
    // Les DEUX familles de BANDE doivent être produites, chacune avec la rangée du survivant (#1117 L4).
    // La fixture porte les DEUX entrées de Contraction (Blessure critique + exposition) : deux bandes.
    expect(steps.map((s) => s.kind), 'les DEUX familles de bande doivent être produites')
      .toEqual(['combatEndDisease', 'combatEndDisease', 'combatEndCorruption']);
    expect([maladie, corruption].map((r) => r?.id)).toEqual(['sv', 'sv']);
  });
});

describe('Gate d’Action par Round (combat/turnHooks) — canal COMBAT « Test »', () => {
  it('base = valeur de Test de combat BRUTE, la pénalité d’États est comptée UNE fois et nommée', () => {
    const porteur = hero({
      id: 'po', label: 'Porteur', conditions: ETAT,
      activeEffects: [{ id: 'racine', label: 'Racine de mandragore', actGate: { char: 'force-mentale' } }] as never,
    });
    setBattle([porteur], 'po');

    const brut = rawCombatTestBase(porteur, undefined, 'force-mentale');
    const penalite = combatTestPenalty(porteur);
    expect(penalite).toBeLessThan(0);
    expect(brut, 'la valeur BRUTE ne contient PAS la pénalité hors combat (sinon double compte)')
      .toBe(testValue(porteur, undefined, 'force-mentale') - testStatePenalty(porteur, undefined));

    resolveActGates(get, set, porteur);
    const step = (get().pendingCascade?.participants ?? []).find((s) => s.kind === 'actGate')!;
    expect(step.target).toBe(clampTarget(brut + DIFFICULTY_MODIFIERS.intermediaire + penalite).target);
    expect(step.base, 'base = Caractéristique NUE, tout le reste est en chips').toBe(effectiveChar(porteur, 'force-mentale'));
    expect(inexplique(step), 'aucune chip « autres »').toBe(0);
  });
});

describe('Résilience d’un contributeur d’équipage (shipManeuver) — cible INCHANGÉE', () => {
  it('cible = valeur du rôle + Difficulté (cumul : 2 crans plus dur), écrêtée comme `rollTest`', () => {
    const marin = hero({
      id: 'ma', label: 'Marin', conditions: ETAT,
      skills: [{ id: 'voile', spec: 'cogue', advances: 15, characteristic: 'agilite' }] as never,
    });
    const role = findCrewRoleById('timonier')!;
    const v = crewRoleValue(marin, role, NAVIGATION).value!;

    expect(forceCrewRole(marin, 'timonier', NAVIGATION)!.target).toBe(clampTarget(v + DIFFICULTY_MODIFIERS.intermediaire).target);
    const cumule = forceCrewRole(marin, 'timonier', NAVIGATION, true)!;
    expect(cumule.target).toBeLessThan(v);
    expect(inexplique({ base: v, target: cumule.target, mods: [{ label: 'Manque de bras', value: cumule.target - v, famille: 'jet' }] })).toBe(0);
  });

  it('ÉCRÊTAGE aux bornes : une valeur de rôle à 110 force un DR 9 (cible 99)', () => {
    // Un jet FORCÉ par la Résilience vise la MÊME cible qu'un jet roulé : `clampTarget`
    // (`engine/tests.ts`) la borne à `targetMax`, et le DR se compte sur cette cible (LDB 12 l.92).
    // `targetMax` vaut 99 tant que la règle optionnelle « Tests supérieurs à 100 % » (LDB 12
    // l.73-77, `test-over-100`) est inactive — c'est le régime par défaut mesuré ici.
    const barreur = hero({
      id: 'ba', label: 'Barreur', conditions: ETAT,
      characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 35, endurance: 40, initiative: 30, agilite: 105, dexterite: 32, intelligence: 40, 'force-mentale': 35, sociabilite: 30 },
      skills: [{ id: 'voile', spec: 'cogue', advances: 15, characteristic: 'agilite' }] as never,
    });
    const role = findCrewRoleById('timonier')!;
    expect(crewRoleValue(barreur, role, NAVIGATION).value, 'la fixture doit VRAIMENT franchir le plafond').toBe(110);

    const forcee = forceCrewRole(barreur, 'timonier', NAVIGATION)!;
    expect(forcee.target, 'plafond 99 — la même cible que celle du jet roulé').toBe(99);
    expect(forcee.sl, 'DR 9 : les dizaines de la cible ÉCRÊTÉE (99) moins celles du dé forcé').toBe(9);
  });
});

describe('ORACLE du canal combat — balayage EXHAUSTIF (#1153 L1b, sonde promue)', () => {
  /** Les composantes d'États sortent EN TÊTE de `testValueParts` — invariant POSITIONNEL dont dépend
   *  le `.slice()` de `partsHorsEtats` (`rollSeam.ts`). S'il tombait, le canal « Test de combat »
   *  retirerait les mauvaises lignes et l'oracle THROW ; ce test le dit AVANT, à l'endroit du fait. */
  it('les parts d’ÉTAT sont EN TÊTE de `testValueParts` (le découpage positionnel en dépend)', () => {
    const charge = hero({
      id: 'ch', label: 'Chargé', conditions: [{ id: 'empoisonne', value: 2 }] as never,
      skills: [{ id: 'natation', advances: 20, characteristic: 'force' }] as never,
      activeEffects: [{ id: 'malchance', label: 'Malédiction de malchance', testMod: -10 },
        // Part NON-État (mod de Test char-qualifié) : sans elle, l'ordre ne serait pas OBSERVABLE.
        { id: 'vigueur', label: 'Vigueur', testModChar: 'force', testMod: 10 }] as never,
    });
    const etats = testStatePenaltyParts(charge, 'natation').filter((p) => p.value !== 0);
    const toutes = testValueParts(charge, 'natation', undefined, undefined, undefined);
    expect(etats.length, 'la fixture doit produire des parts d’État').toBeGreaterThan(0);
    expect(toutes.length).toBeGreaterThanOrEqual(etats.length);
    expect(toutes.slice(0, etats.length).map((p) => [p.label, p.value]))
      .toEqual(etats.map((p) => [p.label, p.value]));
  });

  it('224 combinaisons (canal × État × effet × profil) : ZÉRO reconstruction en échec', () => {
    const CANAUX: { combat: RollLineCombat; test?: { skill?: string; char?: never | 'force-mentale' | 'dexterite' } }[] = [
      { combat: { kind: 'melee' } },
      { combat: { kind: 'melee', weapon: epee } },
      { combat: { kind: 'ranged' } },
      { combat: { kind: 'ranged', weapon: arbalete } },
      { combat: { kind: 'test' }, test: { char: 'force-mentale' } },
      { combat: { kind: 'test' }, test: { char: 'dexterite' } },
      { combat: { kind: 'test' }, test: { skill: 'resistance' } },
    ];
    const ETATS = [[], [{ id: 'empoisonne', value: 1 }], [{ id: 'empoisonne', value: 2 }], [{ id: 'sonne', value: 1 }]];
    const EFFETS = [
      [],
      [{ id: 'e1', label: 'Mystracine', testModChar: 'capacite-de-tir', testMod: -10 }],
      // Couple char-QUALIFIÉ : une ligne pour la mêlée, une pour le canal « Test de combat » (FM) — c'est
      // le seul jeu qui produit une part NON-État à côté d'une part d'État (le découpage positionnel s'y joue).
      [{ id: 'e2', label: 'Bénédiction', testModChar: 'capacite-de-combat', testMod: 10 },
        { id: 'e2b', label: 'Ferveur', testModChar: 'force-mentale', testMod: -10 }],
      [{ id: 'e3', label: 'Malédiction de malchance', testMod: -20 }],
    ];
    const PROFILS = [
      [],
      [{ id: 'projectiles', advances: 20, characteristic: 'capacite-de-tir' },
        { id: 'corps-a-corps', advances: 15, characteristic: 'capacite-de-combat' },
        { id: 'resistance', advances: 10, characteristic: 'endurance' }],
    ];

    const ko: string[] = [];
    let cas = 0;
    for (const c of CANAUX) {
      for (const [ie, etat] of ETATS.entries()) {
        for (const [ix, fx] of EFFETS.entries()) {
          for (const [ip, sk] of PROFILS.entries()) {
            cas += 1;
            const a = hero({ id: 'x', label: 'X', conditions: etat as never, activeEffects: fx as never, skills: sk as never, weapons: [arbalete, epee] });
            const nom = `${c.combat.kind}${'weapon' in c.combat && c.combat.weapon ? '+arme' : ''}/état${ie}/fx${ix}/profil${ip}`;
            try {
              // (1) valeur DÉRIVÉE par le canal, (2) MÊME valeur FOURNIE par l'appelant : les deux
              // passent par l'oracle, et doivent donner la MÊME ligne.
              const derive = rollLine({ actor: a, ...(c.test ? { test: c.test } : {}), difficulty: 'intermediaire', combat: c.combat });
              const valeur = derive.base + derive.mods.reduce((s, m) => s + m.value, 0);
              const fournie = rollLine({ actor: a, ...(c.test ? { test: c.test } : {}), difficulty: 'intermediaire', combat: c.combat, valeur });
              if (fournie.base !== derive.base) ko.push(`${nom} : base fournie ${fournie.base} ≠ dérivée ${derive.base}`);
              if (fournie.target !== derive.target) ko.push(`${nom} : cible fournie ${fournie.target} ≠ dérivée ${derive.target}`);
              // ORACLE : la ligne se réduit EXACTEMENT à la formule moteur du canal.
              const attendu = c.combat.kind === 'test'
                ? rawCombatTestBase(a, c.test?.skill, c.test?.char, undefined) + combatTestPenalty(a)
                : combatValue(a, c.combat.kind, c.combat.weapon);
              if (valeur !== attendu) ko.push(`${nom} : ${valeur} ≠ formule moteur ${attendu}`);
              const nue = c.combat.kind === 'test'
                ? skillBaseValue(a, c.test?.skill, undefined, c.test?.char)
                : combatBaseValue(a, c.combat.kind, c.combat.weapon);
              if (derive.base !== nue) ko.push(`${nom} : base ${derive.base} ≠ valeur NUE ${nue}`);
              if (inexplique({ ...derive, difficulty: 'intermediaire' }) !== 0) ko.push(`${nom} : écart muet`);
            } catch (e) {
              ko.push(`${nom} : THROW ${(e as Error).message.slice(0, 80)}`);
            }
          }
        }
      }
    }
    expect(cas, 'le balayage doit couvrir les 224 combinaisons annoncées').toBe(224);
    expect(ko, `Reconstructions en échec :\n${ko.join('\n')}`).toEqual([]);
  });

  it('`sense` transite des DEUX côtés du canal « Test de combat » — aucun THROW, ligne exacte', () => {
    // Le canal dérive sa valeur d'un côté et ses composantes de l'autre : si `sense` n'entrait que
    // dans l'un des deux, un Test sense-scopé (Surdité, LDB 18) ferait diverger les deux et l'oracle
    // refuserait un site pourtant juste.
    const sourd = hero({
      id: 'so', label: 'Sourd', conditions: ETAT,
      skills: [{ id: 'perception', advances: 20, characteristic: 'initiative' }] as never,
    });
    const ligne = rollLine({ actor: sourd, test: { skill: 'perception', sense: 'ouie' }, difficulty: 'intermediaire', combat: { kind: 'test' } });
    expect(ligne.base).toBe(skillBaseValue(sourd, 'perception'));
    expect(inexplique({ ...ligne, difficulty: 'intermediaire' })).toBe(0);
  });
});

describe('SONDES PROMUES (#1153 L1b) — ce que le monteur NE fait PAS encore', () => {
  it('l’oracle du monteur REFUSE le canal hors combat sur une valeur de COMBAT', () => {
    const tireur = hero({
      id: 'tir', label: 'Tireur', conditions: ETAT, activeEffects: effetCT,
      skills: [{ id: 'projectiles', advances: 20, characteristic: 'capacite-de-tir' }] as never,
      weapons: [arbalete],
    });
    const valeur = combatValue(tireur, 'ranged', tireur.weapons[0]);
    // Canal HORS COMBAT sur une valeur de combat : la reconstruction rate — en DEV, elle THROW.
    expect(() => rollLine({ actor: tireur, test: { char: 'capacite-de-tir' }, difficulty: 'intermediaire', valeur }))
      .toThrow(/ne se reconstruit pas/);
    // MÊME valeur par son canal : la ligne se monte et s'explique intégralement.
    const ligne = rollLine({ actor: tireur, difficulty: 'intermediaire', valeur, combat: { kind: 'ranged', weapon: tireur.weapons[0] } });
    expect(ligne.base).toBe(combatBaseValue(tireur, 'ranged', tireur.weapons[0]));
    expect(inexplique({ ...ligne, difficulty: 'intermediaire' })).toBe(0);
  });

  /**
   * MATRICE du mode plafonné (`LDB 14 l.91-96`) — les six régimes de la règle, jugés sur TROIS
   * grandeurs : la cible que le combat applique, la DIFFICULTÉ que la ligne annonce, et l'écart
   * base→cible intégralement nommé. Les plafonds sont lus de la POLICY
   * (`combat-diff-cap-bonus`/`-malus`, règles optionnelles), jamais écrits en dur : un jeu de
   * valeurs maison doit faire bouger l'attendu avec le moteur.
   *
   * DEUX formes d'annonce, une seule règle : `palier` = un CRAN de la table que les circonstances
   * composent exactement (RAW : « le Test devient simplement Très Difficile (-30) ») ; `combine` =
   * leur modificateur RÉEL quand il ne tombe sur aucun cran (l'échelle n'en nomme pas ; l'affichage
   * en fait « Combinée (+30) »). Dans les DEUX cas les circonstances quittent les chips et la
   * composition est portée par la Difficulté. Sans circonstance : rien à composer.
   */
  const capB = rule('combat-diff-cap-bonus') as number;
  const capM = rule('combat-diff-cap-malus') as number;
  const MATRICE: { nom: string; mods: ModLine[]; attendu: number; mord: boolean; palier?: Difficulty; combine?: number }[] = [
    { nom: 'aucun plafond ne mord (un mod au jet, une circonstance)', mods: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'À Terre', value: 20, famille: 'circonstance' }], attendu: 10, mord: false, palier: 'accessible' },
    { nom: 'MALUS de CIRCONSTANCES mordant (Σ −60)', mods: [{ label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Localisation visée', value: -20, famille: 'circonstance' }, { label: 'Main secondaire', value: -20, famille: 'circonstance' }], attendu: -capM, mord: true, palier: 'tresDifficile' },
    { nom: 'ÉTATS du JETEUR : la somme est SÈCHE, aucun plafond (Σ −50, `LDB 16 l.11`)', mods: [{ label: 'Sonné', value: -10, famille: 'jet' }, { label: 'Aveuglé', value: -20, famille: 'jet' }, { label: 'Empêtré', value: -20, famille: 'jet' }], attendu: -50, mord: false },
    { nom: 'BONUS mordant (Σ +80)', mods: [{ label: 'Viser', value: 40, famille: 'circonstance' }, { label: 'À Terre', value: 40, famille: 'circonstance' }], attendu: capB, mord: true, palier: 'tresFacile' },
    { nom: 'BONUS ET MALUS de circonstances mordants (les deux sommes plafonnent, puis s’ajoutent)', mods: [{ label: 'Viser', value: 40, famille: 'circonstance' }, { label: 'À Terre', value: 40, famille: 'circonstance' }, { label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Main secondaire', value: -20, famille: 'circonstance' }, { label: 'Obscurité', value: -20, famille: 'circonstance' }], attendu: capB - capM, mord: true, combine: capB - capM },
    { nom: 'AVANTAGE hors plafond, circonstances mordantes à côté', mods: [{ label: 'Avantage', value: 70, famille: 'jet' }, { label: 'Brouillard', value: -20, famille: 'circonstance' }, { label: 'Obscurité', value: -20, famille: 'circonstance' }], attendu: 70 - capM, mord: true, palier: 'tresDifficile' },
    { nom: 'AVANTAGE SEUL : rien à plafonner malgré une somme > +60', mods: [{ label: 'Avantage', value: 70, famille: 'jet' }], attendu: 70, mord: false },
  ];

  it.each(MATRICE)('MODE PLAFONNÉ — $nom', ({ mods, attendu, mord, palier, combine }) => {
    const somme = mods.reduce((s, m) => s + m.value, 0);
    expect(combineMods(mods), 'la matrice doit décrire la combinaison RÉELLE du moteur').toBe(attendu);
    expect(attendu !== somme, 'le régime annoncé (mordant ou non) doit être celui que le moteur produit').toBe(mord);

    const l = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods, plafond: 'difficultes' });
    expect(l.target).toBe(clampTarget(60 + attendu).target);
    expect(l.difficulty, 'la Difficulté annoncée par la ligne').toBe(palier ?? 'intermediaire');
    expect(l.difficultyCombined, 'le modificateur COMBINÉ ne paraît que hors des crans').toBe(combine);
    if (palier || combine != null) {
      // Difficulté COMPOSÉE : les circonstances (et l'écart du plafond) la font — elles quittent les
      // chips, et leur somme EST la valeur annoncée (le cran, ou le combiné).
      const parts = l.difficultyParts ?? [];
      expect(parts.reduce((s, m) => s + m.value, 0)).toBe(palier ? DIFFICULTY_MODIFIERS[palier] : combine);
      expect(parts.map((m) => m.label)).toEqual(expect.arrayContaining(mods.filter((m) => m.famille === 'circonstance').map((m) => m.label)));
      expect(l.mods.some((m) => m.famille === 'circonstance'), 'aucune circonstance restée en chip').toBe(false);
      expect(l.mods.map((m) => m.label)).toEqual(mods.filter((m) => m.famille !== 'circonstance').map((m) => m.label));
      if (mord) expect(parts.find((m) => m.label === 'plafond Difficultés')).toMatchObject({ value: attendu - somme, ref: RULE_REF['combiner-les-difficultes'] });
    } else {
      // Aucune circonstance à composer : la ligne garde sa Difficulté et TOUT se lit en chips.
      expect(l.difficultyParts).toBeUndefined();
      expect(l.mods.find((m) => m.label === 'plafond Difficultés'), 'aucune chip décorative quand rien n’est amputé').toBeUndefined();
    }
    expect(inexplique({ ...l }), 'aucune chip « autres »').toBe(0);

    // HORS mode : la somme reste BRUTE et AUCUNE composition ne se fait — le plafond (et la
    // Difficulté qu'il compose) est un régime de COMBAT, pas un défaut du monteur.
    const brut = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods });
    expect(brut.target).toBe(clampTarget(60 + somme).target);
    expect(brut.mods.some((m) => m.label === 'plafond Difficultés')).toBe(false);
    expect(brut.difficulty).toBe('intermediaire');
    expect(brut.difficultyCombined).toBeUndefined();
    expect(brut.difficultyParts).toBeUndefined();
    expect(inexplique({ ...brut })).toBe(0);
  });

  /**
   * HORS DES CRANS DE L'ÉCHELLE — `difficultyFromModifier` est un PLUS PROCHE VOISIN : un −15 y
   * trouve « Complexe (−10) » (MESURÉ), une Difficulté MENTEUSE de 5 points. Le monteur refuse ce
   * rabattage ; la circonstance ne retourne pas en chip pour autant (la ligne dirait alors une
   * Difficulté Intermédiaire que la situation contredit) : elle COMPOSE une Difficulté combinée que
   * l'affichage nomme telle quelle. Le −15 est celui que le combat produit RÉELLEMENT : bande de
   * portée Extrême (−30) halvée par le Talent Tireur embusqué (`sniperRangeAdjust`, appelé par
   * `attackModifiers` — la ligne reste une circonstance de la table).
   */
  it('MODE PLAFONNÉ — une circonstance hors cran (−15) COMPOSE une Difficulté combinée', () => {
    const mods: ModLine[] = [{ label: 'Distance extrême', value: -15, famille: 'circonstance', ref: refDeRegle('portee-d-une-arme') }];
    const l = rollLine({ difficulty: 'intermediaire', valeur: 60, surLaCible: mods, plafond: 'difficultes' });
    expect(l.difficulty, 'aucun cran ne vaut −15 : la Difficulté déclarée reste le porteur').toBe('intermediaire');
    expect(l.difficultyCombined, 'le modificateur RÉEL voyage tel quel').toBe(-15);
    expect(l.difficultyParts, 'la circonstance est absorbée par la Difficulté combinée').toEqual(mods);
    expect(l.mods, 'plus une seule chip : la Difficulté porte tout').toEqual([]);
    expect(l.target, 'la cible ne bouge pas d’un point').toBe(45);
    expect(inexplique({ ...l })).toBe(0);
  });

  /**
   * GARDE DE LA TRAPPE `rollStep` — l'étaleur d'étape ne relaie NI `difficulty` NI `difficultyParts`
   * (ses appelants posent la Difficulté eux-mêmes après l'étalement ; ils DÉCROISSENT à mesure que les
   * mints de la porte absorbent les montages — 18 mesurés au lot 2 V2, #1262). C'est SANS effet tant
   * qu'aucun d'eux n'ouvre le mode plafonné : lui seul dérive un palier. Le jour où un site
   * l'ouvrira, ses chips seraient amputées de leurs circonstances SANS le palier qui les porte →
   * écart « autres » à l'écran. La garde rougit à ce site-là, pas avant. STRUCTURELLE : elle lit le
   * SOURCE (l'appel et son objet-spec), jamais une liste tenue à la main.
   */
  it('TRAPPE — aucun appelant de `rollStep` n’ouvre le mode plafonné (sinon : relayer le palier)', () => {
    const sites: string[] = [];
    let vus = 0;
    for (const { rel, text: src } of readCorpus(['src'])) {
      // L'appel + son objet-spec (jusqu'à la parenthèse fermante de premier niveau, sur N lignes).
      for (const m of src.matchAll(/rollStep\(([\s\S]{0,600}?)\)\s*[,;)\]}]/g)) {
        vus++;
        if (/plafond\s*:/.test(m[1])) sites.push(`${rel} — ${m[1].slice(0, 80).replace(/\s+/g, ' ')}`);
      }
    }
    expect(vus, 'le scan doit VOIR des appels — un scan cassé rendrait la garde vide et verte').toBeGreaterThan(16);
    expect(sites, 'un appelant plafonné doit relayer `difficulty`/`difficultyParts` depuis `rollLine`').toEqual([]);
  });
});

/**
 * CONTRAT DE LA DIFFICULTÉ COMPOSÉE — sonde EXHAUSTIVE promue en garde (sonde du juge de design :
 * 7840 combinaisons, 0 échec ; élargie #1153 L4 aux modificateurs HORS crans et à un jeu de plafonds
 * maison). Elle ne juge AUCUN cas particulier : elle balaie le produit cartésien des régimes
 * (5 Difficultés déclarées × mode plafonné ou non × modificateurs sur et hors crans × familles ×
 * Avantage hors table × valeur de base écrêtante × plafond de la POLICY) et exige de CHAQUE ligne
 * montée les six invariants du lot :
 *
 *  1. la CIBLE est celle que le moteur applique — l'affichage ne déplace pas un point ;
 *  2. la ligne s'EXPLIQUE : `base + Σ chips + modificateur de la Difficulté AFFICHÉE + écrêtage ===
 *     cible` (l'arithmétique exacte de `reconciled` : reste ≠ 0 ⇒ chip « autres » à l'écran) ;
 *  3. la Difficulté composée ne ment jamais : sa composition SOMME au modificateur qu'elle annonce —
 *     le CRAN quand elle en nomme un, le COMBINÉ sinon (et alors aucun cran ne valait cette somme) ;
 *  4. en mode composé, plus AUCUNE circonstance ne reste en chip — la Difficulté les porte ;
 *  5. aucune composition hors mode plafonné, ni sans circonstance à composer ;
 *  6. jamais de combiné quand la Difficulté déclarée n'est pas neutre — un palier authoré ne se fait
 *     jamais avaler (gate explicite de `composeDifficulty`).
 *
 * La matrice ci-dessus vaut pour ses six régimes ; ce balayage vaut pour la RÈGLE — une régression
 * d'une condition de composition y rougit sans qu'on ait à deviner la fixture qui la révèle.
 */
describe('DIFFICULTÉ COMPOSÉE — contrat balayé sur tout le produit cartésien des régimes (#1153)', () => {
  /** Crans de la table (`LDB 14`), des deux signes — plus un −15 HORS cran (bande de portée Extrême
   *  halvée par Tireur embusqué), qui ne peut se dire qu'en Difficulté combinée. */
  const VALEURS = [-40, -30, -20, -15, -10, 10, 20, 40, 60];
  const FAMILLES = ['circonstance', 'jet'] as const;
  /** Difficultés DÉCLARÉES : Intermédiaire (le combat, `LDB 13 l.118`) et quatre autres — un site
   *  qui déclare la sienne doit la GARDER, la composition ne peut pas l'avaler. */
  const DIFFICULTES: Difficulty[] = ['intermediaire', 'accessible', 'difficile', 'tresDifficile', 'facile'];
  /** 45 = cible confortable ; 95 = régime où `clampTarget` mord (l'écrêtage doit rester nommable). */
  const BASES = [45, 95];
  const total = (mods: ModLine[]): number => mods.reduce((s, m) => s + m.value, 0);

  afterEach(() => { resetRule('combat-diff-cap-malus'); });

  const echecs: string[] = [];
  let cas = 0;
  let composees = 0;
  let combinees = 0;

  const juge = (difficulty: Difficulty, valeur: number, mods: ModLine[], plafond: boolean) => {
    cas++;
    const l = rollLine({ difficulty, valeur, surLaCible: mods, ...(plafond ? { plafond: 'difficultes' as const } : {}) });
    const ou = `${difficulty}/${valeur}/${plafond ? 'plafonné' : 'brut'}/${JSON.stringify(mods.map((m) => `${m.value} ${m.famille}`))}`;

    // 1. CIBLE : la combinaison du moteur, écrêtée par la primitive du jet.
    const combine = plafond ? combineMods(mods) : total(mods);
    const attendue = clampTarget(valeur + DIFFICULTY_MODIFIERS[difficulty] + combine).target;
    if (l.target !== attendue) echecs.push(`CIBLE ${ou} → ${l.target} ≠ ${attendue}`);

    // 2. La ligne s'EXPLIQUE intégralement (`inexplique` juge la MÊME arithmétique que l'écran).
    if (inexplique({ ...l }) !== 0) echecs.push(`INEXPLIQUÉ ${ou} → reste ${inexplique({ ...l })}`);

    // 6. Une Difficulté DÉCLARÉE non neutre n'est jamais avalée : ni cran composé, ni combiné.
    if (DIFFICULTY_MODIFIERS[difficulty] !== 0 && (l.difficulty !== difficulty || l.difficultyCombined != null)) {
      echecs.push(`DÉCLARÉE AVALÉE ${ou} → ${l.difficulty}/${l.difficultyCombined}`);
    }

    if (!l.difficultyParts) {
      if (l.difficultyCombined != null) echecs.push(`COMBINÉ SANS COMPOSITION ${ou}`);
      return;
    }
    composees++;
    // 3. La Difficulté composée ne ment pas : sa composition somme au modificateur qu'elle annonce.
    if (l.difficultyCombined != null) {
      combinees++;
      if (total(l.difficultyParts) !== l.difficultyCombined) {
        echecs.push(`COMBINÉ MENTEUR ${ou} → composition ${total(l.difficultyParts)} ≠ ${l.difficultyCombined}`);
      }
      if (exactDifficultyFromModifier(l.difficultyCombined)) {
        echecs.push(`COMBINÉ ALORS QU'UN CRAN EXISTE ${ou} → ${l.difficultyCombined}`);
      }
      if (l.difficulty !== difficulty) echecs.push(`COMBINÉ SUR UNE AUTRE DIFFICULTÉ ${ou} → ${l.difficulty}`);
    } else if (total(l.difficultyParts) !== DIFFICULTY_MODIFIERS[l.difficulty]) {
      echecs.push(`CRAN MENTEUR ${ou} → composition ${total(l.difficultyParts)} ≠ ${DIFFICULTY_MODIFIERS[l.difficulty]} (${l.difficulty})`);
    }
    // 4. Aucune circonstance laissée en chip quand la Difficulté les porte.
    if (l.mods.some((m) => m.famille === 'circonstance')) echecs.push(`CIRCONSTANCE EN CHIP ${ou}`);
    // 5. Jamais de composition hors mode plafonné, ni sans circonstance à composer.
    if (!plafond) echecs.push(`COMPOSITION HORS MODE PLAFONNÉ ${ou}`);
    if (!l.difficultyParts.some((m) => m.famille === 'circonstance')) echecs.push(`COMPOSITION SANS CIRCONSTANCE ${ou}`);
  };

  const balaye = () => {
    for (const d of DIFFICULTES) {
      for (const plafond of [true, false]) {
        for (const a of VALEURS) {
          for (const fa of FAMILLES) {
            juge(d, 45, [{ label: 'A', value: a, famille: fa }], plafond);
            for (const b of VALEURS) {
              for (const fb of FAMILLES) {
                const paire: ModLine[] = [{ label: 'A', value: a, famille: fa }, { label: 'B', value: b, famille: fb }];
                for (const base of BASES) juge(d, base, paire, plafond);
                // Avantage : hors table de Difficulté (`LDB 14 l.48`), donc `famille: 'jet'`.
                juge(d, 45, [...paire, { label: 'Avantage', value: 60, famille: 'jet' }], plafond);
              }
            }
          }
        }
      }
    }
  };

  it('six invariants, sur des milliers de combinaisons : aucune ligne ne ment ni ne cache', () => {
    balaye();
    expect(cas, 'le balayage doit couvrir des milliers de cas — un produit tronqué ne prouve rien').toBeGreaterThan(7000);
    expect(composees, 'il doit VRAIMENT produire des Difficultés composées, sinon il ne juge que le repli').toBeGreaterThan(100);
    expect(combinees, 'et de VRAIES combinées hors crans, sinon la moitié du contrat n’est pas jugée').toBeGreaterThan(100);
    expect(echecs.slice(0, 20)).toEqual([]);
  });

  /** Le plafond est une DONNÉE de policy (`combat-diff-cap-malus`), pas une constante : sous un jeu
   *  maison à −50 (l'échelle EDO descend jusqu'à « Impossible (−50) »), la MÊME règle doit tenir —
   *  et une somme amputée à −50 y trouve un cran là où −30 n'en trouvait plus. */
  it('les six invariants tiennent avec un plafond de POLICY à −50 (échelle étendue EDO)', () => {
    setRule('combat-diff-cap-malus', 50);
    cas = 0; composees = 0; combinees = 0; echecs.length = 0;
    balaye();
    expect(combineMods([{ label: 'A', value: -40, famille: 'circonstance' }, { label: 'B', value: -40, famille: 'circonstance' }]), 'la policy doit VRAIMENT avoir bougé').toBe(-50);
    expect(cas).toBeGreaterThan(7000);
    expect(composees).toBeGreaterThan(100);
    expect(echecs.slice(0, 20)).toEqual([]);
  });
});

/**
 * ÉTANCHÉITÉ du mot « Combinée » et du champ dérivé (#1153) — la Difficulté combinée est un fait
 * d'AFFICHAGE : le mot vit dans le catalogue i18n et dans sa SEULE maison, `noyau/difficultyText.ts`, qui le
 * met en mots pour tout hôte ; nulle part ailleurs, et l'échelle de la règle reste à NEUF crans (`LDB 14`, EDO
 * App.2 comprise). Le modificateur combiné, lui, est DÉRIVÉ par le monteur : aucun site ne peut le déclarer à
 * l'entrée ni l'écrire en donnée. STRUCTURELLE : elle lit les SOURCES, jamais une liste tenue à la main.
 */
describe('DIFFICULTÉ COMBINÉE — étanchéité du vocabulaire et du champ dérivé (#1153)', () => {
  it('l’échelle de Difficulté reste à NEUF crans — « combinee » n’en est pas un', () => {
    expect(Object.keys(DIFFICULTY_MODIFIERS)).toHaveLength(9);
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(9);
    expect(Object.keys(DIFFICULTY_MODIFIERS)).not.toContain('combinee');
    expect(Object.keys(DIFFICULTY_LABELS)).not.toContain('combinee');
  });

  /** Ce qui est interdit hors de la maison et du catalogue, c'est de MANIPULER le mot : un littéral de
   *  chaîne, une clé, un id. Le mot en COMMENTAIRE reste légitime (il explique ce que l'affichage en fera) :
   *  le scan neutralise donc les commentaires avant de chercher. Les couches sans prose (`src/engine`,
   *  `src/state`, `src/noyau`) refusent toute forme, accents et casse confondus ; ailleurs, le mot se cherche
   *  comme libellé (« Combinée », « COMBINÉE ») ou comme clé/id sans accent (`difficulty.combinee`), car
   *  l'adjectif minuscule accentué d'une prose (« tête combinée » d'un descriptif d'arme) n'est pas le mot de
   *  la Difficulté. Les deux exemptions se nomment par chemin. */
  const MAISON = 'src/noyau/difficultyText.ts';
  const CATALOGUE = 'src/i18n/messages/fr.ts';
  const COUCHES_SANS_PROSE = ['src/engine/', 'src/state/', 'src/noyau/'];
  const sansCommentaires = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  // Les LITTÉRAUX de chaîne du code restant (simples, doubles, gabarits) — c'est là que le mot
  // deviendrait une donnée.
  const litteraux = (src: string): string[] => [...sansCommentaires(src).matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '');
  const motifDe = (rel: string): RegExp =>
    COUCHES_SANS_PROSE.some((c) => rel.startsWith(c)) ? /combin[ée]e/i : /combinee|Combin[ée]e|COMBIN[ÉE]E/;
  const porteLeMot = (f: { rel: string; text: string }): boolean => litteraux(f.text).some((s) => motifDe(f.rel).test(s));
  const fuit = (f: { rel: string; text: string }): boolean => f.rel !== MAISON && f.rel !== CATALOGUE && porteLeMot(f);

  it('le mot ne se MANIPULE que dans sa maison, `noyau/difficultyText.ts`, et le catalogue i18n', () => {
    const fichiers = readCorpus(['src']);
    expect(fichiers.length, 'le scan doit VOIR des fichiers — un scan cassé serait vert à vide').toBeGreaterThan(1000);
    expect(fichiers.filter(fuit).map((f) => f.rel)).toEqual([]);
    // Le scan MORD : le même détecteur trouve le mot dans la maison et dans le catalogue, sinon il ne mesure rien.
    expect(fichiers.filter(porteLeMot).map((f) => f.rel).sort()).toEqual([CATALOGUE, MAISON]);
  });

  it('le scan MORD sur toute forme dans les couches sans prose, et sur le libellé partout ailleurs', () => {
    expect(fuit({ rel: 'src/noyau/sonde.ts', text: "const s = 'difficulté combinée (+10)';" })).toBe(true);
    expect(fuit({ rel: 'src/engine/sonde.ts', text: "const s = 'CombinÉe';" })).toBe(true);
    expect(fuit({ rel: 'src/state/sonde.ts', text: 'const s = `combinee`;' })).toBe(true);
    expect(fuit({ rel: 'src/ui/sonde.tsx', text: "const s = 'Combinée (+10)';" })).toBe(true);
    expect(fuit({ rel: 'src/ui/sonde.tsx', text: "const s = 'difficulty.combinee';" })).toBe(true);
    expect(fuit({ rel: 'src/gameIso/sonde.ts', text: "const s = 'tête combinée';" })).toBe(false);
    expect(fuit({ rel: 'src/noyau/sonde.ts', text: '// la Difficulté combinée' })).toBe(false);
    expect(fuit({ rel: MAISON, text: "const s = 'combinée';" })).toBe(false);
  });

  it('`difficultyCombined` est DÉRIVÉ : absent de la déclaration d’entrée et de toute donnée', () => {
    const seam = readFileSync(resolve(__dirname, '../noyau/rollSeam.ts'), 'utf8');
    const decl = seam.slice(seam.indexOf('interface RollLineBase'), seam.indexOf('export type RollLineSpec'));
    expect(decl.length, 'le découpage doit VOIR la déclaration d’entrée').toBeGreaterThan(200);
    expect(decl).not.toContain('difficultyCombined');
    const data = resolve(__dirname, '../data');
    const json = listerDossier(data).filter((f) => f.endsWith('.json'));
    expect(json.length).toBeGreaterThan(10);
    const enDonnee = json.filter((f) => readFileSync(join(data, f), 'utf8').includes('difficultyCombined'));
    expect(enDonnee).toEqual([]);
  });
});

/**
 * INVARIANT DE SÉPARABILITÉ (#1153) — la partition des modificateurs en DEUX familles (entrées de la
 * table plafonnées / modificateurs du jeteur hors plafond) est un ARBITRAGE #1218 : `LDB 14 l.95`
 * énonce la combinaison sans dire d'où vient chaque modificateur. C'est cet arbitrage qui autorise le
 * monteur à couper la ligne en deux (Difficulté composée d'un côté, chips du jeteur de l'autre), et
 * `combineMods` qui l'applique. Une combinaison qui mordrait AUSSI les mods du jeteur laisserait le
 * TOTAL juste et la Difficulté fausse — un mensonge muet.
 *
 * Le mock de MODULE est interdit ici (`isolate: false`, garde `src/vi-mock-isolate-guard.test.ts`) :
 * la régression se simule en appelant l'invariant avec une combinaison qui ment, et le CÂBLAGE se
 * mesure sur le SOURCE du monteur (même technique que la garde de la trappe `rollStep`).
 */
describe('SÉPARABILITÉ du plafond — le monteur refuse une combinaison qui déborde (#1153)', () => {
  const mods: ModLine[] = [
    { label: 'Brouillard', value: -20, famille: 'circonstance' },
    { label: 'Sonné', value: -20, famille: 'jet' },
  ];

  it('THROW quand la combinaison ampute AUSSI les modificateurs du jeteur', () => {
    // −30 au lieu de −40 : un plafond qui aurait mordu les deux familles. Les circonstances valent
    // toujours −20 → 10 points remboursés en douce à la Difficulté.
    expect(() => assertSeparabilite(mods, -30, -20)).toThrow(/n’est pas séparable|n'est pas séparable/);
  });

  it('MUET quand elle se sépare — le vrai `combineMods` est dans ce cas', () => {
    expect(() => assertSeparabilite(mods, combineMods(mods), combineMods(mods.filter((m) => m.famille === 'circonstance')))).not.toThrow();
    expect(combineMods(mods), 'le moteur RÉEL sépare bien les deux familles').toBe(-40);
  });

  /** CÂBLAGE mesuré à l'EXÉCUTION : un appel présent dans le source peut être commenté, déplacé dans
   *  une branche morte ou masqué par un `if` — seul le compteur d'invocations RÉELLES prouve que
   *  chaque ligne plafonnée y passe. */
  it('CÂBLÉ : chaque ligne plafonnée passe RÉELLEMENT par l’invariant (compteur d’exécution)', () => {
    const avant = SEPARABILITE.vus;
    rollLine({ difficulty: 'intermediaire', valeur: 55, surLaCible: mods, plafond: 'difficultes' });
    rollLine({ difficulty: 'intermediaire', valeur: 55, surLaCible: mods, plafond: 'difficultes' });
    expect(SEPARABILITE.vus - avant, 'une ligne plafonnée = un passage par l’invariant').toBe(2);
    // HORS mode plafonné il n'y a rien à séparer : la garde ne doit pas s'inviter.
    const horsMode = SEPARABILITE.vus;
    rollLine({ difficulty: 'intermediaire', valeur: 55, surLaCible: mods });
    expect(SEPARABILITE.vus - horsMode).toBe(0);
  });
});
