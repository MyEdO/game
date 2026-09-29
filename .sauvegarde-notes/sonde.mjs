import { readCorpus } from '/home/user/game/.wt-1806-L1/scripts/guards/lib/sourceCorpus.mjs';
import { coupesAuCaractere } from '/home/user/game/.wt-1806-L1/scripts/guards/lib/coupeAuCaractere.mjs';
process.chdir('/home/user/game/.wt-1806-L1');
console.log('src', coupesAuCaractere(readCorpus(['src'], { exts: ['.ts', '.tsx'], tests: true })));
console.log('scripts', coupesAuCaractere(readCorpus(['scripts'], { exts: ['.ts', '.tsx', '.mts', '.mjs'], tests: true })));
