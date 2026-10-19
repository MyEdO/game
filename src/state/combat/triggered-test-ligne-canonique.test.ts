import { describe, it, expect, beforeEach } from 'vitest';
import { seedBattleRng, battleRng } from '../../noyau/battleRng';
import { simpleTriggeredTestStep, simpleBatchTestStep, frozenOpposedBatchStep, rollFrozenOpposedAttacker, withDerivedStake } from './triggeredTest';
import { inexplique } from '../cascadeTestKit';
import { EMPTY_FLOW, type FlowTest } from '../../noyau/monde/flow';
import { rollStep } from '../../noyau/rollSeam';
import { combatTestPenalty } from '../../engine/conditions';
import { testValue, rawCombatTestBase, skillBaseValue } from '../../engine/skills';
import { clampTarget, evaluateTest, rollTest } from '../../engine/tests';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../../engine/types';

/**
 * LIGNE des étapes produites par le canal `triggeredTest` (#1153 L3) — les quatre producteurs de ce
 * module montent leur ligne par le MONTEUR CANONIQUE (`rollSeam.rollStep`). Deux grandeurs jugées
 * ensemble, aucune relue du site :
 *  1. la CIBLE, RECALCULÉE ICI depuis les jumelles du moteur — canal COMBAT pour les Tests SIMPLES
 *     (`rawCombatTestBase` + `combatTestPenalty`), convention HORS COMBAT pour les Tests OPPOSÉS
 *     (`testValue`) ;
 *  2. la `base` est la valeur NUE (`skillBaseValue`, `LDB 09 l.17`), grandeur du départage à DR égal
 *     (`LDB 12 l.160`), et l'écart base→cible est INTÉGRALEMENT nommé (`inexplique === 0`).
 *
 * PORTÉE EXACTE DE LA NON-DÉRIVE — la cible STOCKÉE est identique à l'ancienne arithmétique DANS les
 * bornes de `TestPolicy` ; AU-DELÀ elle devient la cible JOUÉE (l'ancienne stockait 110 là où
 * `rollTest` jetait sur 99), et l'écart est nommé par `clamped`. Le JET, lui, ne change dans aucun des
 * deux régimes : `rollTest` ré-écrêtait déjà. « Bit-identique » vaut donc pour l'issue du jet, pas pour
 * le nombre stocké hors bornes — c'est le mensonge que la migration supprime.
 *
 * Chaque acteur PORTE un État : sans lui la nue se confondrait avec la valeur jetée et le test
 * passerait sur un monteur faux.
 */

const CHARS = {
  'capacite-de-combat': 35, 'capacite-de-tir': 40, force: 45, endurance: 42, initiative: 30,
  agilite: 30, dexterite: 32, intelligence: 40, 'force-mentale': 35, sociabilite: 30,
};

function actor(p: Partial<Combatant> & { id: string }): Combatant {
  return {
    label: p.id, kind: 'hero', characteristics: { ...CHARS },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'resistance', advances: 8, characteristic: 'endurance' }],
    talents: [], fortune: 0, resilience: 0, pos: { x: 1, y: 1 }, ...p,
  } as unknown as Combatant;
}

/** Les postures d'État de la sonde : sain, États généraux (Sonné, Exténué, Brisé), État restreint à
 *  un sens (Aveuglé, LDB 16 l.45), et un cumul qui exerce le pool de non-cumul (`LDB 16 l.13`). */
const POSTURES: { nom: string; conditions: unknown[] }[] = [
  { nom: 'sain', conditions: [] },
  { nom: 'Sonné', conditions: [{ id: 'sonne', value: 1 }] },
  { nom: 'Aveuglé', conditions: [{ id: 'aveugle', value: 1 }] },
  { nom: 'Sonné×3', conditions: [{ id: 'sonne', value: 3 }] },
  { nom: 'Exténué×2+Sonné', conditions: [{ id: 'extenue', value: 2 }, { id: 'sonne', value: 1 }] },
  { nom: 'Brisé', conditions: [{ id: 'brise', value: 1 }] },
];

