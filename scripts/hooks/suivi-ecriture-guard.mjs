// #2460, commentaire 6044039158, §3 ; #2498.
import { basename, dirname } from 'node:path'
import { OUTILS_ECRITURE, OUTILS_SHELL, cheminDEcriture, commandeDe, ecrituresDe, outilCouvert } from '../guards/lib/contratGarde.mjs'
import { ciblesDEcritureDeCommande } from '../guards/lib/ecrituresShell.mjs'
import { dossierDesSuivis } from '../guards/lib/gitPorte.mjs'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'
import { lancementsDuSuivi } from './suivi-lien-guard.mjs'

/** Le nom d'un fichier de suivi gardé. */
const FICHIER_DE_SUIVI = /^\d+\.(?:json|mesure\.json|md)$/

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

/** Le refus d'une commande shell, `null` si aucun fichier de suivi n'y est la cible d'une écriture. PURE. */
function refusDeCommande(commande, dir) {
  const { segments, lancements } = lancementsDuSuivi(commande)
  const autorises = new Set([...lancements].map(s => s.source))
  for (const cible of ciblesDEcritureDeCommande(commande, { base: dir, segments: segments.map(s => s.source), exclureArguments: s => autorises.has(s) })) {
    if (cible.inconnue) continue
    const refuse = refusDEcriture({ path: cible.chemin }, dir)
    if (refuse) return refuse
  }
  return null
}

function evaluer(entree, { dir, baseDeLAppel }) {
  if (outilCouvert(OUTILS_SHELL, entree.tool_name)) return refusDeCommande(commandeDe(entree), baseDeLAppel)
  return ecrituresDe(entree).map((ecrit) => refusDEcriture(ecrit, dir))
}

export const garde = { nom: 'suivi-ecriture', outils: [...OUTILS_ECRITURE, ...OUTILS_SHELL], evaluer }
