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
const SOURCE_LEXIQUE = 'src/noyau/fabriquesDuNoyau.ts'
const LEXIQUE = 'MotDuLexique'
const SOURCE_IDS = 'src/data/schemas/_ids.generated.ts'
const INDEX_DES_IDS = 'IdsParEspace'
/** Longueur au-delà de laquelle un type anonyme ne s'écrit plus déplié, mais par son genre. */
const LONGUEUR_D_UN_NOM = 40
/** Le nom d'un objet anonyme trop long pour s'écrire déplié (`nomDuType`). */
const OBJET_ANONYME = 'objet'

/** Le nom DÉCLARÉ d'un type : son alias, son interface ou sa classe ; `null` : anonyme. */
function nomDeclare(type) {
  const nom = type.getAliasSymbol()?.name ?? type.getSymbol()?.name
  return nom && !nom.startsWith('__') ? nom : null
}

/** Le NOM d'un type : son alias (`Flow`), son interface ou sa classe (`Scene`), sinon son écriture courte ; un type
 *  anonyme long s'écrit par son genre (`objet`, `fonction`), jamais déplié. */
function nomDuType(checker, type) {
  const nomme = nomDeclare(type)
  if (nomme) return nomme
  const ecrit = checker.typeToString(type)
  if (ecrit.length <= LONGUEUR_D_UN_NOM) return ecrit
  if (!(type.flags & TypeFlags.Object)) return 'type'
  return checker.getSignaturesOfType(type, SignatureKind.Call).length ? 'fonction' : OBJET_ANONYME
}

/** Le nœud de type DÉCLARÉ d'un symbole (paramètre, champ), s'il en a un. */
const typeDeclare = (symbole) => symbole.valueDeclaration?.resolve()?.type

/** Aucun paramètre de type lié. */
const AUCUNE = new Map()

/** Le symbole que la référence de type `noeud` nomme, à travers un import. */
function symboleNomme(checker, noeud) {
  const s = checker.getSymbolAtLocation(ts.isIdentifier(noeud.typeName) ? noeud.typeName : noeud.typeName.right)
  return s && s.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
}

/** Le nœud `noeud`, ou, s'il nomme un paramètre de type que `subst` lie, le nœud de son argument. */
function substitue(checker, noeud, subst) {
  if (!noeud || !subst.size || !ts.isTypeReferenceNode(noeud) || noeud.typeArguments?.length || !ts.isIdentifier(noeud.typeName)) return noeud
  return subst.get(checker.getSymbolAtLocation(noeud.typeName)) ?? noeud
}

/** Les paramètres de type que lie la référence générique `noeud` (`RefDesignee<IdDeTalent>` : `I` → `IdDeTalent`) :
 *  symbole du paramètre de l'interface ou de l'alias qu'elle nomme → nœud de son argument, lu à travers `subst` (ceux
 *  du type englobant). Un champ du type nommé déclaré par un paramètre se lit au nœud de son argument (`substitue`),
 *  qu'un alias de `string` résolu perdrait. Toute autre référence garde `subst`. */
function substitutions(checker, noeud, subst) {
  if (!noeud || !ts.isTypeReferenceNode(noeud) || !noeud.typeArguments?.length) return subst
  const parametres = symboleNomme(checker, noeud)?.declarations?.[0]?.resolve()?.typeParameters
  if (!parametres) return subst
  return new Map(parametres.flatMap((tp, i) => (i < noeud.typeArguments.length ? [[checker.getSymbolAtLocation(tp.name), substitue(checker, noeud.typeArguments[i], subst)]] : [])))
}

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
 *  une chaîne, à travers parenthèses, `readonly`, tableaux, tuples et unions. */
