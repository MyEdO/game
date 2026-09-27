/**
 * Régénère `SPELL_NARRATIF_STOCK` (stock des sorts narratifs) et `SPELL_NARRATIF_PARAPHRASE_STOCK`
 * (ops `narrative` qui paraphrasent leur `desc`) depuis la MESURE réelle.
 *   npx tsx scripts/data/regen-spell-narratif-stock.mts [--check] [--amorce]
 *
 * DÉCROISSANT-SEULEMENT — il REFUSE d'écrire dès qu'un sort narratif MESURÉ n'est pas déjà au stock,
 * SITE PAR SITE (`refusDeCroissance`, guards/lib/stock.mjs). `--amorce` saute cette barrière : légal
 * au seul commit qui CRÉE le stock (`regenererStock`, guards/lib/regenStock.mts).
 *
 * La MESURE n'est pas ici : `sitesNarratifs` (`scripts/data/lib/sortsNarratifs.ts`), la même que
 * celle de la garde `src/data/spell-narratifs.test.ts`.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { sitesNarratifs, sitesNarratifsParaphrases } from './lib/sortsNarratifs';
import { SPELL_NARRATIF_PARAPHRASE_STOCK, SPELL_NARRATIF_STOCK } from '../guards/lib/spellNarratifStock.mjs';
import { sitesEnEntrees } from '../guards/lib/stock.mjs';
import { regenererStock } from '../guards/lib/regenStock.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

process.exit(regenererStock({
  chemin: resolve(ROOT, 'scripts/guards/lib/spellNarratifStock.mjs'),
  check: process.argv.includes('--check'),
  amorce: process.argv.includes('--amorce'),
  outil: 'npx tsx scripts/data/regen-spell-narratif-stock.mts',
  collections: [{
    nom: 'SPELL_NARRATIF_STOCK',
    mesurees: sitesEnEntrees(sitesNarratifs()),
    stock: SPELL_NARRATIF_STOCK,
    motif: "Un sort neuf se MÉCANISE (`effects` qui applique ses effets), il ne s'entérine pas ici.",
  }, {
    nom: 'SPELL_NARRATIF_PARAPHRASE_STOCK',
    mesurees: sitesEnEntrees(sitesNarratifsParaphrases()),
    stock: SPELL_NARRATIF_PARAPHRASE_STOCK,
    motif: 'Une op `narrative` recopie sa `desc` VERBATIM (règle 5 de `CLAUDE.md`), elle ne la paraphrase pas.',
  }],
}));
