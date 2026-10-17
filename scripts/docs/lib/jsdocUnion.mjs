import { ast, analyserCorpus } from '../../guards/lib/dialecte.mjs';
import { contexteImports, estAppelDeclare } from '../../guards/lib/canonUnique.mjs';
// Socle PARTAGÉ des générateurs de doc « vocabulaire » (#298bis) : lecture d'une union discriminée
// TypeScript par AST (jamais de regex sur les accolades, les unions imbriquent
// des littéraux d'objet et des intersections) et extraction du JSDoc de chaque membre. Consommé par
// scripts/docs/build-effects.mjs (union `Effect` de src/state/scene.ts) et
// scripts/docs/build-vocabulaire.mjs (unions `GameOp` de src/engine/ops.ts,
// `Condition`/`Flow`/`EffectTrigger`/`EffectTargeting` de src/engine/flowCore.ts).
import * as ts from 'typescript/unstable/ast'
import { TypeFlags, SymbolFlags } from 'typescript/unstable/sync'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { VIRTUAL_ROOT, virtualProgram, repoProgram, libererSessions } from '../../guards/lib/tsProgram.mjs'

/** Abréviations FR à ne PAS prendre pour une fin de phrase (« ex. », « l. », « p. »… — sinon un
 *  « (ex. » tronque le rôle en pleine parenthèse ouverte). */
export const ABBR = new Set(['ex', 'cf', 'l', 'p', 'ch', 'art', 'etc', 'n', 'vs', 'c'])

/** 1re phrase d'un corps de JSDoc déjà aplati, abréviations FR exclues des coupures. */
export function firstSentence(body) {
  const re = /\.(?=\s|$)/g
  let m
  while ((m = re.exec(body))) {
    const before = body.slice(0, m.index)
    const word = (before.match(/([A-Za-zÀ-ÿ]+)$/) ?? [])[1]?.toLowerCase()
    if (word && ABBR.has(word)) continue
    return body.slice(0, m.index + 1)
  }
  return body
}

// eslint-disable-next-line no-irregular-whitespace
/** Corps APLATI du DERNIER bloc `/** … *​/` d'un fragment de source (`null` si aucun). */
export function jsdocBody(between) {
  const matches = [...between.matchAll(/\/\*\*[\s\S]*?\*\//g)]
  if (!matches.length) return null
  return matches[matches.length - 1][0]
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 1re phrase du dernier JSDoc d'un fragment (rôle affiché en table). */
export function jsdocRole(between) {
  const body = jsdocBody(between)
  return body == null ? null : firstSentence(body)
}

/** Charge un fichier source et rend `{ text, sf }`. */
export function loadSource(path, sourceFile) {
  const text = readFileSync(path, 'utf8')
  return { text, sf: sourceFile ?? ast({ rel: path, text: text }) }
}

/** Alias de type NOMMÉ d'un fichier (fail-fast : un vocabulaire renommé doit casser bruyamment). */
export function findAlias(sf, name, tool, path) {
  let found
  sf.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === name) found = node
  })
  if (!found) {
    console.error(`${tool} — type alias « ${name} » introuvable dans ${path}`)
    process.exit(1)
  }
  return found
}

/** JSDoc porté par la DÉCLARATION d'alias elle-même (préambule du vocabulaire), corps aplati —
 *  lu dans la trivia de tête de la déclaration (`getFullStart` → `getStart`). */
export function aliasDoc(text, alias, sf) {
  return jsdocBody(text.slice(alias.getFullStart(), alias.getStart(sf)))
}

/** Le champ est-il une EXCLUSION (`champ?: never`) — l'interdit d'un membre d'union exclusive, jamais
 *  un champ qu'il porte ? */
function estExclusion(prop) {
  return prop.type?.kind === ts.SyntaxKind.NeverKeyword
}

/**
 * Membres d'une union discriminée, avec leur JSDoc.
 * `discriminant` : nom de la propriété littérale qui NOMME le membre (`type`, `op`, `kind`).
 * Options :
 *  - `allowLiterals` : un membre `'foo'` (littéral de chaîne) est accepté et nommé `foo` ;
 *  - `fallbackRole`  : rôle attribué à un membre qui est une simple RÉFÉRENCE de type sans JSDoc.
 * Rend `[{ name, fieldGroups, role }]` — les formes en double (même `name`) sont FUSIONNÉES,
 * `fieldGroups` accumulant chaque forme.
 */