function designee(f, noeud, designes) {
  if (!noeud) return f
  if (ts.isParenthesizedTypeNode(noeud) || ts.isTypeOperatorNode(noeud)) return designee(f, noeud.type, designes)
  if (ts.isArrayTypeNode(noeud)) return f.genre === 'tableau' ? { ...f, element: designee(f.element, noeud.elementType, designes) } : f
  if (ts.isTupleTypeNode(noeud)) {
    return f.genre === 'tuple' ? { ...f, elements: f.elements.map((e, i) => designee(e, ts.isNamedTupleMember(noeud.elements[i]) ? noeud.elements[i].type : noeud.elements[i], designes)) } : f
  }
  if (ts.isTypeReferenceNode(noeud)) {
    const nom = ts.isIdentifier(noeud.typeName) ? noeud.typeName.text : null
    return nom && designes.has(nom) && f.genre === 'chaine' ? { ...f, designe: { cle: nom, mot: designes.get(nom) } } : f
  }
  if (ts.isUnionTypeNode(noeud)) {
    const designants = noeud.types.filter((t) => designee({ genre: 'chaine' }, t, designes).designe)
    if (!designants.length) return f
    if (designants.length === 1) return f.genre === 'union' ? { ...f, membres: f.membres.map((m) => designee(m, designants[0], designes)) } : designee(f, designants[0], designes)
    // Plusieurs désignations : le type les rabat en une chaîne, la forme les rend en union, une chaîne désignée chacune.
    const chaines = designants.map((t) => designee({ genre: 'chaine' }, t, designes))
    if (f.genre === 'chaine') return { genre: 'union', membres: chaines }
    return f.genre === 'union' ? { ...f, membres: f.membres.flatMap((m) => (m.genre === 'chaine' ? chaines : [m])) } : f
  }
  return f
}

/** La référence au type récursif `type`, rencontré au chemin `ou` alors qu'il est déjà ouvert : sa forme se pose une fois
 *  dans `refs` (nom → type), lue par `formesReferencees`. Un type récursif anonyme, ou deux types de même nom, lèvent. */
function reference(type, ou, refs) {
  const nom = nomDeclare(type)
  if (!nom) throw new Error(`verbesDeLaPartie : ${ou} : type récursif anonyme, sans nom pour s'y référer`)
  if (refs.has(nom) && refs.get(nom) !== type) throw new Error(`verbesDeLaPartie : ${ou} : deux types récursifs nommés \`${nom}\``)
  refs.set(nom, type)
  return { genre: 'ref', type: nom }
}

/** La forme JSON de `type`, au chemin `ou`, à toute profondeur : un type déjà ouvert sur le chemin (`pile`) se lit en
 *  référence (`reference`), une signature d'index à clé chaîne en dictionnaire, une chaîne marquée en chaîne ; un type
 *  sans forme JSON qui le contrôle (fonction, `any`, `unknown`, `{}`, gabarit de chaîne, intersection d'objets) lève en
 *  nommant son chemin. */
