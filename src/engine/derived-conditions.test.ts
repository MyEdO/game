/**
 * États PORTÉS par un canal PASSIF — `syncDerivedConditions` (#1599).
 *
 * Le RAW attache l'État au SYMPTÔME, pas à la maladie :
 *  - LDB 20 l.170 (Fièvre) : « Si la fièvre dont vous souffrez est indiquée comme (Grave), vous vous
 *    retrouvez dans un état de faiblesse totale vous obligeant à rester alité. Gagnez l'État
 *    *Inconscient*, même si la dépense de Points de Détermination peut vous ramener à la conscience
 *    pendant quelques minutes. »
 *  - LDB 20 l.188 (Malaise) : « Gagnez un État *Exténué* dont vous ne pourrez vous défaire qu'une fois
 *    votre maladie guérie. »
 *
 * Tout passe par le CHEMIN RÉEL : la Pneumonie contractée, son Test quotidien DIFFÉRÉ à la porte
 * d'entretien, son issue INJECTÉE (`upkeepPorte.testkit`, miroir strict des appliers de nuit).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, UpkeepDeferTest } from './types';
import type { RNG } from './dice';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import { contractDisease, tickDisease, severiteEffective } from './disease';
import { dailyDiseaseUpkeep, cureDiseases, applyRecoveryDay } from './rest';
import { syncDerivedConditions, derivedStacks, stacks, addCondition, removeCondition, setConditionGainedHook, raisonRefusDetermination, fenetreDetermination } from './conditions';
import { suspendSource } from './suspension';
import { applyOps } from './ops';
import { MINUTES_PER_DAY } from './clock';
import { desDuTest, desEnSuite } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const ignore: UpkeepDeferTest = () => {};
function seq(values: number[]): RNG {
  return desEnSuite(values);
}

const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'Malade', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    diseases: [],
    ...p,
  })) as Combatant;

/** Un jour de Pneumonie, Test quotidien DIFFÉRÉ puis issue INJECTÉE (le moteur ne roule rien). */
function jourDePneumonie(c: Combatant, success: boolean): string[] {
  const { specs, defer } = porteEntretien();
  const log = dailyDiseaseUpkeep(c, seq([]), defer);
  for (const s of specs) log.push(...applique(c, s, { success }, desDuTest));
  return log;
}

/** Un fiévreux dont la Fièvre est passée (Grave) par le chemin RAW (EDOC 08 l.104, échec du Test). */
function pneumoniqueGrave(over: Partial<Combatant> = {}): { c: Combatant; log: string[] } {
  const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!], ...over });
  const log = jourDePneumonie(c, false);
  expect(c.diseases![0].symptoms.find((s) => s.symptomId === 'fievre')!.severity).toBe('grave');
  return { c, log };
}

