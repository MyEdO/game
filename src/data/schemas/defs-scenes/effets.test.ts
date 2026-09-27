/**
 * Contrat des SCHÉMAS D'EFFET de scène (#1466 T3-b) — trois volets qui se répondent :
 *
 *  1. LE CORPUS RÉEL. Tout objet à clé `type` posé dans un contexte d'effet des DEUX racines
 *     authorées (`src/scenes`, `src/data`) parse contre `effectSchema`. Même patron de scan que
 *     `compare-reel.test.ts` (T3-a) : scan confronté à une SECONDE lecture indépendante, zéro KO. Un
 *     Effect réel qui ne parse pas accuse le schéma — sauf invalide manifeste, qui se traite en
 *     donnée et se liste au ticket.
 *  2. L'ARBITRAGE `setTime`. Les deux variantes de même discriminant sont FUSIONNÉES en une entrée
 *     `{phase?, hour?, minute?}` gardée par un XOR STRICT — aucun loosening : ce test tient les
 *     quatre coins (phase seule, heure seule/avec minute, les deux, aucun).
 *  3. L'ÉQUIVALENCE DE TYPE. `Effect` est désormais COMPOSÉ des infers ; rien n'empêche un infer de
 *     retomber à `any` (auquel cas tout compilerait, muet). Les contrats ci-dessous sont gatés par
 *     `npm run typecheck` — jamais par `vitest --typecheck`, FAUX VERT mesuré sur `expectTypeOf`.
 *  4. LA LIAISON AU MOTEUR. Comparer un infer à `Extract<Effect, …>` ne prouve RIEN pour les champs
 *     descendus au moteur : `Effect` est fait de ces mêmes infers, la comparaison est tautologique.
 *     Ce qui se vérifie, c'est l'identité avec le type nommé côté code (`PursuitFoeRef`, `MassBattleSpec`,
 *     `FavorLevel`, `CrewHire`) — identité BIDIRECTIONNELLE, donc une dérive d'un côté comme de
 *     l'autre rend `true` inassignable (TS2322).
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../../../scripts/guards/lib/lister.mjs';
import { listerProjetsLivres, PROJETS_LIVRES } from '../../../../scripts/guards/lib/projetsLivres.mjs';
import type { z } from 'zod';
import {
  effectSchema, sceneFlowSchema, setFlagSchema, setObjectiveSchema, delayedEffectSchema,
  petitePriereSchema, setTimeSchema, pursuitFoeSchema, massBattleSpecSchema, favorLevelSchema,
  crewHireSchema,
} from './effets';
import type { Effect, DelayedEffect, PetitePriere } from '../../../state/scene';
import type { Flow } from '../../../engine/flowCore';
import type { PursuitFoeRef } from '../../../state/pursuitFlow';
import type { MassBattleSpec } from '../../../engine/massBattle';
import type { FavorLevel } from '../../../engine/favor';
import type { CrewHire } from '../../../engine/crewMorale';

const ROOT = join(__dirname, '../../../..');

/** Clés dont la VALEUR est un effet (ou en contient) — établies par mesure sur les deux racines. */
const CONTEXTES_D_EFFET = ['effect', 'effects', 'onEnter', 'onExit', 'reward', 'interact'];

/** Les documents de chaque racine authorée, relatifs à elle : les projets livrés, et tous les `.json`
 *  de `src/data`. */
const DOCUMENTS_DE_RACINE: Record<string, () => string[]> = {
  [PROJETS_LIVRES.dossier]: () => listerProjetsLivres(ROOT),
  'src/data': () => listerArbre(join(ROOT, 'src/data'), { filtre: (rel) => rel.endsWith('.json') }),
};

/** Les deux racines authorées, racine par racine — le scan doit voir chacune d'elles. */
const RACINES = Object.keys(DOCUMENTS_DE_RACINE);

/** Les documents des deux racines authorées, en chemins absolus. */
const fichiersJson = (): string[] =>
  RACINES.flatMap((racine) => DOCUMENTS_DE_RACINE[racine]().map((rel) => join(ROOT, racine, rel)));