function forme(checker, type, designes, refs, ou, pile = new Set(), subst = AUCUNE) {
  const f = type.flags
  const indescriptible = (quoi) => { throw new Error(`verbesDeLaPartie : ${ou} : ${quoi} (\`${checker.typeToString(type)}\`) n'a pas de forme JSON`) }
  if (f & (TypeFlags.Any | TypeFlags.Unknown)) indescriptible('`any` ou `unknown`')
  if (f & TypeFlags.StringLiteral) return { genre: 'litteral', valeur: type.value }
  if (f & TypeFlags.NumberLiteral) return { genre: 'litteral', valeur: type.value }
  if (f & TypeFlags.BooleanLiteral) return { genre: 'litteral', valeur: checker.typeToString(type) === 'true' }
  if (f & (TypeFlags.TemplateLiteral | TypeFlags.StringMapping)) indescriptible('gabarit de chaîne')
  if (f & TypeFlags.StringLike) return { genre: 'chaine' }
  if (f & TypeFlags.NumberLike) return { genre: 'nombre' }
  if (f & TypeFlags.BooleanLike) return { genre: 'booleen' }
  if (f & TypeFlags.Null) return { genre: 'null' }
  if (f & (TypeFlags.Undefined | TypeFlags.Void)) return { genre: 'absent' }
  if (pile.has(type)) return reference(type, ou, refs)
  const dedans = new Set(pile).add(type)
  if (type.isUnionType()) return unionDe(type.getTypes().map((t) => forme(checker, t, designes, refs, ou, dedans, subst)), type.getAliasSymbol()?.name)
  if (f & TypeFlags.Intersection) {
    // Une chaîne (ou un nombre) marquée : `string & { readonly [MARQUE]: true }`.
    const membres = type.getTypes()
    const primitifs = membres.filter((t) => t.flags & (TypeFlags.StringLike | TypeFlags.NumberLike | TypeFlags.BooleanLike))
    if (primitifs.length !== 1 || !membres.every((t) => primitifs.includes(t) || t.flags & TypeFlags.Object)) indescriptible('intersection')
    return forme(checker, primitifs[0], designes, refs, ou, dedans, subst)
  }
  if (checker.isTupleType(type)) {
    const elements = checker.getTypeArguments(type)
    const longueur = checker.getTypeOfSymbol(checker.getPropertyOfType(type, 'length'))
    if (!(longueur.flags & TypeFlags.NumberLiteral) || longueur.value !== elements.length) indescriptible('tuple à élément optionnel ou reste')
    return { genre: 'tuple', elements: elements.map((t, i) => forme(checker, t, designes, refs, `${ou}[${i}]`, dedans)) }
  }
  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type)
    if (!element) indescriptible('tableau sans élément')
    return { genre: 'tableau', element: forme(checker, element, designes, refs, `${ou}[]`, dedans) }
  }
  if (!(f & TypeFlags.Object)) indescriptible('type')
  if (checker.getSignaturesOfType(type, SignatureKind.Call).length) indescriptible('fonction')
  const champs = checker.getPropertiesOfType(type).map((p) => ({
    nom: p.name,
    optionnel: !!(p.flags & SymbolFlags.Optional),
    forme: formeDeclaree(checker, checker.getTypeOfSymbol(p), substitue(checker, typeDeclare(p), subst), designes, refs, `${ou}.${p.name}`, dedans, subst),
  }))
  const index = checker.getIndexInfosOfType(type)
  if (index.length > 1) indescriptible('plusieurs signatures d’index')
  if (!index.length) {
    if (!champs.length) indescriptible('objet sans champ')
    return { genre: 'objet', type: nomDuType(checker, type), champs }
  }
  const [{ keyType, valueType }] = index
  const cle = forme(checker, keyType, designes, refs, `${ou}[clé]`, dedans)
  // Une clé JSON est une chaîne.
  if (cle.genre !== 'chaine') indescriptible('dictionnaire à clé non chaîne')
  return {
    genre: 'dictionnaire',
    type: nomDuType(checker, type),
    cle,
    valeur: forme(checker, valueType, designes, refs, `${ou}[…]`, dedans),
    ...(champs.length ? { champs } : {}),
  }
}

/** La forme de chaque type récursif que `refs` nomme (`reference`), par nom, celles qu'elles référencent comprises. */
function formesReferencees(checker, designes, refs) {
  const formes = new Map()
  for (let neuf = [...refs.keys()]; neuf.length; neuf = [...refs.keys()].filter((n) => !formes.has(n))) {
    for (const nom of neuf) formes.set(nom, forme(checker, refs.get(nom), designes, refs, nom))
  }
  return Object.fromEntries([...formes].sort(([a], [b]) => parUnitesDeCode(a, b)))
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
  return { genre: 'union', membres: reste, ...(alias ? { type: alias } : {}) }
}

/** L'alias de ce qu'un verbe reçoit sans le désigner, parce que le geste le crée (`actionsDuNoyau.ts`) : exempt de
 *  désignation (`chainesNues`), lu à sa forme entière comme tout argument. */
const HORS_DESIGNATION = 'HorsDesignation'

/** Le nœud `noeud`, sans parenthèses, référence-t-il `HorsDesignation<…>` ? */
function horsDesignation(noeud) {
  while (noeud && ts.isParenthesizedTypeNode(noeud)) noeud = noeud.type
  return !!noeud && ts.isTypeReferenceNode(noeud) && ts.isIdentifier(noeud.typeName) && noeud.typeName.text === HORS_DESIGNATION
}

/** La forme d'un champ, d'un paramètre ou d'un axe de type `type`, déclaré par `noeud`, au chemin `ou` : sans son
 *  membre `absent`, annotée de sa désignation (`designee`), ses champs lus aux paramètres de type que `noeud` lie
 *  (`substitutions`). */
