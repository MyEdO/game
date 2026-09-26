import { describe, it, expect, afterEach } from 'vitest';
import { MORALE_BASE, MORALE_FACTORS, MORALE_BANDS, moraleBand, recalcMorale, resolveCrewTest, tickShipMorale, payChoices, payChoiceCostBrass, isPayChoice, findMoraleFactor } from './crewMorale';
import { setDataset } from '../data/overrides';
import { makeRNG, type RNG } from './dice';

const seq = (values: number[]): RNG => { let i = 0; return { int: () => values[i++] }; };
/** Seed des facteurs (restauré après chaque test qui édite la donnée). */
const FACTORS_SEED = structuredClone(MORALE_FACTORS);

/**
 * MORAL d'équipage (MDG 14) — système PROPRE à la Mer des Griffes (aucun équivalent LDB/AA). Le code
 * est générique ; la donnée (facteurs + bandes) vit dans `crew-morale.json`. Les « Tests d'équipage »
 * réutilisent la primitive de Soutien (testée ailleurs) — on ne teste ici que le Moral.
 */
describe('Moral d’équipage — données verbatim + recalcul hebdomadaire', () => {
  it('débute à 75 (nouveau capitaine / nouvel équipage)', () => {
    expect(MORALE_BASE).toBe(75);
  });

  it('catalogue complet : 28 facteurs (ids stables) + 4 bandes contiguës couvrant tout le spectre', () => {
    expect(MORALE_FACTORS).toHaveLength(28);
    for (const f of MORALE_FACTORS) expect(f.id && f.label && f.effect).toBeTruthy();
    expect(MORALE_BANDS).toHaveLength(4);
  });

  it('bandes d’EFFET (DR + désertion) classées par score', () => {
    expect(moraleBand(120).id).toBe('mene-de-main-de-maitre'); // 101+ : Cmd +2 DR, équipage +1 DR
    expect(moraleBand(120)).toMatchObject({ captainCmdDR: 2, crewTestDR: 1 });
    expect(moraleBand(80).id).toBe('excellent-equipage'); // 76-100 : Cmd +1 DR
    expect(moraleBand(80)).toMatchObject({ captainCmdDR: 1, crewTestDR: 0 });
    expect(moraleBand(60).id).toBe('equipage-satisfait'); // 51-75 : désertion sur 04-
    expect(moraleBand(60).desertionRoll).toBe(4);
    expect(moraleBand(30).id).toBe('canailles'); // 50- : Cmd/équipage -1 DR, désertion sur 16-
    expect(moraleBand(30)).toMatchObject({ captainCmdDR: -1, crewTestDR: -1, desertionRoll: 16 });
  });

  it('recalcul hebdo : les facteurs ACTIFS montent/descendent le Moral (dés signés, déterministe)', () => {
    // « Pas de paie » (−3d10) + « capitaine lâche » (−2d10) font dégringoler le Moral.
    const down = recalcMorale(75, ['pas-de-paie', 'capitaine-lache'], makeRNG(1));
    expect(down.delta).toBeLessThan(0);
    expect(down.score).toBe(75 + down.delta);
    expect(down.lines).toHaveLength(2);
    // « Paie généreuse » (+2d10) + « capitaine compétent » (+2d10) le font remonter.
    const up = recalcMorale(50, ['paie-genereuse', 'capitaine-competent'], makeRNG(1));
    expect(up.delta).toBeGreaterThan(0);
    expect(up.score).toBe(50 + up.delta);
  });

  it('un id de facteur inconnu est ignoré (pas de NaN, pas de plantage)', () => {
    const r = recalcMorale(75, ['inexistant'], makeRNG(1));
    expect(r.delta).toBe(0);
    expect(r.score).toBe(75);
    expect(r.lines).toHaveLength(0);
  });

  it('borne basse : un score très négatif retombe sur « canailles » (findTableEntry)', () => {
    expect(moraleBand(-200).id).toBe('canailles');
    expect(moraleBand(50).id).toBe('canailles'); // 50 = borne haute de la bande basse
    expect(moraleBand(51).id).toBe('equipage-satisfait');
  });
});

