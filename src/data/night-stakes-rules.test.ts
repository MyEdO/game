/**
 * Garde du RENVOI de règle des enjeux de la cascade de NUIT (#1117, lot L0a) — patron des fiches
 * `navigation-*` : chaque entrée de `night-stakes.json` porte un `rule` qui RÉSOUT vers une fiche
 * de `regles.json`, aucune fiche du périmètre n'est orpheline, et chaque fiche référencée est
 * VERBATIM dans le CHAPITRE que sa note cite, au folio IMPRIMÉ qu'elle déclare.
 *
 * Le folio ne se croit pas sur parole : il se RECALCULE depuis le marqueur `data-folio` le plus
 * proche en amont du passage cité, et doit égaler `source.page`. Et le verbatim s'ancre au FICHIER
 * DE CHAPITRE de la note — un paragraphe qui vit dans un autre chapitre du même livre est un défaut.
 */
import { describe, it, expect } from 'vitest';
import { chapterFile, readText, sigleDe } from '../../scripts/guards/lib/rawRefIntegrity.mjs';
import { NIGHT_STAKES, regles, books, skills, symptoms, etats } from './index';
import { coupeAuMot } from '../lib/coupeAuMot';

/** FOYERS possibles d'une règle (amendement A, 2026-08-06) : l'entité qui la PORTE d'abord —
 *  `regles.json` n'héberge que les règles de CADRE, sans entité porteuse. */
const FOYERS: Record<string, { id: string; label: string }[]> = {
  regles, skills, symptoms, etats,
};
const foyer = (e: { rule?: string; ruleCategory?: string }) =>
  e.rule ? (FOYERS[e.ruleCategory ?? 'regles'] ?? []).find((x) => x.id === e.rule) : undefined;

const RULE_BY_ID = new Map(regles.map((r) => [r.id, r]));
const BOOK_IDS = new Set(books.map((b) => b.id));
/** Fiches de `regles.json` référencées par la nuit — les foyers d'une AUTRE catégorie portent leur
 *  propre garde de source (chaque catalogue a la sienne) et sortent de ce périmètre. */
const NIGHT_RULE_IDS = new Set(
  NIGHT_STAKES.filter((e) => (e.ruleCategory ?? 'regles') === 'regles').map((e) => e.rule).filter((r): r is string => !!r),
);

/** Lignes du fichier de CHAPITRE cité par une note (`LDB 18 l.294-300` → `18 - Traumatisme.md`). */
const chapterCache = new Map<string, string[]>();
function chapterLines(bookId: string, note: string): string[] {
  const chap = /^\S+\s+(\d+)/.exec(note)?.[1];
  if (!chap) throw new Error(`note sans numéro de chapitre : « ${note} »`);
  const key = `${bookId}#${chap}`;
  if (!chapterCache.has(key)) {
    const abbr = sigleDe(bookId);
    const fichier = abbr ? chapterFile(abbr, chap) : null;
    if (!fichier) throw new Error(`chapitre ${chap} introuvable pour le livre ${bookId}`);
    chapterCache.set(key, readText(fichier.path).split('\n'));
  }
  return chapterCache.get(key)!;
}

/** Folio IMPRIMÉ d'une ligne (1-based) = dernier marqueur `data-folio` la précédant. */
function folioAt(lines: string[], lineNo: number): number | null {
  let f: number | null = null;
  for (let i = 0; i < lineNo; i++) {
    const m = /data-folio="(\d+)"/.exec(lines[i] ?? '');
    if (m) f = Number(m[1]);
  }
  return f;
}

describe('night-stakes.json — chaque enjeu porte sa règle (#1117 L0a)', () => {
  it('toute entrée a un `rule` qui résout vers son FOYER (entité porteuse, ou fiche de cadre)', () => {
    const orphelins = NIGHT_STAKES.filter((e) => !foyer(e)).map(
      (e) => `${e.id} → ${e.ruleCategory ?? 'regles'}:${e.rule ?? '(aucun)'}`,
    );
    expect(orphelins, 'entrée sans renvoi de règle résoluble').toEqual([]);
  });

  it('les kinds de la cascade de nuit sont couverts', () => {
    expect(NIGHT_STAKES.length, 'catalogue vide : la couverture ne dirait rien').toBeGreaterThan(0);
    expect(NIGHT_RULE_IDS.size).toBeGreaterThan(0);
  });

  it('aucune fiche du périmètre nuit n’est orpheline (chacune référencée par ≥1 entrée)', () => {
    // Les fiches de CADRE que la nuit fait vivre. Les foyers d'ENTITÉ (compétence `survie-en-exterieur`,
    // symptômes) n'y figurent pas : ils vivent pour eux-mêmes, la nuit ne fait que les pointer.
    const NUIT = [
      'faim-et-soif',
      'guerison-des-blessures',
      'exposition',
      'fractures',
      'resistance-a-l-alcool-dessoulage',
      'trauma',
      'temps-de-voyage',
      'symptomes-des-maladies',
    ];
    expect(NUIT.filter((id) => !RULE_BY_ID.has(id)), 'fiche du périmètre absente de regles.json').toEqual([]);
    expect(NUIT.filter((id) => !NIGHT_RULE_IDS.has(id)), 'fiche créée que rien ne référence').toEqual([]);
  });

  it('chaque fiche référencée est VERBATIM dans le chapitre cité, au folio DÉCLARÉ', () => {
    const defauts: string[] = [];
    for (const id of NIGHT_RULE_IDS) {
      const r = RULE_BY_ID.get(id)!;
      if (!BOOK_IDS.has(r.source.book)) {
        defauts.push(`${id} : livre inconnu ${r.source.book}`);
        continue;
      }
      const note = r.source.note ?? '';
      const lines = chapterLines(r.source.book, note);
      // Chaque paragraphe du desc est une LIGNE du chapitre — on retient la position de la première.
      let first: number | null = null;
      for (const para of r.desc.split('\n\n')) {
        const at = lines.indexOf(para);
        if (at < 0) {
          defauts.push(`${id} : paragraphe absent du chapitre cité (${note}) — « ${coupeAuMot(para, 60)} »`);
          continue;
        }
        if (first == null) first = at + 1;
      }
      if (first == null) continue;
      const folio = folioAt(lines, first);
      if (folio !== r.source.page) {
        defauts.push(`${id} : folio déclaré ${r.source.page} ≠ folio mesuré ${folio} (data-folio amont de ${note})`);
      }
    }
    expect(defauts).toEqual([]);
  });
});