function formeDeclaree(checker, type, noeud, designes, refs, ou, pile, subst = AUCUNE) {
  return designee(sansAbsent(forme(checker, type, designes, refs, ou, pile, substitutions(checker, noeudDeplie(checker, noeud, designes), subst))), noeud, designes)
}

/** Une forme sans son membre `absent` : l'optionnalité se porte par le drapeau du champ ou du paramètre. */
function sansAbsent(f) {
  if (f.genre !== 'union') return f
  const membres = f.membres.filter((m) => m.genre !== 'absent')
  return membres.length === 1 ? membres[0] : { ...f, membres }
}

/** Un paramètre est optionnel par son drapeau, ou parce que son type admet `undefined` (`entry?: string`). */
const admetAbsent = (f) => f.genre === 'absent' || (f.genre === 'union' && f.membres.some((m) => m.genre === 'absent'))

/** Le paramètre `q` du verbe `verbe`, lu à son type et à son nœud déclaré. */
function parametre(checker, verbe, q, designes, refs) {
  const type = checker.getTypeOfSymbol(q)
  const ou = `${verbe}(${q.name})`
  const noeud = typeDeclare(q)
  const lue = forme(checker, type, designes, refs, ou, undefined, substitutions(checker, noeudDeplie(checker, noeud, designes), AUCUNE))
  return {
    nom: q.name,
    optionnel: !!(q.flags & SymbolFlags.Optional) || admetAbsent(lue),
    type: nomDuType(checker, type),
    forme: designee(sansAbsent(lue), noeud, designes),
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
function parametresDuReste(checker, verbe, q, designes, refs) {
  const declare = q.valueDeclaration?.resolve()
  if (!declare?.dotDotDotToken) return null
  const membres = tupleDeclare(checker, declare.type)
  const type = checker.getTypeOfSymbol(q)
  const tuples = type.isUnionType() ? type.getTypes() : [type]
  if (!membres || !tuples.every((t) => checker.isTupleType(t))) return null
  return membres.map((m, i) => {
    const types = tuples.map((t) => checker.getTypeOfSymbol(checker.getPropertyOfType(t, String(i))))
    const f = unionDe(types.map((t) => forme(checker, t, designes, refs, `${verbe}(${m.name.text})`, undefined, substitutions(checker, noeudDeplie(checker, m.type, designes), AUCUNE))))
    const ecrits = [...new Set(types.map((t) => nomDuType(checker, t)))]
    return { nom: m.name.text, optionnel: !!m.questionToken || admetAbsent(f), type: ecrits.length === 1 ? ecrits[0] : `${declare.type.typeName.text}[${i}]`, forme: designee(sansAbsent(f), m.type, designes) }
  })
}

/** L'alias d'un texte que le joueur écrit (`src/data/schemas/grammaire/ref.ts`) : la seule chaîne qu'aucune désignation ne nomme. */
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

/** Les chemins de `type` (déclaré par `noeud` quand il est connu, lu aux paramètres de type que `subst` lie) où une
 *  chaîne n'est nommée par aucune désignation ni par `TexteLibre`, à toute profondeur : champs, éléments, membres
 *  d'union, valeurs de dictionnaire. */
function chainesNuesDuType(checker, type, noeud, chemin, designes, vus, nues, subst = AUCUNE) {
  const deplie = noeudDeplie(checker, substitue(checker, noeud, subst), designes)
  if (horsDesignation(deplie)) return
  if (deplie && ts.isTypeReferenceNode(deplie) && !deplie.typeArguments?.length) {
    const nom = nomDeReference(deplie)
    if (designes.has(nom) || nom === TEXTE_LIBRE) return
  }
  if (!type) throw new Error(`chainesNues : type introuvable à ${chemin} (${deplie ? ts.SyntaxKind[deplie.kind] : '-'})`)
  // Une union déclarée se lit membre à membre, même rabattue en un seul type (`IdDObjet | IdDeLigneDeButin` : `string`).
  if (deplie && ts.isUnionTypeNode(deplie)) {
    for (const m of deplie.types) chainesNuesDuType(checker, checker.getTypeFromTypeNode(m), m, chemin, designes, vus, nues, subst)
    return
  }
  const f = type.flags
  if (f & (TypeFlags.String | TypeFlags.TemplateLiteral | TypeFlags.StringMapping)) { nues.push(chemin); return }
  if (type.isUnionType() || type.isIntersectionType?.() && !(f & TypeFlags.Object)) {
    if (type.isUnionType()) {
      for (const t of type.getTypes()) chainesNuesDuType(checker, t, t.flags & (TypeFlags.Undefined | TypeFlags.Null) ? undefined : deplie, chemin, designes, vus, nues, subst)
      return
    }
  }
  if (!(f & TypeFlags.Object) && !type.isIntersectionType?.()) return
  if (checker.getSignaturesOfType(type, SignatureKind.Call).length) return
  if (checker.isTupleType(type)) {
    const elements = deplie && ts.isTupleTypeNode(deplie) ? deplie.elements.map((e) => (ts.isNamedTupleMember(e) ? e.type : e)) : []
    checker.getTypeArguments(type).forEach((t, i) => chainesNuesDuType(checker, t, elements[i], `${chemin}[${i}]`, designes, vus, nues, subst))
    return
  }
  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type)
    if (element) chainesNuesDuType(checker, element, elementDuNoeud(deplie), `${chemin}[]`, designes, vus, nues, subst)
    return
  }
  const sous = substitutions(checker, deplie, subst)
  // Un même type, lu à d'autres arguments (`RefDesignee<IdDeTalent>`, `RefDesignee<IdDeCompetence>`), se lit encore.
  const cle = `${checker.typeToString(type)}<${[...sous.values()].map((n) => n.getText()).join(',')}>@${chemin.split('(')[0]}`
  if (vus.has(cle)) return
  vus.add(cle)
  for (const info of checker.getIndexInfosOfType(type)) {
    if (info.keyType.flags & TypeFlags.String) nues.push(`${chemin}[clé]`)
    chainesNuesDuType(checker, info.valueType, undefined, `${chemin}[…]`, designes, vus, nues, sous)
  }
  for (const p of checker.getPropertiesOfType(type)) chainesNuesDuType(checker, checker.getTypeOfSymbol(p), typeDeclare(p), `${chemin}.${p.name}`, designes, vus, nues, sous)
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

/** L'interface ou l'alias de type `nom` du fichier `source` du programme. */
function interfaceDe(session, racine, source, nom) {
  const sf = session.program.getSourceFile(path.resolve(racine, source).replaceAll('\\', '/'))
  let decl
  sf?.forEachChild((n) => { if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name.text === nom) decl = n })
  if (!decl) throw new Error(`verbesDeLaPartie : type \`${nom}\` introuvable dans ${source}`)
  return decl
}

