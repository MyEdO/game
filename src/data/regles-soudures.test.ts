/**
 * GARDE des SOUDURES de folio (#1117 L1a) — une fiche de `regles.json` ne peut pas AMPUTER le RAW.
 *
 * Le `data-folio` scinde un paragraphe en DEUX lignes du Markdown extrait : la première se termine en
 * pleine phrase (« …Comme vous lui »), la seconde ouvre le folio suivant (« tournez le dos, … »).
 * Nettoyer la balise sans recoller la phrase donne un verbatim MUTILÉ dont la CAUSE disparaît — c'est
 * arrivé à la fiche `fuite` (le +20 au toucher perdait « comme vous lui tournez le dos »).
 *
 * La garde relit le Source : pour toute ligne de la plage citée qui se termine SANS ponctuation
 * finale, la suite (première ligne non vide après le marqueur) doit se retrouver dans la `desc`.
 */
import { describe, it, expect } from 'vitest';
import { chapterFile, readText, sigleDe } from '../../scripts/guards/lib/rawRefIntegrity.mjs';
import { regles } from './index';

const chapCache = new Map<string, string[] | null>();
function chapitre(bookId: string, ch: string): string[] | null {
  const key = `${bookId}#${ch}`;
  if (!chapCache.has(key)) {
    const abbr = sigleDe(bookId);
    const f = abbr ? chapterFile(abbr, ch) : null;
    chapCache.set(key, f ? readText(f.path).split('\n') : null);
  }
  return chapCache.get(key)!;
}

/** Une ligne « propre » finit sur une ponctuation finale, une emphase ou une cellule de tableau. */
const FIN = /[.!?»:)\]]$|\*$|\|$/;

/** Amputations détectées : `fiche (ligne → suite perdue)`. */
export function amputations(fiches: typeof regles): string[] {
  const out: string[] = [];
  for (const r of fiches) {
    const m = /^\S+\s+(\d+)\s+l\.(\d+)(?:-(\d+))?/.exec(r.source.note ?? '');
    if (!m) continue;
    const L = chapitre(r.source.book, m[1]);
    if (!L) continue;
    const a = Number(m[2]);
    const b = Number(m[3] ?? m[2]);
    for (let i = a; i <= b; i++) {
      const t = (L[i - 1] ?? '').trim();
      if (!t || /^#|<span/.test(t) || FIN.test(t)) continue;
      let j = i;
      while (j < L.length && !/\S/.test(L[j])) j++;
      if (/^#/.test((L[j] ?? '').trim())) continue; // un titre ouvre une section : il ne continue aucune phrase
      const tete = (L[j] ?? '').replace(/^.*<\/span>/, '').trim().split(' ').slice(0, 3).join(' ');
      if (tete && !r.desc.includes(tete)) out.push(`${r.id} : l.${i} se termine sur « …${t.slice(-24)} », la suite « ${tete}… » manque à la desc`);
    }
  }
  return out;
}

describe('regles.json — aucune fiche n’AMPUTE le RAW à une soudure de folio (#1117)', () => {
  it('toute phrase scindée par un marqueur de folio est RECOLLÉE dans la desc', () => {
    expect(amputations(regles), 'verbatim mutilé : recoller la phrase et DÉCLARER la soudure en note').toEqual([]);
  });

  it('FAIL-CLOSED : une fiche amputée synthétique est DÉTECTÉE', () => {
    const fuite = regles.find((r) => r.id === 'fuite')!;
    const mutilee = { ...fuite, desc: fuite.desc.replace(/Comme vous lui tournez le dos.*$/s, "comme d'habitude.") };
    expect(amputations([mutilee] as typeof regles)).toHaveLength(1);
    expect(amputations([fuite] as typeof regles)).toEqual([]);
  });
});
