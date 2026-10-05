/**
 * Tables d'Imparfaites/Colère pleinement mécaniques (LDB 46 l.34-80, 40 l.52-89) :
 * ops émises par les tables, pénalités/blocages d'incantation temporisés, plafond
 * de DR de Prière, Tests imbriqués à palier (« Purifier la chair »).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { rollMiscast } from './miscast';
import { applyOps, type GameOp } from './ops';
import {
  castingValue, castBlockedBy, prayerMaxZeroDR, evaluateCasting, castPenaltyMod,
} from './magic';
import { endOfRound, removeCondition, hasCondition, isMagicallyAsleep } from './conditions';
import { outOfCombatUpkeep } from '../state/outOfCombatUpkeep';
import type { Flow } from './flowCore';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 35, sociabilite: 45 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { id: 'priere', advances: 10 }, { id: 'langue', spec: 'magick', advances: 10 },
      { id: 'focalisation', advances: 10 },
    ] as never,
    talents: [],
    ...p,
  } as Combatant;
}

describe('castPenalty — pénalités/blocages temporisés', () => {
  it('Langue maladroite : −10 aux Tests de Langue pendant N Rounds, dissipé par endOfRound', () => {
    const c = hero();
    const base = castingValue(c, 'langue', 'magick');
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'langue' }, mod: -10, rounds: 2 }], { label: 'Langue maladroite' });
    expect(castingValue(c, 'langue', 'magick')).toBe(base - 10);
    expect(castPenaltyMod(c, 'priere')).toBe(0); // ne touche pas la Prière
    endOfRound(c, makeRNG(1));
    expect(castingValue(c, 'langue', 'magick')).toBe(base - 10); // round 1 restant
    const log = endOfRound(c, makeRNG(1));
    expect(castingValue(c, 'langue', 'magick')).toBe(base); // expiré
    expect(log.join('\n')).toMatch(/Langue maladroite se dissipe/);
  });

  it('blocage : « Vous abusez de ma patience » interdit les Tests de Prière', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'priere' }, blocked: true, rounds: 3 }], { label: 'Vous abusez de ma patience' });
    expect(castBlockedBy(c, 'priere')).toBe('Vous abusez de ma patience');
    expect(castBlockedBy(c, 'langue')).toBeNull();
  });

  it('durée d\'horloge : untilTime = now + minutes/heures/jours', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'langue' }, blocked: true, minutes: 5 }], { label: 'Drain de puissance', now: 1000 });
    expect(c.castPenalties![0].untilTime).toBe(1005);
    const c2 = hero();
    applyOps(c2, [{ op: 'castPenalty', skill: { id: 'priere' }, maxZeroDR: true, days: 7 }], { label: 'Pensez à vos actes', now: 0 });
    expect(c2.castPenalties![0].untilTime).toBe(7 * 24 * 60);
  });

  it('« Pensez à vos actes » : tout Test de Prière RÉUSSI plafonné à 0 DR', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'priere' }, maxZeroDR: true, days: 7 }], { label: 'Pensez à vos actes', now: 0 });
    expect(prayerMaxZeroDR(c)).toBe(true);
    const prayer = { label: 'Bénédiction de Guérison', ecole: 'Béni', family: 'beni' as const, cn: null, desc: 'soin' };
    const res = evaluateCasting(c, prayer, { roll: 5, target: 55, success: true, sl: 5, isDouble: false });
    expect(res.cast).toBe(true);
    expect(res.sl).toBe(0); // plafonné
    // Un SORT (Langue) n'est pas plafonné.
    const sort = { label: 'X', ecole: 'Magie mineure', cn: 0, desc: 'x' };
    expect(evaluateCasting(c, sort, { roll: 5, target: 50, success: true, sl: 4, isDouble: false }).sl).toBe(4);
  });
});

// Les Tests imbriqués des tables (« Résistance Accessible ou Sonné », « FM ou Corruption ») ne sont PLUS
// des op `test` (supprimée Lot 4d) : `rollMiscast` les expose en `MiscastResult.testFlow` (nœud Flow
// `{kind:'test'}`), résolu CADENCE-AWARE par `applyMiscast`→`runCombatFlow` (héros manuel = jet
// influençable ; ennemi = inline). On vérifie ici la STRUCTURE produite (skill/carac/difficulté, branche
// d'échec, palier `onFailHard` via Condition `slThreshold ≤ −4`) ; la RÉSOLUTION cadence-aware (étape
// influençable, onCorruption, Inconscient à −4 DR) est testée au niveau store (`state/miscast-test.test`).
describe('Tests imbriqués des tables → nœud Flow `test`', () => {
  /** Premier `rollMiscast(sev, ...)` dont le nom commence par `prefix` (échantillonne les graines). */
  function rowNamed(sev: Parameters<typeof rollMiscast>[0], prefix: string, sin = 0) {
    for (let seed = 0; seed < 600; seed++) {
      const r = rollMiscast(sev, makeRNG(seed), sin);
      if (r.label.startsWith(prefix)) return r;
    }
    throw new Error(`entrée « ${prefix} » introuvable`);
  }

  it('« Murmures mortels » : testFlow = Test de FM Accessible → +1 Corruption sur échec', () => {
    const r = rowNamed('mineure', 'Murmures mortels');
    expect(r.testFlow).toBeTruthy();
    const node = r.testFlow!;
    expect(node.kind).toBe('test');
    if (node.kind !== 'test') return;
    expect(node.test.characteristic).toBe('force-mentale');
    expect(node.test.difficulty).toBe('accessible');
    // Branche d'échec = un `do` ops {corruption +1}.
    expect(node.fail.kind).toBe('do');
    if (node.fail.kind === 'do' && node.fail.effect.type === 'ops') {
      expect(node.fail.effect.ops).toContainEqual({ op: 'corruption', amount: 1 });
    }
  });

  it('« Choc aethyrique » : 1d10 Blessures IMMÉDIATES (ops) + testFlow Résistance → Sonné', () => {
    const r = rowNamed('majeure', 'Choc aethyrique');
    expect(r.ops.some((o) => o.op === 'wounds')).toBe(true); // Dégâts AVANT le Test (ops immédiats)
    const node = r.testFlow!;
    expect(node.kind).toBe('test');
    if (node.kind !== 'test') return;
    expect(node.test.skill).toEqual({ id: 'resistance' });
    expect(node.test.difficulty).toBe('accessible');
  });

  it('« Purifier la chair » : testFlow Résistance Difficile, palier −4 DR → Inconscient (slThreshold)', () => {
    const r = rowNamed('colere', 'Purifier la chair');
    expect(r.ops.some((o) => o.op === 'wounds')).toBe(true); // 2d10 Blessures immédiates
    const node = r.testFlow!;
    expect(node.kind).toBe('test');
    if (node.kind !== 'test') return;
    expect(node.test.skill).toEqual({ id: 'resistance' });
    expect(node.test.difficulty).toBe('difficile');
    // Branche d'échec = seq[ do{Sonné}, if slThreshold(≤ −4) → do{Inconscient} ] (palier onFailHard).
    expect(node.fail.kind).toBe('seq');
    if (node.fail.kind !== 'seq') return;
    const sonne = node.fail.steps[0];
    expect(sonne.kind).toBe('do');
    if (sonne.kind === 'do' && sonne.effect.type === 'ops') expect(sonne.effect.ops.some((o) => o.op === 'condition' && o.id === 'sonne')).toBe(true);
    const hard = node.fail.steps[1];
    expect(hard.kind).toBe('if');
    if (hard.kind === 'if') {
      expect(hard.cond).toEqual({ kind: 'slThreshold', op: '<=', value: -4 });
      expect(hard.then.kind).toBe('do');
      if (hard.then.kind === 'do' && hard.then.effect.type === 'ops') expect(hard.then.effect.ops.some((o) => o.op === 'condition' && o.id === 'inconscient')).toBe(true);
    }
  });
});

