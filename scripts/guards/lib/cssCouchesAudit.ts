/**
 * MESURE des TROIS COUCHES CSS (#1800) — définition UNIQUE, partagée par les cliquets (xxi)/(xxii)
 * (`src/ui/ui-ratchets.test.ts`) et la régénération de `cssCouchesStock.mjs` (`regenerations`).
 *
 * Trois classes de défaut, trois collections :
 *   1. IDENTITÉ en module d'ÉCRAN — une déclaration qui PEINT (couleur, bordure, police, rayon,
 *      ombre, curseur, transition…) là où seul le PLACEMENT est légitime ; elle appartient à une
 *      primitive, et se solde en la DÉPLAÇANT vers le module de sa primitive, jamais en effaçant
 *      son aspect.
 *   2. ESPACEMENT hors échelle — un `gap`/`padding`/`margin` en littéral `px`/`rem`/`em` au lieu
 *      d'un pas `var(--sp-*)`, en module d'écran ET dans `layout.css` (la couche s'applique sa
 *      propre règle ; les modules de PRIMITIVE, eux, portent leur densité comme leur matière).
 *   3. STYLE INLINE — toute forme de `style=` dans `src/ui` hors l'unique exception légale
 *      (arbitrage A2, 2026-09-18) : un littéral d'objet dont TOUTES les clés sont des variables
 *      CSS, consommées par une classe (patron `.swatch`).
 *
 * FRONTIÈRE module de PRIMITIVE / module d'ÉCRAN : elle dérive du CATALOGUE, jamais d'une liste
 * gravée ici — une primitive déclare au manifeste (`src/data/primitives.manifest.json`, champ
 * `css`) le module qu'elle POSSÈDE. Tout autre `src/ui/styles/*.css` hors feuilles partagées est un
 * module d'écran.
 *
 * Chaque fonction de mesure est PURE sur les fichiers qu'elle reçoit : les preuves par mutation lui
 * passent des fixtures en mémoire, jamais le disque.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCorpus } from './sourceCorpus.mjs';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';
import {
  declarations,
  estPlacement,
  FEUILLES_PARTAGEES,
  PROPRIETES_A_ECHELLE,
  reglesCss,
  valeurHorsEchelle,
} from './cssCouches.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

/** Un fichier tel que `readCorpus` le rend — ou une FIXTURE de même forme. */
export type Fichier = { rel: string; text: string };

type EntreeManifeste = { id: string; css?: string };

/** Les modules de `src/ui/styles/` qu'une primitive POSSÈDE (champ `css` du manifeste). */
export function modulesDePrimitive(
  manifeste: readonly EntreeManifeste[] = JSON.parse(
    readFileSync(`${RACINE}src/data/primitives.manifest.json`, 'utf8'),
  ),
): Set<string> {
  return new Set(manifeste.map((e) => e.css).filter((c): c is string => typeof c === 'string'));
}

/** Les modules d'ÉCRAN : `src/ui/styles/*.css` moins les feuilles partagées, moins les modules de
 *  primitive. Ce sont EUX que le cliquet (xxi) juge. */
export function modulesDEcran(
  fichiers: readonly Fichier[] = feuillesDeStyle(),
  primitives: ReadonlySet<string> = modulesDePrimitive(),
): Fichier[] {
  return fichiers.filter((f) => !FEUILLES_PARTAGEES.includes(f.rel) && !primitives.has(f.rel));
}

/** Toutes les feuilles MESURÉES : `src/ui/styles/` ∪ les modules déclarés par le manifeste (champ
 *  `css`), où qu'ils vivent — une primitive qui n'habite pas `src/ui` (le plateau, `gameIso`) POSSÈDE
 *  quand même sa feuille, et le corpus se lit sur la SOURCE UNIQUE qu'est le manifeste (#1806). */
export const feuillesDeStyle = (): readonly Fichier[] => {
  const dansStyles = readCorpus(['src/ui/styles'], { exts: ['.css'] });
  const dejaLues = new Set(dansStyles.map((f) => f.rel));
  const ailleurs = [...modulesDePrimitive()].filter((c) => !dejaLues.has(c) && existsSync(`${RACINE}${c}`));
  return [...dansStyles, ...ailleurs.map((rel) => ({ rel, text: readFileSync(`${RACINE}${rel}`, 'utf8') }))];
};