/** TOUS les crans de l'échelle de Difficulté (`LDB 14`) — c'est leur amplitude qui pousse certaines
 *  combinaisons HORS des bornes, le régime que la nuance de portée ci-dessus décrit. */
const TOUS_CRANS = Object.keys(DIFFICULTY_MODIFIERS) as Difficulty[];
const DIFFS: Difficulty[] = ['intermediaire', 'difficile'];

/** PORTEUR de la sonde : un `FlowTest` de donnée n'est jamais orphelin — il est exigé par une entité,
 *  et c'est d'elle que son enjeu se DÉRIVE (#1262 V2 L6d). Les deux descripteurs ci-dessous passent
 *  donc par la MÊME porte que la production (`withDerivedStake`). */
const PORTEUR = { kind: 'condition', id: 'empoisonne' } as const;
const FT: FlowTest = withDerivedStake({ skill: { id: 'resistance' }, label: 'Résister' }, PORTEUR);
const FT_OPP: FlowTest = withDerivedStake({ skill: { id: 'resistance' }, label: 'Résister', opposed: { attacker: 'force' } }, PORTEUR);
const BRANCHES = { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW };

beforeEach(() => { seedBattleRng(1); });

describe('G1 — non-dérive de cible : chaque producteur rend la cible des jumelles du moteur', () => {
  it('MONO SIMPLE (`simpleTriggeredTestStep`) : cible = rawCombatTestBase + Difficulté + combatTestPenalty', () => {
    for (const p of POSTURES) {
      for (const d of DIFFS) {
        const c = actor({ id: `mono-${p.nom}-${d}`, conditions: p.conditions as never });
        const st = simpleTriggeredTestStep(c, FT, BRANCHES, EMPTY_FLOW, d)!;
        const attendu = rawCombatTestBase(c, FT.skill?.id) + DIFFICULTY_MODIFIERS[d] + combatTestPenalty(c);
        expect(st.target, `${p.nom}/${d}`).toBe(clampTarget(attendu).target);
        expect(st.base, `${p.nom}/${d} : la base est la NUE`).toBe(skillBaseValue(c, FT.skill?.id));
        expect(st.difficulty, `${p.nom}/${d} : la Difficulté voyage en donnée de ligne`).toBe(d);
        expect(inexplique(st), `${p.nom}/${d} : écart base→cible non nommé`).toBe(0);
      }
    }
  });

  it('BANDE SIMPLE (`simpleBatchTestStep`) : MÊME cible que la voie mono, par rangée', () => {
    for (const p of POSTURES) {
      for (const d of DIFFS) {
        const c = actor({ id: `batch-${p.nom}-${d}`, conditions: p.conditions as never });
        const st = simpleBatchTestStep([c], FT, BRANCHES, EMPTY_FLOW, d, 'bande')!;
        const row = st.participants![0];
        const attendu = rawCombatTestBase(c, FT.skill?.id) + DIFFICULTY_MODIFIERS[d] + combatTestPenalty(c);
        expect(row.target, `${p.nom}/${d}`).toBe(clampTarget(attendu).target);
        expect(row.base, `${p.nom}/${d} : la base est la NUE`).toBe(skillBaseValue(c, FT.skill?.id));
        expect(inexplique(row), `${p.nom}/${d} : écart base→cible non nommé`).toBe(0);
        expect(row.target, 'la bande et le mono tiennent la MÊME règle')
          .toBe(simpleTriggeredTestStep(c, FT, BRANCHES, EMPTY_FLOW, d)!.target);
      }
    }
  });

  it('BANDE OPPOSÉE (`frozenOpposedBatchStep`) : cible = testValue + Difficulté (aucune pénalité ajoutée)', () => {
    for (const p of POSTURES) {
      for (const d of DIFFS) {
        const def = actor({ id: `opp-${p.nom}-${d}`, conditions: p.conditions as never });
        const att = actor({ id: `att-${p.nom}-${d}` });
        const aT = rollFrozenOpposedAttacker(att, FT_OPP.opposed!, d);
        const st = frozenOpposedBatchStep([def], FT_OPP, BRANCHES, EMPTY_FLOW, d, att, aT)!;
        const row = st.participants![0];
        expect(row.target, `${p.nom}/${d}`).toBe(clampTarget(testValue(def, FT_OPP.skill?.id) + DIFFICULTY_MODIFIERS[d]).target);
        expect(row.base, `${p.nom}/${d} : la base est la NUE`).toBe(skillBaseValue(def, FT_OPP.skill?.id));
        expect(inexplique(row), `${p.nom}/${d} : écart base→cible non nommé`).toBe(0);
      }
    }
  });

  it('ATTAQUANT FIGÉ (`rollFrozenOpposedAttacker`) : cible = testValue + Difficulté, base = NUE', () => {
    for (const p of POSTURES) {
      for (const d of DIFFS) {
        const att = actor({ id: `frozen-${p.nom}-${d}`, conditions: p.conditions as never });
        seedBattleRng(4);
        const aT = rollFrozenOpposedAttacker(att, FT_OPP.opposed!, d);
        expect(aT.target, `${p.nom}/${d}`).toBe(clampTarget(testValue(att, undefined, 'force') + DIFFICULTY_MODIFIERS[d]).target);
        expect(aT.base, `${p.nom}/${d} : le jet figé porte sa NUE`).toBe(skillBaseValue(att, undefined, undefined, 'force'));
      }
    }
  });
});

