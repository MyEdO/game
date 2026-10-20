/**
 * Fenêtre de CONSCIENCE par Détermination — LDB 20 l.170, verbatim :
 * « Si la fièvre dont vous souffrez est indiquée comme (Grave), vous vous retrouvez dans un état de
 * faiblesse totale vous obligeant à rester alité. Gagnez l'État *Inconscient*, même si la dépense de
 * Points de Détermination peut vous ramener à la conscience pendant quelques minutes. »
 *
 * « quelques minutes » n'est pas chiffré : la durée est la règle MAISON
 * `maladie-conscience-determination-minutes` (`reglesOptionnelles.json`). La dépense ne RETIRE pas
 * l'État à la main (le fait le reposerait aussitôt) : elle SUSPEND la SOURCE qui le porte
 * (`suspendSource`, l'applier de l'op `suppressSymptom` — Racine de terre, LDB 72 l.28) sur la fenêtre
 * que l'op PORTEUSE déclare (`resolveWindow` en donnée) ; la réconciliation retire alors l'État, et
 * `purgeClockEffects` le lui rend à l'échéance.
 *
 * PORTÉE : l'ÉTAT NOMMÉ chez le symptôme source — ni le canal « maladie », ni même le symptôme entier.
 * LDB 17 l.61 : « Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure
 * lorsque vous vous mettez debout. » — UN État, et rien d'autre. La fièvre et son −10 aux Tests
 * Physiques et de Sociabilité (l.170, même ligne) tiennent pendant toute la fenêtre. L'Exténué du
 * Malaise (l.188, « dont vous ne pourrez vous défaire qu'une fois votre maladie guérie ») en est le
 * second témoin — il survit à toutes les dépenses.
 *
 * Le chemin est le VRAI : le store (`spendResolveCondition`), sur un héros dont la Fièvre est passée
 * (Grave) par le Test quotidien de la Pneumonie.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { contractDisease, symptomSuppressed, diseasePassiveOps } from '../engine/disease';
import { dailyDiseaseUpkeep } from '../engine/rest';
import { syncDerivedConditions, derivedStacks, stacks, addCondition, raisonRefusDetermination, fenetreDetermination } from '../engine/conditions';
import { passiveMods, poseDeterminationCanceller } from '../engine/trauma';
import { purgeClockEffects } from '../noyau/upkeep';
import { determinationWindowId } from '../noyau/combatSlice';
import { rule, setRule, resetRule } from '../engine/policy';
import { bus, EVT } from '../noyau/bus';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';

const seq = (values: number[]): RNG => { let i = 0; return { int: () => values[i++] }; };

const malade = (): Combatant => {
  const c = {
    id: 'h', label: 'Malade', kind: 'hero', resolve: 2,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!],
  } as unknown as Combatant;
  // Chemin RAW : le Test quotidien raté fait passer la Fièvre en (Grave) → EDOC 08 l.104.
  const dz = c.diseases![0];
  dz.symptoms = dz.symptoms.map((s) => (s.symptomId === 'fievre' ? { ...s, severity: 'grave' as const } : s));
  dailyDiseaseUpkeep(c, seq([]), () => {});
  syncDerivedConditions(c);
  return c;
};

const mkBattle = (h: Combatant): BattleState => ({
  combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpellId: null,
  reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
} as unknown as BattleState);

describe('Détermination et État porté par un passif (LDB 20 l.170)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], mode: 'menu', gameTime: 10_000 } as never);
  });

  it('la Fièvre (Grave) porte l’Inconscient, MARQUÉ comme dérivé', () => {
    const h = malade();
    expect(stacks(h, 'inconscient')).toBe(1);
    expect(derivedStacks(h, 'inconscient')).toBe(1);
  });

  it('la dépense RAMÈNE à la conscience, débite le point, et ouvre une fenêtre d’HORLOGE maison', () => {
    const h = malade();
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(c0.resolve, 'le point de Détermination n’a pas été débité').toBe(1);
    expect(stacks(c0, 'inconscient'), 'le porteur n’est pas revenu à lui').toBe(0);
    const fenetre = c0.activeEffects!.find((e) => e.effectId === determinationWindowId('inconscient'))!;
    expect(fenetre, 'aucune fenêtre de conscience posée').toBeTruthy();
    expect(fenetre.duration).toEqual({ scale: 'clock', until: 10_000 + (rule('maladie-conscience-determination-minutes') as number) });
    // La fenêtre nomme le SYMPTÔME source ET le seul ÉTAT qu'elle écarte : LDB 20 l.170 rend la
    // CONSCIENCE, pas la santé — « Gagnez l'État *Inconscient*, même si la dépense de Points de
    // Détermination peut vous ramener à la conscience pendant quelques minutes. » La fièvre reste, et
    // son −10 aux Tests Physiques et de Sociabilité (même ligne) avec elle.
    expect(fenetre.suppressedSource, 'la fenêtre ne suspend pas la Fièvre').toEqual({ category: 'symptoms', id: 'fievre' });
    expect(fenetre.suppressedCondition, 'la fenêtre n’écarte pas QUE l’Inconscient').toBe('inconscient');
    expect(symptomSuppressed(c0, 'fievre'), 'la Fièvre entière a été suspendue — LDB 20 l.170 ne lève que l’État').toBe(false);
    // Le −10 de la Fièvre est porté par 7 `testMod` (`symptoms.json › fievre.passive`) : ils restent.
    expect(diseasePassiveOps(c0).filter((m) => m.src?.id === 'fievre' && m.op.op === 'testMod').length, 'le −10 de la Fièvre a sauté avec la conscience').toBe(7);
    // Seul l'État tombe, au collecteur unique : plus aucune op `condition` de la Fièvre n'est émise.
    expect(passiveMods(c0).some((m) => m.op.op === 'condition' && m.src?.id === 'fievre'), 'la Fièvre porte encore son Inconscient').toBe(false);
    expect(passiveMods(c0).filter((m) => m.op.op === 'testMod' && m.src?.id === 'fievre').length, 'le −10 de la Fièvre n’est plus émis').toBe(7);
  });

  it('à l’ÉCHÉANCE de la fenêtre, la fièvre le rendort (la réconciliation repose l’État)', () => {
    const h = malade();
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    const minutes = rule('maladie-conscience-determination-minutes') as number;

    // Une minute AVANT l'échéance : rien n'expire, le porteur est toujours conscient.
    useGame.setState({ gameTime: 10_000 + minutes - 1 } as never);
    purgeClockEffects(useGame.getState, useGame.setState);
    expect(stacks(useGame.getState().battle!.combatants[0], 'inconscient')).toBe(0);

    // À l'échéance : la fenêtre se referme, le passif de maladie reprend, l'État revient.
    useGame.setState({ gameTime: 10_000 + minutes } as never);
    purgeClockEffects(useGame.getState, useGame.setState);
    const c0 = useGame.getState().battle!.combatants[0];
    expect(stacks(c0, 'inconscient'), 'l’Inconscient n’est pas revenu à l’échéance').toBe(1);
    expect(derivedStacks(c0, 'inconscient')).toBe(1);
  });

  it('la COUTURE du temps referme la fenêtre, même quand le chemin ne joue pas l’entretien', () => {
    // Chemin RÉEL du voyage terrestre / de la journée de mer (`travelFlow.ts:523-524`,
    // `seaVoyageFlow.ts:1529-1530`) : l'horloge est posée puis `EVT.TIME_ADVANCED` est émis, et
    // l'entretien est DIFFÉRÉ à la cascade de nuit — rien n'y appelle `runDailyUpkeep`.
    const h = malade();
    useGame.setState({ mode: 'exploration', battle: null, party: [h], gameTime: 10_000, journal: [] } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    expect(stacks(useGame.getState().party[0], 'inconscient'), 'la dépense n’a pas réveillé le fiévreux').toBe(0);

    const minutes = rule('maladie-conscience-determination-minutes') as number;
    useGame.setState({ gameTime: 10_000 + minutes } as never);
    bus.emit(EVT.TIME_ADVANCED, { minutes });

    const c0 = useGame.getState().party[0];
    expect(c0.activeEffects?.some((e) => e.effectId === determinationWindowId('inconscient')) ?? false, 'la fenêtre a survécu à son échéance').toBe(false);
    expect(stacks(c0, 'inconscient'), 'l’Inconscient n’est pas revenu à l’échéance').toBe(1);
    expect(useGame.getState().journal.join(' | '), 'la dissipation n’est pas journalisée').toMatch(/Inconscient|Fièvre|Malade/);
  });

  it('sur un État NON dérivé, la dépense reste le retrait d’UN pion (LDB 17 l.61) — aucune fenêtre', () => {
    const h = malade();
    h.conditions = [{ id: 'aveugle', value: 2 }];
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'aveugle');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(c0.conditions.find((x) => x.id === 'aveugle')!.value).toBe(1);
    expect(c0.activeEffects?.some((e) => e.effectId === determinationWindowId('aveugle')) ?? false).toBe(false);
  });

  it('la fenêtre n’emporte QUE l’État : le cycle de la maladie et ses pénalités ne s’arrêtent jamais', () => {
    const h = malade();
    const avant = diseasePassiveOps(h).length;
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    const pendant = useGame.getState().battle!.combatants[0];
    // PENDANT la fenêtre : la Fièvre est toujours un symptôme ACTIF (donc son Test de cycle quotidien
    // et ses `onTick` tombent comme d'habitude — `engine/disease.ts:712/741` les gatent sur
    // `symptomSuppressed`), et elle émet exactement les mêmes passifs qu'avant la dépense.
    expect(symptomSuppressed(pendant, 'fievre')).toBe(false);
    expect(diseasePassiveOps(pendant).length, 'la dépense a rogné les passifs de la maladie').toBe(avant);
    // À l'ÉCHÉANCE : la fenêtre tombe, la cause tient toujours, l'État revient (LDB 16 l.117).
    useGame.setState({ gameTime: 10_000 + (rule('maladie-conscience-determination-minutes') as number) } as never);
    purgeClockEffects(useGame.getState, useGame.setState);
    const apres = useGame.getState().battle!.combatants[0];
    expect(stacks(apres, 'inconscient'), 'l’Inconscient n’est pas revenu à l’échéance').toBe(1);
    expect(diseasePassiveOps(apres).length).toBe(avant);
  });
});

/**
 * LDB 20 l.188, verbatim : « Gagnez un État *Exténué* dont vous ne pourrez vous défaire qu'une fois
 * votre maladie guérie. » — le Malaise n'est pas le symptôme dépensé : aucune dépense de Détermination
 * ne l'atteint. C'est ce qu'une fenêtre posée sur le CANAL « maladie » violerait en silence.
 */
