// FORME D'UN SCRIPT DE WORKFLOW — le jugement PUR que partagent la porte de forme
// (`scripts/ops/workflows.test.mjs`) et la doublure qui joue les scripts (`jouer-workflow.mjs`).
//
// Invariant (run `wf_564ccc33-1bf`, #1993) : aucune propriété RACINE d'un schéma passé à `agent()`
// n'accepte une chaîne. Une fonction le juge (`defautsDeRacine`), à deux points d'application : la
// porte, sur le squelette LITTÉRAL de chaque site d'appel ; la doublure, sur l'objet SÉRIALISÉ qui
// part au harnais.
//
// Limite déclarée : la reconnaissance (`lireWorkflow`) est bornée au dépôt SUIVI ou à suivre
// (`git ls-files -co --exclude-standard`, jouer-workflow.mjs) — un script ignoré par git n'est pas jugé.

import { scriptKindDe, typescript } from './dialecte.mjs'

/** Les SEULES clés permises à la racine d'un schéma de sortie d'agent. */
export const CLES_DE_RACINE = ['type', 'properties', 'required', 'additionalProperties']

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const lu = (v) => (v === undefined ? 'absent' : JSON.stringify(v))

/**
 * A1 — défauts STRUCTURELS de la racine d'un schéma. PUR. Rien n'est lu sous une propriété racine :
 * `type` est conjonctif en JSON Schema, une propriété dont le `type` exclut `'string'` n'accepte
 * aucune chaîne, quoi qu'elle porte par ailleurs.
 * @param {unknown} valeur le schéma (squelette évalué, ou objet sérialisé)
 * @param {string} lieu préfixe de chaque message
 * @returns {string[]}
 */
export function defautsDeRacine(valeur, lieu) {
  const defauts = []
  const dire = (m) => defauts.push(`${lieu} — ${m}`)
  if (!estObjet(valeur)) {
    dire(`le schéma n’est pas un objet (lu : ${lu(valeur)})`)
    return defauts
  }
  for (const cle of Object.keys(valeur)) {
    if (!CLES_DE_RACINE.includes(cle)) dire(`clé de racine « ${cle} » hors de ${CLES_DE_RACINE.join('/')}`)
  }
  if (valeur.type !== 'object') dire(`\`type: 'object'\` exigé à la racine (lu : ${lu(valeur.type)})`)
  if (valeur.additionalProperties !== false) dire(`\`additionalProperties: false\` exigé à la racine (lu : ${lu(valeur.additionalProperties)})`)
  if (!estObjet(valeur.properties)) {
    dire(`\`properties\` de la racine n’est pas un objet (lu : ${lu(valeur.properties)})`)
    return defauts
  }
  for (const [cle, propriete] of Object.entries(valeur.properties)) {
    if (!estObjet(propriete)) {
      dire(`propriété racine « ${cle} » n’est pas un objet (lu : ${lu(propriete)})`)
      continue
    }
    const type = propriete.type
    const types = Array.isArray(type) ? type : [type]
    if (type === undefined) dire(`propriété racine « ${cle} » sans \`type\``)
    else if (!types.every((t) => typeof t === 'string')) dire(`propriété racine « ${cle} » : \`type\` n’est ni une chaîne ni un tableau de chaînes (lu : ${lu(type)})`)
    else if (types.includes('string')) dire(`propriété racine « ${cle} » accepte une chaîne (\`type\` : ${lu(type)})`)
  }
  return defauts
}

// ── AST : liaison des noms, par la portée LEXICALE du fichier ────────────────────────────────

/** Nœuds dont `.name` DÉCLARE un nom. */
const declarants = (ts) => [
  ts.isVariableDeclaration, ts.isParameter, ts.isBindingElement, ts.isFunctionDeclaration, ts.isFunctionExpression,
  ts.isClassDeclaration, ts.isClassExpression, ts.isImportClause, ts.isImportSpecifier, ts.isNamespaceImport,
]

/** `true` si cet identifiant est le NOM d'une déclaration. */
export function estDeclaration(id) {
  const ts = typescript()
  const p = id.parent
  return Boolean(p) && p.name === id && declarants(ts).some((est) => est(p))
}

/**
 * `true` si cet identifiant LIT une liaison : ni nom de déclaration, ni nom de membre, ni étiquette,
 * ni `import.meta`. Un raccourci `{ x }` et un `export { x }` lisent `x`.
 */
