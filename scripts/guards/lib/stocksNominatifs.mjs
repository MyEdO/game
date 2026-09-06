// CROISSANCE D'UN STOCK NOMINATIF dans un diff. Un stock est une DETTE qui va vers zéro : il
// DÉCROÎT. Un stock qui naît ou grossit est une exemption de plus, et l'ajout d'une ligne y est
// toujours le chemin le plus court pour rendre une CI verte — c'est exactement ce que le cliquet
// doit rendre visible (même raison que l'interdit du PLAFOND en tête de `stock.mjs`).
//
// CE QU'EST UN STOCK : ce que le REGISTRE déclare (`scripts/hooks/stocks.json`, schéma et rôles en
// tête de `stocksRegistre.mjs`). Cette lib ne devine rien : elle prend les DÉCLARATIONS d'un
// fichier et compte ce qu'elles désignent, selon leur `forme` —
//   · `liste` : les ÉLÉMENTS du tableau (enveloppes d'identité traversées) ;
//   · `objet` : les PROPRIÉTÉS, une propriété à valeur de tableau étant une RUBRIQUE où l'on
//     descend ; la CLÉ est quelconque — un stock keyé par type de document ou par catégorie compte
//     comme un stock keyé par chemin ;
//   · `plafond` : la VALEUR, dont la croissance est la MONTÉE (`41` → `42` = `+1`).
// Un `descripteur` et un `derive` ne sont JAMAIS comptés.
//
// LA CLÉ d'une croissance est `<fichier>#<LIAISON>` — c'est elle que le message DÉCLARE
// (`CLIQUET: scripts/guards/lib/structuresStock.mjs#STRUCTURES_ORPHELINES +2 — motif`). Un fichier
// porte souvent plusieurs stocks (8 dans `structuresStock.mjs`, 4 dans `rollSeamWhitelist.mjs`) :
// un net par FICHIER laisserait « +1 ici, −1 là » se compenser en silence.
//
// FRONTIÈRE (celle de `stock.mjs`) : cette lib CALCULE, le VERDICT appartient à l'appelant — le
// garde de solde (au commit) et les portes a posteriori (dernier commit, plage poussée) décident,
// avec quel message et sous quelle dérogation.
//
// DEUX VOIES. NOMINALE : l'image du fichier est lisible, les déclarations y posent leurs entrées, et
// une ligne du diff ne compte que si elle en porte une — la clé nomme alors la LIAISON. REPLI : sans
// image lisible (fichier supprimé, binaire, dialecte hors `DIALECTE`, appelant qui n'en fournit
// pas), `estEntreeDeStock` juge la LIGNE seule, l'entrée COMPTE et la clé se réduit au FICHIER : la
// porte perd la liaison, jamais sa vue. Les deux appelants de production fournissent l'image
// (`plageStock.mjs`, `solde-ticket-guard.mjs`).
//
// CE QUE LA RÈGLE MESURE MAL, par construction, et qui doit se lire ici plutôt que se découvrir :
//   · plusieurs entrées sur UNE ligne = SOUS-COMPTAGE (la ligne compte pour une), jamais une cécité :
//     la croissance reste vue, son ampleur est minorée ;
//   · une entrée MULTILIGNE vit à la ligne de son PREMIER caractère : un diff qui n'ajoute que des
//     lignes internes d'une entrée déjà là ne compte rien — un `plafond`, lui, se mesure sur la
//     VALEUR et échappe à cette borne ;
//   · le REPLI ne voit ni accolade ouvrante ni entrée multiligne : ce qu'il rate, il le rate en
//     silence, et c'est le prix d'une image illisible.
import {
  CHEMIN, CHEMIN_REGISTRE, NOM_NU, chargerRegistre, cleDeStock, declarationsParFichier,
  liaisonsDuFichier, parserRegistre,
} from './stocksRegistre.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { MOTIF_MIN } from './stock.mjs'

export { MOTIF_MIN };

/** Un jeton d'entrée entre quotes : `:ligne`/`:symbole` et balise commentée DANS la chaîne
 *  (`'src/ui/X.test.tsx // div'`) tolérés. Sans espace dans le chemin : une PROSE qui cite un
 *  chemin au milieu d'une phrase entre quotes n'est pas une entrée. */
