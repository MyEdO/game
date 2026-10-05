/**
 * Tests du plugin Vite `wfrp:prose-source` (`scripts/source/prose-source-plugin.mjs`) — la prose
 * ADRESSÉE est matérialisée dans le module JSON servi à l'application.
 *
 * Le corpus est une FIXTURE hors dépôt (`os.tmpdir()`) : le plugin reçoit un accès au corpus par
 * injection, ce qui laisse ces tests indépendants de l'état du `Source/` réel — l'invariant testé est
 * le CÂBLAGE du plugin (filtre d'id, injection, fail-closed, rechargement), pas le corpus. Les chemins
 * de chapitre y prennent la FORME DE PRODUCTION : relatifs à la racine, séparateurs Windows.
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, resolve } from 'node:path';
import { createServer } from 'vite';
import { parseChapitre, fragmentBlocs, type ChapitreParse, type FragmentBlocs } from './decoupe.ts';
// @ts-expect-error - plugin ESM JS (pas de types) — même convention que `vite.config.ts`
import { proseSource, titreDeChapitre } from '../../../scripts/source/prose-source-plugin.mjs';
// @ts-expect-error - résolveur ESM JS (pas de types) — même convention que `vite.config.ts`
import { cheminChapitre, materialiser, resoudreProse } from '../../../scripts/source/resoudre.mjs';
// @ts-expect-error - lecteur ESM JS (pas de types) — même convention que `vite.config.ts`
import { chapitresDe } from '../../../scripts/source/lecteur-fs.mjs';
// @ts-expect-error - bibliothèque RAW ESM JS (pas de types) — même convention que `vite.config.ts`
import { readText } from '../../../scripts/raw/_lib.mjs';
// Inventaire des adresses du dépôt : la DÉFINITION unique du walk (`adresses.mjs`, qui liste par la
// primitive d'ORDRE TOTAL `listerArbre`) — jamais un second balayage ici.
import { RACINE_DEPOT, fichiersAdresses, type Adresse } from '../../../scripts/source/adresses.mjs';

const CHAPITRE = `# Peur

<span data-folio="190"></span>

La Peur est une réaction à quelque chose de perturbant ou d'effrayant, un texte assez long pour être adressable sans ambiguïté.

# Terreur

La Terreur est une réaction à quelque chose d'horrible, un second passage tout aussi long et parfaitement distinct du premier.
`;

const LIVRE = 'livre-de-base';
const CH = '21';

const racines: string[] = [];
/**
 * Deux dossiers DISJOINTS : la racine servie par Vite, et le corpus. C'est la disposition réelle
 * (`Source/` n'est pas dans le graphe de modules) — et sans elle, le corpus serait surveillé par la
 * seule surveillance de racine, ce qui rendrait la mise sous surveillance du plugin indémontrable.
 */
function fixture(): { racine: string; chapitre: string } {
  const racine = mkdtempSync(join(tmpdir(), 'prose-racine-'));
  const corpus = mkdtempSync(join(tmpdir(), 'prose-corpus-'));
  racines.push(racine, corpus);
  mkdirSync(join(corpus, LIVRE), { recursive: true });
  mkdirSync(join(racine, 'src', 'data'), { recursive: true });
  const absolu = join(corpus, LIVRE, '21 - Psychologie.md');
  writeFileSync(absolu, CHAPITRE, 'utf8');
  // FORME DE PRODUCTION du chemin de chapitre : relatif à la racine (`chapterFile` compose depuis le
  // `dir` de `books.json`) et à séparateurs Windows — c'est cette forme que chokidar rend, et c'est
  // sur elle que l'index de dépendance du plugin doit s'apparier.
  return { racine, chapitre: relative(process.cwd(), absolu) };
}
afterAll(() => { for (const r of racines) rmSync(r, { recursive: true, force: true }); });

/** Accès au corpus de la fixture, à l'interface que le plugin consomme — mémoire par `livre|chapitre`,
 *  comme le lecteur partagé (`lecteur-fs.mjs`) que la production lui passe. */
