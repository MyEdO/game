import { describe, it, expect } from 'vitest';
import { Combatant, type UpkeepDeferTest } from './types';
import { porteEntretien, applique } from './upkeepPorte.testkit';
import { RNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import {
  contractDisease,
  tickDisease,
  diseaseBlesseCount,
  diseasePassiveOps,
  diseasePsychTraits,
  rollContraction,
  applyDiseasePersist,
  symptomOnTick,
} from './disease';
import { effectivePsychTraits, isFrenzyCapable } from './psychology';
import type { GameOp } from './ops';

/** RNG scripté : renvoie les valeurs dans l'ordre (déjà dans les bornes attendues). */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] };
}

/** La PORTE, quand le Test différé n'est PAS le sujet du test (avance d'incubation/durée) : elle reçoit
 *  et on n'en juge rien. Les tests qui jugent une CONSÉQUENCE collectent (`porteEntretien`) puis
 *  INJECTENT l'issue (`applique`) — le moteur ne roule plus aucun de ces jets (#1657 B3-3). */
const ignore: UpkeepDeferTest = () => {};

/** Porteur de sonde — `conditions`/`skills` présents comme sur un vrai Combatant : la guérison
 *  réconcilie les États PORTÉS par les passifs des symptômes (`syncDerivedConditions`), elle LIT
 *  donc les États. */
const sick = (over: Partial<Combatant> = {}): Combatant =>
  ({ label: 'Malade', diseases: [], conditions: [], skills: [], ...over }) as Combatant;

