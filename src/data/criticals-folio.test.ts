import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeChapterReader, parseLineCitation } from '../../scripts/guards/lib/folioLineAlign.mjs';
import { critiqueDoc, type CritEntry, type CritTableKey, type JeuDeCritique } from './criticals';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const chapitres = makeChapterReader(JSON.parse(readFileSync(join(DATA_DIR, 'books.json'), 'utf8')));

/**
 * Garde-fou « la note d'une Blessure critique de `criticals.json` cite la LIGNE qui porte l'entrée »
 * (#1898), pour les 8 documents-tables des deux jeux : Livre de base (LDB 18) et Aux Armes (AA 07).
 *
 * Chaque rangée et chaque document-table cite SA ligne en `source.note` (réf nue
 * `<ABRÉV> <chapitre> l.<n>`). Que le folio déclaré soit celui qui gouverne cette ligne, c'est la
 * garde canonique `folio-line-align.test.ts` qui le juge. Ce que ce fichier exige, c'est que la ligne
 * citée soit la bonne : celle d'une rangée porte SA fourchette et SON libellé, celle d'un
 * document-table SON titre — et qu'une note décalée d'une ligne, dans un sens ou dans l'autre, soit
 * refusée.
 */

const FAMILLES: CritTableKey[] = ['tete', 'bras', 'corps', 'jambe'];
/** Titre de chaque table, au Livre de base comme dans Aux Armes — la Localisation « corps » s'y intitule
 *  « AU TORSE ». */
const TITRE: Record<CritTableKey, string> = { tete: 'À LA TÊTE', bras: 'AU BRAS', corps: 'AU TORSE', jambe: 'À LA JAMBE' };

/** Où chaque jeu imprime ses tables : id de livre (`books.json`), sigle et chapitre. */
const OU: Record<JeuDeCritique, { book: string; abbr: string; chapitre: number }> = {
  ldb: { book: 'livre-de-base', abbr: 'LDB', chapitre: 18 },
  aa: { book: 'aux-armes', abbr: 'AA', chapitre: 7 },
};
const JEUX = Object.keys(OU) as JeuDeCritique[];
const refDe = (jeu: JeuDeCritique) => `${OU[jeu].abbr} ${String(OU[jeu].chapitre).padStart(2, '0')}`;
const lignesDe = (jeu: JeuDeCritique) => chapitres(OU[jeu].abbr, OU[jeu].chapitre) ?? [];

const aPlat = (s: string) => s.replace(/<br>/g, ' ').replace(/[*_]/g, '').replace(/\s+/g, ' ');
const deux = (n: number) => (n === 100 ? '00' : String(n).padStart(2, '0'));

/** Les lignes (1-based) du chapitre du jeu qui portent la fourchette (`min-max`, ou `min ou plus`
 *  pour une bande ouverte) et le libellé de la rangée ; à égalité (même fourchette, même libellé dans
 *  deux tables), celle qui porte aussi l'ouverture de sa `desc`. */
function lignesDeRangee(jeu: JeuDeCritique, r: CritEntry): number[] {
  const fourchette = r.min === r.max ? deux(r.min) : `${deux(r.min)}(?:[-–]${deux(r.max)}| ou plus)`;
  const re = new RegExp(`(^|[|*\\s])${fourchette}([|*\\s])`);
  const lignes = lignesDe(jeu).map((l, i) => ({ l: aPlat(l), n: i + 1 }));
  let c = lignes.filter(({ l }) => re.test(l) && l.includes(r.label));
  if (c.length > 1) c = c.filter(({ l }) => l.includes(aPlat(r.desc).slice(0, 40)));
  return c.map(({ n }) => n);
}
const lignesDeTitre = (jeu: JeuDeCritique, f: CritTableKey) =>
  lignesDe(jeu).flatMap((l, i) => (l.includes(`BLESSURES CRITIQUES ${TITRE[f]}`) ? [i + 1] : []));

type Citation = { jeu: JeuDeCritique; cle: string; note: string | undefined; lignes: number[] };
/** Chaque document-table et chaque rangée des deux jeux : la note qu'il porte, et la (les) ligne(s) du
 *  chapitre de son jeu où vit ce qu'il décrit. */
const citations = (): Citation[] =>
  JEUX.flatMap((jeu) =>
    FAMILLES.flatMap((f) => {
      const d = critiqueDoc(jeu, f);
      return [
        { jeu, cle: `${jeu}/${f}/${d.id}`, note: d.source?.note, lignes: lignesDeTitre(jeu, f) },
        ...d.entries.map((r) => ({ jeu, cle: `${jeu}/${f}/${r.id}`, note: r.source.note, lignes: lignesDeRangee(jeu, r) })),
      ];
    }),
  );
/** Les citations dont la note n'est pas la réf nue `<ABRÉV> <chapitre> l.<n>` de l'UNIQUE ligne qui
 *  porte l'entrée. */
const fautives = (cs: readonly Citation[]) =>
  cs.flatMap(({ jeu, cle, note, lignes }) => {
    const c = parseLineCitation(note);
    const ok = lignes.length === 1 && note === `${refDe(jeu)} l.${lignes[0]}` && c?.line === lignes[0];
    return ok ? [] : [`${cle} : note « ${note} », ligne(s) de l'entrée dans ${refDe(jeu)} : ${lignes.join(', ') || 'aucune'}`];
  });

describe('criticals.json — la note cite la LIGNE qui porte l’entrée, dans les deux jeux (#1898)', () => {
  it.each(JEUX)('%s : 4 documents-tables de 20 rangées, tous au livre du jeu', (jeu) => {
    for (const f of FAMILLES) {
      const d = critiqueDoc(jeu, f);
      expect(d.source?.book, `${jeu}/${f} : livre`).toBe(OU[jeu].book);
      expect(d.entries.length, `${jeu}/${f} : 20 rangées attendues`).toBe(20);
      for (const r of d.entries) expect(r.source.book, `${jeu}/${f}/${r.id} : livre`).toBe(OU[jeu].book);
    }
  });

  it('168 citations : 8 documents-tables et 160 rangées', () => {
    expect(citations().length).toBe(168);
  });

  it('chaque note est la réf nue de SA ligne : fourchette et libellé pour une rangée, titre pour une table', () => {
    const f = fautives(citations());
    expect(f, `citation(s) hors de leur ligne :\n  ${f.join('\n  ')}`).toEqual([]);
  });

  it('l’instrument MORD : une note décalée d’une ligne, dans un sens ou dans l’autre, est refusée', () => {
    const cs = citations();
    for (const d of [1, -1]) {
      for (const [i, x] of cs.entries()) {
        const decale = cs.map((y, j) =>
          j === i ? { ...y, note: `${refDe(y.jeu)} l.${(parseLineCitation(y.note)?.line ?? 0) + d}` } : y,
        );
        expect(fautives(decale).map((s) => s.split(' ')[0]), `${x.cle} décalée de ${d}`).toEqual([x.cle]);
      }
    }
  });
});
