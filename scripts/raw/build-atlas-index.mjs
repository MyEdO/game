// Générateur des BLOCS dérivés des index de l'Atlas (#1825), tous par la même mécanique de marqueurs :
//   · `docs/raw/00-index.md` — la liste des CŒURS, DÉRIVÉE du registre des livres
//     (`src/data/books.json`, champ `coeur`) ;
//   · `docs/raw/<coeur>/00-index.md` — la liste des DOMAINES du cœur, DÉRIVÉE de
//     `scripts/raw/domaines.json`.
// Un cœur de plus au registre, un domaine de plus au sien, c'est une ligne de plus ici, sans qu'aucun
// doc ne se resaisisse. La population des pages à écrire est elle-même DÉRIVÉE (`pagesDeLAtlas`) :
// aucun chemin de cœur n'est écrit.
// Le reste de chaque page est MANUSCRIT : seuls les blocs entre marqueurs sont réécrits (patron
// `injecte` de `scripts/docs/build-all.mjs`).
// Re-run : node scripts/raw/build-atlas-index.mjs (`--check` : `declarerCorpsPerime`).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { declarerCorpsPerime } from '../docs/lib/empreinte-sources.mjs'
import { booksDe, coeursDe, coeursDuRegistre, domainesDe, livresDeCoeur, pagesDeLAtlas, REGISTRE_LIVRES } from './_lib.mjs'

export const RAWDIR = 'docs/raw'
export const NOM_INDEX = '00-index.md'
export const INDEX_PATH = join(RAWDIR, NOM_INDEX)
export const DEBUT = '<!-- ATLAS-COEURS:DEBUT -->'
export const FIN = '<!-- ATLAS-COEURS:FIN -->'
export const DEBUT_DOMAINES = '<!-- ATLAS-DOMAINES:DEBUT -->'
export const FIN_DOMAINES = '<!-- ATLAS-DOMAINES:FIN -->'
/** Acceptation DÉCLARÉE à la couture : toute page de cœur, pour COMPTER ce que le cœur porte. */
export const CLASSES = ['fiche', 'catalogue', 'auteur', 'epreuve']

/**
 * Les lignes du bloc : un cœur, son index, ses livres de cœur. PUR vis-à-vis de l'écriture.
 * Un cœur du registre SANS dossier sur disque est DIT tel quel : un lien vers une page absente
 * mentirait, et le taire cacherait un cœur déclaré au registre.
 */
export function lignesDesCoeurs(rawDir = RAWDIR, registre = REGISTRE_LIVRES) {
  const pages = pagesDeLAtlas(rawDir, { classes: CLASSES, registre, absent: 'vide' })
  // UN registre de bout en bout : les sigles se lisent sur le registre REÇU, jamais sur le global —
  // un registre injecté rendrait sinon les sigles d'un autre.
  const coeurs = coeursDe(registre)
  const livresDuRegistre = livresDeCoeur(booksDe(registre), coeurs)
  const lignes = []
  for (const coeur of coeursDuRegistre(registre)) {
    const siennes = pages.filter((p) => p.coeur === coeur)
    const livres = livresDuRegistre.filter(([abbr]) => coeurs.get(abbr) === coeur).map(([abbr]) => abbr)
    const sigles = livres.length ? ` — livre(s) de cœur : ${livres.join(', ')}` : ''
    const index = siennes.find((p) => p.nom === NOM_INDEX)
    lignes.push(index
      ? `- [\`${coeur}/\`](${index.relatif})${sigles}`
      : `- \`${coeur}/\` — dossier à créer${sigles}`)
  }
  return lignes
}

/**
 * Les lignes du bloc des DOMAINES d'un cœur : une table `clé (liée à sa fiche) | titre`. PURE.
 * La clé est l'id STABLE — c'est elle qui nomme la fiche et qu'un lot de workflow désigne ; le titre
 * est de l'AFFICHAGE. Le nom de fiche n'est pas une donnée de plus : il EST la clé.
 * Une aire CADRÉE dont la fiche reste à extraire (entrée à `ticket`) se rend SANS lien et DIT sa
 * dette : lier une fiche absente rendrait un lien MORT. C'est la présence du `ticket` qui décide —
 * la fonction ne lit pas le disque, et l'accord avec lui est tenu par `domaines.test.mjs`.
 */
