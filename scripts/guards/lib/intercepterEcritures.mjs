import fs from 'node:fs'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'
import { URL as NodeURL, fileURLToPath } from 'node:url'
import { canoniser, relatifSousRacine } from '../../docs/lib/chemin-mesure.mjs?wfrp-hote-interception'
import { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'

const lecteursHote = { statSync: fs.statSync, existsSync: fs.existsSync, realpathSync: fs.realpathSync }
const realpathNativeHote = fs.realpathSync.native
const cheminsHote = { resolve: path.resolve, dirname: path.dirname, join: path.join, relative: path.relative, isAbsolute: path.isAbsolute, basename: path.basename }
const cwdHote = process.cwd.bind(process)
const resoudre = (p) => cheminsHote.resolve(cwdHote(), p)

function surHote(geste) {
  const lecteursEntree = { ...fs }
  const cheminsEntree = { ...path }
  const nativeEntree = lecteursHote.realpathSync.native
  const cwdEntree = process.cwd
  try {
    Object.assign(fs, lecteursHote)
    lecteursHote.realpathSync.native = realpathNativeHote
    Object.assign(path, cheminsHote)
    process.cwd = cwdHote
    return geste()
  } finally {
    process.cwd = cwdEntree
    for (const nom of Object.keys(cheminsHote)) path[nom] = cheminsEntree[nom]
    lecteursHote.realpathSync.native = nativeEntree
    for (const nom of Object.keys(lecteursHote)) fs[nom] = lecteursEntree[nom]
  }
}

const canonique = (p) => surHote(() => canoniser(p, { strict: true }))
const relatif = (base, p, physique) => surHote(() => relatifSousRacine(base, p, physique))

export function installer({ racine, signaler }) {
  const base = canonique(resoudre(racine))
  const descripteurs = new Map()
  const originaux = []
  const envelopper = (objet, nom, fabrique) => {
    if (typeof objet[nom] !== 'function') return
    const original = objet[nom]
    originaux.push(() => { objet[nom] = original })
    objet[nom] = fabrique(original)
  }
  const cheminDe = (p) => typeof p === 'number' ? descripteurs.get(p)
    : p instanceof NodeURL ? fileURLToPath(p) : Buffer.isBuffer(p) ? resoudre(p.toString()) : typeof p === 'string' ? resoudre(p) : p && typeof p.fd === 'number' ? descripteurs.get(p.fd) : null
  const estIPC = (chemin) => process.platform === 'win32' && /^\\\\[.?]\\pipe\\/i.test(chemin)
  const cibleOuverte = (p) => {
    const chemin = cheminDe(p)
    return estIPC(chemin) ? chemin : canonique(chemin)
  }
  const verifier = (nom, p) => {
    const chemin = cheminDe(p)
    if (!chemin) return
    if (estIPC(chemin)) return
    const physique = (c) => OPERATIONS_FS[nom]?.entree
      ? cheminsHote.join(canonique(cheminsHote.dirname(c)), cheminsHote.basename(c)) : canonique(c)
    const sousRacine = relatif(base, chemin, resoudre) ?? relatif(base, chemin, physique)
    if (sousRacine === null) return
    const message = `[tests] REFUS écriture dans l'arbre : ${nom} ${sousRacine || '.'}`
    signaler(message)
    throw new Error(message)
  }
  const verifierArguments = (nom, args) => {
    const definition = OPERATIONS_FS[nom]
    if (nom === 'createWriteStream' && args[1]?.fd !== undefined) verifier(nom, args[1].fd)
    if (definition.drapeaux !== undefined && !ouvreEnEcriture(args[definition.drapeaux])) return
    for (const indice of definition.chemins) verifier(nom, args[indice])
  }
  for (const [nom, definition] of Object.entries(OPERATIONS_FS)) {
    if (definition.drapeaux !== undefined) continue
    for (const objet of [fs, fs.promises]) envelopper(objet, nom, (original) => function (...args) {
      verifierArguments(nom, args)
      return original.apply(this, args)
    })
  }
  envelopper(fs, 'openSync', (original) => function (...args) {
    verifierArguments('openSync', args)
    const fd = original.apply(this, args)
    descripteurs.set(fd, cibleOuverte(args[0]))
    return fd
  })
  envelopper(fs, 'open', (original) => function (...args) {
    verifierArguments('open', args)
    const callback = args.pop()
    return original.call(this, ...args, (erreur, fd) => {
      if (!erreur) descripteurs.set(fd, cibleOuverte(args[0]))
      callback(erreur, fd)
    })
  })
  envelopper(fs.promises, 'open', (original) => async function (...args) {
    verifierArguments('open', args)
    const handle = await original.apply(this, args)
    descripteurs.set(handle.fd, cibleOuverte(args[0]))
    for (const [nom, definition] of Object.entries(OPERATIONS_FS)) {
      if (definition.drapeaux !== undefined || nom.endsWith('Sync') || definition.chemins[0] !== 0) continue
      envelopper(handle, nom, (methode) => function (...parametres) {
        verifier(nom, handle.fd)
        return methode.apply(this, parametres)
      })
    }
    envelopper(handle, 'truncate', (methode) => function (...parametres) {
      verifier('truncate', handle.fd)
      return methode.apply(this, parametres)
    })
    envelopper(handle, 'close', (methode) => async function (...parametres) {
      const fd = handle.fd
      const resultat = await methode.apply(this, parametres)
      descripteurs.delete(fd)
      return resultat
    })
    return handle
  })
  envelopper(fs, 'closeSync', (original) => function (fd, ...args) {
    const resultat = original.call(this, fd, ...args)
    descripteurs.delete(fd)
    return resultat
  })
  envelopper(fs, 'close', (original) => function (fd, callback) {
    return original.call(this, fd, (erreur) => {
      if (!erreur) descripteurs.delete(fd)
      callback(erreur)
    })
  })
  syncBuiltinESMExports()
  return () => {
    for (const restaurer of originaux.reverse()) restaurer()
    syncBuiltinESMExports()
  }
}

const racine = process.env.WFRP_TESTS_RACINE
const sortie = process.env.WFRP_TESTS_REFUS
const marque = Symbol.for('wfrp.tests.ecritures')
if (racine && !globalThis[marque]) {
  if (!sortie) throw new Error('interception des tests incomplète : WFRP_TESTS_REFUS absent')
  const append = fs.appendFileSync
  if (relatif(canonique(resoudre(racine)), resoudre(sortie), canonique) !== null) throw new Error('journal de refus des tests sous la racine')
  globalThis[marque] = true
  installer({ racine, signaler: (message) => append(`${sortie}.${process.pid}.jsonl`, JSON.stringify(message) + '\n') })
}