/** Le sélecteur NORMALISÉ d'une règle : la liste telle qu'elle est écrite, espaces réduits. Le
 *  contexte `@media` n'entre PAS dans la clé — il n'est pas un abri, et l'y mettre ferait dériver
 *  le stock au moindre déplacement de breakpoint. */
const cleDeRegle = (selecteurs: readonly string[]) => selecteurs.join(', ').replace(/\s+/g, ' ');

/** Sites d'IDENTITÉ : une déclaration qui n'est pas du PLACEMENT, dans un module d'écran. */
export function sitesIdentiteEcran(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
  for (const f of fichiers) {
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      const sel = cleDeRegle(selecteurs);
      for (const { prop } of declarations(corps)) {
        if (!estPlacement(prop)) sites.push({ file: f.rel, ref: `${sel} :: ${prop}` });
      }
    }
  }
  return sites;
}

/** Sites d'ESPACEMENT hors échelle `--sp-*`. */
export function sitesEspacementHorsEchelle(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
  for (const f of fichiers) {
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      const sel = cleDeRegle(selecteurs);
      for (const { prop, valeur } of declarations(corps)) {
        if (PROPRIETES_A_ECHELLE.has(prop) && valeurHorsEchelle(valeur)) {
          sites.push({ file: f.rel, ref: `${sel} :: ${prop} :: ${valeur.replace(/\s+/g, ' ')}` });
        }
      }
    }
  }
  return sites;
}

/** Corps à partir duquel un texte est un GRAND TITRE D'AFFICHAGE, en px. */
export const SEUIL_GRAND_TITRE_PX = 30;

/** Viewport de RÉFÉRENCE des recettes : la vue BUREAU de `scripts/recette/vues-recette.json`, source
 *  UNIQUE des vues jugées (#1847) — lue ici, jamais recopiée. Elle donne aux unités de vue une borne
 *  lisible (1vw = 17,07px, 1vh = 7,8px) ; sans elle, un `font-size: 12vw` nu ne serait pas mesuré.
 *  Ne pas confondre avec le BREAKPOINT grand écran de la charte (1440px) : celui-là est un seuil de
 *  règle CSS, celle-ci est la fenêtre où l'audit convertit une unité de vue en pixels. */
export const VIEWPORT_RECETTE = ((): { largeur: number; hauteur: number } => {
  const vues: { nom: string; largeur: number; hauteur: number }[] = JSON.parse(
    readFileSync(`${RACINE}scripts/recette/vues-recette.json`, 'utf8'),
  );
  const bureau = vues.find((v) => v.nom === 'bureau');
  if (!bureau) throw new Error('vues-recette.json ne porte plus de vue « bureau » : le viewport de référence des recettes n’a plus de source');
  return { largeur: bureau.largeur, hauteur: bureau.hauteur };
})();

const PX_PAR_UNITE: Record<string, number> = {
  px: 1,
  rem: 16,
  em: 16,
  vw: VIEWPORT_RECETTE.largeur / 100,
  vh: VIEWPORT_RECETTE.hauteur / 100,
  vmin: Math.min(VIEWPORT_RECETTE.largeur, VIEWPORT_RECETTE.hauteur) / 100,
  vmax: Math.max(VIEWPORT_RECETTE.largeur, VIEWPORT_RECETTE.hauteur) / 100,
};

/** Borne en px, ou `null` = INDÉCIDABLE (la valeur dépend d'un contexte que le texte ne dit pas). */
export type Borne = number | null;