describe('Fièvre (Grave) → l’État Inconscient est MATÉRIALISÉ (LDB 20 l.170)', () => {
  it('le Test quotidien raté fait passer la Fièvre en (Grave) → Inconscient posé, MARQUÉ, et journalisé', () => {
    const { c, log } = pneumoniqueGrave();
    expect(stacks(c, 'inconscient'), 'l’État du RAW n’est pas posé').toBe(1);
    expect(derivedStacks(c, 'inconscient'), 'le pion n’est pas marqué comme DÉRIVÉ').toBe(1);
    expect(c.conditions.find((x) => x.id === 'inconscient')!.derivedFrom!.src).toEqual({ category: 'symptoms', id: 'fievre' });
    expect(log.some((l) => l.includes('gagne l’État Inconscient') && l.includes('Fièvre'))).toBe(true);
  });

  it('la réconciliation est IDEMPOTENTE : rejouée sans changement, elle n’écrit rien', () => {
    const { c } = pneumoniqueGrave();
    expect(syncDerivedConditions(c)).toEqual([]);
    expect(syncDerivedConditions(c)).toEqual([]);
    expect(stacks(c, 'inconscient')).toBe(1);
  });

  it('la Fièvre ATTÉNUÉE (LDB 20 l.159) rend la conscience — et le journal NOMME le symptôme', () => {
    const { c } = pneumoniqueGrave();
    const log = applyOps(c, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'fievre' }], { rng: seq([]), defaultUntilTime: MINUTES_PER_DAY });
    // L'instance n'est PAS mutée : c'est la sévérité EFFECTIVE qui redescend, le temps de l'effet.
    expect(c.diseases![0].symptoms.find((s) => s.symptomId === 'fievre')!.severity).toBe('grave');
    expect(severiteEffective(c, 'pneumonie', c.diseases![0].symptoms.find((s) => s.symptomId === 'fievre')!), 'grave → moderee').toBe('moderee');
    expect(stacks(c, 'inconscient')).toBe(0);
    expect(log.some((l) => l.includes('perd l’État Inconscient') && l.includes('Fièvre'))).toBe(true);
  });

  it('le symptôme SUSPENDU (op `suppressSymptom`, LDB 72 l.28) rend la conscience', () => {
    const { c } = pneumoniqueGrave();
    applyOps(c, [{ op: 'suppressSymptom', symptomId: 'fievre' }], { rng: seq([]), label: 'Racine de terre' });
    expect(stacks(c, 'inconscient')).toBe(0);
  });

  it('la maladie GUÉRIE rend la conscience (le fait source a disparu)', () => {
    const { c } = pneumoniqueGrave();
    cureDiseases(c, 1);
    expect(c.diseases).toHaveLength(0);
    expect(stacks(c, 'inconscient')).toBe(0);
    expect(c.conditions.find((x) => x.id === 'inconscient')).toBeUndefined();
    expect(c.conditions.filter((x) => x.derivedFrom), 'un marquage DÉRIVÉ survit à sa source').toEqual([]);
  });

  /** INVARIANT STRUCTUREL : un pion DÉRIVÉ ne se retire QUE par sa source. Le retrait direct
   *  (`removeCondition` : sommeil, soin, dissipation, Détermination) est INERTE sur cette part — le
   *  fait le reposerait de toute façon à la réconciliation (`LDB 20 l.188`, `LDB 16 l.117`). */
  it('`removeCondition` direct est INERTE sur le pion que la Fièvre porte', () => {
    const { c } = pneumoniqueGrave();
    removeCondition(c, 'inconscient', 1);
    expect(stacks(c, 'inconscient'), 'le pion dérivé a été retiré à la main').toBe(1);
    expect(derivedStacks(c, 'inconscient')).toBe(1);
  });

  /** … et la RÉCONCILIATION, elle, l'emporte : l'extinction NATURELLE du fait (la Fièvre redescend
   *  de (Grave), son palier n'émet plus l'op) retire le pion, marquage compris. */
  it('l’extinction NATURELLE du fait (le palier n’émet plus) retire le pion, marquage compris', () => {
    const { c } = pneumoniqueGrave();
    c.diseases![0].symptoms = c.diseases![0].symptoms.map((s) => (s.symptomId === 'fievre' ? { ...s, severity: undefined } : s));
    const log = syncDerivedConditions(c);
    expect(log.some((l) => l.includes('perd l’État Inconscient')), 'aucune ligne de perte au journal').toBe(true);
    expect(stacks(c, 'inconscient')).toBe(0);
    expect(c.conditions.filter((x) => x.derivedFrom?.src?.id === 'fievre'), 'le marquage de la Fièvre survit à son palier').toEqual([]);
  });

  /** LDB 16 l.115, verbatim : « L'État *Inconscient* ne se cumule pas – soit vous êtes *Inconscient*,
   *  soit vous ne l'êtes pas. » Deux causes (KO à 0 PB et Fièvre (Grave)) partagent donc UN pion. */
  it('KO NATIF + Fièvre (Grave) : UN seul pion (l.115), et la fièvre qui redescend ne l’emporte pas', () => {
    const { c } = pneumoniqueGrave();
    addCondition(c, 'inconscient'); // KO à 0 PB (LDB 16) — la pose native prend possession du pion
    expect(stacks(c, 'inconscient'), 'l’État Inconscient s’est cumulé').toBe(1);
    expect(derivedStacks(c, 'inconscient'), 'le pion appartient désormais à la cause NATIVE').toBe(0);
    applyOps(c, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'fievre' }], { rng: seq([]), defaultUntilTime: MINUTES_PER_DAY });
    expect(stacks(c, 'inconscient'), 'le KO natif doit RESTER').toBe(1);
    expect(derivedStacks(c, 'inconscient')).toBe(0);
  });

  /** L'ordre INVERSE (KO natif déjà là, la fièvre passe (Grave) ensuite) donne le MÊME pion unique :
   *  la réconciliation ne pose rien, elle NOMME le fait qui porte aussi l'État. */
  it('KO natif D’ABORD, fièvre (Grave) ensuite : toujours UN pion, nommé par la Fièvre', () => {
    const c = hero({ diseases: [contractDisease('pneumonie', seq([5, 5, 5]))!] });
    addCondition(c, 'inconscient');
    jourDePneumonie(c, false);
    expect(stacks(c, 'inconscient')).toBe(1);
    expect(derivedStacks(c, 'inconscient')).toBe(0);
    expect(c.conditions.find((x) => x.id === 'inconscient')!.derivedFrom!.src).toEqual({ category: 'symptoms', id: 'fievre' });
  });

  it('le REPOS réveille à PB > 0 (LDB 18 l.15), mais la Fièvre (Grave) le rendort aussitôt (« rester alité »)', () => {
    const { c } = pneumoniqueGrave();
    c.wounds.current = 3;
    applyRecoveryDay(c, { sl: 1, success: true });
    expect(c.wounds.current, 'le repos soigne bien').toBeGreaterThan(3);
    expect(stacks(c, 'inconscient'), 'la fièvre tient toujours : l’Inconscient est de retour').toBe(1);
    expect(derivedStacks(c, 'inconscient')).toBe(1);
  });
});

