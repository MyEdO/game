import { text } from 'node:stream/consumers'
import { poidsRelatifsDesAretes, preparerLaplacien, resoudreLaplacien } from './laplacien.ts'
const { fixes, aretes, positions, aretesNeutres, laplacien, seconds } = JSON.parse(await text(process.stdin))
process.stdout.write(JSON.stringify(seconds === undefined ? preparerLaplacien(fixes, aretes, poidsRelatifsDesAretes(positions, aretesNeutres)) : resoudreLaplacien(laplacien, seconds)))
