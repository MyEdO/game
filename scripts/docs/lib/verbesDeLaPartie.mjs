// LES VERBES DE LA PARTIE (#2898 lot C), lus du TYPE que `Partie.envoyer` accepte : `Intention` porte
// `Parameters<ActionsDuNoyau[K]>` (src/noyau/partie.ts), donc chaque membre de l'interface `ActionsDuNoyau`
// (src/noyau/actionsDuNoyau.ts, `RollFlowActionsMap` dérivé compris) est un verbe, et la signature de son appel
// donne ses paramètres. Le vérificateur de types résout chaque paramètre en une FORME JSON (`Forme`,
// src/hoteTexte/formes.ts) : la même lecture sert la table du doc (scripts/docs/build-hote-texte.mjs) et la
// validation des arguments de `jouer` (scripts/hote-texte.mjs la prête à l'hôte). Aucune forme écrite à la main.
import path from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { SignatureKind, SymbolFlags, TypeFlags } from 'typescript/unstable/sync'
import { repoProgram, libererSessions } from '../../guards/lib/tsProgram.mjs'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'

const SOURCE = 'src/noyau/actionsDuNoyau.ts'
const INTERFACE = 'ActionsDuNoyau'
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

function forme(checker, type, profondeur) {
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
    const membres = type.getTypes().map((t) => forme(checker, t, profondeur))
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
    return { genre: 'tableau', element: element ? forme(checker, element, profondeur) : { genre: 'libre', type: '?' } }
  }
  if (f & TypeFlags.Object) {
    if (checker.getSignaturesOfType(type, SignatureKind.Call).length) return { genre: 'libre', type: nomDuType(checker, type) }
    const proprietes = checker.getPropertiesOfType(type)
    if (profondeur >= PROFONDEUR || proprietes.length > CHAMPS_CONTROLES || checker.getIndexInfosOfType(type).length) return { genre: 'objet', type: nomDuType(checker, type), champs: null }
    const champs = proprietes.map((p) => ({
      nom: p.name,
      optionnel: !!(p.flags & SymbolFlags.Optional),
      forme: sansAbsent(forme(checker, checker.getTypeOfSymbol(p), profondeur + 1)),
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
    const verbes = {}
    for (const p of checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name))) {
      if (noms && !noms.includes(p.name)) continue
      const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(p), SignatureKind.Call)
      if (!signature) continue
      verbes[p.name] = signature.getParameters().map((q) => {
        const type = checker.getTypeOfSymbol(q)
        const f = forme(checker, type, 0)
        return { nom: q.name, optionnel: !!(q.flags & SymbolFlags.Optional) || admetAbsent(f), type: nomDuType(checker, type), forme: sansAbsent(f) }
      })
    }
    return Object.fromEntries(Object.entries(verbes).sort(([a], [b]) => parUnitesDeCode(a, b)))
  } finally {
    libererSessions([session])
  }
}
