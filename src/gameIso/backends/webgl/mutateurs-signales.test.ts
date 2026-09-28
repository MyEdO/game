/**
 * MUTATEURS SIGNALÉS (#1401) — tout export de `src/gameIso/backends/webgl/**` qui MUTE un objet three
 * déjà monté rend un signal de CHANGEMENT, et chacun de ses sites d'appel du monde volumique consomme
 * ce signal. Sans quoi l'appelant repeint (ou ne repeint pas) à l'aveugle : c'est le générateur de bug
 * que ce garde ferme.
 *
 * Étalons conformes du dépôt : `reposeGroundAccents` → `{dégagement, teinte}` consommé par l'effet
 * d'accents, `applyCutawayMask`/`applyVisibilityTint` → `{geometry, bouge}`, `reposerActeurs` →
 * `{ancres, caps}`.
 *
 * SÉLECTEUR, structurel et décidable à l'AST — un export est un mutateur d'objet monté quand :
 *  1. son nom porte un des préfixes de mutation (`apply`, `repose`/`reposer`, `write`, `pose`/`poser`,
 *     `percer`, `set`) ;
 *  2. il REÇOIT l'objet qu'il mute : au moins un paramètre n'est pas un scalaire de configuration
 *     (`number`, `string`, `boolean`, collection de chaînes). Une fonction qui ne prend que des
 *     scalaires ne peut toucher que de l'état de module (budget d'atlas, épingles de cache) — hors
 *     contrat par construction.
 * Les BÂTISSEURS (`build*`, `mount*`, `bake*`) sont hors périmètre par construction : ils RENDENT
 * l'objet neuf, personne n'a d'ancien état à comparer.
 *
 * Un NOMBRE n'est pas un signal de changement : `0` après effacement est un changement réel, et une
 * marque qui se déplace garde son compte. Le retour doit être un verdict (booléen ou composite).
 *
 * ANGLES MORTS énoncés : scan par AST du texte, sans vérificateur de types. Échappent au garde (a) un
 * mutateur nommé hors des préfixes ci-dessus, (b) une mutation faite via un alias de la fonction, une
 * méthode destructurée ou un `export * from`, (c) un appel hors de `src/gameIso/stage/**` et
 * `src/gameIso/backends/webgl/**` (le reste du dépôt ne monte pas de monde three), (d) un paramètre
 * scalaire qui cacherait une clé d'objet monté, (e) une consommation FICTIVE autre que les trois
 * écritures reconnues par `estNu` — `applyX(a, b) && 0`, `[applyX(a, b)]`, `(applyX(a, b), 0)`, un
 * argument jeté à une fonction qui l'ignore : le verdict y est syntaxiquement lu, et distinguer la
 * lecture réelle demanderait le vérificateur de types, (f) un site ILLÉGITIME logé dans le MÊME
 * fichier qu'un foyer de site portant le MÊME export : le compte du foyer l'absorberait sans bouger.
 * Keyer les foyers par LIGNE fermerait (f) mais rendrait la liste caduque à la première édition d'un
 * fichier voisin, y compris étrangère au foyer — le compte par fichier est le compromis retenu.
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../../../detenteur.testkit';

const DIR_WEBGL = 'src/gameIso/backends/webgl';
const DIR_STAGE = 'src/gameIso/stage';

/** Préfixes de MUTATION : le vocabulaire du dépôt pour « touche un objet qui existe déjà ». */
const PREFIXES = /^(apply|repose|reposer|write|pose|poser|percer|set)[A-Z]/;
/** Paramètre de CONFIGURATION : aucun objet monté ne se cache derrière ces types. */
const PARAM_CONFIG = /^(number|string|boolean|(Iterable|ReadonlySet|Set|Array|ReadonlyArray)<string>|(readonly )?string\[\])$/;
/** Retours qui ne portent AUCUN verdict. */
const RETOUR_MUET = /^(void|undefined|never|Promise<void>)$/;

