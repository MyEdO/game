// LES VERBES DE LA PARTIE (#2898 lot C), lus du TYPE que `Partie.envoyer` accepte : `Intention` porte
// `Parameters<ActionsDuNoyau[K]>` (src/noyau/partie.ts), donc chaque membre de l'interface `ActionsDuNoyau`
// (src/noyau/actionsDuNoyau.ts, `VerbesDeJet` compris) est un verbe, et la signature de son appel
// donne ses paramètres. Le vérificateur de types résout chaque paramètre en une FORME JSON (`Forme`,
// src/hote/formes.ts) : la même lecture sert la table du doc (scripts/docs/build-hote-texte.mjs) et la
// validation des arguments d'un verbe (src/hote/verbes.generated.ts, scripts/gen-verbes.mjs). Aucune forme écrite à la main.
// Un paramètre (ou un champ) dont la DÉCLARATION nomme une clé de `DESIGNATIONS` (src/noyau/designations.ts) porte
// ce nom et son mot dans sa forme (`designe`) : un alias de `string` ne survit pas au type résolu, il se lit au nœud déclaré.
// Le verbe qui règle un jet (`jetRegler`, #3368) prend la valeur de chaque réglage de `ReglagesDuJet`
// (src/noyau/reglagesDuJet.ts), le verbe qui choisit dans une fenêtre (`fenetreChoisir`, #3369) celle de chaque axe de
// `ChoixDesFenetres` (src/noyau/choixDesFenetres.ts) : la même lecture donne la forme de chacune (`REGLAGES`, `CHOIX`),
// que l'hôte contrôle.
import path from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { SignatureKind, SymbolFlags, TypeFlags } from 'typescript/unstable/sync'
import { repoProgram, libererSessions } from '../../guards/lib/tsProgram.mjs'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'

const SOURCE = 'src/noyau/actionsDuNoyau.ts'
const INTERFACE = 'ActionsDuNoyau'
const SOURCE_DESIGNATIONS = 'src/noyau/designations.ts'
const TABLE_DESIGNATIONS = 'DESIGNATIONS'
const SOURCE_REGLAGES = 'src/noyau/reglagesDuJet.ts'
const INTERFACE_REGLAGES = 'ReglagesDuJet'
const SOURCE_CHOIX = 'src/noyau/choixDesFenetres.ts'
const INTERFACE_CHOIX = 'ChoixDesFenetres'
/** Nombre de littéraux au-delà duquel une union de littéraux (un id du catalogue) se contrôle par son genre primitif :
 *  le verbe du noyau refuse lui-même un id inconnu. */
const LITTERAUX_ENUMERES = 16
/** Longueur au-delà de laquelle un type anonyme ne s'écrit plus déplié, mais par son genre. */
const LONGUEUR_D_UN_NOM = 40

/** Le NOM d'un type : son alias (`Flow`), son interface ou sa classe (`Scene`), sinon son écriture courte ; un type
 *  anonyme long s'écrit par son genre (`objet`, `fonction`), jamais déplié. */
function nomDuType(checker, type) {
  const nomme = type.getAliasSymbol()?.name ?? type.getSymbol()?.name
  if (nomme && !nomme.startsWith('__')) return nomme
  const ecrit = checker.typeToString(type)
  if (ecrit.length <= LONGUEUR_D_UN_NOM) return ecrit
  if (!(type.flags & TypeFlags.Object)) return 'type'
  return checker.getSignaturesOfType(type, SignatureKind.Call).length ? 'fonction' : 'objet'
}

/** Le nœud de type DÉCLARÉ d'un symbole (paramètre, champ), s'il en a un. */
const typeDeclare = (symbole) => symbole.valueDeclaration?.resolve()?.type

