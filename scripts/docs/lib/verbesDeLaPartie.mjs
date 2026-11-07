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
/** Profondeur de résolution d'un objet : au-delà, l'objet ne contrôle que d'être un objet (`champs: null`). */
const PROFONDEUR = 1
/** Nombre de littéraux au-delà duquel une union de littéraux (un id du catalogue) se contrôle par son genre primitif :
 *  le verbe du noyau refuse lui-même un id inconnu. */
const LITTERAUX_ENUMERES = 16
/** Nombre de champs au-delà duquel un objet (une fiche entière : `Combatant`, `Scene`) ne contrôle que d'être un objet. */
const CHAMPS_CONTROLES = 12
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

function forme(checker, type, profondeur, designes) {
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
  if (type.isUnionType()) return unionDe(type.getTypes().map((t) => forme(checker, t, profondeur, designes)), type.getAliasSymbol()?.name)
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const [element] = type.isTypeReference() ? checker.getTypeArguments(type) : []
    return { genre: 'tableau', element: element ? forme(checker, element, profondeur, designes) : { genre: 'libre', type: '?' } }
  }
  if (f & TypeFlags.Object) {
    if (checker.getSignaturesOfType(type, SignatureKind.Call).length) return { genre: 'libre', type: nomDuType(checker, type) }
    const proprietes = checker.getPropertiesOfType(type)
    if (profondeur >= PROFONDEUR || proprietes.length > CHAMPS_CONTROLES || checker.getIndexInfosOfType(type).length) return { genre: 'objet', type: nomDuType(checker, type), champs: null }
    const champs = proprietes.map((p) => ({
      nom: p.name,
      optionnel: !!(p.flags & SymbolFlags.Optional),
      forme: designee(sansAbsent(forme(checker, checker.getTypeOfSymbol(p), profondeur + 1, designes)), typeDeclare(p), designes),
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
  const f = forme(checker, type, 0, designes)
  return { nom: q.name, optionnel: !!(q.flags & SymbolFlags.Optional) || admetAbsent(f), type: nomDuType(checker, type), forme: designee(sansAbsent(f), typeDeclare(q), designes) }
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
    const f = unionDe(types.map((t) => forme(checker, t, 0, designes)))
    const ecrits = [...new Set(types.map((t) => nomDuType(checker, t)))]
    return { nom: m.name.text, optionnel: !!m.questionToken || admetAbsent(f), type: ecrits.length === 1 ? ecrits[0] : `${declare.type.typeName.text}[${i}]`, forme: sansAbsent(f) }
  })
}

/** Les paramètres d'un verbe déclaré à `SOURCE` dont le type écrit `string` nu, en paramètre ou en champ d'un objet
 *  écrit sur place : ce qui existe se désigne par son `IdDe…` (`DESIGNATIONS`), un texte du joueur par `TexteLibre`
 *  (`.claude/rules/verbes-du-noyau.md`). */
function chainesNues(membre) {
  if (!ts.isPropertySignatureDeclaration(membre) || !membre.type || !ts.isFunctionTypeNode(membre.type)) return []
  const nues = []
  const chercher = (n, chemin) => {
    if (n.kind === ts.SyntaxKind.StringKeyword) nues.push(chemin)
    else if (ts.isPropertySignatureDeclaration(n) && n.type) chercher(n.type, `${chemin}.${n.name.text}`)
    else n.forEachChild((c) => chercher(c, chemin))
  }
  for (const q of membre.type.parameters) if (q.type) chercher(q.type, `${membre.name.text}(${q.name.text})`)
  return nues
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
    Object.fromEntries(checker.getPropertiesOfType(checker.getTypeOfSymbol(flux)).map((r) => [r.name, designee(sansAbsent(forme(checker, checker.getTypeOfSymbol(r), 0, designes)), typeDeclare(r), designes)])),
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
    const nues = decl.members.flatMap(chainesNues)
    if (nues.length) throw new Error(`verbesDeLaPartie : ${INTERFACE} écrit \`string\` nu (un id se désigne par son \`IdDe…\` de ${SOURCE_DESIGNATIONS}, un texte du joueur par \`TexteLibre\`) : ${nues.join(', ')}`)
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