describe('tables migrées — sweep d\'application', () => {
  it('toutes les entrées atteignables s\'appliquent sans erreur sur un Combatant', () => {
    for (const sev of ['mineure', 'majeure', 'colere'] as const) {
      for (let seed = 0; seed < 120; seed++) {
        const c = hero();
        const r = rollMiscast(sev, makeRNG(seed), sev === 'colere' ? seed % 6 : 0);
        const lines = applyOps(c, r.ops, { rng: makeRNG(seed + 1), label: r.label, now: 0 });
        expect(Array.isArray(lines)).toBe(true);
      }
    }
  });

  it('« Tenue indisciplinée » (LDB 46) : escapeStrength (1d10×5) SURVIT à expandOp → GameOp résolu', () => {
    // Preuve TDD de la propagation `JsonOp.escapeStrength` → `GameOp.escapeStrength` par `expandOp`
    // (`engine/miscast.ts`) : sans elle, l'Empêtré de cette entrée perd sa Force d'évasion à la
    // résolution (silencieusement, un Test opposé simple au lieu du 1d10×5 RAW).
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const r = rollMiscast('mineure', makeRNG(seed), 0);
      if (r.label !== 'Tenue indisciplinée') continue;
      found = true;
      const op = r.ops.find((o) => o.op === 'condition' && o.id === 'empetre')!;
      expect(op).toBeTruthy();
      expect((op as { escapeStrength?: unknown }).escapeStrength).toBeTruthy();
      const c = hero();
      applyOps(c, r.ops, { rng: makeRNG(1), label: r.label });
      const inst = c.conditions.find((x) => x.id === 'empetre')!;
      expect(inst.escapeStrength! % 5).toBe(0);
      expect(inst.escapeStrength).toBeGreaterThanOrEqual(5);
      expect(inst.escapeStrength).toBeLessThanOrEqual(50);
    }
    expect(found).toBe(true);
  });

  it('« Tenez compte de mes enseignements » porte la durée 1d10 + Péchés (formule plus)', () => {
    // Force l'entrée 11-15 : on échantillonne jusqu'à la trouver.
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 0);
      if (!r.label.startsWith('Tenez compte')) continue;
      found = true;
      const c = hero();
      applyOps(c, r.ops, { rng: makeRNG(1), label: r.label });
      const p = c.castPenalties![0];
      expect(p.skill).toBe('priere');
      expect(p.mod).toBe(-10);
      expect(p.roundsLeft).toBeGreaterThanOrEqual(1);
      expect(p.roundsLeft).toBeLessThanOrEqual(10);
    }
    expect(found).toBe(true);
  });

  it('« Je trouve inquiétant votre manque de foi » (LDB 40 l.62) : les Points de Péché ENTRENT dans la durée', () => {
    // Contrat du terme `{sinPoints:true}` : la durée est `1d10 + (Points de Péché)`, donc la fenêtre
    // se DÉCALE avec le Péché — [1,10] à 0, [4,13] à 3. Le Péché est substitué à l'EXPANSION de la
    // rangée (`rollMiscast`), pas à l'application : `state/combatFlow.ts` l'expie AVANT `applyOps`,
    // et une résolution paresseuse rendrait `sin − 1`.
    //
    // Le dé NATUREL est injecté (`forcedRoll`) parce que le Péché décale AUSSI le jet lui-même
    // (`roll = base + sinPoints × 10`, `rollMiscast`) : la MÊME rangée 31-35 se tire à 31 sans Péché
    // et à 1 avec 3 Points.
    const dureesPour = (sin: number, deNaturel: number) => {
      const out: number[] = [];
      for (let seed = 0; seed < 60; seed++) {
        const r = rollMiscast('colere', makeRNG(seed), sin, undefined, deNaturel);
        expect(r.rowId, 'la rangée visée n’est pas celle tirée').toBe('colere-je-trouve-inquietant-votre-manque-de-foi');
        const c = hero();
        applyOps(c, r.ops, { rng: makeRNG(seed + 1), label: r.label });
        out.push(c.castPenalties![0].roundsLeft!);
      }
      return out;
    };

    const sansPeche = dureesPour(0, 31);
    const avecTrois = dureesPour(3, 1);
    expect(sansPeche.length).toBe(60);
    expect(sansPeche.filter((d) => d < 1 || d > 10), 'durées hors [1,10] à 0 Point de Péché').toEqual([]);
    expect(avecTrois.filter((d) => d < 4 || d > 13), 'durées hors [4,13] à 3 Points de Péché').toEqual([]);
    // La fenêtre s'est bien DÉPLACÉE : sans le terme de Péché, les deux séries tiendraient dans [1,10].
    expect(Math.max(...avecTrois), 'aucune durée > 10 à 3 Points de Péché : le terme de Péché n’entre pas').toBeGreaterThan(10);
    expect(Math.min(...avecTrois), 'une durée < 4 à 3 Points de Péché : le terme de Péché n’entre pas').toBeGreaterThanOrEqual(4);
  });

  it('« Partagez ma douleur » (LDB 40 l.63) : « 1 + (Points de Péché) Blessures » — le « 1 + » entre AUSSI', () => {
    // Second régime du même terme : `{sum:[1, {sinPoints:true}]}`. Aucun dé dans la formule, donc la
    // perte de Blessures est EXACTE (la mitigation déclarée ignore BE et PA, LDB 40 l.63). Dé naturel
    // injecté pour la même raison qu'au-dessus : le Péché décale le jet de +10 par point.
    const perdues = (sin: number, deNaturel: number) => {
      const r = rollMiscast('colere', makeRNG(7), sin, undefined, deNaturel);
      expect(r.rowId).toBe('colere-partagez-ma-douleur');
      const c = hero();
      const avant = c.wounds.current;
      applyOps(c, r.ops, { rng: makeRNG(8), label: r.label });
      return avant - c.wounds.current;
    };
    expect(perdues(0, 36), 'à 0 Point de Péché : 1 Blessure').toBe(1);
    expect(perdues(3, 6), 'à 3 Points de Péché : 1 + 3 Blessures').toBe(4);
  });
});