export function readUnionMembers(sf, text, alias, discriminant, tool, opts = {}) {
  const union = alias.type
  if (!ts.isUnionTypeNode(union)) {
    console.error(`${tool} — « ${alias.name.text} » n'est pas une union`)
    process.exit(1)
  }

  const readTypeLiteral = (member, prevEnd) => {
    let name = null
    const fields = []
    for (const prop of member.members) {
      if (!ts.isPropertySignatureDeclaration(prop)) continue
      const pname = prop.name.getText(sf)
      if (pname === discriminant && prop.type && ts.isLiteralTypeNode(prop.type) && ts.isStringLiteral(prop.type.literal)) {
        name = prop.type.literal.text
        continue
      }
      if (estExclusion(prop)) continue
      fields.push(pname + (prop.postfixToken?.kind === ts.SyntaxKind.QuestionToken ? '?' : ''))
    }
    if (!name) {
      if (opts.allowLiterals && fields.length) return { name: `{ ${fields[0]} … }`, fields: fields.slice(1) }
      console.error(`${tool} — membre de l'union sans propriété « ${discriminant} » littérale (autour de ${text.slice(prevEnd, prevEnd + 40)}…)`)
      process.exit(1)
    }
    return { name, fields }
  }

  const rows = []
  let prevEnd = union.types.pos
  for (const member of union.types) {
    const between = text.slice(prevEnd, member.getStart(sf))
    const role = jsdocRole(between)
    const inner = ts.isParenthesizedTypeNode(member) ? member.type : member
    if (ts.isIntersectionTypeNode(inner)) {
      // `({ type: '…'; … } & Spec)` : le littéral porte le discriminant, les autres membres (référence
      // de type) sont notés en champ « spread » `...Nom`.
      const literal = inner.types.find((t) => ts.isTypeLiteralNode(t))
      if (!literal) {
        console.error(`${tool} — intersection sans littéral discriminant (autour de ${text.slice(prevEnd, prevEnd + 40)}…)`)
        process.exit(1)
      }
      const { name, fields } = readTypeLiteral(literal, prevEnd)
      for (const t of inner.types) {
        if (t === literal) continue
        if (ts.isTypeReferenceNode(t)) fields.push(`...${t.typeName.getText(sf)}`)
      }
      rows.push({ name, fieldGroups: [fields], role })
    } else if (ts.isTypeLiteralNode(inner)) {
      const { name, fields } = readTypeLiteral(inner, prevEnd)
      rows.push({ name, fieldGroups: [fields], role })
    } else if (opts.allowLiterals && ts.isLiteralTypeNode(inner) && ts.isStringLiteral(inner.literal)) {
      rows.push({ name: inner.literal.text, fieldGroups: [], role })
    } else if (ts.isTypeReferenceNode(inner)) {
      rows.push({ name: inner.typeName.getText(sf), fieldGroups: [], role: role ?? opts.fallbackRole ?? null })
    } else {
      console.error(`${tool} — membre d'union non supporté (kind ${ts.SyntaxKind[member.kind]})`)
      process.exit(1)
    }
    prevEnd = member.getEnd()
  }

  // Fusion des formes en double (ex. `setTime` : `phase` OU `hour`+`minute?` ; `rollTable` : `rows`
  // INLINE OU `tableId`) en UNE ligne.
  const merged = []
  const byName = new Map()
  for (const r of rows) {
    if (byName.has(r.name)) {
      const existing = byName.get(r.name)
      existing.fieldGroups.push(...r.fieldGroups)
      if (!existing.role && r.role) existing.role = r.role
    } else {
      const copy = { name: r.name, fieldGroups: [...r.fieldGroups], role: r.role }
      byName.set(r.name, copy)
      merged.push(copy)
    }
  }
  return { rows: merged, rawCount: union.types.length }
}

