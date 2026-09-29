import ts from 'typescript'
import { origineImportee } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/canonUnique.mjs'
const sf = ts.createSourceFile('src/x.ts', "import { createProgram as fab } from 'typescript'; fab();", ts.ScriptTarget.Latest, true)
console.log(JSON.stringify(origineImportee('fab', sf)))