describe('la fenêtre ne déborde jamais du symptôme dépensé (LDB 20 l.188)', () => {
  /** La Pneumonie porte DEUX symptômes à État : Fièvre (Grave) → Inconscient (l.170, cède à la
   *  Détermination) et Malaise → Exténué (l.188, ne cède à rien avant la guérison). */
  const doubleMalade = (): Combatant => {
    const c = malade();
    expect(stacks(c, 'extenue'), 'le Malaise ne porte pas son Exténué').toBe(1);
    return c;
  };

  it('l’Exténué du Malaise SURVIT à la dépense qui réveille le fiévreux', () => {
    const h = doubleMalade();
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(stacks(c0, 'inconscient'), 'le fiévreux n’est pas revenu à lui').toBe(0);
    expect(stacks(c0, 'extenue'), 'l’Exténué du Malaise est parti avec la fenêtre').toBe(1);
    expect(derivedStacks(c0, 'extenue')).toBe(1);
    expect(symptomSuppressed(c0, 'malaise'), 'le Malaise a été suspendu lui aussi').toBe(false);
  });

  it('l’Exténué du Malaise SURVIT aussi à une dépense dirigée SUR LUI, et le point n’est pas débité', () => {
    const h = doubleMalade();
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'extenue');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(stacks(c0, 'extenue'), 'l’Exténué est parti sans que la maladie soit guérie').toBe(1);
    // Le Malaise ne CÈDE pas à la Détermination : son op porteuse déclare `resolveWindow: 'none'`
    // (l.188) — la dépense est refusée, aucune fenêtre, et la Fièvre n'est pas touchée non plus.
    expect(c0.resolve, 'le point a été consommé pour rien').toBe(2);
    expect(symptomSuppressed(c0, 'malaise')).toBe(false);
    expect(symptomSuppressed(c0, 'fievre'), 'la Fièvre a été suspendue par une dépense sur l’Exténué').toBe(false);
  });

  it('sur un État VERROUILLÉ, l’UI reçoit la RAISON du refus (jamais un bouton muet)', () => {
    const h = doubleMalade();
    expect(raisonRefusDetermination(h, 'extenue')).toContain('guérison');
    expect(raisonRefusDetermination(h, 'inconscient'), 'la Fièvre cède : aucune raison de refus').toBeUndefined();
  });

  it('la Détermination de LDB 17 l.60 (Critique) ne lève AUCUN passif de maladie', () => {
    const h = doubleMalade();
    const avant = diseasePassiveOps(h).length;
    poseDeterminationCanceller(h, { scale: 'rounds', left: 1 }, 'Détermination (Critique)');
    syncDerivedConditions(h);
    expect(diseasePassiveOps(h).length, 'les passifs de maladie ont sauté').toBe(avant);
    expect(passiveMods(h).some((m) => m.kind === 'maladie'), 'le canal maladie a été annulé').toBe(true);
    expect(stacks(h, 'inconscient'), 'l’Inconscient de la Fièvre est tombé').toBe(1);
    expect(stacks(h, 'extenue'), 'l’Exténué du Malaise est tombé').toBe(1);
  });
});

