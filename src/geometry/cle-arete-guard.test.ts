import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { CLE_A_LA_MAIN, EXEMPTIONS, SOCLE, sitesFautifs, type ExemptionCleArete } from '../../scripts/guards/lib/cleAreteMain.mjs';

/**
 * GARDE « clé d'arête construite à la main » (#1883 c7, `scripts/guards/lib/cleAreteMain.mjs`) :
 * l'identité d'une arête se calcule par `cleArete` (`src/geometry/arete.ts`). Corpus : les sources de
 * PRODUCTION de `src/` — un test écrit sa clé ATTENDUE en littéral, c'est ce qu'il vérifie.
 */
const CORPUS = readCorpus(['src'], { exts: ['.ts', '.tsx'] });
const D = '$';

describe('garde — aucune clé d’arête construite à la main hors du socle', () => {
  it('le motif mord chaque graphie de clé, et ni un libellé ni une paire de coordonnées', () => {
    for (const ligne of [
      `const k = \`${D}{w.x},${D}{w.y},${D}{w.side},${D}{w.z ?? 0}\`;`,
      `walls.add(\`${D}{seg.x},${D}{seg.y},${D}{seg.side}\`);`,
      `edges.has(ny < y ? \`${D}{x},${D}{y},N\` : \`${D}{nx},${D}{y},E\`);`,
      `key: \`seam:${D}{a}:${D}{b}:${D}{x},${D}{y}:${D}{side}\`,`,
      `const key = \`${D}{w.x}-${D}{w.y}-${D}{w.side}-${D}{w.z ?? 0}\`;`,
      `const cid = \`structure-${D}{w.x}-${D}{w.y}-${D}{w.side}-${D}{z}\`;`,
      `: \`edge:${D}{at.x}:${D}{at.y}:${D}{at.side}\``,
      `return \`__door_${D}{x}_${D}{y}_${D}{side}_${D}{z}\`;`,
      `el: <g key={\`bloc-${D}{x},${D}{y},${D}{z},${D}{side}\`} />,`,
      `const k = \`${D}{side}:${D}{x},${D}{y}\`;`,
      `const k = \`${D}{side},${D}{x},${D}{y},${D}{z}\`;`,
      `const k = \`${D}{x}|${D}{y}|${D}{side}\`;`,
      `const k = \`${D}{x}.${D}{y}.${D}{side}\`;`,
      `const k = \`${D}{x},${D}{y},S\`;`,
      `const k = \`${D}{x},${D}{y},O\`;`,
      `const k = \`${D}{x}, ${D}{y}, ${D}{side}\`;`,
      `const k = \`${D}{x}/${D}{y}/${D}{side}\`;`,
      `const k = \`${D}{x};${D}{y};${D}{side}\`;`,
      `const k = \`${D}{x} ${D}{y} ${D}{side}\`;`,
      `const k = \`${D}{x}${D}{y}${D}{side}\`;`,
      `const k = \`N,${D}{x},${D}{y}\`;`,
      `const k = \`E:${D}{x}:${D}{y}\`;`,
    ]) expect(sitesFautifs(ligne), ligne).toHaveLength(1);
    for (const ligne of [
      `const source = \`arête (${D}{seg.x},${D}{seg.y},${D}{seg.side}) z${D}{seg.z ?? 0}\`;`,
      `return \`Porte (${D}{e.x ?? 0},${D}{e.y ?? 0},${D}{e.side ?? 'N'}) ouverte\`;`,
      `const b = index.get(\`${D}{nx},${D}{ny}\`);`,
      `: \`cell:${D}{at.x}:${D}{at.y}\`;`,
      `const k = cleArete(w.x, w.y, w.side, w.z ?? 0);`,
      `const s = \`(N,${D}{x},${D}{y})\`;`,
      `const t = \`NIVEAU${D}{a}${D}{b}\`;`,
      `key: \`seam:${D}{a.massId}:${D}{b.bodyId}:${D}{cleArete(c.x, c.y, side, z)}\`,`,
    ]) expect(sitesFautifs(ligne), ligne).toEqual([]);
  });

  it('le socle porte bien la clé (sinon la frontière a bougé)', () => {
    for (const rel of SOCLE) {
      const f = CORPUS.find((c) => c.rel === rel);
      expect(f, rel).toBeDefined();
      expect(CLE_A_LA_MAIN.test(f!.text), rel).toBe(true);
    }
  });

  it('hors du socle, chaque site est exempté AU SITE — et chaque exemption touche un site', () => {
    expect(CORPUS.length, 'balayage suspect').toBeGreaterThan(1000);
    const vues = new Set<ExemptionCleArete>();
    const fautes: string[] = [];
    for (const { rel, text } of CORPUS) {
      if (SOCLE.includes(rel)) continue;
      for (const s of sitesFautifs(text.replace(/\r\n?/g, '\n'))) {
        const ex = EXEMPTIONS.find((e) => e.fichier === rel && e.motif.test(s.texte));
        if (ex) { vues.add(ex); continue; }
        fautes.push(`${rel}:${s.ligne} ${s.texte}`);
      }
    }
    expect(fautes, 'clé d’arête construite à la main — appeler `cleArete` (src/geometry/arete.ts)').toEqual([]);
    expect(EXEMPTIONS.filter((e) => !vues.has(e)).map((e) => `${e.fichier} ${e.motif}`), 'exemption périmée').toEqual([]);
  });
});
