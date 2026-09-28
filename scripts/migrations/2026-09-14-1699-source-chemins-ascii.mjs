/**
 * Migration #1699 — les chemins de `Source/` passent en ASCII, une passe mécanique.
 *
 * Verbatim utilisateur (2026-09-06) : « Tu sais nos fichiers aujourd'hui peuvent etre déplacé, par
 * contre les caracteres accentués c'est un soucis ». La translittération est UNE fonction :
 * `nomAscii` (`scripts/source/nom-ascii.mjs`), la même que les scripts de découpe appellent à
 * l'écriture — un livre N+1 naît donc ASCII sans rien coûter à cette migration.
 *
 * INVARIANT DE CONTENU. Le ticket #1699 l'écrit : « contenu des fichiers byte-identique (seul le nom
 * change : `git diff -M --stat` = 100 % renames) ». Il tient pour les 1 314 CHAPITRES, à UNE exception
 * MESURÉE, qui est une décision d'ingénierie de ce lot et non une décision de l'utilisateur (aucun verbatim ne la porte) : les 39
 * `00 - Index.md` changent par la CIBLE de leurs liens relatifs (pas 4 ci-dessous). Sans ce pas, le
 * renommage tuerait 196 liens VIVANTS (mesure : 196 cibles non ASCII, 196 vivantes avant) dans la
 * vérité citable du dépôt. Ces index sont des TOC DÉRIVÉES — `buildFolioToc`
 * (`buildFolioToc`, `scripts/raw/folio-bootstrap.mjs`) régénère la ligne `- [titre](<NN - Titre.md>)` depuis les
 * noms de fichiers —, et seule leur cible bouge : ni prose, ni libellé.
 *
 * LES PAS, dans l'ordre, tous idempotents :
 *  1. PLAN — `git ls-files` sous `Source/`, dossiers d'abord (profondeur croissante) puis fichiers.
 *     Les COLLISIONS sont calculées AVANT tout geste : deux entrées qui convergent = sortie 1, rien
 *     d'écrit.
 *  2. `git mv` de chaque dossier puis de chaque fichier (l'histoire est conservée).
 *  3. PDF gitignorés homonymes d'un dossier (`Source/<dossier>.pdf`) — pas INDÉPENDANT du plan git :
 *     il lit le DISQUE, donc il renomme les PDF même sur un arbre dont les chemins suivis sont déjà
 *     ASCII (un worktree lié ne porte pas les fichiers ignorés : ce pas s'y mesure à 0).
 *  4. Cibles des LIENS RELATIFS des `.md` de `Source/**` — la clé de réécriture est le chemin COMPLET
 *     de la cible (`<dossier du livre>/<basename>`), JAMAIS un basename nu : 29 basenames sont
 *     dupliqués entre livres.
 *  5. RÉÉCRITURE TEXTUELLE par CHEMIN COMPLET (jamais par basename), anciens chemins triés du plus
 *     long au plus court, dans tous les fichiers TEXTE suivis hors `Source/**` et hors archives
 *     datées, sous TROIS formes : POSIX, Windows (`\`), et ÉCHAPPÉE de littéral (`\'`).
 *  6. Un stock keyé par BASENAME — `STOCK_ANCRES_VIDES` : le pas 5, qui réécrit par CHEMIN COMPLET,
 *     ne couvre pas un champ `file` NU, donc `nomAscii` s'y applique directement. C'est EXACTEMENT ce
 *     qu'un scan du disque rendrait après le renommage — une régénération par le PDF exigerait les PDF
 *     gitignorés, absents d'un worktree lié, et VIDERAIT le stock. Le pas rend 0 geste quand ce fichier
 *     est ABSENT de l'arbre — c'est le cas depuis que les ancres sans contenu vivent en deux stocks
 *     nominatifs à chemins COMPLETS (`empty-folios-perdues-stock.json`, `…-benignes-stock.json`),
 *     couverts par le pas 5 comme `scripts/raw/folio-gaps-stock.json` l'est déjà.
 *
 * `--dry` PAR DÉFAUT (rien n'est écrit, le plan est imprimé) ; `--apply` écrit.
 * PÉRIMÈTRE DU REJEU : `PERIMETRE` (`scripts/migrations/replay.mjs`) ne couvre PAS `Source/` — l'idempotence de
 * cette migration tient par CONSTRUCTION (plus aucun chemin non ASCII = plus aucun geste), pas par
 * la porte. Sur un EXPORT hors dépôt (`migrations:replay:head`, `estUnDepot` faux,
 * `replay.mjs`), `git ls-files` ne peut rien lister : la migration le DIT et rend 0 geste,
 * exit 0, sans planter.
 *
 * TROIS ANGLES MORTS NOMMÉS de la réécriture par chemin complet, corrigés À LA MAIN dans le même lot :
 *  - un chemin COMPOSÉ au call-site (dossier du livre + BASENAME en constante) est invisible d'elle
 *    — `scripts/raw/anchor-fill.test.mjs:124` ;
 *  - un chemin COMPOSÉ PAR SEGMENTS, où le nom du livre n'est JAMAIS une chaîne de chemin
 *    (`ROOT / "Source" / "<Livre>.pdf"` en Python) — `scripts/art-ref/ldb_extract.py:40` et
 *    `scripts/art-ref/ldb_map.py:29`, qui nomment le PDF que le pas 3 renomme ;
 *  - un chemin DANS L'HISTOIRE (`git show <sha>^:<path>`) ne doit surtout PAS être translittéré : il
 *    nomme un fichier tel qu'il était à ce commit — `scripts/raw/reanchor-split.mjs` (la réécriture
 *    l'avait cassé par son PRÉFIXE de dossier ; mesuré par `npm run raw:reanchor-split`). Depuis, ce
 *    fichier est dans `PORTEURS_DE_NOMS_FIGES` : la passe par NOM NU l'atteindrait aussi.
 *
 * ENTRÉES : `Source/**` (les chemins suivis, jamais le contenu des chapitres), les fichiers TEXTE
 * suivis hors `Source/**`, hors archives datées (`docs/decisions/`, `docs/plans/`,
 * `docs/superpowers/`, `.claude/soldes/`) et hors `PORTEURS_DE_NOMS_FIGES`, plus le stock keyé par
 * basename `STOCK_ANCRES_VIDES`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nomAscii } from '../source/nom-ascii.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const NOM = '2026-09-14-1699-source-chemins-ascii';

/** Le stock keyé par BASENAME que le pas 6 migre — source UNIQUE du chemin (le banc le réutilise). */
export const STOCK_ANCRES_VIDES = ['scripts', 'raw', 'empty-folios-baseline.json'].join('/');