/**
 * Un pion, DEUX causes — LDB 16 l.115, verbatim : « L'État *Inconscient* ne se cumule pas – soit vous
 * êtes *Inconscient*, soit vous ne l'êtes pas. » Un fiévreux (Grave) qui tombe aussi à 0 PB ne porte
 * donc qu'UN pion. La dépense de Détermination doit malgré tout le ramener à lui : LDB 17 l.61
 * (« Retirez un État ») emporte ce que la suspension du symptôme n'a pas emporté, et LDB 16 l.117 dit
 * ce qui suit — « si vous êtes toujours sujet aux causes de cette inconscience, vous gagnez un nouvel
 * État *Inconscient* à la fin du Round ».
 */
describe('KO à 0 PB + Fièvre (Grave) : un seul pion, et la dépense réveille quand même (LDB 16 l.115/l.117)', () => {
  it('le point est DÉBITÉ et la conscience revient', () => {
    const h = malade();
    h.wounds.current = 0;
    addCondition(h, 'inconscient'); // KO à 0 PB — le pion est partagé avec la Fièvre
    expect(stacks(h, 'inconscient'), 'les deux causes ont empilé deux pions').toBe(1);
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    const c0 = useGame.getState().battle!.combatants[0];
    expect(c0.resolve, 'le point de Détermination n’a pas été débité').toBe(1);
    expect(stacks(c0, 'inconscient'), 'le porteur n’est pas revenu à lui').toBe(0);
  });

  it('la fièvre le rendort à l’échéance de la fenêtre (la cause tient toujours)', () => {
    const h = malade();
    h.wounds.current = 0;
    addCondition(h, 'inconscient');
    useGame.setState({ mode: 'battle', battle: mkBattle(h), party: [h], gameTime: 10_000 } as never);
    useGame.getState().spendResolveCondition(h.id, 'inconscient');
    useGame.setState({ gameTime: 10_000 + (rule('maladie-conscience-determination-minutes') as number) } as never);
    purgeClockEffects(useGame.getState, useGame.setState);
    expect(stacks(useGame.getState().battle!.combatants[0], 'inconscient')).toBe(1);
  });
});