/** L'appel de fonction qui couvre TOUTE la valeur (`clamp(…)`), avec ses arguments de niveau 0. */
function appelDeFonction(v: string): { nom: string; args: string[] } | null {
  const m = /^([a-z-]+)\(/.exec(v);
  if (!m || !v.endsWith(')')) return null;
  let prof = 0;
  for (let i = m[0].length - 1; i < v.length; i++) {
    if (v[i] === '(') prof++;
    else if (v[i] === ')') {
      prof--;
      if (prof === 0 && i !== v.length - 1) return null; // `min(1px) + 2px` : pas un appel unique
    }
  }
  return { nom: m[1], args: decoupeNiveau0(v.slice(m[0].length, -1), ',') };
}

/** Découpe sur un séparateur de NIVEAU 0 (parenthèses respectées). */
function decoupeNiveau0(src: string, sep: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let courant = '';
  for (const c of src) {
    if (c === '(') prof++;
    else if (c === ')') prof--;
    if (prof === 0 && (sep === ' ' ? /\s/.test(c) : c === sep)) { out.push(courant); courant = ''; continue; }
    courant += c;
  }
  out.push(courant);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Arithmétique de `calc()`, en px : descente récursive sur `+ - * / ( )`. `null` = non évaluable. */
function evaluerArithmetique(src: string): Borne {
  let i = 0;
  const espaces = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const facteur = (): Borne => {
    espaces();
    if (src[i] === '(') {
      i++;
      const v = somme();
      espaces();
      if (src[i] !== ')') return null;
      i++;
      return v;
    }
    const m = /^(-?\d*\.?\d+)([a-z%]*)/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    if (!m[2]) return Number(m[1]);
    const k = PX_PAR_UNITE[m[2]];
    return k === undefined ? null : Number(m[1]) * k;
  };
  const produit = (): Borne => {
    let g = facteur();
    for (;;) {
      espaces();
      const op = src[i];
      if (op !== '*' && op !== '/') return g;
      i++;
      const d = facteur();
      if (g === null || d === null || (op === '/' && d === 0)) return null;
      g = op === '*' ? g * d : g / d;
    }
  };
  const somme = (): Borne => {
    let g = produit();
    for (;;) {
      espaces();
      const op = src[i];
      if (op !== '+' && op !== '-') return g;
      i++;
      const d = produit();
      if (g === null || d === null) return null;
      g = op === '+' ? g + d : g - d;
    }
  };
  const v = somme();
  espaces();
  return i === src.length ? v : null;
}

/** Les TOKENS de longueur déclarés par la couche partagée (`--x: 10px`) : un `var()` qui les nomme
 *  est DÉCIDABLE. Un même nom peut être reposé en contexte (`@media`) : toutes ses valeurs sont
 *  gardées, et la borne haute est la plus grande. */
export function tokensPartages(fichiers: readonly Fichier[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of fichiers) {
    if (!FEUILLES_PARTAGEES.includes(f.rel)) continue;
    for (const { corps } of reglesCss(f.text)) {
      for (const { prop, valeur } of declarations(corps)) {
        if (prop.startsWith('--')) out.set(prop, [...(out.get(prop) ?? []), valeur]);
      }
    }
  }
  return out;
}

/** Profondeur maximale de résolution d'un `var()` en chaîne — borne un cycle de tokens. */
const PROFONDEUR_VAR = 4;

/**
 * BORNE HAUTE d'une taille de texte, en px. `rem`/`em` valent 16px (racine du dépôt) ; `vw`/`vh` se
 * lisent au `VIEWPORT_RECETTE` ; `clamp(a, b, c)` vaut la borne de `c` ; `min()`/`max()` valent leur
 * plus GRANDE branche (majorant) ; `calc()` est évalué ; `var(--x)` se résout sur les tokens de la
 * couche partagée, ou sur son repli. Toute valeur dont le texte ne dit pas la taille (un token
 * inconnu, `env(…)`, un `calc` non évaluable) rend `null` : elle est LEVÉE par la garde, jamais
 * ignorée en silence.
 */
export function borneHauteEnPx(
  valeur: string,
  tokens: ReadonlyMap<string, string[]> = new Map(),
  profondeur = 0,
): Borne {
  const v = valeur.trim();
  const borne = (x: string) => borneHauteEnPx(x, tokens, profondeur + 1);
  const majorant = (xs: readonly string[]): Borne => {
    const bornes = xs.map(borne);
    return bornes.some((b) => b === null) ? null : Math.max(...(bornes as number[]));
  };
  const f = appelDeFonction(v);
  if (f) {
    if (profondeur >= PROFONDEUR_VAR) return null;
    if (f.nom === 'clamp') return f.args.length === 3 ? borne(f.args[2]) : null;
    if (f.nom === 'min' || f.nom === 'max') return majorant(f.args);
    if (f.nom === 'calc') return f.args.length === 1 ? evaluerArithmetique(f.args[0]) : null;
    if (f.nom === 'var') {
      const valeurs = tokens.get(f.args[0]);
      if (valeurs?.length) return majorant(valeurs);
      return f.args.length > 1 ? borne(f.args.slice(1).join(',')) : null;
    }
    return null;
  }
  const lit = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(v);
  if (lit) {
    if (!lit[2]) return Number(lit[1]);
    const k = PX_PAR_UNITE[lit[2]];
    return k === undefined ? 0 : Number(lit[1]) * k; // `%`/`pt`… : relatif à un hérité, pas un grand titre
  }
  return /^[a-z-]+$/.test(v) ? 0 : null; // mot-clé (`inherit`, `larger`, `medium`) : pas un grand titre
}

/** La taille déclarée par le RACCOURCI `font` : le premier terme qui porte une LONGUEUR (un poids
 *  (`600`) ou un mot-clé de style n'en est pas une), amputé de son `/line-height`. */
export function tailleDuRaccourciFont(valeur: string): string | null {
  for (const terme of decoupeNiveau0(valeur, ' ')) {
    const taille = terme.split('/')[0].trim();
    if (/^(clamp|min|max|calc)\(/.test(taille)) return taille;
    if (/^-?\d*\.?\d+[a-z]+$/.test(taille) && PX_PAR_UNITE[/[a-z]+$/.exec(taille)![0]] !== undefined) return taille;
  }
  return null;
}

/**
 * Sites de GRAND TEXTE D'AFFICHAGE hors couche partagée (#1806) : une règle dont la taille de texte
 * atteint `SEUIL_GRAND_TITRE_PX` réécrit la matière de `.display-title` — elle la POSE, ou elle
 * n'est pas un grand titre. Le critère ne regarde PAS la police : un grand corps est un grand titre,
 * qu'il hérite sa police ou qu'il la déclare. Mesure ABSOLUE, sans liste ni seuil négociable.
 */
export function sitesGrandTitre(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
  const tokens = tokensPartages(fichiers);
  for (const f of fichiers) {
    if (FEUILLES_PARTAGEES.includes(f.rel)) continue;
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      for (const { prop, valeur } of declarations(corps)) {
        if (prop !== 'font-size' && prop !== 'font') continue;
        const brut = prop === 'font' ? tailleDuRaccourciFont(valeur) : valeur;
        if (brut === null) continue; // raccourci sans longueur : il ne déclare aucune taille
        const px = borneHauteEnPx(brut, tokens);
        const sel = cleDeRegle(selecteurs);
        if (px === null) sites.push({ file: f.rel, ref: `${sel} :: ${prop} :: INDÉCIDABLE (${brut})` });
        else if (px >= SEUIL_GRAND_TITRE_PX) sites.push({ file: f.rel, ref: `${sel} :: ${prop} :: ${px}px` });
      }
    }
  }
  return sites;
}

/** Neutralise commentaires bloc et ligne en préservant les positions — un `style={{…}}` cité en
 *  prose n'est pas du markup. */
const sansCommentaires = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_m, p: string) => p + ' ');

