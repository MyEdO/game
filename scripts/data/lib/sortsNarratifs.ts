/**
 * MESURE des sorts NARRATIFS — ceux que `spellSupportOf` (`src/engine/spellspec.ts`) classe
 * `narratif` —, et des ops `narrative` qui PARAPHRASENT leur `desc`. Module PUR, consommé par le
 * recensement (`scripts/qc/spell-support-census.mts`), par la garde (`src/data/spell-narratifs.test.ts`)
 * et par le régénérateur de ses stocks (`scripts/data/regen-spell-narratif-stock.mts`).
 */
import { spells, type SpellData } from '../../../src/data/index';
import { spellSupportOf } from '../../../src/engine/spellspec';
import { spellEffectOps } from '../../../src/engine/flowCore';

/** Dataset qui DÉCLARE les sorts — le `fichier` de chaque entrée du stock. */
export const FICHIER_DES_SORTS = 'src/data/spells.json';

/** Les sorts narratifs, dans l'ordre de `spells.json`. */
export const sortsNarratifs = () => spells.filter((s) => spellSupportOf(s) === 'narratif');

/** Les sorts narratifs en SITES (`{ file, ref }`, `scripts/guards/lib/stock.d.mts`) : `ref` = l'id. */
export const sitesNarratifs = () => sortsNarratifs().map((s) => ({ file: FICHIER_DES_SORTS, ref: s.id }));

/** `text` d'une op `narrative` réduit à ce qui doit se lire dans la `desc` : blancs ramenés à une
 *  espace, préfixe de journal `« <label> : »` retiré (il nomme le sort, il ne cite pas la `desc`). */
const corpsNarratif = (texte: string, label: string): string => {
  const t = texte.replace(/\s+/g, ' ').trim();
  return t.startsWith(`${label} : `) ? t.slice(label.length + 3) : t;
};

/** Les ops `narrative` qui PARAPHRASENT : leur `text` n'est pas une sous-chaîne verbatim de la `desc`
 *  qui les porte (règle 5 de `CLAUDE.md`), en SITES (`ref` = l'id, une occurrence par op). Une variante
 *  n'est mesurée que si elle porte ses propres `effects`, face à sa propre `desc`. */
export const sitesNarratifsParaphrases = () => spells.flatMap((s) => [
  s, ...((s as { variants?: Pick<SpellData, 'desc' | 'effects'>[] }).variants ?? []),
].flatMap((porteur, i) => {
  if (i > 0 && !porteur.effects) return [];
  const desc = (porteur.desc ?? s.desc ?? '').replace(/\s+/g, ' ');
  return spellEffectOps(porteur.effects)
    .filter((o) => o.op === 'narrative' && !desc.includes(corpsNarratif(o.text, s.label)))
    .map(() => ({ file: FICHIER_DES_SORTS, ref: s.id }));
}));