/** Tous les objets à clé `type` posés SOUS une clé de contexte d'effet, dans les deux racines. */
function effetsPoses(): { chemin: string; noeud: unknown }[] {
  const out: { chemin: string; noeud: unknown }[] = [];
  for (const f of fichiersJson()) {
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
    const walk = (n: unknown, chemin: string, sousEffet: boolean) => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${chemin}[${i}]`, sousEffet));
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      if (sousEffet && typeof o.type === 'string') out.push({ chemin: `${rel}:${chemin}`, noeud: o });
      for (const [k, v] of Object.entries(o)) walk(v, `${chemin}.${k}`, CONTEXTES_D_EFFET.includes(k));
    };
    walk(JSON.parse(readFileSync(f, 'utf8')), '', false);
  }
  return out;
}

/** Un nœud est SOUS un contexte d'effet si son chemin s'y termine, à travers les seuls indices de
 *  tableau — filtre par CHEMIN, là où `effetsPoses` propage un drapeau au fil de la descente. La
 *  liste est RÉÉCRITE ici, jamais partagée : une clé oubliée d'un côté fait diverger les ensembles. */
const SOUS_CONTEXTE = /\.(?:effect|effects|onEnter|onExit|reward|interact)(?:\[\d+\])*$/;

/** SECONDE lecture du même corpus, par une autre route : elle doit voir le MÊME ensemble. */
function cheminsParFiltreDeChemin(): string[] {
  const out: string[] = [];
  for (const f of fichiersJson()) {
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
    const walk = (n: unknown, chemin: string) => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${chemin}[${i}]`));
      if (!n || typeof n !== 'object') return;
      const o = n as Record<string, unknown>;
      if (typeof o.type === 'string' && SOUS_CONTEXTE.test(chemin)) out.push(`${rel}:${chemin}`);
      for (const [k, v] of Object.entries(o)) walk(v, `${chemin}.${k}`);
    };
    walk(JSON.parse(readFileSync(f, 'utf8')), '');
  }
  return out;
}

describe('effectSchema — le corpus RÉELLEMENT posé dans les deux racines authorées', () => {
  const poses = effetsPoses();

  it('le scan VOIT le corpus qu’il prétend mesurer (sinon un vert vide passerait)', () => {
    expect(poses.length).toBeGreaterThan(0);
    for (const racine of RACINES) {
      const vus = poses.filter((p) => p.chemin.startsWith(`${racine}/`));
      expect(vus.length, `aucun effet lu sous ${racine}/ : le scan y est aveugle`).toBeGreaterThan(0);
    }
    // Les deux routes de lecture voient le MÊME ensemble : un chemin vu par une seule accuse le scan.
    const manques = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
    const parDrapeau = poses.map((p) => p.chemin).sort();
    const parChemin = cheminsParFiltreDeChemin().sort();
    expect(
      [manques(parChemin, parDrapeau), manques(parDrapeau, parChemin)],
      'les deux lectures du corpus divergent (vu par le filtre de chemin seul, puis par le drapeau seul)',
    ).toEqual([[], []]);
    // Chaque `type` posé est un DISCRIMINANT DÉCLARÉ par l'union : un discriminant inconnu fait
    // porter à `effectSchema` une issue sur `type` lui-même, là où un champ manquant la porte ailleurs.
    const parType = new Set(poses.map((p) => (p.noeud as { type: string }).type));
    const inconnus = [...parType].filter((t) => {
      const r = effectSchema.safeParse({ type: t });
      return !r.success && r.error.issues.some((i) => i.path.length === 1 && i.path[0] === 'type');
    });
    expect(inconnus, 'type(s) posé(s) qu’aucune variante de l’union ne discrimine').toEqual([]);
    expect(parType.has('ops')).toBe(true);
    expect(parType.has('startCombat')).toBe(true);
  });

  it('CHAQUE effet posé parse contre `effectSchema` — le refus NOMME son chemin', () => {
    const ko = poses
      .filter((p) => !effectSchema.safeParse(p.noeud).success)
      .map((p) => {
        const r = effectSchema.safeParse(p.noeud);
        return `${p.chemin} — ${r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ')}`;
      });
    expect(ko, `Effect(s) posé(s) que le schéma refuse :\n${ko.join('\n')}`).toEqual([]);
  });
});

describe('setTime — UNE entrée, XOR STRICT `phase` ⊕ `hour` (`minute` seulement avec `hour`)', () => {
  const parse = (v: unknown) => effectSchema.safeParse(v);

  it('`phase` seule : VERT', () => {
    expect(parse({ type: 'setTime', phase: 'nuit' }).success).toBe(true);
  });

  it('`hour` (+`minute`) : VERT', () => {
    expect(parse({ type: 'setTime', hour: 7 }).success).toBe(true);
    expect(parse({ type: 'setTime', hour: 7, minute: 30 }).success).toBe(true);
  });

  it('`phase` ET `hour` : ROUGE, et le refus NOMME la règle', () => {
    const r = parse({ type: 'setTime', phase: 'nuit', hour: 7 });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0].message).toContain("exactement l'un de `phase` ou `hour`");
  });

  it('ni `phase` ni `hour` : ROUGE (une horloge qu’on ne règle sur rien n’est pas un effet)', () => {
    expect(parse({ type: 'setTime' }).success).toBe(false);
  });

  it('`minute` sans `hour` : ROUGE NOMMÉ (elle n’a de sens qu’avec une heure)', () => {
    const r = setTimeSchema.safeParse({ type: 'setTime', phase: 'nuit', minute: 30 });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toContain('`minute` ne se pose qu\'avec `hour`');
  });

  it('une `phase` hors des sept clés du jour : ROUGE', () => {
    expect(parse({ type: 'setTime', phase: 'brunante' }).success).toBe(false);
  });
});