/**
 * Fichiers dont un nom accentué est FIGÉ — jamais réécrits par le pas 5. Deux motifs, l'un et l'autre
 * mesurés, et la liste est NOMINATIVE et close :
 *  - les modules qui PORTENT la translittération : chez eux le nom accentué est une DONNÉE D'ENTRÉE
 *    (le cas de test, l'exemple de la règle), jamais la citation d'un fichier du corpus — les réécrire
 *    détruirait ce qu'ils mesurent (`nom-ascii.test.mjs` y perdrait ses entrées et deviendrait
 *    tautologique) ;
 *  - `reanchor-split.mjs`, qui nomme un chemin DANS L'HISTOIRE git (`git show <sha>^:<path>`,
 *    `SPLIT_SOURCES`) : ce nom-là est celui d'un commit passé et ne suit AUCUN renommage — la passe
 *    par NOM NU l'atteindrait sans préfixe `Source/`, là où le pas 5 par chemin complet l'avait
 *    déjà cassé une fois (mesure : `npm run raw:reanchor-split`, `fatal: path … does not exist`).
 */
export const PORTEURS_DE_NOMS_FIGES = [
  'scripts/source/nom-ascii.mjs',
  'scripts/source/nom-ascii.test.mjs',
  'scripts/migrations/2026-09-14-1699-source-chemins-ascii.mjs',
  'scripts/migrations/lib/1699-source-chemins-ascii.test.mjs',
  'src/source-hygiene-guard.test.ts',
  'scripts/raw/reanchor-split.mjs',
];