function corpusDe(chapitre: string) {
  const cache = new Map<string, ChapitreParse>();
  const vise = (book: string, ch: string) => book === LIVRE && ch === CH;
  return {
    chemin: (book: string, ch: string) => (vise(book, ch) ? chapitre : null),
    dossiers: () => [dirname(chapitre)],
    lire: (book: string, ch: string) => {
      if (!vise(book, ch)) return null;
      const clef = `${book}|${ch}`;
      if (!cache.has(clef)) cache.set(clef, parseChapitre(readFileSync(chapitre, 'utf8')));
      return cache.get(clef)!;
    },
    oublier: (book: string, ch: string) => cache.delete(`${book}|${ch}`),
    livres: () => [LIVRE],
    abbr: () => 'LDB',
    chapitres: () => [CH],
  };
}

/** Adresse du premier bloc d'une section du chapitre de fixture, empreinte POSÉE. */
function adresseDuTitre(chapitre: string, titre: string): { book: string; ch: string; parts: FragmentBlocs[] } {
  const parse = parseChapitre(readFileSync(chapitre, 'utf8'));
  const section = parse.sections.find((s) => s.title === titre);
  if (!section) throw new Error(`fixture sans section « ${titre} »`);
  return { book: LIVRE, ch: CH, parts: [fragmentBlocs(parse, { sec: section.slug, secOcc: section.occ, b0: 0, b1: 0 })] };
}

/** Le `this` que Rollup donne à un hook : `error` LÈVE (c'est ce qui rend le module rouge). */
function contexte() {
  const erreurs: string[] = [];
  return {
    erreurs,
    hook: {
      error(message: unknown) {
        erreurs.push(String(message));
        throw new Error(String(message));
      },
    },
  };
}

const ID = '/depot/src/data/psychology.json';

describe('plugin `wfrp:prose-source` — transform', () => {
  it('injecte le `desc` que l’adresse résout, et laisse `descRef` en place', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'terreur', descRef: adresseDuTitre(chapitre, 'Terreur') }]);
    const out = plugin.transform.call(contexte().hook, code, ID);
    const entree = JSON.parse(out.code)[0];
    expect(entree.desc).toContain('La Terreur est une réaction à quelque chose d\'horrible');
    expect(entree.descRef.parts).toHaveLength(1);
  });

  it('laisse INTACT un module sans adresse (aucune matérialisation = module byte-identique)', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'peur', desc: 'prose écrite dans l’entrée' }]);
    expect(plugin.transform.call(contexte().hook, code, ID)).toBeNull();
  });

  it('ne touche pas un id à QUERY : `?raw` sert la FORME DISQUE', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'terreur', descRef: adresseDuTitre(chapitre, 'Terreur') }]);
    expect(plugin.transform.call(contexte().hook, code, `${ID}?raw`)).toBeNull();
  });

  it('FAIL-CLOSED : une empreinte divergente fait échouer le module, nommément', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const adresse = adresseDuTitre(chapitre, 'Terreur');
    adresse.parts[0].sum = '0000000000000000';
    const ctx = contexte();
    expect(() => plugin.transform.call(ctx.hook, JSON.stringify([{ id: 'terreur', descRef: adresse }]), ID)).toThrow();
    expect(ctx.erreurs.join('\n')).toContain('empreinte-divergente');
    expect(ctx.erreurs.join('\n')).toContain('prose-source');
  });

  it('est BYTE-STABLE : deux passes rendent le même module', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = JSON.stringify([{ id: 'terreur', descRef: adresseDuTitre(chapitre, 'Terreur') }]);
    const a = plugin.transform.call(contexte().hook, code, ID);
    const b = plugin.transform.call(contexte().hook, code, ID);
    expect(a.code).toBe(b.code);
  });
});

