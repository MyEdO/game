import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { openCombatEndCascade } from '../noyau/combatFlow';
import { applyEffects } from '../noyau/combatEffects';
import { gainCorruption } from '../noyau/corruptionFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { bonus } from '../engine/characteristics';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * Talent « Résistance (Menace) » CÂBLÉ sur les flux de jet (LDB 10 l.1016-1020) — verbe `resist` de la
 * fabrique rollFlow (MÊME mécanisme d'auto-succès que la Résilience, autre ressource : 1× par spec et
 * par séance) : le Test tagué `menace` réussit d'office avec DR = Bonus d'Endurance. Le tag `menace` ET
 * la spec du talent sont désormais des ids stables (Phase 3) : exposition à la Corruption ('corruption'),
 * seuil → mutation ('mutation'), Contraction de fin de combat ('maladie'), opposition à un Sort ('magie').
 * Poison ('poison') = tag de DONNÉE (`FlowTest.menace` du Venin/lames empoisonnées) → couvert par les
 * étapes `triggeredTest`.
 */
const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'a', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 43, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [],
    talents: [
      { talentId: 'resistance', spec: 'corruption', times: 1 },
      { talentId: 'resistance', spec: 'maladie', times: 1 },
      { talentId: 'resistance', spec: 'mutation', times: 1 },
      { talentId: 'resistance', spec: 'magie', times: 1 },
    ],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 2, fortune: 1,
    ...p,
  }) as Combatant);

function setBattle(combatants: Combatant[]) {
  useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as any });
}

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, mode: 'exploration', journal: [], pendingCascade: null, pendingCorruption: null, pendingCast: null, pendingCastOpposition: null });
});

describe('Résistance (Corruption) — exposition (modale pendingCorruption, LDB 19 l.23-75)', () => {
  it('l’Effet corruptionExposure tague la modale `menace: corruption` ; `corruptionResist` = auto-succès à DR = BE + spec consommée', () => {
    const a = hero();
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'moderee', nature: 'physique', heroId: a.id }]);
    const pc = useGame.getState().pendingCorruption!;
    expect(pc.menace).toBe('corruption');
    useGame.getState().corruptionResist();
    const done = useGame.getState().pendingCorruption!;
    expect(done.success).toBe(true);
    expect(done.sl).toBe(bonus(43)); // « utilisez votre Bonus d'Endurance comme DR » → 4
    expect(useGame.getState().party[0].resistanceUsed).toContain('corruption');
    // Modérée + succès à DR 4 (≥ 2) → 0 Point de Corruption au resolve.
    useGame.getState().resolveCorruption();
    expect(useGame.getState().party[0].corruption ?? 0).toBe(0);
  });

  it('« le premier Test […] à chaque séance » : 2e exposition la même séance → resist NO-OP ; nouvelle séance (restoreFortuneNow) → ré-armé', () => {
    const a = hero();
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionResist();
    useGame.getState().resolveCorruption();
    // 2e exposition, même séance : la spec est consommée → le verbe ne fait RIEN (pas de jet posé).
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.roll).toBeUndefined();
    useGame.getState().corruptionRoll(); // le jet normal reste possible
    useGame.getState().resolveCorruption();
    // Début de séance (couture UNIQUE restoreFortune) → compteur remis, le talent est de nouveau offert.
    useGame.getState().restoreFortuneNow();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.success).toBe(true);
  });

  it('utilisable APRÈS un échec (même fenêtre que la Résilience)', () => {
    seedBattleRng(4); // 1er d100 = 93 → échec garanti (cible ≤ 63)
    const a = hero();
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionRoll();
    expect(useGame.getState().pendingCorruption!.success).toBe(false);
    useGame.getState().corruptionResist(); // rattrapage post-échec
    expect(useGame.getState().pendingCorruption!.success).toBe(true);
    expect(useGame.getState().party[0].resistanceUsed).toContain('corruption');
  });

  // « Si le DR requis est important, utilisez votre Bonus d'Endurance comme DR pour le Test »
  // (LDB 10 l.1020) : le talent porte le DR à BE, y compris sur un Test RÉUSSI dont le DR ne suffit
  // pas — c'est le DR qui pilote le coût en Points d'une exposition (LDB 19 l.56).
  it('APRÈS un Test RÉUSSI à DR insuffisant (exposition MAJEURE, 40/43 → DR 0 = 2 Points) : le DR passe à BE = 4 → 0 Point, usage consommé', () => {
    seedBattleRng(18); // 1er d100 = 40 contre cible 43 → réussite à DR 0 (Succès Minime)
    const a = hero({ fortune: 0 });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'majeure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionRoll();
    const jet = useGame.getState().pendingCorruption!;
    expect({ roll: jet.roll, target: jet.target, success: jet.success, sl: jet.sl }).toEqual({ roll: 40, target: 43, success: true, sl: 0 });
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.sl).toBe(bonus(43)); // DR = Bonus d'Endurance = 4
    expect(useGame.getState().party[0].resistanceUsed).toContain('corruption');
    useGame.getState().resolveCorruption();
    // Majeure : « Sur un Succès Minime (0-1 DR), gagnez 2 Points […] Sur un Succès Impressionnant
    // (4+ DR), vous ne gagnez aucun Point » (LDB 19 l.58).
    expect(useGame.getState().party[0].corruption ?? 0).toBe(0);
  });

  it('jet RÉUSSI dont le DR atteint déjà BE → resist NO-OP : l’auto-succès n’a rien à y porter, l’usage de séance reste ARMÉ', () => {
    seedBattleRng(7); // 1er d100 = 2 contre cible 43 → réussite à DR 4 (= BE)
    const a = hero({ fortune: 0 });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'majeure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionRoll();
    expect(useGame.getState().pendingCorruption!.sl).toBe(bonus(43));
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.roll).toBe(2); // le jet naturel tient
    expect(useGame.getState().party[0].resistanceUsed ?? []).toEqual([]);
  });

  it('spec non couverte → resist NO-OP (pas de dépense)', () => {
    const a = hero({ talents: [{ talentId: 'resistance', spec: 'poison', times: 1 }] });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: a.id }]);
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.roll).toBeUndefined();
    expect(useGame.getState().party[0].resistanceUsed ?? []).toEqual([]);
  });
});