/** Les désignations de la table `DESIGNATIONS`, lues à son source : le nom de chaque entrée et son `mot` littéral. */
function nomsDesignes(session, racine) {
  const fichier = path.resolve(racine, SOURCE_DESIGNATIONS).replaceAll('\\', '/')
  const sf = session.program.getSourceFile(fichier)
  if (!sf) throw new Error(`verbesDeLaPartie : ${SOURCE_DESIGNATIONS} hors du programme de ${SOURCE}`)
  let table
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === TABLE_DESIGNATIONS) table = d
  })
  if (!table) throw new Error(`verbesDeLaPartie : table \`${TABLE_DESIGNATIONS}\` introuvable dans ${SOURCE_DESIGNATIONS}`)
  const objet = ts.isSatisfiesExpression(table.initializer) ? table.initializer.expression : table.initializer
  if (!ts.isObjectLiteralExpression(objet)) throw new Error(`verbesDeLaPartie : \`${TABLE_DESIGNATIONS}\` n'est pas un objet littéral`)
  return new Map(objet.properties.filter(ts.isPropertyAssignment).map((p) => {
    const champ = ts.isObjectLiteralExpression(p.initializer) && p.initializer.properties.find((c) => ts.isPropertyAssignment(c) && ts.isIdentifier(c.name) && c.name.text === 'mot')
    if (!champ || !ts.isStringLiteral(champ.initializer)) throw new Error(`verbesDeLaPartie : \`${TABLE_DESIGNATIONS}.${p.name.text}\` sans \`mot\` littéral`)
    return [p.name.text, champ.initializer.text]
  }))
}

/** La forme `f` annotée du nom de désignation que son nœud déclaré écrit : une référence à une clé de la table sur
 *  une chaîne, à travers parenthèses, `readonly`, tableaux et unions. */
function designee(f, noeud, designes) {
  if (!noeud) return f
  if (ts.isParenthesizedTypeNode(noeud) || ts.isTypeOperatorNode(noeud)) return designee(f, noeud.type, designes)
  if (ts.isArrayTypeNode(noeud)) return f.genre === 'tableau' ? { ...f, element: designee(f.element, noeud.elementType, designes) } : f
  if (ts.isTypeReferenceNode(noeud)) {
    const nom = ts.isIdentifier(noeud.typeName) ? noeud.typeName.text : null
    return nom && designes.has(nom) && f.genre === 'chaine' ? { ...f, designe: { cle: nom, mot: designes.get(nom) } } : f
  }
  if (ts.isUnionTypeNode(noeud)) {
    const designants = noeud.types.filter((t) => designee({ genre: 'chaine' }, t, designes).designe)
    if (designants.length !== 1) return f
    return f.genre === 'union' ? { ...f, membres: f.membres.map((m) => designee(m, designants[0], designes)) } : designee(f, designants[0], designes)
  }
  return f
}

/** La forme JSON de `type`, à toute profondeur : un objet déjà ouvert sur le chemin (`pile`), un dictionnaire ou un
 *  objet hors désignation (`formeDeclaree`) ne contrôle que d'être un objet. */
function forme(checker, type, designes, pile = new Set()) {
  const f = type.flags
  if (f & (TypeFlags.Any | TypeFlags.Unknown)) return { genre: 'libre', type: nomDuType(checker, type) }
  if (f & TypeFlags.StringLiteral) return { genre: 'litteral', valeur: type.value }
  if (f & TypeFlags.NumberLiteral) return { genre: 'litteral', valeur: type.value }
  if (f & TypeFlags.BooleanLiteral) return { genre: 'litteral', valeur: checker.typeToString(type) === 'true' }
  if (f & TypeFlags.StringLike) return { genre: 'chaine' }
  if (f & TypeFlags.NumberLike) return { genre: 'nombre' }
  if (f & TypeFlags.BooleanLike) return { genre: 'booleen' }
  if (f & TypeFlags.Null) return { genre: 'null' }
  if (f & (TypeFlags.Undefined | TypeFlags.Void)) return { genre: 'absent' }
  if (type.isUnionType()) return unionDe(type.getTypes().map((t) => forme(checker, t, designes, pile)), type.getAliasSymbol()?.name)
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const [element] = type.isTypeReference() ? checker.getTypeArguments(type) : []
    return { genre: 'tableau', element: element ? forme(checker, element, designes, pile) : { genre: 'libre', type: '?' } }
  }
  if (f & TypeFlags.Object) {
    if (checker.getSignaturesOfType(type, SignatureKind.Call).length) return { genre: 'libre', type: nomDuType(checker, type) }
    if (pile.has(type) || checker.getIndexInfosOfType(type).length) return { genre: 'objet', type: nomDuType(checker, type), champs: null }
    const dedans = new Set(pile).add(type)
    const champs = checker.getPropertiesOfType(type).map((p) => ({
      nom: p.name,
      optionnel: !!(p.flags & SymbolFlags.Optional),
      forme: formeDeclaree(checker, checker.getTypeOfSymbol(p), typeDeclare(p), designes, dedans),
    }))
    return { genre: 'objet', type: nomDuType(checker, type), champs }
  }
  return { genre: 'libre', type: nomDuType(checker, type) }
}