describe('Choix de paie du Conseil de bord (#229) — barème `wageMul` EN DONNÉE (crew-morale.json)', () => {
  afterEach(() => setDataset('crewMoraleFactors', structuredClone(FACTORS_SEED)));

  it('les choix sont les facteurs de Moral portant un `wageMul` (par id)', () => {
    expect(payChoices().map((c) => c.factorId)).toEqual(['paie-genereuse', 'paie-reguliere', 'paie-chiche', 'pas-de-paie']);
    for (const c of payChoices()) { expect(findMoraleFactor(c.factorId)).toBeTruthy(); expect(isPayChoice(c.factorId)).toBe(true); }
    expect(isPayChoice('paie-irreguliere')).toBe(false); // facteur circonstanciel (régularité subie), PAS un montant choisi
  });
  it('solde versée = barème × multiplicateur (généreuse ×2, régulière ×1, chiche ×½, pas-de-paie ×0)', () => {
    expect(payChoiceCostBrass(288, 'paie-genereuse')).toBe(576);
    expect(payChoiceCostBrass(288, 'paie-reguliere')).toBe(288);
    expect(payChoiceCostBrass(288, 'paie-chiche')).toBe(144);
    expect(payChoiceCostBrass(288, 'pas-de-paie')).toBe(0);
    expect(payChoiceCostBrass(288, 'inconnu')).toBe(0);
  });
  // CÂBLAGE : le barème vit dans crew-morale.json (éditable au Codex, catégorie `crewMoraleFactors`).
  it('éditer `wageMul` en donnée change la solde versée ET la liste des choix offerts', () => {
    setDataset('crewMoraleFactors', MORALE_FACTORS.map((f) => (f.id === 'paie-genereuse' ? { ...f, wageMul: 3 } : f)));
    expect(payChoiceCostBrass(288, 'paie-genereuse')).toBe(864);

    // Retirer le `wageMul` d'un facteur le sort des choix (et sa solde retombe à 0).
    setDataset('crewMoraleFactors', MORALE_FACTORS.map((f) => (f.id === 'paie-chiche' ? { ...f, wageMul: undefined } : f)));
    expect(isPayChoice('paie-chiche')).toBe(false);
    expect(payChoices().map((c) => c.factorId)).not.toContain('paie-chiche');

    // En ajouter un à un facteur circonstanciel l'offre au Conseil, sans une ligne de code.
    setDataset('crewMoraleFactors', MORALE_FACTORS.map((f) => (f.id === 'paie-irreguliere' ? { ...f, wageMul: 0.75 } : f)));
    expect(isPayChoice('paie-irreguliere')).toBe(true);
    expect(payChoiceCostBrass(288, 'paie-irreguliere')).toBe(216);
  });
  it('recalcMorale expose un jet PAR facteur (procès-verbal du conseil)', () => {
    const r = recalcMorale(75, ['paie-chiche'], makeRNG(1));
    expect(r.rolls).toHaveLength(1);
    expect(r.rolls[0]).toMatchObject({ id: 'paie-chiche' });
    expect(r.rolls[0].rolled).toBe(r.delta);
  });
});

describe('resolveCrewTest — Test d’équipage (somme des DR, rôle essentiel doublé, DR de Moral)', () => {
  it('additionne les DR ; le rôle ESSENTIEL compte double ; le DR de Moral s’applique au total', () => {
    const r = resolveCrewTest(
      [{ value: 60, essential: true, label: 'Capitaine' }, { value: 50, label: 'Marin' }],
      'intermediaire', 80, seq([20, 30]), // band 76-100 → crewTestDR 0
    );
    expect(r.contributions[0].counted).toBe(r.contributions[0].sl * 2); // essentiel ×2
    expect(r.contributions[1].counted).toBe(r.contributions[1].sl);
    expect(r.baseTotal).toBe(r.contributions[0].counted + r.contributions[1].counted);
    expect(r.moraleDR).toBe(0);
    expect(r.total).toBe(r.baseTotal);
  });

  it('un Moral bas (« canailles ») applique -1 DR au total ; extraDR (Manque de bras) s’ajoute', () => {
    const r = resolveCrewTest([{ value: 50, label: 'Timonier' }], 'intermediaire', 30, seq([30]), -2); // band ≤50 → -1 DR
    expect(r.moraleDR).toBe(-1);
    expect(r.total).toBe(r.baseTotal - 1 - 2);
  });
});

describe('tickShipMorale — recalcul HEBDOMADAIRE gardé (jour ÷ 7, anti-double-comptage)', () => {
  const s0 = { score: 75, lastMoraleWeek: 0, factors: ['pas-de-paie'] };
  it('même semaine → aucun recalcul', () => {
    const a = tickShipMorale(s0, 3, makeRNG(1));
    expect(a.recalced).toBe(false);
    expect(a.state.score).toBe(75);
  });
  it('nouvelle semaine → recalcule (pas-de-paie -3d10) et avance lastMoraleWeek', () => {
    const b = tickShipMorale(s0, 7, makeRNG(1));
    expect(b.recalced).toBe(true);
    expect(b.state.lastMoraleWeek).toBe(1);
    expect(b.state.score).toBeLessThan(75);
    // idempotent dans la même semaine
    expect(tickShipMorale(b.state, 8, makeRNG(1)).recalced).toBe(false);
  });
});
