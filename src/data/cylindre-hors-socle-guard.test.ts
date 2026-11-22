import { describe, expect, it } from 'vitest';
import { corpusDesGardes } from '../../scripts/guards/lib/commentPoison.mjs';
import { cleDeLigne, positionsDesAncres } from '../../scripts/guards/lib/stock.mjs';
import { BRANCHE_CYLINDRE, EXEMPTIONS, SOCLE, sitesFautifs, type ExemptionCylindre } from '../../scripts/guards/lib/cylindreHorsSocle.mjs';

/**
 * GARDE « géométrie recalculée à la main » (#1343, `scripts/guards/lib/cylindreHorsSocle.mjs`) :
 * la forme d'un cylindre ne se relit qu'au SOCLE (`src/data/props.types.ts`, schéma). Le corpus est
 * le périmètre des gardes, `corpusDesGardes()`, tests compris.
 */
const CORPUS = corpusDesGardes();
const FORME = 'cylinder';
const COTE = ['longueur', 'M'].join('');

function juger(fichier: string, source: string, exemptions: readonly ExemptionCylindre[] = EXEMPTIONS) {
  const texte = source.replace(/\r\n?/g, '\n');
  const entrees = exemptions.filter((e) => e.fichier === fichier);
  const ancres = positionsDesAncres(fichier, texte, entrees.map((e) => e.ancre));
  const fautes = [];
  const touchees = new Set<string>();
  for (const site of sitesFautifs(texte)) {
    const ancre = ancres.get(site.ligne);
    if (ancre === undefined) fautes.push(site);
    else touchees.add(ancre);
  }
  return { fautes, vues: entrees.filter((e) => touchees.has(e.ancre)) };
}

describe('garde — aucune branche sur la forme cylindre hors du socle', () => {
  it('le motif mord chaque graphie de branche et chaque lecture de la cote propre, et rien d’autre', () => {
    for (const ligne of [
      `if (p.kind === '${FORME}') return;`,
      `const d = p?.kind !== "${FORME}" ? 0 : 1;`,
      `case '${FORME}':`,
      `if ('${FORME}' === p.kind) return;`,
      `if (p['kind'] === '${FORME}') return;`,
      `if (['${FORME}'].includes(p.kind)) return;`,
      `const d = p.kind === 'box' || p.kind === 'prism' ? p.size.hM : p.${COTE};`,
      `const d = 'size' in p ? p.size.hM : p.${COTE};`,
      `const d = p['${COTE}'];`,
      `if ('${COTE}' in p) return;`,
    ]) expect(sitesFautifs(ligne), ligne).toHaveLength(1);
    // Sur DEUX lignes : le site est la ligne où la comparaison commence.
    expect(sitesFautifs(`if (p.kind ===\n  '${FORME}') return;`)).toEqual([{ ligne: 1, texte: 'if (p.kind ===' }]);
    for (const ligne of [
      `primitive.kind = '${FORME}';`,
      `{ kind: '${FORME}', center, ${COTE}: 1 }`,
      `light.radiusM`,
    ]) expect(sitesFautifs(ligne), ligne).toEqual([]);
  });

  it('le socle porte bien la branche (sinon la frontière a bougé)', () => {
    for (const rel of SOCLE) {
      const f = CORPUS.find((c) => c.rel === rel);
      expect(f, rel).toBeDefined();
      expect(BRANCHE_CYLINDRE.test(f!.text), rel).toBe(true);
    }
  });

  it('hors du socle, chaque site est exempté AU SITE — et chaque exemption touche un site', () => {
    const cles = EXEMPTIONS.map(({ fichier, ancre }) => cleDeLigne(fichier, ancre));
    expect(new Set(cles).size, 'exemptions cylindre déclarées en double').toBe(cles.length);
    expect(EXEMPTIONS.every(({ raison, date }) => raison.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true);
    expect(CORPUS.length, 'balayage suspect').toBeGreaterThan(1000);
    const vues = new Set<ExemptionCylindre>();
    const fautes: string[] = [];
    for (const { rel, text } of CORPUS) {
      if (SOCLE.includes(rel)) continue;
      const verdict = juger(rel, text);
      for (const ex of verdict.vues) vues.add(ex);
      for (const s of verdict.fautes) fautes.push(`${rel}:${s.ligne} ${s.texte}`);
    }
    expect(fautes, 'forme de cylindre relue hors du socle — lire `empriseLocaleM`/`polygonesDePrimitive` (src/data/props.types.ts)').toEqual([]);
    expect(EXEMPTIONS.filter((e) => !vues.has(e)).map((e) => `${e.fichier} ${e.ancre}`), 'exemption périmée').toEqual([]);
  });

  it('exemption cylindre au site unique, stable au déplacement et caduque à la réécriture', () => {
    const fichier = 'scripts/temoin-geometrie.mjs';
    const ancre = `if (p.kind === '${FORME}') return;`;
    const ex = { fichier, ancre, raison: 'sélection pour une migration', date: '2026-11-22' };
    const original = `const a = 1;\n${ancre}\n`;
    const examiner = (texte: string) => juger(fichier, texte, [ex]);
    const deplace = examiner('\n' + original);
    expect(deplace.fautes).toEqual([]);
    expect(deplace.vues).toContain(ex);

    const disparu = examiner(original.replace(ancre, ''));
    expect(disparu.fautes).toEqual([]);
    expect(disparu.vues).not.toContain(ex);

    const variante = ancre + ' // Témoin';
    const reecrit = examiner(original.replace(ancre, variante));
    expect(reecrit.fautes.map((s) => s.texte)).toEqual([variante]);
    expect(reecrit.vues).not.toContain(ex);

    const double = examiner(original.replace(ancre, ancre + '\n' + ancre));
    expect(double.fautes.map((s) => s.texte)).toEqual([ancre, ancre]);
    expect(double.vues).not.toContain(ex);

    const ajoute = examiner(original.replace(ancre, ancre + '\n' + variante));
    expect(ajoute.fautes.map((s) => s.texte)).toEqual([variante]);
    expect(ajoute.vues).toContain(ex);
  });
});