/** La forme de l'union des formes `membres` (aplaties, chacune une fois), nommée `alias` s'il y en a un. */
function unionDe(membresBruts, alias) {
  const vus = new Map()
  for (const m of membresBruts.flatMap((m) => (m.genre === 'union' ? m.membres : [m]))) vus.set(JSON.stringify(m), m)
  const membres = [...vus.values()]
  // `boolean` est l'union `true | false` : il se lit d'un mot.
  const booleens = membres.filter((m) => m.genre === 'litteral' && typeof m.valeur === 'boolean').length
  const reste = booleens === 2 ? [{ genre: 'booleen' }, ...membres.filter((m) => !(m.genre === 'litteral' && typeof m.valeur === 'boolean'))] : membres
  if (reste.length === 1) return reste[0]
  const litteraux = reste.filter((m) => m.genre === 'litteral')
  if (litteraux.length > LITTERAUX_ENUMERES) {
    const genres = [...new Set(litteraux.map((m) => (typeof m.valeur === 'number' ? 'nombre' : 'chaine')))].map((genre) => ({ genre }))
    const autres = reste.filter((m) => m.genre !== 'litteral' && !genres.some((g) => g.genre === m.genre && Object.keys(m).length === 1))
    const membresReduits = [...genres, ...autres]
    return membresReduits.length === 1 ? membresReduits[0] : { genre: 'union', membres: membresReduits, ...(alias ? { type: alias } : {}) }
  }
  return { genre: 'union', membres: reste, ...(alias ? { type: alias } : {}) }
}

/** L'alias de ce qu'un verbe reçoit entier sans le désigner (`actionsDuNoyau.ts`) : le noyau en juge chaque champ. */
const HORS_DESIGNATION = 'HorsDesignation'

/** Le nœud `noeud`, sans parenthèses, référence-t-il `HorsDesignation<…>` ? */
function horsDesignation(noeud) {
  while (noeud && ts.isParenthesizedTypeNode(noeud)) noeud = noeud.type
  return !!noeud && ts.isTypeReferenceNode(noeud) && ts.isIdentifier(noeud.typeName) && noeud.typeName.text === HORS_DESIGNATION
}

/** La forme d'un champ, d'un paramètre ou d'un axe de type `type`, déclaré par `noeud` : sans son membre `absent`,
 *  annotée de sa désignation (`designee`) ; un objet `HorsDesignation` ne contrôle que d'être un objet. */
function formeDeclaree(checker, type, noeud, designes, pile) {
  const f = sansAbsent(forme(checker, type, designes, pile))
  if (horsDesignation(noeud)) return f.genre === 'objet' ? { ...f, champs: null } : f
  return designee(f, noeud, designes)
}

/** Une forme sans son membre `absent` : l'optionnalité se porte par le drapeau du champ ou du paramètre. */
function sansAbsent(f) {
  if (f.genre !== 'union') return f
  const membres = f.membres.filter((m) => m.genre !== 'absent')
  return membres.length === 1 ? membres[0] : { ...f, membres }
}

/** Un paramètre est optionnel par son drapeau, ou parce que son type admet `undefined` (`entry?: string`). */
const admetAbsent = (f) => f.genre === 'absent' || (f.genre === 'union' && f.membres.some((m) => m.genre === 'absent'))

/** Le paramètre `q` d'une signature, lu à son type et à son nœud déclaré. */
function parametre(checker, q, designes) {
  const type = checker.getTypeOfSymbol(q)
  return {
    nom: q.name,
    optionnel: !!(q.flags & SymbolFlags.Optional) || admetAbsent(forme(checker, type, designes)),
    type: nomDuType(checker, type),
    forme: formeDeclaree(checker, type, typeDeclare(q), designes),
  }
}