/**
 * FOYERS DE SIGNAL — exports sélectionnés qui ne rendent PAS de verdict, avec leur raison. Un foyer
 * dispense aussi ses sites d'appel : il n'y a rien à consommer.
 */
const FOYERS_SIGNAL: readonly { readonly fichier: string; readonly export: string; readonly raison: string }[] = [
  {
    fichier: 'src/gameIso/backends/webgl/instancePools.ts',
    export: 'poserCompteInstances',
    raison: 'couture PRIMITIVE du compte d’un pool : le verdict appartient aux passes qui l’appellent (écriture de marques, repose par frame)',
  },
  {
    fichier: 'src/gameIso/backends/webgl/sceneMeshes.ts',
    export: 'poseContactShadow',
    raison: 'plaque un disque sous une ancre : au montage le disque n’est pas encore monté, à la frame il suit un billboard que la passe de pose repeint et dont elle rend le verdict (`aGlissé`)',
  },
  {
    fichier: 'src/gameIso/backends/webgl/weatherParticles.ts',
    export: 'writePrecipMatrices',
    raison: 'écrit le semis de précipitation À CHAQUE frame de la boucle météo, qui peint de toute façon l’image qu’elle vient de calculer',
  },
];

/**
 * FOYERS DE SITE — appels d'un export SIGNALANT qui laissent tomber le verdict, avec leur raison et le
 * NOMBRE de sites attendus dans ce fichier. Le compte est la garde : un site de plus (ou un site
 * qu'une exclusion structurelle cessait de couvrir) rougit, et un foyer à zéro site est mort.
 */
const FOYERS_SITE: readonly {
  readonly fichier: string;
  readonly export: string;
  readonly sites: number;
  readonly raison: string;
}[] = [
  {
    fichier: 'src/gameIso/backends/webgl/percageLocal.ts',
    export: 'percerMateriau',
    sites: 1,
    raison: 'matériau de profondeur NEUF, percé avant d’être rendu à son appelant : aucune image ne le porte encore',
  },
  {
    fichier: 'src/gameIso/stage/GameStage3D.tsx',
    export: 'percerMateriau',
    sites: 1,
    raison: 'matériaux du monde tout juste fabriqués, montés sur leur maillage à la ligne suivante — l’effet peint inconditionnellement le monde qu’il vient de monter',
  },
  {
    fichier: 'src/gameIso/stage/GameStage3D.tsx',
    export: 'applyFogGamma',
    sites: 1,
    raison: 'posé DANS `dessiner`, juste avant le rendu : l’image part de toute façon',
  },
  {
    fichier: 'src/gameIso/stage/planSnapshot.ts',
    export: 'applyCutawayMask',
    sites: 1,
    raison: 'cuisson HORS ÉCRAN à usage unique : le monde cuit naît et meurt dans l’appel, aucune frame ne le porte',
  },
  {
    fichier: 'src/gameIso/stage/planSnapshot.ts',
    export: 'applyVisibilityTint',
    sites: 1,
    raison: 'même cuisson hors écran que le dégagement ci-dessus',
  },
];

// ── Outillage AST ────────────────────────────────────────────────────────────────────────────────

function analyser(fichier: string, code: string): ts.SourceFile {
  const kind = /\.tsx$/.test(fichier) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fichier, code, ts.ScriptTarget.Latest, true, kind);
}

const ligneDe = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

export interface Mutateur {
  nom: string;
  ligne: number;
  retour: string;
  /** Le retour porte-t-il un VERDICT (ni muet, ni un simple compte) ? */
  signalant: boolean;
  /** Pourquoi le retour ne signale pas — vide quand il signale. */
  grief: string;
}

