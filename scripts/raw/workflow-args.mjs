// PROJECTION du registre des livres vers les `args` d'un workflow d'extraction Atlas.
// Un script `*.workflow.js` est un corps d'`AsyncFunction` : ni `import`, ni accès fichier — il ne
// peut donc pas lire `src/data/books.json`. Le registre lui ENTRE par le global `args` (#1825 : le
// code ne nomme AUCUN livre ; un livre de plus est UNE entrée de `books.json`, zéro ligne ici).
//   node scripts/raw/workflow-args.mjs <coeur> --avec-supplements|--coeur-seul --domaines a,b [--reprise <rendu.json>]
// Forme rendue : `{ coeur, supplements, domaines: [{ cle, titre }], lot: [cle], livres: [{ ab, dir, coeur, language }], reprise? }`.
// `domaines` est la CARTE du cœur, projetée de `scripts/raw/domaines.json` (le workflow s'en sert
// pour tenir chaque domaine dans son périmètre) ; `lot` est ce que CE run traite, déclaré par
// l'appelant — un lot deviné relâcherait des agents sur des domaines que personne n'a demandés.
// La carte porte TOUTES les aires du cœur, EXTRAITES OU NON : c'est elle qui borne un domaine contre
// les autres, et une carte réduite aux fiches déjà écrites ferait sur-absorber la première. Elle est
// PROJETÉE (`cle`, `titre`) : la DETTE d'extraction d'une aire (`ticket`) regarde le registre et la
// fermeture de son ticket porteur, jamais un agent.
// REPRISE (`--reprise <rendu.json>`) : le rendu d'un run précédent entre au même `args`, et le
// workflow ne rejoue que sa vérification de fidélité — un run de dizaines d'agents ne se jette pas
// parce qu'un agent de vérification est resté muet.
// PÉRIMÈTRE d'un cœur — ce que le registre SAIT, ce qu'il ne sait PAS :
//   · il SAIT l'APPARTENANCE d'un livre à un corps de règles (champ `coeur` ; `livresDeCoeur`,
//     `_lib.mjs`, rend les livres qui en portent un) ;
//   · il ne sait RIEN de la COMPATIBILITÉ d'un SUPPLÉMENT (`coeur` absent) avec un cœur donné.
// Un supplément n'est donc ni inclus ni exclu par défaut : l'appelant DÉCLARE son choix
// (`supplements`), le résultat le PORTE, et le rapport du run le dit. Aucun défaut n'est offert —
// un défaut trancherait, en silence, une règle de jeu qui n'appartient pas au code.
// `coeursDuRegistre` vit dans `_lib.mjs`, avec la lecture du registre : c'est la MÊME population
// qui ouvre les dossiers de l'Atlas (`pagesDeLAtlas`) et les périmètres d'extraction.
import { REGISTRE_LIVRES, coeursDuRegistre, domainesDe, estLivreExtrait } from './_lib.mjs'
import { readFileSync } from 'node:fs'

const CHOIX = { '--avec-supplements': true, '--coeur-seul': false }
const CHOIX_DITS = Object.keys(CHOIX).join(' | ')

/**
 * Le périmètre d'extraction d'UN cœur. LÈVE en NOMMANT la cause — un périmètre silencieusement vide
 * ferait survoler des livres entiers sans qu'aucun rapport ne le dise, et un `supplements` deviné
 * trancherait une règle de jeu.
 * @param {string} coeur clé `coeur` de `src/data/books.json`
 * @param {{ supplements: boolean, lot: string[], reprise?: object|null, registre?: Array<object>, registreDomaines?: object }} options
 *   `supplements` et `lot` OBLIGATOIRES ; `reprise` = le rendu d'un domaine (`lireRendu`)
 * @returns {{ coeur: string, supplements: boolean, domaines: Array<{ cle: string, titre: string }>, lot: string[], livres: Array<{ ab: string, dir: string, coeur: string|null, language: string }>, reprise?: object }}
 */
