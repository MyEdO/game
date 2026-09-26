// Socle PARTAGÉ des générateurs de doc « vocabulaire » (#298bis) : lecture d'une union discriminée
// TypeScript par AST (`ts.createSourceFile` — jamais de regex sur les accolades, les unions imbriquent
// des littéraux d'objet et des intersections), extraction du JSDoc de chaque membre, et écriture/
// vérification du .md généré. Consommé par scripts/docs/build-effects.mjs (union `Effect` de
// src/state/scene.ts) et scripts/docs/build-vocabulaire.mjs (unions `GameOp` de src/engine/ops.ts,
// `Condition`/`Flow`/`EffectTrigger`/`EffectTargeting` de src/engine/flowCore.ts).
import ts from 'typescript'
import { readFileSync, existsSync } from 'node:fs'
import { apercuDivergences, ecrireDoc, retirerPied } from './empreinte-sources.mjs'

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
export function loadSource(path) {
  const text = readFileSync(path, 'utf8')
  return { text, sf: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true) }
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
      if (!ts.isPropertySignature(prop)) continue
      const pname = prop.name.getText(sf)
      if (pname === discriminant && prop.type && ts.isLiteralTypeNode(prop.type) && ts.isStringLiteral(prop.type.literal)) {
        name = prop.type.literal.text
        continue
      }
      if (estExclusion(prop)) continue
      fields.push(pname + (prop.questionToken ? '?' : ''))
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

/**
 * Écrit le .md — ou, en mode `--check` (chaîné dans `npm run docs:check`), régénère en mémoire,
 * compare au committé et sort en erreur ACTIONNABLE. Jamais d'écriture en mode `--check`.
 * C'est la garde d'exhaustivité : une entrée ajoutée à l'union sans régénération = CI rouge.
 * Le rouge NOMME sa cause : `apercuDivergences` imprime la première divergence et l'aperçu borné
 * des suivantes, des deux côtés — un « PÉRIMÉ » seul se diagnostique de mémoire.
 */
export function emitOrCheck({ out, path, check, staleMsg, rerunMsg, okMsg, writeMsg }) {
  if (check) {
    // Le pied « sources-empreinte » est posé APRÈS coup par build-all.mjs (#1679 L1b) : le générateur
    // ne le connaît pas, la comparaison porte donc sur le corps.
    const current = existsSync(path) ? retirerPied(readFileSync(path, 'utf8')) : null
    if (current !== out) {
      console.error(staleMsg)
      console.error(apercuDivergences(out, current))
      console.error(rerunMsg)
      process.exit(1)
    }
    console.log(okMsg)
  } else {
    ecrireDoc(path, out)
    console.log(writeMsg)
  }
}

// ── Lecture d'une union discriminée exprimée en SCHÉMAS zod ──────────────────────────────────────
// Même contrat que `readUnionMembers` (rendre `[{ name, fieldGroups, role }]` dans l'ordre de
// l'union), mais la source est un `z.discriminatedUnion('type', [ …identifiants… ])` dont chaque
// membre est un `export const xSchema = z.strictObject({ … })` porteur de son JSDoc.

/** Déballe `z.lazy(() => X)`, `X.superRefine(…)`, `X.optional()`… jusqu'à l'appel `z.strictObject`. */
function noyauZod(node) {
  if (ts.isArrowFunction(node)) return noyauZod(node.body)
  if (ts.isParenthesizedExpression(node)) return noyauZod(node.expression)
  if (ts.isCallExpression(node)) {
    const cible = node.expression
    if (ts.isPropertyAccessExpression(cible)) {
      const membre = cible.name.text
      if (membre === 'lazy') return noyauZod(node.arguments[0])
      if (membre === 'strictObject' || membre === 'object' || membre === 'looseObject' || membre === 'discriminatedUnion') return node
      return noyauZod(cible.expression) // .superRefine(…), .optional(), .refine(…)
    }
  }
  return node
}

// eslint-disable-next-line no-irregular-whitespace
/** Le membre est-il OPTIONNEL ? (`…​.optional()` quelque part dans la chaîne d'appels). */
function estOptionnel(node) {
  let n = node
  while (ts.isCallExpression(n)) {
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
  for (const chemin of fichiers) {
    const { text, sf } = loadSource(chemin)
    sf.forEachChild((node) => {
      if (!ts.isVariableStatement(node)) return
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) index.set(d.name.text, { statement: node, decl: d, sf, text, chemin })
      }
    })
  }
  return index
}

