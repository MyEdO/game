/**
 * PRIMITIVE DE CLIQUET (`scripts/guards/lib/stock.mjs`) — les quatre calculs partagés par les gardes
 * à stock. Ce fichier mesure la primitive elle-même sur des collections FORGÉES : les gardes qui la
 * composent mesurent, elles, le dépôt réel.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { champsAveugles, couvertureDuBalayage, ecartsDeStock, lignesMalQualifiees } from '../scripts/guards/lib/stock.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

describe('ecartsDeStock — l’écart dans les DEUX sens, la clé libre, le stock vide servi', () => {
  it('un stock VIDE n’est pas un no-op : tout l’observé sort en `neuves`', () => {
    const ecarts = ecartsDeStock({ observe: ['a', 'b'], stock: [], cle: (d) => d });
    expect(ecarts.neuves).toEqual(['a', 'b']);
    expect(ecarts.perimees).toEqual([]);
    expect(ecarts.taille).toBe(0);
  });

  it('une entrée MORTE du stock (plus observée) sort en `perimees`, décorée par le remède', () => {
    const ecarts = ecartsDeStock({
      observe: ['a'],
      stock: ['a', 'zombie'],
      cle: (d) => d,
      remede: { perimee: (c) => `retirer « ${c} »` },
    });
    expect(ecarts.neuves).toEqual([]);
    expect(ecarts.perimees).toEqual(['retirer « zombie »']);
    expect(ecarts.taille).toBe(2);
  });

  it('la CLÉ est libre : une clé COMPOSITE distingue deux entrées de même dataset, et le remède voit l’entrée observée', () => {
    const cle = (e: { dataset: string; champ: string }) => `${e.dataset} | ${e.champ}`;
    const ecarts = ecartsDeStock({
      observe: [
        { dataset: 'talents.json', champ: 'skill', ligne: 12 },
        { dataset: 'talents.json', champ: 'talent', ligne: 40 },
      ],
      stock: [{ dataset: 'talents.json', champ: 'skill' }],
      cle,
      remede: { neuve: (c, e) => `${c} (ligne ${e.ligne})` },
    });
    expect(ecarts.neuves).toEqual(['talents.json | talent (ligne 40)']);
    expect(ecarts.perimees).toEqual([]);
  });

  it('observé et stock peuvent avoir des FORMES différentes — la clé les réconcilie', () => {
    const ecarts = ecartsDeStock({
      observe: [{ cle: 'x|alias|skill', ligne: 9 }],
      stock: [{ cle: 'x|alias|skill' }, { cle: 'y|extend|porteSchema' }],
      cle: (e) => e.cle,
    });
    expect(ecarts.neuves).toEqual([]);
    expect(ecarts.perimees).toEqual(['y|extend|porteSchema']);
  });
});

describe('ecartsDeStock — le COMPTE hors de la clé, jugé dans un SEUL sens (#2705)', () => {
  type Entree = { site: string; occurrences: number };
  const stock: Entree[] = [{ site: 'a.json | x', occurrences: 3 }];
  const ecarts = (observe: Entree[]) =>
    ecartsDeStock({
      observe,
      stock,
      cle: (e) => e.site,
      nombre: (e) => e.occurrences,
      cible: (c) => `Migrer ${c} vers sa CIBLE.`,
      remede: { baisse: () => 'écrire la mesure.' },
    });

  it('une HAUSSE sort en `accrues`, phrase de la primitive et cible du site, ni neuve ni périmée', () => {
    const e = ecarts([{ site: 'a.json | x', occurrences: 5 }]);
    expect(e.accrues).toEqual(['a.json | x — HAUSSE 5 > 3 : la dette GRANDIT. Migrer a.json | x vers sa CIBLE. Aucune écriture ne relève ce nombre.']);
    expect([e.neuves, e.perimees, e.baisses]).toEqual([[], [], []]);
  });

  it('une BAISSE sort en `baisses`, décorée par `remede.baisse` ; l’égalité ne dit rien', () => {
    expect(ecarts([{ site: 'a.json | x', occurrences: 2 }]).baisses).toEqual(['a.json | x — BAISSE 2 < 3 : écrire la mesure.']);
    const egal = ecarts([{ site: 'a.json | x', occurrences: 3 }]);
    expect([egal.neuves, egal.perimees, egal.accrues, egal.baisses]).toEqual([[], [], [], []]);
  });

  it('un site NEUF reste en `neuves`, quel que soit son compte', () => {
    const e = ecarts([{ site: 'a.json | x', occurrences: 3 }, { site: 'b.json | y', occurrences: 1 }]);
    expect(e.neuves).toEqual(['b.json | y']);
    expect(e.accrues).toEqual([]);
  });

  it('une hausse n’a pas de remède décoré : `remede.accrue` n’existe pas au type, et la primitive l’ignore', () => {
    const e = ecartsDeStock({
      observe: [{ site: 'a.json | x', occurrences: 5 }],
      stock,
      cle: (x) => x.site,
      nombre: (x) => x.occurrences,
      cible: () => 'Migrer.',
      // @ts-expect-error -- une hausse ne se décore pas : sa phrase est fixe.
      remede: { accrue: () => 'déclarer la hausse' },
    });
    expect(e.accrues).toEqual(['a.json | x — HAUSSE 5 > 3 : la dette GRANDIT. Migrer. Aucune écriture ne relève ce nombre.']);
  });

  it('`cible` est EXIGÉE au type dès que `nombre` est fourni', () => {
    // @ts-expect-error -- sans cible, une hausse ne nommerait pas sa voie.
    const appel = () => ecartsDeStock({ observe: stock, stock, cle: (x) => x.site, nombre: (x) => x.occurrences });
    expect(appel().accrues).toEqual([]);
  });
});

describe('champsAveugles — un champ hors de la clé laisse la garde verte quoi qu’on y écrive', () => {
  const stock = [
    { dataset: 'talents.json', champ: 'skill', occurrences: 6, lot: 'L2 #1463' },
    { dataset: 'etats.json', champ: 'recover', occurrences: 1, lot: 'L2 #1463' },
  ];

  it('le champ ABSENT de la clé est nommé, ceux qui y entrent ne le sont pas', () => {
    const cle = (e: (typeof stock)[number]) => `${e.dataset} | ${e.champ}`;
    expect(champsAveugles(stock, cle, ['dataset', 'champ', 'occurrences', 'lot'])).toEqual(['occurrences', 'lot']);
  });

  it('le COMPTE hors de la clé entre dans l’empreinte par `nombre` : il n’est pas aveugle (#2705)', () => {
    const cle = (e: (typeof stock)[number]) => `${e.dataset} | ${e.champ} | ${e.lot}`;
    expect(champsAveugles(stock, cle, ['dataset', 'champ', 'occurrences', 'lot'])).toEqual(['occurrences']);
    expect(champsAveugles(stock, cle, ['dataset', 'champ', 'occurrences', 'lot'], (e) => e.occurrences)).toEqual([]);
  });

  it('une clé qui embarque TOUT ne laisse aucun champ aveugle', () => {
    const cle = (e: (typeof stock)[number]) => `${e.dataset} | ${e.champ} | ${e.occurrences} | ${e.lot}`;
    expect(champsAveugles(stock, cle, ['dataset', 'champ', 'occurrences', 'lot'])).toEqual([]);
  });

  it('un stock VIDE n’offre aucune entrée à muter — la clause ne mesure rien et le dit par une liste vide', () => {
    expect(champsAveugles([], (e: { a: string }) => e.a, ['a'])).toEqual([]);
  });
});

describe('couvertureDuBalayage — gisement muet, entrée de stock hors corpus, appariement EXACT', () => {
  const appel = (p: { stock?: string[]; balayes: string[]; gisements: string[] }) =>
    couvertureDuBalayage({ nom: 'STOCK_TÉMOIN', stock: p.stock ?? [], balayes: p.balayes, gisements: p.gisements });

  it('un gisement PEUPLÉ ne dit rien ; un gisement sans un seul fichier balayé sort NOMMÉ', () => {
    const c = appel({ balayes: ['src/engine/a.ts'], gisements: ['src/engine', 'src/state'] });
    expect(c.gisementsMuets.join('\n')).toContain('src/state');
    expect(c.gisementsMuets.join('\n')).not.toContain('src/engine');
    expect(c.gisementsMuets).toHaveLength(1);
  });

  it('une entrée de stock PRÉSENTE au balayage ne dit rien ; une entrée ABSENTE sort NOMMÉE, avec le nom du stock', () => {
    const c = appel({ stock: ['src/engine/a.ts', 'src/engine/disparu.ts'], balayes: ['src/engine/a.ts'], gisements: ['src/engine'] });
    expect(c.entreesDeStockAbsentes).toHaveLength(1);
    expect(c.entreesDeStockAbsentes[0]).toContain('src/engine/disparu.ts');
    expect(c.entreesDeStockAbsentes[0]).toContain('STOCK_TÉMOIN');
    expect(c.gisementsMuets).toEqual([]);
  });

  it('PIÈGE DU PRÉFIXE : un dossier VOISIN de même préfixe ne PEUPLE pas le gisement (le séparateur est exigé)', () => {
    // `src/uix/a.ts` commence par `src/ui` — un préfixe nu le compterait comme peuplant `src/ui`, et
    // la disparition du vrai dossier resterait muette. Le gisement lui-même (`src/ui`, sans fichier
    // sous `src/ui/`) n'est pas peuplé non plus par son propre nom.
    const c = appel({ balayes: ['src/uix/a.ts', 'src/ui'], gisements: ['src/ui'] });
    expect(c.gisementsMuets.join('\n')).toContain('src/ui');
  });

  it('l’appariement d’une entrée de stock est EXACT : un chemin voisin ne la couvre pas', () => {
    const c = appel({ stock: ['src/engine/a.ts'], balayes: ['src/engine/a.tsx', 'src/engine/aa.ts'], gisements: ['src/engine'] });
    expect(c.entreesDeStockAbsentes.join('\n')).toContain('src/engine/a.ts ');
  });

  it('un balayage COMPLET ne rend rien — les deux listes vides', () => {
    const c = appel({ stock: ['src/state/b.ts'], balayes: ['src/engine/a.ts', 'src/state/b.ts'], gisements: ['src/engine', 'src/state'] });
    expect(c.gisementsMuets).toEqual([]);
    expect(c.entreesDeStockAbsentes).toEqual([]);
  });
});

describe('lignesMalQualifiees — lot + date, et lot hors ensemble FERMÉ', () => {
  const LOTS = ['L1a #1466', 'L2 #1463'];

  it('lot manquant, date absente ou non ISO : la ligne est nommée', () => {
    const rendu = lignesMalQualifiees(
      [
        ['sans-lot', { lot: '  ', date: '2026-08-25' }],
        ['sans-date', { lot: 'L2 #1463' }],
        ['date-libre', { lot: 'L2 #1463', date: 'août 2026' }],
        ['saine', { lot: 'L2 #1463', date: '2026-08-25' }],
      ],
      { lotsConnus: LOTS },
    );
    expect(rendu.map((l) => l.split(' →')[0])).toEqual(['sans-lot', 'sans-date', 'date-libre']);
  });

  it('un lot HORS de l’ensemble fermé est relevé, et l’ensemble est nommé dans le rendu', () => {
    const rendu = lignesMalQualifiees([['inventee', { lot: 'L9 #9999', date: '2026-08-25' }]], { lotsConnus: LOTS });
    expect(rendu).toHaveLength(1);
    expect(rendu[0]).toContain('hors des lots connus (L1a #1466, L2 #1463)');
  });

  it('sans `lotsConnus`, seule la QUALIFICATION est exigée — aucun ensemble n’est imposé', () => {
    expect(lignesMalQualifiees([['libre', { lot: 'lot maison', date: '2026-08-25' }]])).toEqual([]);
  });
});

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475) — même schéma que `src/data/slots-contrat.test.ts:24`.
 */
