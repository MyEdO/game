// Faux Vitest des bancs de `scripts/test/run.mjs` (#2651), posé en `node_modules/vitest/vitest.mjs` d'une racine jetable.

/** Faux Vitest d'une PARTIE : il écrit dans `TRACE_INCLUDE` l'`include` de la config reçue (`--config`). */
export const VITEST_DE_PARTIE =
  "import fs from 'node:fs'\n" +
  "const config = fs.readFileSync(process.argv[process.argv.indexOf('--config') + 1], 'utf8')\n" +
  "fs.writeFileSync(process.env.TRACE_INCLUDE, /include: (\\[.*?\\]) \\} \\};/.exec(config)[1], 'utf8')\n" +
  "process.stdout.write(' Test Files  1 passed (1)\\n')\n"