describe('disease — cycle de vie (LDB 20, sourcé)', () => {
  it('contractDisease(Infection Mineure) : incubation/durée figées, symptômes sourcés', () => {
    const dz = contractDisease('infection-mineure', seq([]), { incubation: 3, duration: 5 })!;
    expect(dz.phase).toBe('incubation');
    expect(dz.minutesLeft).toBe(3 * MINUTES_PER_DAY);
    expect(dz.durationMinutes).toBe(5 * MINUTES_PER_DAY);
    expect(dz.persistDifficulty).toBe('facile');
    expect(dz.symptoms.map((s) => s.symptomId).sort()).toEqual(['blesse', 'malaise', 'persistant']);
  });

  it('contractDisease(nom inconnu) → null', () => {
    expect(contractDisease('Lèpre imaginaire', seq([]))).toBeNull();
  });

  // ── Durée unit-aware (heures|jours|minutes) → MINUTES — zéro dette « sous-journalier ≈ 0 jour » ──
  it('incubation en HEURES (Courante Galopante, LDB 20 l.43) : bascule en actif après quelques heures, DANS la journée', () => {
    // incubation 1d10 heures (jet=2 → 120 min), durée 1d10 jours (jet=4).
    const dz = contractDisease('courante-galopante', seq([2, 4]))!;
    expect(dz.phase).toBe('incubation'); // 2 h > 0 : plus jamais arrondi à 0 → vrai temps d'incubation
    expect(dz.minutesLeft).toBe(120);
    const c = sick({ diseases: [dz] });
    tickDisease(c, 60, seq([]), ignore); // +1 h (sous la journée) → pas encore
    expect(c.diseases![0].phase).toBe('incubation');
    expect(c.diseases![0].minutesLeft).toBe(60);
    tickDisease(c, 60, seq([]), ignore); // +1 h → 2 h écoulées → symptômes ACTIFS
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY); // durée mémorisée (4 jours)
  });

  it('maladie à l’ÉCHELLE jour : avance jour par jour (comportement existant préservé)', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 2, duration: 5 })!] });
    tickDisease(c, MINUTES_PER_DAY, seq([]), ignore); // 1 jour
    expect(c.diseases![0].phase).toBe('incubation');
    expect(c.diseases![0].minutesLeft).toBe(1 * MINUTES_PER_DAY);
    tickDisease(c, MINUTES_PER_DAY, seq([]), ignore); // 2e jour → actif
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY);
  });

  it('durée en HEURES (Mal de mer « par heure », MDG 14) : la maladie s’achève DANS la journée', () => {
    const dz = contractDisease('mal-de-mer', seq([]))!; // incubation instantanée (0) ; durée fixe 1 heure
    expect(dz.phase).toBe('active');
    expect(dz.minutesLeft).toBe(60);
    const c = sick({ diseases: [dz] });
    const { specs, defer } = porteEntretien();
    tickDisease(c, 60, seq([]), defer); // 1 h écoulée → fin de durée → le Test de fin part À LA PORTE
    expect(specs.map((s) => s.kind)).toEqual(['diseasePersist']);
    const log = applique(c, specs[0], { success: true }); // issue INJECTÉE : réussite
    expect(c.diseases).toHaveLength(0); // guérie en moins d’une journée — plus de durée « ≈ 1 jour » parasite
    expect(c.diseaseImmunities).toContain('mal-de-mer');
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it('incubation → active : les symptômes se déclarent, puis comptent', () => {
    // L'État *Exténué* du Malaise (LDB 20 l.188) est un op `condition` du canal PASSIF du symptôme :
    // il n'est émis que lorsque la maladie est ACTIVE. C'est ce que le collecteur montre ici ; sa
    // matérialisation sur le porteur est le socle `syncDerivedConditions` (voir `rest.test.ts`).
    const extenuePorte = (x: Combatant) => diseasePassiveOps(x).filter((m) => m.op.op === 'condition' && m.op.id === 'extenue').length;
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 2, duration: 5 })!] });
    expect(extenuePorte(c)).toBe(0); // incubation = pas encore de symptômes
    const log = tickDisease(c, 2 * MINUTES_PER_DAY, seq([]), ignore);
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY);
    expect(log.some((l) => /se déclarent/.test(l))).toBe(true);
    expect(extenuePorte(c)).toBe(1);
    expect(diseaseBlesseCount(c)).toBe(1);
  });

  it('persistant réussi en fin de durée → guérison naturelle', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // jour actif : Blessé (Résistance Accessible) puis persistant (Facile) — les DEUX partent à la porte,
    // et les DEUX sont ici réussis (issue INJECTÉE).
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    const log = specs.flatMap((s) => applique(c, s, { success: true }));
    expect(c.diseases!.length).toBe(0);
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it('blessé raté → développe une Blessure Purulente (l.110)', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // Blessé RATÉ → contracte BP (sa durée = 1d10 → 5) ; puis persistant RATÉ d'un échec MINIME (DR 0)
    // → BP (déjà là). L'Infection Mineure s'achève. Les deux issues sont INJECTÉES.
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    const tick = specs.find((s) => s.kind === 'diseaseTick')!;
    const persist = specs.find((s) => s.kind === 'diseasePersist')!;
    applique(c, tick, { success: false }, seq([5]));
    applique(c, persist, { success: false, sl: -3 }, seq([5]));
    expect(c.diseases!.map((d) => d.id)).toEqual(['blessure-purulente']);
    expect(c.diseases![0].phase).toBe('active'); // contractée « instantanément » (l.32)
  });

  it('tickDisease(defer) : DIFFÈRE les Tests (cycle Blessé + persistant), n’en roule AUCUN, résolus par les applicateurs', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    const kinds: string[] = [];
    // seq([]) : si un seul jet était tiré, il renverrait undefined — la cascade ne DOIT rien rouler.
    const log = tickDisease(c, MINUTES_PER_DAY, seq([]), (spec) => kinds.push(spec.kind));
    expect(kinds.sort()).toEqual(['diseasePersist', 'diseaseTick']); // Blessé → étape générique 'diseaseTick'
    expect(c.diseases![0].endTestPending).toBe(true); // la maladie attend la validation de son étape
    expect(log.some((l) => /guérit|persiste|Purulente|Gangrène/.test(l))).toBe(false); // RIEN pré-résolu
    // Résolution à la validation des étapes : le Test de cycle réussi serait un no-op (onFail non appliqué
    // par l'applier `diseaseTick` côté state) ; persistant réussi → guérison.
    applyDiseasePersist(c, 'infection-mineure', true, 2, seq([]));
    expect(c.diseases!.length).toBe(0);
  });

  /** Le Test différé NOMME le symptôme joué (#1117) : c'est lui qui fait descendre le renvoi de règle
   *  de l'étape à SA fiche (Codex « Symptômes ») au lieu de l'intro du chapitre des maladies. */
  it('tickDisease(defer) : chaque Test différé porte le SYMPTÔME joué dans son meta', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    const specs: { kind: string; meta?: Record<string, unknown> }[] = [];
    tickDisease(c, MINUTES_PER_DAY, seq([]), (spec) => specs.push(spec));
    const bySymptom = Object.fromEntries(specs.map((s) => [s.kind, s.meta?.symptomId]));
    expect(bySymptom.diseaseTick, 'le cycle quotidien nomme SON symptôme').toBe('blesse');
    expect(bySymptom.diseasePersist, 'la fin de Durée nomme le symptôme Persistant').toBe('persistant');
  });

  it('persistant échec stupéfiant (−6) → Infection du Sang', () => {
    // résistance haute pour réussir le blessé (pas de BP parasite), mais on force l'échec stupéfiant du persistant.
    const c = sick({ diseases: [contractDisease('blessure-purulente', seq([]), { incubation: 0, duration: 1 })!] });
    // Blessé RÉUSSI (pas de BP parasite) ; persistant raté d'un échec STUPÉFIANT (DR −10 ≤ −6) →
    // Infection du Sang (sa durée = 1d10 → 5). Issues INJECTÉES.
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    applique(c, specs.find((s) => s.kind === 'diseaseTick')!, { success: true });
    const log = applique(c, specs.find((s) => s.kind === 'diseasePersist')!, { success: false, sl: -10 }, seq([5]));
    expect(c.diseases!.map((d) => d.id)).toContain('infection-du-sang');
    expect(log.some((l) => /stupéfiant/.test(l))).toBe(true);
  });

  it('grantPsychTrait des symptômes actifs (Rage meurtrière) : Haine + Frénésie EFFECTIFS tant que la maladie est active, retirés à la guérison', () => {
    const lowRng: RNG = { int: () => 1 }; // tout Test réussit (roll=1) → cycle/persistant réussis
    // Témoin : aucune maladie → aucun Trait psy dérivé.
    expect(effectivePsychTraits(sick())).toEqual([]);

    // Vérole cérébrale à taches vertes ACTIVE (symptôme « Rage meurtrière » manifesté).
    const dz = contractDisease('verole-cerebrale-a-taches-vertes', lowRng, { incubation: 0, duration: 1 })!;
    expect(dz.phase).toBe('active');
    const c = sick({ diseases: [dz] });

    // La donnée du symptôme (passive grantPsychTrait) est CÂBLÉE : Haine dont la Cible est l'id de Groupe
    // `vivant` (Middenheim 131 « toutes les choses vivantes » ; groupMatch, engine/groups.ts:156) + Frénésie.
    // (diseasePsychTraits = le collecteur ; effectivePsychTraits = stockés ∪ dérivés.)
    expect(diseasePsychTraits(c)).toEqual([
      { type: 'haine', cible: 'vivant' },
      { type: 'frenesie' },
    ]);
    const active = effectivePsychTraits(c);
    expect(active).toContainEqual({ type: 'haine', cible: 'vivant' });
    expect(active).toContainEqual({ type: 'frenesie' });
    // EFFET RÉEL (pas juste l'appartenance à la liste) : la Frénésie octroyée par la maladie rend
    // le combattant frénésie-CAPABLE — sinon le grant resterait inerte au combat.
    expect(isFrenzyCapable(sick())).toBe(false); // témoin : sans maladie ni trait/talent
    expect(isFrenzyCapable(c)).toBe(true);

    // Fin de durée → Test persistant (Accessible) RÉUSSI (issue injectée) → guérison → Traits retirés
    // d'office (dérivation, zéro bookkeeping : la maladie n'est plus active donc plus rien à dériver).
    const { specs, defer } = porteEntretien();
    tickDisease(c, MINUTES_PER_DAY, lowRng, defer);
    for (const s of specs) applique(c, s, { success: true });
    expect(c.diseases).toHaveLength(0);
    expect(effectivePsychTraits(c)).toEqual([]);
  });

  it('symptôme en INCUBATION : pas encore manifesté → aucun Trait psy dérivé', () => {
    const dz = contractDisease('verole-cerebrale-a-taches-vertes', { int: () => 1 }, { incubation: 2, duration: 5 })!;
    expect(dz.phase).toBe('incubation');
    expect(diseasePsychTraits(sick({ diseases: [dz] }))).toEqual([]); // dérivation gatée par phase==='active'
  });

  it('diseasePassiveOps : fièvre = charMod −10 aux Physiques/Sociaux, rien au Mental', () => {
    const c = sick({ diseases: [contractDisease('blessure-purulente', seq([]), { incubation: 0, duration: 5 })!] });
    const ops = diseasePassiveOps(c).map((m) => m.op).filter((o): o is Extract<GameOp, { op: 'charMod' }> => o.op === 'charMod');
    const modOf = (char: string) => ops.filter((o) => o.char === char).map((o) => o.mod);
    expect(modOf('force')).toEqual([-10]);
    expect(modOf('sociabilite')).toEqual([-10]);
    expect(modOf('intelligence')).toEqual([]); // Mental non touché
    expect(modOf('force-mentale')).toEqual([]);
  });

  describe('Toxine (LDB 20 l.211-215) — Test de Résistance quotidien indexé sur la sévérité, mort à l’échec', () => {
    it('difficulté par défaut Très Facile (+60), onFail = kill', () => {
      const tick = symptomOnTick({ symptomId: 'toxine' })!;
      expect(tick.difficulty).toBe('tresFacile');
      expect(tick.onFail).toEqual([{ op: 'kill' }]);
    });

    it('« Toxine (Modéré) » → Facile (+40)', () => {
      const tick = symptomOnTick({ symptomId: 'toxine', severity: 'moderee' })!;
      expect(tick.difficulty).toBe('facile');
      expect(tick.onFail).toEqual([{ op: 'kill' }]);
    });

    it('« Toxine (Grave) » → Accessible (+20)', () => {
      const tick = symptomOnTick({ symptomId: 'toxine', severity: 'grave' })!;
      expect(tick.difficulty).toBe('accessible');
    });

    /** Le Test part à la porte ; on juge la branche sur une issue INJECTÉE, jamais sur un dé tiré ici. */
    const toxine = (over: Partial<Combatant>) => {
      const c = sick({ diseases: [contractDisease('infection-du-sang', seq([]), { incubation: 0, duration: 5 })!], ...over });
      const { specs, defer } = porteEntretien();
      tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
      const tick = specs.find((s) => s.kind === 'diseaseTick' && s.meta?.symptomId === 'toxine')!;
      expect(tick, 'la Toxine doit poser SON Test à la porte').toBeTruthy();
      return { c, tick };
    };

    it('le Test de la Toxine passe par la PORTE, en nommant ce qu’il teste (LDB 20 l.212 : Résistance)', () => {
      const { tick } = toxine({ fate: 0 });
      expect(tick.test).toEqual({ skill: 'resistance' });
      expect(tick.difficulty).toBe('tresFacile');
      expect(tick.base, 'aucune valeur maison : la porte la calcule').toBeUndefined();
    });

    it('Test RATÉ (issue injectée) → la cible MEURT (LDB 20 l.215 : « ou vous mourrez »)', () => {
      const { c, tick } = toxine({ fate: 0 });
      const log = applique(c, tick, { success: false });
      expect(c.dead).toBe(true);
      expect(log.some((l) => /succombe/.test(l))).toBe(true);
    });

    it('Test raté MAIS 1 Point de Destin (LDB 17 l.29-37) → sauvé in extremis, pas mort', () => {
      const { c, tick } = toxine({ fate: 1, wounds: { current: 0, max: 10 } });
      const log = applique(c, tick, { success: false });
      expect(c.dead).toBeFalsy();
      expect(c.fate).toBe(0);
      expect(log.some((l) => /sauvé/.test(l))).toBe(true);
    });

    it('Test RÉUSSI → aucune conséquence, la maladie continue', () => {
      const { c, tick } = toxine({ fate: 0 });
      const log = applique(c, tick, { success: true });
      expect(c.dead).toBeFalsy();
      expect(log).toEqual([]);
    });
  });

  describe('rollContraction (post-critique +60, Chirurgie +20)', () => {
    it('Test de Résistance réussi → aucune maladie', () => {
      const c = sick();
      // resVal 80, Très Facile (+60) → cible plafonnée ; d100=5 réussit.
      const log = rollContraction(c, 'infection-mineure', 80, 'tresFacile', seq([5]));
      expect(c.diseases ?? []).toHaveLength(0);
      expect(log).toHaveLength(0);
    });

    it('Test raté → contracte la maladie (incubation/durée tirées ensuite)', () => {
      const c = sick();
      // resVal 1, Très Facile (+60) → cible 61 ; d100=99 échoue → contractDisease tire incubation=3, durée=5.
      const log = rollContraction(c, 'infection-mineure', 1, 'tresFacile', seq([99, 3, 5]));
      expect(c.diseases!.map((d) => d.id)).toEqual(['infection-mineure']);
      expect(log.some((l) => /contracte/.test(l))).toBe(true);
    });

    it('déjà porteur de la maladie → ne relance rien (dédoublonnage)', () => {
      const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 5 })!] });
      const log = rollContraction(c, 'infection-mineure', 1, 'tresFacile', seq([])); // aucun jet
      expect(c.diseases!).toHaveLength(1);
      expect(log).toHaveLength(0);
    });
  });
});

