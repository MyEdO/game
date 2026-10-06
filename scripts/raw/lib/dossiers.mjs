// Chargeur des fiches de dossier de chapitre commitées (#2290) : `docs/dossiers/<ABBR>/<NN>.json`, chacune
// lue par `lireFicheDeDossier` (`src/data/source/dossier.ts`), la lecture que partage le chargeur de l'app
// (`src/data/dossiers.ts`). Côté NODE seulement : le module pur ne lit aucun fichier. S'y ajoutent les
// gardes de graphie des réfs, qui composent `refRe` de l'outillage RAW.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { listerArbre } from '../../guards/lib/lister.mjs'
import { refRe } from '../_lib.mjs'
import { FAMILLES_DE_DOSSIER, lireFicheDeDossier } from '../../../src/data/source/dossier.ts'
import { DOSSIERS_DIR } from './fichiersCitants.mjs'

/** Un élément de `ref` est UNE réf à la graphie unique `refRe`, ENTIÈRE : ni préfixe, ni reste. */
const estUneRef = (s) => {
  const m = refRe().exec(s)
  return m !== null && m.index === 0 && m[0].length === s.length
}

/** Les réfs de la fiche hors graphie `refRe`, une ligne `famille id « réf »` chacune. */
const refsHorsGraphie = (fiche) =>
  FAMILLES_DE_DOSSIER.flatMap((famille) =>
    fiche[famille].flatMap((e) => e.ref.filter((r) => !estUneRef(r)).map((r) => `  ${famille} ${e.id} « ${r} »`)),
  )

/** Une ligne `l.<n>` écrite dans la prose d'une entrée, préfixe exclu : elle n'est une réf que DANS une
 *  correspondance de `refRe`. */
const LIGNE_EN_PROSE = /(?<!\p{L})l\.\d+/gu

/** Les `l.<n>` NUS des champs texte de la fiche (hors `id` et `ref`), hors de toute réf entière `refRe`,
 *  une ligne `famille id champ « extrait »` chacun. */
const lignesNues = (fiche) =>
  FAMILLES_DE_DOSSIER.flatMap((famille) =>
    fiche[famille].flatMap((e) =>
      Object.entries(e)
        .filter(([champ, v]) => champ !== 'id' && champ !== 'ref' && typeof v === 'string')
        .flatMap(([champ, v]) => {
          const refs = [...v.matchAll(refRe())].map((m) => [m.index, m.index + m[0].length])
          return [...v.matchAll(LIGNE_EN_PROSE)]
            .filter((m) => !refs.some(([debut, fin]) => m.index >= debut && m.index < fin))
            .map((m) => `  ${famille} ${e.id} ${champ} « …${v.slice(Math.max(0, m.index - 40), m.index + m[0].length)} »`)
        }),
    ),
  )

/** Les fiches de `dir`, chacune `{ chemin, abbr, nn, fiche, ids }` (`ids` = identifiants GLOBAUX), en
 *  ordre total (`listerArbre`). Lève sur tout fichier hors de la forme `<ABBR>/<NN>.json`, tout JSON
 *  illisible, toute fiche hors schéma, toute réf hors graphie `refRe` et tout `l.<n>` de prose hors d'une
 *  réf entière `refRe` : un dossier commité est valide ou n'est pas chargé. */
export function chargerDossiers(dir = DOSSIERS_DIR) {
  return listerArbre(dir).map((rel) => {
    const chemin = join(dir, rel).replace(/\\/g, '/')
    const lue = lireFicheDeDossier(chemin, rel, JSON.parse(readFileSync(join(dir, rel), 'utf8')))
    const horsGraphie = refsHorsGraphie(lue.fiche)
    if (horsGraphie.length) {
      throw new Error(`${chemin} : réf hors graphie \`<ABRÉV> <NN> l.<ligne>\` (refRe, scripts/raw/_lib.mjs), une réf entière par élément\n${horsGraphie.join('\n')}`)
    }
    const nues = lignesNues(lue.fiche)
    if (nues.length) {
      throw new Error(`${chemin} : ligne nue en prose, sans sigle ni chapitre : toute \`l.<ligne>\` d'un champ texte appartient à une réf entière \`<ABRÉV> <NN> l.<ligne>\` (refRe, scripts/raw/_lib.mjs)\n${nues.join('\n')}`)
    }
    return lue
  })
}