describe('Résistance (Mutation) — Test de SEUIL de Corruption (LDB 19 l.70)', () => {
  it('le seuil ouvre la modale taguée `menace: mutation` ; resist → contenu (pas de mutation)', () => {
    const a = hero({ corruption: 7 }); // seuil BFM+BE = 3+4 = 7 → le prochain gain déborde
    useGame.setState({ party: [a] });
    setBattle([a]);
    gainCorruption(useGame.getState, useGame.setState, a, 1);
    const pc = useGame.getState().pendingCorruption!;
    expect(pc.kind).toBe('seuil');
    expect(pc.menace).toBe('mutation');
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.success).toBe(true);
    useGame.getState().resolveCorruption();
    expect((a.mutations ?? []).length).toBe(0); // contenu « pour cette fois »
    expect(a.resistanceUsed).toContain('mutation');
  });
});

describe('Résistance (Maladie) — Contraction de fin de combat (LDB 20 l.25/51)', () => {
  it('étape `combatEndDisease` taguée `menace: maladie` ; cascadeResist → réussite à DR = BE → PAS de contraction', () => {
    const a = hero({ diseaseExposure: [{ disease: 'blessure-purulente' }] });
    setBattle([a]);
    useGame.setState({ party: [hero()] });
    openCombatEndCascade(useGame.getState, useGame.setState);
    const p = useGame.getState().pendingCascade!;
    // #1117 L4 : bande par entrée de règle — le tag `menace` et l'auto-succès vivent SUR LA RANGÉE
    // (deux porteurs d'une même bande ne partagent ni leur Talent ni leur consommation).
    const bande = p.participants.find((s) => s.kind === 'combatEndDisease')!;
    const row = bande.participants!.find((r) => r.id === a.id)!;
    expect(row.menace).toBe('maladie');
    useGame.getState().cascadeBatchResist(row.id);
    const rolled = useGame.getState().pendingCascade!.participants
      .find((s) => s.id === bande.id)!.participants!.find((r) => r.id === a.id)!;
    expect(rolled.result).toEqual({ roll: 1, target: row.target, sl: bonus(43), success: true });
    useGame.getState().cascadeNext();
    expect(a.diseases ?? []).toHaveLength(0); // résisté → pas de Blessure Purulente
    expect(a.resistanceUsed).toContain('maladie');
  });
});

describe('Résistance (Magie) — opposition à un Sort (« résister aux sorts »)', () => {
  it('pendingCastOpposition tagué `menace: magie` ; oppositionResist → la cible RÉSISTE (DR = BE)', () => {
    const a = hero();
    const foe = hero({ id: 'e', label: 'E', kind: 'enemy', talents: [] });
    useGame.setState({ party: [a] });
    setBattle([a, foe]);
    useGame.setState({
      pendingCast: {
        casterId: foe.id, targetId: a.id, spellId: 'fauche-demon', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'x' },
      } as never,
      pendingCastOpposition: { participants: [{ id: a.id, interactive: true, result: null }], kind: 'resist', char: 'force-mentale', menace: 'magie' } as never,
    });
    useGame.getState().oppositionResist(a.id);
    const part = useGame.getState().pendingCastOpposition!.participants[0];
    expect(part.result!.resisted).toBe(true);
    expect(part.result!.oppose.sl).toBe(bonus(43));
    expect(part.result!.margin).toBe(Math.max(0, 6 - bonus(43)));
    expect(a.resistanceUsed).toContain('magie');
  });
});