/** Rendu des champs d'une ligne : formes séparées par ` \| ` (échappé pour la table Markdown). */
export function renderFields(fieldGroups) {
  const nonEmpty = fieldGroups.filter((g) => g.length)
  if (!nonEmpty.length) return '—'
  return nonEmpty.map((g) => g.map((f) => `\`${f}\``).join(', ')).join(' \\| ')
}

// ── Lecture d'une union discriminée exprimée en SCHÉMAS zod ──────────────────────────────────────
// Même contrat que `readUnionMembers` (rendre `[{ name, fieldGroups, role }]` dans l'ordre de
// l'union), mais la source est un `z.discriminatedUnion('type', [ …identifiants… ])` dont chaque
// membre est un `export const xSchema = z.strictObject({ … })` porteur de son JSDoc.

/** Déballe `z.lazy(() => X)`, `X.superRefine(…)`, `X.optional()`… jusqu'à l'appel `z.strictObject`. */
function decorateursZod(sf, checker, chemin) {
  const contexte = contexteImports(sf, checker)
  const appels = new Set()
  const fonctions = { 'src/data/schemas/grammaire/meta.ts': ['nommerChamps', 'nommerNoeud'] }
  const visiter = (node) => {
    if (ts.isCallExpression(node) && estAppelDeclare(node, sf, fonctions, contexte)) appels.add(`${node.pos}:${node.end}`)
    node.forEachChild(visiter)
  }
  visiter(sf)
  const normaliser = nom => {
    const absolu = path.resolve(nom).replaceAll('\\', '/')
    return process.platform === 'win32' ? absolu.toLowerCase() : absolu
  }
  const fichiers = new Set([normaliser(sf.fileName), normaliser(path.resolve(VIRTUAL_ROOT, chemin))])
  return { has: node => {
    const source = node.getSourceFile()
    return source.text === sf.text && fichiers.has(normaliser(source.fileName)) && appels.has(`${node.pos}:${node.end}`)
  } }
}

export function noyauZod(node, entree) {
  if (ts.isArrowFunction(node)) return noyauZod(node.body, entree)
  if (ts.isParenthesizedExpression(node)) return noyauZod(node.expression, entree)
  if (ts.isCallExpression(node)) {
    if (entree?.decorateursZod.has(node)) return noyauZod(node.arguments[0], entree)
    const cible = node.expression
    if (ts.isPropertyAccessExpression(cible)) {
      const membre = cible.name.text
      if (membre === 'lazy') return noyauZod(node.arguments[0], entree)
      if (membre === 'strictObject' || membre === 'object' || membre === 'looseObject' || membre === 'discriminatedUnion') return node
      return noyauZod(cible.expression, entree) // .superRefine(…), .optional(), .refine(…)
    }
  }
  return node
}

// eslint-disable-next-line no-irregular-whitespace
/** Le membre est-il OPTIONNEL ? (`…​.optional()` quelque part dans la chaîne d'appels). */
export function estOptionnel(node, entree) {
  let n = node
  if (ts.isParenthesizedExpression(n)) return estOptionnel(n.expression, entree)
  while (ts.isCallExpression(n)) {
    if (entree?.decorateursZod.has(n)) return estOptionnel(n.arguments[0], entree)
    const cible = n.expression
    if (!ts.isPropertyAccessExpression(cible)) break
    if (cible.name.text === 'optional') return true
    n = cible.expression
  }
  return false
}