const JETON = String.raw`['"\`](?:${CHEMIN}|${NOM_NU})(?::[\w.|:-]+)?(?:\s+\/\/\s*[^'"\`]*)?['"\`]`;

/**
 * Une ENTRÉE littérale de stock au REPLI, DEUX formes — la ligne entière fait foi dans les deux cas :
 *   · le jeton OUVRE la ligne : élément de liste/Set (`'src/x.test.ts',`), clé d'objet
 *     (`'criticals.json': 'raison',`), ou tuple dont il est la clé (`['src/x.ts', { n: 32, … }],`) ;
 *   · le jeton FERME un tuple crocheté (`['CritEscalation', 'onRepeat', 'src/x.ts:325'],`).
 */
const ENTREE_EN_TETE = new RegExp(String.raw`^\s*\[?\s*${JETON}\s*(?:[,:][^\n]*)?$`);
const ENTREE_EN_QUEUE = new RegExp(String.raw`^\s*\[[^\n]*${JETON}\s*\][,;]?\s*(?:\/\/[^\n]*)?$`);

/** La ligne (sans son marqueur de diff) est-elle une entrée littérale de stock ? REPLI de la porte :
 *  il ne se joue que sur un fichier dont l'IMAGE ne se lit pas, et juge la ligne pour elle seule. */
export function estEntreeDeStock(ligne) {
  const l = String(ligne ?? '');
  return ENTREE_EN_TETE.test(l) || ENTREE_EN_QUEUE.test(l);
}

/**
 * Les ENTRÉES d'une IMAGE, par ligne croissante — celles des `declarations` reçues, chacune nommant
 * la sienne. `null` quand le dialecte n'a pas d'AST ici (le REPLI de ligne juge alors seul).
 * QUELLES déclarations comptent est la décision de l'APPELANT, et elle vit à UN endroit :
 * `croissanceDesStocks` ne retient que le `role: 'stock'`.
 * @param {string} source @param {string} chemin
 * @param {{ liaison: string, forme: string, role: string }[]} declarations
 * @returns {{ ligne: number, liaison: string }[] | null}
 */
export function entreesDeStock(source, chemin, declarations = []) {
  const liaisons = liaisonsDuFichier(source, chemin);
  if (!liaisons) return null;
  const parNom = new Map(liaisons.map((l) => [l.liaison, l]));
  const out = [];
  for (const d of declarations) {
    if (d.forme === 'plafond') continue;
    const l = parNom.get(d.liaison);
    if (!l) continue;
    for (const ligne of l.entrees) out.push({ ligne, liaison: d.liaison });
  }
  return out.sort((a, b) => a.ligne - b.ligne);
}

/**
 * La VALEUR de chaque `plafond` des `declarations` reçues (même contrat qu'`entreesDeStock` : le tri
 * par rôle appartient à l'appelant).
 * @returns {Map<string, number>}
 */
export function plafondsDeStock(source, chemin, declarations = []) {
  const liaisons = liaisonsDuFichier(source, chemin);
  const parNom = new Map((liaisons ?? []).map((l) => [l.liaison, l]));
  const out = new Map();
  for (const d of declarations) {
    if (d.forme !== 'plafond') continue;
    const valeur = parNom.get(d.liaison)?.valeur;
    if (typeof valeur === 'number') out.set(d.liaison, valeur);
  }
  return out;
}

/** Image d'un fichier telle que l'appelant la fournit, ou `null` (lecteur absent, fichier supprimé,
 *  binaire) : le REPLI de ligne juge alors, et l'entrée COMPTE. */
function imageDe(lire, fichier) {
  if (typeof lire !== 'function') return null;
  try {
    const source = lire(fichier);
    return typeof source === 'string' ? source : null;
  } catch { return null; }
}

/** Ligne → liaison, pour les entrées déclarées d'une image. `null` = image illisible. */
function liaisonParLigne(source, fichier, declarations) {
  if (source === null) return null;
  try {
    const entrees = entreesDeStock(source, fichier, declarations);
    return entrees && new Map(entrees.map((e) => [e.ligne, e.liaison]));
  } catch { return null; }
}

/** En-têtes de diff qui ne portent ni contenu ni numérotation. */
const ENTETE_INERTE =
  /^(?:diff --git |--- |index |old mode |new mode |similarity |dissimilarity |rename |copy |new file mode |deleted file mode |Binary files |GIT binary patch|\\)/;