describe('plugin `wfrp:prose-source` — projets de campagne LIVRÉS (#680)', () => {
  /** Un projet dont un preset ADRESSE sa prose — `desc` en plus si donné (la paire interdite). */
  const projetAdresse = (chapitre: string, desc?: string): string =>
    JSON.stringify({
      narratif: { presetsPnj: [{ id: 'p', profil: { ...(desc === undefined ? {} : { desc }), descRef: adresseDuTitre(chapitre, 'Terreur') } }] },
    });

  it('un `<x>-projet.json` de `src/scenes`, à toute profondeur, est matérialisé', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const out = plugin.transform.call(contexte().hook, projetAdresse(chapitre), '/depot/src/scenes/a/b/x-projet.json');
    expect(JSON.parse(out.code).narratif.presetsPnj[0].profil.desc).toContain('La Terreur est une réaction');
  });

  it('`desc` ET `descRef` sur un nœud de projet : le module échoue en NOMMANT le chemin JSON du nœud', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const ctx = contexte();
    expect(() => plugin.transform.call(ctx.hook, projetAdresse(chapitre, 'copie'), '/depot/src/scenes/x/x-projet.json')).toThrow();
    expect(ctx.erreurs.join('\n')).toContain('desc-et-descRef : narratif.presetsPnj[0].profil');
  });

  it('hors des documents de prose (`?raw`, JSON de scène qui n’est pas un projet, sous-dossier de `src/data`) : rien n’est transformé', () => {
    const { chapitre } = fixture();
    const plugin = proseSource({ corpus: corpusDe(chapitre) });
    const code = projetAdresse(chapitre);
    for (const id of ['/depot/src/scenes/x/x-projet.json?raw', '/depot/src/scenes/x/foo.json', '/depot/src/data/sous/x.json']) {
      expect(plugin.transform.call(contexte().hook, code, id), id).toBeNull();
    }
  });

  it('serveur Vite RÉEL sur le dépôt : le preset de Gustav sort de la Diligence avec la prose de son adresse, à l’octet du `Source/`', async () => {
    const rel = 'src/scenes/diligence/diligence-projet.json';
    const disque = JSON.parse(readFileSync(join(RACINE_DEPOT, rel), 'utf8'));
    type Preset = { id: string; profil: { desc?: string; descRef?: { book: string; ch: string } } };
    const gustavDe = (doc: { narratif: { presetsPnj: Preset[] } }): Preset | undefined =>
      doc.narratif.presetsPnj.find((p) => p.id === 'edo-gustav-fondleburger');
    const surDisque = gustavDe(disque)!;
    expect(surDisque.profil.desc, 'le DISQUE ne porte que l’adresse').toBeUndefined();
    const ref = surDisque.profil.descRef!;
    const attendu = (resoudreProse({ descRef: ref }) as { md: string }).md;
    expect(readFileSync(join(RACINE_DEPOT, cheminChapitre(ref.book, ref.ch)), 'utf8'), 'le texte est celui du livre').toContain(attendu);

    const server = await createServer({
      configFile: false,
      root: RACINE_DEPOT,
      logLevel: 'silent',
      server: { middlewareMode: true, watch: null },
      optimizeDeps: { noDiscovery: true },
      plugins: [proseSource()],
    });
    try {
      const module = await server.ssrLoadModule(`/${rel}`);
      expect(gustavDe(module.default)?.profil.desc).toBe(attendu);
    } finally {
      await server.close();
    }
  });
});

