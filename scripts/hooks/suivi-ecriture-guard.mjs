// Garde PreToolUse de l'ÉCRITURE du suivi de vague (#2460) : `.git/suivi/<N>.json`, sa mesure
// `<N>.mesure.json` et l'ancien `<N>.md` ne s'écrivent que par `scripts/ops/suivi.mjs`. « Ca aurait du
// etre un json modifiable que via des outils adaptés, histoire d'éviter de faire n'importe quoi dessus,
// non ? » (utilisateur, 2026-10-07, #2460). Design jugé : #2460, commentaire 6044039158, §3.
//
// - Write, Edit, `ctx_patch` (`OUTILS_ECRITURE`) : refus quand le chemin résolu (`cheminDEcriture`) est
//   un tel fichier, directement sous `dossierDesSuivis`.
// - Shell (`OUTILS_SHELL`), en SUR-APPROXIMATION : refus quand un segment exécuté cite un tel fichier sous
//   un chemin `suivi`, hors des lectures (`commandeDeLecture`) et hors de l'argv d'un lancement de
//   `scripts/ops/suivi.mjs` (`lancementsDuSuivi`) — dont les redirections, elles, comptent.
//
// Poreuse par construction : un script FICHIER qui écrit le JSON, un `cd .git/suivi && … > 665.json`,
// un éditeur externe passent. La seconde ligne, indépendante du canal, est la lecture : schéma et
// empreinte (`lireSuivi`, scripts/ops/suiviDonnee.mjs) disent un suivi écrit hors de l'outil.
import { basename, dirname } from 'node:path'
import { OUTILS_ECRITURE, OUTILS_SHELL, cheminDEcriture, commandeDe, ecrituresDe, outilCouvert } from '../guards/lib/contratGarde.mjs'
import { commandeDeLecture, finAvantOperateur } from '../guards/lib/commandeShell.mjs'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'
import { dossierDesSuivis } from '../ops/suivi.mjs'
import { lancementsDuSuivi } from './suivi-lien-guard.mjs'

/** Le nom d'un fichier de suivi gardé. */
const FICHIER_DE_SUIVI = /^\d+\.(?:json|mesure\.json|md)$/

/** Un fichier de suivi gardé, cité sous un chemin `suivi`. */
const CITE = /suivi[\\/]+\d+\.(?:mesure\.json|json|md)(?![\w.])/

/** Le refus, pour le fichier `cite`. PURE. */
const refus = (cite) => ({
  decision: 'deny',
  raison: `⛔ Le suivi de vague (${cite}) ne s'écrit que par son outil : \`npm run ops:suivi -- <N> --<geste> …\` `
    + '(ou `--lot <json>`), ou l\'outil MCP `suivi` du mod harnais ; les gestes : la table `GESTES` de scripts/ops/suivi.mjs. '
    + 'Une écriture directe casse son empreinte : il se relirait « écrit hors de l\'outil ».',
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

/** Le refus d'une commande shell, `null` si elle ne cite aucun fichier de suivi hors lecture et hors lancement de l'outil. PURE. */
function refusDeCommande(commande) {
  if (!CITE.test(commande) || commandeDeLecture(commande)) return null
  const { segments, lancements } = lancementsDuSuivi(commande)
  for (const s of segments) {
    const jetons = lancements.has(s) ? s.jetons.slice(finAvantOperateur(s.jetons)) : s.jetons
    const cite = jetons.map((j) => CITE.exec(j)?.[0]).find(Boolean)
    if (cite) return refus(cite)
  }
  return null
}

function evaluer(entree, { dir }) {
  if (outilCouvert(OUTILS_SHELL, entree.tool_name)) return refusDeCommande(commandeDe(entree))
  return ecrituresDe(entree).map((ecrit) => refusDEcriture(ecrit, dir))
}

export const garde = { nom: 'suivi-ecriture', outils: [...OUTILS_ECRITURE, ...OUTILS_SHELL], evaluer }