describe('G2 — anti-piège de canal : la voie OPPOSÉE n’emprunte pas `combat:{kind:test}`', () => {
  it('porteur sous AURA seule : la cible opposée reste celle de `testValue`, pas celle du canal combat', () => {
    const c = actor({ id: 'aura-seule', auraMods: [{ op: { op: 'testMod', amount: -20 } }] } as never);
    // L'aura de combat (LDB 85 l.262) PÈSE dans le canal combat et PAS dans `testValue` — c'est ce qui
    // rend les deux conventions distinguables sur ce porteur, et donc la garde capable de mordre.
    const combat = rawCombatTestBase(c, 'resistance') + combatTestPenalty(c);
    const horsCombat = testValue(c, 'resistance');
    expect(horsCombat, 'sonde inerte : sans écart mesurable, la garde ne prouverait rien').toBeGreaterThan(combat);

    const att = actor({ id: 'att-aveugle' });
    const aT = rollFrozenOpposedAttacker(att, FT_OPP.opposed!, 'intermediaire');
    const row = frozenOpposedBatchStep([c], FT_OPP, BRANCHES, EMPTY_FLOW, 'intermediaire', att, aT)!.participants![0];
    expect(row.target, 'la rangée opposée jette sur `testValue` (l’aura n’y pèse pas)').toBe(horsCombat);
    expect(row.target).not.toBe(combat);
  });
});

describe('G3 — la ligne d’une étape MONO s’explique en entier', () => {
  it('Difficulté ≠ Intermédiaire + État : la Difficulté est posée, l’État est une chip NOMMÉE, zéro reste', () => {
    const c = actor({ id: 'explique', conditions: [{ id: 'sonne', value: 1 }] as never });
    const st = simpleTriggeredTestStep(c, FT, BRANCHES, EMPTY_FLOW, 'difficile')!;
    expect(st.difficulty).toBe('difficile');
    // La chip d'État est NOMMÉE par son entité (`combatTestPenaltyParts`), jamais un −10 anonyme.
    const etat = (st.mods ?? []).filter((m) => m.value === combatTestPenalty(c) && combatTestPenalty(c) !== 0);
    expect(etat.length, 'la pénalité d’État doit apparaître en ligne nommée').toBeGreaterThan(0);
    expect(etat[0].label, 'la chip porte le nom de son entité').toBeTruthy();
    // `inexplique` est la grandeur que le réconciliateur de `RollLine` rendrait en chip « autres »
    // (sonde `ui/RollLine.ANONYMES`) : à zéro, aucune ligne anonyme ne peut naître de cette étape.
    expect(inexplique(st)).toBe(0);
  });
});

