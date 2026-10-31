import { text } from 'node:stream/consumers'
import { preparerLaplacien, resoudreLaplacien } from './laplacien.ts'
const { fixes, aretes, seconds } = JSON.parse(await text(process.stdin))
const laplacien = preparerLaplacien(fixes, aretes)
process.stdout.write(JSON.stringify(seconds === undefined ? laplacien : resoudreLaplacien(laplacien, seconds)))
