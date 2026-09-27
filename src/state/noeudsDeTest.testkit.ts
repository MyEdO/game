/**
 * TOUS les nœuds Flow `kind:'test'` de la base app-owned (`src/data/*.json`), scannés sur la DONNÉE
 * RÉELLE — jamais une liste recopiée, jamais un cardinal écrit à la main.
 *
 * Deux bancs le consomment et n'en gardent aucune copie : la garde de complétude de l'enjeu dérivé
 * (`flowtest-derived-stake.test.ts`) lit le `FlowTest`, la garde de CLASSE du Test SUBI
 * (`test-subi-classe.test.ts`) rejoue le NŒUD ENTIER par sa porte — d'où `node` et `chemin` à côté
 * de `ft` : une garde qui ne voit que la spec de jet ne peut pas rejouer ses branches.
 *
 * Le DÉCOR des deux bancs de Test SUBI (#1874) vit ici pour la même raison : un groupe de QUATRE où
 * le sujet n'est jamais `party[0]` est ce qui distingue « la conséquence tombe sur le sujet » de
 * « elle tombe sur le premier venu ». Aucune importation de store — les deux bancs posent le décor
 * eux-mêmes, ce kit ne fait que le CONSTRUIRE (type seul, effacé à la compilation).
 *
 * La PORTE MALADIE (`rendreMalade` → `nuitDuMalade`) y vit aussi : un nœud de cycle (`onTick.test` d'un
 * symptôme, `dailyTest.test` d'une maladie) se joue par l'ENTRETIEN réel de la nuit (étape `diseaseTick`,
 * `engine/disease.ts` `tickDisease` → applier de `state/restFlow.ts`), jamais par `routeTriggeredTest`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant, EffectSource, EffectSourceKind } from '../engine/types';
import { contractDisease, tickDisease } from '../engine/disease';
import { dayIndex, MINUTES_PER_DAY } from '../engine/clock';
import type { GameState } from './store';
import type { Flow, FlowTest } from './flow';
import type { Get } from './flowTypes';
import type { CascadeStep } from './pendings';
import { battleRng } from './battleRng';
import { draineCascade } from './cascadeTestKit';

const DATA = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');

export type NoeudTest = Extract<Flow, { kind: 'test' }>;

/** NATURE de source de chaque famille de données qui porte des `FlowTest` (`EffectSourceKind`, table
 *  TOTALE côté Codex : `CATEGORY_BY_SOURCE_KIND`). Un fichier absent d'ici et porteur d'un `test`
 *  fait rougir la garde d'enjeu — c'est le point d'accrochage d'une famille NEUVE. Les familles dont
 *  le foyer est la RANGÉE et non le document (Critiques) n'y sont pas : leur producteur les nomme
 *  (cf. `ENJEU_AU_PRODUCTEUR`, `flowtest-derived-stake.test.ts`). */
export const KIND_PAR_FICHIER: Record<string, EffectSourceKind> = {
  'spells.json': 'spell',
  'trappings.json': 'trapping',
  'etats.json': 'condition',
  'talents.json': 'talent',
  'traits.json': 'trait',
  'maneuvers.json': 'maneuver',
  'qualities.json': 'quality',
  'symptoms.json': 'symptom',
  'maladies.json': 'disease',
};

export interface Noeud {
  /** Fichier de `src/data` qui porte l'entrée (nom nu, ex. `symptoms.json`). */
  fichier: string;
  /** Id STABLE de l'entrée porteuse (jamais son libellé). */
  entryId: string;
  /** Spec de jet du nœud. */
  ft: FlowTest;
  /** Le nœud `test` ENTIER (spec + branches `success`/`fail`) — rejouable par une porte. */
  node: NoeudTest;
  /** Chemin JSON du nœud dans son entrée (ex. `.onTick.test`) — NOMME le site en cas de rouge. */
  chemin: string;
  /** ENTITÉ PORTEUSE du nœud, quand sa famille en a une (`KIND_PAR_FICHIER`) : tout producteur réel
   *  la passe à la porte (`OpsCtx.source`), et c'est d'elle que le nœud dérive son enjeu. */
  source?: EffectSource;
}

/** Tous les nœuds `kind:'test'` de la base app-owned, avec l'ENTRÉE qui les porte (id STABLE). */
export function noeudsDeTest(): Noeud[] {
  const out: Noeud[] = [];
  for (const fichier of listerDossier(DATA).filter((f) => f.endsWith('.json'))) {
    let json: unknown;
    try { json = JSON.parse(readFileSync(join(DATA, fichier), 'utf8')); } catch { continue; }
    const entrees = Array.isArray(json) ? json : [json];
    for (const entree of entrees) {
      const id = (entree as { id?: string })?.id;
      if (!id) continue;
      const walk = (n: unknown, chemin: string): void => {
        if (Array.isArray(n)) { n.forEach((v, i) => walk(v, `${chemin}[${i}]`)); return; }
        if (!n || typeof n !== 'object') return;
        const o = n as Record<string, unknown>;
        if (o.kind === 'test' && o.test) {
          const kind = KIND_PAR_FICHIER[fichier];
          out.push({ fichier, entryId: id, ft: o.test as FlowTest, node: o as unknown as NoeudTest, chemin, ...(kind ? { source: { kind, id } } : {}) });
        }
        for (const [k, v] of Object.entries(o)) walk(v, `${chemin}.${k}`);
      };
      walk(entree, '');
    }
  }
  return out;
}