/** Le tuple nommé que déclare l'alias du nœud de type `noeud` (`...args: ArgumentsDuReglage`) : ses membres, dans
 *  l'ordre ; `null` : aucun. */
function tupleDeclare(checker, noeud) {
  if (!noeud || !ts.isTypeReferenceNode(noeud)) return null
  const alias = checker.getSymbolAtLocation(noeud.typeName)?.declarations?.[0]?.resolve()
  let tuple = null
  const chercher = (n) => { if (!tuple && ts.isTupleTypeNode(n)) tuple = n; else if (!tuple) n.forEachChild(chercher) }
  if (alias) chercher(alias)
  return tuple && tuple.elements.every(ts.isNamedTupleMember) ? tuple.elements : null
}

/** Les paramètres d'un verbe dont l'unique paramètre est le reste d'une union de tuples nommés (`jetRegler`) : un
 *  paramètre par position, nommé par le tuple que l'alias déclare, sa forme l'union des formes de la position, son type
 *  écrit celui de la position (`ArgumentsDuReglage[2]`) quand les tuples y diffèrent. */
function parametresDuReste(checker, q, designes) {
  const declare = q.valueDeclaration?.resolve()
  if (!declare?.dotDotDotToken) return null
  const membres = tupleDeclare(checker, declare.type)
  const type = checker.getTypeOfSymbol(q)
  const tuples = type.isUnionType() ? type.getTypes() : [type]
  if (!membres || !tuples.every((t) => checker.isTupleType(t))) return null
  return membres.map((m, i) => {
    const types = tuples.map((t) => checker.getTypeOfSymbol(checker.getPropertyOfType(t, String(i))))
    const f = unionDe(types.map((t) => forme(checker, t, designes)))
    const ecrits = [...new Set(types.map((t) => nomDuType(checker, t)))]
    return { nom: m.name.text, optionnel: !!m.questionToken || admetAbsent(f), type: ecrits.length === 1 ? ecrits[0] : `${declare.type.typeName.text}[${i}]`, forme: designee(sansAbsent(f), m.type, designes) }
  })
}

/** L'alias d'un texte que le joueur écrit (`actionsDuNoyau.ts`) : la seule chaîne qu'aucune désignation ne nomme. */
const TEXTE_LIBRE = 'TexteLibre'

/** Le nom d'une référence de type (`IdDeHeros`, `tavernFlow.ReglageDePartie` → `ReglageDePartie`). */
const nomDeReference = (noeud) => (ts.isIdentifier(noeud.typeName) ? noeud.typeName.text : noeud.typeName.right.text)

/** Le nœud `noeud` sans parenthèses ni `readonly`, et, à travers chaque alias non générique qu'il référence hors des
 *  désignations, le type que l'alias écrit. */
function noeudDeplie(checker, noeud, designes) {
  while (noeud) {
    if (ts.isParenthesizedTypeNode(noeud) || ts.isTypeOperatorNode(noeud)) { noeud = noeud.type; continue }
    if (!ts.isTypeReferenceNode(noeud) || noeud.typeArguments?.length) return noeud
    const nom = nomDeReference(noeud)
    if (designes.has(nom) || nom === TEXTE_LIBRE) return noeud
    const alias = checker.getSymbolAtLocation(ts.isIdentifier(noeud.typeName) ? noeud.typeName : noeud.typeName.right)?.declarations?.[0]?.resolve()
    if (!alias || !ts.isTypeAliasDeclaration(alias) || alias.typeParameters?.length) return noeud
    noeud = alias.type
  }
  return noeud
}

/** Le nœud de l'élément d'un nœud de tableau (`X[]`, `Array<X>`, `ReadonlyArray<X>`). */
const elementDuNoeud = (noeud) => (!noeud ? undefined
  : ts.isArrayTypeNode(noeud) ? noeud.elementType
  : ts.isTypeReferenceNode(noeud) && noeud.typeArguments?.length === 1 ? noeud.typeArguments[0] : undefined)

/** Les chemins de `type` (déclaré par `noeud` quand il est connu) où une chaîne n'est nommée par aucune désignation ni
 *  par `TexteLibre`, à toute profondeur : champs, éléments, membres d'union, valeurs de dictionnaire. */
