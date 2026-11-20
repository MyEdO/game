// LES PIÈCES D'UNE ARÊTE (#4471) : les valeurs du type `PieceDArete` de `src/noyau/monde/aretes.ts`, lues de sa
// déclaration par l'analyseur de Vite (un type n'a pas de valeur à importer), les nœuds que `test_arete.py` exige de
// chaque kit. Écrit sur la sortie standard leur liste.
//   node scripts/personnage-3d/arete/pieces.mjs
import { readFileSync } from 'node:fs'
import { parseAst } from 'vite'

const SOURCE = new URL('../../../src/noyau/monde/aretes.ts', import.meta.url)
const NOM = 'PieceDArete'

const declaration = parseAst(readFileSync(SOURCE, 'utf8'), { lang: 'ts' }).body
  .map((s) => s.declaration ?? s)
  .find((s) => s.type === 'TSTypeAliasDeclaration' && s.id.name === NOM)
const membres = declaration?.typeAnnotation.type === 'TSUnionType' ? declaration.typeAnnotation.types : []
const pieces = membres.map((m) => (m.type === 'TSLiteralType' && typeof m.literal.value === 'string' ? m.literal.value : null))
if (!pieces.length || pieces.includes(null)) throw new Error(`${NOM} : une union de chaînes littérales attendue dans ${SOURCE.pathname}`)
process.stdout.write(JSON.stringify(pieces))
