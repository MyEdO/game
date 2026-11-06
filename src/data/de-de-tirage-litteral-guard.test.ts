/**
 * Le dé d'une bande de table ne s'écrit jamais en LITTÉRAL (`bandeAuDe('d100', …)`, `facesDuDe('d10')`) :
 * il se lit par la porte de son document (`deDeTirageDe`, `src/data/rangees.ts`, ou l'export du lecteur
 * qui le tire). #1667
 *
 * SITE LITTÉRAL : `fichier :: porteurs :: ligne` (porteurs = fonctions, déclarations, propriétés et
 * attributs JSX qui enveloppent l'appel ; ligne aux blancs réduits).
 */
import { describe, it, expect } from 'vitest';
import type * as TS from 'typescript/unstable/ast';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus, ast, typescript } from '../../scripts/guards/lib/dialecte.mjs';

const LECTEURS_DE_DE = new Set(['bandeAuDe', 'facesDuDe']);

/** Nom d'un nœud qui PORTE un site, ou `null`. */
function nomDePorteur(ts: typeof TS, n: TS.Node): string | null {
  if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n) || ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n) || ts.isJsxAttribute(n)) && n.name && ts.isIdentifier(n.name)) return n.name.text;
  return null;
}

/** Sites `fichier :: porteurs :: ligne` d'un appel à `bandeAuDe`/`facesDuDe` dont le dé est un littéral. */
function sitesLitteraux(rel: string, sf: TS.SourceFile): string[] {
  const ts = typescript();
  const lignes = sf.text.split('\n');
  const sites: string[] = [];
  const visite = (n: TS.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && LECTEURS_DE_DE.has(n.expression.text)) {
      const de = n.arguments[0];
      if (de && (ts.isStringLiteral(de) || ts.isNoSubstitutionTemplateLiteral(de))) {
        const porteurs: string[] = [];
        for (let p: TS.Node | undefined = n.parent; p; p = p.parent) {
          const nom = nomDePorteur(ts, p);
          if (nom) porteurs.unshift(nom);
        }
        const ligne = lignes[sf.getLineAndCharacterOfPosition(n.getStart(sf)).line].replace(/\s+/g, ' ').trim();
        sites.push(`${rel} :: ${porteurs.join('.')} :: ${ligne}`);
      }
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return sites;
}

describe('#1667 — un dé de tirage en donnée se lit, il ne se recopie pas', () => {
  it('aucun dé littéral de bande', () => {
    const corpus = readCorpus(['src']).filter((f) => f.text.includes('bandeAuDe(') || f.text.includes('facesDuDe('));
    const sites = [...analyserCorpus(corpus)].flatMap(({ fichier, sourceFile }) => (sourceFile ? sitesLitteraux(fichier.rel, sourceFile) : []));
    expect(sites, 'dé littéral : lire le `die` du document (`deDeTirageDe`)').toEqual([]);
  });

  it('preuve : le dé littéral se refuse, le dé lu passe', () => {
    const vus = (src: string) => sitesLitteraux('Faux.ts', ast({ rel: 'Faux.ts', text: src })!);
    expect(vus("function f(e) { return bandeAuDe('d100', e.min, e.max); }")).toEqual(["Faux.ts :: f :: function f(e) { return bandeAuDe('d100', e.min, e.max); }"]);
    expect(vus('const k = fourchette(r.min, r.max, facesDuDe(`d10`));')).toHaveLength(1);
    expect(vus('const s = bandeAuDe(deDeTirageDe(json), e.min, e.max);')).toEqual([]);
    expect(vus('const k = fourchette(r.min, r.max, facesDuDe(t.die));')).toEqual([]);
  });
});