/** Les chaînes littérales du type `type`, lui-même ou membres de son union. */
const chainesDuType = (type) => (type.isUnionType() ? type.getTypes() : [type]).filter((t) => t.flags & TypeFlags.StringLiteral).map((t) => t.value)

/** Les mots de `MotDuLexique` (src/noyau/fabriquesDuNoyau.ts), et les ids de chaque espace de `IdsParEspace`
 *  (src/data/schemas/_ids.generated.ts), lus par le vérificateur. */
function lexiqueLu(session, racine) {
  const { checker } = session
  const lexique = new Set(chainesDuType(checker.getTypeAtLocation(interfaceDe(session, racine, SOURCE_LEXIQUE, LEXIQUE).name)))
  const index = checker.getTypeAtLocation(interfaceDe(session, racine, SOURCE_IDS, INDEX_DES_IDS).name)
  const espaces = checker.getPropertiesOfType(index).map((e) => new Set(chainesDuType(checker.getTypeOfSymbol(e))))
  return { lexique, espaces }
}

/** Les axes de chaque clé de l'interface `nom` du fichier `source` (les réglages de chaque flux de jet, `ReglagesDuJet` ;
 *  les choix de chaque fenêtre, `ChoixDesFenetres`) : la forme de la valeur de chacun. */
