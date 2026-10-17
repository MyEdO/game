import { resolve } from 'node:path'
import { lstatSync } from 'node:fs'
import { canoniser as canoniserPartage } from '../../docs/lib/chemin-mesure.mjs'

const erreur = (raison) => { throw new Error(raison) }
const entete = /^\*\*\* (Add|Update|Delete) File: (.+)$/

export function resoudreCheminPatchCodex(path, { evenement, lstat = lstatSync, canoniser = canoniserPartage } = {}) {
  const pre = evenement !== 'PostToolUse'
  if (pre) {
    let feuille
    try { feuille = lstat(path) }
    catch (e) { if (e.code !== 'ENOENT') erreur(`feuille illisible : ${path} — ${e.code ?? e.message}`) }
    if (feuille?.isSymbolicLink()) erreur(`feuille symbolique : ${path} — la suppression/recréation lexicale et sa cible ne sont pas reconstructibles`)
  }
  return canoniser(path, { strict: pre })
}

export function lirePatchCodex(texte) {
  if (typeof texte !== 'string') erreur('patch absent ou non-chaîne')
  const lignes = texte.trim().split(/\r?\n/)
  if (lignes.shift() !== '*** Begin Patch' || lignes.pop() !== '*** End Patch') erreur('enveloppe de patch invalide')
  const fichiers = []
  for (let i = 0; i < lignes.length;) {
    const titre = entete.exec(lignes[i++])
    if (!titre) erreur('entête de fichier inconnue')
    if (titre[2].trim() !== titre[2] || titre[2].includes('\0')) erreur('chemin de fichier ambigu')
    const fichier = { type: titre[1], path: titre[2], hunks: [] }
    if (fichier.type === 'Update' && lignes[i]?.startsWith('*** Move to: ')) fichier.move = lignes[i++].slice(13)
    if (fichier.move !== undefined && (!fichier.move || fichier.move.trim() !== fichier.move || fichier.move.includes('\0'))) erreur('destination Move ambiguë')
    const corps = []
    while (i < lignes.length && !entete.test(lignes[i])) corps.push(lignes[i++])
    if (fichier.type === 'Add') {
      if (corps.some((l) => !l.startsWith('+'))) erreur('ligne Add invalide')
      fichier.content = corps.map((l) => l.slice(1)).join('\n') + (corps.length ? '\n' : '')
    } else if (fichier.type === 'Delete') {
      if (corps.length) erreur('corps Delete inattendu')
    } else {
      let hunk
      for (const ligne of corps) {
        if (ligne === '@@' || ligne.startsWith('@@ ')) {
          hunk = { contexte: ligne === '@@' ? null : ligne.slice(3), lignes: [], eof: false }
          fichier.hunks.push(hunk)
        } else if (ligne === '*** End of File' && hunk && !hunk.eof) hunk.eof = true
        else if (hunk && !hunk.eof && /^[ +-]/.test(ligne)) hunk.lignes.push(ligne)
        else erreur('hunk Update inconnu ou incomplet')
      }
      if (!fichier.hunks.length || fichier.hunks.some((h) => !h.lignes.length)) erreur('Update sans changement jugeable')
    }
    fichiers.push(fichier)
  }
  if (!fichiers.length) erreur('patch vide')
  return fichiers
}

const trouver = (lignes, motif, debut, eof) => {
  const candidats = []
  for (let i = debut; i <= lignes.length - motif.length; i++) {
    if (eof && i + motif.length !== lignes.length) continue
    if (motif.every((l, j) => lignes[i + j].texte === l)) candidats.push(i)
  }
  if (candidats.length !== 1) erreur('contexte absent ou ambigu : reconstruction exacte impossible')
  return candidats[0]
}

