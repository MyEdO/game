// CLI de démonstration de la découpe : liste les sections adressables d'un chapitre, ou rend le
// texte VERBATIM d'un fragment (blocs ou cellule) avec ses folios et son empreinte. `--fin` pose la
// section de fin d'un intervalle : `b` de `--blocks a-b` est alors un bloc de cette section.
// usage: node scripts/source/decoupe-cli.mjs <book> <ch> [--sec <slug> [--occ N]
//        [--blocks a-b [--fin <slug> [--fin-occ N]] | --row <clé> --col <en-tête>]]
import { estErreur, fragmentBlocs, fragmentCellule, resoudreFragment } from '../../src/data/source/decoupe.ts'
import { fichierChapitre, lireChapitre } from './lecteur-fs.mjs'

const [book, ch, ...rest] = process.argv.slice(2)
if (!book || !ch) {
  console.error(
    'usage: node scripts/source/decoupe-cli.mjs <book> <ch> [--sec <slug> [--occ N]' +
    ' [--blocks a-b [--fin <slug> [--fin-occ N]] | --row <clé> --col <en-tête>]]',
  )
  process.exit(2)
}
const arg = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
const chapitre = lireChapitre(book, ch)
if (!chapitre) { console.error(`chapitre introuvable : ${book} ch.${ch}`); process.exit(1) }

const sec = arg('--sec')
if (sec === undefined) {
  console.log(`${fichierChapitre(book, ch)}  (${chapitre.sections.length} sections)`)
  for (const s of chapitre.sections) {
    const folios = [...new Set([s.folio, ...s.blocks.flatMap((b) => b.folios)].filter((f) => f != null))]
    console.log(
      `  l.${String(s.line).padStart(5)}  h${s.level}  ${s.slug || '(preambule)'}#${s.occ}` +
      `  blocs=${s.blocks.length}${folios.length ? `  folios=${folios.join(',')}` : ''}` +
      `  « ${s.title} »`,
    )
  }
  process.exit(0)
}

const secOcc = Number(arg('--occ') ?? 1)
const section = chapitre.sections.find((s) => s.slug === sec && s.occ === secOcc)
if (!section) { console.error(`section inconnue : ${sec}#${secOcc}`); process.exit(1) }

const finSec = arg('--fin')
const finSecOcc = finSec === undefined ? undefined : Number(arg('--fin-occ') ?? 1)
const fin = finSec === undefined ? section : chapitre.sections.find((s) => s.slug === finSec && s.occ === finSecOcc)
if (!fin) { console.error(`section de fin inconnue : ${finSec}#${finSecOcc}`); process.exit(1) }

const row = arg('--row')
const blocks = arg('--blocks')
const [b0, b1] = blocks ? blocks.split('-').map(Number) : [0, fin.blocks.length - 1]
// La CLI FABRIQUE l'empreinte (c'est ce qu'on vient chercher pour poser une adresse), puis résout
// AVEC elle — exactement le chemin que suivra le consommateur de l'adresse.
const frag = row !== undefined
  ? fragmentCellule(chapitre, { sec, secOcc, row, col: arg('--col') ?? '' })
  : fragmentBlocs(chapitre, { sec, secOcc, b0, finSec, finSecOcc, b1: Number.isFinite(b1) ? b1 : b0 })
const out = resoudreFragment(chapitre, frag)
if (estErreur(out)) { console.error(`${out.error} : ${out.detail}`); process.exit(1) }
console.error(`# folios: ${out.folios.join(',') || '-'}  sum: ${frag.sum}`)
console.log(out.md)
