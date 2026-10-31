import { text } from 'node:stream/consumers'
import { preparerLaplacien, resoudreLaplacien } from './laplacien.ts'
const { fixes, aretes, laplacien, seconds } = JSON.parse(await text(process.stdin))
process.stdout.write(JSON.stringify(seconds === undefined ? preparerLaplacien(fixes, aretes) : resoudreLaplacien(laplacien, seconds)))
