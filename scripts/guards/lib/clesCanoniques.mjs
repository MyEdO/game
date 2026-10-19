// CLÉS CANONIQUES des valeurs de l'évaluateur de racines balayées (#2400, #2586) : la clé d'une valeur,
// des arguments d'un appel et d'une composition, leur texte, et la table des FORMES d'argument qu'elles lisent.
import { types } from 'node:util'

const mapperTableau = Array.prototype.map
const proprePropriete = Object.hasOwn
const getterDePrototype = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__')?.get
const prototypesDeCle = [Object.prototype, Array.prototype].map((prototype) => {
  const noms = Reflect.ownKeys(prototype)
  return { prototype, noms, proprietes: noms.map((nom) => Object.getOwnPropertyDescriptor(prototype, nom)) }
})
const prototypesInertes = () => {
  for (const { prototype, noms, proprietes } of prototypesDeCle) {
    const actuels = Reflect.ownKeys(prototype)
    if (actuels.length !== noms.length) return false
    for (let i = 0; i < noms.length; i++) {
      if (actuels[i] !== noms[i]) return false
      const p = Object.getOwnPropertyDescriptor(prototype, noms[i])
      const avant = proprietes[i]
      if (!Object.hasOwn(p, 'value') && (prototype !== Object.prototype || noms[i] !== '__proto__' || p.get !== getterDePrototype)) return false
      if (!Object.is(p.value, avant.value) || p.get !== avant.get || p.set !== avant.set ||
        p.enumerable !== avant.enumerable || p.configurable !== avant.configurable || p.writable !== avant.writable) return false
    }
  }
  return true
}

/** La DONNÉE PLATE : un objet que ses descripteurs propres décrivent, lu par eux sans qu'aucun code ne s'exécute, et
 *  dont le moteur JSON n'appelle aucun `toJSON` à son niveau — ni proxy, prototype `Object.prototype` ou `null` (`Array.prototype` ou `null` pour un tableau),
 *  propriétés propres à clé texte en donnée, aucun `toJSON` propre hors membre énuméré non appelable d'un objet, aucun
 *  `toJSON` hérité. Rend ses descripteurs propres, `null` hors donnée plate (#2586).
 *  @param {object} v @returns {Record<PropertyKey, PropertyDescriptor> | null} */
export function donneePlate(v) {
  if (types.isProxy(v)) return null
  const tableau = Array.isArray(v)
  const prototype = Object.getPrototypeOf(v)
  if (prototype !== null && (prototype !== (tableau ? Array.prototype : Object.prototype) ||
    proprePropriete(Object.prototype, 'toJSON') || tableau && proprePropriete(Array.prototype, 'toJSON'))) return null
  const proprietes = Object.getOwnPropertyDescriptors(v)
  for (const p of Object.values(proprietes)) if (!proprePropriete(p, 'value')) return null
  const toJSON = proprePropriete(proprietes, 'toJSON') ? proprietes.toJSON : undefined
  if (toJSON && (tableau || !toJSON.enumerable || typeof toJSON.value === 'function')) return null
  return proprietes
}

/** La projection de `porteur` par le moteur JSON, seul à sérialiser une valeur de l'appelant ; `CLE_DOMAINE_JSON` s'il
 *  ne rend aucun texte (#2586). */
const parLeMoteur = (porteur) => {
  const texte = JSON.stringify(porteur)
  if (texte === undefined) throw new Error('CLE_DOMAINE_JSON')
  return JSON.parse(texte)
}

/** Les modes d'une clé : `texte` (projection JSON), `strict` (certifiée, `null` hors domaine), `cellules` (stricte, en cellules). */
const MODES = Object.freeze({
  texte: Object.freeze({ strict: false, cellules: false }),
  strict: Object.freeze({ strict: true, cellules: false }),
  cellules: Object.freeze({ strict: true, cellules: true }),
})

/** Une surface de clé nomme `CLE_DOMAINE_JSON` toute `TypeError`, refus du moteur JSON compris (proxy révoqué, `BigInt`,
 *  cycle), l'erreur native en `cause`, et laisse passer intacte toute autre erreur ; la table des formes garde le contrat natif de `WeakMap` (#2586).
 *  @template {(...a: any[]) => any} F @param {F} surface @returns {F} */
