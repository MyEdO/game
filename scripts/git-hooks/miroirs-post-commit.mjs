// Après un commit (#2578) : l'index du dépôt réaligné sur HEAD pour les miroirs d'agents que le
// pre-commit a produits dans un index EMPRUNTÉ (`realignerIndexDuDepot`, scripts/agents/compat-cli.mjs).
// Contrat de post-hook : son code ne change pas le commit (`git help githooks`, post-commit).
import '../node-requis.mjs'
import { realignerIndexDuDepot } from '../agents/compat-cli.mjs'
import { depotDe, raisonCourte } from '../guards/lib/gitPorte.mjs'

try {
  const chemins = realignerIndexDuDepot(depotDe(process.cwd()))
  if (chemins.length) process.stderr.write(`[post-commit] miroirs d'agents réalignés dans l'index : ${chemins.join(', ')}\n`)
} catch (e) {
  process.stderr.write(`[post-commit] miroirs d'agents NON réalignés dans l'index : ${raisonCourte(e?.message ?? e)}\n`)
}
