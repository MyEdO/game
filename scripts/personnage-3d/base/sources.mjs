#!/usr/bin/env node
// La commande du tirage des packs sources d'une base (#3248, `sources.ts`) : écrit sur la sortie standard les options
// `--<pack>` et `--licence-<pack>` de la construction.
//   node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py $(node scripts/personnage-3d/base/sources.mjs) --sortie <dossier>/humanoide.glb
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'
import { SOURCES } from './production.ts'

try {
  const { tirerSources } = await chargerEvaluateur('../../../../scripts/personnage-3d/base/sources.ts')
  const chemins = await tirerSources()
  console.log(SOURCES.flatMap((s) => [`--${s}`, chemins[s].source, `--licence-${s}`, chemins[s].licence]).join(' '))
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
}
