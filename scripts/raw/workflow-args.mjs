// PROJECTION des registres vers les `args` d'un workflow, et ÉCRITURE de ce qu'un run rend.
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
// DOSSIER DE CHAPITRE (#2290) — la fiche `docs/dossiers/<ABBR>/<NN>.json` a UNE définition,
// `ficheDeDossier` (`src/data/source/dossier.ts`) :
//   node scripts/raw/workflow-args.mjs dossier-de-chapitre <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> [--compagnons <ABBR>-<NN>,…]
//     args de `.claude/workflows/dossier-de-chapitre.js` : ses familles, chacune avec le préfixe de ses
//     ids, son minimum d'entrées et la forme JSON d'une entrée, PROJETÉS de `ficheDeDossier` par
//     `z.toJSONSchema` ; `commit` = la tête de l'arbre lu ;
//   node scripts/raw/workflow-args.mjs ecrire-fiche <rendu.json>
//     la fiche qu'un run au verdict DOSSIER rend, écrite à son chemin après les gardes du chargeur
//     (`chargerDossiers`, `scripts/raw/lib/dossiers.mjs`) : refusée sinon, et rien n'est écrit ;
//   node scripts/raw/workflow-args.mjs table-simulee <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> --seed <graine> [--max-echanges <n>] [--personas a,b,c,d]
//     args de `.claude/workflows/table-simulee.js`, dont `dossier` = l'OBJET de la fiche commitée chargée.
// Les fichiers `Source/` d'un chapitre se dérivent de `chapterFile`.
import { REGISTRE_LIVRES, chapterFile, coeursDuRegistre, domainesDe, estLivreExtrait, livreDuSigle } from './_lib.mjs'
import { DOSSIERS_DIR, chargerDossiers } from './lib/dossiers.mjs'
import { depotDe, shaDe } from '../guards/lib/gitPorte.mjs'
import { FAMILLES_DE_DOSSIER, PREFIXES_D_ID, ficheDeDossier } from '../../src/data/source/dossier.ts'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

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

const estObjet = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/**
 * Le JSON qu'un run a rendu, relu du disque, sous ses deux formes : le rendu du workflow, ou celui que
 * le lanceur EMBALLE (`{ result: {…} }`), déballé. LÈVE en NOMMANT la cause : chemin illisible, JSON
 * non analysable.
 * @param {string} chemin @param {string} quoi ce que le fichier est, pour le message
 */
function lireRenduDeRun(chemin, quoi) {
  let brut
  try {
    brut = readFileSync(chemin, 'utf8')
  } catch {
    throw new Error(`workflow-args: ${quoi} illisible à « ${chemin} » — c'est le JSON qu'un run précédent a rendu`)
  }
  let lu
  try {
    lu = JSON.parse(brut)
  } catch (e) {
    throw new Error(`workflow-args: ${quoi} « ${chemin} » non analysable — ${String(e.message ?? e)}`, { cause: e })
  }
  return estObjet(lu) && estObjet(lu.result) ? lu.result : lu
}

// ── Dossier de chapitre (#2290) ──────────────────────────────────────────────────────────────────

/** Le verdict d'un run de `dossier-de-chapitre` dont la fiche s'écrit. */
const VERDICT_DE_FICHE = 'DOSSIER'
const DATE_DU_RUN = /^\d{4}-\d{2}-\d{2}$/
const CHAPITRE = /^\d+$/

/** Le fichier `Source/` d'un chapitre (`chapterFile`), chemin POSIX relatif à l'arbre, `null` sans fichier. */
const fichierDuChapitre = (abbr, nn) => chapterFile(abbr, nn)?.path.replace(/\\/g, '/') ?? null

/**
 * Les familles de la fiche, PROJETÉES de `ficheDeDossier` pour le workflow qui la remplit, dans l'ordre
 * de la fiche : `{ <famille>: { prefixe, minimum, entree } }`. `entree` = la forme JSON d'une entrée
 * (`z.toJSONSchema`), SANS `id` : le script du workflow pose chaque id, `<prefixe><rang>`. PUR.
 */
export function famillesDeLaFiche() {
  const { properties } = z.toJSONSchema(ficheDeDossier)
  return Object.fromEntries(FAMILLES_DE_DOSSIER.map((famille) => {
    const { minItems = 0, items: { properties: attributs, required, ...forme } } = properties[famille]
    const sansId = (cle) => cle !== 'id'
    return [famille, {
      prefixe: PREFIXES_D_ID[famille],
      minimum: minItems,
      entree: { ...forme, properties: Object.fromEntries(Object.entries(attributs).filter(([cle]) => sansId(cle))), required: required.filter(sansId) },
    }]
  }))
}

