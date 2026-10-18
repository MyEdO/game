import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
import { sitesBandeEnLigne } from '../../scripts/guards/lib/bandeEnLigne.mjs';

/**
 * Garde de la primitive `fourchette` (`src/engine/tables.ts`, #1595) : dans `src/ui`, la graphie d'une
 * bande de table ne se recompose pas en ligne. Motif et angle mort : en-tête de `bandeEnLigne.mjs`.
 * EXCLUSIONS AU SITE (fichier + texte du site), chacune un intervalle qui n'est PAS une bande de table :
 */
const HORS_BANDE = new Map<string, string>([
  ['src/ui/NumberField.tsx :: <span id={domaineId} className="hint" role="status">{min}–{max}</span>', 'domaine d’une saisie numérique, rendu au refus : des bornes de champ, aucune ligne de table'],
  ["src/ui/compendium/registry.ts :: `de ${r.min} à ${r.max}${r.step ? ` (pas de ${r.step})` : ''}`", 'bornes de SAISIE d’un réglage (concept `bornes`, `bornesSchema`), aucune ligne de table'],
]);

describe('#1595 — une bande de table s’écrit par `fourchette`', () => {
  it('aucune bande recomposée en ligne dans src/ui, sauf exclusion au site ; toute exclusion vise un site vivant', () => {
    const sites: string[] = [];
    const lignes: string[] = [];
    for (const { fichier, sourceFile } of analyserCorpus(readCorpus(['src/ui']))) {
      if (!sourceFile) continue;
      for (const s of sitesBandeEnLigne(fichier, sourceFile)) {
        sites.push(`${fichier.rel} :: ${s.texte}`);
        lignes.push(`${fichier.rel}:${s.ligne} ${s.texte}`);
      }
    }
    const nus = lignes.filter((_, i) => !HORS_BANDE.has(sites[i]));
    expect(nus, 'bande recomposée en ligne : composer `fourchette` (src/engine/tables.ts), ou exclure AU SITE un intervalle qui n’est pas une bande').toEqual([]);
    const mortes = [...HORS_BANDE.keys()].filter((k) => !sites.includes(k));
    expect(mortes, 'exclusion sans site vivant : la retirer').toEqual([]);
  });

  it('preuve : gabarit et JSX, tiret, points de suspension et « à », borne nommée d’un seul côté, queue de bande, tiret long entre deux bornes ; ni tiret long de libellé, ni bornes anonymes, ni commentaire', () => {
    const vus = (src: string) => sitesBandeEnLigne({ rel: 'Faux.tsx', text: src }).map((s) => s.ligne);
    expect(vus('const s = `d100 ${e.min}–${e.max}`;')).toEqual([1]);
    expect(vus('const s = `${r.min}-${r.max}`;')).toEqual([1]);
    expect(vus('const s = `${a.from} – ${b}`;')).toEqual([1]);
    expect(vus('const x = <option>{r.min} — {r.label}</option>;')).toEqual([]);
    expect(vus('const s = `${b.min} — ${b.max}`;')).toEqual([1]);
    expect(vus('const x = <span>{b.min} — {b.max}</span>;')).toEqual([1]);
    expect(vus("const s = `1d10 ${e.min}${e.max > e.min ? `–${e.max}` : ''}`;")).toEqual([1]);
    expect(vus('const x = <span>{e.min}{e.max > e.min ? <>–{e.max}</> : null}</span>;')).toEqual([1]);
    expect(vus('const s = `${a}-${b.hi}`;')).toEqual([1]);
    expect(vus('const s = `${r.min === r.max ? r.min : `${r.min}–${r.max}`}`;')).toEqual([1]);
    expect(vus('const x = <span>{p.min}–{p.max}</span>;')).toEqual([1]);
    expect(vus('const s = `de ${t.min} à ${t.max}`;')).toEqual([1]);
    expect(vus('const s = `DR ${e.min}…${e.max}`;')).toEqual([1]);
    expect(vus("const s = `DR ${b.minSL ?? '−∞'} … ${b.maxSL ?? '+∞'}`;")).toEqual([1]);
    expect(vus('const s = `${m.dr}...${m.drMax}`;')).toEqual([1]);
    expect(vus('const s = `${a} à ${b}`;')).toEqual([]);
    expect(vus('const s = `${an}-${mois}`;')).toEqual([]);
    expect(vus('const s = `${e.min} · ${e.max}`;')).toEqual([]);
    expect(vus('// `${e.min}–${e.max}`')).toEqual([]);
  });

  it('preuve : un préfixe de dé recopié devant `fourchette` (d100, d10, 1d10, 1d100, gabarit et JSX) se refuse, `bandeAuDe` passe', () => {
    const vus = (src: string) => sitesBandeEnLigne({ rel: 'Faux.tsx', text: src }).map((s) => s.ligne);
    expect(vus('const s = `d100 ${fourchette(e.min, e.max, 100)}`;')).toEqual([1]);
    expect(vus('const s = `d10 ${fourchette(e.min, e.max, 10)}`;')).toEqual([1]);
    expect(vus('const s = `1d10 ${fourchette(e.min, e.max, 10)}`;')).toEqual([1]);
    expect(vus('const s = `1d100 ${fourchette(e.min, e.max, 100)}`;')).toEqual([1]);
    expect(vus('const s = `d100 : ${fourchette(p.from, p.rand, 100)}`;')).toEqual([1]);
    expect(vus('const x = <span>1d10 : {fourchette(m.min, m.max, 10)}</span>;')).toEqual([1]);
    expect(vus("const s = bandeAuDe('d100', e.min, e.max);")).toEqual([]);
    expect(vus('const s = `DR ${fourchette(e.min, e.max)}`;')).toEqual([]);
    expect(vus('const s = `2d10 ${fourchette(e.min, e.max)}`;')).toEqual([]);
  });
});
