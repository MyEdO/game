/**
 * #1657 B2b — le cycle quotidien des maladies porte son JET dans le nœud `test` du Flow.
 *
 * Contrat POSITIF, mesuré sur la donnée RÉELLE (`symptoms.json`, `maladies.json`) :
 *  1. le nœud est LU par la grammaire partagée — `noeudTest(flowSchema, { difficulteRequise: true })`
 *     accepte les 4 nœuds de la base, et REFUSE nominativement un nœud sans `difficulty` ;
 *  2. le porteur ne garde que ce qu'il DÉCRIT (QUI/QUAND/CE QU'ON DEVIENT) : `symptomId`,
 *     `afterDays`/`once`, `difficultyBySeverity` ; il ne redit ni le jet ni la conséquence ;
 *  3. le LECTEUR (`symptomOnTick`, `tickDisease`) ne tire sa Difficulté et ses ops QUE du nœud —
 *     vérifié étape par étape sur chaque maladie porteuse (chemin DIFFÉRÉ), la COUVERTURE des
 *     porteurs et des sévérités étant elle-même assertée depuis la donnée ;
 *  4. la branche `success` est VIDE partout : le canal `diseaseTick` (`state/restFlow.ts`) n'applique
 *     que l'échec, une branche de réussite peuplée serait ignorée en silence.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { Combatant, type UpkeepDeferTest } from './types';
import { makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { contractDisease, tickDisease, symptomOnTick, diseaseDefs } from './disease';
import { spellOps, walkFlow } from './flowCore';
import { flowSchema, noeudTest } from '../data/schemas/grammaire/mecanique';
import { symptoms } from '../data';
import * as defSymptoms from '../data/schemas/defs/symptoms';
import * as defMaladies from '../data/schemas/defs/maladies';

const DATA = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
/** Le JSON d'un dataset, LU une fois par run : les sondes le relisent à chaque cas, et la boucle de
 *  vérification par étape l'interroge des milliers de fois. */
const LUS = new Map<string, Record<string, unknown>[]>();
const lire = (f: string): Record<string, unknown>[] => {
  const memo = LUS.get(f);
  if (memo) return memo;
  const lu = JSON.parse(readFileSync(join(DATA, f), 'utf8')) as Record<string, unknown>[];
  LUS.set(f, lu);
  return lu;
};

/** LE schéma du nœud, tel que les deux defs le composent (`defs/symptoms.ts`, `defs/maladies.ts`). */
const noeudDuCycle = noeudTest(flowSchema, { difficulteRequise: true, echecSeulServi: true });

/** Les porteurs de cycle, LUS dans la donnée — jamais une liste d'ids écrite ici. */
const cycles = () => lire('symptoms.json').map((s) => ({ id: s.id as string, tick: s.onTick as Record<string, unknown> | undefined })).filter((x) => x.tick);
const quotidiens = () => lire('maladies.json').map((m) => ({ id: m.id as string, daily: m.dailyTest as Record<string, unknown> | undefined })).filter((x) => x.daily);

const sick = (over: Partial<Combatant> = {}): Combatant =>
  ({ label: 'Malade', diseases: [], conditions: [], skills: [], traits: [], talents: [], items: [], wounds: { current: 12, max: 12 }, ...over }) as unknown as Combatant;

