/**
 * Migration #3606 M2a2 (L1c #1468) — les références d'État des ops `condition` et `removeCondition`, typées dans
 * `OP_DEFS`, sont emboîtées : un id nu devient `{ id }`, à la même clé.
 *
 *   op                 clés
 *   `condition`        `id`, `onlyIfCondition`, `unlessCondition`
 *   `removeCondition`  `id`
 *
 * Catalogue : `etats.json` et les ids des marqueurs narratifs de `NARRATIVE_MARKERS` (`src/engine/conditions.ts`) à la
 * date de la migration, figés ici : le module du moteur ne se charge pas sous `node` nu, et le rejeu dit l'arbre de
 * cette date. Le dialecte miscast (`miscast.json`) porte la même op `condition` : il migre avec elle.
 *
 * Entrées : chaque `src/data/*.json` (`readdirSync`) et chaque `src/scenes/<campagne>/<campagne>-projet.json` ; toute op
 * de ces deux sortes, où qu'elle soit dans le document.
 *
 * Une entrée absente passe sans faute : une op déjà `{ id }`, ou sans la clé, n'a aucun geste. Une valeur ni chaîne ni
 * `{ id }` seul, un id ni au catalogue ni marqueur, ou un document non canonique sont un ARRÊT nominatif (exit 1),
 * AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { emboiterLesRefsDOps } from './lib/refsDOpsEmboitees.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MARQUEURS_NARRATIFS = ['petrifie'];
const ETAT = { ids: new Set([...JSON.parse(readFileSync(join(ROOT, 'src/data/etats.json'), 'utf8')).map((e) => e.id), ...MARQUEURS_NARRATIFS]), catalogue: 'etats.json et des marqueurs narratifs' };

const canoniqueDeScene = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
emboiterLesRefsDOps(
  ROOT,
  [
    ...readdirSync(join(ROOT, 'src/data')).filter((f) => f.endsWith('.json')).map((f) => ({ rel: `src/data/${f}`, canonique: serializeDataset })),
    ...readdirSync(join(ROOT, 'src/scenes'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'src/scenes', d.name, `${d.name}-projet.json`)))
      .map((d) => ({ rel: `src/scenes/${d.name}/${d.name}-projet.json`, canonique: canoniqueDeScene })),
  ],
  { condition: { id: ETAT, onlyIfCondition: ETAT, unlessCondition: ETAT }, removeCondition: { id: ETAT } },
  "migration 3606 M2a2 (États d'ops emboîtés)",
);