function estExporté(n: ts.Node): boolean {
  return ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function verdictDuRetour(retour: string): string {
  if (retour === '(inféré)') return 'retour non annoté : le contrat doit être LISIBLE à la déclaration';
  if (RETOUR_MUET.test(retour)) return 'ne rend AUCUN signal de changement';
  if (retour === 'number') return 'rend un COMPTE, pas un changement (0 après effacement EST un changement)';
  return '';
}

/** Les exports mutateurs d'un fichier de `backends/webgl` — sélecteur du contrat, ci-dessus. */
export function mutateursDe(fichier: string, code: string): Mutateur[] {
  const sf = analyser(fichier, code);
  const out: Mutateur[] = [];
  const retenir = (nom: string, params: readonly ts.ParameterDeclaration[], type: ts.TypeNode | undefined, n: ts.Node) => {
    if (!PREFIXES.test(nom)) return;
    const recoitUnObjet = params.some((p) => !p.type || !PARAM_CONFIG.test(p.type.getText(sf).trim()));
    if (!recoitUnObjet) return;
    const retour = type ? type.getText(sf).trim() : '(inféré)';
    const grief = verdictDuRetour(retour);
    out.push({ nom, ligne: ligneDe(sf, n), retour, signalant: grief === '', grief });
  };
  sf.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name && estExporté(n)) retenir(n.name.text, n.parameters, n.type, n);
    if (ts.isVariableStatement(n) && estExporté(n)) {
      for (const d of n.declarationList.declarations) {
        const init = d.initializer;
        if (!ts.isIdentifier(d.name) || !init) continue;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) retenir(d.name.text, init.parameters, init.type, d);
      }
    }
  });
  return out;
}

/** Le NETTOYAGE d'un effet : la fonction RENDUE par le callback d'un `useEffect`/`useLayoutEffect`. */
function dansUnNettoyageDEffet(n: ts.Node): boolean {
  let courant: ts.Node | undefined = n.parent;
  while (courant) {
    if (ts.isArrowFunction(courant) || ts.isFunctionExpression(courant)) {
      const retour = ts.isReturnStatement(courant.parent) ? courant.parent : null;
      if (retour) {
        let hôte: ts.Node | undefined = retour.parent;
        while (hôte && !ts.isArrowFunction(hôte) && !ts.isFunctionExpression(hôte)) hôte = hôte.parent;
        const appel = hôte?.parent;
        if (
          appel &&
          ts.isCallExpression(appel) &&
          ts.isIdentifier(appel.expression) &&
          /^use(Layout)?Effect$/.test(appel.expression.text)
        ) {
          return true;
        }
      }
    }
    courant = courant.parent;
  }
  return false;
}

export interface Site {
  nom: string;
  ligne: number;
  /** Appel dont le retour part à la poubelle (instruction nue). */
  nu: boolean;
  /** Exclusion structurelle : le site vit dans un nettoyage d'effet. */
  nettoyage: boolean;
}

/**
 * Le retour de cet appel part-il à la POUBELLE ? Trois écritures de la même chose : l'instruction nue,
 * l'opérateur `void`, et l'affectation à un identifiant préfixé `_` — dont la convention même dit
 * qu'il ne sera jamais relu (le préfixe suffit donc comme critère, sans suivre les usages).
 */
function estNu(n: ts.CallExpression): boolean {
  const p = n.parent;
  if (ts.isExpressionStatement(p)) return true;
  if (ts.isVoidExpression(p)) return true;
  if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && p.name.text.startsWith('_')) return true;
  return false;
}

/** Les appels des exports `noms` dans une source du monde volumique. */
export function sitesDe(fichier: string, code: string, noms: ReadonlySet<string>): Site[] {
  const sf = analyser(fichier, code);
  const out: Site[] = [];
  const visiter = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && noms.has(n.expression.text)) {
      out.push({
        nom: n.expression.text,
        ligne: ligneDe(sf, n),
        nu: estNu(n),
        nettoyage: dansUnNettoyageDEffet(n),
      });
    }
    n.forEachChild(visiter);
  };
  visiter(sf);
  return out;
}