describe('cycle de maladie — le JET vit dans le nœud `test` du Flow (#1657 B2b)', () => {
  it('les 4 porteurs sont LUS par la grammaire partagée, et chacun dit ce qu’il est', () => {
    const parJet = cycles().filter((c) => c.tick!.test);
    const parEffetCertain = cycles().filter((c) => c.tick!.ops);
    expect(cycles().length, 'la sonde mesure quelque chose').toBe(4);
    expect(parJet.map((c) => c.id)).toEqual(['blesse', 'toxine', 'vers-de-carie']);
    // MSRC 16 l.142 : l'issue de l'éclatement est INVARIANTE — pas une épreuve, donc pas de nœud.
    expect(parEffetCertain.map((c) => c.id)).toEqual(['vers-du-reik']);
    expect(quotidiens().map((m) => m.id)).toEqual(['pneumonie']);

    for (const { id, tick } of parJet) {
      expect(noeudDuCycle.safeParse(tick!.test).success, `symptoms/${id} : nœud refusé par la grammaire`).toBe(true);
    }
    for (const { id, daily } of quotidiens()) {
      expect(noeudDuCycle.safeParse(daily!.test).success, `maladies/${id} : nœud refusé par la grammaire`).toBe(true);
      expect(daily!.symptomId, `maladies/${id} : le symptôme MIS EN JEU reste sur le porteur`).toBe('fievre');
    }
  });

  it('MORSURE : un cycle dont le nœud perd sa `difficulty` est REFUSÉ nommément PAR LE DOCUMENT', () => {
    // Le refus doit venir des DEFS (`noeudTest(…, { difficulteRequise: true })`), pas d'un schéma
    // reconstruit ici : c'est l'ADOPTION du resserrement qui se vérifie, pas la grammaire seule.
    for (const [nom, sch, mute] of [
      ['symptoms.json', defSymptoms.schema, (base: Record<string, unknown>[]) => base.map((s) => {
        if (s.id !== 'blesse') return s;
        const tick = structuredClone(s.onTick) as { test: { test: Record<string, unknown> } };
        delete tick.test.test.difficulty;
        return { ...s, onTick: tick };
      })],
      ['maladies.json', defMaladies.schema, (base: Record<string, unknown>[]) => base.map((m) => {
        if (!m.dailyTest) return m;
        const daily = structuredClone(m.dailyTest) as { test: { test: Record<string, unknown> } };
        delete daily.test.test.difficulty;
        return { ...m, dailyTest: daily };
      })],
    ] as const) {
      const base = lire(nom);
      expect(sch.safeParse(base).success, `${nom} : la donnée réelle doit passer`).toBe(true);
      const refus = sch.safeParse(mute(base));
      expect(refus.success, `${nom} : nœud sans Difficulté accepté`).toBe(false);
      expect(refus.error!.issues.map((i) => i.message).join(' '), nom).toContain('n’est pas une épreuve');
      expect(refus.error!.issues.some((i) => i.path.join('.').endsWith('test.difficulty')), `${nom} : le refus ne NOMME pas la clé`).toBe(true);
    }
  });

  it('MORSURE : un cycle qui porte À LA FOIS une épreuve et des ops certaines est REFUSÉ par le document', () => {
    // `doc.schema` est le schéma du DATASET (la liste) : on lui donne la liste réelle, un cycle muté.
    const base = lire('symptoms.json');
    const avec = (onTick: unknown) => base.map((s) => (s.id === 'blesse' ? { ...s, onTick } : s));
    const blesse = base.find((s) => s.id === 'blesse')!;
    expect(defSymptoms.schema.safeParse(base).success, 'la donnée réelle doit passer').toBe(true);
    const refuse = (onTick: unknown, pourquoi: string) =>
      expect(defSymptoms.schema.safeParse(avec(onTick)).success, pourquoi).toBe(false);
    refuse({ ...(blesse.onTick as object), ops: [{ op: 'kill' }] }, '`test` ET `ops` : le cycle ne dit plus ce qu’il est');
    refuse({ afterDays: 3 }, 'ni `test` ni `ops` : un cycle sans conséquence');
    refuse({ ops: [{ op: 'kill' }], difficultyBySeverity: { grave: 'facile' } }, '`difficultyBySeverity` sans jet à indexer');
  });

  it('le PORTEUR ne garde que ce qu’il décrit : cadence, sévérité, symptôme nommé — jamais le jet', () => {
    const clesDeCycle = new Set(['test', 'ops', 'difficultyBySeverity', 'afterDays', 'once']);
    for (const { id, tick } of cycles()) {
      expect(Object.keys(tick!).filter((k) => !clesDeCycle.has(k)), `symptoms/${id}`).toEqual([]);
      expect('difficulty' in tick!, `symptoms/${id} : la Difficulté est REDITE hors du nœud`).toBe(false);
      expect('onFail' in tick!, `symptoms/${id} : la conséquence est REDITE hors du nœud`).toBe(false);
      expect(Boolean(tick!.test) !== Boolean(tick!.ops), `symptoms/${id} : épreuve ET effet certain, ou ni l'un ni l'autre`).toBe(true);
    }
    for (const { id, daily } of quotidiens()) {
      expect(Object.keys(daily!).sort(), `maladies/${id}`).toEqual(['symptomId', 'test']);
    }
    // Ordonnancement (MSRC 16 l.90 / l.142) : il cadence le cycle, il ne se joue pas.
    expect(cycles().filter((c) => c.tick!.afterDays !== undefined).map((c) => c.id)).toEqual(['vers-de-carie', 'vers-du-reik']);
    expect(cycles().filter((c) => c.tick!.once !== undefined).map((c) => c.id)).toEqual(['vers-du-reik']);
    // LDB 20 l.215 : la sévérité de l'INSTANCE indexe la Difficulté du nœud — elle reste au porteur.
    expect(cycles().filter((c) => c.tick!.difficultyBySeverity !== undefined).map((c) => c.id)).toEqual(['toxine']);
  });

  it('MORSURE : le porteur REFUSE une branche `success` peuplée et une branche `fail` à embranchement', () => {
    // AFFORDANCE MORTE, verrouillée PAR CONSTRUCTION (`noeudTest`, option `echecSeulServi`) : le canal
    // différé (`registerNightBandApplier('diseaseTick')`, `state/restFlow.ts`) rend une liste VIDE sur
    // une réussite, et `spellOps` extrait les ops À PLAT — un `if` sous `fail` promettrait les ops des
    // deux côtés. Les deux formes seraient authorables sans effet, donc menteuses.
    const base = lire('symptoms.json');
    const avecNoeud = (mute: (n: Record<string, unknown>) => void) => base.map((s) => {
      if (s.id !== 'blesse') return s;
      const tick = structuredClone(s.onTick) as Record<string, unknown>;
      mute(tick.test as Record<string, unknown>);
      return { ...s, onTick: tick };
    });
    const refus = (mute: (n: Record<string, unknown>) => void, chemin: string, extrait: string) => {
      const r = defSymptoms.schema.safeParse(avecNoeud(mute));
      expect(r.success, `${chemin} : accepté`).toBe(false);
      const issue = r.error!.issues.find((i) => i.path.join('.').endsWith(chemin));
      expect(issue, `${chemin} : le refus ne NOMME pas la branche`).toBeTruthy();
      expect(issue!.message).toContain(extrait);
    };
    refus((n) => { n.success = { kind: 'do', effect: { type: 'ops', ops: [{ op: 'kill' }], on: 'target' } }; },
      'onTick.test.success', 'ne serait jamais jouée');
    refus((n) => { n.fail = { kind: 'if', cond: { kind: 'flag', expr: 'x' }, then: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'kill' }], on: 'target' } } }; },
      'onTick.test.fail', 'EMBRANCHEMENT');
    // Le MÊME nœud passe le contrat NON resserré : c'est bien `echecSeulServi` qui mord.
    const nu = structuredClone((base.find((s) => s.id === 'blesse')!.onTick as { test: unknown }).test) as Record<string, unknown>;
    nu.success = { kind: 'do', effect: { type: 'ops', ops: [{ op: 'kill' }], on: 'target' } };
    expect(noeudTest(flowSchema, { difficulteRequise: true }).safeParse(nu).success).toBe(true);
    expect(noeudDuCycle.safeParse(nu).success).toBe(false);
  });
  it('la branche `success` de chaque nœud est VIDE : le canal différé n’applique que l’échec', () => {
    const peuplees: string[] = [];
    const noeuds = [
      ...cycles().filter((c) => c.tick!.test).map((c) => [`symptoms/${c.id}`, c.tick!.test] as const),
      ...quotidiens().map((m) => [`maladies/${m.id}`, m.daily!.test] as const),
    ];
    for (const [nom, node] of noeuds) {
      const n = node as z.infer<typeof noeudDuCycle>;
      let blocs = 0;
      walkFlow(n.success, () => { blocs++; });
      if (blocs !== 1 || spellOps(n.success, 'target').length) peuplees.push(nom);
    }
    expect(peuplees, 'branche `success` peuplée : `restFlow` (applier `diseaseTick`) l’ignorerait en silence').toEqual([]);
  });

  it('`symptomOnTick` ne tire sa Difficulté et ses ops QUE du nœud (sévérité comprise)', () => {
    for (const { id, tick } of cycles()) {
      const inst = { symptomId: id };
      const lu = symptomOnTick(inst)!;
      if (tick!.ops) {
        expect(lu.difficulty, `symptoms/${id} : effet certain, aucune Difficulté`).toBeUndefined();
        expect(lu.onFail).toEqual(tick!.ops);
        continue;
      }
      const node = tick!.test as z.infer<typeof noeudDuCycle>;
      expect(lu.difficulty, `symptoms/${id}`).toBe(node.test.difficulty);
      expect(lu.onFail, `symptoms/${id}`).toEqual(spellOps(node.fail, 'target'));
      const bySev = tick!.difficultyBySeverity as Record<string, string> | undefined;
      for (const sev of ['moderee', 'grave'] as const) {
        expect(symptomOnTick({ symptomId: id, severity: sev })!.difficulty, `symptoms/${id}/${sev}`).toBe(bySev?.[sev] ?? node.test.difficulty);
      }
    }
    // `symptoms` (index chargé) et le JSON lu à froid décrivent le MÊME cycle : aucun pré-traitement.
    expect(symptoms.filter((s) => s.onTick).map((s) => s.id)).toEqual(cycles().map((c) => c.id));
  });

  /**
   * Les GRAINES ne sont qu'un moyen de faire APPARAÎTRE les symptômes et leurs sévérités ; ce que le
   * cas prouve est la COUVERTURE, et elle est désormais ASSERTÉE à partir de la DONNÉE (tout porteur
   * dont le cycle est une épreuve doit avoir produit une étape ; tout symptôme à
   * `difficultyBySeverity` doit avoir été vu AVEC une sévérité). Mesuré le 2026-09-11 : les cinq
   * couples (porteur × symptôme × sévérité) sont tous atteints dès la PREMIÈRE graine, et les 39
   * suivantes n'en ajoutaient aucun — 2 760 étapes vérifiées pour 5 sujets. Dix graines gardent la
   * marge d'une donnée qui rendrait un symptôme plus rare ; si elle ne suffisait plus, c'est la
   * couverture qui rougit, jamais un compte d'étapes qui s'amenuise en silence.
   */
  const GRAINES = 10;

  it('chaque porteur, sur dix graines : CHAQUE étape différée porte la Difficulté et les ops de SON nœud', () => {
    const porteurs = ['infection-mineure', 'infection-du-sang', 'peste-noire', 'vers-de-carie', 'vers-du-reik', 'pneumonie'];
    /** Ce que la DONNÉE déclare pour un symptôme (ou pour la maladie), recalculé depuis le nœud. */
    const attendu = (diseaseName: string, symptomId: string) => {
      const daily = diseaseDefs()[diseaseName]?.dailyTest;
      if (daily && daily.symptomId === symptomId) return { difficulty: daily.test.test.difficulty, onFail: spellOps(daily.test.fail, 'target') };
      const tick = cycles().find((c) => c.id === symptomId)?.tick;
      const node = tick?.test as z.infer<typeof noeudDuCycle> | undefined;
      return node ? { difficulty: node.test.difficulty, onFail: spellOps(node.fail, 'target') } : undefined;
    };
    let vus = 0;
    const couverture = new Set<string>();
    const menteuses: string[] = [];
    for (const maladie of porteurs) {
      for (let seed = 1; seed <= GRAINES; seed++) {
        const rng = makeRNG(seed);
        const c = sick({ diseases: [contractDisease(maladie, rng, { incubation: 0, duration: 30 })!] });
        const etapes: { kind: string; difficulty: string; meta?: Record<string, unknown> }[] = [];
        const defer: UpkeepDeferTest = (spec) => { etapes.push(spec as never); };
        for (let j = 0; j < 15; j++) tickDisease(c, MINUTES_PER_DAY, rng, defer, 4);
        for (const e of etapes) {
          if (e.kind !== 'diseaseTick') continue; // gangrène/persistant : machinerie stateful, hors nœud
          vus++;
          const att = attendu(String(e.meta!.diseaseName), String(e.meta!.symptomId));
          const sev = c.diseases![0]?.symptoms.find((s) => s.symptomId === e.meta!.symptomId)?.severity;
          const bySev = cycles().find((x) => x.id === e.meta!.symptomId)?.tick?.difficultyBySeverity as Record<string, string> | undefined;
          const difficulty = (sev && bySev?.[sev]) || att!.difficulty;
          couverture.add(`${maladie} | ${String(e.meta!.symptomId)} | ${sev ?? '-'}`);
          if (e.difficulty !== difficulty || JSON.stringify(e.meta!.opsEchec) !== JSON.stringify(att!.onFail)) {
            menteuses.push(`${maladie}/seed ${seed}/${String(e.meta!.symptomId)} : ${e.difficulty} vs ${difficulty}`);
          }
        }
      }
    }
    expect(vus, 'aucune étape mesurée : la sonde a glissé').toBeGreaterThan(0);
    // COUVERTURE, dérivée de la donnée : un porteur MUET n'est légitime que si son cycle est un effet
    // CERTAIN (MSRC 16 l.142 — `vers-du-reik` éclate sans épreuve, donc sans étape différée).
    const porteursVus = new Set([...couverture].map((c) => c.split(' | ')[0]));
    const sansEpreuve = cycles().filter((c) => c.tick!.ops).map((c) => c.id);
    expect(
      porteurs.filter((p) => !porteursVus.has(p)),
      'un porteur à ÉPREUVE n’a produit AUCUNE étape différée : la sonde ne le mesure plus',
    ).toEqual(porteurs.filter((p) => sansEpreuve.includes(p)));
    // Et le chemin `difficultyBySeverity` est bien EMPRUNTÉ : sinon la Difficulté indexée par la
    // sévérité ne serait vérifiée par aucune étape de cette boucle.
    const vusAvecSeverite = new Set([...couverture].filter((c) => !c.endsWith('| -')).map((c) => c.split(' | ')[1]));
    expect(
      cycles().filter((c) => c.tick!.difficultyBySeverity).map((c) => c.id).filter((id) => !vusAvecSeverite.has(id)),
      'aucune étape vue AVEC une sévérité pour ce symptôme : le chemin indexé n’est plus prouvé',
    ).toEqual([]);
    expect([...new Set(menteuses)].slice(0, 5), 'une étape dont la Difficulté/les ops ne viennent pas du nœud').toEqual([]);
  });
});