/** Index `nom → { statement, sf, text }` des `export const NOM = …` de plusieurs fichiers. */
export function indexerConstantes(fichiers) {
  const index = new Map()
  for (const { fichier: { rel: chemin, text }, sourceFile: sf, checker } of analyserCorpus(fichiers.map((chemin) => ({ rel: chemin, text: readFileSync(chemin, 'utf8') })))) {
    const decorateurs = decorateursZod(sf, checker, chemin)
    sf.forEachChild((node) => {
      if (!ts.isVariableStatement(node)) return
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) index.set(d.name.text, { statement: node, decl: d, sf, text, chemin, decorateursZod: decorateurs })
      }
    })
  }
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const candidat = entree => {
    const liaisons = new Map()
    entree.sf.forEachChild(node => {
      if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text === 'zod') return
      const spec = node.moduleSpecifier.text
      const cible = path.resolve(path.dirname(path.resolve(entree.chemin)), spec).replace(/\.(?:m?js|m?ts)$/, '').toLowerCase()
      const meta = spec.startsWith('.') && cible === path.join(root, 'src/data/schemas/grammaire/meta').toLowerCase()
      const bindings = node.importClause.namedBindings
      if (bindings && ts.isNamedImports(bindings)) for (const e of bindings.elements) {
        if (!e.isTypeOnly && !(meta && ['nommerChamps', 'nommerNoeud'].includes(e.propertyName?.text ?? e.name.text))) liaisons.set(e.name.text, false)
      }
      else if (bindings && ts.isNamespaceImport(bindings)) liaisons.set(bindings.name.text, meta)
      if (node.importClause.name) liaisons.set(node.importClause.name.text, false)
    })
    let trouve = false
    const visiter = node => {
      if (ts.isCallExpression(node)) {
        let cible = node.expression
        const membre = ts.isPropertyAccessExpression(cible) ? cible.name.text : undefined
        while (ts.isPropertyAccessExpression(cible)) cible = cible.expression
        if (ts.isIdentifier(cible) && liaisons.has(cible.text) && !(liaisons.get(cible.text) && ['nommerChamps', 'nommerNoeud'].includes(membre))) trouve = true
      }
      if (!trouve) node.forEachChild(visiter)
    }
    visiter(entree.sf)
    return trouve
  }
  if (![...index.values()].some(candidat)) return index
  const textes = Object.fromEntries([...index.values()].map(e => [e.chemin, e.text]))
  let session
  const erreurs = []
  try {
    session = repoProgram(root, () => fichiers.map(f => path.resolve(f)), textes)
    const parFichier = new Map()
    for (const entree of index.values()) {
      if (!parFichier.has(entree.chemin)) {
        const source = session.program.getSourceFile(path.resolve(entree.chemin))
        if (!source) throw new Error(`indexerConstantes — source sémantique absente : ${entree.chemin}`)
        const contexte = contexteImports(source, session.checker)
        const formes = new Map()
        const composition = node => {
          if (ts.isParenthesizedExpression(node)) return composition(node.expression)
          if (!ts.isCallExpression(node)) return null
          let symbole = session.checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression)
          while (symbole?.flags & SymbolFlags.Alias) symbole = session.checker.getAliasedSymbol(symbole)
          const declaration = symbole?.valueDeclaration?.resolve()
          if (declaration && ts.isFunctionDeclaration(declaration) && declaration.name?.text === 'proseNommee' && path.relative(root, declaration.getSourceFile().fileName).replaceAll('\\', '/') === 'src/data/schemas/grammaire/prose.ts') return node
          if (ts.isPropertyAccessExpression(node.expression)) return composition(node.expression.expression)
          if (estAppelDeclare(node, source, { 'src/data/schemas/grammaire/meta.ts': ['nommerChamps', 'nommerNoeud'] }, contexte)) return composition(node.arguments[0])
          return null
        }
        const visiter = node => {
          const canon = composition(node)
          if (canon) {
            const type = session.checker.getTypeAtLocation(node)
            const zod = session.checker.getPropertyOfType(type, '_zod')
            const origine = zod?.declarations?.some(d => d.resolve().getSourceFile().fileName.replaceAll('\\', '/').includes('/node_modules/zod/'))
            const output = session.checker.getPropertyOfType(type, '_output')
            if (!origine || !output) throw new Error(`proprietesZod — composition canonique sans sortie Zod : ${node.getText(source)}`)
            const sortie = session.checker.getTypeOfSymbolAtLocation(output, node)
            if (sortie.flags & TypeFlags.Union) throw new Error(`proprietesZod — sortie composée en union non représentable : ${node.getText(source)}`)
            if (!(sortie.flags & TypeFlags.Object) || session.checker.isArrayType(sortie) || session.checker.isTupleType(sortie)) throw new Error(`proprietesZod — sortie composée non objet : ${node.getText(source)}`)
            const champs = session.checker.getPropertiesOfType(sortie).map(p => {
              const valeur = session.checker.getTypeOfSymbolAtLocation(p, node)
              return { nom: p.name, optionnel: !!(p.flags & SymbolFlags.Optional), typeSortie: session.checker.typeToString(valeur), literal: valeur.flags & TypeFlags.StringLiteral ? valeur.value : undefined }
            })
            if (!champs.length) throw new Error(`proprietesZod — sortie composée sans champs résolus : ${node.getText(source)}`)
            formes.set(`${node.pos}:${node.end}`, { champs, base: { pos: canon.arguments[0].pos, end: canon.arguments[0].end } })
          }
          node.forEachChild(visiter)
        }
        visiter(source)
        parFichier.set(entree.chemin, formes)
      }
      entree.formesFinales = parFichier.get(entree.chemin)
    }
  } catch (erreur) { erreurs.push(erreur) }
  finally { libererSessions(session ? [session] : [], erreurs) }
  return index
}

