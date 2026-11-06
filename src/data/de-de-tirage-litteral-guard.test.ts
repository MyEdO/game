/**
 * Le dé d'une bande de table s'écrit en LITTÉRAL (`bandeAuDe('d100', …)`, `facesDuDe('d10')`) seulement
 * pour une table dont le document ne porte AUCUN `die` : un document qui le porte se lit par sa porte
 * (`deDeTirageDe`, `src/data/rangees.ts`, ou l'export du lecteur qui le tire). #1667
 *
 * SITES LITTÉRAUX : clé `fichier :: porteurs :: ligne` (porteurs = fonctions, déclarations, propriétés
 * et attributs JSX qui enveloppent l'appel ; ligne aux blancs réduits), valeur = le document de la table
 * et la raison. Le test relit chaque document au disque : qu'il gagne un `die`, et son site rougit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type * as TS from 'typescript/unstable/ast';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { analyserCorpus, ast, typescript } from '../../scripts/guards/lib/dialecte.mjs';

const LECTEURS_DE_DE = new Set(['bandeAuDe', 'facesDuDe']);

const SANS_DE = 'aucun `die` en donnée (#1667, trains (a)–(e))';
const RAS = new Map<string, { document: string; why: string }>([
  ["src/noyau/codex/registry.ts :: critEntryItem.sub :: sub: bandeAuDe('d100', e.min, e.max),", { document: 'src/data/criticals.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.riverNavigation.build.sections.rows.k :: rows: n.windForces.map((f) => ({ t: 'kv', k: fourchette(f.min, f.max, facesDuDe('d10')), v: f.label } as CodexRow)),", { document: 'src/data/river-navigation.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.riverNavigation.build.sections.rows.k :: rows: n.windDirections.map((d) => ({ t: 'kv', k: fourchette(d.min, d.max, facesDuDe('d10')), v: d.label } as CodexRow)),", { document: 'src/data/river-navigation.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.oups.build.range :: const range = 'min' in o ? bandeAuDe('d100', o.min, o.max) : tr('codex.fiche.horsTableArmeAPoudreNoire');", { document: 'src/data/oups.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.interludeEvents.build.sub :: build: () => interludeEvents.map((e) => depuisEnveloppe(e, { sub: bandeAuDe('d100', e.min, e.max) })),", { document: 'src/data/interludeEvents.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.waterExposure.build.sections.rows.badge :: return { t: 'ref', category: 'maladies', id: d.disease, label, show: label, badge: `${fourchette(d.min, d.max, facesDuDe('d100'))}${d.rerollUnlessWounded ? tr('codex.fiche.relanceSiIndemne') : ''}` } as CodexRow;", { document: 'src/data/water-exposure.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.seaNavigation.build.sections.rows.k :: rows: n.orientation.changementDeCap.map((r) => ({ t: 'kv', k: fourchette(r.min, r.max, facesDuDe('d10')), v: r.desc } as CodexRow)),", { document: 'src/data/sea-navigation.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.landCargo.build.sections.rows.k :: rows: c.wineQuality.map((q) => ({ t: 'kv', k: fourchette(q.min, q.max, facesDuDe('d10')), v: tr('codex.fiche.qualitePrixCo', { label: q.label, price: q.price }) } as CodexRow)),", { document: 'src/data/land-cargo.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.landCargo.build.sections.rows.label :: { t: 'sub', label: fourchette(r.min, r.max, facesDuDe('d100')) } as CodexRow,", { document: 'src/data/land-cargo.json', why: SANS_DE }],
  ["src/noyau/codex/registry.ts :: CODEX_SPECS.steamBreakdowns.build.sub :: sub: bandeAuDe('d100', e.min, e.max),", { document: 'src/data/steam-breakdown.json', why: SANS_DE }],
  ["src/ui/creator/CharacterCreator.tsx :: StarScreen.choice.hub.note :: note: bandeAuDe('d100', selPos.from, selPos.rand),", { document: 'src/data/stars.json', why: SANS_DE }],
  ["src/ui/creator/CharacterCreator.tsx :: StarScreen.choice.meta :: meta={m.sub && <span className=\"hint\">{bandeAuDe('d10', m.sub.min, m.sub.max)}</span>}", { document: 'src/data/stars.json', why: SANS_DE }],
]);

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

/** Le JSON porte-t-il une clé `die`, à quelque profondeur que ce soit ? */
function porteUnDe(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(porteUnDe);
  if (v && typeof v === 'object') return Object.entries(v).some(([k, x]) => k === 'die' || porteUnDe(x));
  return false;
}

describe('#1667 — un dé de tirage en donnée se lit, il ne se recopie pas', () => {
  it('tout dé littéral de bande vise une table sans `die` en donnée ; toute entrée RAS vise un site vivant', () => {
    const corpus = readCorpus(['src']).filter((f) => f.text.includes('bandeAuDe(') || f.text.includes('facesDuDe('));
    const sites = [...analyserCorpus(corpus)].flatMap(({ fichier, sourceFile }) => (sourceFile ? sitesLitteraux(fichier.rel, sourceFile) : []));
    expect(sites.filter((s) => !RAS.has(s)), 'dé littéral : lire le `die` du document (`deDeTirageDe`), ou déclarer la table sans dé en RAS').toEqual([]);
    expect([...RAS.keys()].filter((k) => !sites.includes(k)), 'entrée RAS sans site vivant : la retirer').toEqual([]);
  });

  it('chaque table RAS est sans `die` en donnée — qu’elle en gagne un, et son littéral doit le lire', () => {
    const portent = [...new Set([...RAS.values()].map((r) => r.document))]
      .filter((d) => porteUnDe(JSON.parse(readFileSync(join(process.cwd(), d), 'utf8'))));
    expect(portent, 'document RAS qui porte un `die`').toEqual([]);
  });

  it('preuve : le dé littéral se refuse, le dé lu passe', () => {
    const vus = (src: string) => sitesLitteraux('Faux.ts', ast({ rel: 'Faux.ts', text: src })!);
    expect(vus("function f(e) { return bandeAuDe('d100', e.min, e.max); }")).toEqual(["Faux.ts :: f :: function f(e) { return bandeAuDe('d100', e.min, e.max); }"]);
    expect(vus('const k = fourchette(r.min, r.max, facesDuDe(`d10`));')).toHaveLength(1);
    expect(vus('const s = bandeAuDe(deDeTirageDe(json), e.min, e.max);')).toEqual([]);
    expect(vus('const k = fourchette(r.min, r.max, facesDuDe(t.die));')).toEqual([]);
  });
});
