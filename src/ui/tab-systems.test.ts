import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Cliquet de COMPTE #288/#314 : les 5 systèmes d'onglets CSS historiques (`.port-tabs`, `.zone-tabs`,
 * `.logic-tabs`, `.merchant-tabs`+`.merch-subtabs`, `.sheet-tabs`) sont MORTS — fusionnés dans la
 * primitive UNIQUE `<Tabs>` (`src/ui/composites/Tabs.tsx`, styles `src/ui/styles/tabs.css`). Le cliquet est
 * DÉCROISSANT : baseline ZÉRO pour tout sélecteur `.xxx-tabs` (une nouvelle occurrence = un 6e système
 * réintroduit). `<Tabs>` porte une présentation UNIQUE [entériné 2026-07-14, #414] — un besoin
 * d'onglets se compose avec la primitive telle quelle, jamais un CSS à part ni une variante réintroduite.
 */

/** Les feuilles de style de `src/ui`. */
const FICHIERS_UI = () => readCorpus(['src/ui'], { exts: ['.css'] });
const rel = (r: string) => r.slice('src/ui/'.length);

/** Sélecteurs de classe `.xxxtabs`/`.xxx-tabs` (SUFFIXE littéral `tabs`) définis dans un fichier CSS —
 *  le nom de la primitive canonique `.tabs` ne matche PAS ce motif (trop court : voir cliquet ci-dessous). */
function tabsSuffixSelectors(src: string): string[] {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, ''); // un commentaire citant `.port-tabs` n'est pas une régression
  const out: string[] = [];
  const re = /\.([A-Za-z][\w-]*tabs)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(noComments))) out.push(m[1]);
  return out;
}

describe('#288/#314 — cliquet DÉCROISSANT des systèmes d’onglets CSS (baseline zéro)', () => {
  it('aucune classe `.xxx-tabs` (les 5 anciens systèmes sont morts, fusionnés dans <Tabs>)', () => {
    const offenders: string[] = [];
    for (const { rel: r, text } of FICHIERS_UI()) {
      for (const cls of new Set(tabsSuffixSelectors(text))) offenders.push(`${rel(r)} → .${cls}`);
    }
    expect(
      offenders,
      "Nouveau système d'onglets CSS — composer la primitive <Tabs> (src/ui/composites/Tabs.tsx, présentation unique), jamais un CSS à part :\n" + offenders.join('\n'),
    ).toEqual([]);
  });
});