/** Le GROUPE des bancs de Test SUBI : quatre héros réels, ids `h1`…`h4`. Le SUJET est `party[2]`
 *  (`h3`) — ni le premier du groupe (défaut de `effectTargets('hero')`), ni le meilleur au jet
 *  (défaut de `partyBest`) : une conséquence qui tombe sur h3 y est tombée par ROUTAGE. */
export function groupeDeQuatre(): Combatant[] {
  return [1, 2, 3, 4].map((i) => createHero({
    speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, motivation: 'Sonde', rng: makeRNG(i), id: `h${i}`,
  }));
}

/** Décor HORS COMBAT des bancs de Test SUBI : aucune bataille, aucune scène, journal et files vides,
 *  aucun repos ouvert, entretien à jour — la nuit suivante en traite exactement UN jour. */
export function decorHorsCombat(): Partial<GameState> {
  const gameTime = 480;
  return {
    battle: null, scene: null, flags: {}, journal: [],
    pendingTest: null, pendingCascade: null, pendingRest: null, pendingLogQueue: [], scheduledEffects: [],
    gameTime, lastUpkeepDay: dayIndex(gameTime), party: groupeDeQuatre(),
  };
}

const lireDonnee = <T extends { id: string }>(fichier: string): T[] =>
  JSON.parse(readFileSync(join(DATA, fichier), 'utf8')) as T[];

/** La PORTE MALADIE d'un nœud, lue à son CHAMP porteur : la maladie à contracter, le symptôme dont
 *  l'étape `diseaseTick` porte le jet, et les jours de phase active avant qu'il ne tombe. `undefined`
 *  pour tout autre nœud. Un symptôme qu'aucune maladie ne porte LÈVE (nœud injouable, nommé). */
export function porteDeMaladie(n: Noeud): { maladie: string; symptomId: string; jours: number } | undefined {
  if (n.fichier === 'maladies.json' && n.chemin === '.dailyTest.test') {
    const dz = lireDonnee<{ id: string; dailyTest: { symptomId: string } }>('maladies.json').find((m) => m.id === n.entryId)!;
    return { maladie: n.entryId, symptomId: dz.dailyTest.symptomId, jours: 0 };
  }
  if (n.fichier === 'symptoms.json' && n.chemin === '.onTick.test') {
    const porteuse = lireDonnee<{ id: string; symptoms?: { symptomId: string }[] }>('maladies.json')
      .find((m) => (m.symptoms ?? []).some((x) => x.symptomId === n.entryId));
    if (!porteuse) throw new Error(`symptôme « ${n.entryId} » : aucune maladie de maladies.json ne le porte`);
    const sym = lireDonnee<{ id: string; onTick: { afterDays?: number } }>('symptoms.json').find((x) => x.id === n.entryId)!;
    return { maladie: porteuse.id, symptomId: n.entryId, jours: sym.onTick.afterDays ?? 0 };
  }
  return undefined;
}

/** Le héros `c` rendu MALADE de la maladie qui porte le nœud, par le VRAI cycle (phase active, jours
 *  écoulés jusqu'au premier jet dû). Rend une COPIE : le banc la pose au décor. */
export function rendreMalade(c: Combatant, n: Noeud): Combatant {
  const porte = porteDeMaladie(n);
  if (!porte) throw new Error(`${n.fichier} ${n.entryId}${n.chemin} : pas un nœud de maladie`);
  const dz = contractDisease(porte.maladie, battleRng(), { incubation: 0 });
  if (!dz) throw new Error(`maladie « ${porte.maladie} » inconnue de la base`);
  const h: Combatant = { ...structuredClone(c), diseases: [...(c.diseases ?? []), dz] };
  for (let j = 0; j < porte.jours; j++) tickDisease(h, MINUTES_PER_DAY, battleRng(), () => {});
  return h;
}

/** La NUIT du malade (repos → « Dormir »), par les gestes du joueur : l'étape `diseaseTick` du nœud reçoit
 *  un dé POSÉ (« Dés fixés », `draineCascade`) — 1 pour une réussite, 100 pour un échec —, toute autre
 *  rangée un 1. Aucun dé tiré : deux nuits de même décor ne divergent que par l'issue du jet du nœud. */
export function nuitDuMalade(get: Get, n: Noeud, sujetId: string, reussite: boolean): void {
  const { symptomId } = porteDeMaladie(n)!;
  get().openRest();
  get().restSleep();
  const p = get().pendingCascade;
  const vise = (s: CascadeStep): boolean => s.kind === 'diseaseTick' && s.meta?.symptomId === symptomId
    && (s.participants ? s.participants.some((r) => r.id === sujetId) : s.actorId === sujetId);
  if (!p?.participants.some(vise)) throw new Error(`${n.entryId} : la nuit n’a posé aucune étape \`diseaseTick\` de « ${symptomId} » chez ${sujetId} (nuit : ${(p?.participants ?? []).map((s) => `${s.kind}:${String(s.meta?.symptomId ?? '')}`).join(' ') || 'aucune cascade'} ; jour ${dayIndex(get().gameTime)}, entretien ${get().lastUpkeepDay})`);
  draineCascade(get, 200, (etape, rangee) => (vise(etape) && (rangee ? rangee.id === sujetId : true) && !reussite ? 100 : 1));
}