// Mitigation des Blessures : `miscast.json` la DÉCLARE par entrée (`ignoreTB`/`ignoreAP`), `expandOp`
// (`miscast.ts`) la recopie sur le `GameOp` `wounds`, `applyOps` la déduit (`ops.ts`). Trois entrées
// aux trois régimes du RAW — le câblage saute si l'un des trois étages perd les champs.
describe('mitigation déclarée des Blessures — donnée → expandOp → applyOps', () => {
  function woundsOf(sev: Parameters<typeof rollMiscast>[0], prefix: string) {
    for (let seed = 0; seed < 600; seed++) {
      const r = rollMiscast(sev, makeRNG(seed), 3);
      if (!r.label.startsWith(prefix)) continue;
      const w = r.ops.find((o) => o.op === 'wounds');
      if (!w) throw new Error(`« ${prefix} » n'émet pas de \`wounds\``);
      return w as Extract<typeof w, { op: 'wounds' }>;
    }
    throw new Error(`entrée « ${prefix} » introuvable`);
  }

  it('« Choc aethyrique » (LDB 46 l.63) : « qui ignorent le Bonus d\'Endurance et les PA »', () => {
    const w = woundsOf('majeure', 'Choc aethyrique');
    expect(w.ignoreTB).toBe(true);
    expect(w.ignoreAP).toBe(true);
  });

  it('« Poupée de chiffon » (LDB 46 l.69) : « qui ignorent les PA » — le Bonus d\'Endurance, lui, s\'applique', () => {
    const w = woundsOf('majeure', 'Poupée de chiffon');
    expect(w.ignoreTB).toBe(false);
    expect(w.ignoreAP).toBe(true);
  });

  it('« Ressentez ma colère » (LDB 40 l.68) : « vous subissez 1d10 + (Points de Péché) Blessures. » — aucune exception énoncée', () => {
    const w = woundsOf('colere', 'Ressentez ma colère');
    expect(w.ignoreTB).toBe(false);
    expect(w.ignoreAP).toBe(false);
  });

  it('applyOps DÉDUIT la mitigation déclarée : BE 4 + PA 3 absorbent « Ressentez ma colère », pas « Choc aethyrique »', () => {
    const mitige = hero({ armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } });
    applyOps(mitige, [{ ...woundsOf('colere', 'Ressentez ma colère'), amount: 6 }], { rng: makeRNG(1) });
    expect(mitige.wounds.current).toBe(10); // 6 − 4 (BE) − 3 (PA) ≤ 0

    const nu = hero({ armour: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 } });
    applyOps(nu, [{ ...woundsOf('majeure', 'Choc aethyrique'), amount: 6 }], { rng: makeRNG(1) });
    expect(nu.wounds.current).toBe(4); // 6 pleines
  });
});

