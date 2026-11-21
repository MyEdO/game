import { relative } from 'node:path'
import { cheminDuDepot } from '../../source/adresses.mjs'

/** Exige le cwd du worktree qui porte une CLI Atlas à chemins de dépôt relatifs. */
export function exigerRacineAtlas() {
  const racine = cheminDuDepot('.')
  if (relative(racine, process.cwd()) === '') return
  console.error('Lancez cet outil Atlas depuis la racine du dépôt : ' + racine)
  process.exit(2)
}