describe('sceneFlowSchema — le MÊME arbre que la grammaire, feuille `do` = `Effect` de scène', () => {
  it('accepte une feuille `do` de SCÈNE (ce que le `flowSchema` de la grammaire refuse)', () => {
    expect(sceneFlowSchema.safeParse({ kind: 'do', effect: { type: 'startCombat', encounter: 'enc-1' } }).success).toBe(true);
  });

  it('accepte la feuille MÉCANIQUE `type:"ops"` — l’union `Effect` la contient', () => {
    expect(sceneFlowSchema.safeParse({ kind: 'do', effect: { type: 'ops', ops: [{ op: 'heal', amount: 1 }] } }).success).toBe(true);
  });

  it('une feuille `do` INCONNUE est refusée, et le refus SITUE la faute', () => {
    const r = sceneFlowSchema.safeParse({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'faisMoiUnCafe' } }] });
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues[0].path.join('.')).toBe('steps.0.effect.type');
  });

  it('la RÉCURSION tient dans les deux sens (un Flow sous un Effect sous un Flow)', () => {
    expect(
      sceneFlowSchema.safeParse({
        kind: 'do',
        effect: {
          type: 'delayedEffect',
          afterMinutes: 60,
          flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'journal', desc: 'boum' } }] },
        },
      }).success,
    ).toBe(true);
  });
});

// ── Volet 3 : les contrats de TYPE (gatés par `npm run typecheck`) ───────────────────────────────

describe('`Effect` EST composé des infers (aucun n’est retombé à `any`)', () => {
  it('variante SIMPLE : identité stricte entre l’infer et le membre de l’union', () => {
    expectTypeOf<z.infer<typeof setFlagSchema>>().toEqualTypeOf<Extract<Effect, { type: 'setFlag' }>>();
    expectTypeOf<z.infer<typeof setTimeSchema>>().toEqualTypeOf<Extract<Effect, { type: 'setTime' }>>();
  });

  it('variante à INTERSECTION `& ScheduleSpec` : assignabilité MUTUELLE (l’identité échoue, sonde p6)', () => {
    expectTypeOf<z.infer<typeof setObjectiveSchema>>().toExtend<Extract<Effect, { type: 'setObjective' }>>();
    expectTypeOf<Extract<Effect, { type: 'setObjective' }>>().toExtend<z.infer<typeof setObjectiveSchema>>();
    expectTypeOf<z.infer<typeof delayedEffectSchema>>().toExtend<DelayedEffect>();
    expectTypeOf<DelayedEffect>().toExtend<z.infer<typeof delayedEffectSchema>>();
  });

  it('variante à FLOW : le `reward` d’une Petite Prière EST un `Flow<Effect>`, pas un `Flow<EffectOp>`', () => {
    expectTypeOf<z.infer<typeof petitePriereSchema>['reward']>().toExtend<Flow<Effect>>();
    expectTypeOf<PetitePriere['reward']>().toExtend<Flow<Effect>>();
    expectTypeOf<z.infer<typeof sceneFlowSchema>>().toEqualTypeOf<Flow<Effect>>();
  });
});

// ── Volet 4 : la LIAISON AU MOTEUR (gatée par `npm run typecheck`) ────────────────────────────

/** `true` seulement si `A` et `B` s'incluent MUTUELLEMENT ; sinon `false`, et `= true` ne compile plus. */
type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const liaisonFoes: Eq<z.infer<typeof pursuitFoeSchema>, PursuitFoeRef> = true;
const liaisonSpec: Eq<z.infer<typeof massBattleSpecSchema>, MassBattleSpec> = true;
const liaisonFavor: Eq<z.infer<typeof favorLevelSchema>, FavorLevel> = true;
const liaisonCrew: Eq<z.infer<typeof crewHireSchema>, CrewHire> = true;

describe('les schémas DESCENDUS au moteur SONT le type moteur nommé (identité bidirectionnelle)', () => {
  it('`pursuitFoeSchema` ↔ `PursuitFoeRef`, `massBattleSpecSchema` ↔ `MassBattleSpec`, `favorLevelSchema` ↔ `FavorLevel`, `crewHireSchema` ↔ `CrewHire`', () => {
    expect([liaisonFoes, liaisonSpec, liaisonFavor, liaisonCrew]).toEqual([true, true, true, true]);
  });
});