describe('plugin `wfrp:prose-source` — chapitres SERVIS EN DEV', () => {
  it('sert un chapitre par adresse à nom STABLE, plus le manifeste à chapitres ORDONNÉS', () => {
    const { chapitre } = fixture();
    const emis = servisDe(corpusDe(chapitre));
    const noms = emis.map((f) => f.fileName);
    expect(noms).toContain(`source/${LIVRE}/${CH}.md`);
    expect(noms).toContain('source/manifest.json');
    expect(emis.find((f) => f.fileName === `source/${LIVRE}/${CH}.md`)!.source).toBe(CHAPITRE);
    const manifeste = JSON.parse(emis.find((f) => f.fileName === 'source/manifest.json')!.source);
    expect(manifeste[LIVRE].abbr).toBe('LDB');
    // TABLEAU, jamais un objet à clés de chiffres : `JSON.parse` réordonne celles-ci et l'ordre des
    // chapitres du livre serait perdu au chargement.
    expect(Array.isArray(manifeste[LIVRE].chapitres)).toBe(true);
    expect(manifeste[LIVRE].chapitres[0].ch).toBe(CH);
    expect(manifeste[LIVRE].chapitres[0].fichier).toBe('21 - Psychologie.md');
    // Le TITRE nomme le chapitre à l'écran : le nom de fichier de l'extraction porte des ancres Word
    // (`05 - _gjdgxs.md`) qu'aucun auteur ne reconnaît.
    expect(manifeste[LIVRE].chapitres[0].titre).toBe('Peur');
    expect(manifeste[LIVRE].chapitres[0].octets).toBeGreaterThan(0);
  });

  it('le TITRE d’un chapitre : ancre écartée sur la LIGNE BRUTE, HTML retiré, longueur bornée', () => {
    // L'ancre se reconnaît sur le heading SOURCE (`# _GoBack`), pas sur le titre nettoyé : `cleanTitle`
    // a déjà mangé le `_`, et deviner à partir de la forme du mot écartait de VRAIS titres.
    const titre = (md: string) => titreDeChapitre(parseChapitre(md), md);
    expect(titre('# _GoBack\n\n# Peur\n\ntexte\n')).toBe('Peur');
    expect(titre('# _gjdgxs\n\n# Terreur\n')).toBe('Terreur');
    expect(titre('# <sup>A</sup>b\n')).toBe('Ab');
    expect(titre('# _GoBack\n')).toBe('');
    // AUCUN vrai titre n'est écarté : un mot minuscule, un horodatage, un nombre restent des titres.
    expect(titre('# nains\n')).toBe('nains');
    expect(titre('# 22h00\n')).toBe('22h00');
    expect(titreDeChapitre(null)).toBe('');
    const md = `# ${'Titre interminable '.repeat(8)}\n`;
    const long = titreDeChapitre(parseChapitre(md), md);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('…')).toBe(true);
    const tient = 'Les Répurgateurs et la Chasse aux Sorcières dans le Reikland';
    expect(tient.length).toBe(60);
    expect(titre(`# ${tient}\n`), 'un titre de 60 caractères se rend entier').toBe(tient);
  });
});

/** Le middleware que `configureServer` pose, isolé : un serveur factice suffit — l'invariant est ce
 *  que la ROUTE rend, pas Connect. Corpus omis = celui du DÉPÔT. */
function middlewareDe(corpus?: unknown) {
  const poses: ((req: { url: string }, res: unknown, next: () => void) => void)[] = [];
  proseSource(corpus ? { corpus } : {}).configureServer({
    middlewares: { use: (fn: (typeof poses)[number]) => poses.push(fn) },
    watcher: { add: () => {}, on: () => {} },
    moduleGraph: { getModuleById: () => null, invalidateModule: () => {} },
    ws: { send: () => {} },
  });
  return (url: string) => {
    let corps = '';
    let type = '';
    let code = 200;
    let suivant = false;
    const res = {
      set statusCode(v: number) { code = v; },
      get statusCode() { return code; },
      setHeader: (k: string, v: string) => { if (k === 'Content-Type') type = v; },
      end: (t: string) => { corps = t ?? ''; },
    };
    for (const fn of poses) fn({ url }, res, () => { suivant = true; });
    return { corps, type, code, suivant };
  };
}

/**
 * Ce que le DEV SERT, dans la forme d'une liste de fichiers — l'UNIQUE voie par laquelle un chapitre
 * du `Source/` sort du dépôt. Le build de production n'émet rien (garde ci-dessous) : mesurer les
 * chapitres « émis » reviendrait à mesurer une liste vide, et la garde de FORME (ordre, octets,
 * titres) perdrait son sujet. Corpus omis = celui du DÉPÔT.
 */
