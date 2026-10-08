import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canoniser, relatifSousRacine } from '../../docs/lib/chemin-mesure.mjs'
import { OPERATIONS_FS, ouvreEnEcriture } from './ecrituresFichiers.mjs'

export function installer({ racine, signaler }) {
  const base = canoniser(racine, { strict: true })
  const descripteurs = new Map()
  const originaux = []
  const envelopper = (objet, nom, fabrique) => {
    if (typeof objet[nom] !== 'function') return
    const original = objet[nom]
    originaux.push(() => { objet[nom] = original })
    objet[nom] = fabrique(original)
  }
  const cheminDe = (p) => typeof p === 'number' ? descripteurs.get(p)
    : p instanceof URL ? fileURLToPath(p) : Buffer.isBuffer(p) ? p.toString() : typeof p === 'string' ? resolve(p) : p && typeof p.fd === 'number' ? descripteurs.get(p.fd) : null
  const estIPC = (chemin) => process.platform === 'win32' && /^\\\\[.?]\\pipe\\/i.test(chemin)
  const cibleOuverte = (p) => {
    const chemin = cheminDe(p)
    return estIPC(chemin) ? chemin : canoniser(chemin, { strict: true })
  }
  const verifier = (nom, p) => {
    const chemin = cheminDe(p)
    if (!chemin) return
    if (estIPC(chemin)) return
    const physique = (c) => OPERATIONS_FS[nom]?.entree
      ? join(canoniser(dirname(c), { strict: true }), basename(c)) : canoniser(c, { strict: true })
    const relatif = relatifSousRacine(base, chemin, (c) => resolve(c)) ?? relatifSousRacine(base, chemin, physique)
    if (relatif === null) return
    const message = `[tests] REFUS écriture dans l'arbre : ${nom} ${relatif || '.'}`
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
  if (relatifSousRacine(canoniser(racine), sortie) !== null) throw new Error('journal de refus des tests sous la racine')
  globalThis[marque] = true
  installer({ racine, signaler: (message) => append(`${sortie}.${process.pid}.jsonl`, JSON.stringify(message) + '\n') })
}