/** Archives DATÉES : elles portent l'état d'un jour, pas la vérité d'aujourd'hui. Jamais réécrites. */
export const ARCHIVES_DATEES = ['docs/decisions/', 'docs/plans/', 'docs/superpowers/', '.claude/soldes/'];

/** Extensions jamais OUVERTES (un binaire ne se réécrit pas ; le test de NUL ci-dessous double la porte). */
export const EXT_BINAIRES = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.woff', '.woff2',
  '.ttf', '.otf', '.eot', '.mp3', '.ogg', '.wav', '.mp4', '.webm', '.glb', '.gltf', '.bin', '.exe', '.dll',
];

const ANTISLASH = String.fromCharCode(92);
const LF = String.fromCharCode(10);

export const estAscii = (s) => [...s].every((c) => c.codePointAt(0) >= 0x20 && c.codePointAt(0) <= 0x7e);
/** Forme Windows d'un chemin POSIX (`scripts/source/resoudre.mjs` en cite une). */
export const formeWindows = (p) => p.split('/').join(ANTISLASH);
/** Forme ÉCHAPPÉE de littéral (`src/data/refs-migrated.test.ts` porte `d\'Initiation`). */
export const formeEchappee = (p) => p.split("'").join(`${ANTISLASH}'`);

/** `racine` est-elle dans un arbre de travail git ? (même détecteur que `replay.mjs#estUnDepot`) */
export function estUnDepot(racine) {
  const vu = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: racine, encoding: 'utf8' });
  return vu.status === 0 && (vu.stdout ?? '').trim() === 'true';
}

/** Chemins SUIVIS (POSIX, jamais quotés) sous `pathspec`. */
export function fichiersSuivis(racine, pathspec) {
  const out = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-z', '--', pathspec], {
    cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  return out.split('\0').filter(Boolean);
}

/**
 * PLAN de renommage d'une liste de chemins suivis.
 *
 * `gestesDossiers` d'abord (profondeur croissante : un parent renommé avant son enfant, le `de` d'un
 * enfant étant exprimé dans le parent DÉJÀ renommé), puis `gestesFichiers`. `mappe` porte TOUT chemin
 * dont la forme finale diffère de l'originale — dossiers, fichiers renommés ET fichiers simplement
 * déplacés par le renommage de leur dossier : c'est la source des couples de réécriture textuelle.
 * @param {readonly string[]} suivis
 * @returns {{ gestesDossiers: {de:string,vers:string,origine:string}[],
 *             gestesFichiers: {de:string,vers:string,origine:string}[],
 *             mappe: Map<string,string>, collisions: string[] }}
 */