/** LÈVE si `livre`/`chapitre` ne désignent pas un chapitre d'un livre du registre. */
function exigerChapitre(livre, chapitre) {
  if (typeof livre !== 'string' || !livreDuSigle(livre))
    throw new Error(`workflow-args: « ${livre} » n'est le sigle d'aucun livre extrait de src/data/books.json`)
  if (typeof chapitre !== 'string' || !CHAPITRE.test(chapitre))
    throw new Error(`workflow-args: chapitre « ${chapitre} » — un numéro de chapitre, chiffres seuls (ex. 01)`)
}

/** Le fichier `Source/` d'un chapitre, ou LÈVE en le nommant. */
function fichierExige(livre, chapitre, fichierDe) {
  const fichier = fichierDe(livre, chapitre)
  if (!fichier) throw new Error(`workflow-args: ${livre} ${chapitre} n'a aucun fichier chapitre (chapterFile)`)
  return fichier
}

/** LÈVE sans arbre ABSOLU ou sans date `AAAA-MM-JJ` : le workflow n'a ni cwd ni horloge. */
function exigerArbreEtDate(worktree, date) {
  if (typeof worktree !== 'string' || !/^(?:[A-Za-z]:)?[\\/]/.test(worktree))
    throw new Error(`workflow-args: --worktree « ${worktree ?? ''} » — le chemin ABSOLU de l'arbre que les agents lisent`)
  if (typeof date !== 'string' || !DATE_DU_RUN.test(date))
    throw new Error(`workflow-args: --date « ${date ?? ''} » — AAAA-MM-JJ (aucune horloge dans un workflow)`)
}

/**
 * Les `args` de `.claude/workflows/dossier-de-chapitre.js`. LÈVE en nommant la cause.
 * @param {string} livre sigle de `src/data/books.json` @param {string} chapitre numéro (`01`)
 * @param {{ worktree: string, date: string, commit: string, compagnons?: string[], fichierDe?: (abbr: string, nn: string) => string | null }} options
 *   `commit` = la tête de l'arbre lu (`lecture.commit` de la fiche) ; `compagnons` = `<ABBR>-<NN>`
 */
export function argsDeDossierDeChapitre(livre, chapitre, { worktree, date, commit, compagnons = [], fichierDe = fichierDuChapitre }) {
  exigerChapitre(livre, chapitre)
  exigerArbreEtDate(worktree, date)
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit))
    throw new Error(`workflow-args: commit « ${commit ?? ''} » — l'empreinte complète de la tête de l'arbre lu`)
  const fichiersCompagnons = compagnons.map((c) => {
    const m = /^(.+)-(\d+)$/.exec(c)
    if (!m) throw new Error(`workflow-args: compagnon « ${c} » — attendu <ABBR>-<NN> (ex. EDOC-03)`)
    exigerChapitre(m[1], m[2])
    return fichierExige(m[1], m[2], fichierDe)
  })
  return {
    livre, chapitre, fichiers: [fichierExige(livre, chapitre, fichierDe)], compagnons: fichiersCompagnons,
    worktree, date, commit, familles: famillesDeLaFiche(),
  }
}

/**
 * Les `args` de `.claude/workflows/table-simulee.js` : `dossier` = l'OBJET de la fiche commitée du
 * chapitre, chargée et gardée par `chargerDossiers`. LÈVE sans fiche.
 * @param {{ worktree: string, date: string, seed: string, maxEchanges?: number, personas?: string[], dir?: string, fichierDe?: (abbr: string, nn: string) => string | null }} options
 */
export function argsDeTableSimulee(livre, chapitre, { worktree, date, seed, maxEchanges, personas, dir = DOSSIERS_DIR, fichierDe = fichierDuChapitre }) {
  exigerChapitre(livre, chapitre)
  exigerArbreEtDate(worktree, date)
  const fiches = chargerDossiers(dir)
  const charge = fiches.find((f) => f.abbr === livre && f.nn === chapitre)
  if (!charge)
    throw new Error(`workflow-args: aucune fiche ${dir}/${livre}/${chapitre}.json — un dossier de chapitre se lit (\`dossier-de-chapitre\`) et s'écrit (\`ecrire-fiche\`) avant toute table ; fiches : ${fiches.map((f) => f.chemin).join(', ') || '(aucune)'}`)
  return {
    livre, chapitre, fichiers: [fichierExige(livre, chapitre, fichierDe)], dossier: charge.fiche, seed, worktree, date,
    ...(maxEchanges === undefined ? {} : { maxEchanges }),
    ...(personas === undefined ? {} : { personas }),
  }
}

/**
 * ÉCRIT la fiche qu'un run de `dossier-de-chapitre` rend, à `<dir>/<livre>/<chapitre>.json` : seul un
 * run au verdict DOSSIER en porte une, et elle passe les gardes du chargeur (`chargerDossiers`, sur une
 * copie jetable) avant d'être écrite. LÈVE en nommant la cause ; rien n'est écrit sur un refus.
 * @param {object} rendu le rendu du run (ou celui du lanceur, `{ result }`) @param {{ dir?: string }} [options]
 * @returns {string} le chemin écrit
 */
