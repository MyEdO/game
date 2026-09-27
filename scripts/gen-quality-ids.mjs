// Génère src/engine/qualities/qualityId.generated.ts depuis src/data/qualities.json — GÉNÉRÉ par
// `node scripts/gen-quality-ids.mjs` (`npm run gen:quality-ids`), NE PAS ÉDITER À LA MAIN.
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
//
// Union de LITTÉRAUX seulement (aucun export runtime) : un id retiré de `qualities.json` fait
// échouer la compilation aux sites d'appel qui le citaient, jamais un objet exhaustif qui
// citerait chaque id de la donnée comme jeton de chaîne (faux-positif de
// `scripts/docs/build-entity-orphans.mjs`, un id non référencé par le moteur passant à tort pour
// consommé). Zéro paire écrite à la main : une qualité ajoutée/renommée dans `qualities.json`
// régénère l'union sans y toucher.
import { readFileSync } from 'node:fs';
import { ecrireOuVerifier } from './docs/lib/empreinte-sources.mjs';

const DATA = 'src/data/qualities.json';
const OUT = 'src/engine/qualities/qualityId.generated.ts';

const qualities = JSON.parse(readFileSync(DATA, 'utf8'));
const ids = [...new Set(qualities.map((q) => q.id))].sort();

let out = `/**\n`;
out += ` * GÉNÉRÉ par \`node scripts/gen-quality-ids.mjs\` (\`npm run gen:quality-ids\`) — NE PAS ÉDITER À LA MAIN.\n`;
out += ` * Union des \`id\` déclarés dans ${DATA} — le typage réel des consommateurs.\n`;
out += ` */\n`;
out += `export type QualityId =\n  | '${ids.join(`'\n  | '`)}';\n`;

ecrireOuVerifier({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `gen:quality-ids — ${OUT} est PÉRIMÉ (${DATA} a changé).`,
  rerunMsg: '  → relancer `npm run gen:quality-ids` et committer le résultat.',
  okMsg: `gen:quality-ids — OK (${OUT} à jour, ${ids.length} ids)`,
  writeMsg: `${OUT} — ${ids.length} ids générés depuis ${DATA}.`,
});