export function planDeRenommage(suivis) {
  const dossiers = new Set();
  for (const f of suivis) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) dossiers.add(parts.slice(0, i).join('/'));
  }
  /** @type {Map<string,string>} */
  const mappe = new Map();
  const applique = (p) => {
    const parts = p.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const vu = mappe.get(parts.slice(0, i).join('/'));
      if (vu) return [vu, ...parts.slice(i)].join('/');
    }
    return p;
  };
  const renomme = (chemin, nom) => [...chemin.split('/').slice(0, -1), nomAscii(nom)].join('/');

  // CRITÈRE : « le nom est-il un POINT FIXE de `nomAscii` ? », jamais « est-il ASCII ? ». Un nom peut
  // être ASCII et hors forme (`12 - .md`, titre vidé par une passe antérieure) : un court-circuit sur
  // l'ASCII le sauterait.
  const aBouger = (nom) => nomAscii(nom) !== nom;

  const gestesDossiers = [];
  const parProfondeur = [...dossiers].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b, 'en'));
  for (const d of parProfondeur) {
    const nom = d.split('/').pop();
    if (!aBouger(nom)) continue;
    const de = applique(d);
    const vers = renomme(de, nom);
    mappe.set(d, vers);
    gestesDossiers.push({ de, vers, origine: d });
  }

  const gestesFichiers = [];
  for (const f of suivis) {
    const nom = f.split('/').pop();
    const de = applique(f);
    const vers = aBouger(nom) ? renomme(de, nom) : de;
    if (vers === f) continue;
    if (aBouger(nom)) gestesFichiers.push({ de, vers, origine: f });
    mappe.set(f, vers);
  }

  // COLLISIONS, calculées AVANT tout geste : deux chemins suivis qui convergent vers une même cible.
  const parCible = new Map();
  for (const f of suivis) {
    const c = mappe.get(f) ?? applique(f);
    if (!parCible.has(c)) parCible.set(c, []);
    parCible.get(c).push(f);
  }
  const collisions = [...parCible]
    .filter(([, l]) => l.length > 1)
    .map(([c, l]) => `${c} <= ${l.join(' | ')}`);

  // COLLISION DE DOSSIERS : deux dossiers à basenames DISJOINTS peuvent converger vers la même cible
  // (« Créatures » et « Creatures »), et leurs FICHIERS, eux, ne se heurtent pas — un `git mv` les
  // FUSIONNERAIT en silence. Le cardinal d'aujourd'hui est 0 ; la porte reste.
  const parCibleDossier = new Map();
  for (const d of dossiers) {
    const c = mappe.get(d) ?? applique(d);
    if (!parCibleDossier.has(c)) parCibleDossier.set(c, []);
    parCibleDossier.get(c).push(d);
  }
  for (const [c, l] of parCibleDossier) {
    if (l.length > 1) collisions.push(`DOSSIER ${c} <= ${l.join(' | ')}`);
  }

  return { gestesDossiers, gestesFichiers, mappe, collisions };
}

/** Couples `de` → `vers` de réécriture textuelle, du chemin le plus LONG au plus court. */
export function couplesTextuels(mappe) {
  return [...mappe].filter(([a, b]) => a !== b).sort((x, y) => y[0].length - x[0].length);
}

/**
 * Couples de NOMS NUS — basenames de chapitre ET noms de DOSSIER de livre —, pour les citations qui
 * ne portent pas le chemin complet.
 *
 * Deux classes, un même défaut : le pas 5 réécrit par chemin COMPLET, et ce qui est cité NU lui
 * échappe. Un commentaire qui dit « `09 - Compétences.md` n'a que 2 marqueurs », une table de
 * référence dont la colonne « dossier » porte `` `Warhammer v4 - Livre de base version corrigée/` ``
 * nomment un fichier ou un dossier qui n'existe plus : ils MENTENT (CLAUDE.md règle 6).
 *
 * CE QUI ENTRE, ET POURQUOI ÇA NE MORD PAS LA PROSE : la clé est le nom COMPLET, tel que le disque le
 * porte — `Warhammer v4 - Livre de base version corrigée`, pas « Livre de base » ; `09 - Compétences.md`,
 * pas « Compétences ». La prose, elle, nomme l'OUVRAGE par son titre (« *Nuits agitées & dures
 * journées* »), jamais par son nom de dossier (`Warhammer v4 - Nuits agitees & dures journées`, dont
 * le premier mot est déjà sans accent) : les deux chaînes DIFFÈRENT, et c'est ce qui rend la passe
 * sûre. Un nom de dossier de 1er niveau est UNIQUE par construction (deux frères ne portent pas le
 * même nom).
 *
 * N'entre sinon qu'un basename UNIQUE sur tout `Source/`. Un basename porté par plusieurs livres
 * (`00 - Index.md`, `01 - _GoBack.md`…) est AMBIGU : le réécrire à l'aveugle choisirait un livre au
 * hasard. Ceux-là sont rendus à part, NOMMÉS, et se corrigent à la main avec leur contexte.
 * @param {readonly string[]} suivis @param {Map<string,string>} mappe
 * @returns {{ uniques: [string, string][], ambigus: [string, string][] }}
 */
