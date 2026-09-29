import { CONSTRUCTION_DE_PROGRAMME, scanConstructionsReservees } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/canonUnique.mjs'
const P = { ...CONSTRUCTION_DE_PROGRAMME, foyer: 'scripts/guards/lib/tsProgram.mjs' }
const cas = {
  membre: 'ts.createProgram({ rootNames: [], options: {} });',
  nu: "import { createProgram } from 'typescript'; createProgram([], {});",
  alias: "import { createProgram as fab } from 'typescript'; fab([], {});",
  destructure: "import ts from 'typescript'; const { createProgram: fab } = ts; fab([], {});",
  elementAccess: "import ts from 'typescript'; ts['createProgram']([], {});",
  languageService: "import ts from 'typescript'; ts.createLanguageService(hote).getProgram();",
  builder: "import ts from 'typescript'; ts.createSemanticDiagnosticsBuilderProgram([], {});",
  commentaire: '// ts.createProgram([], {})\n/* createProgram(x) */ const z = 1;',
  jsdoc: '/** `ts.createProgram(...)` */ export const y = 1;',
  homonymeMetier: 'function createProgram() {} createProgram();',
}
for (const [k, text] of Object.entries(cas)) for (const rel of ['src/x.ts', 'scripts/guards/lib/tsProgram.mjs'])
  console.log(k.padEnd(16), rel.padEnd(34), JSON.stringify(scanConstructionsReservees({ rel, text }, [P]).map((t) => t.line)))