export function lignesDesDomaines(domaines) {
  return ['| Domaine | Titre |', '|---|---|',
    ...domaines.map((d) => (d.ticket
      ? `| \`${d.cle}\` | ${d.titre} — aire cadrée, fiche à extraire (${d.ticket}) |`
      : `| [\`${d.cle}\`](${d.cle}.md) | ${d.titre} |`))]
}

/**
 * Tous les blocs à tenir à jour, DÉRIVÉS : le routeur racine, puis l'index de chaque cœur qui a
 * un dossier sur disque. Aucun chemin de cœur n'est écrit ici.
 * @returns {Array<{ chemin: string, lignes: string[], debut: string, fin: string, quoi: string }>}
 */
export function blocsDeLAtlas(rawDir = RAWDIR, registre = REGISTRE_LIVRES, registreDomaines) {
  const pages = pagesDeLAtlas(rawDir, { classes: CLASSES, registre, absent: 'vide' })
  const blocs = [{
    chemin: join(rawDir, NOM_INDEX), lignes: lignesDesCoeurs(rawDir, registre),
    debut: DEBUT, fin: FIN, quoi: 'cœurs',
  }]
  for (const p of pages) {
    if (p.coeur === null || p.nom !== NOM_INDEX) continue
    blocs.push({
      chemin: p.chemin, lignes: lignesDesDomaines(domainesDe(p.coeur, registreDomaines)),
      debut: DEBUT_DOMAINES, fin: FIN_DOMAINES, quoi: `domaines du cœur « ${p.coeur} »`,
    })
  }
  return blocs
}

/** Le contenu d'une page, bloc réécrit entre ses marqueurs. LÈVE si un marqueur manque. */
export function injecter(contenu, lignes, debutMarqueur = DEBUT, finMarqueur = FIN, ou = INDEX_PATH) {
  const debut = contenu.indexOf(debutMarqueur)
  const fin = contenu.indexOf(finMarqueur)
  if (debut === -1 || fin === -1 || fin < debut)
    throw new Error(`build-atlas-index: marqueurs « ${debutMarqueur} » … « ${finMarqueur} » introuvables ou inversés dans ${ou}`)
  return contenu.slice(0, debut) + debutMarqueur + '\n' + lignes.join('\n') + '\n' + contenu.slice(fin)
}

/** Un refus de structure (cœur sans domaine déclaré, index sans sa paire de marqueurs) sort en UNE
 *  ligne : une trace de pile ne dit ni la page ni le geste. */
function main() {
  try {
    regenerer()
  } catch (e) {
    console.error(String(e?.message ?? e))
    process.exit(1)
  }
}

function regenerer() {
  const check = process.argv.includes('--check')
  const perimes = []
  for (const bloc of blocsDeLAtlas()) {
    const contenu = readFileSync(bloc.chemin, 'utf8')
    const attendu = injecter(contenu, bloc.lignes, bloc.debut, bloc.fin, bloc.chemin)
    if (contenu === attendu) {
      console.log(`build-atlas-index — OK (bloc des ${bloc.quoi} à jour dans ${bloc.chemin})`)
      continue
    }
    perimes.push(attendu)
    if (check) {
      console.error(`build-atlas-index — ${bloc.chemin} PÉRIMÉ (bloc des ${bloc.quoi})`)
      continue
    }
    writeFileSync(bloc.chemin, attendu, 'utf8')
    console.log(`build-atlas-index — bloc des ${bloc.quoi} réécrit dans ${bloc.chemin}`)
  }
  if (check && perimes.length) {
    console.error('build-atlas-index — relancer `node scripts/raw/build-atlas-index.mjs` et committer.')
    declarerCorpsPerime(...perimes)
  }
}

if (import.meta.main) main()