describe('G7 — écrêtage : la cible STOCKÉE devient la cible JOUÉE, et l’écart se NOMME', () => {
  it('nue > 99 après Difficulté : `clamped` posé, cible stockée === cible jouée, zéro reste', () => {
    const colosse = actor({
      id: 'colosse',
      characteristics: { ...CHARS, endurance: 120 } as never,
      skills: [{ id: 'resistance', advances: 30, characteristic: 'endurance' }] as never,
    });
    const st = simpleTriggeredTestStep(colosse, FT, BRANCHES, EMPTY_FLOW, 'facile')!;
    const brut = rawCombatTestBase(colosse, 'resistance') + DIFFICULTY_MODIFIERS.facile + combatTestPenalty(colosse);
    const { target, clamped } = clampTarget(brut);
    expect(brut, 'sonde inerte : sans dépassement, l’écrêtage ne se mesurerait pas').toBeGreaterThan(target);
    expect(st.clamped, 'l’écrêtage MESURÉ est posé sur l’étape').toBe(clamped);
    expect(st.target).toBe(target);
    expect(st.target, 'l’ancienne arithmétique stockait la cible NON écrêtée — c’est ce mensonge qui tombe').not.toBe(brut);
    // Le résolveur générique jette sur `step.target` (`rollBatchParticipant`/`FLOWS.cascade`) : le d100
    // est donc évalué contre EXACTEMENT la cible portée, sans second écrêtage divergent.
    expect(evaluateTest(50, st.target!).target).toBe(st.target);
    expect(inexplique(st), 'l’écrêtage est nommé, pas avoué « autres »').toBe(0);
  });
});

/**
 * SONDE PROMUE (54 combinaisons — 6 postures d'État × les 9 crans de `LDB 14`) sur les trois
 * producteurs, plus la BIT-IDENTITÉ du jet de l'attaquant figé à la graine. Deux régimes, tous deux
 * assertés :
 *  - DANS les bornes : la cible du monteur est EXACTEMENT l'ancienne arithmétique ;
 *  - HORS bornes : elle est la cible JOUÉE (l'ancienne mentait), l'écart est porté par `clamped`, et
 *    le jet reste le même parce que `rollTest` écrêtait déjà. Le compteur de divergences est asserté
 *    NON NUL : sans lui, la nuance de portée ne serait qu'une affirmation.
 */