describe('Malaise → l’État Exténué est MATÉRIALISÉ et COLLANT (LDB 20 l.188)', () => {
  /** Infection Mineure : `blesse` + `malaise` + `persistant` — incubation 1 j, durée 5 j. */
  const infecte = (duration = 5) => hero({ diseases: [contractDisease('infection-mineure', seq([1]), { incubation: 1, duration })!] });

  it('l’incubation n’en porte AUCUN ; la phase active pose l’Exténué, marqué et nommé', () => {
    const c = infecte();
    expect(stacks(c, 'extenue')).toBe(0);
    const log = dailyDiseaseUpkeep(c, seq([10]), ignore); // jour 1 → symptômes déclarés
    expect(c.diseases![0].phase).toBe('active');
    expect(stacks(c, 'extenue')).toBe(1);
    expect(derivedStacks(c, 'extenue')).toBe(1);
    expect(log.some((l) => l.includes('gagne l’État Exténué') && l.includes('Malaise'))).toBe(true);
  });

  it('DEUX maladies à Malaise empilent DEUX pions ; guérir l’une n’en rend qu’un', () => {
    const c = hero({
      diseases: [
        contractDisease('infection-mineure', seq([1]), { incubation: 0, duration: 5 })!,
        contractDisease('blessure-purulente', seq([1]), { incubation: 0, duration: 5 })!,
      ],
    });
    expect(syncDerivedConditions(c)).toHaveLength(1); // une ligne : l'État, à 2 pions
    expect(stacks(c, 'extenue')).toBe(2);
    cureDiseases(c, 1);
    expect(stacks(c, 'extenue')).toBe(1);
    cureDiseases(c, 1);
    expect(stacks(c, 'extenue')).toBe(0);
  });

  it('le SOMMEIL ne dissipe pas un Exténué que la maladie porte (« qu’une fois votre maladie guérie »)', () => {
    const c = infecte();
    dailyDiseaseUpkeep(c, seq([10]), ignore);
    expect(stacks(c, 'extenue')).toBe(1);
    applyRecoveryDay(c, null);
    expect(stacks(c, 'extenue'), 'la nuit l’a dissipé — il n’était pas collant').toBe(1);
  });

  it('un Exténué NON dérivé (fatigue ordinaire) part au sommeil, celui du Malaise reste', () => {
    const c = infecte();
    dailyDiseaseUpkeep(c, seq([10]), ignore);
    addCondition(c, 'extenue', 2); // deux pions de fatigue ordinaire
    expect(stacks(c, 'extenue')).toBe(3);
    applyRecoveryDay(c, null);
    expect(stacks(c, 'extenue')).toBe(1);
    expect(derivedStacks(c, 'extenue')).toBe(1);
  });
});

/**
 * Le mécanisme est PORTEUR-AGNOSTIQUE : rien dans le socle ne nomme « symptôme ». Témoin sur une
 * MUTATION (le porteur non-symptôme dont le canal `passive` voyage INLINE sur le Combattant, donc
 * forgeable sans toucher un catalogue) : elle porte son État, le journal la NOMME, une fenêtre de
 * Détermination suspend la source, et la cause qui tient repose l'État à l'échéance (LDB 16 l.117).
 */
