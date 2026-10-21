// LES VERBES DE LA PARTIE (#2898 lot C), lus du TYPE que `Partie.envoyer` accepte : `Intention` porte
// `Parameters<ActionsDuNoyau[K]>` (src/noyau/partie.ts), donc chaque membre de l'interface `ActionsDuNoyau`
// (src/noyau/actionsDuNoyau.ts, `RollFlowActionsMap` dérivé compris) est un verbe, et la signature de son appel
// donne ses paramètres. Le vérificateur de types résout chaque paramètre en une FORME JSON (`Forme`,
// src/hoteTexte/formes.ts) : la même lecture sert la table du doc (scripts/docs/build-hote-texte.mjs) et la
// validation des arguments de `jouer` (src/hoteTexte/verbes.generated.ts, scripts/gen-verbes.mjs). Aucune forme écrite à la main.
// Un paramètre (ou un champ) dont la DÉCLARATION nomme une clé de `DESIGNATIONS` (src/noyau/designations.ts) porte
// ce nom et son mot dans sa forme (`designe`) : un alias de `string` ne survit pas au type résolu, il se lit au nœud déclaré.
import path from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { SignatureKind, SymbolFlags, TypeFlags } from 'typescript/unstable/sync'
import { repoProgram, libererSessions } from '../../guards/lib/tsProgram.mjs'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'

const SOURCE = 'src/noyau/actionsDuNoyau.ts'
const INTERFACE = 'ActionsDuNoyau'
const SOURCE_DESIGNATIONS = 'src/noyau/designations.ts'
const TABLE_DESIGNATIONS = 'DESIGNATIONS'
/** Profondeur de résolution d'un objet : au-delà, l'objet ne contrôle que d'être un objet (`champs: null`). */
const PROFONDEUR = 1
/** Nombre de littéraux au-delà duquel une union de littéraux (un id du catalogue) se contrôle par son genre primitif :
 *  le verbe du noyau refuse lui-même un id inconnu. */
const LITTERAUX_ENUMERES = 16
/** Nombre de champs au-delà duquel un objet (une fiche entière : `Combatant`, `Scene`) ne contrôle que d'être un objet. */
const CHAMPS_CONTROLES = 12
/** Longueur au-delà de laquelle un type anonyme ne s'écrit plus déplié, mais par son genre. */
const LONGUEUR_D_UN_NOM = 40

/** Le NOM d'un type : son alias (`Flow`), son interface ou sa classe (`RoomPortal`), sinon son écriture courte ; un type
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
 *  une chaîne ou un objet, à travers parenthèses, `readonly`, tableaux et unions. */
function designee(f, noeud, designes) {
  if (!noeud) return f
  if (ts.isParenthesizedTypeNode(noeud) || ts.isTypeOperatorNode(noeud)) return designee(f, noeud.type, designes)
  if (ts.isArrayTypeNode(noeud)) return f.genre === 'tableau' ? { ...f, element: designee(f.element, noeud.elementType, designes) } : f
  if (ts.isTypeReferenceNode(noeud)) {
    const nom = ts.isIdentifier(noeud.typeName) ? noeud.typeName.text : null
    return nom && designes.has(nom) && (f.genre === 'chaine' || f.genre === 'objet') ? { ...f, designe: { cle: nom, mot: designes.get(nom) } } : f
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
  if (type.isUnionType()) {
    const membres = type.getTypes().map((t) => forme(checker, t, profondeur, designes))
    // `boolean` est l'union `true | false` : il se lit d'un mot.
    const booleens = membres.filter((m) => m.genre === 'litteral' && typeof m.valeur === 'boolean').length
    const reste = booleens === 2 ? [{ genre: 'booleen' }, ...membres.filter((m) => !(m.genre === 'litteral' && typeof m.valeur === 'boolean'))] : membres
    if (reste.length === 1) return reste[0]
    const alias = type.getAliasSymbol()?.name
    const litteraux = reste.filter((m) => m.genre === 'litteral')
    if (litteraux.length > LITTERAUX_ENUMERES) {
      const genres = [...new Set(litteraux.map((m) => (typeof m.valeur === 'number' ? 'nombre' : 'chaine')))].map((genre) => ({ genre }))
      const autres = reste.filter((m) => m.genre !== 'litteral')
      const membresReduits = [...genres, ...autres]
      return membresReduits.length === 1 ? membresReduits[0] : { genre: 'union', membres: membresReduits, ...(alias ? { type: alias } : {}) }
    }
    return { genre: 'union', membres: reste, ...(alias ? { type: alias } : {}) }
  }
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

/** Une forme sans son membre `absent` : l'optionnalité se porte par le drapeau du champ ou du paramètre. */
function sansAbsent(f) {
  if (f.genre !== 'union') return f
  const membres = f.membres.filter((m) => m.genre !== 'absent')
  return membres.length === 1 ? membres[0] : { ...f, membres }
}

/** Un paramètre est optionnel par son drapeau, ou parce que son type admet `undefined` (`entry?: string`). */
const admetAbsent = (f) => f.genre === 'absent' || (f.genre === 'union' && f.membres.some((m) => m.genre === 'absent'))

/** Les verbes de la partie, par nom, ou les seuls `noms` : leurs paramètres, dans l'ordre de l'appel
 *  (`ParametreDeVerbe`, src/hoteTexte/formes.ts). */
export function verbesDeLaPartie(racine = process.cwd(), noms = null) {
  const fichier = path.resolve(racine, SOURCE).replaceAll('\\', '/')
  const session = repoProgram(racine, () => [fichier])
  try {
    const sf = session.program.getSourceFile(fichier)
    let decl
    sf.forEachChild((n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === INTERFACE) decl = n })
    if (!decl) throw new Error(`verbesDeLaPartie : interface \`${INTERFACE}\` introuvable dans ${SOURCE}`)
    const { checker } = session
    const designes = nomsDesignes(session, racine)
    const verbes = {}
    for (const p of checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name))) {
      if (noms && !noms.includes(p.name)) continue
      const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(p), SignatureKind.Call)
      if (!signature) continue
      verbes[p.name] = signature.getParameters().map((q) => {
        const type = checker.getTypeOfSymbol(q)
        const f = forme(checker, type, 0, designes)
        return { nom: q.name, optionnel: !!(q.flags & SymbolFlags.Optional) || admetAbsent(f), type: nomDuType(checker, type), forme: designee(sansAbsent(f), typeDeclare(q), designes) }
      })
    }
    return Object.fromEntries(Object.entries(verbes).sort(([a], [b]) => parUnitesDeCode(a, b)))
  } finally {
    libererSessions([session])
  }
}