/**
 * La FENÊTRE de suspension a DEUX régimes, et aucun n'est un refus.
 *  - LDB 20 l.170 (Fièvre) : « la dépense de Points de Détermination peut vous ramener à la conscience
 *    pendant quelques minutes » → horloge, durée maison `maladie-conscience-determination-minutes`.
 *  - DÉFAUT, LDB 16 l.117 : « Si vous dépensez un Point de Détermination pour vous débarrasser d'un État
 *    *Inconscient*, mais que vous êtes toujours sujet aux causes de cette inconscience, vous gagnez un
 *    nouvel État *Inconscient* à la fin du Round. » → un Round.
 */
describe('la fenêtre de Détermination est celle que l’op PORTEUSE déclare (LDB 20 l.170 / LDB 16 l.117)', () => {
  it('Fièvre (Grave) : fenêtre d’HORLOGE, minutes prises à la règle maison', () => {
    const h = malade();
    expect(fenetreDetermination(h, 'inconscient', 10_000)).toEqual({
      scale: 'clock', until: 10_000 + (rule('maladie-conscience-determination-minutes') as number),
    });
  });

  /** La fenêtre est un terme `{rule}` d'une `Formula` : changer la règle change la fenêtre, sans
   *  toucher au code — c'est le sens du champ éditable (LDB 20 l.170 ne chiffre pas les minutes). */
  it('la règle maison PARAMÈTRE la fenêtre : à 7, la fenêtre dure 7 minutes', () => {
    const h = malade();
    setRule('maladie-conscience-determination-minutes', 7);
    try {
      expect(fenetreDetermination(h, 'inconscient', 10_000)).toEqual({ scale: 'clock', until: 10_007 });
    } finally {
      resetRule('maladie-conscience-determination-minutes');
    }
  });

  /** Aucune op porteuse ne déclare de fenêtre → le DÉFAUT de LDB 16 l.117 (un Round), jamais un refus. */
  it('porteur SANS fenêtre déclarée : la fin du Round', () => {
    const c = { id: 'x', label: 'Cobaye', conditions: [], activeEffects: [] } as unknown as Combatant;
    addCondition(c, 'sonne');
    c.conditions[0].derivedFrom = { stacks: 1, src: { category: 'symptoms', id: 'convulsions' } };
    expect(fenetreDetermination(c, 'sonne', 10_000)).toEqual({ scale: 'rounds', left: 1 });
  });

  /** LDB 20 l.188 : le Malaise déclare `resolveWindow: 'none'` → aucune fenêtre, la dépense est refusée. */
  it('Malaise : AUCUNE fenêtre, et la raison NOMME sa source (le refus est en donnée)', () => {
    const c = { id: 'm', label: 'Malade', conditions: [], activeEffects: [], resolve: 2,
      diseases: [contractDisease('infection-mineure', seq([1]), { incubation: 0, duration: 5 })!] } as unknown as Combatant;
    syncDerivedConditions(c);
    expect(derivedStacks(c, 'extenue'), 'le Malaise ne porte pas l’Exténué').toBe(1);
    expect(fenetreDetermination(c, 'extenue', 10_000)).toBeUndefined();
    expect(raisonRefusDetermination(c, 'extenue')).toContain('Malaise');
  });
});
