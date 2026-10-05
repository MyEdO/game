import fs from 'node:fs'
import path from 'node:path'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { versPosix, versWindows } from './plateforme-win32-hooks.mjs'

const absent = (erreur) => erreur?.code === 'ENOENT' || erreur?.code === 'ENOTDIR'
const lireOuAbsent = (lire, valeurAbsente) => {
  try { return lire() }
  catch (erreur) {
    if (absent(erreur)) return valeurAbsente
    throw erreur
  }
}

// microsoft/typescript-go@2bd066d87f5bafd315be9f40889d0a60b9e58e0b internal/vfs/internal/internal.go decodeBytes
function decoderDisque(octets) {
  if (octets.length >= 2 && ((octets[0] === 0xff && octets[1] === 0xfe) || (octets[0] === 0xfe && octets[1] === 0xff))) {
    const contenu = octets.subarray(2)
    return new TextDecoder(octets[0] === 0xff ? 'utf-16le' : 'utf-16be', { ignoreBOM: true })
      .decode(contenu.subarray(0, contenu.length - contenu.length % 2))
  }
  const debut = octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf ? 3 : 0
  return octets.subarray(debut).toString('utf8')
}

const disqueHote = {
  readFile: (nom) => lireOuAbsent(() => decoderDisque(fs.readFileSync(nom)), null),
  fileExists: (nom) => lireOuAbsent(() => fs.statSync(nom).isFile(), false),
  directoryExists: (nom) => lireOuAbsent(() => fs.statSync(nom).isDirectory(), false),
  getAccessibleEntries: (nom) => lireOuAbsent(() => {
    const files = []
    const directories = []
    for (const enfant of listerDossier(nom)) {
      const stat = lireOuAbsent(() => fs.statSync(path.join(nom, enfant)), null)
      if (stat?.isFile()) files.push(enfant)
      else if (stat?.isDirectory()) directories.push(enfant)
    }
    return { files, directories }
  }, { files: [], directories: [] }),
  realpath: (nom) => lireOuAbsent(() => fs.realpathSync(nom), nom),
}

// typescript/dist/api/fs.d.ts
export function fsSousWin32(original = {}, disque = disqueHote) {
  const resultat = { ...original }
  for (const nom of ['readFile', 'fileExists', 'directoryExists', 'getAccessibleEntries', 'realpath']) {
    resultat[nom] = (chemin) => {
      const valeur = original[nom]?.(chemin)
      if (valeur !== undefined) return valeur
      const lue = disque[nom](versPosix(chemin))
      return nom === 'realpath' ? versWindows(lue) : lue
    }
  }
  return resultat
}