export function perimetreDeCoeur(coeur, options = {}) {
  const { supplements, lot, reprise = null, registre = REGISTRE_LIVRES, registreDomaines } = options
  const connus = coeursDuRegistre(registre)
  const dits = connus.length ? connus.join(', ') : '(aucun)'
  if (typeof coeur !== 'string' || !coeur)
    throw new Error(`workflow-args: cœur demandé absent ou non textuel — cœurs du registre : ${dits}`)
  if (!connus.includes(coeur))
    throw new Error(`workflow-args: aucun livre de cœur « ${coeur} » au registre des livres — cœurs du registre : ${dits}`)
  if (typeof supplements !== 'boolean')
    throw new Error(
      'workflow-args: `supplements` non déclaré — le registre ne dit RIEN de la compatibilité '
      + `d'un supplément avec le cœur « ${coeur} » : déclare \`supplements: true\` (le cœur ET tous les `
      + 'suppléments du registre) ou `supplements: false` (les livres de ce cœur SEULS)',
    )
  const retenus = registre.filter((b) =>
    estLivreExtrait(b) && (b.coeur === coeur || (supplements && (b.coeur ?? null) === null)))
  const sansLangue = retenus.filter((b) => !b.language)
  if (sansLangue.length)
    throw new Error(
      `workflow-args: ${sansLangue.length} livre(s) du périmètre sans champ \`language\` (${sansLangue.map((b) => b.abbr).join(', ')}) — `
      + 'la langue des citations ne se devine pas : renseigner `language` dans `src/data/books.json`',
    )
  const domaines = domainesDe(coeur, registreDomaines)
  const clesDites = domaines.map((d) => d.cle).join(', ')
  if (!Array.isArray(lot) || !lot.length)
    throw new Error(
      'workflow-args: `lot` de domaines non déclaré — le lot que CE run traite ne se devine pas : '
      + `déclarer \`lot: ['<cle>', …]\` (option \`--domaines a,b\` en ligne de commande) ; domaines du cœur « ${coeur} » : ${clesDites}`)
  const inconnues = lot.filter((c) => !domaines.some((d) => d.cle === c))
  if (inconnues.length)
    throw new Error(
      `workflow-args: domaine(s) « ${inconnues.join(', ')} » inconnu(s) du cœur « ${coeur} » `
      + `— domaines déclarés : ${clesDites}`)
  // Une REPRISE ne re-vérifie qu'UN rendu : son domaine est le lot, et il appartient à CE cœur.
  // Le laisser filer produirait un run qui rejoue tout un lot en croyant ne re-vérifier qu'un rendu.
  if (reprise) {
    if (!domaines.some((d) => d.cle === reprise.domain))
      throw new Error(
        `workflow-args: le rendu de reprise porte le domaine « ${reprise.domain} », inconnu du cœur « ${coeur} » `
        + `— domaines déclarés : ${clesDites}`)
    if (lot.length !== 1 || lot[0] !== reprise.domain)
      throw new Error(
        `workflow-args: une reprise ne joue que le domaine de son rendu (« ${reprise.domain} ») — lot déclaré : ${lot.join(', ')}`)
  }
  return {
    coeur,
    supplements,
    domaines: domaines.map((d) => ({ cle: d.cle, titre: d.titre })),
    lot: [...lot],
    livres: retenus.map((b) => ({ ab: b.abbr, dir: b.dir, coeur: b.coeur ?? null, language: b.language })),
    ...(reprise ? { reprise } : {}),
  }
}

/**
 * Le rendu d'UN domaine relu du disque, pour une REPRISE. Il accepte les TROIS formes qu'on a sous
 * la main sans rien retailler : ce que le run REND (`{ coeur, supplements, domains: [...] }`), ce
 * que le lanceur EMBALLE (`{ result: {…} }`), et un domaine NU déjà extrait : aucun fichier ne se
 * découpe à la main avant une reprise, geste que rien ne vérifierait.
 * LÈVE en NOMMANT la cause : un chemin qui n'existe pas, un JSON illisible, un rendu sans domaine,
 * un domaine demandé absent, un rendu sans topic — autant d'`args.reprise` que le workflow
 * rejetterait plus tard, agents déjà partis.
 * @param {string} chemin chemin du JSON rendu par un run précédent
 * @param {string} [domaine] la clé que `--domaines` nomme ; sans elle, le rendu doit porter UN seul domaine
 */