// ── Le monde réel ────────────────────────────────────────────────────────────────────────────────

const MUTATEURS = detenteur(() =>
  readCorpus([DIR_WEBGL]).flatMap(({ rel, text }) =>
    mutateursDe(rel, text).map((m) => ({ ...m, fichier: rel })),
  ),
);
const SIGNALANTS = detenteur(() => new Set(MUTATEURS().filter((m) => m.signalant).map((m) => m.nom)));
const SITES = detenteur(() =>
  readCorpus([DIR_WEBGL, DIR_STAGE]).flatMap(({ rel, text }) =>
    sitesDe(rel, text, SIGNALANTS()).map((s) => ({ ...s, fichier: rel })),
  ),
);
/** Les sites qui laissent tomber un verdict, exclusions structurelles retirées. */
const PERDUS = detenteur(() => SITES().filter((s) => s.nu && !s.nettoyage));

describe('#1401 — un mutateur du monde monté rend un signal, et son appelant le consomme', () => {
  it('le sélecteur trouve VRAIMENT des mutateurs, dont les trois étalons du ticket', () => {
    expect(MUTATEURS().length, 'sélecteur muet = garde qui ne pèse rien').toBeGreaterThanOrEqual(10);
    for (const étalon of ['applyCutawayMask', 'applyVisibilityTint', 'reposeGroundAccents', 'reposerActeurs']) {
      expect(MUTATEURS().find((m) => m.nom === étalon)?.signalant, étalon).toBe(true);
    }
  });

  it('chaque mutateur rend un signal de CHANGEMENT — hors foyers déclarés', () => {
    const exemptés = new Set(FOYERS_SIGNAL.map((f) => `${f.fichier}#${f.export}`));
    const fautifs = MUTATEURS().filter((m) => !m.signalant && !exemptés.has(`${m.fichier}#${m.nom}`)).map(
      (m) => `${m.fichier}:${m.ligne} ${m.nom} → ${m.retour} : ${m.grief}`,
    );
    expect(fautifs, `Rendre un verdict de changement (patron : \`{bouge}\`, \`{dégagement, teinte}\`, booléen) :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('chaque site d’appel consomme le signal — hors nettoyage d’effet et foyers déclarés', () => {
    const exemptés = new Set(FOYERS_SITE.map((f) => `${f.fichier}#${f.export}`));
    const fautifs = PERDUS().filter((s) => !exemptés.has(`${s.fichier}#${s.nom}`)).map(
      (s) => `${s.fichier}:${s.ligne} ${s.nom}(…) — retour jeté`,
    );
    expect(fautifs, `Consommer le verdict (le lire, le tester, ou le déclarer en foyer) :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('chaque foyer de SIGNAL est vivant : son export existe et reste muet', () => {
    for (const f of FOYERS_SIGNAL) {
      const m = MUTATEURS().find((x) => x.fichier === f.fichier && x.nom === f.export);
      expect(m, `${f.fichier}#${f.export} (${f.raison})`).toBeDefined();
      expect(m!.signalant, `${f.export} SIGNALE désormais : son exemption se retire`).toBe(false);
    }
  });

  it('chaque foyer de SITE porte EXACTEMENT le nombre de sites déclaré', () => {
    for (const f of FOYERS_SITE) {
      const n = PERDUS().filter((s) => s.fichier === f.fichier && s.nom === f.export).length;
      expect(n, `${f.fichier}#${f.export} (${f.raison})`).toBe(f.sites);
    }
  });

  it('le nettoyage d’effet est bien EXCLU par structure, pas par foyer', () => {
    const nettoyages = SITES().filter((s) => s.nu && s.nettoyage);
    expect(nettoyages.length, 'aucun site de nettoyage détecté : l’exclusion structurelle ne pèse rien').toBeGreaterThan(0);
  });
});

// ── Négatifs : ce que le scanner voit, et ce qu'il laisse passer ──────────────────────────────────

const BATISSEURS = `
import * as THREE from 'three';
export function buildTruc(x: number): THREE.Mesh { return new THREE.Mesh(); }
export function mountTruc(scene: THREE.Scene): THREE.Mesh { return new THREE.Mesh(); }
export function bakeTruc(scene: THREE.Scene): THREE.Mesh { return new THREE.Mesh(); }
`;

const CONFIG = `
export function setBudgetOctets(n: number): number { return n; }
export function setEpingles(keys: Iterable<string>): void {}
`;

describe('#1401 — le scanner, sur des sources synthétiques', () => {
  it('un mutateur SANS signal est vu ; un bâtisseur et un réglage de module ne le sont pas', () => {
    expect(mutateursDe('t.ts', 'export function applyTest(obj: THREE.Object3D): void {}')).toEqual([
      { nom: 'applyTest', ligne: 1, retour: 'void', signalant: false, grief: 'ne rend AUCUN signal de changement' },
    ]);
    expect(mutateursDe('t.ts', BATISSEURS)).toEqual([]);
    expect(mutateursDe('t.ts', CONFIG)).toEqual([]);
  });

  it('un COMPTE ne passe pas pour un signal ; un verdict composite ou booléen, si', () => {
    expect(mutateursDe('t.ts', 'export function writeTest(m: THREE.InstancedMesh): number { return 0; }')[0].signalant).toBe(false);
    expect(mutateursDe('t.ts', 'export function writeTest(m: THREE.InstancedMesh): boolean { return true; }')[0].signalant).toBe(true);
    expect(mutateursDe('t.ts', 'export function applyTest(b: BakedWorld): { geometry: G; bouge: boolean } { return x; }')[0].signalant).toBe(true);
    expect(mutateursDe('t.ts', 'export const poserTest = (m: THREE.Mesh): boolean => true;')[0].signalant).toBe(true);
  });

  it('un retour NON ANNOTÉ est refusé : le contrat se lit à la déclaration', () => {
    expect(mutateursDe('t.ts', 'export function applyTest(m: THREE.Mesh) { return true; }')[0].grief).toMatch(/non annoté/);
  });

  const NOMS = new Set(['applyTest']);
  it('la poubelle est vue sous ses trois écritures ; membre, destructuration, affectation et condition sont muets', () => {
    const nus = (code: string) => sitesDe('t.tsx', code, NOMS).map((s) => s.nu);
    expect(nus('applyTest(a, b);'), 'retour jeté').toEqual([true]);
    expect(nus('void applyTest(a, b);'), 'jeté par `void`').toEqual([true]);
    expect(nus('const _ = applyTest(a, b);'), 'jeté dans un identifiant préfixé `_`').toEqual([true]);
    expect(nus('const _bougé = applyTest(a, b);'), 'même poubelle, nommée').toEqual([true]);
    expect(nus('if (!applyTest(a, b).bouge) return;'), 'forme réelle de GameStage3D.tsx (accès membre)').toEqual([false]);
    expect(nus('const { ancres, caps } = applyTest(a, b);'), 'destructuration').toEqual([false]);
    expect(nus('const bougé = applyTest(a, b).bouge;'), 'affectation').toEqual([false]);
    expect(nus('if (applyTest(a, b)) dessiner();'), 'condition').toEqual([false]);
    expect(nus('let x = false; if (applyTest(a, b)) x = true;'), 'accumulation de verdict').toEqual([false]);
  });

  it('le NETTOYAGE d’un effet est reconnu ; le corps de l’effet, non', () => {
    const code = `
useEffect(() => {
  applyTest(a, 1);
  return () => { applyTest(a, null); };
}, [dep]);
`;
    expect(sitesDe('t.tsx', code, NOMS).map((s) => [s.ligne, s.nettoyage])).toEqual([
      [3, false],
      [4, true],
    ]);
  });
});
