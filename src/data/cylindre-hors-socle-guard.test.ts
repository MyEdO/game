import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { POISON_DIRS, POISON_EXTS } from '../../scripts/guards/lib/commentPoison.mjs';
import { BRANCHE_CYLINDRE, EXEMPTIONS, SOCLE, sitesFautifs, type ExemptionCylindre } from '../../scripts/guards/lib/cylindreHorsSocle.mjs';

/**
 * GARDE « géométrie recalculée à la main » (#1343 lot C, `scripts/guards/lib/cylindreHorsSocle.mjs`) :
 * la forme d'un cylindre ne se relit qu'au SOCLE (`src/data/props.types.ts`, schéma). Le corpus est
 * celui de la garde de poison de commentaire (`src/` + `scripts/`, tests compris) — les deux jumeaux
 * divergents que ce lot supprime vivaient dans des TESTS.
 */
const CORPUS = readCorpus([...POISON_DIRS], { exts: [...POISON_EXTS], tests: true });
const FORME = 'cylinder';
const COTE = ['longueur', 'M'].join('');

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
    expect(CORPUS.length, 'balayage suspect').toBeGreaterThan(1000);
    const vues = new Set<ExemptionCylindre>();
    const fautes: string[] = [];
    for (const { rel, text } of CORPUS) {
      if (SOCLE.includes(rel)) continue;
      for (const s of sitesFautifs(text.replace(/\r\n?/g, '\n'))) {
        const ex = EXEMPTIONS.find((e) => e.fichier === rel && e.motif.test(s.texte));
        if (ex) { vues.add(ex); continue; }
        fautes.push(`${rel}:${s.ligne} ${s.texte}`);
      }
    }
    expect(fautes, 'forme de cylindre relue hors du socle — lire `empriseLocaleM`/`polygonesDePrimitive` (src/data/props.types.ts)').toEqual([]);
    expect(EXEMPTIONS.filter((e) => !vues.has(e)).map((e) => `${e.fichier} ${e.motif}`), 'exemption périmée').toEqual([]);
  });
});