// ── Maladies transmises par l'eau (MSRC 16, Mort sur le Reik Compagnon) ──────────────────────────
import { testStatePenalty, combatTestPenalty } from './conditions';
import { passiveGlobalTestMod, passiveMods } from './trauma';
import { applyOps } from './ops';

const fullSick = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'p', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 35 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, weapons: [], diseases: [],
    ...over,
  }) as Combatant;

const activeDisease = (symptomId: string, extra: Partial<import('./disease').Disease> = {}) => ({
  id: `dz-${symptomId}`, phase: 'active' as const, symptoms: [{ symptomId }],
  minutesLeft: 40 * MINUTES_PER_DAY, durationMinutes: 40 * MINUTES_PER_DAY, ...extra,
});

describe('MSRC 16 — Crampes abdominales : pénalité GLOBALE de Test (testMod, pas charMod)', () => {
  it('−20 à TOUS les Tests via testMod global (sans fausser les stats dérivées)', () => {
    const c = fullSick({ diseases: [activeDisease('crampes-abdominales')] });
    // Le passif est un testMod global : consommé par testStatePenalty/combatTestPenalty, JAMAIS un charMod.
    expect(diseasePassiveOps(c)).toEqual([{ op: { op: 'testMod', amount: -20 }, kind: 'maladie', src: { category: 'symptoms', id: 'crampes-abdominales' } }]);
    expect(passiveGlobalTestMod(c)).toBe(-20);
    expect(testStatePenalty(c)).toBe(-20);
    expect(combatTestPenalty(c)).toBe(-20);
    // La Caractéristique de BASE n'est PAS touchée (≠ charMod) → stats dérivées intactes.
    expect(c.characteristics.force).toBe(30);
    // Aucun charMod émis par la maladie (pool non-cumul de caractéristiques vide).
    expect(passiveMods(c).filter((m) => m.op.op === 'charMod')).toEqual([]);
  });
});

