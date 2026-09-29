// PARSEUR et MESURE PURE des TROIS COUCHES CSS (#1800) — sans disque : il LIT du texte et rend des
// règles, des déclarations, deux prédicats, et les sites d'IDENTITÉ et d'ESPACEMENT d'une IMAGE
// `{ fichiers, manifeste, partagees, reutilises }` — partitionnée en STOCK (modules d'écran et
// `layout.css`) et zone EXEMPTE (`modulesExemptes`, #1806 L1), puis VENTILÉE d'un parent à son commit
// (`ventiler`, #1806 D6″). Le VERDICT appartient aux gardes (`src/ui/ui-ratchets.test.ts`,
// `reclassementCss.mjs`) ; la LECTURE des images (disque, ref git, index) et des imports qui fixent
// `reutilises` à `cssImages.mjs`. Pur `.mjs` parce que les hooks de commit et de push le chargent sous
// `node` nu (#1806).
//
// Pourquoi un LEXER et pas une regex : la regex plate `([^{}]+)\{([^{}]*)\}` ne voit pas les blocs
// IMBRIQUÉS — elle rend le CONTENU d'un `@media` comme s'il vivait au premier niveau, et perd donc
// le contexte. Un contexte n'est pas un abri : `@media (max-width:700px) { .x { font-size:12px } }`
// déclare autant d'identité qu'au premier niveau. Le lexer empile les préludes `@media`/`@supports`/
// `@container` et les rend dans `media` ; il SAUTE `@keyframes`/`@font-face`/`@property`/
// `@counter-style`, dont le corps n'est pas fait de sélecteurs (`from`/`to`/pourcentages).
//
// CONTRAT partagé avec le cliquet (xx) : `reglesCss` rend le MÊME `{ selecteurs, corps }` qu'avant
// la réécriture, enrichi de `media`.

import { SUFFIXE_SUITE } from './fichierVitest.mjs';

/** Feuilles PARTAGÉES de `src/ui/styles/` : aucune primitive ne les possède, aucun module d'écran
 *  n'en fait partie. Source UNIQUE — `SHARED_CSS_FILES` (ui-ratchets), `CSS_PARTAGES`
 *  (`build-primitives.mjs`) et `feuillesPartageesDe` (la liste lue dans une image) en dérivent. */
export const FEUILLES_PARTAGEES = [
  'src/ui/styles/base.css',
  'src/ui/styles/components.css',
  'src/ui/styles/tabs.css',
  'src/ui/styles/layout.css',
];

/** Couche des modules de style de `src/ui`. */
export const RACINE_DES_MODULES = 'src/ui/styles/';

/** Zone d'un chemin : ses deux premiers segments (`src/ui/`, `src/gameIso/`). */
const zoneDe = (chemin) => `${String(chemin).split('/').slice(0, 2).join('/')}/`;

/**
 * Un module de primitive vit dans `RACINE_DES_MODULES`, ou — pour une primitive qui n'habite pas
 * `src/ui` — dans la ZONE de son `fichier` (#1806 A3). Tout autre chemin sort de la couche.
 * @param {string} fichier @param {string} css @returns {boolean}
 */
export function moduleHorsCouche(fichier, css) {
  if (!String(css).endsWith('.css')) return true;
  if (String(css).startsWith(RACINE_DES_MODULES)) return false;
  const zone = zoneDe(fichier);
  return zone === 'src/ui/' || !String(css).startsWith(zone);
}

/** At-rules dont le corps ne porte PAS de sélecteurs : leur bloc entier est sauté. */
const AT_SANS_SELECTEURS = /^@(keyframes|-webkit-keyframes|font-face|property|counter-style)\b/;

/** Neutralise les commentaires `/* … *\/` en préservant les positions (espaces et sauts de ligne). */
const sansCommentaires = (texte) =>
  texte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/**
 * Règles d'une feuille, à TOUTE profondeur.
 * @param {string} texte
 * @returns {{ selecteurs: string[], corps: string, media: string | null }[]} `media` = les préludes
 *   at-rule empilés, joints par ` && ` (`null` au premier niveau).
 */
export function reglesCss(texte) {
  const src = sansCommentaires(texte);
  /** @type {{ selecteurs: string[], corps: string, media: string | null }[]} */
  const out = [];
  /** @type {string[]} */
  const contexte = [];
  let tampon = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      tampon += c;
      if (c === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; tampon += c; continue; }
    if (c === '{') {
      const tete = tampon.trim().replace(/\s+/g, ' ');
      tampon = '';
      if (tete.startsWith('@')) {
        if (AT_SANS_SELECTEURS.test(tete)) { i = finDeBloc(src, i); continue; }
        contexte.push(tete);
        continue;
      }
      // Règle : son corps court jusqu'à sa propre accolade fermante.
      const fin = finDeBloc(src, i);
      const selecteurs = decoupeSelecteurs(tete);
      if (selecteurs.length) {
        out.push({ selecteurs, corps: src.slice(i + 1, fin), media: contexte.length ? contexte.join(' && ') : null });
      }
      i = fin;
      continue;
    }
    if (c === '}') { contexte.pop(); tampon = ''; continue; }
    // At-rule DÉCLARATION (`@import …;`, `@charset …;`) : elle se clôt sur `;`, sans bloc — le tampon
    // repart à zéro, sans quoi son prélude se collerait à la tête de la règle suivante.
    if (c === ';') { tampon = ''; continue; }
    tampon += c;
  }
  return out;
}

