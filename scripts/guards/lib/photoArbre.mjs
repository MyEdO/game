import { depotDe, etatDeLArbre } from './gitPorte.mjs'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { listerArbre } from './lister.mjs'

export function photoArbre(racine) {
  try {
    const etat = etatDeLArbre(depotDe(racine), { ignores: true, strict: true })
    const empreintes = {}
    for (const entree of etat) for (const chemin of entree.chemins) {
      if (chemin.split('/').includes('node_modules')) continue
      const cible = join(racine, chemin)
      let statut
      try { statut = lstatSync(cible) } catch (e) { if (e.code === 'ENOENT') continue; throw e }
      const fichiers = statut.isDirectory()
        ? listerArbre(cible, { descendre: (rel) => !rel.split('/').includes('node_modules') }).map((rel) => join(chemin, rel).replace(/\\/g, '/'))
        : [chemin]
      for (const fichier of fichiers.sort()) {
        const s = lstatSync(join(racine, fichier))
        if (s.isFile()) empreintes[fichier] = createHash('sha256').update(readFileSync(join(racine, fichier))).digest('hex')
        else if (s.isSymbolicLink()) empreintes[fichier] = `lien:${readlinkSync(join(racine, fichier))}`
      }
    }
    return { texte: JSON.stringify({ etat, empreintes }), erreur: null }
  } catch (e) {
    return { texte: null, erreur: e.message }
  }
}
