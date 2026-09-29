import { readCorpus } from '/home/user/game/.wt-1806-L1/scripts/guards/lib/sourceCorpus.mjs'
import { coupesAuCaractere } from '/home/user/game/.wt-1806-L1/scripts/guards/lib/coupeAuCaractere.mjs'
const c = readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.jsx'], tests: true })
console.log(c.length, JSON.stringify(coupesAuCaractere(c), null, 1))