/** La clé d'une croissance : la LIAISON quand la porte la connaît, le FICHIER au repli. */
const cleDe = (fichier, liaison) => (liaison === null ? fichier : `${fichier}#${liaison}`);

/**
 * Croissance NETTE des stocks DÉCLARÉS d'un diff unifié (`-U0` ou non : seuls les `+`/`-` comptent).
 * Une clé n'est rendue que si ses entrées AJOUTÉES dépassent ses entrées RETIRÉES, ou si son
 * `plafond` MONTE.
 *
 * Les lignes AJOUTÉES se lisent sur le POST-IMAGE (`lirePostImage(chemin)`), les RETIRÉES sur le
 * PRÉ-IMAGE (`lirePreImage(chemin)`) — sans quoi le retrait d'une fixture compenserait l'ajout d'une
 * vraie entrée. Les deux lecteurs sont fournis par l'appelant : la lib reste PURE.
 * @param {string} diffU0
 * @param {{ lirePostImage?: (chemin: string) => string | null,
 *           lirePreImage?: (chemin: string) => string | null,
 *           registre?: { entrees: object[] } }} [images] `registre` = le registre à lire (défaut :
 *   celui du dépôt, chargé À LA DEMANDE — un diff sans en-tête de fichier ne le charge pas).
 * @returns {{ cle: string, fichier: string, liaison: string | null, seule: boolean,
 *   ajoutees: number, retirees: number, net: number, exemples: string[] }[]} trié par clé ;
 *   `exemples` = jusqu'à 3 entrées ajoutées, telles qu'écrites ; `seule` = ce fichier ne porte
 *   qu'UNE liaison déclarée, un cliquet peut donc le nommer sans sa liaison.
 * @throws {TypeError} si le diff n'est pas une CHAÎNE : la signature est POSITIONNELLE, et un appel
 *   en objet (`croissanceDesStocks({ diff })`) stringifiait `[object Object]` — donc `[]` sur TOUS
 *   les commits, y compris sur des croissances réelles. Un juge a publié ce faux zéro le 2026-09-04
 *   (revue de palier n°4, trouvaille 5) : la lib ne peut pas distinguer un diff vide d'un appel mal
 *   formé, elle refuse donc de deviner.
 */
