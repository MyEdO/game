import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { croissanceDesStocks } from '/home/user/game/.wt-1919-H2/scripts/guards/lib/stocksNominatifs.mjs'
const R='/home/user/game/.wt-1919-H2/'
const diff = execSync('git -C '+R+' diff HEAD -- scripts/guards/lib/cssCouchesStock.mjs', { encoding: 'utf8' })
const r = croissanceDesStocks(diff, { lirePostImage: (c) => readFileSync(R + c, 'utf8'), lireAnteImage: (c) => execSync('git -C '+R+' show HEAD:'+c, {encoding:'utf8'}) })
console.log(JSON.stringify(r, null, 1))
