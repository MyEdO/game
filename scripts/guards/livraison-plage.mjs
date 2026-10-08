// GATE `livraison:plage` (#2328 A3) : la plage à publier, `merge-base(origin/main, HEAD)..HEAD`, ne
// porte aucune fusion dont la résolution substantielle n'est pas jugée (`verdictDePublication`,
// scripts/guards/lib/livraison.mjs). `--base <ref>` remplace `origin/main`. Rend 1 au refus. Le
// verdict dépend de la fraîcheur de la base : chaque ligne nomme sa borne, et un refus HORS CI
// (`CI`, posée par GitHub Actions) rappelle le `git fetch` qui la rafraîchit.
import '../node-requis.mjs'
import { TRONC, depotDe } from './lib/gitPorte.mjs'
import { verdictDePublication } from './lib/livraison.mjs'

/** Le geste d'un refus local : une base périmée fait entrer dans la plage des fusions déjà publiées. */
const GESTE_DE_FRAICHEUR = 'Geste : `git fetch origin` si cette base est antérieure à la dernière publication, puis rejouer.'

if (import.meta.main) {
  const rang = process.argv.indexOf('--base')
  const base = rang === -1 ? TRONC.suivi : process.argv[rang + 1]
  const { ok, texte } = await verdictDePublication(depotDe(process.cwd()), { base })
  if (ok) {
    process.stdout.write(`[livraison:plage] ${texte}\n`)
  } else {
    process.stderr.write(`[livraison:plage] ${texte}\n${process.env.CI === 'true' ? '' : `${GESTE_DE_FRAICHEUR}\n`}`)
    process.exit(1)
  }
}
