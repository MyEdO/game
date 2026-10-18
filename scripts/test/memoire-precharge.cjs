'use strict'

const { isMainThread } = process.getBuiltinModule('node:worker_threads')
const dossier = process.env.WFRP_MEMOIRE_DOSSIER
if (isMainThread && dossier) {
  const { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync } = process.getBuiltinModule('node:fs')
  const { randomUUID } = process.getBuiltinModule('node:crypto')
  const generation = process.env.WFRP_MEMOIRE_GENERATION
  const echouer = () => { throw Object.assign(new Error('première mesure mémoire non acquittée'), { code: 'MESURE_MEMOIRE_INCOMPLETE' }) }
  if (!generation) echouer()
  const id = randomUUID()
  const base = dossier + '/emissions/' + id
  const challenges = base + '.challenges'
  mkdirSync(challenges)
  const publier = (fichier, valeur) => {
    const temporaire = fichier + '.' + randomUUID() + '.tmp'
    writeFileSync(temporaire, JSON.stringify(valeur), { flag: 'wx' })
    renameSync(temporaire, fichier)
  }
  const lire = (fichier) => {
    try { return JSON.parse(readFileSync(fichier, 'utf8')) }
    catch (cause) { if (cause.code === 'ENOENT') return null; throw cause }
  }
  const enveloppe = { version: 1, generation, id, pid: process.pid }
  publier(base + '.json', enveloppe)
  const echeance = Date.now() + 30_000
  const pause = new Int32Array(new SharedArrayBuffer(4))
  const nonces = new Set(), acquittementsVus = new Set()
  while (true) {
    if (Date.now() >= echeance) echouer()
    for (const nom of readdirSync(challenges).filter((n) => n.endsWith('.json'))) {
      const challenge = lire(challenges + '/' + nom)
      if (challenge.version !== 1 || challenge.generation !== generation || challenge.id !== id || typeof challenge.identifiant !== 'string' || !challenge.identifiant || typeof challenge.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(challenge.nonce)) echouer()
      if (nom !== challenge.nonce + '.json') echouer()
      const nonce = challenge.nonce
      if (!nonces.has(nonce)) {
        publier(base + '.' + nonce + '.reponse', { ...enveloppe, identifiant: challenge.identifiant, nonce })
        nonces.add(nonce)
      }
    }
    let acquittee = false
    for (const nom of readdirSync(dossier + '/acquittements').filter((n) => n.endsWith('.json'))) {
      if (acquittementsVus.has(nom)) continue
      const ack = lire(dossier + '/acquittements/' + nom)
      if (ack.version !== 1 || ack.generation !== generation || !ack.emissions || typeof ack.emissions !== 'object') echouer()
      if (nonces.has(ack.emissions[id])) acquittee = true
      acquittementsVus.add(nom)
    }
    if (acquittee) break
    Atomics.wait(pause, 0, 0, 5)
  }
}