function chainesNuesDuType(checker, type, noeud, chemin, designes, vus, nues) {
  const deplie = noeudDeplie(checker, noeud, designes)
  if (horsDesignation(deplie)) return
  if (deplie && ts.isTypeReferenceNode(deplie) && !deplie.typeArguments?.length) {
    const nom = nomDeReference(deplie)
    if (designes.has(nom) || nom === TEXTE_LIBRE) return
  }
  if (!type) throw new Error(`chainesNues : type introuvable à ${chemin} (${deplie ? ts.SyntaxKind[deplie.kind] : '-'})`)
  const f = type.flags
  if (f & (TypeFlags.String | TypeFlags.TemplateLiteral | TypeFlags.StringMapping)) { nues.push(chemin); return }
  if (type.isUnionType() || type.isIntersectionType?.() && !(f & TypeFlags.Object)) {
    if (type.isUnionType() && deplie && ts.isUnionTypeNode(deplie)) {
      for (const m of deplie.types) chainesNuesDuType(checker, checker.getTypeFromTypeNode(m), m, chemin, designes, vus, nues)
      return
    }
    if (type.isUnionType()) {
      for (const t of type.getTypes()) chainesNuesDuType(checker, t, t.flags & (TypeFlags.Undefined | TypeFlags.Null) ? undefined : deplie, chemin, designes, vus, nues)
      return
    }
  }
  if (!(f & TypeFlags.Object) && !type.isIntersectionType?.()) return
  if (checker.getSignaturesOfType(type, SignatureKind.Call).length) return
  if (checker.isTupleType(type)) {
    const elements = deplie && ts.isTupleTypeNode(deplie) ? deplie.elements.map((e) => (ts.isNamedTupleMember(e) ? e.type : e)) : []
    checker.getTypeArguments(type).forEach((t, i) => chainesNuesDuType(checker, t, elements[i], `${chemin}[${i}]`, designes, vus, nues))
    return
  }
  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type)
    if (element) chainesNuesDuType(checker, element, elementDuNoeud(deplie), `${chemin}[]`, designes, vus, nues)
    return
  }
  const cle = `${checker.typeToString(type)}@${chemin.split('(')[0]}`
  if (vus.has(type) || vus.has(cle)) return
  vus.add(type); vus.add(cle)
  for (const info of checker.getIndexInfosOfType(type)) {
    if (info.keyType.flags & TypeFlags.String) nues.push(`${chemin}[clé]`)
    chainesNuesDuType(checker, info.valueType, undefined, `${chemin}[…]`, designes, vus, nues)
  }
  for (const p of checker.getPropertiesOfType(type)) chainesNuesDuType(checker, checker.getTypeOfSymbol(p), typeDeclare(p), `${chemin}.${p.name}`, designes, vus, nues)
}

/** Les chemins, dans chaque paramètre de chaque verbe de `decl` (membres hérités compris : verbes de jet, `jetRegler`,
 *  `fenetreChoisir`) et dans la valeur de chaque axe de `ReglagesDuJet` et `ChoixDesFenetres`, où une chaîne n'est
 *  nommée par aucune désignation : ce qui existe se désigne par son `IdDe…` (`DESIGNATIONS`), un texte du joueur par
 *  `TexteLibre`, ce que le geste crée par `HorsDesignation` (`.claude/rules/verbes-du-noyau.md`), à toute
 *  profondeur. */
