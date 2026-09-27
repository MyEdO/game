/**
 * RELEVÉ des cellules de sort imprimées dans les profils de créature du livre fan `frenchy-bzh`
 * (#1897) : chaque rangée d'une table « Sort (VF) | Sort (VO) | … » du `Source/`, avec sa section de
 * table, son folio (pied de page `N sur M`, `marqueursDeFolio` de `scripts/guards/lib/folioIntegrity.mjs`)
 * et la créature dont elle suit le titre de profil. Module PUR de lecture (aucune écriture), consommé
 * par la migration `scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs` et par la garde
 * `src/data/sorts-du-livre-fan.test.ts`, qui résolvent chaque cellule par le pont
 * (`scripts/data/lib/pontSortsFan.ts`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - bibliothèque RAW ESM JS (pas de types) — même convention que `vite.config.ts`
import { REGISTRE_LIVRES, estLivreCitable, livreExtraitDe, sourceDirOf } from '../../raw/_lib.mjs';
import { marqueursDeFolio } from '../../guards/lib/folioIntegrity.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const LIVRE_FAN = 'frenchy-bzh';

/** Section de TABLE, lue au titre qui précède la table : un des composants de la clé du pont. */
export type Section = 'benediction' | 'miracle' | 'mineure' | 'sort';

export interface CelluleDeSort {
  /** Chapitre (nom de fichier sous le dossier d'extraction) et ligne 1-based de la rangée. */
  readonly fichier: string;
  readonly ligne: number;
  /** Colonnes imprimées, habillage retiré (`<br>` → espace, emphase ôtée). */
  readonly vf: string;
  readonly vo: string;
  readonly ni: string | null;
  readonly effet: string;
  /** Colonne Effet telle qu'imprimée (emphase Markdown gardée), `<br>` seul rendu en espace. */
  readonly effetImprime: string;
  readonly section: Section;
  /** Folio imprimé de la rangée (pied de page qui la suit). */
  readonly folio: number | null;
  /** Créature `frenchy-bzh` dont la rangée suit le titre de profil, ou `null` (profil absent, #1901). */
  readonly creature: string | null;
}

interface CreatureLue { readonly id: string; readonly label: string; readonly folder?: string | null; readonly source?: { book?: string; page?: number | null } | null }

