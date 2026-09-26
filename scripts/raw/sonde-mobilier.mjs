// SONDE du MOBILIER DE PAGE d'un livre extrait (#1739) : rend, fichier par fichier, les sites que le
// prédicat de `lib/mobilier.mjs` relève, classés, et dit lesquels une exemption AU SITE couvre
// (`scripts/guards/lib/mobilierExemptions.mjs`). Lecture seule.
//
// Le code ne NOMME aucun livre : le livre est un argument, son dossier vient du registre
// (`src/data/books.json`), sa liste de découpe et ses onglets de `scripts/raw/decoupes/<id>.json`.
//
// Usage : node scripts/raw/sonde-mobilier.mjs <id du livre>
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decoupeDe, livreExtraitDe, ongletsDe, readText } from './_lib.mjs'
import { mobilierDuDossier } from './lib/mobilier.mjs'

/** Chemin POSIX d'un dossier, sans `/` final. */
const posix = (dir) => String(dir).split('\\').join('/').replace(/\/$/, '')

/** Sites de mobilier d'un livre (`lib/mobilier.mjs#mobilierDuDossier`), lus sur le disque. */
export function sitesDuLivre(id) {
  const livre = livreExtraitDe(id)
  if (!livre) throw new Error(`sonde-mobilier : aucun livre extrait d'id « ${id} » au registre`)
  const dir = posix(livre.dir)
  return mobilierDuDossier(dir, (nom) => readText(`${dir}/${nom}`), decoupeDe(id), ongletsDe(id))
}

/** `NNN:ligne` d'un site. */
export const adresse = (s) => `${s.nnn}:${s.ligne}`

function main() {
  const [id] = process.argv.slice(2)
  if (!id) { console.error('usage : node scripts/raw/sonde-mobilier.mjs <id du livre>'); process.exitCode = 2; return }
  const sites = sitesDuLivre(id)
  for (const c of ['romain-seul', 'folio-nu', 'folio-tete', 'mot']) {
    const de = sites.filter((s) => s.classe === c)
    const lignes = new Set(de.map(adresse))
    console.log(`== ${c} : ${de.length} jeton(s) sur ${lignes.size} ligne(s), dont ${de.filter((s) => s.exemption).length} exempté(s)`)
    for (const s of de) console.log(`  ${adresse(s)} [${s.jeton}]${s.exemption ? ' EXEMPTÉ' : ''} ${s.texte.trim().slice(0, 100)}`)
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