describe('MSRC 16 — Vers de carie : phase active PERSISTANTE (dégénérescence quotidienne jusqu’à la Mort, l.90-103)', () => {
  it('DONNÉE RÉELLE : « Durée : 1 semaine » n’END PAS la maladie — elle reste active et dégénère chaque jour ≥ J+7', () => {
    const c = fullSick({ diseases: [contractDisease('vers-de-carie', seq([]), { incubation: 0 })!] });
    expect(c.diseases![0].durationMinutes).toBe(7 * MINUTES_PER_DAY); // installation = 1 semaine
    const steps: { kind: string }[] = [];
    const defer = (s: { kind: string }) => steps.push(s);
    for (let d = 0; d < 6; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    expect(steps.filter((s) => s.kind === 'diseaseTick').length).toBe(0); // < J+7 : aucun Test de cycle
    for (let d = 0; d < 5; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), defer); // J+7 → J+11
    expect(c.diseases?.length).toBe(1); // TOUJOURS active (persistentActive — pas de guérison à l'épuisement de la Durée)
    expect(steps.filter((s) => s.kind === 'diseaseTick').length).toBeGreaterThanOrEqual(5); // dégénérescence CHAQUE jour ≥ J+7
  });

  it('rollTable du symptôme (échec + DR négatif) : Initiative rongée … jusqu’à la Mort', () => {
    const c = fullSick({ diseases: [contractDisease('vers-de-carie', seq([]), { incubation: 0 })!] });
    const steps: { meta?: Record<string, unknown> }[] = [];
    const defer = (s: { meta?: Record<string, unknown> }) => steps.push(s);
    for (let d = 0; d < 7; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), defer);
    const table = steps.map((s) => s.meta?.opsEchec).find((o): o is import('./ops').GameOp[] => Array.isArray(o) && o[0]?.op === 'rollTable')!;
    const dead = fullSick();
    applyOps(dead, table, { rng: { int: () => 10 }, sl: -3 }); // d10=10 + |DR −3| = 13 → Mort
    expect(dead.dead).toBe(true);
    const dizzy = fullSick();
    applyOps(dizzy, table, { rng: (() => { const v = [1, 6]; let i = 0; return { int: () => v[i++] }; })(), sl: 0 }); // 1-2 → −1d10 Initiative
    expect(dizzy.characteristics.initiative).toBe(24);
  });
});

