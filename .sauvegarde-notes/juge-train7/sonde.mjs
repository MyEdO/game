import { CONSTRUCTION_DE_PROGRAMME as P, scanConstructionsReservees as scan, recopieDeCanon } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/canonUnique.mjs';
const G = { ...P, foyer: 'scripts/guards/lib/tsProgram.mjs' };
const l = (text, rel = 'src/temoin.test.ts') => scan({ rel, text }, [G]).map((t) => t.line);
const cas = {
  optChain: "import ts from 'typescript';\nts?.createProgram([], {});",
  parenth: "import ts from 'typescript';\n(ts.createProgram)([], {});",
  nonNull: "import ts from 'typescript';\nts.createProgram!([], {});",
  sousChemin: "import ts from 'typescript/lib/tsserverlibrary';\nts.createProgram([], {});",
  defaultDuNs: "import * as ts from 'typescript';\nts.default.createProgram([], {});",
  masque: "import ts from 'typescript';\nfunction f(ts) { return ts.createProgram(); }",
  mjs: "import ts from \"typescript\";\nconst p = ts.createProgram([], {});",
  mjsRel: ["import ts from 'typescript';\nts.createProgram([], {});", 'scripts/x.mjs'],
  importType: "import type ts from 'typescript';\nts.createProgram([], {});",
  lsNu: "import { createLanguageService } from 'typescript';\ncreateLanguageService(h);",
  nomNonFabrique: "import ts from 'typescript';\nts.createSourceFile('a','b',1);",
};
for (const [k, v] of Object.entries(cas)) console.log(k, JSON.stringify(Array.isArray(v) ? l(v[0], v[1]) : l(v)));
