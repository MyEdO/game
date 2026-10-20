/**
 * #1189 — les CONSÉQUENCES de la Psychologie en `GameOp` : ce que la dérivation (`psychBranchOps`)
 * APPLIQUE réellement, mesuré par `applyOps` sur un combattant, contre le calcul de référence du
 * moteur (`failConditionAmount`) et contre l'état que posaient les appliers avant la migration.
 *
 * RAW (LDB 21, `psychology.json:terreur`, verbatim) : « Sur un échec, vous gagnez autant d'États
 * *Brisé* que l'*Indice* de *Terreur* de la créature, auquel vous rajoutez les DR inférieurs à 0. »
 * puis « Une fois ce Test de Psychologie effectué, la créature cause la *Peur*, avec un *Indice* de
 * *Peur* équivalent à son *Indice* de *Terreur*. »
 */
import { describe, it, expect } from 'vitest';
import { psychBranchOps, failConditionAmount, psychResolution, type PsychStake, type PsychAffliction } from './psychology';
import { applyOps } from './ops';
import type { Combatant } from './types';
import { desDuTest } from './dice.testkit';

const hero = (psychState: PsychAffliction[] = []): Combatant => ({
  id: 'h1', name: 'h1', label: 'Anselme', kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
    agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30, perception: 30 },
  conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [], weapons: [],
  advantage: 0, size: 'moyenne', wounds: { current: 10, max: 10 }, psychState,
  species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

const terreur = (indice: number): PsychStake => ({ kind: 'terreur', sourceId: 'src', indice });
const briseOf = (c: Combatant) => c.conditions.find((x) => x.id === 'brise')?.value;

describe('#1189 — psychBranchOps : l’arithmétique APPLIQUÉE est celle du moteur', () => {
  it('l’échec d’un Test de Terreur inflige EXACTEMENT `failConditionAmount` (DR du jet compris)', () => {
    const spec = psychResolution('terreur').failAmount;
    for (const sl of [0, -1, -6, 3]) {
      const c = hero();
      applyOps(c, psychBranchOps(terreur(3), { success: false }), { rng: desDuTest, sl });
      expect(briseOf(c), `DR ${sl} : la quantité appliquée diverge du calcul de référence`)
        .toBe(failConditionAmount(spec, 3, sl));
    }
  });

  it('la réussite n’inflige AUCUN État — seule la Peur héritée est posée (LDB 21 l.54/l.56, #1190)', () => {
    const c = hero();
    applyOps(c, psychBranchOps(terreur(5), { success: true, round: 3 }), { rng: desDuTest, sl: 2 });
    expect(c.conditions, 'la réussite n’exempte que de la Terreur, elle n’inflige rien').toEqual([]);
    expect(c.psychState).toEqual([{ type: 'peur', sourceId: 'src', indice: 5, calmeDR: 0, lastTestRound: 3 }]);
  });

  it('l’échec pose l’État PUIS la MÊME Peur héritée, à plein Indice', () => {
    const c = hero();
    applyOps(c, psychBranchOps(terreur(5), { success: false, round: 3 }), { rng: desDuTest, sl: -2 });
    expect(briseOf(c)).toBe(7);
    expect(c.psychState).toEqual([{ type: 'peur', sourceId: 'src', indice: 5, calmeDR: 0, lastTestRound: 3 }]);
  });
});

describe('#1189 — la branche de RÉUSSITE est l’état qu’un porteur IMMUNISÉ obtient', () => {
  it('Terreur : Peur héritée à PLEIN Indice, zéro État infligé', () => {
    const c = hero();
    applyOps(c, psychBranchOps(terreur(4), { success: true, calmeDR: 4 }), { rng: desDuTest });
    expect(c.psychState).toEqual([{ type: 'peur', sourceId: 'src', indice: 4, calmeDR: 0 }]);
    expect(c.conditions).toEqual([]);
  });

  it('Peur (Test ÉTENDU) : l’entrée est posée au DR fourni — surmontée quand il atteint l’Indice', () => {
    const c = hero();
    applyOps(c, psychBranchOps({ kind: 'peur', sourceId: 'srcP', indice: 2 }, { success: true, calmeDR: 2 }), { rng: desDuTest });
    expect(c.psychState).toEqual([{ type: 'peur', sourceId: 'srcP', indice: 2, calmeDR: 2, fromTest: true }]);
  });

  it('Trait CIBLÉ : marqueur INERTE (`active:false`), non re-déclenchable', () => {
    const c = hero();
    applyOps(c, psychBranchOps({ kind: 'haine', sourceId: 'srcH', cible: 'gobelins', indice: 0 }, { success: true }), { rng: desDuTest });
    expect(c.psychState).toEqual([{ type: 'haine', cible: 'gobelins', sourceId: 'srcH', active: false, fromTest: true }]);
  });

  it('Trait CIBLÉ raté : la MÊME entrée, ACTIVE — jamais une seconde', () => {
    const c = hero();
    const stake: PsychStake = { kind: 'haine', sourceId: 'srcH', cible: 'gobelins', indice: 0 };
    applyOps(c, psychBranchOps(stake, { success: true }), { rng: desDuTest });
    applyOps(c, psychBranchOps(stake, { success: false, round: 2 }), { rng: desDuTest });
    expect(c.psychState).toEqual([{ type: 'haine', cible: 'gobelins', sourceId: 'srcH', active: true, fromTest: true, lastTestRound: 2 }]);
  });
});

describe('#1189 — UPSERT : un second Test contre la MÊME source ne dédouble pas l’entrée', () => {
  it('Terreur re-testée sur une Peur déjà entamée : UNE entrée, son DR remis à l’état de la règle', () => {
    const c = hero([{ type: 'peur', sourceId: 'src', indice: 5, calmeDR: 4 }]);
    applyOps(c, psychBranchOps(terreur(5), { success: false, round: 4 }), { rng: desDuTest, sl: -1 });
    expect(c.psychState).toHaveLength(1);
    expect(c.psychState![0]).toEqual({ type: 'peur', sourceId: 'src', indice: 5, calmeDR: 0, lastTestRound: 4 });
  });

  it('Peur étendue : le DR cumulé calculé par le site est versé sur l’entrée EXISTANTE', () => {
    const c = hero([{ type: 'peur', sourceId: 'sp', indice: 4, calmeDR: 1, lastTestRound: 1 }]);
    applyOps(c, psychBranchOps({ kind: 'peur', sourceId: 'sp', indice: 4 }, { success: false, calmeDR: 0, round: 2 }), { rng: desDuTest, sl: -3 });
    expect(c.psychState).toEqual([{ type: 'peur', sourceId: 'sp', indice: 4, calmeDR: 0, fromTest: true, lastTestRound: 2 }]);
  });

  it('deux sources DISTINCTES gardent deux entrées', () => {
    const c = hero();
    applyOps(c, psychBranchOps({ kind: 'peur', sourceId: 'a', indice: 1 }, { success: false, calmeDR: 0 }), { rng: desDuTest });
    applyOps(c, psychBranchOps({ kind: 'peur', sourceId: 'b', indice: 2 }, { success: false, calmeDR: 0 }), { rng: desDuTest });
    expect(c.psychState!.map((p) => p.sourceId)).toEqual(['a', 'b']);
  });
});