export function proprietesZod(node, entree) {
  const memeSource = entree && node.getSourceFile().text === entree.text && path.resolve(node.getSourceFile().fileName).toLowerCase() === path.resolve(entree.sf.fileName).toLowerCase()
  const final = memeSource ? entree.formesFinales?.get(`${node.pos}:${node.end}`) : undefined
  const retrouver = n => n.pos === final?.base.pos && n.end === final?.base.end ? n : n.forEachChild(retrouver)
  const base = noyauZod(final ? retrouver(node.getSourceFile()) : node, entree)
  if (!ts.isCallExpression(base) || !ts.isObjectLiteralExpression(base.arguments[0])) {
    throw new Error(`proprietesZod — forme d'objet zod illisible : ${node.getText(node.getSourceFile())}`)
  }
  const propres = []
  let precedent = base.arguments[0].properties.pos
  for (const p of base.arguments[0].properties) {
    if (ts.isSpreadAssignment(p)) propres.push({ spread: p.expression.getText(p.getSourceFile()) })
    else if (p.name) propres.push({ nom: p.name.getText(p.getSourceFile()).replace(/^['"]|['"]$/g, ''), init: p.initializer, optionnel: p.initializer ? estOptionnel(p.initializer, entree) : false, role: jsdocRole(p.getSourceFile().text.slice(precedent, p.getStart(p.getSourceFile()))) })
    precedent = p.end
  }
  if (!final) return propres
  const ordre = [...propres.filter(p => p.nom && final.champs.some(c => c.nom === p.nom)).map(p => p.nom), ...final.champs.filter(c => !propres.some(p => p.nom === c.nom)).map(c => c.nom)]
  return ordre.map(nom => ({ ...propres.find(p => p.nom === nom), ...final.champs.find(c => c.nom === nom) }))
}

/**
 * Déclaration RÉELLE d'une constante d'index dont l'initialiseur est un ACCÈS DE PROPRIÉTÉ
 * (`export const x = FAMILLE.x`, `mecaniqueDe`, `src/data/schemas/grammaire/mecanique.ts`) : le
 * vérificateur de types suit le membre jusqu'à la `const` qui le porte, à toute profondeur. Programme
 * sur le texte déjà lu de l'entrée, bibliothèque standard comprise, sans import (`virtualProgram`).
 * Rend `{ decl, statement, sf, text }` ; l'entrée elle-même si son initialiseur n'est pas un accès.
 */
function declarationReelle(entree, programmes) {
  const init = entree.decl.initializer
  if (!init || !ts.isPropertyAccessExpression(init)) return entree
  let programme = programmes.get(entree.chemin)
  if (!programme) {
    programme = virtualProgram({ [entree.chemin]: entree.text })
    programmes.set(entree.chemin, programme)
  }
  const checker = programme.checker
  const sf = programme.program.getSourceFile(path.resolve(VIRTUAL_ROOT, entree.chemin))
  const trouver = (n) => (n.pos === init.pos && n.end === init.end && ts.isPropertyAccessExpression(n) ? n : n.forEachChild(trouver))
  let acces = trouver(sf)
  if (!acces) throw new Error(`declarationReelle — l'accès « ${init.getText()} » de « ${entree.decl.name.getText()} » est introuvable dans le programme de ${entree.chemin}`)
  for (;;) {
    let symbole = checker.getSymbolAtLocation(acces.name)
    const porteur = symbole?.declarations?.[0]?.resolve()
    if (porteur && ts.isShorthandPropertyAssignment(porteur)) symbole = checker.getShorthandAssignmentValueSymbol(porteur)
    else if (porteur && ts.isPropertyAssignment(porteur) && ts.isIdentifier(porteur.initializer)) symbole = checker.getSymbolAtLocation(porteur.initializer)
    const decl = symbole?.valueDeclaration?.resolve()
    if (!decl || !ts.isVariableDeclaration(decl) || !ts.isVariableStatement(decl.parent.parent)) return null
    if (decl.initializer && ts.isPropertyAccessExpression(decl.initializer)) { acces = decl.initializer; continue }
    const source = decl.getSourceFile()
    return { decl, statement: decl.parent.parent, sf: source, text: source.text, chemin: entree.chemin, decorateursZod: entree.decorateursZod, formesFinales: entree.formesFinales }
  }
}

/**
 * Membres d'un `z.discriminatedUnion(discriminant, [ … ])` déclaré sous le nom `alias`.
 * `index` vient d'`indexerConstantes` (le socle des fichiers où vivent les schémas de membre).
 * Rend `{ rows, rawCount }` — même forme que `readUnionMembers`.
 */
export function readZodUnionMembers(index, alias, discriminant, tool, opts = {}) {
  const entree = index.get(alias)
  if (!entree) {
    console.error(`${tool} — schéma « ${alias} » introuvable`)
    process.exit(1)
  }
  const appel = noyauZod(entree.decl.initializer, entree)
  if (!ts.isCallExpression(appel) || !ts.isArrayLiteralExpression(appel.arguments[1])) {
    console.error(`${tool} — « ${alias} » n'est pas un z.discriminatedUnion(…, [ … ])`)
    process.exit(1)
  }
  const membres = appel.arguments[1].elements
  const programmes = new Map()
  const erreurs = []
  try {

    const rows = []
    for (const m of membres) {
      if (!ts.isIdentifier(m)) {
        throw new Error(`${tool} — membre de « ${alias} » qui n'est pas un identifiant de schéma (kind ${ts.SyntaxKind[m.kind]})`)
      }
      const entree = index.get(m.text)
      const cible = entree && declarationReelle(entree, programmes)
      if (!cible) {
        throw new Error(`${tool} — membre « ${m.text} » de « ${alias} » : schéma introuvable dans les fichiers indexés`)
      }
      const proprietes = proprietesZod(cible.decl.initializer, cible)
      let name = null
      const fields = []
      for (const prop of proprietes) {
        if (prop.spread) {
          fields.push(`...${opts.nomsDeSpread?.[prop.spread] ?? prop.spread}`)
          continue
        }
        const pname = prop.nom
        if (!pname) continue
        const litt = prop.init
        if (pname === discriminant && prop.literal !== undefined) { name = prop.literal; continue }
        if (pname === discriminant && litt && ts.isCallExpression(litt) && ts.isStringLiteral(litt.arguments[0])) {
          name = litt.arguments[0].text
          continue
        }
        fields.push(pname + (prop.optionnel ? '?' : ''))
      }
      if (!name) {
        throw new Error(`${tool} — membre « ${m.text} » sans « ${discriminant}: z.literal('…') »`)
      }
      const role = jsdocRole(cible.text.slice(cible.statement.getFullStart(), cible.statement.getStart(cible.sf)))
      rows.push({ name, fieldGroups: [fields], role })
    }

    const merged = []
    const byName = new Map()
    for (const r of rows) {
      const existing = byName.get(r.name)
      if (existing) {
        existing.fieldGroups.push(...r.fieldGroups)
        if (!existing.role && r.role) existing.role = r.role
      } else {
        const copy = { name: r.name, fieldGroups: [...r.fieldGroups], role: r.role }
        byName.set(r.name, copy)
        merged.push(copy)
      }
    }
    return { rows: merged, rawCount: membres.length }
  } catch (erreur) { erreurs.push(erreur) }
  finally {
    try { libererSessions(programmes.values(), erreurs) }
    finally { programmes.clear() }
  }
}