/** Fin de l'expression `{…}` ouverte en `i` (chaînes et gabarits neutralisés). */
function finExpression(src: string, i: number): number {
  let prof = 0;
  let quote: string | null = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (quote) { if (c === quote && src[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return k; }
  }
  return -1;
}

/** Découpe une liste `a, b, c` au niveau 0 (accolades, crochets, parenthèses et chaînes exclus). */
function membres(src: string): string[] {
  const out: string[] = [];
  let prof = 0;
  let quote: string | null = null;
  let courant = '';
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (quote) { courant += c; if (c === quote && src[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; courant += c; continue; }
    if ('{[('.includes(c)) prof++;
    else if ('}])'.includes(c)) prof--;
    if (c === ',' && prof === 0) { out.push(courant.trim()); courant = ''; continue; }
    courant += c;
  }
  if (courant.trim()) out.push(courant.trim());
  return out;
}

/** La balise porteuse et sa première classe LITTÉRALE, lues en amont du `style=`. */
function porteur(src: string, at: number): string {
  const avant = src.slice(0, at);
  const ouvre = avant.lastIndexOf('<');
  if (ouvre < 0) return '?';
  const balise = /^<([A-Za-z][\w.]*)/.exec(avant.slice(ouvre))?.[1] ?? '?';
  const classe = /className\s*=\s*[{`"']*\s*([a-zA-Z][\w-]*)/.exec(avant.slice(ouvre))?.[1];
  return classe ? `${balise}.${classe}` : balise;
}

/**
 * Sites de STYLE INLINE. La SEULE forme légale est un littéral d'objet dont toutes les clés sont des
 * variables CSS (`'--x'`), avec ou sans `as CSSProperties` final. Tout le reste est un site :
 * `expr` pour une valeur non littérale (`style={s}`, `style={c ? {…} : undefined}`, `{{ ...base }}`),
 * `vide` pour `style={{}}`, la liste TRIÉE des clés sinon.
 */
export function sitesStyleInline(fichiers: readonly Fichier[]): Site[] {
  const sites: Site[] = [];
  for (const f of fichiers) {
    const src = sansCommentaires(f.text);
    const re = /\bstyle\s*=\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const ouvre = m.index + m[0].length - 1;
      const ferme = finExpression(src, ouvre);
      if (ferme < 0) continue;
      const expr = src.slice(ouvre + 1, ferme).trim();
      const ref = refDeStyleInline(expr, src, ouvre, ferme);
      if (ref) sites.push({ file: f.rel, ref: `${porteur(src, m.index)} :: ${ref}` });
    }
  }
  return sites;
}

/** La réf du site, ou `null` quand la forme est LÉGALE (toutes les clés sont des variables CSS). */
function refDeStyleInline(expr: string, src: string, ouvre: number, ferme: number): string | null {
  if (!expr.startsWith('{')) return 'expr';
  const debutObjet = src.indexOf('{', ouvre + 1);
  const finObjet = finExpression(src, debutObjet);
  if (finObjet < 0) return 'expr';
  const apres = src.slice(finObjet + 1, ferme).trim();
  // `as CSSProperties` est une ANNOTATION, pas une valeur — la forme des deux sites canoniques.
  if (apres && !/^as\s+[\w.<>[\]| ]+$/.test(apres)) return 'expr';
  const entrees = membres(src.slice(debutObjet + 1, finObjet));
  if (entrees.length === 0) return 'vide';
  const cles: string[] = [];
  for (const e of entrees) {
    if (e.startsWith('...')) return 'expr';
    const brut = /^(['"])(.*?)\1\s*:/.exec(e)?.[2] ?? /^\[?([A-Za-z_$][\w$]*)\]?\s*:/.exec(e)?.[1];
    if (brut == null) return 'expr';
    cles.push(brut);
  }
  if (cles.every((c) => c.startsWith('--'))) return null;
  return [...cles].sort().join(',');
}

/** Les trois collections mesurées sur le corpus RÉEL. */
export function mesureCssCouches(): { identite: Site[]; espacement: Site[]; inline: Site[] } {
  const feuilles = feuillesDeStyle();
  const ecrans = modulesDEcran(feuilles);
  const layout = feuilles.filter((f) => f.rel === 'src/ui/styles/layout.css');
  return {
    identite: sitesIdentiteEcran(ecrans),
    espacement: sitesEspacementHorsEchelle([...ecrans, ...layout]),
    inline: sitesStyleInline(readCorpus(['src/ui'], { exts: ['.tsx'] })),
  };
}

/** Motifs de refus des trois volets (dernière phrase de `refusDeCroissance`, `stock.mjs`). */
export const MOTIF_IDENTITE =
  "Une classe d'écran qui PEINT se corrige en portant son aspect dans le module de sa primitive, elle ne s'entérine pas ici.";
export const MOTIF_ESPACEMENT =
  "Un espacement se pose sur l'échelle `var(--sp-*)` de base.css, il ne s'entérine pas ici.";
export const MOTIF_INLINE =
  "Une géométrie calculée se pose en VARIABLE CSS consommée par une classe (patron `.swatch`), elle ne s'entérine pas ici.";

/** La RÉGÉNÉRATION de `cssCouchesStock.mjs`, ses trois collections sur UNE mesure (par défaut, celle du
 *  corpus réel). Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/cssCouchesAudit.ts [--check] [--amorce]`. */
export const regenerations = (mesure: ReturnType<typeof mesureCssCouches> = mesureCssCouches()): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL('./cssCouchesStock.mjs', import.meta.url)),
  politique: DECROISSANT,
  collections: [
    { nom: 'CSS_IDENTITE_ECRAN_RATCHET', sites: mesure.identite, motif: MOTIF_IDENTITE },
    { nom: 'CSS_ESPACEMENT_RATCHET', sites: mesure.espacement, motif: MOTIF_ESPACEMENT },
    { nom: 'STYLE_INLINE_RATCHET', sites: mesure.inline, motif: MOTIF_INLINE },
  ],
}];