describe('MSRC 16 — Vers du Reik : −10 Soc GATÉ visibilité (l.140) + éclatement au 7ᵉ jour', () => {
  it('−5 Agilité toujours ; −10 Sociabilité SEULEMENT si la cloque est à un endroit VISIBLE (jet de Localisation)', () => {
    const vis = fullSick({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 1 })!] });
    tickDisease(vis, MINUTES_PER_DAY, seq([5]), ignore); // transition → localisation 5 = Tête (VISIBLE)
    expect(vis.diseases![0].blisterLocation).toBe('tete');
    expect(diseasePassiveOps(vis).map((m) => m.op)).toContainEqual({ op: 'charMod', char: 'agilite', mod: -5 });
    expect(diseasePassiveOps(vis).map((m) => m.op)).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -10 });
    const cov = fullSick({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 1 })!] });
    tickDisease(cov, MINUTES_PER_DAY, seq([50]), ignore); // transition → localisation 50 = Corps (COUVERT)
    expect(cov.diseases![0].blisterLocation).toBe('corps');
    expect(diseasePassiveOps(cov).map((m) => m.op)).toContainEqual({ op: 'charMod', char: 'agilite', mod: -5 });
    expect(diseasePassiveOps(cov).some(({ op: o }) => o.op === 'charMod' && o.char === 'sociabilite')).toBe(false);
  });

  it('éclatement au 7ᵉ jour actif (inconditionnel) : 1 Blessure + État Sonné', () => {
    const c = fullSick({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 0 })!] });
    for (let d = 0; d < 6; d++) tickDisease(c, MINUTES_PER_DAY, seq([]), ignore);
    expect(c.wounds.current).toBe(12);
    tickDisease(c, MINUTES_PER_DAY, seq([]), ignore); // 7ᵉ jour actif → cloque éclate
    expect(c.wounds.current).toBe(11);
    expect(c.conditions.find((x) => x.id === 'sonne')?.value).toBe(1);
  });
});

