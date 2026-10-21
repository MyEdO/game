// RÉEXPORTATIONS (#2817 D2, épique #2882) — définition UNIQUE de la mesure, lue par la garde
// `src/reexportations-guard.test.ts`.
//
// Classe de défaut : un module de production de `src/` qui RÉEXPORTE ce qu'un autre déclare. Un importeur
// lit alors un nom à une porte qui n'est pas son module déclarant, et le déménagement du déclarant laisse
// un pont. Une instruction de PREMIER NIVEAU est un site si c'est un `export … from '…'` (nommé, `*` ou
// `* as ns`), ou un `export { … }` sans source dont un nom au moins est une liaison IMPORTÉE du module.
// Corpus : les zones de `ZONES_A_ZERO`, `src/state/` et `src/noyau/`, en `.ts`/`.tsx`, hors suites Vitest, kits de test et déclarations (`.d.ts`). Garde
// ABSOLUE, sans liste : la seule porte admise est `PORTE_DU_NOYAU`, la surface du noyau pour un hôte (#2817 D9) ; les
// autres dossiers de `src/` relèvent de la vague 7 de #2882.
//
// ANGLES MORTS : une réexportation EN VALEUR (`export const x = importe`) et un `export default` d'une
// liaison importée ne sont pas des sites.
import { analyserCorpus, typescript } from './dialecte.mjs'
import { estKitDeTest } from './fichierVitest.mjs'
import { readCorpus } from './sourceCorpus.mjs'

/** Les dossiers où toute réexportation est refusée. */
const ZONES_A_ZERO = Object.freeze(['src/state/', 'src/noyau/'])

/** `rel` est-il sous une zone à zéro ? PURE. @param {string} rel @returns {boolean} */
export const enZoneAZero = (rel) => ZONES_A_ZERO.some((dossier) => rel.startsWith(dossier))

/** Le seul module des zones à zéro qui réexporte : la surface du noyau (#2817 D9). */
export const PORTE_DU_NOYAU = 'src/noyau/index.ts'

/** Une réexportation de `rel` est-elle refusée : sous une zone à zéro, hors de `PORTE_DU_NOYAU` ? PURE.
 *  @param {string} rel @returns {boolean} */
export const estRefusee = (rel) => enZoneAZero(rel) && rel !== PORTE_DU_NOYAU

/** Le corpus mesuré par défaut : la production des zones à zéro (`readCorpus`, hors suites et déclarations), hors kits. */
const corpusMesure = () => readCorpus(ZONES_A_ZERO.map((dossier) => dossier.slice(0, -1))).filter((f) => !estKitDeTest(f.rel))

/** Le texte d'un site : l'instruction, blancs repliés. PURE. */
const replier = (texte) => texte.replace(/\s+/g, ' ').trim()

/**
 * Les SITES de réexportation de chaque fichier : `{ file, ref, ligne }`, `ref` = l'instruction repliée.
 * @param {Iterable<{ rel: string, text: string }>} fichiers
 * @returns {{ file: string, ref: string, ligne: number }[]}
 */
export function sitesDeReexportation(fichiers) {
  const ts = typescript()
  const sites = []
  for (const { fichier, sourceFile: sf } of analyserCorpus(fichiers)) {
    if (!sf) continue
    const importes = new Set()
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue
      const c = st.importClause
      if (c.name) importes.add(c.name.text)
      const nb = c.namedBindings
      if (nb && ts.isNamespaceImport(nb)) importes.add(nb.name.text)
      else if (nb) for (const e of nb.elements) importes.add(e.name.text)
    }
    for (const st of sf.statements) {
      if (!ts.isExportDeclaration(st)) continue
      const reexporte = st.moduleSpecifier
        || (st.exportClause && ts.isNamedExports(st.exportClause) && st.exportClause.elements.some((e) => importes.has((e.propertyName ?? e.name).text)))
      if (!reexporte) continue
      sites.push({ file: fichier.rel, ref: replier(st.getText(sf)), ligne: sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1 })
    }
  }
  return sites
}

/**
 * La mesure du corpus : les chemins lus et les sites refusés (`estRefusee`).
 * @param {Iterable<{ rel: string, text: string }>} [fichiers]
 */
export function mesure(fichiers = corpusMesure()) {
  const lus = [...fichiers]
  return { lus: lus.map((f) => f.rel), sites: sitesDeReexportation(lus).filter((s) => estRefusee(s.file)) }
}