function servisDe(corpus?: unknown): { fileName: string; source: string }[] {
  const servir = middlewareDe(corpus);
  const manifeste = servir('/source/manifest.json').corps;
  const out = [{ fileName: 'source/manifest.json', source: manifeste }];
  const index = JSON.parse(manifeste) as Record<string, { chapitres: { ch: string }[] }>;
  for (const [book, livre] of Object.entries(index)) {
    for (const c of livre.chapitres) {
      out.push({ fileName: `source/${book}/${c.ch}.md`, source: servir(`/source/${book}/${c.ch}.md`).corps });
    }
  }
  return out;
}

describe('plugin `wfrp:prose-source` — le `Source/` ne sort du dépôt QU’EN DEV', () => {
  it('un build de PRODUCTION n’émet aucun asset `source/**` — les 16 livres VF ne partent pas sur le web', () => {
    // `deploy.yml` pousse `dist/.` sur GitHub Pages : un seul appel à `emitFile` publierait le corpus
    // intégral (11,0 Mo). La garde est STRUCTURELLE — elle lit le plugin, pas une sortie de build.
    //
    // DEUX volets, parce qu'aucun ne suffit :
    //  - le premier ÉNUMÈRE les hooks RÉELLEMENT déclarés (les clés de l'objet plugin), jamais une
    //    liste de noms attendus : `this.emitFile` est appelable depuis N'IMPORTE quel hook de build
    //    (`transform` et `buildStart` compris), donc une liste laisserait passer le hook qu'on n'y
    //    aurait pas pensé. Ceux qui restent sont NOMMÉS et justifiés ci-dessous ;
    //  - le second lit la SOURCE du fichier, hors commentaires : `emitFile` n'y apparaît pas.
    //
    // ANGLE MORT DÉCLARÉ : le scan textuel ne voit QUE ce fichier. Un `emitFile` atteint par un
    // module IMPORTÉ (un helper de `scripts/source/` qui recevrait le contexte Rollup) y échapperait.
    // Ce que la garde tient réellement : le plugin lui-même n'émet rien, et sa surface de hooks est
    // celle qu'on a lue. La preuve de bout en bout reste `npm run build` → `dist/source` absent.
    const plugin = proseSource({ corpus: corpusDe(fixture().chapitre) }) as Record<string, unknown>;
    // Hooks qui ne participent PAS à l'émission d'assets, chacun pour sa raison : `transform` réécrit
    // un module JSON (il rend du code, il n'émet pas de fichier) et `configureServer` ne vit qu'en
    // dev. `name`/`enforce` sont des métadonnées, pas des hooks.
    const CONNUS = new Set(['name', 'enforce', 'transform', 'configureServer']);
    const inattendus = Object.keys(plugin).filter((k) => !CONNUS.has(k));
    expect(inattendus, `hook(s) NON REVUS sur le plugin (chacun peut appeler \`this.emitFile\`) : ${inattendus.join(', ')}`).toEqual([]);
    const src = readFileSync(new URL('../../../scripts/source/prose-source-plugin.mjs', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, (_m, p) => p);
    expect(src.includes('emitFile'), '`emitFile` dans le plugin : le corpus repartirait en asset').toBe(false);
  });

  it('`/source/manifest.json` est servi en DEV, et son index nomme les chapitres du corpus', () => {
    const { chapitre } = fixture();
    const corpus = corpusDe(chapitre);
    const servi = middlewareDe(corpus)('/source/manifest.json');
    const liste = servisDe(corpus).find((f) => f.fileName === 'source/manifest.json')!;
    expect(servi.type).toBe('application/json; charset=utf-8');
    expect(servi.corps, 'deux lectures du même index divergent').toBe(liste.source);
    expect(JSON.parse(servi.corps)[LIVRE].chapitres[0].ch).toBe(CH);
  });

  it('`/source/<livre>/<NN>.md` rend le chapitre, et une adresse morte un 404 NOMMÉ', () => {
    const { chapitre } = fixture();
    const servir = middlewareDe(corpusDe(chapitre));
    expect(servir(`/source/${LIVRE}/${CH}.md`).corps).toBe(CHAPITRE);
    const mort = servir('/source/mer-des-griffes/99.md');
    expect(mort.code).toBe(404);
    expect(mort.corps).toContain('chapitre-introuvable : mer-des-griffes ch.99');
  });

  it('une route étrangère passe la main au serveur (aucun détournement)', () => {
    const { chapitre } = fixture();
    expect(middlewareDe(corpusDe(chapitre))('/src/data/psychology.json').suivant).toBe(true);
  });
});

describe('plugin `wfrp:prose-source` — manifeste du corpus RÉEL du dépôt', () => {
  it('l’ordre des chapitres est celui de `chapitresDe`, et chaque chapitre servi porte les octets du fichier `Source/`', () => {
    const emis = servisDe();
    const manifeste = JSON.parse(emis.find((f) => f.fileName === 'source/manifest.json')!.source) as
      Record<string, { abbr: string; chapitres: { ch: string; fichier: string; titre: string; octets: number }[] }>;
    const ordres: string[] = [];
    const octets: string[] = [];
    const corps: string[] = [];
    let comptes = 0;
    let titres = 0;
    for (const [bookId, livre] of Object.entries(manifeste)) {
      const attendu = (chapitresDe(bookId) as string[]).filter((ch) => cheminChapitre(bookId, ch));
      if (livre.chapitres.map((c) => c.ch).join(',') !== attendu.join(',')) ordres.push(bookId);
      for (const c of livre.chapitres) {
        comptes += 1;
        if (c.titre) titres += 1;
        const texte = readText(cheminChapitre(bookId, c.ch)) as string;
        if (c.octets !== Buffer.byteLength(texte, 'utf8')) octets.push(`${bookId} ch.${c.ch}`);
        const servi = emis.find((f) => f.fileName === `source/${bookId}/${c.ch}.md`);
        if (servi?.source !== texte) corps.push(`${bookId} ch.${c.ch}`);
      }
    }
    // Population IMPRIMÉE, jamais assertée : c'est l'IDENTITÉ qui est le contrat, pas le cardinal.
    console.log(`SOURCE SERVI EN DEV — ${Object.keys(manifeste).length} livre(s) extrait(s), ${comptes} chapitre(s) servis en dev, ${titres} nommés par un titre.`);
    expect(ordres, `livre(s) dont l’ordre des chapitres du manifeste diverge de \`chapitresDe\` :\n${ordres.join('\n')}`).toEqual([]);
    expect(octets, `chapitre(s) dont \`octets\` ne vaut pas la taille du texte servi :\n${octets.join('\n')}`).toEqual([]);
    expect(corps, `chapitre(s) dont le texte servi diverge du fichier \`Source/\` :\n${corps.join('\n')}`).toEqual([]);
    expect(comptes, 'aucun chapitre émis — le corpus du dépôt n’a pas été lu').toBeGreaterThan(0);
    expect(titres, 'aucun chapitre nommé — l’éditeur retomberait sur les noms de fichiers Word').toBeGreaterThan(0);
  });
});

/**
 * Ce que le TRANSFORM fait des modules RÉELS du dépôt. Les cas ci-dessus éprouvent le CÂBLAGE sur une
 * fixture ; celui-ci éprouve la MATÉRIALISATION sur la donnée livrée et le `Source/` livré — c'est
 * l'invariant sur lequel `src/data/index.ts` s'appuie pour typer une entrée adressée avec sa `desc`
 * REQUISE (`adressee<T>`, `index.ts`) : hors Vite la forme est celle du disque (l'adresse, sans prose),
 * dans le module chargé la prose est là. Aucun cardinal en dur : la population est IMPRIMÉE, et ce qui
 * est asserté est l'IDENTITÉ texte-résolu ⇄ texte-injecté, entrée par entrée.
 */
describe('plugin `wfrp:prose-source` — modules RÉELS du dépôt', () => {
  /** Les `.json` des deux racines qui portent au moins une adresse, sur le DISQUE — DÉRIVÉS de
   *  l'inventaire unique (`scripts/source/adresses.mjs`, groupé par fichier), jamais d'un second
   *  balayage : ce que cette sonde voit est exactement ce que la garde de re-résolution voit. */
  function modulesAdresses(): { id: string; code: string; adresses: Adresse[] }[] {
    return fichiersAdresses().map(({ fichier, adresses }) => {
      const p = join(RACINE_DEPOT, fichier);
      return { id: p, code: readFileSync(p, 'utf8'), adresses };
    });
  }

  /** Nœud désigné par un `chemin` de l'inventaire (`[3].effects[0]`), à toute profondeur — la racine
   *  d'un document n'est pas forcément un tableau d'entrées, et le chemin le sait. */
  function noeudAu(racine: unknown, chemin: string): Record<string, unknown> | undefined {
    let cible: unknown = racine;
    for (const [, indice, cle] of chemin.matchAll(/\[(\d+)\]|\.?([^.[\]]+)/g)) {
      if (cible === null || typeof cible !== 'object') return undefined;
      cible = (cible as Record<string, unknown>)[indice ?? cle];
    }
    return cible === null || typeof cible !== 'object' ? undefined : (cible as Record<string, unknown>);
  }

  it('chaque `desc` du module SERVI est le texte que l’adresse résout — et le DISQUE n’en porte aucune', () => {
    const plugin = proseSource();
    const modules = modulesAdresses();
    const divergentes: string[] = [];
    const surLeDisque: string[] = [];
    let adresses = 0;
    for (const { id, code, adresses: vues } of modules) {
      const servi = JSON.parse((plugin.transform.call(contexte().hook, code, id) as { code: string }).code) as unknown;
      for (const a of vues) {
        adresses += 1;
        // Une entrée ADRESSÉE ne porte pas sa prose sur le disque : les deux ensemble sont refusés au
        // parse (V1), et la copie serait la duplication que l'adressage existe pour supprimer.
        if (a.noeud.desc !== undefined) surLeDisque.push(`${id} ${a.id}`);
        const injecte = noeudAu(servi, a.chemin);
        const attendu = (resoudreProse({ descRef: a.ref }) as { md: string }).md;
        if (injecte?.desc !== attendu) {
          divergentes.push(`${id} ${a.id} (${a.chemin}) — le module servi ne porte pas le texte de son adresse`);
        }
      }
    }
    console.log(`PROSE MATÉRIALISÉE — ${modules.length} module(s) adressé(s), ${adresses} adresse(s) sur le disque.`);
    expect(surLeDisque, `entrée(s) portant À LA FOIS l’adresse et sa copie :\n${surLeDisque.join('\n')}`).toEqual([]);
    expect(divergentes, `entrée(s) dont la prose SERVIE diverge de son adresse :\n${divergentes.join('\n')}`).toEqual([]);
    // Le détecteur ne prouve rien sur un périmètre vide : la donnée DOIT porter des adresses.
    expect(adresses, 'aucune adresse dans les deux racines — la sonde mesurerait le vide').toBeGreaterThan(0);
  });
});

describe('plugin `wfrp:prose-source` — serveur de dev', () => {
  /**
   * Serveur Vite RÉEL (transform réel, `moduleGraph` réel, `ws` réel) sur la fixture. Le `change` est
   * ÉMIS sur le watcher réel plutôt qu'attendu du système de fichiers : sous un worker vitest, un
   * chokidar créé par Vite n'émet RIEN (mesuré — même code, même fixture : sous Node nu le `change`
   * arrive et le `full-reload` part ; sous vitest, ni en natif ni en scrutation, alors que
   * `fs.watch`/`fs.watchFile` bruts fonctionnent dans le worker). Tout ce que le PLUGIN fait est donc
   * vérifié ici ; l'unique maillon laissé à Vite est la remontée chokidar, dont la condition — le
   * dossier du livre mis sous surveillance par le plugin — est vérifiée juste en dessous.
   */
  it('un chapitre RÉÉCRIT invalide les modules JSON qui en dépendent et fait recharger la page', async () => {
    const { racine, chapitre } = fixture();
    const fichierJson = join(racine, 'src', 'data', 'psychology.json');
    writeFileSync(fichierJson, JSON.stringify([{ id: 'terreur', descRef: adresseDuTitre(chapitre, 'Terreur') }]), 'utf8');

    const server = await createServer({
      configFile: false,
      root: racine,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [proseSource({ corpus: corpusDe(chapitre) })],
    });
    const messages: { type?: string }[] = [];
    const ws = server.ws as unknown as { send: (...a: unknown[]) => void };
    const envoi = ws.send.bind(server.ws);
    ws.send = (...a: unknown[]) => { messages.push(a[0] as { type?: string }); envoi(...a); };
    try {
      const avant = await server.transformRequest('/src/data/psychology.json');
      expect(avant?.code).toContain('La Terreur est une réaction');
      const module = [...server.moduleGraph.idToModuleMap.values()]
        .find((m) => String(m.id).includes('src/data/psychology.json'));
      expect(module?.transformResult, 'le module JSON doit être en cache avant la modification').toBeTruthy();

      // Le dossier du chapitre est SOUS SURVEILLANCE : sans ce `add`, aucun `change` ne viendrait.
      // (chokidar prend ses répertoires de façon asynchrone — d'où l'attente bornée ; la comparaison
      // passe par `resolve` parce que chokidar rend ses clés dans la forme qu'on lui a donnée.)
      const dossier = resolve(dirname(chapitre));
      const surveille = () => Object.keys(server.watcher.getWatched()).map((d) => resolve(d));
      await vi.waitFor(
        () =>
          expect(
            surveille(),
            `le plugin n’a pas mis le dossier du livre sous surveillance — surveillés : ${surveille().join(', ')}`,
          ).toContain(dossier),
        { timeout: 8_000, interval: 50 },
      );

      writeFileSync(chapitre, CHAPITRE.replace('quelque chose d\'horrible', 'quelque chose de RÉÉCRIT'), 'utf8');
      server.watcher.emit('change', chapitre);

      expect(messages.map((m) => m?.type), 'aucun `full-reload` envoyé au navigateur').toContain('full-reload');
      expect(module?.transformResult, 'le module JSON est resté en cache : il servirait l’ancien texte').toBeNull();
      // Le chapitre est RELU (le cache du corpus a été oublié) : le texte a bougé sous l'adresse, donc
      // l'empreinte diverge et le module est ROUGE NOMMÉ — une dérive de source est bruyante, jamais
      // un texte approchant servi en silence. Sans l'oubli, l'ancien chapitre resservirait, muet.
      await expect(server.transformRequest('/src/data/psychology.json'))
        .rejects.toThrow('empreinte-divergente');
    } finally {
      await server.close();
    }
  });
});

describe('`materialiser` — pendant Node du transform', () => {
  it('une racine sans adresse traverse à l’IDENTIQUE (copie profonde, zéro matérialisation)', () => {
    const racine = { id: 'psychology', entries: [{ id: 'peur', desc: 'inline', tags: ['a', 'b'] }] };
    const res = materialiser(racine);
    expect(res.materialises).toBe(0);
    expect(JSON.stringify(res.racine)).toBe(JSON.stringify(racine));
  });

  it('la prose d’un nœud ADRESSÉ vient de l’adresse, quelle que soit la clé `desc` de la donnée', () => {
    // Un `desc` NON-CHAÎNE échappe au refus de `resoudreProse` (qui ne mord que sur la paire de
    // chaînes) : s'il était recopié, il écraserait la prose matérialisée — en silence, et seulement
    // quand il SUIT `descRef` dans l'ordre des clés.
    const { chapitre } = fixture();
    const racine = [{ id: 'terreur', descRef: adresseDuTitre(chapitre, 'Terreur'), desc: null }];
    const res = materialiser(racine, { lecteur: corpusDe(chapitre).lire, chemin: () => null });
    expect(res.materialises).toBe(1);
    expect(res.racine[0].desc).toContain('La Terreur est une réaction à quelque chose d\'horrible');
  });
});
