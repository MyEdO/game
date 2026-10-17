import '../node-requis.mjs'
import { fileURLToPath } from 'node:url'
import { sortieDeSupervision, superviserProcessus } from '../guards/lib/superviserProcessus.mjs'

if (import.meta.main) {
  const resultat = await superviserProcessus({
    commande: process.execPath,
    args: [fileURLToPath(new URL('./pre-push.mjs', import.meta.url)), ...process.argv.slice(2)],
    heriter: true,
    surveillerGit: true,
  })
  process.exitCode = sortieDeSupervision(resultat)
}