const strip = (s: string) => s.replace(/<br>/g, ' ').replace(/\*\*|_/g, '').replace(/\s+/g, ' ').trim();
/** Clé de comparaison : habillage, casse, accents et apostrophes neutralisés. */
export const normCellule = (s: string) => strip(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/—/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
const cells = (l: string) => { const t = l.trim(); return t.slice(1, t.endsWith('|') ? -1 : undefined).split('|'); };
const isSep = (l: string) => /^\|(\s*:?-+:?\s*\|)+\s*$/.test(l.trim());
const isHeader = (cs: string[]) => {
  const n = cs.map(normCellule);
  return n.some((c) => /\bvo\b|\(vo\)/.test(c)) && n.some((c) => /^(sort|nom)/.test(c)) && n.some((c) => /portee/.test(c));
};
/** Titre de section de table : « Bénédictions de … », « Miracles de … », « Sorts de … ». */
const TITRE_DE_SECTION = /^(sorts?|benedictions?|miracles?)\b/;
const sectionDe = (titre: string): Section => {
  const t = normCellule(titre.replace(/^#+/, ''));
  if (t.startsWith('benediction')) return 'benediction';
  if (t.startsWith('miracle')) return 'miracle';
  return /\bmineure\b/.test(t) ? 'mineure' : 'sort';
};
const PROFIL = /^(?:#+\s*)?\*{0,2}\s*Niveau\s+\d+\s*[—–-]\s*(.+?)\s*\*{0,2}\s*$/;
const cleDeLibelle = (s: string) => normCellule(s).replace(/\d+$/, '').replace(/[.:]$/, '').trim();

/** Dossier d'extraction et sigle du livre `livre`, résolus au registre des livres. */
function livreDuReleve(livre: string): { dir: string; abbr: string } {
  const entree = livreExtraitDe(livre, REGISTRE_LIVRES, estLivreCitable);
  const rel = sourceDirOf(entree);
  if (!rel) throw new Error(`${livre} : aucun dossier d'extraction au registre des livres`);
  return { dir: join(ROOT, rel), abbr: entree.abbr };
}

/** Folio de l'offset `pos` : le dernier marqueur de début de folio qui le précède. */
function folioA(folios: [number, number][], pos: number): number | null {
  let f: number | null = null;
  for (const [o, n] of folios) { if (o > pos) break; f = n; }
  return f;
}

/** Les cellules de sort du livre du pont (`LIVRE_FAN`), relevées par `cellulesDeSortsDuLivre`. */
export const cellulesDeSortsFan = (creatures: readonly CreatureLue[]): CelluleDeSort[] => cellulesDeSortsDuLivre(LIVRE_FAN, creatures);

/**
 * Toutes les cellules de sort du livre `livre`, dans l'ordre de lecture (chapitres triés, lignes).
 * `creatures` = le bestiaire (`creatures.json`), dont seules les entrées ancrées à `livre` sont jointes :
 * même chapitre (`folder`, sigle du livre entre parenthèses ôté) et même libellé que le titre de
 * profil ; entre homonymes, le titre dont le pied de page PRÉCÉDENT vaut `source.page`.
 */
export function cellulesDeSortsDuLivre(livre: string, creatures: readonly CreatureLue[]): CelluleDeSort[] {
  const { dir, abbr } = livreDuReleve(livre);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const suffixeDuSigle = ` (${abbr})`;
  const fileOfFolder = (folder: string) => {
    const k = normCellule(folder.endsWith(suffixeDuSigle) ? folder.slice(0, -suffixeDuSigle.length) : folder);
    return files.find((f) => normCellule(f.replace(/^\d+ - /, '').replace(/\.md$/, '')) === k);
  };
  const parFichier = new Map<string, Map<string, CreatureLue[]>>();
  for (const c of creatures) {
    if (c.source?.book !== livre || !c.folder) continue;
    const f = fileOfFolder(c.folder);
    if (!f) continue;
    const k = cleDeLibelle(c.label.replace(/\s*\([^)]*\)\s*$/, ''));
    const m = parFichier.get(f) ?? parFichier.set(f, new Map()).get(f)!;
    (m.get(k) ?? m.set(k, []).get(k)!).push(c);
  }
  const rows: CelluleDeSort[] = [];
  for (const f of files) {
    const raw = readFileSync(join(dir, f), 'utf8').replace(/\r\n?/g, '\n');
    const lines = raw.split('\n');
    const debut: number[] = [];
    { let o = 0; for (const l of lines) { debut.push(o); o += l.length + 1; } }
    const folios = marqueursDeFolio(raw);
    const libelles = parFichier.get(f) ?? new Map<string, CreatureLue[]>();
    // Titres de profil, avec le folio du pied de page qui les PRÉCÈDE (jointure des homonymes).
    const heads: { line: number; key: string; folioPrecedent: number | null; creature: string | null }[] = [];
    let piedPrecedent: number | null = null;
    lines.forEach((l, i) => {
      const fm = l.match(/(\d+)\s+sur\s+\d+\s*$/); if (fm) piedPrecedent = Number(fm[1]);
      const t = l.trim(); if (t.includes('|') || !/^(#|\*\*)/.test(t)) return;
      const m = t.match(PROFIL);
      const key = cleDeLibelle(m ? m[1] : t.replace(/^#+\s*/, ''));
      if (m || libelles.has(key)) heads.push({ line: i + 1, key, folioPrecedent: piedPrecedent, creature: null });
    });
    for (const [key, cs] of libelles) for (const c of cs) {
      const hs = heads.filter((h) => h.key === key);
      const exact = hs.filter((h) => h.folioPrecedent === c.source?.page);
      const pick = exact.length ? exact : hs.filter((h) => !cs.some((o) => o !== c && o.source?.page === h.folioPrecedent));
      for (const h of pick) h.creature = c.id;
    }
    // Tables de sort : un en-tête « Sort (VF) | Sort (VO) | … | Portée », ou une table sans en-tête dont la
    // 2e colonne est la VO en italique, ou la SUITE d'une table coupée par un pied de page.
    type Schema = { cols: number; vf: number; vo: number; ni: number; enteteAbsent: boolean };
    let derniere: { schema: Schema; fin: number } | null = null;
    let i = 0;
    while (i < lines.length) {
      if (!lines[i].trim().startsWith('|')) { i++; continue; }
      const start = i; const block: [number, string][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { block.push([i, lines[i]]); i++; }
      const hdr = block.find(([, l]) => !isSep(l) && isHeader(cells(l)));
      let schema: Schema | null = null;
      if (hdr) {
        const n = cells(hdr[1]).map(normCellule);
        const vf = n.findIndex((c) => /^(sort|nom)/.test(c) && /vf/.test(c));
        schema = { cols: n.length, vf: vf < 0 ? 0 : vf, vo: n.findIndex((c) => /\bvo\b|\(vo\)/.test(c)), ni: n.findIndex((c) => c === 'ni'), enteteAbsent: false };
      } else if (block.some(([, l]) => /^\|[^|]*\|\s*_[^|]*_\s*\|/.test(l.trim()))) {
        const w = cells(block.find(([, l]) => /^\|[^|]*\|\s*_[^|]*_\s*\|/.test(l.trim()))![1]).length;
        schema = { cols: w, vf: 0, vo: 1, ni: w === 7 ? 2 : -1, enteteAbsent: true };
      } else if (derniere) {
        const ecart = lines.slice(derniere.fin + 1, start).filter((l) => l.trim() && !/^\s*\d+\s+sur\s+\d+\s*$/.test(l));
        const w = cells(block.find(([, l]) => !isSep(l))?.[1] ?? '|').length;
        if (ecart.length === 0 && w === derniere.schema.cols) schema = derniere.schema;
      }
      if (!schema) {
        if (derniere && !lines.slice(derniere.fin + 1, start).every((l) => !l.trim() || /^\s*\d+\s+sur\s+\d+\s*$/.test(l))) derniere = null;
        continue;
      }
      for (const [ln, l] of block) {
        if (isSep(l) || (hdr && ln === hdr[0])) continue;
        const cs = cells(l);
        if (isHeader(cs)) continue;
        if (schema.enteteAbsent && !/^\s*_[^|]*_\s*$/.test(cs[1] ?? '')) continue;
        const vf = strip(cs[schema.vf] ?? ''); const vo = strip(cs[schema.vo] ?? '');
        if (!vf && !vo) continue;
        let titre = '';
        for (let j = ln; j >= 0; j--) {
          const t = lines[j].trim();
          if ((t.startsWith('#') || t.startsWith('**')) && TITRE_DE_SECTION.test(normCellule(t.replace(/^#+/, '')))) { titre = t; break; }
        }
        const h = heads.filter((x) => x.line <= ln + 1).pop();
        rows.push({
          fichier: f, ligne: ln + 1, vf, vo, ni: schema.ni >= 0 ? strip(cs[schema.ni] ?? '') : null,
          effet: strip(cs[cs.length - 1] ?? ''), effetImprime: (cs[cs.length - 1] ?? '').replace(/<br>/g, ' ').replace(/ {2,}/g, ' ').trim(), section: sectionDe(titre),
          folio: folioA(folios, debut[ln]), creature: h?.creature ?? null,
        });
      }
      derniere = { schema, fin: i - 1 };
    }
  }
  return rows;
}
