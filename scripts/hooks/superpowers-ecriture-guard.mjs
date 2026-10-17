import { OUTILS_ECRITURE, OUTILS_SHELL, cheminDEcriture, commandeDe, ecrituresDe, outilCouvert } from '../guards/lib/contratGarde.mjs'
import { ciblesDEcritureDeCommande } from '../guards/lib/ecrituresShell.mjs'

const protege = (chemin) => /(?:^|[\\/])\.superpowers(?:[\\/]|$)/i.test(chemin)
const refus = (chemin) => ({
  decision: 'deny',
  raison: 'Écriture refusée sous .superpowers : ' + chemin + ' ; consigner au ticket ou sous .git/suivi/archives/<N>/.',
})

function evaluer(entree, { dir, baseDeLAppel }) {
  if (outilCouvert(OUTILS_SHELL, entree.tool_name)) {
    for (const cible of ciblesDEcritureDeCommande(commandeDe(entree), { base: baseDeLAppel })) {
      if (cible.inconnue) continue
      const chemin = cheminDEcriture({ path: cible.chemin }, { base: dir })
      if (chemin && protege(chemin.reel)) return refus(chemin.reel)
    }
    return null
  }
  return ecrituresDe(entree).map((ecrit) => {
    const chemin = cheminDEcriture(ecrit, { base: dir })
    return chemin && protege(chemin.reel) ? refus(chemin.reel) : null
  })
}

export const garde = { nom: 'superpowers-ecriture', outils: [...OUTILS_ECRITURE, ...OUTILS_SHELL], evaluer }