function axesLus(session, racine, designes, refs, source, nom) {
  const { checker } = session
  const decl = interfaceDe(session, racine, source, nom)
  return Object.fromEntries(checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name)).map((flux) => [
    flux.name,
    Object.fromEntries(checker.getPropertiesOfType(checker.getTypeOfSymbol(flux)).map((r) => [r.name, formeDeclaree(checker, checker.getTypeOfSymbol(r), typeDeclare(r), designes, refs, `${nom}.${flux.name}.${r.name}`)])),
  ]))
}

/** Le contexte d'une case de la barre (src/noyau/actionRegistry.ts) : ce que l'offre lit pour déclarer son geste, jamais
 *  un paramètre de verbe, car l'hôte joue le verbe que l'offre déclare, avec ses arguments (#3610). */
const CONTEXTE_D_OFFRE = 'ContexteDOffre'

/** `type` nomme-t-il `ContexteDOffre`, lui-même, en membre d'union ou d'intersection, en argument de type
 *  (`Partial<ContexteDOffre>`), en élément de tableau ou en champ, à toute profondeur ? */
function nommeLeContexteDOffre(checker, type, vus = new Set()) {
  if (!type || vus.has(type)) return false
  vus.add(type)
  if ((type.getSymbol()?.name ?? type.getAliasSymbol()?.name) === CONTEXTE_D_OFFRE) return true
  const sous = [
    ...(type.isUnionType() || type.isIntersectionType?.() ? type.getTypes() : []),
    ...(type.getAliasTypeArguments?.() ?? []),
    ...(type.isTypeReference?.() ? checker.getTypeArguments(type) : []),
    ...(type.flags & TypeFlags.Object && !checker.getSignaturesOfType(type, SignatureKind.Call).length
      ? checker.getPropertiesOfType(type).map((p) => checker.getTypeOfSymbol(p)) : []),
  ]
  return sous.some((t) => nommeLeContexteDOffre(checker, t, vus))
}

/** Les paramètres `verbe(param)` de `decl` dont le type nomme `ContexteDOffre` (`nommeLeContexteDOffre`). */
function parametresDOffre(checker, decl) {
  const trouves = []
  for (const p of checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name))) {
    const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(p), SignatureKind.Call)
    for (const q of signature?.getParameters() ?? []) if (nommeLeContexteDOffre(checker, checker.getTypeOfSymbol(q))) trouves.push(`${p.name}(${q.name})`)
  }
  return trouves
}

/** La clé désignée de la forme `f` : sa désignation, ou les clés d'une union de chaînes désignées, triées et jointes ;
 *  `null` pour toute autre forme (littéral, nombre, objet…). */
function cleDesignee(f) {
  const membres = (f.genre === 'union' ? f.membres : [f]).filter((m) => m.genre !== 'null' && m.genre !== 'absent')
  if (!membres.length || !membres.every((m) => m.genre === 'chaine' && m.designe)) return null
  return [...new Set(membres.map((m) => m.designe.cle))].sort().join(' | ')
}

/** L'objet `f` est-il anonyme : son type s'écrit déplié (`{ … }`) ou par son genre (`nomDuType`) ? */
const objetAnonyme = (f) => f.genre === 'objet' && (f.type.startsWith('{') || f.type === OBJET_ANONYME)

/** Les objets anonymes de l'union `membres` qu'un champ littéral commun discrimine : leurs champs se qualifient par ce
 *  discriminant. */
function discrimines(membres) {
  const objets = membres.filter(objetAnonyme)
  if (objets.length < 2) return new Set()
  const litteral = (o, nom) => o.champs.some((c) => c.nom === nom && c.forme.genre === 'litteral')
  return objets[0].champs.some((c) => objets.every((o) => litteral(o, c.nom))) ? new Set(objets) : new Set()
}

/** Pose `poser(nom, forme)` pour chaque champ d'objet anonyme que la forme `f` porte, à travers objets anonymes,
 *  tableaux, tuples et unions ; le champ d'un type nommé se qualifie par son type, celui d'un membre d'union
 *  discriminée par son discriminant : aucun n'est posé. */