export function croissanceDesStocks(diffU0, { lirePostImage = null, lirePreImage = null, registre = null } = {}) {
  if (typeof diffU0 !== 'string') {
    throw new TypeError(
      `croissanceDesStocks(diffU0, images) attend le diff en CHAÎNE, reçu ${typeof diffU0} `
      + '— la signature est POSITIONNELLE : croissanceDesStocks(diff, { lirePostImage, lirePreImage })',
    );
  }
  let parFichierDeclare = null;
  const declarationsDe = (chemin) => {
    parFichierDeclare ??= declarationsParFichier(registre ?? chargerRegistre());
    return (parFichierDeclare.get(chemin) ?? []).filter((d) => d.role === 'stock');
  };
  let registreTouche = false;
  /** @type {Map<string, { declarations: object[], ajoutees: { texte: string, ligne: number }[],
   *   retirees: { texte: string, ligne: number }[] }>} */
  const parFichier = new Map();
  let courant = null;
  let numAncien = 0;
  let numNouveau = 0;
  for (const brute of diffU0.split('\n')) {
    const ligne = brute.replace(/\r$/, '');
    const entete = /^\+\+\+ (?:b\/)?(.+)$/.exec(ligne);
    if (entete) {
      const chemin = entete[1].trim().replace(/\\/g, '/');
      if (chemin === CHEMIN_REGISTRE) registreTouche = true;
      courant = chemin !== '/dev/null' && declarationsDe(chemin).length > 0 ? chemin : null;
      numAncien = 0;
      numNouveau = 0;
      continue;
    }
    const hunk = /^@@+ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(ligne);
    if (hunk) {
      numAncien = Number(hunk[1]);
      numNouveau = Number(hunk[2]);
      continue;
    }
    if (ENTETE_INERTE.test(ligne)) continue;
    if (!courant) continue;
    const ajout = ligne.startsWith('+');
    const retrait = ligne.startsWith('-');
    if (!ajout && !retrait) {
      // Ligne de CONTEXTE : elle existe des deux côtés et fait avancer les deux numérotations.
      numAncien += 1;
      numNouveau += 1;
      continue;
    }
    const numero = ajout ? numNouveau++ : numAncien++;
    const touchee = { texte: ligne.slice(1).trim(), ligne: numero };
    if (!parFichier.has(courant)) {
      parFichier.set(courant, { declarations: declarationsDe(courant), ajoutees: [], retirees: [] });
    }
    const compte = parFichier.get(courant);
    if (ajout) compte.ajoutees.push(touchee);
    else compte.retirees.push(touchee);
  }
  const out = [];
  // RÉTROGRADATION AU REGISTRE : faire passer une liaison de `stock` à `descripteur`/`derive` éteint
  // son comptage — c'est le chemin le plus court pour « solder » une dette, et il doit se DIRE comme
  // une croissance. Le registre n'est pas un stock ; ce qui est compté ici, c'est la PERTE DE VUE.
  if (registreTouche) {
    const lu = (lire) => {
      const brut = imageDe(lire, CHEMIN_REGISTRE);
      if (brut === null) return null;
      try { return parserRegistre(brut, CHEMIN_REGISTRE); } catch { return null; }
    };
    const avant = lu(lirePreImage);
    const apres = lu(lirePostImage);
    if (avant && apres) {
      const roleApres = new Map(apres.entrees.map((e) => [cleDeStock(e), e.role]));
      for (const e of avant.entrees) {
        if (e.role !== 'stock') continue;
        const cle = cleDeStock(e);
        const suite = roleApres.get(cle);
        if (suite === undefined || suite === 'stock') continue;
        out.push({
          cle: `${CHEMIN_REGISTRE}#${cle}`, fichier: CHEMIN_REGISTRE, liaison: cle, seule: false,
          ajoutees: 1, retirees: 0, net: 1, exemples: [`${cle} : stock → ${suite}`],
        });
      }
    }
  }
  for (const [fichier, { declarations, ajoutees, retirees }] of parFichier) {
    // Un cliquet peut nommer le FICHIER SEUL quand ce fichier ne porte QU'UNE liaison déclarée : la
    // clé y désigne alors la même chose, et l'histoire déjà poussée est écrite dans cette graphie.
    const seule = declarations.length === 1;
    const post = imageDe(lirePostImage, fichier);
    const pre = imageDe(lirePreImage, fichier);
    const surPost = liaisonParLigne(post, fichier, declarations);
    const surPre = liaisonParLigne(pre, fichier, declarations);
    if (surPost === null && surPre === null) {
      // REPLI : la ligne juge seule, la porte ne nomme que le FICHIER.
      const retenues = ajoutees.filter((t) => estEntreeDeStock(t.texte)).map((t) => t.texte);
      const perdues = retirees.filter((t) => estEntreeDeStock(t.texte)).length;
      if (retenues.length > perdues) {
        out.push({
          cle: fichier, fichier, liaison: null, seule, ajoutees: retenues.length, retirees: perdues,
          net: retenues.length - perdues, exemples: retenues.slice(0, 3),
        });
      }
      continue;
    }
    /** @type {Map<string, { ajoutees: string[], retirees: number }>} */
    const parLiaison = new Map();
    const pose = (liaison) => {
      if (!parLiaison.has(liaison)) parLiaison.set(liaison, { ajoutees: [], retirees: 0 });
      return parLiaison.get(liaison);
    };
    for (const t of ajoutees) {
      const liaison = surPost?.get(t.ligne);
      if (liaison) pose(liaison).ajoutees.push(t.texte);
    }
    for (const t of retirees) {
      const liaison = surPre?.get(t.ligne);
      if (liaison) pose(liaison).retirees += 1;
    }
    for (const [liaison, { ajoutees: retenues, retirees: perdues }] of parLiaison) {
      if (retenues.length <= perdues) continue;
      out.push({
        cle: cleDe(fichier, liaison), fichier, liaison, seule, ajoutees: retenues.length, retirees: perdues,
        net: retenues.length - perdues, exemples: retenues.slice(0, 3),
      });
    }
    // PLAFONDS : la croissance est la MONTÉE de la valeur, jamais une ligne de plus.
    const apres = post === null ? new Map() : plafondsDeStock(post, fichier, declarations);
    const avant = pre === null ? new Map() : plafondsDeStock(pre, fichier, declarations);
    for (const [liaison, valeur] of apres) {
      const ancienne = avant.get(liaison);
      if (typeof ancienne !== 'number' || valeur <= ancienne) continue;
      out.push({
        cle: cleDe(fichier, liaison), fichier, liaison, seule, ajoutees: valeur - ancienne, retirees: 0,
        net: valeur - ancienne, exemples: [`${liaison} ${ancienne} → ${valeur}`],
      });
    }
  }
  return out.sort((a, b) => parUnitesDeCode(a.cle, b.cle));
}