export function couplesDeBasenames(suivis, mappe) {
  const bn = (p) => p.split('/').pop();
  const compte = new Map();
  for (const f of suivis) compte.set(bn(f), (compte.get(bn(f)) ?? 0) + 1);
  /** @type {[string, string][]} */ const uniques = [];
  /** @type {[string, string][]} */ const ambigus = [];
  const vus = new Set();
  for (const f of suivis) {
    const a = bn(f);
    const b = bn(mappe.get(f) ?? f);
    if (a === b || vus.has(a)) continue;
    vus.add(a);
    (compte.get(a) === 1 ? uniques : ambigus).push([a, b]);
  }
  // Noms de DOSSIER de 1er niveau (`Source/<Livre>`), cités nus par les tables de référence.
  const suivisSet = new Set(suivis);
  for (const [avant, apres] of mappe) {
    const parts = avant.split('/');
    if (parts.length !== 2 || parts[0] !== 'Source' || suivisSet.has(avant)) continue;
    const a = parts[1];
    const b = apres.split('/').pop();
    if (a === b || vus.has(a)) continue;
    vus.add(a);
    uniques.push([a, b]);
  }
  return { uniques: uniques.sort((x, y) => y[0].length - x[0].length), ambigus };
}

/**
 * Le texte, chaque ancien chemin COMPLET remplacé sous ses trois formes (POSIX, Windows, échappée)
 * ET sous ses deux NORMALISATIONS.
 *
 * La normalisation n'est pas un luxe : le disque rend « Boîte » en DÉCOMPOSÉ (i + U+0302) — donc
 * `git ls-files` aussi, donc le plan — là où les littéraux du code sont en COMPOSÉ
 * (`src/data/refs-migrated.test.ts:770`). Sans les deux formes, ce site ne serait jamais réécrit
 * (mesuré : la passe sèche le manquait). La cible, elle, est ASCII : elle n'a qu'une forme.
 */
export function reecrireChemins(texte, couples) {
  let out = texte;
  for (const [a, b] of couples) {
    for (const norme of [...new Set([a, a.normalize('NFC'), a.normalize('NFD')])]) {
      for (const forme of [(p) => p, formeWindows, formeEchappee]) {
        const de = forme(norme);
        const vers = forme(b);
        if (de === vers || !out.includes(de)) continue;
        out = out.split(de).join(vers);
      }
    }
  }
  return out;
}

/** Un lien markdown vers un `.md`, avec ou sans chevrons : `](<cible.md>)` / `](cible.md)`. */
const RE_LIEN_MD = /\]\((<)?([^)>\n]+?\.md)(>)?\)/g;

/**
 * Les CIBLES des liens relatifs d'un `.md` de `Source/**`, réécrites par le plan.
 * La clé est le chemin COMPLET de la cible, résolu contre le dossier du fichier — jamais un basename
 * nu (29 basenames sont dupliqués entre livres). Rien d'autre de la ligne ne change.
 * @param {string} texte @param {string} cheminOrigine chemin ORIGINAL du fichier porteur
 * @param {Map<string,string>} mappe @returns {{ texte: string, cibles: number }}
 */
export function reecrireLiensRelatifs(texte, cheminOrigine, mappe) {
  // Lecture TOLÉRANTE à la normalisation : le plan vient de git (« Boîte » en décomposé), la cible
  // vient du TEXTE du fichier, qui peut être composé.
  const trouve = (p) => mappe.get(p) ?? mappe.get(p.normalize('NFC')) ?? mappe.get(p.normalize('NFD'));
  const dossierAvant = posix.dirname(cheminOrigine);
  // Le dossier d'ARRIVÉE du porteur : par sa propre entrée s'il en a une, sinon par celle de son
  // dossier (un index au nom déjà ASCII dans un livre renommé n'est pas lui-même dans la mappe).
  const dossierApres = trouve(cheminOrigine)
    ? posix.dirname(trouve(cheminOrigine))
    : trouve(dossierAvant) ?? dossierAvant;
  let cibles = 0;
  const out = texte.replace(RE_LIEN_MD, (tout, ouvrant, cible, fermant) => {
    if (cible.startsWith('http') || cible.startsWith('/')) return tout;
    const absAvant = posix.normalize(posix.join(dossierAvant, cible));
    const absApres = trouve(absAvant);
    if (!absApres) return tout;
    const neuve = posix.relative(dossierApres, absApres);
    // Une cible déjà ASCII dans un livre renommé reste la MÊME chaîne (le lien est relatif au
    // dossier) : elle n'est pas comptée, et la ligne ne bouge pas.
    if (neuve === cible) return tout;
    cibles += 1;
    return `](${ouvrant ?? ''}${neuve}${fermant ?? ''})`;
  });
  return { texte: out, cibles };
}