// ── Corrections coordinateur : permanence des Traits de table (l.103) + rampe d'incubation (l.138) ──
import { activeDiseaseTestMod } from './disease';
import { dropExpiredGrantedTraits } from './grantedTraits';

describe('MSRC 16 — Vers de carie : Traits de table PERMANENTS (l.103)', () => {
  it('grantTrait SANS durée = effet permanent → survit à la guérison + à un balayage d’effets expirés', () => {
    const c = fullSick();
    applyOps(c, [{ op: 'grantTrait', traitId: 'nerveux' }], { rng: seq([]) }); // rangée 9 de la table
    expect((c.traits ?? []).some((t) => t.id === 'nerveux')).toBe(true);
    const eff = (c.activeEffects ?? []).find((e) => e.grantedTrait?.id === 'nerveux');
    expect(eff?.duration.scale).toBe('permanent'); // ni horloge ni Rounds → jamais purgé (l.103)
    c.diseases = []; // la maladie se termine…
    dropExpiredGrantedTraits(c, []); // …aucun effet EXPIRÉ → le Trait demeure
    expect((c.traits ?? []).some((t) => t.id === 'nerveux')).toBe(true);
  });
});

describe('MSRC 16 — Vers du Reik : rampe −5/30j sur TOUTE l’infection + décroissance −1/j après la fin (l.138)', () => {
  it('rampe pendant l’incubation (0 → −5 à 30 j → −10 à 60 j)', () => {
    const c = fullSick({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 200, duration: 7 })!] });
    expect(c.diseases![0].phase).toBe('incubation');
    expect(activeDiseaseTestMod(c, 'peste-noire')).toBe(0); // < 30 j : aucune tranche complète
    tickDisease(c, 30 * MINUTES_PER_DAY, seq([]), ignore);
    expect(activeDiseaseTestMod(c, 'peste-noire')).toBe(-5); // 1 période
    tickDisease(c, 30 * MINUTES_PER_DAY, seq([]), ignore);
    expect(activeDiseaseTestMod(c, 'peste-noire')).toBe(-10); // 2 périodes
  });

  it('la rampe NE tombe PAS à 0 en phase active (scope = infection, pas incubation seule)', () => {
    const c = fullSick({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 0, duration: 7 })!] });
    c.diseases![0].infectedMinutes = 60 * MINUTES_PER_DAY; // 2 périodes accumulées, DÉJÀ en phase active
    expect(c.diseases![0].phase).toBe('active');
    expect(activeDiseaseTestMod(c, 'peste-noire')).toBe(-10);
  });

  it('décroissance résiduelle −1/jour jusqu’à 0 après la mort du ver', () => {
    const c = fullSick({ diseases: [contractDisease('vers-du-reik', seq([]), { incubation: 0, duration: 7 })!] });
    c.diseases![0].infectedMinutes = 60 * MINUTES_PER_DAY; // 2 périodes déjà courues
    tickDisease(c, 7 * MINUTES_PER_DAY, seq([]), ignore); // épuise la durée active → guérison → résidu figé
    expect(c.diseases?.length ?? 0).toBe(0);
    expect(c.residualDiseaseTestMod).toBe(10); // 2 × 5, survit à la mort du ver
    tickDisease(c, 3 * MINUTES_PER_DAY, seq([]), ignore); // −1/jour × 3
    expect(c.residualDiseaseTestMod).toBe(7);
    tickDisease(c, 7 * MINUTES_PER_DAY, seq([]), ignore); // −7 → 0 → nettoyé
    expect(c.residualDiseaseTestMod).toBeUndefined();
  });
});