describe('81-87 Purifier la chair — Inconscient tant que la Colère dure (LDB 40 l.75 + LDB 16 l.117)', () => {
  /** Les ops du palier `onFailHard` (« −4 DR ou moins ») de la rangée, telles que la donnée les déplie. */
  function opsDuPalier(): ReturnType<typeof rollMiscast>['ops'] {
    for (let seed = 0; seed < 600; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 0);
      if (!r.label.startsWith('Purifier la chair')) continue;
      const node: Flow = r.testFlow!;
      if (node.kind !== 'test' || node.fail.kind !== 'seq') throw new Error('structure de la rangée inattendue');
      const hard = node.fail.steps[1];
      if (hard.kind !== 'if' || hard.then.kind !== 'do' || hard.then.effect.type !== 'ops') throw new Error('palier onFailHard introuvable');
      return hard.then.effect.ops;
    }
    throw new Error('rangée « Purifier la chair » introuvable');
  }

  /** Pose le palier sur un héros à PB > 0, RNG SEMÉ (`battleRng` sème à l'horloge — `test-setup.ts`).
   *  `label` = celui que le dénouement passe en `OpsCtx` (`m.label` = libellé de la RANGÉE,
   *  `state/combatFlow.ts` ligne `label: m.label` de `finishMiscast`). */
  function palier(seed: number) {
    const c = hero();
    const log = applyOps(c, opsDuPalier(), { rng: makeRNG(seed), label: 'Purifier la chair' });
    const cause = (c.activeEffects ?? []).find((e) => e.opsPerRound)!;
    return { c, cause, log: log.join('\n') };
  }

  it('l’État est GAGNÉ, et la CAUSE est un effet actif de N Rounds portant le nom de la rangée', () => {
    const { c, cause, log } = palier(3);
    const n = cause.duration.scale === 'rounds' ? cause.duration.left : 0;
    expect(log, 'la POSE dit la RE-PRISE conditionnelle, pas « un État par Round »')
      .toBe(`Cobaye reçoit 1 État Inconscient.\nCobaye regagnera l'État Inconscient à chaque fin de Round, tant que dure Purifier la chair (${n} Rounds).`);
    expect(c.wounds.current).toBeGreaterThan(0);
    expect(c.conditions.find((x) => x.id === 'inconscient')?.value).toBe(1);
    expect(c.conditions.find((x) => x.id === 'inconscient')?.roundsLeft, 'l’État lui-même n’expire pas (LDB 16 l.117)').toBeUndefined();
    expect(cause.label, 'ce que le joueur lit dans ses effets actifs').toBe('Purifier la chair');
    expect(cause.duration.scale).toBe('rounds');
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(10);
  });

  it('retiré (Détermination) alors que la cause court : REGAGNÉ à la fin du Round, 1 pion, cause NOMMÉE (LDB 16 l.117)', () => {
    const { c } = palier(3);
    removeCondition(c, 'inconscient'); // chemin `battleSpendResolve` : le retrait A LIEU
    expect(hasCondition(c, 'inconscient')).toBe(false);
    const log = endOfRound(c, makeRNG(7));
    expect(c.conditions.find((x) => x.id === 'inconscient')?.value, 'un seul pion — l’État ne se cumule pas (LDB 16 l.115)').toBe(1);
    expect(log, 'la RE-POSE nomme sa cause').toEqual(['Cobaye regagne 1 État Inconscient : Purifier la chair le tient toujours.']);
  });

  it('la cause ÉCOULÉE (N fins de Round), un retrait n’est plus suivi d’une re-pose', () => {
    const { c, cause } = palier(3);
    const n = cause.duration.scale === 'rounds' ? cause.duration.left : 0;
    for (let i = 0; i < n; i++) endOfRound(c, makeRNG(7 + i));
    expect((c.activeEffects ?? []).some((e) => e.opsPerRound), 'la cause a expiré').toBe(false);
    expect(hasCondition(c, 'inconscient'), 'l’État survit à sa cause (règles normales)').toBe(true);
    removeCondition(c, 'inconscient');
    endOfRound(c, makeRNG(99));
    expect(hasCondition(c, 'inconscient')).toBe(false);
  });

  /** Le journal suit le DRAPEAU DE REJEU (`OpsCtx.rejeuRecurrent`, posé par `endOfRound` seul), jamais
   *  la FORME de l'op : 13 ops authorées se gatent déjà sur l'État qu'elles posent (Filet
   *  `maneuvers.json`, Sommeil/Brisé `spells.json`, qualités, traits) et sont dispatchées AVEC un label. */
  it('une op gatée sur son propre État, posée HORS rejeu, annonce une POSE (Filet) — et une RE-POSE au rejeu', () => {
    const c = hero();
    const filet: GameOp = { op: 'condition', id: 'empetre', value: 1, unlessCondition: 'empetre' };
    expect(applyOps(c, [filet], { label: 'Filet', rng: makeRNG(1) }), 'PREMIÈRE pose : le gate n’a rien retenu')
      .toEqual(['Cobaye reçoit 1 État Empêtré.']);
    removeCondition(c, 'empetre');
    c.activeEffects = [{ label: 'Filet', bonus: 0, duration: { scale: 'rounds', left: 2 }, opsPerRound: [filet] }];
    expect(endOfRound(c, makeRNG(1)), 'REJEU de fin de Round : la cause est NOMMÉE')
      .toContain('Cobaye regagne 1 État Empêtré : Filet le tient toujours.');
  });

  /** Le drapeau porte sur les ops LITTÉRALES re-jouées, pas sur ce qu'un DÉ atteint sous elles : une
   *  liste `opsPerRound` qui roule une table pose, à chaque fin de Round, une rangée que le Round
   *  précédent n'avait pas posée — première pose, journal de POSE (`LDB 16 l.117`). */
  it('une op gatée atteinte par un dé SOUS le rejeu annonce une POSE, jamais « le tient toujours »', () => {
    const c = hero();
    const roulee: GameOp = {
      op: 'rollTable', die: 'd10',
      rows: [{ min: 1, max: 10, ops: [{ op: 'condition', id: 'aveugle', value: 1, unlessCondition: 'aveugle' }] }],
    };
    c.activeEffects = [{ label: 'Nuée', bonus: 0, duration: { scale: 'rounds', left: 2 }, opsPerRound: [roulee] }];
    expect(endOfRound(c, makeRNG(4))).toEqual(['Cobaye reçoit 1 État Aveuglé.']);
  });

  it('ce n’est PAS un sommeil magique (`isMagicallyAsleep` ne s’en empare pas)', () => {
    const { c } = palier(3);
    expect(isMagicallyAsleep(c)).toBe(false);
  });

  it('la récurrence se compte en ROUNDS : `perRound` + durée d’horloge est REFUSÉ nommément', () => {
    expect(() => applyOps(hero(), [{ op: 'condition', id: 'inconscient', perRound: true, durationMinutes: 30 }], { rng: makeRNG(1), now: 0 }))
      .toThrow(/« perRound » ne se combine qu'avec « durationRounds »/);
  });

  it('HORS COMBAT : l’entretien fait expirer la cause (elle ne gèle pas à PB > 0)', () => {
    const { c, cause } = palier(3);
    const n = cause.duration.scale === 'rounds' ? cause.duration.left : 0;
    outOfCombatUpkeep([c], n + 2, makeRNG(5));
    expect((c.activeEffects ?? []).some((e) => e.opsPerRound)).toBe(false);
    expect(hasCondition(c, 'inconscient')).toBe(true);
  });
});