/**
 * Déclaration RÉELLE d'une constante d'index dont l'initialiseur est un ACCÈS DE PROPRIÉTÉ
 * (`export const x = FAMILLE.x`, `mecaniqueDe`, `src/data/schemas/grammaire/mecanique.ts`) : le
 * vérificateur de types suit le membre jusqu'à la `const` qui le porte, à toute profondeur. Programme
 * restreint au fichier de l'entrée (`noResolve`) : seule la bibliothèque standard s'y ajoute.
 * Rend `{ decl, statement, sf, text }` ; l'entrée elle-même si son initialiseur n'est pas un accès.
 */
function declarationReelle(entree, programmes) {
  const init = entree.decl.initializer
  if (!init || !ts.isPropertyAccessExpression(init)) return entree
  let programme = programmes.get(entree.chemin)
  if (!programme) {
    programme = ts.createProgram({
      rootNames: [entree.chemin],
      options: { noResolve: true, noEmit: true, target: ts.ScriptTarget.ES2022, skipLibCheck: true },
    })
    programmes.set(entree.chemin, programme)
  }
  const checker = programme.getTypeChecker()
  const sf = programme.getSourceFile(entree.chemin)
  const trouver = (n) => (n.pos === init.pos && n.end === init.end && ts.isPropertyAccessExpression(n) ? n : ts.forEachChild(n, trouver))
  let acces = trouver(sf)
  if (!acces) throw new Error(`declarationReelle — l'accès « ${init.getText()} » de « ${entree.decl.name.getText()} » est introuvable dans le programme de ${entree.chemin}`)
  for (;;) {
    let symbole = checker.getSymbolAtLocation(acces.name)
    const porteur = symbole?.declarations?.[0]
    if (porteur && ts.isShorthandPropertyAssignment(porteur)) symbole = checker.getShorthandAssignmentValueSymbol(porteur)
    else if (porteur && ts.isPropertyAssignment(porteur) && ts.isIdentifier(porteur.initializer)) symbole = checker.getSymbolAtLocation(porteur.initializer)
    const decl = symbole?.valueDeclaration
    if (!decl || !ts.isVariableDeclaration(decl) || !ts.isVariableStatement(decl.parent.parent)) return null
    if (decl.initializer && ts.isPropertyAccessExpression(decl.initializer)) { acces = decl.initializer; continue }
    return { decl, statement: decl.parent.parent, sf: decl.getSourceFile(), text: decl.getSourceFile().text }
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
  const appel = noyauZod(entree.decl.initializer)
  if (!ts.isCallExpression(appel) || !ts.isArrayLiteralExpression(appel.arguments[1])) {
    console.error(`${tool} — « ${alias} » n'est pas un z.discriminatedUnion(…, [ … ])`)
    process.exit(1)
  }
  const membres = appel.arguments[1].elements
  const programmes = new Map()

  const rows = []
  for (const m of membres) {
    if (!ts.isIdentifier(m)) {
      console.error(`${tool} — membre de « ${alias} » qui n'est pas un identifiant de schéma (kind ${ts.SyntaxKind[m.kind]})`)
      process.exit(1)
    }
    const entree = index.get(m.text)
    const cible = entree && declarationReelle(entree, programmes)
    if (!cible) {
      console.error(`${tool} — membre « ${m.text} » de « ${alias} » : schéma introuvable dans les fichiers indexés`)
      process.exit(1)
    }
    const objet = noyauZod(cible.decl.initializer)
    if (!ts.isCallExpression(objet) || !ts.isObjectLiteralExpression(objet.arguments[0])) {
      console.error(`${tool} — membre « ${m.text} » : forme d'objet zod illisible`)
      process.exit(1)
    }
    let name = null
    const fields = []
    for (const prop of objet.arguments[0].properties) {
      if (ts.isSpreadAssignment(prop)) {
        fields.push(`...${opts.nomsDeSpread?.[prop.expression.getText(cible.sf)] ?? prop.expression.getText(cible.sf)}`)
        continue
      }
      const pname = prop.name?.getText(cible.sf)
      if (!pname) continue
      if (ts.isGetAccessorDeclaration(prop)) { fields.push(pname); continue }
      if (!ts.isPropertyAssignment(prop)) continue
      const litt = prop.initializer
      if (pname === discriminant && ts.isCallExpression(litt) && ts.isStringLiteral(litt.arguments[0])) {
        name = litt.arguments[0].text
        continue
      }
      fields.push(pname + (estOptionnel(litt) ? '?' : ''))
    }
    if (!name) {
      console.error(`${tool} — membre « ${m.text} » sans « ${discriminant}: z.literal('…') »`)
      process.exit(1)
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
}