export function ecrireFiche(rendu, { dir = DOSSIERS_DIR } = {}) {
  const run = estObjet(rendu) && estObjet(rendu.result) ? rendu.result : rendu
  if (!estObjet(run)) throw new Error('workflow-args: rendu de dossier non-objet — attendu : le rendu d\'un run de `dossier-de-chapitre`')
  if (run.verdict !== VERDICT_DE_FICHE) {
    const troues = Object.entries(estObjet(run.trous) ? run.trous : {}).filter(([, l]) => Array.isArray(l) && l.length)
    throw new Error(`workflow-args: verdict « ${run.verdict} » — seul un run au verdict ${VERDICT_DE_FICHE} porte une fiche${troues.length ? ` ; trous : ${troues.map(([e, l]) => `${e} (${l.join(', ')})`).join(' · ')}` : ''}`)
  }
  exigerChapitre(run.livre, run.chapitre)
  const fiche = Object.fromEntries(['lecture', ...FAMILLES_DE_DOSSIER].map((cle) => [cle, run[cle]]))
  const jetable = mkdtempSync(join(tmpdir(), 'fiche-de-dossier-'))
  let charge
  try {
    mkdirSync(join(jetable, run.livre))
    writeFileSync(join(jetable, run.livre, `${run.chapitre}.json`), JSON.stringify(fiche), 'utf8')
    ;[charge] = chargerDossiers(jetable)
  } finally {
    rmSync(jetable, { recursive: true, force: true })
  }
  const chemin = `${dir}/${run.livre}/${run.chapitre}.json`
  mkdirSync(join(dir, run.livre), { recursive: true })
  writeFileSync(chemin, `${JSON.stringify(charge.fiche, null, 2)}\n`, 'utf8')
  return chemin
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
  const racine = lireRenduDeRun(chemin, 'rendu de reprise')
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

/** Les commandes du dossier de chapitre, par premier argument ; tout autre premier argument est un cœur. */
const COMMANDES_DE_DOSSIER = {
  'dossier-de-chapitre': ([livre, chapitre, ...reste]) => argsDeDossierDeChapitre(livre, chapitre, {
    worktree: valeurDeDrapeau(reste, '--worktree'),
    date: valeurDeDrapeau(reste, '--date'),
    commit: shaDe(depotDe(valeurDeDrapeau(reste, '--worktree') ?? '.'), 'HEAD'),
    compagnons: listeDuDrapeau(reste, '--compagnons'),
  }),
  'ecrire-fiche': ([chemin]) => ({ ecrit: ecrireFiche(lireRenduDeRun(chemin, 'rendu de dossier')) }),
  'table-simulee': ([livre, chapitre, ...reste]) => {
    const maxEchanges = valeurDeDrapeau(reste, '--max-echanges')
    const personas = listeDuDrapeau(reste, '--personas')
    return argsDeTableSimulee(livre, chapitre, {
      worktree: valeurDeDrapeau(reste, '--worktree'),
      date: valeurDeDrapeau(reste, '--date'),
      seed: valeurDeDrapeau(reste, '--seed'),
      ...(maxEchanges === undefined ? {} : { maxEchanges: Number(maxEchanges) }),
      ...(personas.length ? { personas } : {}),
    })
  },
}
const USAGE_DE_DOSSIER = [
  'usage: node scripts/raw/workflow-args.mjs dossier-de-chapitre <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> [--compagnons <ABBR>-<NN>,…]',
  '       node scripts/raw/workflow-args.mjs ecrire-fiche <rendu.json>',
  '       node scripts/raw/workflow-args.mjs table-simulee <ABBR> <NN> --worktree <abs> --date <AAAA-MM-JJ> --seed <graine> [--max-echanges <n>] [--personas a,b,c,d]',
].join('\n')

/** Les valeurs d'un drapeau à liste (`a,b`), vides si absent. */
const listeDuDrapeau = (args, nom) => (valeurDeDrapeau(args, nom) ?? '').split(',').map((s) => s.trim()).filter(Boolean)

function main() {
  const [, , demande, ...reste] = process.argv
  if (Object.hasOwn(COMMANDES_DE_DOSSIER, demande)) {
    try {
      console.log(JSON.stringify(COMMANDES_DE_DOSSIER[demande](reste), null, 2))
    } catch (e) {
      console.error(String(e.message ?? e))
      console.error(USAGE_DE_DOSSIER)
      process.exitCode = 1
    }
    return
  }
  try {
    const drapeau = reste.find((a) => Object.hasOwn(CHOIX, a))
    if (!drapeau)
      throw new Error(`workflow-args: drapeau de suppléments absent ou inconnu (${reste.join(' ') || 'aucun'}) — exigé : ${CHOIX_DITS}`)
    const lot = listeDuDrapeau(reste, DRAPEAU_LOT)
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
