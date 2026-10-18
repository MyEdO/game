import { statSync } from 'node:fs'
import { join } from 'node:path'
import { ecrireOuVerifier } from '../docs/lib/ecriture-derives.mjs'
import { ancreDeTitre } from './lib/ancres.mjs'
import { booksDe, coeursDe, coeursDuRegistre, domainesDe, livresDeCoeur, REGISTRE_LIVRES } from './_lib.mjs'

export const RAWDIR = 'docs/raw'
export const NOM_INDEX = '00-index.md'
export const RAPPORT = 'docs/raw/atlas.generated.md'
export const titreDuCoeur = (coeur) => `Domaines ${coeur}`
export const ancreDuCoeur = (coeur) => ancreDeTitre(titreDuCoeur(coeur))

function indexesDesCoeurs(rawDir, registre) {
  return new Map(coeursDuRegistre(registre).map((coeur) => {
    try { return [coeur, statSync(join(rawDir, coeur, NOM_INDEX)).isFile()] }
    catch (erreur) {
      if (erreur.code === 'ENOENT' || erreur.code === 'ENOTDIR') return [coeur, false]
      throw erreur
    }
  }))
}

export function lignesDesCoeurs(rawDir = RAWDIR, registre = REGISTRE_LIVRES) {
  return lignesDesCoeursDepuisIndexes(registre, indexesDesCoeurs(rawDir, registre))
}

function lignesDesCoeursDepuisIndexes(registre, indexes) {
  const coeurs = coeursDe(registre)
  const livresDuRegistre = livresDeCoeur(booksDe(registre), coeurs)
  return coeursDuRegistre(registre).map((coeur) => {
    const livres = livresDuRegistre.filter(([abbr]) => coeurs.get(abbr) === coeur).map(([abbr]) => abbr)
    const sigles = livres.length ? ` — livre(s) de cœur : ${livres.join(', ')}` : ''
    return indexes.get(coeur) ? `- [\`${coeur}/\`](${coeur}/${NOM_INDEX})${sigles}` : `- \`${coeur}/\` — dossier à créer${sigles}`
  })
}

export function lignesDesDomaines(domaines, coeur) {
  return ['| Domaine | Titre |', '|---|---|', ...domaines.map((d) => d.ticket
    ? `| \`${d.cle}\` | ${d.titre} — aire cadrée, fiche à extraire (${d.ticket}) |`
    : `| [\`${d.cle}\`](${coeur ? `${coeur}/` : ''}${d.cle}.md) | ${d.titre} |`)]
}

export function rendre(rawDir = RAWDIR, registre = REGISTRE_LIVRES, registreDomaines) {
  const indexes = indexesDesCoeurs(rawDir, registre)
  const lignes = ['# Atlas RAW — Index calculé', '', '> Généré par `node scripts/raw/build-atlas-index.mjs`.', '', '## Cœurs', '', ...lignesDesCoeursDepuisIndexes(registre, indexes), '']
  for (const [coeur, existe] of indexes) {
    if (!existe) continue
    lignes.push(`## ${titreDuCoeur(coeur)}`, '', ...lignesDesDomaines(domainesDe(coeur, registreDomaines), coeur), '')
  }
  return new Map([[RAPPORT, lignes.join('\n')]])
}

function main() {
  try {
    for (const [path, out] of rendre()) ecrireOuVerifier({ path, out, check: process.argv.includes('--check'),
      staleMsg: `build-atlas-index — ${path} PÉRIMÉ`, rerunMsg: '→ node scripts/raw/build-atlas-index.mjs' })
  } catch (e) {
    console.error(String(e?.message ?? e))
    process.exitCode = 1
  }
}

if (import.meta.main) main()
