/**
 * Migration #3606 M2a (L1c #1468) — les références des ops typées dans `OP_DEFS` sont emboîtées : un id nu
 * devient `{ id }`, à la même clé.
 *
 *   op                    clé         catalogue
 *   `rollMutation`        `table`     `mutationTables.json`
 *   `light`               `tone`      `lightTones.json`
 *   `grantNaturalWeapon`  `subType`   `weaponGroups.json`
 *
 * Entrées : chaque `src/data/*.json` (`readdirSync`) ; toute op de ces trois sortes, où qu'elle soit dans le document.
 *
 * Une entrée absente passe sans faute : une op déjà `{ id }`, ou sans la clé, n'a aucun geste. Une valeur ni chaîne ni
 * `{ id }` seul, un id absent de son catalogue, ou un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE
 * écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { emboiterLesRefsDOps } from './lib/refsDOpsEmboitees.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const regleDe = (catalogue) => ({ ids: new Set(JSON.parse(readFileSync(join(ROOT, 'src/data', catalogue), 'utf8')).map((e) => e.id)), catalogue });

emboiterLesRefsDOps(
  ROOT,
  readdirSync(join(ROOT, 'src/data')).filter((f) => f.endsWith('.json')).map((f) => ({ rel: `src/data/${f}`, canonique: serializeDataset })),
  {
    rollMutation: { table: regleDe('mutationTables.json') },
    light: { tone: regleDe('lightTones.json') },
    grantNaturalWeapon: { subType: regleDe('weaponGroups.json') },
  },
  "migration 3606 M2a (références d'ops emboîtées)",
);