const GARDE = {
  question:
    'A — quelles DÉPENDANCES le module charge-t-il (déclaration `import`, `import()` dynamique, `require()`) ? ' +
    'B — rend-il un VERDICT (`expect`, `throw`, `process.exit`) au lieu de listes et d’un compte ? ' +
    'C — retient-il un ÉTAT entre deux appels (mémoïsation au niveau module) ?',
  primitive:
    '`scripts/guards/lib/stock.mjs` elle-même (`ecartsDeStock` / `champsAveugles` / `lignesMalQualifiees`), ' +
    'lue en TEXTE par un scan de ce fichier — commentaires et contenus de chaînes neutralisés.',
  mandat:
    'Une lib de CALCUL PUR : elle rend des listes et un compte ; le rouge, le message et le plafond appartiennent ' +
    'à la garde appelante (interdits gravés en tête de `stock.mjs`).',
  perimetre: 'Le SEUL fichier `scripts/guards/lib/stock.mjs` — les gardes qui le composent se mesurent chez elles.',
  /** Ce que le scan STRUCTUREL ferme, là où le grep précédent laissait passer (#1475, sondes du juge). */
  couvert: [
    'un `import()` DYNAMIQUE, préfixé `node:` ou non',
    '`require()` et son fournisseur `createRequire`',
    'un `throw` (le troisième interdit gravé, jusque-là écrit et non mesuré)',
    'une mémoïsation déclarée en `let`/`var` autant qu’en `const`',
    'un cache bâti par `Object.create` / objet ou tableau littéral, pas seulement `new Map()`/`new Set()`',
  ],
  angleMort: [
    'Le scan lit le TEXTE, pas un AST : un chargement reconstruit à l’exécution (`globalThis[nom]`, `process.binding`) n’est pas une forme d’import et n’est pas vu.',
    'Un état retenu AILLEURS qu’en déclaration de module — propriété posée sur une fonction exportée (`ecartsDeStock.cache = …`) ou sur `globalThis` — échappe à la détection de mémoïsation.',
    'La pureté des CALLBACKS reçus (`cle`, `remede`) n’est pas mesurable ici : si la clé de l’appelant lit le disque, c’est l’APPELANT qui le fait.',
    'Aucune TRANSITIVITÉ n’est suivie : sans objet tant que la liste blanche d’imports est vide, mais le jour où un import serait autorisé, ce qu’il traîne ne serait pas mesuré.',
  ],
  baseline: {
    fichier: null,
    decroissant: true,
    raison:
      'Aucun stock à tenir : liste blanche d’imports VIDE et tolérance ZÉRO sur le verdict — il n’y a rien à solder, ' +
      'seulement à ne jamais ouvrir.',
  },
  ticket: '#1475',
} as const;

