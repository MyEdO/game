import { ast, analyserCorpus } from '../../guards/lib/dialecte.mjs';
// Énumération des EXPORTS PUBLICS de `src/engine`, par AST TypeScript (jamais de regex sur `export`
// — un littéral `'export'` dans une chaîne ou un commentaire fausserait le compte). Socle PARTAGÉ de
// `scripts/docs/build-index-moteur.mjs` (génère `docs/index-moteur.md`) et de
// `src/data/index-moteur-ratchet.test.ts` (cliquet de la dette de JSDoc) — UNE seule mesure, jamais
// deux comptages qui pourraient diverger. Même socle JSDoc que `lib/jsdocUnion.mjs` (`jsdocBody`/
// `firstSentence`), réutilisé tel quel (générique, pas spécifique aux unions).
import * as ts from 'typescript/unstable/ast'
import { readFileSync } from 'node:fs'
import { listerArbre } from '../../guards/lib/lister.mjs'
import { jsdocBody, firstSentence } from './jsdocUnion.mjs'

export const ENGINE_ROOT = 'src/engine'

/** Fichiers `.ts` sous `root`, hors `*.test.ts` (mesure de PRODUCTION, jamais de spec). */
export function fichiersMoteur(root = ENGINE_ROOT) {
  return listerArbre(root, { filtre: (rel) => rel.endsWith('.ts') && !rel.endsWith('.test.ts') })
    .map((rel) => `${root}/${rel}`)
}

const EXPORT_KINDS = new Set([
  'FunctionDeclaration',
  'ClassDeclaration',
  'InterfaceDeclaration',
  'TypeAliasDeclaration',
  'EnumDeclaration',
])

function hasExportModifier(node) {
  if (!('modifiers' in node)) return false
  return (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/**
 * Une ligne d'export : `{ name, file, line, role, kind }`.
 * `role` = 1re phrase du JSDoc juste au-dessus (`null` si aucun JSDoc exploitable).
 * `kind` = 'function' | 'const' | 'class' | 'interface' | 'type' | 'enum'.
 * Périmètre MESURÉ, dit dans l'en-tête du .md généré : les ré-exports (`export { x } from …`,
 * `export * from …`) et les exports par défaut anonymes sont HORS mesure — un export public sans
 * déclaration nommée directe n'a ni ligne ni JSDoc à rapporter honnêtement.
 */
export function fileExports(path, sourceFile) {
  const text = readFileSync(path, 'utf8')
  const sf = sourceFile ?? ast({ rel: path, text: text })
  return exportsDe(path, text, sf)
}

function exportsDe(path, text, sf) {
  const rows = []
  const roleOf = (node) => firstSentenceOrNull(jsdocBody(text.slice(node.getFullStart(), node.getStart(sf))))
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

  for (const node of sf.statements) {
    if (!hasExportModifier(node)) continue
    if (EXPORT_KINDS.has(ts.SyntaxKind[node.kind]) && node.name && ts.isIdentifier(node.name)) {
      const kindMap = { FunctionDeclaration: 'function', ClassDeclaration: 'class', InterfaceDeclaration: 'interface', TypeAliasDeclaration: 'type', EnumDeclaration: 'enum' }
      rows.push({ name: node.name.text, file: path, line: lineOf(node), role: roleOf(node), kind: kindMap[ts.SyntaxKind[node.kind]] })
    } else if (ts.isVariableStatement(node)) {
      const role = roleOf(node)
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue // déstructuration exportée — hors périmètre mesuré
        rows.push({ name: decl.name.text, file: path, line: lineOf(decl), role, kind: 'const' })
      }
    }
  }
  return rows
}

function firstSentenceOrNull(body) {
  return body == null ? null : firstSentence(body)
}

/** Tous les exports publics de `src/engine` (production, hors tests). */
export function allEngineExports(root = ENGINE_ROOT) {
  const fichiers = fichiersMoteur(root).map((rel) => ({ rel, text: readFileSync(rel, 'utf8') }))
  return [...analyserCorpus(fichiers)].flatMap(({ fichier, sourceFile }) => exportsDe(fichier.rel, fichier.text, sourceFile))
}