/** Le stock d'ancres vides, son champ `file` (un BASENAME) passé par `nomAscii`. */
export function stockEmptyFoliosMigre(json) {
  const parFichier = (e) => ({ ...e, file: nomAscii(e.file) });
  return {
    ...json,
    ...(json.perdues ? { perdues: json.perdues.map(parFichier) } : {}),
    ...(json.benignes ? { benignes: json.benignes.map(parFichier) } : {}),
  };
}

/** PDF gitignorés à renommer — lus sur le DISQUE, indépendamment du plan git (cf. pas 3). */
export function pdfsARenommer(racine) {
  const dossier = join(racine, 'Source');
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf') && !estAscii(e.name))
    .map((e) => ({ de: `Source/${e.name}`, vers: `Source/${nomAscii(e.name)}` }));
}

/** Le fichier est-il TEXTE ? (extension connue binaire, puis test de NUL sur les octets lus) */
export function estTexte(racine, rel) {
  if (EXT_BINAIRES.some((x) => rel.toLowerCase().endsWith(x))) return false;
  let octets;
  try { octets = readFileSync(join(racine, rel)); } catch { return false; }
  return !octets.subarray(0, 8192).includes(0);
}

/**
 * JOUE la migration sur `racine`.
 * @param {{ racine?: string, apply?: boolean, ecrire?: (l: string) => void }} params
 * @returns {{ gestes: number, dossiers: number, fichiers: number, pdf: number, textes: string[],
 *             liens: number, stock: number, collisions: string[], basenames: number,
 *             ambigus: [string, string][] }}
 */
