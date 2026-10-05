/**
 * BANC — le prix d'une lecture d'index VIVANT (#1692, #1788).
 *
 * CE QU'IL MESURE : un index VIVANT (`indexParId`/`memoParVersion`, `data/versionDataset.ts`) coûte, par
 * lecture, un contrôle de fraîcheur de plus qu'une `Map` figée à l'import.
 * `.claude/soldes/revue-palier-2026-09-09-fd660c8b8-34e3cbb6c.md` a mesuré ce contrôle à +31 ns/lecture
 * (×4,4) sur une copie du module : le témoin était une CHAÎNE
 * fabriquée à CHAQUE lecture (`cles.map(versionDuDataset).join('/')`) — une allocation par lecture,
 * plus une recherche par chaîne dans une `Map` par clé. Le témoin est depuis un NOMBRE lu dans une
 * cellule capturée. Deux mesures, à lire l'une contre l'autre :
 *  1. lecture VIVANTE contre lecture FIGÉE, à profondeur d'appel ÉGALE ;
 *  2. le bake réel des scènes de la Diligence — l'usage qui motivait l'annonce « chemin chaud < 1 % » :
 *     chaque élément de décor émis coûte un nombre BORNÉ de lectures d'index (recette, volume,
 *     matières), et c'est à ce bake que le surcoût par lecture doit se comparer. Que ce bake donne
 *     bien du travail est un CONTRAT, prouvé par `versionDataset.bake.test.ts` sur la même fixture.
 *
 * POURQUOI CE N'EST PAS UN TEST : ce que l'index vivant REND, et le fait qu'il se refasse à l'écriture,
 * sont des contrats de travail — ils se prouvent sans horloge (`data/versionDataset.test.ts`). Ce
 * qu'il PREND est une durée, et une durée mesure l'ordonnanceur de la machine qui joue : le même
 * ratio vaut 1,39 au calme et 2,1 sous la charge d'une suite voisine. Ce fichier est donc hors de
 * `npm test` et de la CI (`scripts/guards/lib/racinesDeLaSuite.mjs` n'inclut que `*.test.{ts,tsx}`), et se joue par
 * `npm run bench`.
 *
 * COUCHE : il vit sous `gameIso/` parce qu'il CUIT des scènes — un objet de rendu, pas de donnée.
 */
import { test } from 'vitest';
import { props } from '../../data/index';
import { indexParId } from '../../data/versionDataset';
import { bakerLesScenes, scenesDeLaDiligence } from './versionDataset.fixture';

/** Les deux chemins comparés : un accesseur d'index VIVANT et un accesseur de `Map` FIGÉE, tous deux
 *  frais (aucune lecture manquée dans leur histoire, qui polymorphiserait un seul des deux sites) et
 *  appelés à la MÊME profondeur — sans quoi la comparaison porterait sur une trame d'appel. */
const cles = props.map((p) => p.id);
const vivant = indexParId('props', props);
const FIGE = new Map(props.map((p) => [p.id, p] as const));
const fige = (id: string) => FIGE.get(id);

/** Lectures par itération de banc : assez pour que la boucle domine le coût d'appel du banc. */
const N = 100_000;

test('lecture d’index : le contrôle de fraîcheur, par lecture', async ({ bench }) => {
  await bench.compare(
    bench(`index VIVANT — ${N} lectures`, () => {
      for (let i = 0; i < N; i++) vivant(cles[i % cles.length]);
    }),
    bench(`Map FIGÉE à l’import — ${N} lectures`, () => {
      for (let i = 0; i < N; i++) fige(cles[i % cles.length]);
    }),
  );
});

test('bake réel (Diligence) — l’échelle à laquelle ce surcoût se compare', async ({ bench }) => {
  // La MÊME fixture que le contrat : c'est `versionDataset.bake.test.ts` qui prouve que ce bake émet
  // bien des scènes et du décor, donc qu'il y a ici du travail à chronométrer.
  const scenes = scenesDeLaDiligence();

  await bench(`bake de ${scenes.length} scènes (sols + décor)`, () => {
    bakerLesScenes(scenes);
  }).run();
});