/** Liste blanche des dépendances tolérées : VIDE — une lib de calcul pur n’importe rien. */
const IMPORTS_AUTORISES: readonly string[] = [];

const SOURCE = readFileSync(`${ROOT}scripts/guards/lib/stock.mjs`, 'utf8');

/**
 * Neutralise commentaires et CONTENUS de chaînes en préservant longueur et sauts de ligne : les index
 * du rendu restent ceux de la source, et le mot `throw` d'un message d'aide ne compte pas pour du code.
 */
function codeNu(src: string): string {
  const out = [...src];
  const blanchir = (a: number, b: number) => {
    for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      const fin = src.indexOf('\n', i);
      const e = fin === -1 ? src.length : fin;
      blanchir(i, e);
      i = e;
      continue;
    }
    if (c === '/' && d === '*') {
      const fin = src.indexOf('*/', i + 2);
      const e = fin === -1 ? src.length : fin + 2;
      blanchir(i, e);
      i = e;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let k = i + 1;
      while (k < src.length && src[k] !== c && src[k] !== '\n') k += src[k] === '\\' ? 2 : 1;
      blanchir(i + 1, Math.min(k, src.length));
      i = k + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/** Les TROIS formes par lesquelles un module ES peut charger du code, plus le fournisseur de `require`. */
const FORMES_DE_CHARGEMENT: readonly (readonly [RegExp, string])[] = [
  [/^[ \t]*import[\s{*'"(]/gm, 'déclaration `import`'],
  [/^[ \t]*export\b[^\n]*\bfrom\b/gm, 're-export `export … from`'],
  [/\bimport\s*\(/g, '`import()` dynamique'],
  [/\brequire\s*\(/g, '`require()`'],
  [/\bcreateRequire\b/g, '`createRequire`'],
];

/** Un VERDICT : le rouge, l'interruption, la sortie de processus — tous chez l'appelant, jamais ici. */
const FORMES_DE_VERDICT: readonly (readonly [RegExp, string])[] = [
  [/\bexpect\s*\(/g, '`expect(`'],
  [/\bthrow\b/g, '`throw`'],
  [/\bprocess\.exit\b/g, '`process.exit`'],
];

/** Une MÉMOÏSATION de module : déclaration NON indentée dont l'initialiseur est un CONTENANT — la
 *  mutabilité du binding n'y change rien (`const` d'une `Map` est un cache autant qu'un `let`). */
const FORMES_DE_CACHE: readonly (readonly [RegExp, string])[] = [
  [
    /^(?:const|let|var)\s+\w+\s*=\s*(?:new\s+(?:Map|Set|WeakMap|WeakSet)\b|Object\.create\b|\{\s*\}|\[\s*\])/gm,
    'contenant déclaré au niveau module',
  ],
];

/** Sites d'un jeu de formes dans un code déjà nu, rendus `forme — ligne: source`. */
function sites(src: string, formes: readonly (readonly [RegExp, string])[]): string[] {
  const code = codeNu(src);
  const lignes = src.split('\n');
  const out: string[] = [];
  for (const [motif, nom] of formes)
    for (const m of code.matchAll(motif)) {
      const ligne = code.slice(0, m.index).split('\n').length;
      out.push(`${nom} — ${ligne}: ${lignes[ligne - 1].trim()}`);
    }
  return out.sort();
}

describe('la primitive tient sa FRONTIÈRE : elle calcule, elle ne juge pas', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, couvert, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('stock.mjs');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER le fichier mesuré.').toContain('scripts/guards/lib/stock.mjs');
    expect(GARDE.mandat).toContain('CALCUL PUR');
    expect(GARDE.couvert.length, 'ce que le scan structurel ferme doit être nommé, sinon la garde se relit comme un grep.').toBeGreaterThanOrEqual(5);
    expect(GARDE.angleMort.length, 'une garde sans angle mort déclaré est une garde qui se croit exhaustive.').toBeGreaterThanOrEqual(4);
    expect(GARDE.baseline).toMatchObject({ fichier: null, decroissant: true });
    expect(GARDE.ticket).toBe('#1475');
  });

  it('AUCUNE dépendance : la liste blanche est VIDE, les trois formes de chargement comprises', () => {
    expect(IMPORTS_AUTORISES, 'une lib de calcul pur n’a aucune dépendance tolérée.').toEqual([]);
    const charges = sites(SOURCE, FORMES_DE_CHARGEMENT);
    expect(charges, charges.join('\n')).toEqual([]);
  });

  it('aucun VERDICT : ni `expect`, ni `throw`, ni `process.exit` — le rouge appartient à la garde appelante', () => {
    const verdicts = sites(SOURCE, FORMES_DE_VERDICT);
    expect(verdicts, verdicts.join('\n')).toEqual([]);
  });

  it('aucune MÉMOÏSATION au niveau module : un cache posé ici survivrait au worker', () => {
    const caches = sites(SOURCE, FORMES_DE_CACHE);
    expect(caches, caches.join('\n')).toEqual([]);
  });

  it('les DÉTECTEURS mordent : chaque contournement d’un grep de frontière est vu sur source FORGÉE', () => {
    const TOUTES = [...FORMES_DE_CHARGEMENT, ...FORMES_DE_VERDICT, ...FORMES_DE_CACHE];
    const sondes: Record<string, string> = {
      'import dynamique SANS préfixe `node:`': "export async function f() {\n  const fs = await import('fs');\n  return fs;\n}",
      createRequire: "import { createRequire } from 'node:module';\nexport const req = createRequire(import.meta.url);",
      throw: 'export function f(x) {\n  if (!x) throw new Error("stock vide");\n}',
      'cache en `let`': 'let cache = new Map();\nexport function f(k) { return cache.get(k); }',
      'cache par `Object.create`': 'const cache = Object.create(null);\nexport function f(k) { return cache[k]; }',
    };
    const aveugles = Object.entries(sondes).filter(([, src]) => sites(src, TOUTES).length === 0).map(([nom]) => nom);
    expect(aveugles, 'contournement(s) non vus : le scan est retombé au grep.').toEqual([]);
  });

  it('le scan ne compte NI les commentaires NI les chaînes : le mot `throw` d’un message d’aide n’est pas du code', () => {
    const leurre = '// throw : interdit gravé\nexport const M = "on ne throw pas ici";\n/* require("fs") */';
    expect(sites(leurre, [...FORMES_DE_CHARGEMENT, ...FORMES_DE_VERDICT])).toEqual([]);
  });

  it('le PLAFOND n’est servi par aucune fonction — seule la TAILLE l’est', () => {
    const code = codeNu(SOURCE)
      .split('\n')
      .filter((l) => l.trim())
      .join('\n');
    expect(code).not.toMatch(/MAX|plafond/i);
    expect(code).toMatch(/taille: tenues\.size/);
  });
});