const refusNomme = (surface) => /** @type {F} */ ((...a) => {
  try {
    return surface(...a)
  } catch (erreur) {
    if (erreur instanceof TypeError) throw new Error('CLE_DOMAINE_JSON', { cause: erreur })
    throw erreur
  }
})

/**
 * Les clés d'UN évaluateur : `ferme` = noyau fermé d'un lot (IR gelée, références privées mémoïsées, forme
 * associée après clé refusée), toute clé en mode `cellules`, sans `cleCanonique` ; sinon,
 * `cleCanonique` prend son mode (`MODES`) et les clés des valeurs sont textuelles. Un argument vaut par ses valeurs et
 * sa forme : son expression et, si `litSonContexte(expression)`, son contexte entier (module, preuve booléenne, chaîne
 * d'environnements : fonction, arguments, paramètres) ; sinon, aucun contexte. Hors domaine JSON : `CLE_DOMAINE_JSON`.
 * Cellules, preuves et mémos ne sont tenus que par l'instance, jamais par la fin du job : ils meurent avec son évaluateur
 * (un lot d'`evaluerLotDuDepot`, un appel d'`evaluer`) (#2586).
 * @param {{ ferme: boolean, litSonContexte: (e: unknown) => boolean }} regime
 */
export function clesCanoniques({ ferme, litSonContexte }) {
  const referencesPrivees = new WeakMap()
  const objetsCles = new WeakSet()
  const clesDesValeurs = new WeakMap()
  const clesDesArguments = new WeakMap()
  const slotsGeles = new WeakMap()
  const sousGraphesGeles = new WeakMap()
  const sousGraphesRevalides = new WeakMap()
  const dependancesDesFormes = new WeakMap()
  const preparerPreuve = () => ({ valide: true, parents: new Set() })
  const invaliderPreuve = (preuve) => {
    if (!preuve?.valide) return
    preuve.valide = false
    for (const parent of preuve.parents) invaliderPreuve(parent)
    preuve.parents.clear()
  }
  const cellulesBooleennes = new Map()
  const referencesBooleennes = new WeakSet()
  const finCelluleBooleenne = Symbol()
  const compositionDeCle = Symbol()
  const marqueursBooleens = Object.freeze({
    liste: Object.freeze({ marqueur: 'liste' }), objet: Object.freeze({ marqueur: 'objet' }),
    fin: Object.freeze({ marqueur: 'fin' }), enfant: Object.freeze({ marqueur: 'enfant' }),
  })
  /** La cellule canonique de `tokens`, internée par l'instance (#2586). */
  const celluleDe = (tokens) => {
    let branche = cellulesBooleennes
    for (const token of tokens) {
      let suivante = branche.get(token)
      if (suivante === undefined) branche.set(token, suivante = new Map())
      branche = suivante
    }
    let cellule = branche.get(finCelluleBooleenne)
    if (cellule === undefined) {
      cellule = Object.freeze({ tokens: Object.freeze([...tokens]) })
      referencesBooleennes.add(cellule)
      branche.set(finCelluleBooleenne, cellule)
    }
    return cellule
  }
  let revisionDesFormes = Symbol()
  const associationsDesFormes = new WeakMap()
  const formesDesArguments = Object.freeze({
    get: (cle) => associationsDesFormes.get(cle),
    has: (cle) => associationsDesFormes.has(cle),
    set(cle, forme) {
      if (ferme && objetsCles.has(cle)) throw new Error('FORME_PRIVEE_ASSOCIEE_APRES_CLE')
      const identique = associationsDesFormes.has(cle) && Object.is(associationsDesFormes.get(cle), forme)
      associationsDesFormes.set(cle, forme)
      if (!identique) {
        invaliderPreuve(dependancesDesFormes.get(cle))
        invaliderPreuve(sousGraphesGeles.get(cle)?.preuve)
        revisionDesFormes = Symbol()
      }
      return formesDesArguments
    },
    delete(cle) {
      const retiree = associationsDesFormes.delete(cle)
      if (retiree) {
        invaliderPreuve(dependancesDesFormes.get(cle))
        invaliderPreuve(sousGraphesGeles.get(cle)?.preuve)
        revisionDesFormes = Symbol()
      }
      return retiree
    },
  })
  const cleCanonique = (faire, racine, cache, mode) => {
    if (!Object.hasOwn(MODES, mode)) throw new Error('CLE_MODE_INCONNU')
    const { strict, cellules } = MODES[mode]
    try {
    if (!ferme && strict && !prototypesInertes()) return null
    const deja = cache?.get(racine)
    if (ferme && deja) return deja.cle
    const revisionAvant = revisionDesFormes
    const certifier = (records) => {
      if (!strict || !records.every(({ objet, preuve }) => Object.isFrozen(objet) &&
        (!preuve || preuve.valide)) || revisionAvant !== revisionDesFormes) return null
      const certificat = preparerPreuve()
      for (const { objet, preuve } of records) {
        let dependance = dependancesDesFormes.get(objet)
        if (!dependance?.valide) dependancesDesFormes.set(objet, dependance = preparerPreuve())
        dependance.parents.add(certificat)
        if (preuve) preuve.parents.add(certificat)
      }
      return certificat
    }
    if (!ferme && strict && deja?.strict && deja.cellules === cellules && deja.certificat?.valide &&
      !Object.hasOwn(Array.prototype, 'toJSON') && !Object.hasOwn(Object.prototype, 'toJSON')) return deja.cle
    if (!ferme && deja && deja.strict === strict && deja.cellules === cellules && !Object.hasOwn(Array.prototype, 'toJSON') && !Object.hasOwn(Object.prototype, 'toJSON') && deja.objets.every(({ objet, noms, proprietes, forme, prototype, slotsGeles, preuve }) => {
      if (preuve && !preuve.valide) return false
      if (strict && slotsGeles) return formesDesArguments.get(objet) === forme
      if (types.isProxy(objet) || (strict && Object.getOwnPropertySymbols(objet).length)) return false
      const actuels = Object.getOwnPropertyNames(objet)
      return Object.getPrototypeOf(objet) === prototype && (!Array.isArray(objet) ||
        (strict ? Object.getOwnPropertyDescriptor(Array.prototype, 'map')?.value === mapperTableau : Array.prototype.map === mapperTableau)) &&
        formesDesArguments.get(objet) === forme && actuels.length === noms.length &&
        actuels.every((nom, i) => {
          const p = Object.getOwnPropertyDescriptor(objet, nom)
          return nom === noms[i] && Object.hasOwn(p, 'value') &&
            Object.is(p.value, proprietes[i].value) && p.enumerable === proprietes[i].enumerable
        })
    })) {
      deja.certificat = certifier(deja.objets)
      return deja.cle
    }
    const capturerSlots = (objet) => {
      const prototype = Object.getPrototypeOf(objet)
      if (strict && Array.isArray(objet) && prototype !== Array.prototype ||
        prototype !== null && prototype !== Object.prototype && prototype !== Array.prototype) { return null }
      if (Array.isArray(objet) && (Object.hasOwn(objet, 'map') ||
        (strict ? Object.getOwnPropertyDescriptor(Array.prototype, 'map')?.value !== mapperTableau : Array.prototype.map !== mapperTableau) ||
        Array.from({ length: objet.length }, (_, i) => i).some((i) => !Object.hasOwn(objet, i)))) { stable = false; if (strict) return null }
      const noms = Object.getOwnPropertyNames(objet)
      const proprietes = noms.map((nom) => Object.getOwnPropertyDescriptor(objet, nom))
      if (proprietes.some((p) => !Object.hasOwn(p, 'value') || typeof p.value === 'function' || strict && (typeof p.value === 'symbol' || typeof p.value === 'bigint' || typeof p.value === 'number' && (!Number.isFinite(p.value) || Object.is(p.value, -0))))) { stable = false; return false }
      if (strict && (Object.getOwnPropertySymbols(objet).length ||
        proprietes.some((p, i) => !p.enumerable && !(Array.isArray(objet) && noms[i] === 'length')) ||
        Array.isArray(objet) && noms.some((nom) => nom !== 'length' && !/^(0|[1-9]\d*)$/.test(nom)))) { stable = false; return false }
      const slots = { objet, noms, proprietes, prototype }
      if (strict && Object.isFrozen(objet)) slotsGeles.set(objet, slots)
      return slots
    }
    const objets = new Map()
    const fermetures = new Map()
    const preuveDe = (objet) => {
      if (ferme || !cellules) return undefined
      const preuve = sousGraphesGeles.get(objet)
      return preuve?.preuve.valide && prototypesInertes() ? preuve : undefined
    }
    let stable = true
    const observer = (objet) => {
      if (ferme) return true
      if (strict && (typeof objet === 'symbol' || typeof objet === 'bigint' ||
        typeof objet === 'number' && (!Number.isFinite(objet) || Object.is(objet, -0)))) { stable = false; return false }
      if (typeof objet === 'function') { stable = false; return false }
      if (!objet || typeof objet !== 'object') return true
      if (cellules && referencesBooleennes.has(objet)) return true
      if (objets.has(objet)) {
        const fermeture = fermetures.get(objet)
        if (fermeture?.actif) { fermeture.eligible = false; fermeture.reutilisable = false }
        return true
      }
      if (types.isProxy(objet)) { stable = false; return false }
      const preuve = preuveDe(objet)
      if (preuve) {
        objets.set(objet, { objet, forme: undefined, slotsGeles: true, preuve: preuve.preuve })
        fermetures.set(objet, { actif: false, eligible: true, reutilisable: true, inchange: true, cellule: preuve.cellule, preuve: preuve.preuve })
        return true
      }
      const slots = strict && slotsGeles.get(objet) || capturerSlots(objet)
      if (!slots) { stable = false; return false }
      const { proprietes } = slots
      objets.set(objet, { ...slots, slotsGeles: strict && slotsGeles.has(objet), forme: formesDesArguments.get(objet) })
      const precedent = cellules && sousGraphesRevalides.get(objet)
      const inchange = precedent && precedent.slots.prototype === slots.prototype && precedent.slots.noms.length === slots.noms.length &&
        slots.noms.every((nom, i) => nom === precedent.slots.noms[i] &&
          ['value', 'enumerable', 'writable', 'configurable'].every((champ) => Object.is(proprietes[i][champ], precedent.slots.proprietes[i][champ])))
      const fermeture = cellules ? { actif: true, eligible: Object.isFrozen(objet) && !formesDesArguments.has(objet),
        reutilisable: !formesDesArguments.has(objet), inchange: !!inchange, precedent, slots } : null
      if (fermeture) fermetures.set(objet, fermeture)
      if (strict) for (const p of proprietes) {
        if (!observer(p.value)) return false
        if (fermeture && p.value && typeof p.value === 'object' && !fermetures.get(p.value)?.eligible) fermeture.eligible = false
        if (fermeture && p.value && typeof p.value === 'object' && !referencesBooleennes.has(p.value)) {
          const enfant = fermetures.get(p.value)
          if (!enfant?.reutilisable) fermeture.reutilisable = false
          if (!enfant?.inchange || precedent?.enfants.get(p.value) !== (enfant.cellule ?? enfant.precedent?.cellule)) fermeture.inchange = false
        }
      }
      const forme = formesDesArguments.get(objet)
      if (forme) {
        if (!observer(forme)) return false
        const ctx = Object.getOwnPropertyDescriptor(forme, 'ctx')?.value
        if (!observer(ctx)) return false
        if (!Object.hasOwn(forme, 'e') || !ctx || !Object.hasOwn(ctx, 'f') || !Object.hasOwn(ctx, 'env')) stable = false
        const env = ctx && Object.getOwnPropertyDescriptor(ctx, 'env')?.value
        if (!observer(env)) return false
        if (env && !Object.hasOwn(env, 'args')) stable = false
      }
      if (fermeture) {
        fermeture.actif = false
        if (fermeture.eligible) {
          fermeture.preuve = preparerPreuve()
          for (const p of proprietes) {
            const enfant = p.value && typeof p.value === 'object' && fermetures.get(p.value)?.preuve
            if (enfant) enfant.parents.add(fermeture.preuve)
          }
        }
      }
      return true
    }
    if (!ferme && strict && (Object.hasOwn(Array.prototype, 'toJSON') || Object.hasOwn(Object.prototype, 'toJSON') ||
      !observer(racine) || !stable)) return null
    const descripteurs = new Map()
    const table = []
    const sousDescripteurs = new Map()
    const possedes = new WeakSet()
    const tuple = (...valeurs) => { possedes.add(valeurs); return valeurs }
    const liste = cellules ? marqueursBooleens.liste : Symbol()
    const objet = cellules ? marqueursBooleens.objet : Symbol()
    const fin = cellules ? marqueursBooleens.fin : Symbol()
    const enfant = cellules ? marqueursBooleens.enfant : Symbol()
    const signatureDe = (tokens) => {
      let signature = ''
      for (const token of tokens) {
        if (token === liste) signature += 'L;'
        else if (token === objet) signature += 'O;'
        else if (token === fin) signature += 'F;'
        else if (token === enfant) signature += 'E;'
        else if (token === null) signature += 'Z;'
        else if (typeof token === 'string') signature += `S${token.length}:${token}`
        else if (typeof token === 'boolean') signature += token ? 'B1;' : 'B0;'
        else signature += `N${token};`
      }
      return signature
    }
    const pileDesTokens = new Set()
    const tokensDe = (v, tokens, projection = false) => {
      if (v === null || v === undefined || typeof v === 'symbol') { tokens.push(null); return true }
      const type = typeof v
      if (type === 'string' || type === 'boolean') { tokens.push(v); return true }
      if (type === 'number') { tokens.push(Number.isFinite(v) ? v + 0 : null); return true }
      if (type !== 'object') return false
      if (cellules && referencesBooleennes.has(v)) { tokens.push(v); return true }
      const lectureDirecte = possedes.has(v) && !Object.hasOwn(Array.prototype, 'toJSON') && !Object.hasOwn(Object.prototype, 'toJSON')
      if (!lectureDirecte && !projection && (types.isProxy(v) || !Array.isArray(v) || Object.getPrototypeOf(v) !== Array.prototype ||
        Object.hasOwn(v, 'toJSON') || Object.hasOwn(Array.prototype, 'toJSON') || Object.hasOwn(Object.prototype, 'toJSON'))) return false
      const locaux = []
      if (lectureDirecte || Array.isArray(v)) {
        if (pileDesTokens.has(v)) return false
        pileDesTokens.add(v)
        locaux.push(liste)
        let exact = true
        for (let i = 0; i < v.length; i++) {
          if (lectureDirecte) {
            if (!tokensDe(v[i], locaux, projection)) { exact = false; break }
            continue
          }
          const p = Object.getOwnPropertyDescriptor(v, i)
          if (!p || !Object.hasOwn(p, 'value') || !tokensDe(p.value, locaux, projection)) { exact = false; break }
        }
        pileDesTokens.delete(v)
        if (!exact) return false
      } else {
        locaux.push(objet)
        for (const nom of Object.keys(v)) {
          locaux.push(nom)
          if (!tokensDe(v[nom], locaux, true)) return false
        }
      }
      locaux.push(fin)
      if (cellules) { tokens.push(enfant, celluleDe(locaux)); return true }
      const signature = signatureDe(locaux)
      if (!sousDescripteurs.has(signature)) sousDescripteurs.set(signature, sousDescripteurs.size)
      tokens.push(enfant, sousDescripteurs.get(signature))
      return true
    }
    const interner = (descriptor) => {
      let tokens = []
      let entree = descriptor
      if (!tokensDe(descriptor, tokens)) {
        stable = false
        tokens = []
        entree = parLeMoteur(descriptor)
        tokensDe(entree, tokens, true)
      }
      if (cellules) return celluleDe(tokens)
      const signature = signatureDe(tokens)
      if (!descripteurs.has(signature)) {
        descripteurs.set(signature, table.length)
        table.push(entree)
      }
      return descripteurs.get(signature)
    }
    const contexteDe = (ctx) => {
      const preuveBooleenne = referenceDe(ctx.preuveBooleenne)
      const chaine = []
      for (let env = ctx.env; env; env = env.parent) {
        observer(env)
        chaine.push(tuple('env', env.fn, env.args ? referenceDe(env.args) : null, env.params ? referenceDe(env.params) : null))
      }
      return interner(tuple('contexte', ctx.f, preuveBooleenne, tuple(...chaine)))
    }
    const memo = new WeakMap()
    const references = ferme ? referencesPrivees : memo
    const pile = new Map()
    const proprietesDeLaPile = []
    /** Les références des éléments d'une liste, lus par ses descripteurs propres `proprietes` (index absent : `undefined`),
     *  `projete` transmis. */
    const elementsDe = (proprietes, projete) => {
      const elements = new Array(proprietes.length.value)
      for (let i = 0; i < elements.length; i++) elements[i] = referenceDe(Object.hasOwn(proprietes, i) ? proprietes[i].value : undefined, i, projete)
      return elements
    }
    /** La référence de `v`, `k` reçu par `toJSON` : la donnée plate se parcourt, toute autre valeur vaut par sa
     *  projection JSON, que `projete` parcourt sans la rejuger (`tokensDe`, `projection`) ; le `faire` de `cleCanonique`
     *  n'en reçoit que `v`. */
    const referenceDe = (v, k = '', projete = false) => {
      if (cellules && v && typeof v === 'object' && referencesBooleennes.has(v)) return v
      if (v === null || typeof v !== 'object') return interner(tuple(typeof v, v))
      if (ferme) {
        const deja = references.get(v)
        if (deja !== undefined) return deja
      }
      observer(v)
      if (ferme) objetsCles.add(v)
      const rang = pile.get(v)
      if (rang !== undefined) return !strict && formesDesArguments.has(v) ? interner(tuple('coupe', elementsDe(proprietesDeLaPile[rang], projete)))
        : interner(tuple('cycle', pile.size - rang))
      if (references.has(v)) return references.get(v)
      const proprietes = projete ? Object.getOwnPropertyDescriptors(v) : donneePlate(v)
      if (!proprietes) return referenceDe(parLeMoteur({ [k]: v })[k], k, true)
      const preuve = preuveDe(v)
      if (preuve) {
        references.set(v, preuve.cellule)
        return preuve.cellule
      }
      const fermeture = fermetures.get(v)
      if (cellules && fermeture?.reutilisable && !fermeture.eligible && fermeture.inchange && revisionAvant === revisionDesFormes) {
        references.set(v, fermeture.precedent.cellule)
        return fermeture.precedent.cellule
      }
      pile.set(v, pile.size)
      proprietesDeLaPile.push(proprietes)
      const forme = formesDesArguments.get(v)
      const descriptor = forme ? tuple('argument', elementsDe(proprietes, projete), referenceDe(forme.e),
        litSonContexte(forme.e) ? contexteDe(forme.ctx) : null)
        : Array.isArray(v) ? tuple('liste', elementsDe(proprietes, projete))
        : tuple('objet', Object.keys(v).sort().map((nom) => tuple(nom, referenceDe(proprietes[nom].value, nom, projete))))
      pile.delete(v)
      proprietesDeLaPile.pop()
      const reference = interner(descriptor)
      references.set(v, reference)
      if (cellules && stable && fermetures.get(v)?.eligible && revisionAvant === revisionDesFormes)
        sousGraphesGeles.set(v, { cellule: reference, preuve: fermetures.get(v).preuve })
      if (cellules && stable && fermeture?.reutilisable && !fermeture.eligible && revisionAvant === revisionDesFormes)
        sousGraphesRevalides.set(v, { slots: fermeture.slots, cellule: reference, enfants: new Map(fermeture.slots.proprietes
          .filter((p) => p.value && typeof p.value === 'object' && !referencesBooleennes.has(p.value))
          .map((p) => [p.value, references.get(p.value)])) })
      return reference
    }
    const reference = faire({ interner, referenceDe: (v) => referenceDe(v), tuple })
    const cle = cellules ? reference : JSON.stringify([reference, table])
    if (stable && cache) {
      const records = [...objets.values()]
      const certificat = ferme ? null : certifier(records)
      cache.set(racine, { cle, strict, cellules, objets: records, certificat })
    }
    return cle
    } catch (erreur) {
      if (ferme || !strict || !(erreur instanceof RangeError)) throw erreur
      return null
    }
  }
  const texteDeCle = (cle) => {
    if (!referencesBooleennes.has(cle)) return cle
    if (cle.tokens[0] === compositionDeCle) return cle.tokens.slice(1).map(texteDeCle).join('')
    const references = new Map()
    const table = []
    const descriptorDe = (cellule) => {
      const tokens = cellule.tokens
      let index = 0
      const valeur = () => {
        const token = tokens[index++]
        if (token === marqueursBooleens.enfant) return descriptorDe(tokens[index++])
        if (referencesBooleennes.has(token)) return referenceDe(token)
        if (token === marqueursBooleens.liste) {
          const rendu = []
          while (tokens[index] !== marqueursBooleens.fin) rendu.push(valeur())
          index++
          return rendu
        }
        if (token === marqueursBooleens.objet) {
          const entrees = []
          while (tokens[index] !== marqueursBooleens.fin) entrees.push([tokens[index++], valeur()])
          index++
          return Object.fromEntries(entrees)
        }
        return token
      }
      const rendu = valeur()
      if (index !== tokens.length) throw new Error('CLE_STRUCTURELLE_DESCRIPTOR_INVALIDE')
      return rendu
    }
    const referenceDe = (cellule) => {
      if (!references.has(cellule)) {
        const descriptor = descriptorDe(cellule)
        references.set(cellule, table.length)
        table.push(descriptor)
      }
      return references.get(cellule)
    }
    return JSON.stringify([referenceDe(cle), table])
  }
  const composerCle = (...parties) => ferme && parties.some((x) => referencesBooleennes.has(x))
    ? celluleDe([compositionDeCle, ...parties]) : parties.join('')
  const cleDesValeurs = (faire, racine, cache) => cleCanonique(faire, racine, cache, ferme ? 'cellules' : 'texte')
  /** La clé d'une valeur ; un objet rendu vaut par sa clé canonique (`cleDesValeurs`). */
  const cleDe = (v) => {
    if ('booleen' in v) return `b${v.booleen}`
    if ('scalaire' in v) return `s${v.scalaire}`
    if ('native' in v) return `native:${v.native}`
    if ('poignee' in v) return cleDesValeurs(({ referenceDe }) => referenceDe(v), v, clesDesValeurs)
    if ('chemin' in v) return `c${v.chemin}:${v.sous ?? ''}`
    if ('espace' in v) return `e${v.espace}:${v.cheminExterne}`
    if ('fragment' in v) return composerCle('d', cleDe(v.fragment))
    if ('couvertureCorpusEntier' in v) return `u${JSON.stringify({ couvertureCorpusEntier: v.couvertureCorpusEntier })}`
    if ('texte' in v) return `t${v.texte}`
    if ('non' in v) return `n${v.non}`
    if ('relais' in v) return `r${v.relais}`
    if ('fn' in v) return `f${v.fn.f}#${v.fn.id}`
    if ('hors' in v) return 'h'
    if ('absent' in v) return 'a'
    return cleDesValeurs(({ referenceDe }) => referenceDe(v), v, clesDesValeurs)
  }
  const uniques = (vals) => ferme && vals.length < 2 ? [...vals] : [...new Map(vals.map((v) => [cleDe(v), v])).values()]
  /** La clé des arguments d'un appel (`cleDe`) : deux appels de mêmes valeurs ont la même. */
  const cleDesArgs = (args) => args ? cleDesValeurs(({ referenceDe }) => referenceDe(args), args, clesDesArguments) : ''
  const cles = { cleDesArgs: refusNomme(cleDesArgs), cleDe: refusNomme(cleDe), texteDeCle: refusNomme(texteDeCle),
    composerCle: refusNomme(composerCle), uniques: refusNomme(uniques), formesDesArguments }
  return Object.freeze(ferme ? cles : { ...cles, cleCanonique: refusNomme(cleCanonique) })
}