export function estReference(id) {
  const ts = typescript()
  const p = id.parent
  if (!p || estDeclaration(id)) return false
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === id) return false
  if (ts.isBindingElement(p) && p.propertyName === id) return false
  if (ts.isImportSpecifier(p) && p.propertyName === id) return false
  if (ts.isExportSpecifier(p) && p.propertyName && p.name === id) return false
  if (ts.isMetaProperty(p)) return false
  if ((ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) && p.label === id) return false
  return true
}

/** Tout nom DÉCLARÉ du fichier → ses identifiants de déclaration, dans l'ordre du source. */
export function declarationsDuFichier(sf) {
  const ts = typescript()
  const noms = new Map()
  const marcher = (n) => {
    if (ts.isIdentifier(n) && estDeclaration(n)) noms.set(n.text, [...(noms.get(n.text) ?? []), n])
    ts.forEachChild(n, marcher)
  }
  marcher(sf)
  return noms
}

/** Le nœud dont la déclaration de cet identifiant couvre la portée. */
function porteeDe(id) {
  const ts = typescript()
  let n = id.parent
  while (ts.isBindingElement(n) || ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) n = n.parent
  if (ts.isParameter(n)) return n.parent
  if (ts.isVariableDeclaration(n)) {
    if (ts.isCatchClause(n.parent)) return n.parent
    const liste = n.parent
    if (liste.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) return ts.isVariableStatement(liste.parent) ? liste.parent.parent : liste.parent
    let f = liste.parent
    while (f && !ts.isFunctionLike(f) && !ts.isSourceFile(f)) f = f.parent
    return f
  }
  if (ts.isFunctionExpression(n) || ts.isClassExpression(n)) return n
  if (ts.isImportClause(n) || ts.isImportSpecifier(n) || ts.isNamespaceImport(n)) return id.getSourceFile()
  return n.parent
}

/** Les références LIBRES à ce nom : aucune portée englobante ne le déclare. */
export function referencesLibres(sf, nom) {
  const ts = typescript()
  const portees = new Set((declarationsDuFichier(sf).get(nom) ?? []).map(porteeDe))
  const libres = []
  const marcher = (n) => {
    if (ts.isIdentifier(n) && n.text === nom && estReference(n)) {
      let lie = false
      for (let a = n.parent; a && !lie; a = a.parent) lie = portees.has(a)
      if (!lie) libres.push(n)
    }
    ts.forEachChild(n, marcher)
  }
  marcher(sf)
  return libres
}

/**
 * A3 — le mot-clé `export` de `export const meta` de PREMIER niveau, ou `null`.
 * @returns {import('typescript').Node | null}
 */
export function exportDeMeta(sf) {
  const ts = typescript()
  for (const s of sf.statements) {
    if (!ts.isVariableStatement(s) || !(s.declarationList.flags & ts.NodeFlags.Const)) continue
    const exporte = (s.modifiers ?? []).find((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (exporte && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'meta')) return exporte
  }
  return null
}

/** Préfiltre LÂCHE : un texte qui ne nomme ni `agent` ni `meta` n'est pas parsé. */
export const PREFILTRE_DE_WORKFLOW = /\bagent\b|\bmeta\b/

/**
 * A2 — reconnaissance d'un script de workflow par l'AST. PUR.
 * Un script de workflow porte `export const meta` de PREMIER niveau. Sont des défauts : ce `meta`
 * sans référence à l'identifiant LIBRE `agent`, et `agent` libre sans ce `meta`.
 * @param {string} texte
 * @param {string} fichier chemin (dialecte et messages)
 * @returns {{ script: boolean, exportDeMeta: number | null, defauts: string[] }}
 *   `exportDeMeta` = position du mot-clé `export` (A3), que l'enveloppe retire.
 */
export function lireWorkflow(texte, fichier) {
  const source = String(texte)
  if (!PREFILTRE_DE_WORKFLOW.test(source)) return { script: false, exportDeMeta: null, defauts: [] }
  const ts = typescript()
  const sf = ts.createSourceFile(fichier, source, ts.ScriptTarget.Latest, true, scriptKindDe(fichier))
  const exporte = exportDeMeta(sf)
  const libres = referencesLibres(sf, 'agent')
  const defauts = []
  const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  if (exporte && !libres.length) defauts.push(`${fichier}:${ligne(exporte)} — \`export const meta\` sans référence à l’identifiant libre \`agent\``)
  if (!exporte && libres.length) defauts.push(`${fichier}:${ligne(libres[0])} — \`agent\` libre référencé sans \`export const meta\` de premier niveau`)
  return { script: Boolean(exporte), exportDeMeta: exporte ? exporte.getStart(sf) : null, defauts }
}
