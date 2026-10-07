// Garde PreToolUse de l'ÉCRITURE du suivi de vague (#2460) : `.git/suivi/<N>.json`, sa mesure
// `<N>.mesure.json` et l'ancien `<N>.md` ne s'écrivent que par `scripts/ops/suivi.mjs`. « Ca aurait du
// etre un json modifiable que via des outils adaptés, histoire d'éviter de faire n'importe quoi dessus,
// non ? » (utilisateur, 2026-10-07, #2460). Design jugé : #2460, commentaire 6044039158, §3.
//
// - Write, Edit, `ctx_patch` (`OUTILS_ECRITURE`) : refus quand le chemin résolu (`cheminDEcriture`) est
//   un tel fichier, directement sous `dossierDesSuivis`.
// - Shell (`OUTILS_SHELL`) : refus quand, dans un segment exécuté, un tel fichier cité sous un chemin `suivi`
//   est la CIBLE d'une redirection (`ciblesDeRedirection`), ou un argument d'une commande qui ÉCRIT
//   (`ECRIVAINS`, un interpréteur `INTERPRETES`, `ecritMalgreLaTete` : `sed -i`, `sort -o`…) hors d'un
//   lancement de `scripts/ops/suivi.mjs` (`lancementsDuSuivi`). Un chemin cité dans un argument TEXTE
//   (`gh … --body "voir .git/suivi/665.json"`, un geste du suivi) n'est pas une écriture ; une lecture
//   (`cat`, `Get-Content`) non plus.
//
// Poreuse par construction : un script FICHIER qui écrit le JSON, un `cd .git/suivi && cp a 665.json`, un
// éditeur externe passent. La seconde ligne, indépendante du canal, est la lecture : schéma et
// empreinte (`lireSuivi`, scripts/ops/suiviDonnee.mjs) disent un suivi écrit hors de l'outil.
import { basename, dirname } from 'node:path'
import { OUTILS_ECRITURE, OUTILS_SHELL, cheminDEcriture, commandeDe, ecrituresDe, outilCouvert } from '../guards/lib/contratGarde.mjs'
import { basenameExecutable, ciblesDeRedirection, ecritMalgreLaTete, sansRedirections } from '../guards/lib/commandeShell.mjs'
import { dossierDesSuivis } from '../guards/lib/gitPorte.mjs'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'
import { lancementsDuSuivi } from './suivi-lien-guard.mjs'

/** Le nom d'un fichier de suivi gardé. */
const FICHIER_DE_SUIVI = /^\d+\.(?:json|mesure\.json|md)$/

/** Un fichier de suivi gardé, cité sous un chemin `suivi`. */
const CITE = /suivi[\\/]+\d+\.(?:mesure\.json|json|md)(?![\w.])/

/** Les commandes qui ÉCRIVENT les chemins qu'elles reçoivent : copie, déplacement, création, troncature,
 *  suppression — POSIX et PowerShell (cmdlets et alias). */
const ECRIVAINS = new Set([
  'cp', 'mv', 'tee', 'touch', 'rm', 'ln', 'install', 'dd', 'truncate',
  'set-content', 'sc', 'add-content', 'ac', 'out-file', 'tee-object', 'new-item', 'ni', 'copy-item', 'cpi', 'copy',
  'move-item', 'mi', 'move', 'remove-item', 'ri', 'del', 'erase', 'rename-item', 'rni',
])

/** Les interpréteurs : leur code en ligne (`node -e`, `python -c`, `pwsh -Command`) écrit ce qu'il veut. */
const INTERPRETES = new Set(['node', 'python', 'python3', 'py', 'perl', 'ruby', 'deno', 'bun', 'bash', 'sh', 'zsh', 'pwsh', 'powershell'])

/** Le refus, pour le fichier `cite`. PURE. */
const refus = (cite) => ({
  decision: 'deny',
  raison: `⛔ Le suivi de vague (${cite}) ne s'écrit que par son outil : \`npm run ops:suivi -- <N> --<geste> …\` `
    + '(ou `--lot <json>`), ou l\'outil MCP `suivi` du mod harnais ; les gestes : `FORMES_DU_CLI` de scripts/ops/suiviDonnee.mjs. '
    + 'Une écriture directe casse son empreinte : il se relirait « écrit hors de l\'outil ». '
    + 'Pour le LIRE : `npm run ops:suivi -- <N> --rendu`.',
})

/** Le même chemin, à la casse près sous win32. PURE. */
const meme = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)

/** Le refus d'UNE écriture de fichier, `null` hors du dossier des suivis ; un relatif se résout contre `dir`. */
function refusDEcriture(ecrit, dir) {
  const chemin = cheminDEcriture(ecrit, { base: dir })
  if (chemin === null || !FICHIER_DE_SUIVI.test(basename(chemin.reel))) return null
  const dossier = dossierDesSuivis(dir)
  return dossier.disponible && meme(dirname(chemin.reel), canoniser(dossier.valeur)) ? refus(chemin.reel) : null
}

/** Vrai si le segment (textes) est une commande qui écrit ses arguments. PURE. */
const ecritSesArguments = (textes) => {
  const tete = basenameExecutable(textes[0])
  return ECRIVAINS.has(tete) || INTERPRETES.has(tete) || ecritMalgreLaTete(textes)
}

/** Le refus d'une commande shell, `null` si aucun fichier de suivi n'y est la cible d'une écriture. PURE. */
function refusDeCommande(commande) {
  if (!CITE.test(commande)) return null
  const { segments, lancements } = lancementsDuSuivi(commande)
  for (const s of segments) {
    const ecrits = [
      ...ciblesDeRedirection(s.source.jetons),
      ...(!lancements.has(s) && ecritSesArguments(s.jetons) ? sansRedirections(s.source.jetons).slice(1).map((j) => j.text) : []),
    ]
    const cite = ecrits.map((t) => CITE.exec(t)?.[0]).find(Boolean)
    if (cite) return refus(cite)
  }
  return null
}

function evaluer(entree, { dir }) {
  if (outilCouvert(OUTILS_SHELL, entree.tool_name)) return refusDeCommande(commandeDe(entree))
  return ecrituresDe(entree).map((ecrit) => refusDEcriture(ecrit, dir))
}

export const garde = { nom: 'suivi-ecriture', outils: [...OUTILS_ECRITURE, ...OUTILS_SHELL], evaluer }
