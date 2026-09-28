// LECTEUR UNIQUE DE `.github/workflows/ci.yml` (#1776). Module FEUILLE : il n'importe que Node.
//
// `ci.yml` EST la porte — une gate neuve y est un step, et rien d'autre ne la récite. Ce module rend
// ce que le fichier DIT, à trois lecteurs : `scripts/gates/toutes.mjs` (le rejeu local),
// `scripts/gates/ecrivainsAtteints.mjs` (la table écrit/lu) et `scripts/ops/ruleset-main.mjs` (les
// checks requis du ruleset, par `jobsCi`).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Commande EXACTE du step final « Arbre inchangé » de `ci.yml` et `canari.yml` — le filet des
 *  écrivains par nature (`genAll()` de `build` et de la suite) : l'arbre du runner reste le commit. */
export const COMMANDE_ARBRE_INCHANGE = 'git status --porcelain && test -z "$(git status --porcelain)"'

/**
 * Steps de `ci.yml` qui ne sont PAS une gate locale, chacun avec sa raison. La liste est exhaustive
 * et EXACTE (ligne pour ligne) : c'est elle qui rend le classement fail-CLOSED — un step d'une autre
 * forme fait LEVER `gatesDeCi`, au lieu d'être ignoré en silence.
 */
export const CI_SEULEMENT = {
  'npm ci': 'installation des dépendances du runner — rien à rejouer sur l’arbre local',
  'npm --prefix server ci': 'install serveur — posée une fois localement par `npm install`',
  [COMMANDE_ARBRE_INCHANGE]:
    'le lanceur local juge le même invariant par `photoArbre` (scripts/gates/toutes.mjs)',
  'node scripts/gates/classerPush.mjs >> "$GITHUB_OUTPUT"':
    'classe le push (documentaire / produit, #1738) et ne mesure rien du contenu : il décide QUELS ' +
    'steps jouent, il n’est pas lui-même une gate — localement `npm run gates` rejoue TOUT, sans classement',
}

/**
 * Jobs de `ci.yml` dont les steps ne se rejouent PAS localement, avec leur raison. Nominatif : un
 * job neuf est rejoué tant qu'il n'est pas nommé ici.
 */
export const JOBS_HORS_REJEU_LOCAL = {
  fermetures:
    'ferme sur GitHub les tickets soldés par la plage poussée, après un `build` vert : il agit APRÈS ' +
    'la publication et ne mesure rien du contenu (scripts/ops/fermer-depuis-main.mjs)',
  migrations:
    'rejeu EN PLACE des migrations : le jouer sur un arbre de travail réécrit src/data et src/scenes ' +
    'et rend un verdict faux (#1613) — localement, il se joue sur un EXPORT de la tête, ' +
    '`npm run migrations:replay:head`',
}

/** Nom de gate d'une commande de step : `npm test` → `test`, `npm run <x>` → `<x>`, sinon `null`. */
export function nomDeGate(commande) {
  if (/^npm test$/.test(commande)) return 'test'
  const script = /^npm run ([A-Za-z0-9:_.-]+)$/.exec(commande)
  return script ? script[1] : null
}

/** Clés de step INERTES pour une gate locale : elles ne changent ni la commande ni son contexte. */
export const CLES_DE_STEP_INERTES = ['name', 'if', 'id']

const cheminCi = ({ cwd = process.cwd(), fichier } = {}) =>
  fichier ?? join(cwd, '.github', 'workflows', 'ci.yml')

/**
 * Steps de `ci.yml`, dans l'ordre du fichier. Un scalaire de bloc (`run: |`) est réduit à ses lignes
 * jointes par ` ; ` — une forme, donc, qui doit être classée comme les autres au lieu de disparaître.
 * `cles` porte les AUTRES clés du step (`working-directory`, `env`, `shell`…) : une gate locale ne
 * les reproduit pas, donc leur présence doit LEVER plutôt que créditer la commande racine.
 * `si` rend la VALEUR de la clé `if` (ou `null`) — c'est la DÉCISION que `ci.yml` écrit sur le step,
 * celle que la garde du classement confronte à la MESURE `lit` (scripts/gates/classerPush.test.mjs) ;
 * `if` reste dans `cles`, où il est INERTE pour le rejeu local.
 * REND `[{ job, commande, cles, si }]`.
 */