/**
 * Cliquets DÉCLARÉS par un message de commit : `CLIQUET: <fichier>#<LIAISON> +N — <motif>`. Le tiret
 * peut être cadratin, demi-cadratin ou trait d'union ; un motif plus court que `MOTIF_MIN` n'est pas
 * retenu (l'appelant voit alors la clé comme non couverte).
 * @param {string} message
 * @returns {{ cle: string, n: number, motif: string }[]}
 */
export function cliquetsDuMessage(message) {
  const out = [];
  for (const m of String(message ?? '').matchAll(/^[^\S\n]*CLIQUET\s*:\s*(\S+)\s*\+(\d+)\s*[—–-]\s*(.+)$/gm)) {
    const motif = m[3].trim();
    if (motif.length >= MOTIF_MIN) out.push({ cle: m[1].replace(/\\/g, '/'), n: Number(m[2]), motif });
  }
  return out;
}

/**
 * Croissances NON COUVERTES par un cliquet du message : un cliquet ne couvre une clé que s'il
 * ANNONCE LE BON COMPTE (`+N` = la croissance nette réelle) — sinon la ligne serait un tampon qui
 * survit à l'ajout suivant. Un cliquet qui nomme le FICHIER SEUL couvre la clé quand ce fichier ne
 * porte QU'UNE liaison déclarée : les deux graphies y désignent le même stock, et l'histoire déjà
 * poussée est écrite dans la première (mesuré : 5 des 7 refus de `a527272d3..HEAD` en viennent).
 * @param {{ diff: string, message: string }} p
 * @param {Parameters<typeof croissanceDesStocks>[1]} [images]
 */
export function croissancesNonCouvertes({ diff, message }, images) {
  const cliquets = cliquetsDuMessage(message);
  return croissanceDesStocks(diff, images)
    .map((c) => {
      const pourCetteCle = cliquets.filter((k) => k.cle === c.cle || (c.seule && k.cle === c.fichier));
      const couvert = pourCetteCle.some((k) => k.n === c.net);
      return couvert ? null : { ...c, declare: pourCetteCle.length ? pourCetteCle[0].n : null };
    })
    .filter(Boolean);
}

/** Refus lisible d'une croissance : ce qui a grossi, de combien, trois exemples, et le geste. */
export function raisonDeRefus(croissances) {
  const lignes = croissances.map((c) => {
    const compte = `+${c.net} entrée(s) nette(s) (${c.ajoutees} ajoutée(s), ${c.retirees} retirée(s))`;
    const declare = c.declare === null || c.declare === undefined ? '' : ` — le message annonce \`+${c.declare}\`, pas +${c.net}`;
    return `${c.cle} : ${compte}${declare} — ex. ${c.exemples.join(' · ')}`;
  });
  return (
    `⛔ STOCK NOMINATIF qui NAÎT ou GRANDIT : ${lignes.join(' || ')}. Un stock nominatif est une ` +
    "DETTE vers zéro, jamais un registre : retirer l'entrée, ou porter la règle dans le socle pour " +
    "qu'aucune entrée ne soit nécessaire. Si la croissance est délibérée, le message de commit la " +
    'DIT : `CLIQUET: <fichier>#<LIAISON> +N — <motif>` (motif d’au moins ' + MOTIF_MIN + ' caractères). '
    + "`+N` compte les ENTRÉES du stock déclaré — ses éléments, ses propriétés ou la MONTÉE de son "
    + "plafond —, jamais ce qu'elles dénombrent."
  );
}
