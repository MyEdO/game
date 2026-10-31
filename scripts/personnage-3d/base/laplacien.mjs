import { text } from 'node:stream/consumers'
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { preparerLaplacien, resoudreLaplacien } = await chargerEvaluateur('../construction/laplacien.ts')
const { fixes, aretes, seconds } = JSON.parse(await text(process.stdin))
const laplacien = preparerLaplacien(fixes, aretes)
process.stdout.write(JSON.stringify(seconds === undefined ? laplacien : resoudreLaplacien(laplacien, seconds)))