export function stepsCi({ cwd = process.cwd(), fichier } = {}) {
  const lignes = readFileSync(cheminCi({ cwd, fichier }), 'utf8').split(/\r?\n/)
  const steps = []
  let job = null
  let courant = null
  const poser = () => {
    if (courant && courant.commande !== null) steps.push(courant)
    courant = null
  }
  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i]
    const entete = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(ligne)
    if (entete) {
      poser()
      job = entete[1]
      continue
    }
    if (/^\s*-\s/.test(ligne)) poser()
    const cle = /^\s*-?\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/.exec(ligne)
    if (!cle) continue
    const [, nomCle, valeur] = cle
    if (!courant) courant = { job, commande: null, cles: [], si: null }
    if (nomCle !== 'run') {
      courant.cles.push(nomCle)
      if (nomCle === 'if') courant.si = valeur
      continue
    }
    if (!/^[|>]/.test(valeur)) {
      courant.commande = valeur
      continue
    }
    const blanc = /^\s*/.exec(ligne)[0]
    const corps = []
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (lignes[j].trim() === '') continue
      if (/^\s*/.exec(lignes[j])[0].length <= blanc.length) break
      corps.push(lignes[j].trim())
      i = j
    }
    courant.commande = corps.join(' ; ')
  }
  poser()
  return steps
}

/**
 * Gates de `.github/workflows/ci.yml`, DANS L'ORDRE DU FICHIER, hors `JOBS_HORS_REJEU_LOCAL`. Aucun
 * nom n'est recopié ici : un step ajouté à la CI devient rejouable localement sans qu'on touche au
 * lanceur. Un step qui n'est ni `npm test`/`npm run <x>` ni une entrée de `CI_SEULEMENT`, ou qui
 * porte une clé non inerte, LÈVE : le classement est une décision, pas un silence.
 * `si` est la condition `if` écrite sur le step, telle quelle — la porte du classement du push la lit.
 * REND `[{ nom, commande, job, si }]`.
 */
export function gatesDeCi({ cwd = process.cwd(), fichier } = {}) {
  const gates = []
  const vus = new Set()
  for (const { job, commande, cles, si } of stepsCi({ cwd, fichier })) {
    if (job in JOBS_HORS_REJEU_LOCAL) continue
    const nom = nomDeGate(commande)
    const parasites = cles.filter((c) => !CLES_DE_STEP_INERTES.includes(c))
    if (nom && parasites.length)
      throw new Error(
        `step non classé : ${commande} — il porte ${parasites.join(', ')}, que « npm run ${nom} » ne ` +
          'reproduit pas ; donne-lui un script de package.json qui le porte, ou classe-le en CI_SEULEMENT',
      )
    if (!nom) {
      if (commande in CI_SEULEMENT) continue
      throw new Error(
        `step non classé : ${commande} — ajoute-le à package.json comme script (« npm run <x> ») ou à ` +
          'CI_SEULEMENT (scripts/gates/gatesDeCi.mjs) avec sa raison',
      )
    }
    if (vus.has(nom)) continue
    vus.add(nom)
    gates.push({ nom, commande, job, si })
  }
  return gates
}

/** Noms des jobs de `ci.yml`, dans l'ordre du fichier — jamais recopiés à la main : un job renommé
 *  change le nom de son check, et le ruleset doit suivre le fichier. */
export function jobsCi({ cwd = process.cwd(), fichier } = {}) {
  const lignes = readFileSync(cheminCi({ cwd, fichier }), 'utf8').split(/\r?\n/)
  const iJobs = lignes.findIndex((l) => /^jobs:\s*$/.test(l))
  if (iJobs === -1) throw new Error('ci.yml sans bloc `jobs:` — le ruleset ne peut pas nommer ses checks')
  return lignes
    .slice(iJobs + 1)
    .map((l) => /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l)?.[1])
    .filter(Boolean)
}
