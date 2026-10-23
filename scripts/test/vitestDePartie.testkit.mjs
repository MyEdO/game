// Faux Vitest des bancs de `scripts/test/run.mjs` (#2651), posé en `node_modules/vitest/vitest.mjs` d'une racine jetable.

/** Prologue de tout faux Vitest : `fs`, `path`, son côté (`node` ou `jsdom`, lu à sa `--config`), `traceDuCote()`,
 *  `TRACE_DOSSIER/<côté>-<pid>.json`, une trace par lancement, et `ecrireTrace(cible, contenu)`, qui l'écrit en
 *  `<cible>.part` puis la renomme : un banc qui attend la trace et signale le faux Vitest ne lit jamais une trace
 *  vide. */
export const PROLOGUE_DE_FAUX_VITEST =
  "import fs from 'node:fs'\n" +
  "import path from 'node:path'\n" +
  "const cote = process.argv.some((a) => a.includes('vitest.jsdom.')) ? 'jsdom' : 'node'\n" +
  "const traceDuCote = () => path.join(process.env.TRACE_DOSSIER, cote + '-' + process.pid + '.json')\n" +
  "const ecrireTrace = (cible, contenu) => { fs.writeFileSync(cible + '.part', contenu, 'utf8'); fs.renameSync(cible + '.part', cible) }\n"

/** Faux Vitest d'une PARTIE : il trace l'`include` de la config reçue (`--config`), dans `TRACE_INCLUDE`, ou à défaut
 *  dans `traceDuCote()`. */
export const VITEST_DE_PARTIE =
  PROLOGUE_DE_FAUX_VITEST +
  "const config = fs.readFileSync(process.argv[process.argv.indexOf('--config') + 1], 'utf8')\n" +
  "ecrireTrace(process.env.TRACE_INCLUDE ?? traceDuCote(), /include: (\\[.*?\\]) \\} \\};/.exec(config)[1])\n" +
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n"