function champsAnonymes(f, poser) {
  if (f.genre === 'tableau') champsAnonymes(f.element, poser)
  else if (f.genre === 'tuple') for (const e of f.elements) champsAnonymes(e, poser)
  else if (f.genre === 'union') {
    const qualifies = discrimines(f.membres)
    for (const m of f.membres) if (!qualifies.has(m)) champsAnonymes(m, poser)
  } else if (objetAnonyme(f)) {
    for (const c of f.champs) { poser(c.nom, c.forme); champsAnonymes(c.forme, poser) }
  }
}

/** Un nom, un type désigné (`.claude/rules/verbes-du-noyau.md`) : chaque paramètre des verbes `verbes`, et chaque champ
 *  de leurs objets anonymes (`champsAnonymes`), dont la forme est désignée (`cleDesignee`) garde, sous un même nom, une
 *  même clé désignée ; deux clés sous un nom lèvent, en nommant le nom, chaque clé et un verbe de chacune. */
export function unNomUnTypeDesigne(verbes) {
  /** Nom → clé désignée → premier verbe qui la porte. */
  const cles = new Map()
  for (const [verbe, parametres] of Object.entries(verbes)) {
    const poser = (nom, f) => {
      const cle = cleDesignee(f)
      if (!cle) return
      const parCle = cles.get(nom) ?? cles.set(nom, new Map()).get(nom)
      if (!parCle.has(cle)) parCle.set(cle, verbe)
    }
    for (const p of parametres) { poser(p.nom, p.forme); champsAnonymes(p.forme, poser) }
  }
  const doubles = [...cles].filter(([, parCle]) => parCle.size > 1)
  if (doubles.length) {
    const dits = doubles.map(([nom, parCle]) => `\`${nom}\` : ${[...parCle].map(([cle, verbe]) => `\`${cle}\` (${verbe})`).join(', ')}`)
    throw new Error(`verbesDeLaPartie : un nom de paramètre désigne deux types (une chose déjà désignée ailleurs garde le même type et le même nom de paramètre) : ${dits.join(' ; ')}`)
  }
}

/** Les mots de l'id `s`, coupé à chaque tiret et avant chaque majuscule, en minuscules (`Mots<S>`,
 *  src/noyau/fabriquesDuNoyau.ts). */
const motsDe = (s) => s.split('-').flatMap((p) => p.split(/(?=[A-Z])/)).filter(Boolean).map((m) => m.toLowerCase())

/** Les littéraux des paramètres des verbes `verbes` en mots du lexique (`.claude/rules/verbes-du-noyau.md`) : chaque
 *  membre chaîne littéral d'un paramètre, à travers champs, tableaux, tuples, unions et types récursifs de `formes`, ne
 *  prend que des mots de `lexique` ; une union dont chaque membre est un id d'un même espace de `espaces` recopie cet
 *  espace, c'est une donnée, hors du lexique. Un mot hors du lexique lève, en nommant le verbe, le paramètre, le membre
 *  et ses mots en faute. */
export function litterauxDuLexique(verbes, formes, lexique, espaces) {
  const fautes = []
  const recopieUnEspace = (membres) => membres.length > 0 && membres.every((m) => m.genre === 'litteral' && typeof m.valeur === 'string')
    && espaces.some((ids) => membres.every((m) => ids.has(m.valeur)))
  const visiter = (f, ou, vus) => {
    switch (f.genre) {
      case 'litteral': {
        const hors = typeof f.valeur === 'string' ? motsDe(f.valeur).filter((m) => !lexique.has(m)) : []
        if (hors.length) fautes.push(`${ou} \`${f.valeur}\` (${hors.join(', ')})`)
        return
      }
      case 'union': if (!recopieUnEspace(f.membres.filter((m) => m.genre !== 'null' && m.genre !== 'absent'))) for (const m of f.membres) visiter(m, ou, vus); return
      case 'tableau': visiter(f.element, ou, vus); return
      case 'tuple': for (const e of f.elements) visiter(e, ou, vus); return
      case 'objet': for (const c of f.champs) visiter(c.forme, `${ou}.${c.nom}`, vus); return
      case 'dictionnaire': visiter(f.cle, ou, vus); visiter(f.valeur, ou, vus); for (const c of f.champs ?? []) visiter(c.forme, `${ou}.${c.nom}`, vus); return
      case 'ref': if (!vus.has(f.type)) visiter(formes[f.type], ou, new Set(vus).add(f.type)); return
      default:
    }
  }
  for (const [verbe, parametres] of Object.entries(verbes)) for (const p of parametres) visiter(p.forme, `${verbe}(${p.nom})`, new Set())
  if (fautes.length) throw new Error(`verbesDeLaPartie : un littéral de paramètre prend un mot hors de \`${LEXIQUE}\` (${SOURCE_LEXIQUE}) : ${[...new Set(fautes)].join(', ')}`)
}