function chainesNues(session, racine, decl, designes) {
  const { checker } = session
  const nues = []
  for (const p of checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name))) {
    const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(p), SignatureKind.Call)
    for (const q of signature?.getParameters() ?? []) {
      const declare = q.valueDeclaration?.resolve()
      const membres = declare?.dotDotDotToken ? tupleDeclare(checker, declare.type) : null
      const type = checker.getTypeOfSymbol(q)
      if (!membres) { chainesNuesDuType(checker, type, declare?.type, `${p.name}(${q.name})`, designes, new Set(), nues); continue }
      // Le reste d'une union de tuples nommés (`ArgumentsDuReglage`, `ArgumentsDuChoix`) : chaque position, par le nœud
      // que le tuple déclare ; la valeur d'un axe (`ReglagesDuJet[F][K]`) se lit à son interface, ci-dessous.
      const tuples = type.isUnionType() ? type.getTypes() : [type]
      membres.forEach((m, i) => {
        if (ts.isIndexedAccessTypeNode(m.type)) return
        for (const t of tuples) chainesNuesDuType(checker, checker.getTypeOfSymbol(checker.getPropertyOfType(t, String(i))), m.type, `${p.name}(${m.name.text})`, designes, new Set(), nues)
      })
    }
  }
  for (const [source, nom] of [[SOURCE_REGLAGES, INTERFACE_REGLAGES], [SOURCE_CHOIX, INTERFACE_CHOIX]]) {
    const axes = interfaceDe(session, racine, source, nom)
    for (const flux of checker.getPropertiesOfType(checker.getTypeAtLocation(axes.name))) {
      for (const r of checker.getPropertiesOfType(checker.getTypeOfSymbol(flux))) chainesNuesDuType(checker, checker.getTypeOfSymbol(r), typeDeclare(r), `${nom}.${flux.name}.${r.name}`, designes, new Set(), nues)
    }
  }
  return [...new Set(nues)]
}

/** L'interface `nom` du fichier `source` du programme. */
function interfaceDe(session, racine, source, nom) {
  const sf = session.program.getSourceFile(path.resolve(racine, source).replaceAll('\\', '/'))
  let decl
  sf?.forEachChild((n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === nom) decl = n })
  if (!decl) throw new Error(`verbesDeLaPartie : interface \`${nom}\` introuvable dans ${source}`)
  return decl
}

/** Les axes de chaque clé de l'interface `nom` du fichier `source` (les réglages de chaque flux de jet, `ReglagesDuJet` ;
 *  les choix de chaque fenêtre, `ChoixDesFenetres`) : la forme de la valeur de chacun. */
function axesLus(session, racine, designes, source, nom) {
  const { checker } = session
  const decl = interfaceDe(session, racine, source, nom)
  return Object.fromEntries(checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name)).map((flux) => [
    flux.name,
    Object.fromEntries(checker.getPropertiesOfType(checker.getTypeOfSymbol(flux)).map((r) => [r.name, formeDeclaree(checker, checker.getTypeOfSymbol(r), typeDeclare(r), designes)])),
  ]))
}

/** La partie lue de son type : ses verbes, par nom, ou les seuls `noms`, leurs paramètres dans l'ordre de l'appel
 *  (`ParametreDeVerbe`, src/hote/formes.ts), et la forme de la valeur de chaque réglage de jet et de chaque choix de
 *  fenêtre. */
export function partieLue(racine = process.cwd(), noms = null) {
  const fichier = path.resolve(racine, SOURCE).replaceAll('\\', '/')
  const session = repoProgram(racine, () => [fichier])
  try {
    const decl = interfaceDe(session, racine, SOURCE, INTERFACE)
    const { checker } = session
    const designes = nomsDesignes(session, racine)
    const verbes = {}
    const nues = chainesNues(session, racine, decl, designes)
    if (nues.length) throw new Error(`verbesDeLaPartie : ${INTERFACE} écrit \`string\` nu (un id se désigne par son \`IdDe…\` de ${SOURCE_DESIGNATIONS}, un texte du joueur par \`TexteLibre\`, ce que le geste crée par \`HorsDesignation\`) : ${nues.join(', ')}`)
    for (const p of checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name))) {
      if (noms && !noms.includes(p.name)) continue
      const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(p), SignatureKind.Call)
      if (!signature) continue
      const qs = signature.getParameters()
      verbes[p.name] = (qs.length === 1 && parametresDuReste(checker, qs[0], designes)) || qs.map((q) => parametre(checker, q, designes))
    }
    return {
      verbes: Object.fromEntries(Object.entries(verbes).sort(([a], [b]) => parUnitesDeCode(a, b))),
      reglages: axesLus(session, racine, designes, SOURCE_REGLAGES, INTERFACE_REGLAGES),
      choix: axesLus(session, racine, designes, SOURCE_CHOIX, INTERFACE_CHOIX),
    }
  } finally {
    libererSessions([session])
  }
}

/** Les verbes de la partie (`partieLue`). */
export const verbesDeLaPartie = (racine = process.cwd(), noms = null) => partieLue(racine, noms).verbes