/**
 * Découpe une LISTE de sélecteurs sur ses virgules de NIVEAU 0 : celles d'un `:has()`/`:is()`/
 * `:not()`/`:where()` séparent des arguments, pas des sélecteurs — `label:has(> a, > .btn)` est UN
 * sélecteur, et le couper en deux inventait une règle fantôme (`> .btn)`) tout en perdant la vraie.
 * @param {string} tete @returns {string[]}
 */
export function decoupeSelecteurs(tete) {
  const out = [];
  let prof = 0;
  let courant = '';
  let quote = null;
  for (let k = 0; k < tete.length; k++) {
    const c = tete[k];
    if (quote) { courant += c; if (c === quote && tete[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; courant += c; continue; }
    if (c === '(' || c === '[') prof++;
    else if (c === ')' || c === ']') prof--;
    else if (c === ',' && prof === 0) { out.push(courant); courant = ''; continue; }
    courant += c;
  }
  out.push(courant);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Index de l'accolade fermante appairée à celle ouverte en `i`. */
function finDeBloc(src, i) {
  let prof = 0;
  let quote = null;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (quote) { if (c === quote && src[k - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return k; }
  }
  return src.length;
}

/**
 * Déclarations d'un corps de règle. Les `;` entre parenthèses ne séparent rien.
 * @param {string} corps @returns {{ prop: string, valeur: string }[]}
 */
export function declarations(corps) {
  const out = [];
  let prof = 0;
  let courant = '';
  const pousser = (d) => {
    const at = d.indexOf(':');
    if (at < 0) return;
    const prop = d.slice(0, at).trim();
    const valeur = d.slice(at + 1).trim();
    if (prop && valeur) out.push({ prop, valeur });
  };
  for (const c of corps) {
    if (c === '(') prof++;
    else if (c === ')') prof--;
    if (c === ';' && prof === 0) { pousser(courant); courant = ''; continue; }
    courant += c;
  }
  pousser(courant);
  return out;
}

/**
 * Corps INTERNE de la tranche `@media` dont le prélude est `requete`, accolades appariées.
 * Source UNIQUE des lectures par tranche (`src/ui/ui-ratchets.test.ts`, `src/ui/CombatConsole.test.tsx`).
 * Une tranche ABSENTE lève : rendre `''` laissait passer au vert tout contrat qui l'interroge.
 * @param {string} css @param {string} requete @returns {string}
 */
export function mediaBlock(css, requete) {
  const at = css.indexOf(requete);
  if (at < 0) throw new Error(`tranche « ${requete} » absente de la feuille lue`);
  const ouvre = css.indexOf('{', at);
  let prof = 0;
  for (let i = ouvre; i < css.length; i++) {
    if (css[i] === '{') prof++;
    else if (css[i] === '}' && --prof === 0) return css.slice(ouvre + 1, i);
  }
  throw new Error(`tranche « ${requete} » non refermée`);
}

/**
 * La feuille PRIVÉE de toutes ses tranches `@media` : ce qui doit valoir à TOUTE largeur est là.
 * Une règle glissée dans une tranche disparaît de cette vue — c'est ce que les invariants traquent.
 * @param {string} css @returns {string}
 */
export function baseSection(css) {
  let out = css;
  for (;;) {
    const at = out.indexOf('@media');
    if (at < 0) return out;
    let prof = 0;
    let fin = out.length;
    for (let i = out.indexOf('{', at); i < out.length; i++) {
      if (out[i] === '{') prof++;
      else if (out[i] === '}' && --prof === 0) { fin = i + 1; break; }
    }
    out = out.slice(0, at) + out.slice(fin);
  }
}

/** Propriétés de PLACEMENT nommées une à une (docs/charte-ui.md § « Architecture CSS »), sous leur
 *  nom PHYSIQUE (`physique`) ; avec les familles à préfixe ci-dessous, elles forment TOUT le
 *  placement : elles PLACENT, bornent, ferrent ou retirent une puce — elles ne PEIGNENT pas. Tout le
 *  reste est de l'IDENTITÉ et appartient à une primitive. `cursor` est de l'identité : l'affordance est
 *  la matière d'un contrôle. */
export const PROPRIETES_DE_PLACEMENT = new Set([
  'display', 'flex', 'grid', 'gap', 'row-gap', 'column-gap', 'order',
  'position', 'inset', 'top', 'right', 'bottom', 'left', 'z-index',
  'width', 'height', 'aspect-ratio', 'box-sizing',
  'margin', 'padding', 'overflow', 'float', 'clear', 'columns',
  'transform', 'transform-origin', 'translate', 'rotate', 'scale',
  'text-align', 'vertical-align', 'white-space', 'text-overflow', 'overflow-wrap', 'word-break', 'hyphens',
  'visibility', 'pointer-events', 'touch-action', 'user-select', 'resize',
  /* `contain` et `container` sont de la même famille : ils déclarent une PORTÉE de mise en page —
     ce sur quoi une boîte se mesure —, jamais une matière. Une rangée qui se déclare conteneur de
     requête (`container-type: size`) donne à ses surfaces un repère à elles ; c'est du placement,
     et c'est l'écran qui compose les rangées. */
  'isolation', 'contain', 'container', 'will-change', 'list-style',
  /* Multicolonne et puce : la GÉOMÉTRIE seule. Le filet (`column-rule*`) et l'image de puce
     (`list-style-image`) peignent — ils restent de l'identité. */
  'column-count', 'column-width', 'column-span', 'column-fill',
  'list-style-type', 'list-style-position',
]);

/** Familles de PLACEMENT à préfixe (`flex-grow`, `grid-template-columns`, `padding-top`…) : une
 *  famille n'entre ici que si AUCUN de ses membres ne peint. */
const PREFIXES_DE_PLACEMENT = [
  'container-',
  'flex-', 'grid-', 'place-', 'align-', 'justify-', 'inset-', 'min-', 'max-',
  'margin-', 'padding-', 'overflow-', 'overscroll-', 'scroll-',
];

/** Les propriétés LOGIQUES de CSS (mdn-data 2.27.1, `css/properties.json`) et leur équivalent
 *  PHYSIQUE en écriture horizontale : table FERMÉE, une paire par propriété. */
const EQUIVALENT_PHYSIQUE = new Map([
  ['block-size', 'height'], ['border-block', 'border-top'], ['border-block-color', 'border-top-color'],
  ['border-block-end', 'border-bottom'], ['border-block-end-color', 'border-bottom-color'],
  ['border-block-end-style', 'border-bottom-style'], ['border-block-end-width', 'border-bottom-width'],
  ['border-block-start', 'border-top'], ['border-block-start-color', 'border-top-color'],
  ['border-block-start-style', 'border-top-style'], ['border-block-start-width', 'border-top-width'],
  ['border-block-style', 'border-top-style'], ['border-block-width', 'border-top-width'],
  ['border-end-end-radius', 'border-bottom-right-radius'],
  ['border-end-start-radius', 'border-bottom-left-radius'], ['border-inline', 'border-left'],
  ['border-inline-color', 'border-left-color'], ['border-inline-end', 'border-right'],
  ['border-inline-end-color', 'border-right-color'], ['border-inline-end-style', 'border-right-style'],
  ['border-inline-end-width', 'border-right-width'], ['border-inline-start', 'border-left'],
  ['border-inline-start-color', 'border-left-color'], ['border-inline-start-style', 'border-left-style'],
  ['border-inline-start-width', 'border-left-width'], ['border-inline-style', 'border-left-style'],
  ['border-inline-width', 'border-left-width'], ['border-start-end-radius', 'border-top-right-radius'],
  ['border-start-start-radius', 'border-top-left-radius'],
  ['contain-intrinsic-block-size', 'contain-intrinsic-height'],
  ['contain-intrinsic-inline-size', 'contain-intrinsic-width'],
  ['corner-block-end-shape', 'corner-bottom-shape'], ['corner-block-start-shape', 'corner-top-shape'],
  ['corner-inline-end-shape', 'corner-right-shape'], ['corner-inline-start-shape', 'corner-left-shape'],
  ['inline-size', 'width'], ['inset-block', 'top'], ['inset-block-end', 'bottom'],
  ['inset-block-start', 'top'], ['inset-inline', 'left'], ['inset-inline-end', 'right'],
  ['inset-inline-start', 'left'], ['margin-block', 'margin-top'], ['margin-block-end', 'margin-bottom'],
  ['margin-block-start', 'margin-top'], ['margin-inline', 'margin-left'],
  ['margin-inline-end', 'margin-right'], ['margin-inline-start', 'margin-left'],
  ['max-block-size', 'max-height'], ['max-inline-size', 'max-width'], ['min-block-size', 'min-height'],
  ['min-inline-size', 'min-width'], ['overflow-block', 'overflow-y'], ['overflow-inline', 'overflow-x'],
  ['overscroll-behavior-block', 'overscroll-behavior-y'],
  ['overscroll-behavior-inline', 'overscroll-behavior-x'], ['padding-block', 'padding-top'],
  ['padding-block-end', 'padding-bottom'], ['padding-block-start', 'padding-top'],
  ['padding-inline', 'padding-left'], ['padding-inline-end', 'padding-right'],
  ['padding-inline-start', 'padding-left'], ['scroll-margin-block', 'scroll-margin-top'],
  ['scroll-margin-block-end', 'scroll-margin-bottom'], ['scroll-margin-block-start', 'scroll-margin-top'],
  ['scroll-margin-inline', 'scroll-margin-left'], ['scroll-margin-inline-end', 'scroll-margin-right'],
  ['scroll-margin-inline-start', 'scroll-margin-left'], ['scroll-padding-block', 'scroll-padding-top'],
  ['scroll-padding-block-end', 'scroll-padding-bottom'],
  ['scroll-padding-block-start', 'scroll-padding-top'], ['scroll-padding-inline', 'scroll-padding-left'],
  ['scroll-padding-inline-end', 'scroll-padding-right'],
  ['scroll-padding-inline-start', 'scroll-padding-left'],
]);

/**
 * Le nom PHYSIQUE d'une propriété (`EQUIVALENT_PHYSIQUE`) : une propriété logique se classe comme son
 * équivalent physique ; toute autre est rendue telle quelle.
 * @param {string} prop @returns {string}
 */
export const physique = (prop) => EQUIVALENT_PHYSIQUE.get(prop) ?? prop;

/** Les propriétés de la liste nommée dont la VALEUR peut porter une `<image>` (mdn-data 2.27.1,
 *  `css/properties.json` et `css/syntaxes.json`) : `list-style` par son membre `list-style-image`,
 *  `list-style-type` par `<counter-style>`, dont `symbols()` accepte `<string> | <image>`. Les autres
 *  raccourcis nommés (`flex`, `grid`, `inset`, `margin`, `padding`, `overflow`, `columns`, `container`,
 *  `gap`, `white-space`) n'ont aucun membre qui peigne. */
const PORTEURS_D_IMAGE = new Set(['list-style', 'list-style-type']);

/** Vrai si la valeur APPELLE une fonction autre que `symbols()` (`url()`, `var()`, `image-set()`, un
 *  dégradé…), chaînes et commentaires ôtés : le seul moyen d'y poser une image. */
const appelleUneImage = (valeur) =>
  [...valeur.replace(/\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '').matchAll(/([\w-]*)\(/g)]
    .some(([, nom]) => nom.toLowerCase() !== 'symbols');

/** Vrai si la DÉCLARATION place : sa propriété, classée sous son nom physique (`physique`), est nommée
 *  ou d'une famille à préfixe ; un porteur d'image (`PORTEURS_D_IMAGE`) peint dès que sa `valeur`
 *  appelle une fonction autre que `symbols()` (`appelleUneImage`), `var()` compris : une valeur
 *  indécidable peint. Une variable CSS (`--x`) est un PARAMÈTRE de primitive (patron `.swatch`), jamais
 *  une matière — elle reste hors du stock d'identité.
 *  @param {string} prop @param {string} valeur */
export const estPlacement = (prop, valeur) => {
  if (prop.startsWith('--')) return true;
  const p = physique(prop);
  if (PORTEURS_D_IMAGE.has(p) && appelleUneImage(valeur)) return false;
  return PROPRIETES_DE_PLACEMENT.has(p) || PREFIXES_DE_PLACEMENT.some((x) => p.startsWith(x));
};

/** Propriétés dont la VALEUR doit se poser sur l'échelle `--sp-*` (base.css). */
export const PROPRIETES_A_ECHELLE = new Set([
  'gap', 'row-gap', 'column-gap',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-block-start', 'padding-block-end',
  'padding-inline', 'padding-inline-start', 'padding-inline-end',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-block-start', 'margin-block-end',
  'margin-inline', 'margin-inline-start', 'margin-inline-end',
]);

/** Un littéral de longueur non nul (`12px`, `1.5rem`) — `0`, `auto`, `%`/`vw`/`vh`, `env()` et
 *  `var(--sp-*)` passent, un multiple calculé (`calc(3 * var(--sp-md))`) aussi. */
const LITTERAL_DE_LONGUEUR = /(?<![\w.#-])(\d*\.?\d+)(px|rem|em)(?![\w-])/g;

/** Vrai si la valeur contient un littéral de longueur non nul — donc hors échelle. */
export function valeurHorsEchelle(valeur) {
  LITTERAL_DE_LONGUEUR.lastIndex = 0;
  let m;
  while ((m = LITTERAL_DE_LONGUEUR.exec(valeur))) if (Number(m[1]) !== 0) return true;
  return false;
}

/** La couche LAYOUT : feuille partagée des primitives de PLACEMENT, mesurée comme un module d'écran —
 *  identité et espacement au stock (docs/charte-ui.md § « Architecture CSS »). */
export const FEUILLE_LAYOUT = 'src/ui/styles/layout.css';

/** Le manifeste des primitives, chemin UNIQUE : la frontière primitive / écran s'y lit. */
export const CHEMIN_MANIFESTE = 'src/data/primitives.manifest.json';

/** Ce fichier : la liste `FEUILLES_PARTAGEES` d'une image se lit dans SON texte (`feuillesPartageesDe`). */
export const CHEMIN_COUCHES = 'scripts/guards/lib/cssCouches.mjs';

/**
 * LECTEUR UNIQUE du manifeste d'une image. Absent → `[]` ; JSON invalide ou non-tableau → lève.
 * @param {string | null} texte @returns {{ id: string, css?: string }[]}
 */
export function manifesteDe(texte) {
  if (texte == null) return [];
  let m;
  try {
    m = JSON.parse(texte);
  } catch (e) {
    throw new Error(`${CHEMIN_MANIFESTE} illisible : ${e.message}`, { cause: e });
  }
  if (!Array.isArray(m)) throw new Error(`${CHEMIN_MANIFESTE} n'est pas un tableau`);
  return m;
}

/** La déclaration de `FEUILLES_PARTAGEES` dans le texte de `CHEMIN_COUCHES`. */
const DECLARATION_DES_PARTAGEES = /export const FEUILLES_PARTAGEES = \[([^\]]*)\]/;

/**
 * LECTEUR PUR de `FEUILLES_PARTAGEES` dans le TEXTE de `CHEMIN_COUCHES` d'une image. Absent → `[]` ;
 * texte sans la déclaration → lève.
 * @param {string | null} texte @returns {string[]}
 */
export function feuillesPartageesDe(texte) {
  if (texte == null) return [];
  const m = DECLARATION_DES_PARTAGEES.exec(sansCommentaires(texte));
  if (!m) throw new Error(`${CHEMIN_COUCHES} : déclaration \`FEUILLES_PARTAGEES\` introuvable`);
  return [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

/** Le sélecteur NORMALISÉ d'une règle : la liste telle qu'elle est écrite, espaces réduits. Le
 *  contexte `@media` n'entre PAS dans la clé — il n'est pas un abri, et l'y mettre ferait dériver
 *  le stock au moindre déplacement de breakpoint. */
export const cleDeRegle = (selecteurs) => selecteurs.join(', ').replace(/\s+/g, ' ');

/**
 * Sites d'IDENTITÉ : une déclaration qui n'est pas du PLACEMENT.
 * @param {readonly { rel: string, text: string }[]} fichiers @returns {{ file: string, ref: string }[]}
 */
export function sitesIdentiteEcran(fichiers) {
  const sites = [];
  for (const f of fichiers) {
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      const sel = cleDeRegle(selecteurs);
      for (const { prop, valeur } of declarations(corps)) {
        if (!estPlacement(prop, valeur)) sites.push({ file: f.rel, ref: `${sel} :: ${prop}` });
      }
    }
  }
  return sites;
}

/**
 * Les propriétés personnalisées d'un module qui portent une valeur HORS ÉCHELLE : un littéral de
 * longueur, ou une référence à une autre d'entre elles (clôture transitive). Leur `var()` ne ramène
 * pas une valeur à l'échelle — elle la déplace.
 * @param {string} text feuille CSS @returns {Set<string>}
 */
export function variablesHorsEchelle(text) {
  const decl = [];
  for (const { corps } of reglesCss(text)) {
    for (const { prop, valeur } of declarations(corps)) if (prop.startsWith('--')) decl.push({ prop, valeur });
  }
  const hors = new Set(decl.filter((d) => valeurHorsEchelle(d.valeur)).map((d) => d.prop));
  for (let avant = -1; avant !== hors.size;) {
    avant = hors.size;
    for (const d of decl) if (!hors.has(d.prop) && referenceUne(d.valeur, hors)) hors.add(d.prop);
  }
  return hors;
}

/** Vrai si la valeur lit (`var(--x…)`) l'une des propriétés de `noms`. */
function referenceUne(valeur, noms) {
  for (const m of valeur.matchAll(/var\(\s*(--[\w-]+)/g)) if (noms.has(m[1])) return true;
  return false;
}

/**
 * Sites d'ESPACEMENT hors échelle `--sp-*` : un littéral de longueur, ou la lecture d'une propriété
 * personnalisée du module qui en porte un (`variablesHorsEchelle`).
 * @param {readonly { rel: string, text: string }[]} fichiers @returns {{ file: string, ref: string }[]}
 */
export function sitesEspacementHorsEchelle(fichiers) {
  const sites = [];
  for (const f of fichiers) {
    const variables = variablesHorsEchelle(f.text);
    for (const { selecteurs, corps } of reglesCss(f.text)) {
      const sel = cleDeRegle(selecteurs);
      for (const { prop, valeur } of declarations(corps)) {
        if (PROPRIETES_A_ECHELLE.has(prop) && (valeurHorsEchelle(valeur) || referenceUne(valeur, variables))) {
          sites.push({ file: f.rel, ref: `${sel} :: ${prop} :: ${valeur.replace(/\s+/g, ' ')}` });
        }
      }
    }
  }
  return sites;
}

/**
 * Les modules qu'une primitive POSSÈDE (champ `css` du manifeste).
 * @param {readonly { id: string, css?: string }[]} manifeste @returns {Set<string>}
 */
export function modulesDePrimitive(manifeste) {
  return new Set(manifeste.map((e) => e.css).filter((c) => typeof c === 'string'));
}

/** Racine des importeurs comptés, et ce qui n'en est pas un : une suite de test, la galerie QC. */
const RACINE_DES_IMPORTEURS = 'src/';
const GALERIE = 'src/ui/gallery/';
const SUITE = new RegExp(`${SUFFIXE_SUITE}$`);

/** Un importeur compte-t-il pour la RÉUTILISATION d'une primitive ? */
export const importeurCompte = (chemin) =>
  chemin.startsWith(RACINE_DES_IMPORTEURS) && !chemin.startsWith(GALERIE) && !SUITE.test(chemin);

/**
 * Les `fichier` du manifeste RÉUTILISÉS (#1806 L1) : importés directement par au moins 2 fichiers de
 * `src/` (hors suites et `src/ui/gallery/`), ou par le `fichier` d'une autre entrée du manifeste.
 * `imports` = les imports DIRECTS de chaque importeur, résolus par l'appelant (`directImportsOf`,
 * `importGraph.mjs`) : la lib reste pure.
 * @param {readonly { id: string, fichier?: string }[]} manifeste
 * @param {Iterable<[string, readonly string[]]>} imports importeur → chemins importés
 * @returns {Set<string>}
 */
export function fichiersReutilises(manifeste, imports) {
  const fichiers = new Set(manifeste.map((e) => e.fichier).filter((f) => typeof f === 'string'));
  /** @type {Map<string, Set<string>>} */
  const importeurs = new Map();
  for (const [importeur, cibles] of imports) {
    if (!importeurCompte(importeur)) continue;
    for (const c of cibles) {
      if (!fichiers.has(c) || c === importeur) continue;
      if (!importeurs.has(c)) importeurs.set(c, new Set());
      importeurs.get(c).add(importeur);
    }
  }
  const out = new Set();
  for (const [f, par] of importeurs) if (par.size >= 2 || [...par].some((i) => fichiers.has(i))) out.add(f);
  return out;
}

/**
 * La zone EXEMPTE d'une image, source UNIQUE de sa frontière (#1806 L1) : les feuilles partagées de
 * SA liste hors `FEUILLE_LAYOUT`, et tout module `css` dont au moins un propriétaire est RÉUTILISÉ
 * (`fichiersReutilises`). Tout le reste est au stock.
 * @param {{ manifeste: readonly { id: string, fichier?: string, css?: string }[], partagees: readonly string[], reutilises: ReadonlySet<string> }} image
 * @returns {Set<string>}
 */
export function modulesExemptes({ manifeste, partagees, reutilises }) {
  const out = new Set();
  for (const e of manifeste) if (typeof e.css === 'string' && reutilises.has(e.fichier)) out.add(e.css);
  for (const f of partagees) if (f !== FEUILLE_LAYOUT) out.add(f);
  return out;
}

/**
 * Les modules d'ÉCRAN d'une image : son stock (`modulesExemptes` en est le complément) moins
 * `FEUILLE_LAYOUT`.
 * @param {{ fichiers: readonly { rel: string, text: string }[], manifeste: readonly { id: string, fichier?: string, css?: string }[], partagees: readonly string[], reutilises: ReadonlySet<string> }} image
 */
export function modulesDEcran(image) {
  const exempts = modulesExemptes(image);
  return image.fichiers.filter((f) => !exempts.has(f.rel) && f.rel !== FEUILLE_LAYOUT);
}

/**
 * La MÊME mesure jouée sur les deux zones d'une image. `stock` : tout ce qui n'est pas exempté —
 * modules d'écran et `FEUILLE_LAYOUT` —, ce que jugent les cliquets (xxi)/(xxii). `exempte` :
 * `modulesExemptes`.
 * @param {Parameters<typeof modulesDEcran>[0]} image
 */
export function partitionCss(image) {
  const exempts = modulesExemptes(image);
  const stock = image.fichiers.filter((f) => !exempts.has(f.rel));
  const exempte = image.fichiers.filter((f) => exempts.has(f.rel));
  return {
    stock: { identite: sitesIdentiteEcran(stock), espacement: sitesEspacementHorsEchelle(stock) },
    exempte: { identite: sitesIdentiteEcran(exempte), espacement: sitesEspacementHorsEchelle(exempte) },
  };
}

/** Les deux volets d'une mesure CSS, et leur mesure. */
const VOLETS = { identite: sitesIdentiteEcran, espacement: sitesEspacementHorsEchelle };

/** Séparateur d'une clé (fichier, réf) : aucun des deux n'en porte. */
const SEP = '\u0000';

/** Multiset (fichier, réf) des sites d'une zone. */
const clesDe = (fichiers, mesure) => {
  const m = new Map();
  for (const s of mesure(fichiers)) {
    const k = s.file + SEP + s.ref;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

/** `a − b`, en multiset, parties positives seules. */
const moins = (a, b) => {
  const out = new Map();
  for (const [k, n] of a) {
    const d = n - (b.get(k) ?? 0);
    if (d > 0) out.set(k, d);
  }
  return out;
};

const taille = (m) => [...m.values()].reduce((s, n) => s + n, 0);

/** Multiset (fichier, réf) d'entrées de stock, chaque `fichier` passé par `report`. */
const clesDEntrees = (entrees, report) => {
  const m = new Map();
  for (const e of entrees) {
    const k = report(e.fichier) + SEP + e.ref;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

/**
 * Les modules qui FRANCHISSENT la frontière du parent au commit (#1806 D1″) : exemptés au commit,
 * pas au parent, et présents dans l'image du parent.
 * @param {Parameters<typeof modulesDEcran>[0]} parent @param {typeof parent} commit
 * @returns {string[]} triés
 */
export function franchissements(parent, commit) {
  const exP = modulesExemptes(parent);
  const presents = new Set(parent.fichiers.map((f) => f.rel));
  return [...modulesExemptes(commit)].filter((m) => !exP.has(m) && presents.has(m)).sort();
}

/**
 * VENTILATION d'un commit contre son parent, par volet (#1806 D6″), en multisets clés par
 * (fichier, réf) : `SORTI` = Sb − Sh, `ENTRÉ` = Eh − Eb ; `RETOURNÉ` = la part de Sh − Sb que le
 * parent portait HORS de son stock (Eb) — les sites qu'un module rend au stock en quittant la zone
 * exempte, seuls admis par la régénération (`admisAuRetour`, #1806 C) ; `APPARU` = le reste de
 * Sh − Sb, des sites NEUFS. `RECLASSÉ` = Σ prix(m) des modules franchis (`franchissements`), consommé à la clé ;
 * `PRIMITIVISÉ` = le SORTI restant apparié à l'ENTRÉ restant par réf seule, chaque clé consommée une
 * fois ; `DISPARU` = le SORTI restant. Lieu UNIQUE du prix : la ligne `RECLASSEMENT:`
 * (`reclassementCss.mjs`) et `scripts/ui/ventilation-css-couches.mts` le lisent ici.
 * Sb est ce que le parent COMPTAIT : `stockAvant` (les entrées de son fichier de stock) quand
 * l'appelant le fournit, sinon sa mesure sous la règle en vigueur ; Eb est le reste de ses sites.
 * `renommages` (chemin au parent ↦ chemin au commit, la carte `-M`) reporte d'abord les clés du
 * parent, pour les seuls couples dont les deux chemins sont au stock (#1806 D5″).
 * @param {Parameters<typeof modulesDEcran>[0]} image @param {typeof image} commit
 * @param {{ renommages?: ReadonlyMap<string, string>,
 *   stockAvant?: Record<'identite' | 'espacement', Iterable<{ fichier: string, ref: string }>> }} [options]
 */
export function ventiler(image, commit, { renommages = new Map(), stockAvant } = {}) {
  const exAvant = modulesExemptes(image);
  const exApres = modulesExemptes(commit);
  const report = (rel) => {
    const vers = renommages.get(rel);
    return vers !== undefined && !exAvant.has(rel) && !exApres.has(vers) ? vers : rel;
  };
  const parent = { ...image, fichiers: image.fichiers.map((f) => ({ ...f, rel: report(f.rel) })) };
  const franchis = franchissements(parent, commit);
  const zones = (image) => {
    const ex = modulesExemptes(image);
    return {
      stock: image.fichiers.filter((f) => !ex.has(f.rel)),
      exempte: image.fichiers.filter((f) => ex.has(f.rel)),
    };
  };
  const zP = zones(parent);
  const zC = zones(commit);
  /** @type {Map<string, { identite: number, espacement: number }>} */
  const prix = new Map(franchis.map((m) => [m, { identite: 0, espacement: 0 }]));
  const out = {};
  for (const [v, mesure] of Object.entries(VOLETS)) {
    const Sb = stockAvant ? clesDEntrees(stockAvant[v], report) : clesDe(zP.stock, mesure);
    const Sh = clesDe(zC.stock, mesure);
    const Eb = stockAvant ? moins(clesDe(parent.fichiers, mesure), Sb) : clesDe(zP.exempte, mesure);
    const Eh = clesDe(zC.exempte, mesure);
    const sorti = moins(Sb, Sh);
    const SORTI = taille(sorti);
    const accru = moins(Sh, Sb);
    /** @type {{ fichier: string, ref: string, n: number }[]} */
    const retournes = [];
    for (const [k, n] of accru) {
      const pris = Math.min(n, Eb.get(k) ?? 0);
      if (pris) retournes.push({ fichier: k.slice(0, k.indexOf(SEP)), ref: k.slice(k.indexOf(SEP) + 1), n: pris });
    }
    const RETOURNE = retournes.reduce((t, r) => t + r.n, 0);
    const APPARU = taille(accru) - RETOURNE;
    const entre = moins(Eh, Eb);
    const ENTRE = taille(entre);
    let RECLASSE = 0;
    for (const m of franchis) {
      for (const [k, n] of sorti) {
        if (!k.startsWith(m + SEP)) continue;
        const pris = Math.min(n, entre.get(k) ?? 0);
        if (!pris) continue;
        prix.get(m)[v] += pris;
        RECLASSE += pris;
        sorti.set(k, n - pris);
        entre.set(k, entre.get(k) - pris);
      }
    }
    /** @type {Map<string, number>} réf → ENTRÉ restant, fichiers confondus. */
    const libres = new Map();
    for (const [k, n] of entre) {
      const ref = k.slice(k.indexOf(SEP) + 1);
      libres.set(ref, (libres.get(ref) ?? 0) + n);
    }
    let PRIMITIVISE = 0;
    for (const k of [...sorti.keys()].sort()) {
      const ref = k.slice(k.indexOf(SEP) + 1);
      const pris = Math.min(sorti.get(k), libres.get(ref) ?? 0);
      if (!pris) continue;
      PRIMITIVISE += pris;
      libres.set(ref, libres.get(ref) - pris);
      sorti.set(k, sorti.get(k) - pris);
    }
    out[v] = {
      stock: [taille(Sb), taille(Sh)],
      exempte: [taille(Eb), taille(Eh)],
      SORTI, APPARU, RETOURNE, ENTRE, RECLASSE, PRIMITIVISE, DISPARU: taille(sorti), retournes,
    };
  }
  return {
    identite: out.identite,
    espacement: out.espacement,
    franchis: franchis.map((module) => {
      const p = prix.get(module);
      return { module, identite: p.identite, espacement: p.espacement, n: p.identite + p.espacement };
    }),
  };
}

/**
 * Ligne lisible d'un volet ventilé : bornes du stock et de la zone exempte, puis `SORTI` =
 * `RECLASSÉ` + `PRIMITIVISÉ` + `DISPARU`, `APPARU` et `RETOURNÉ`.
 * @param {string} nom @param {ReturnType<typeof ventiler>['identite']} v @returns {string}
 */
export function ligneDeVentilation(nom, v) {
  return `${nom.padEnd(10)} stock ${v.stock[0]} → ${v.stock[1]} · exempté ${v.exempte[0]} → ${v.exempte[1]} · SORTI ${v.SORTI} = RECLASSÉ ${v.RECLASSE} + PRIMITIVISÉ ${v.PRIMITIVISE} + DISPARU ${v.DISPARU} · APPARU ${v.APPARU} · RETOURNÉ ${v.RETOURNE}`;
}

/**
 * L'ADMISSION du RETOURNÉ (`decroissantSaufRetourne`, `cssCouchesAudit.ts`, #1806 C) : parmi les entrées `mesurees`, celles que le stock de `HEAD`
 * ne comptait pas et que `HEAD` portait déjà — les `retournes` d'une ventilation `HEAD` → arbre
 * faite sur `stockDeTete`. Par clé (fichier, réf), les occurrences au-delà du compte de `stockDeTete`,
 * dans la limite du retour : un site NEUF n'est jamais admis.
 * @template {{ fichier: string, ref: string, occurrence: number }} E
 * @param {readonly E[]} mesurees @param {Iterable<{ fichier: string, ref: string }>} stockDeTete
 * @param {readonly { fichier: string, ref: string, n: number }[]} retournes @returns {E[]}
 */
export function admisAuRetour(mesurees, stockDeTete, retournes) {
  const compte = clesDEntrees(stockDeTete, (f) => f);
  const retour = new Map(retournes.map((r) => [r.fichier + SEP + r.ref, r.n]));
  return mesurees.filter((e) => {
    const k = e.fichier + SEP + e.ref;
    const avant = compte.get(k) ?? 0;
    return e.occurrence > avant && e.occurrence <= avant + (retour.get(k) ?? 0);
  });
}