describe('SONDE PROMUE — la matrice complète des postures × crans de Difficulté', () => {
  it('les trois producteurs suivent l’ancienne arithmétique DANS les bornes, la cible jouée au-delà', () => {
    let horsBornes = 0;
    for (const p of POSTURES) {
      for (const d of TOUS_CRANS) {
        const c = actor({ id: 'x', conditions: p.conditions as never });
        const ancienne = rawCombatTestBase(c, FT.skill?.id) + DIFFICULTY_MODIFIERS[d] + combatTestPenalty(c);
        const borne = clampTarget(ancienne);
        const st = simpleTriggeredTestStep(c, FT, BRANCHES, EMPTY_FLOW, d)!;
        const bande = simpleBatchTestStep([c], FT, BRANCHES, EMPTY_FLOW, d, 'b')!.participants![0];
        const cle = `${p.nom}/${d}`;

        expect(st.target, cle).toBe(borne.target);
        expect(bande.target, `${cle} : bande ≠ mono`).toBe(st.target);
        expect(inexplique(st), `${cle} : mono inexpliqué`).toBe(0);
        expect(inexplique(bande), `${cle} : bande inexpliquée`).toBe(0);
        expect(st.base, `${cle} : base ≠ nue`).toBe(skillBaseValue(c, FT.skill?.id));
        expect(st.difficulty, `${cle} : Difficulté non posée`).toBe(d);
        if (borne.clamped) {
          horsBornes += 1;
          expect(st.clamped, `${cle} : écrêtage non nommé`).toBe(borne.clamped);
          expect(st.target, `${cle} : la cible stockée doit être la cible JOUÉE`)
            .toBe(rollTest(st.target!, 'intermediaire', battleRng()).target);
          expect(st.target, `${cle} : hors bornes, l’ancienne cible était l’autre nombre`).not.toBe(ancienne);
        } else {
          expect(st.clamped, `${cle} : écrêtage fantôme`).toBeUndefined();
        }

        const def = actor({ id: 'd', conditions: p.conditions as never });
        const att = actor({ id: 'a' });
        seedBattleRng(7);
        const aT = rollFrozenOpposedAttacker(att, FT_OPP.opposed!, d);
        const row = frozenOpposedBatchStep([def], FT_OPP, BRANCHES, EMPTY_FLOW, d, att, aT)!.participants![0];
        expect(row.target, `${cle} : opposé`).toBe(clampTarget(testValue(def, FT_OPP.skill?.id) + DIFFICULTY_MODIFIERS[d]).target);
        expect(inexplique(row), `${cle} : opposé inexpliqué`).toBe(0);
        expect(row.base, `${cle} : opposé base ≠ nue`).toBe(skillBaseValue(def, FT_OPP.skill?.id));
      }
    }
    expect(horsBornes, 'sonde inerte : aucune combinaison hors bornes — le second régime n’est pas exercé').toBeGreaterThan(0);
  });

  it('BIT-IDENTITÉ du jet figé : à graine égale, même d100, même cible, même DR qu’avant migration', () => {
    for (const p of POSTURES) {
      for (const d of TOUS_CRANS) {
        const att = actor({ id: 'a', conditions: p.conditions as never });
        seedBattleRng(31);
        const neuf = rollFrozenOpposedAttacker(att, FT_OPP.opposed!, d);
        seedBattleRng(31);
        // Ancienne formule EXACTE du site (`rollTest(testValue, difficulty, rng)`) — c'est elle qui
        // écrêtait déjà, et c'est pourquoi le JET ne bouge dans aucun des deux régimes.
        const ancien = rollTest(testValue(att, undefined, 'force'), d, battleRng());
        const cle = `${p.nom}/${d}`;
        expect(neuf.roll, `${cle} : d100`).toBe(ancien.roll);
        expect(neuf.target, `${cle} : cible`).toBe(ancien.target);
        expect(neuf.sl, `${cle} : DR`).toBe(ancien.sl);
        expect(neuf.success, `${cle} : issue`).toBe(ancien.success);
        expect(neuf.clamped, `${cle} : écrêtage`).toBe(ancien.clamped);
        expect(neuf.base, `${cle} : la NUE est ce que la migration AJOUTE`).toBe(skillBaseValue(att, undefined, undefined, 'force'));
      }
    }
  });

  it('le bonus de DR de l’attaquant n’entre ni dans sa base ni dans sa cible', () => {
    const att = actor({ id: 'a' });
    seedBattleRng(11);
    const sans = rollFrozenOpposedAttacker(att, { attacker: 'force' }, 'intermediaire');
    seedBattleRng(11);
    const avec = rollFrozenOpposedAttacker(att, { attacker: 'force', attackerBonusSL: 3 }, 'intermediaire');
    expect(avec.sl).toBe(sans.sl + 3);
    expect(avec.base).toBe(sans.base);
    expect(avec.target).toBe(sans.target);
  });
});

describe('SONDE — le monteur canonique rend bien ce que les producteurs en attendent', () => {
  it('`rollStep` canal combat/test et `rollStep` hors canal diffèrent sur un porteur sous aura de combat', () => {
    const c = actor({ id: 'sonde', auraMods: [{ op: { op: 'testMod', amount: -20 } }] } as never);
    const combat = rollStep({ actor: c, test: { skill: 'resistance' }, difficulty: 'intermediaire', combat: { kind: 'test' } });
    const hors = rollStep({ actor: c, test: { skill: 'resistance' }, difficulty: 'intermediaire' });
    expect(combat.base, 'les deux canaux partent de la MÊME nue').toBe(hors.base);
    expect(combat.target).not.toBe(hors.target);
  });
});