describe('un porteur NON-symptôme porte son État par le même socle (#1599)', () => {
  const porteurMutation = (): Combatant =>
    hero({ mutations: [{ id: 'corpulent', label: 'Corpulent', passive: [{ op: 'condition', id: 'sonne' }] }] } as Partial<Combatant>);

  it('la mutation pose l’État, le pion est MARQUÉ et le journal la nomme', () => {
    const c = porteurMutation();
    const log = syncDerivedConditions(c);
    expect(stacks(c, 'sonne')).toBe(1);
    expect(derivedStacks(c, 'sonne')).toBe(1);
    expect(c.conditions[0].derivedFrom!.src).toEqual({ category: 'mutations', id: 'corpulent' });
    expect(log.some((l) => l.includes('gagne l’État Sonné') && l.includes('Corpulent'))).toBe(true);
  });

  it('la fenêtre de Détermination est le DÉFAUT (un Round), et aucun refus n’est opposé', () => {
    const c = porteurMutation();
    syncDerivedConditions(c);
    expect(raisonRefusDetermination(c, 'sonne')).toBeUndefined();
    expect(fenetreDetermination(c, 'sonne', 10_000, desDuTest)).toEqual({ scale: 'rounds', left: 1 });
  });

  it('la suspension de la SOURCE lève l’État ; à l’expiration, la cause le repose', () => {
    const c = porteurMutation();
    syncDerivedConditions(c);
    suspendSource(c, { category: 'mutations', id: 'corpulent' }, { scale: 'rounds', left: 1 }, 'Détermination (conscience)');
    syncDerivedConditions(c);
    expect(stacks(c, 'sonne'), 'la suspension n’a pas levé l’État').toBe(0);
    c.activeEffects = []; // échéance de la fenêtre (purge d'entretien)
    syncDerivedConditions(c);
    expect(stacks(c, 'sonne'), 'la cause tient toujours : l’État doit revenir').toBe(1);
  });
});

describe('la réconciliation reste BON MARCHÉ et sans dérive sur une suite de Rounds', () => {
  it('10 journées d’entretien sur un fiévreux Grave : l’État reste à UN pion, aucun journal répété', () => {
    const { c } = pneumoniqueGrave();
    const lignes: string[] = [];
    for (let j = 0; j < 10; j++) lignes.push(...jourDePneumonie(c, true).filter((l) => /État Inconscient/.test(l)));
    expect(lignes, 'la réconciliation a re-journalisé un État qui n’a pas bougé').toEqual([]);
    expect(stacks(c, 'inconscient')).toBe(1);
    expect(derivedStacks(c, 'inconscient')).toBe(1);
  });

  it('un porteur SANS aucun fait dérivable ne gagne rien et ne journalise rien', () => {
    const c = hero();
    tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
    expect(syncDerivedConditions(c)).toEqual([]);
    expect(c.conditions).toEqual([]);
  });

  /**
   * RE-ENTRANCE : le verrou anti-double-journal est PAR PORTEUR. Un déclencheur d'État (hook
   * `onGainCondition`, câblé par le store) qui applique des ops à un AUTRE combattant pendant la
   * réconciliation du premier doit voir CE combattant-là réconcilié — avec un drapeau de module, le
   * second appel serait inerte et B n'aurait jamais reçu son Inconscient.
   */
  it('un déclencheur qui touche B pendant la réconciliation de A : B reçoit bien son État dérivé', () => {
    const b = hero();
    const { c: a } = pneumoniqueGrave({ conditions: [] });
    a.conditions = [];
    // Le hook est un GLOBAL de module que le store câble à sa création : la sonde REMET le précédent,
    // sinon les fichiers suivants du même worker jouent un combat sans déclencheur `onGainCondition`.
    const precedent = setConditionGainedHook((porteur) => {
      if (porteur !== a) return;
      // B contracte à son tour, PENDANT la réconciliation de A (applyOps clôt par `syncDerivedConditions`).
      applyOps(b, [{ op: 'contractDisease', disease: 'pneumonie' }], { rng: seq([5, 5, 5]) });
      b.diseases![0].phase = 'active';
      b.diseases![0].symptoms = b.diseases![0].symptoms.map((s) => (s.symptomId === 'fievre' ? { ...s, severity: 'grave' as const } : s));
      applyOps(b, [], { rng: seq([]) });
    });
    try {
      syncDerivedConditions(a);
    } finally {
      setConditionGainedHook(precedent);
    }
    expect(stacks(a, 'inconscient'), 'A n’a pas reçu le sien').toBe(1);
    expect(stacks(b, 'inconscient'), 'B n’a jamais été réconcilié (verrou GLOBAL)').toBe(1);
    expect(derivedStacks(b, 'inconscient')).toBe(1);
  });
});