describe('castPenalty.days — durée en jours FORMULAIRE (`GameOp[\'castPenalty\'].days: Formula`)', () => {
  it('la donnée réelle à `days` nu traverse la résolution formulaire : « Pensez à vos actes » = 7 jours', () => {
    let ops: ReturnType<typeof rollMiscast>['ops'] | null = null;
    for (let seed = 0; seed < 600 && !ops; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 0);
      if (r.label.startsWith('Pensez à vos actes')) ops = r.ops;
    }
    expect(ops, 'rangée « Pensez à vos actes » introuvable').toBeTruthy();
    const c = hero();
    applyOps(c, ops!, { label: 'Pensez à vos actes', now: 0, rng: makeRNG(1) });
    expect(c.castPenalties![0].untilTime).toBe(7 * 24 * 60);
  });

  it('une formule à dés en jours est résolue sous RNG semé : untilTime = (1d10 + 3) × 24 × 60', () => {
    const attendu = makeRNG(11).int(1, 10); // même graine, même premier tirage que l'op ci-dessous
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', skill: { id: 'priere' }, mod: -10, days: { sum: [{ dice: { n: 1, sides: 10 } }, 3] } }], { label: 'Contrecoup à durée en jours', now: 0, rng: makeRNG(11) });
    expect(c.castPenalties![0].untilTime).toBe((attendu + 3) * 24 * 60);
  });
});
