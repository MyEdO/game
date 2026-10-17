import { fileURLToPath } from 'node:url'
import { ECRIT_LU, principal } from './toutes.mjs'

export function demandeDe(argv, gates = Object.keys(ECRIT_LU)) {
  let raison, noms
  for (let i = 0; i < argv.length; i += 2) {
    const valeur = argv[i + 1]
    if (typeof valeur !== 'string' || !valeur.trim() || /[$%`\r\n]/.test(valeur)) return null
    if (argv[i] === '--raison' && raison === undefined) raison = valeur.trim()
    else if (argv[i] === '--gates' && noms === undefined) noms = valeur.split(',')
    else return null
  }
  if (!raison || !noms?.length || noms.some(n => !gates.includes(n)) || new Set(noms).size !== noms.length) return null
  return { raison, noms }
}

export async function rejouer({ argv = process.argv.slice(2), journal = t => process.stderr.write(t), deleguer = principal } = {}) {
  const demande = demandeDe(argv)
  if (!demande) {
    journal('[gates-ci] REFUS : --raison <texte littéral non vide> et --gates <noms ECRIT_LU> requis.\n')
    return 1
  }
  journal(`[gates-ci] Rejeu local exceptionnel sur demande utilisateur : ${demande.noms.join(', ')} ; raison : ${demande.raison}\n`)
  return deleguer({ argv: [process.execPath, fileURLToPath(new URL('./toutes.mjs', import.meta.url)), '--gates', demande.noms.join(',')], journal })
}

if (import.meta.main) process.exitCode = await rejouer()