/** La partie lue de son type : ses verbes, par nom, ou les seuls `noms`, leurs paramètres dans l'ordre de l'appel
 *  (`ParametreDeVerbe`, src/hote/formes.ts), la forme de la valeur de chaque réglage de jet et de chaque choix de
 *  fenêtre, et celle de chaque type récursif qu'une forme référence (`formes`) ; un nom de paramètre qui désigne deux
 *  types lève (`unNomUnTypeDesigne`), un littéral de paramètre hors du lexique aussi (`litterauxDuLexique`). */
export function partieLue(racine = process.cwd(), noms = null) {
  const fichier = path.resolve(racine, SOURCE).replaceAll('\\', '/')
  const session = repoProgram(racine, () => [fichier, ...[SOURCE_LEXIQUE, SOURCE_IDS].map((f) => path.resolve(racine, f).replaceAll('\\', '/'))])
  try {
    const decl = interfaceDe(session, racine, SOURCE, INTERFACE)
    const { checker } = session
    const designes = nomsDesignes(session, racine)
    const verbes = {}
    /** Les types récursifs rencontrés, par nom (`reference`). */
    const refs = new Map()
    const nues = chainesNues(session, racine, decl, designes)
    const dOffre = parametresDOffre(checker, decl)
    if (dOffre.length) throw new Error(`verbesDeLaPartie : ${INTERFACE} prend un \`${CONTEXTE_D_OFFRE}\` en paramètre (l'offre déclare son geste { verbe, args }, l'hôte joue ce verbe) : ${dOffre.join(', ')}`)
    if (nues.length) throw new Error(`verbesDeLaPartie : ${INTERFACE} écrit \`string\` nu (un id se désigne par son \`IdDe…\` de ${SOURCE_DESIGNATIONS}, un texte du joueur par \`TexteLibre\`, ce que le geste crée par \`HorsDesignation\`) : ${nues.join(', ')}`)
    for (const p of checker.getPropertiesOfType(checker.getTypeAtLocation(decl.name))) {
      if (noms && !noms.includes(p.name)) continue
      const [signature] = checker.getSignaturesOfType(checker.getTypeOfSymbol(p), SignatureKind.Call)
      if (!signature) continue
      const qs = signature.getParameters()
      verbes[p.name] = (qs.length === 1 && parametresDuReste(checker, p.name, qs[0], designes, refs)) || qs.map((q) => parametre(checker, p.name, q, designes, refs))
    }
    unNomUnTypeDesigne(verbes)
    const reglages = axesLus(session, racine, designes, refs, SOURCE_REGLAGES, INTERFACE_REGLAGES)
    const choix = axesLus(session, racine, designes, refs, SOURCE_CHOIX, INTERFACE_CHOIX)
    const formes = formesReferencees(checker, designes, refs)
    const { lexique, espaces } = lexiqueLu(session, racine)
    litterauxDuLexique(verbes, formes, lexique, espaces)
    return {
      verbes: Object.fromEntries(Object.entries(verbes).sort(([a], [b]) => parUnitesDeCode(a, b))),
      reglages,
      choix,
      formes,
    }
  } finally {
    libererSessions([session])
  }
}

/** Les verbes de la partie (`partieLue`). */
export const verbesDeLaPartie = (racine = process.cwd(), noms = null) => partieLue(racine, noms).verbes
