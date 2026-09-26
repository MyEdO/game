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
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Combatant, EffectSource, EffectSourceKind } from '../engine/types';
import type { GameState } from './store';
import type { Flow, FlowTest } from './flow';

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

/** Décor HORS COMBAT des bancs de Test SUBI : aucune bataille, aucune scène, journal et files vides. */
export function decorHorsCombat(): Partial<GameState> {
  return {
    battle: null, scene: null, flags: {}, journal: [],
    pendingTest: null, pendingCascade: null, pendingLogQueue: [], scheduledEffects: [],
    gameTime: 480, party: groupeDeQuatre(),
  };
}
