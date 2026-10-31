import { availableParallelism, tmpdir } from 'node:os'
import { readFileSync, writeFileSync, openSync, closeSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

export async function selectionnerEnConstruction(cheminGlb, manifeste) {
  const racineTemporaire = resolve(tmpdir())
  const dossier = mkdtempSync(join(racineTemporaire, 'wfrp-appuis-'))
  if (dirname(resolve(dossier)) !== racineTemporaire) throw new Error(`appuis : dossier temporaire hors racine ${dossier}`)
  const entree = join(dossier, 'entree.json')
  const nombre = Math.min(16, Math.max(1, availableParallelism() - 2))
  const actifs = new Set()
  let travaux = []
  try {
    writeFileSync(entree, JSON.stringify(manifeste))
    console.log(`APPUIS_PARTITIONS ${nombre}`)
    travaux = Array.from({ length: nombre }, (_, indice) => new Promise((ok, refus) => {
      const sortie = join(dossier, `${indice}.json`)
      const cheminJournal = join(dossier, `${indice}.log`)
      const journal = openSync(cheminJournal, 'w')
      const enfant = spawn(process.execPath, [fileURLToPath(import.meta.url), '--ouvrier', cheminGlb, entree, sortie, String(indice), String(nombre)], { stdio: ['ignore', journal, journal], windowsHide: true })
      actifs.add(enfant)
      let erreur
      enfant.once('error', (cause) => { erreur = cause })
      enfant.once('close', (code) => {
        actifs.delete(enfant); closeSync(journal)
        process.stdout.write(readFileSync(cheminJournal, 'utf8'))
        if (erreur || code !== 0) { refus(new Error(`appuis : partition ${indice}/${nombre} sortie ${code}`, { cause: erreur })); return }
        try { ok(JSON.parse(readFileSync(sortie, 'utf8'))) } catch (cause) { refus(cause) }
      })
    }))
    const resultats = await Promise.all(travaux)
    return [...new Map(resultats.flat().map((c) => [JSON.stringify(c), c])).values()]
  } finally {
    for (const enfant of actifs) enfant.kill()
    await Promise.allSettled(travaux)
    rmSync(dossier, { recursive: true, force: true })
  }
}

if (process.argv[2] === '--ouvrier') {
  const [, , , cheminGlb, entree, sortie, indice, nombre] = process.argv
  try {
    const { selectionnerAppuis } = await chargerEvaluateur('selectionAppuis.ts')
    const candidats = await selectionnerAppuis(readFileSync(cheminGlb), JSON.parse(readFileSync(entree, 'utf8')), { indice: Number(indice), nombre: Number(nombre) })
    writeFileSync(sortie, JSON.stringify(candidats))
    process.exit(0)
  } catch (erreur) {
    console.error(erreur)
    process.exit(1)
  }
}