export function reconstruirePatchCodex(avant, hunks) {
  if (typeof avant !== 'string') erreur('préimage illisible')
  const lignes = [...avant.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)].filter((m) => m[0] !== '').map((m) => ({ texte: m[1], fin: m[2] }))
  const fin = lignes.find((l) => l.fin)?.fin || '\n'
  const changements = []
  let curseur = 0
  for (const hunk of hunks) {
    if (hunk.contexte !== null) curseur = trouver(lignes, [hunk.contexte], curseur, false) + 1
    const anciens = hunk.lignes.filter((l) => l[0] !== '+').map((l) => l.slice(1))
    const debut = anciens.length ? trouver(lignes, anciens, curseur, hunk.eof) : lignes.length
    const neufs = []
    let ancien = debut
    for (const ligne of hunk.lignes) {
      if (ligne[0] === ' ') neufs.push(lignes[ancien++])
      else if (ligne[0] === '-') ancien++
      else neufs.push({ texte: ligne.slice(1), fin })
    }
    changements.push({ debut, fin: debut + anciens.length, neufs })
    curseur = debut + anciens.length
  }
  let position = 0
  const resultat = []
  for (const changement of changements) {
    if (changement.debut < position) erreur('hunks qui se chevauchent')
    resultat.push(...lignes.slice(position, changement.debut), ...changement.neufs)
    position = changement.fin
  }
  resultat.push(...lignes.slice(position))
  return resultat.map((l) => l.texte + (l.fin || fin)).join('')
}

function imagesTerminales(fichiers, lire, cleDe) {
  const terminal = new Map()
  for (const fichier of fichiers) {
    const { path, destination } = fichier
    if (destination !== path) terminal.set(cleDe(path), { path, present: false })
    terminal.set(cleDe(destination), { path: destination, present: fichier.type !== 'Delete' })
  }
  const ecritures = []
  const diagnostics = []
  for (const { path, present } of terminal.values()) {
    if (!present) { ecritures.push({ path, content: '' }); continue }
    try {
      const content = lire(path)
      if (typeof content !== 'string') erreur('postimage attendue présente mais absente')
      ecritures.push({ path, content })
    } catch (e) {
      diagnostics.push(`apply_patch PostToolUse : ${path} — ${e.message}`)
    }
  }
  return { ecritures, ...(diagnostics.length ? { diagnosticPost: diagnostics.join('\n') } : {}) }
}

export function normaliserPatchCodex(entree, { base, lire, resoudre = (path) => resolve(base, path), platform = process.platform }) {
  try {
    if (Object.keys(entree?.tool_input ?? {}).some((cle) => cle !== 'command')) erreur('clé de patch inconnue')
    const fichiers = lirePatchCodex(entree?.tool_input?.command)
    const etat = new Map()
    const cleDe = (path) => platform === 'win32' ? path.toLowerCase() : path
    const resolus = fichiers.map((fichier) => {
      const path = resoudre(fichier.path)
      const destination = fichier.move ? resoudre(fichier.move) : path
      if (fichier.move !== undefined && cleDe(path) === cleDe(destination)) erreur('Move vers sa propre source')
      return { ...fichier, path, destination }
    })
    if (entree.hook_event_name === 'PostToolUse') return { ...entree, ...imagesTerminales(resolus, lire, cleDe) }
    const lireUneFois = (path) => {
      const cle = cleDe(path)
      if (!etat.has(cle)) etat.set(cle, lire(path))
      return etat.get(cle)
    }
    const ops = []
    for (const fichier of resolus) {
      const { path, destination } = fichier
      const avant = lireUneFois(path)
      if (fichier.type !== 'Add' && typeof avant !== 'string') erreur('préimage absente')
      if (fichier.type === 'Add' && avant !== null) erreur('Add vers un fichier existant')
      if (destination !== path && lireUneFois(destination) !== null) erreur('destination Move existante')
      const content = fichier.type === 'Add' ? fichier.content : fichier.type === 'Delete' ? '' : reconstruirePatchCodex(avant, fichier.hunks)
      if (destination !== path) ops.push({ path, old_string: avant, content: '', existeAvant: true })
      ops.push({ path: destination, old_string: destination === path ? avant ?? '' : '', content, existeAvant: destination === path && avant !== null })
      etat.set(cleDe(path), fichier.type === 'Delete' || destination !== path ? null : content)
      etat.set(cleDe(destination), fichier.type === 'Delete' ? null : content)
    }
    return { ...entree, ecritures: ops }
  } catch (e) {
    if (entree.hook_event_name === 'PostToolUse') return { ...entree, ecritures: [], diagnosticPost: `apply_patch PostToolUse : ${e.message}` }
    return { ...entree, ecritures: [], nonJugeable: { raison: `apply_patch : ${e.message}`, canal: 'ctx_patch avec une préimage ancrée' } }
  }
}

export const CONTRATS_DE_DERIVATION = [{ fonction: resoudreCheminPatchCodex, lectures: 'corpus' }]