export function migrer({ racine = ROOT, apply = false, ecrire = console.log } = {}) {
  const vide = { gestes: 0, dossiers: 0, fichiers: 0, pdf: 0, textes: [], liens: 0, stock: 0, collisions: [], basenames: 0, ambigus: [] };

  if (!estUnDepot(racine)) {
    ecrire(`${NOM} : ${racine} n’est pas un dépôt git — aucun chemin suivi à lister, 0 geste.`);
    return vide;
  }
  // Pas 3 — lu sur le DISQUE : indépendant du plan git (un arbre déjà migré côté suivi peut porter
  // des PDF ignorés au nom accentué ; un worktree lié n'en porte aucun et ce pas y vaut 0).
  const pdf = pdfsARenommer(racine);

  const suivis = fichiersSuivis(racine, 'Source');
  const { gestesDossiers, gestesFichiers, mappe, collisions } = planDeRenommage(suivis);

  ecrire(`${NOM} — ${suivis.length} chemin(s) suivi(s) sous Source/, ${suivis.filter((f) => !estAscii(f)).length} non ASCII`);
  ecrire(`  plan : ${gestesDossiers.length} dossier(s), ${gestesFichiers.length} fichier(s), ${pdf.length} PDF ignoré(s) ; collisions : ${collisions.length}`);
  for (const { de, vers } of gestesDossiers) ecrire(`  DIR  ${de}${LF}    -> ${vers}`);
  if (collisions.length) {
    ecrire('COLLISION(S) — deux chemins convergent vers une même cible ; rien n’est écrit :');
    for (const c of collisions) ecrire(`  ${c}`);
    return { ...vide, collisions };
  }

  const couples = couplesTextuels(mappe);
  const { uniques: couplesBasenames, ambigus } = couplesDeBasenames(suivis, mappe);

  // Fichiers TEXTE à réécrire (pas 5) : suivis, hors `Source/**`, hors archives datées.
  const candidats = fichiersSuivis(racine, '.')
    .filter((f) => !f.startsWith('Source/'))
    .filter((f) => !ARCHIVES_DATEES.some((a) => f.startsWith(a)))
    .filter((f) => !PORTEURS_DE_NOMS_FIGES.includes(f));

  const textes = [];
  let liens = 0;
  const fichiersALiens = [];
  if (couples.length) {
    for (const rel of candidats) {
      if (!estTexte(racine, rel)) continue;
      const avant = readFileSync(join(racine, rel), 'utf8');
      // Chemins COMPLETS d'abord (le plus long au plus court), BASENAMES ensuite : ce qui reste d'un
      // ancien basename après la première passe est une citation nue, pas un chemin.
      const apres = reecrireChemins(reecrireChemins(avant, couples), couplesBasenames);
      if (apres !== avant) textes.push(rel);
      if (apply && apres !== avant) writeFileSync(join(racine, rel), apres, 'utf8');
    }
    // Pas 4 — les cibles de liens relatifs des `.md` de `Source/**` (mesuré AVANT les `git mv`,
    // écrit APRÈS, à leur nouveau chemin).
    for (const rel of suivis) {
      if (!rel.endsWith('.md')) continue;
      const avant = readFileSync(join(racine, rel), 'utf8');
      const { texte, cibles } = reecrireLiensRelatifs(avant, rel, mappe);
      if (!cibles || texte === avant) continue;
      liens += cibles;
      fichiersALiens.push({ rel, texte });
    }
  }

  const git = (args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' });
  if (apply) {
    for (const { de, vers } of gestesDossiers) git(['mv', de, vers]);
    for (const { de, vers } of gestesFichiers) git(['mv', de, vers]);
    for (const { de, vers } of pdf) renameSync(join(racine, de), join(racine, vers));
    for (const { rel, texte } of fichiersALiens) {
      writeFileSync(join(racine, mappe.get(rel) ?? rel), texte, 'utf8');
    }
  }

  // Pas 6 — le stock keyé par BASENAME.
  let stock = 0;
  const cheminStock = join(racine, STOCK_ANCRES_VIDES);
  if (existsSync(cheminStock)) {
    const brut = readFileSync(cheminStock, 'utf8');
    const migre = `${JSON.stringify(stockEmptyFoliosMigre(JSON.parse(brut)), null, 2)}${LF}`;
    if (migre !== brut) {
      stock = 1;
      if (apply) writeFileSync(cheminStock, migre, 'utf8');
    }
  }

  ecrire(`  fichiers texte réécrits (hors Source/) : ${textes.length}`);
  for (const t of textes) ecrire(`    ${t}`);
  ecrire(`  cibles de liens relatifs réécrites sous Source/ : ${liens} dans ${fichiersALiens.length} fichier(s)`);
  ecrire(`  basenames réécrits en citation nue : ${couplesBasenames.length} unique(s) ; ${ambigus.length} AMBIGU(S), à corriger à la main :`);
  for (const [a, b] of ambigus) ecrire(`    ${a} -> ${b} (basename porté par plusieurs livres)`);
  const etatDuStock = existsSync(cheminStock) ? 'inchangé' : 'absent de l\'arbre';
  ecrire(`  ${STOCK_ANCRES_VIDES} : ${stock ? 'champ `file` migré' : etatDuStock}`);
  const gestes = gestesDossiers.length + gestesFichiers.length + pdf.length + textes.length + fichiersALiens.length + stock;
  ecrire(`  BILAN : ${gestes} geste(s)${apply ? ' APPLIQUÉ(S)' : ' (--dry : rien écrit ; --apply pour écrire)'}`);
  return {
    gestes, dossiers: gestesDossiers.length, fichiers: gestesFichiers.length, pdf: pdf.length,
    textes, liens, stock, collisions: [], basenames: couplesBasenames.length, ambigus,
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const r = migrer({ racine: ROOT, apply });
  if (r.collisions.length) process.exitCode = 1;
}

if (import.meta.main) main();