export function lireRendu(chemin, domaine) {
  let brut
  try {
    brut = readFileSync(chemin, 'utf8')
  } catch {
    throw new Error(`workflow-args: rendu de reprise illisible à « ${chemin} » — c'est le JSON qu'un run précédent a rendu`)
  }
  let lu
  try {
    lu = JSON.parse(brut)
  } catch (e) {
    throw new Error(`workflow-args: rendu de reprise « ${chemin} » non analysable — ${String(e.message ?? e)}`, { cause: e })
  }
  const estObjet = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
  const racine = estObjet(lu) && estObjet(lu.result) ? lu.result : lu
  if (!estObjet(racine))
    throw new Error(`workflow-args: rendu de reprise « ${chemin} » non-objet — attendu : le rendu d'un run, celui d'un lanceur (\`result\`), ou UN domaine`)
  const candidats = (Array.isArray(racine.domains) ? racine.domains : [racine])
    .filter((d) => estObjet(d) && typeof d.domain === 'string' && d.domain)
  const dits = candidats.length ? candidats.map((d) => d.domain).join(', ') : '(aucun)'
  if (!candidats.length)
    throw new Error(`workflow-args: rendu de reprise « ${chemin} » sans \`domain\` — aucun domaine à y reprendre`)
  if (domaine !== undefined && (typeof domaine !== 'string' || !domaine))
    throw new Error(`workflow-args: domaine de reprise demandé non textuel — domaines du rendu « ${chemin} » : ${dits}`)
  if (domaine === undefined && candidats.length > 1)
    throw new Error(`workflow-args: le rendu « ${chemin} » porte ${candidats.length} domaines (${dits}) — nommer celui à reprendre (\`${DRAPEAU_LOT} <cle>\`)`)
  const rendu = domaine === undefined ? candidats[0] : candidats.find((d) => d.domain === domaine)
  if (!rendu)
    throw new Error(`workflow-args: le domaine « ${domaine} » n'est pas dans le rendu « ${chemin} » — domaines du rendu : ${dits}`)
  if (!Array.isArray(rendu.topics) || !rendu.topics.length)
    throw new Error(`workflow-args: le domaine « ${rendu.domain} » du rendu « ${chemin} » est sans topic — une reprise n'a alors rien à re-vérifier`)
  return rendu
}

const DRAPEAU_LOT = '--domaines'
const DRAPEAU_REPRISE = '--reprise'
const USAGE = `usage: node scripts/raw/workflow-args.mjs <coeur> ${CHOIX_DITS} ${DRAPEAU_LOT} <cle,cle…> [${DRAPEAU_REPRISE} <rendu.json>]`

/** La valeur d'un drapeau à argument, aux DEUX graphies (`--x v` et `--x=v`). `undefined` si absent. */
export function valeurDeDrapeau(args, nom) {
  const i = args.indexOf(nom)
  if (i >= 0) return args[i + 1]
  return args.find((a) => a.startsWith(`${nom}=`))?.slice(nom.length + 1)
}

function main() {
  const [, , demande, ...reste] = process.argv
  try {
    const drapeau = reste.find((a) => Object.hasOwn(CHOIX, a))
    if (!drapeau)
      throw new Error(`workflow-args: drapeau de suppléments absent ou inconnu (${reste.join(' ') || 'aucun'}) — exigé : ${CHOIX_DITS}`)
    const lot = (valeurDeDrapeau(reste, DRAPEAU_LOT) ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const cheminDuRendu = valeurDeDrapeau(reste, DRAPEAU_REPRISE)
    // Le domaine de la reprise est celui que `--domaines` NOMME : un rendu de lot n'a pas à être
    // découpé à la main avant d'entrer ici.
    const reprise = cheminDuRendu === undefined ? null : lireRendu(cheminDuRendu, lot.length === 1 ? lot[0] : undefined)
    console.log(JSON.stringify(perimetreDeCoeur(demande, { supplements: CHOIX[drapeau], lot, reprise }), null, 2))
  } catch (e) {
    console.error(String(e.message ?? e))
    console.error(USAGE)
    process.exitCode = 1
  }
}

if (import.meta.main) main()
