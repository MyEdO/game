import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createHash } from 'node:crypto'
import { chargerAssets } from './asset/charger.mjs'

const { values } = parseArgs({ options: { sortie: { type: 'string' } } })
if (!values.sortie) throw new Error('--sortie <fichier JSON> requis')
const { figerVueDEquipement } = await chargerAssets(["export { figerVueDEquipement } from '/hotes/godot/recettes/equipement.ts';"])
const vue = figerVueDEquipement()
const texte = JSON.stringify(vue, null, 2) + '\n'
const sortie = resolve(values.sortie)
writeFileSync(sortie, texte)
console.log(JSON.stringify({ sortie, sha256: createHash('sha256').update(texte).digest('hex'), couverture: vue.couverture }, null, 2))
