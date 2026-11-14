// Passerelle TS→JSON de l'EXPOSITION déclarée par les defs (#1472) : `scripts/docs/build-donnees.mjs`
// tourne sous Node nu et ne peut pas importer `src/data/schemas/_registry.generated.ts` ; ce dumper,
// lancé par `npx tsx`, écrit sur stdout la table `fichier → { codex, edit }` telle que `document()`
// la pose au handle (aucune table à la main, aucune re-dérivation : la source reste `document(...)`).
import { SCHEMA_DEFS } from '../../../src/data/schemas/_registry.generated';

const out: Record<string, unknown> = {};
for (const def of SCHEMA_DEFS) {
  if (!def.exposition) throw new Error(`dump-exposition : \`${def.file}\` ne déclare aucune \`exposition\`.`);
  out[def.file] = { codex: def.exposition.codex, edit: def.exposition.edit };
}
process.stdout.write(JSON.stringify(out));
