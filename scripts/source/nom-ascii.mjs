/**
 * TRANSLITTÉRATION ASCII d'un NOM de fichier ou de dossier de `Source/` (#1699) — UNE fonction, la
 * seule. Les scripts de découpe l'appellent à l'ÉCRITURE, la migration l'applique au stock existant,
 * et la garde d'hygiène de `Source/` refuse tout chemin suivi qui n'en sort pas.
 *
 * Verbatim utilisateur (2026-09-06) : « Tu sais nos fichiers aujourd'hui peuvent etre déplacé, par
 * contre les caracteres accentués c'est un soucis ».
 *
 * CE N'EST PAS UN SLUG : la casse, les espaces (double espace compris), les points, les parenthèses,
 * `&`, les tirets et l'apostrophe ASCII sont CONSERVÉS — c'est le MÊME nom, lisible, en ASCII.
 *
 * La table est FERMÉE : tout caractère qui n'est ni ASCII imprimable, ni couvert par une règle
 * ci-dessous, ni un diacritique combinant, LÈVE (nominativement). Un caractère neuf se DÉCLARE ici,
 * il n'est jamais absorbé en silence.
 *
 * Règles, dans l'ordre :
 *   0. NFC d'abord (le disque NTFS rend « Boîte » en décomposé : `i` + U+0302) ;
 *   1. `’` `‘` → `'` ; `“` `”` → `"` (préventif) ;
 *   2. `«` `»` SUPPRIMÉS avec l'espace adjacent CÔTÉ INTÉRIEUR — « L'abominable » → L'abominable
 *      (l'espace extérieur reste : il sépare deux mots du nom) ;
 *   3. `—` `–` → `-` ; `…` → `...` ;
 *   4. `œ` `Œ` → `oe` `OE` ; `æ` `Æ` → `ae` `AE` (préventif) ;
 *   5. U+FFFC (OBJECT REPLACEMENT CHARACTER, artefact d'extraction) → SUPPRIMÉ ;
 *   6. NFD puis retrait des combinants : `é` → `e`, `À` → `A`, `Ö` → `O` ;
 *   7. espaces de fin retirés (y compris avant l'extension) ; un titre de chapitre qui se VIDE
 *      (`12 - ￼.md` → `12 - .md`) devient `12 - Sans titre.md`. Le nom RESTE dans la forme
 *      canonique `NN - <titre>.md` : des scanners du dépôt la tiennent pour acquise
 *      (`scripts/raw/_lib.mjs:495`, `scripts/raw/folio-bootstrap.mjs:96`…) et `buildFolioToc`
 *      SUPPRIMERAIT de l'index un `12.md` hors forme. Le titre posé est le seul mot injecté, et il
 *      l'est parce que la forme l'exige — pas pour décrire le chapitre ;
 *   8. tout résidu hors ASCII imprimable (0x20-0x7E) → `throw` ; un nom qui se réduit au VIDE aussi.
 *
 * Idempotente : `nomAscii(nomAscii(x)) === nomAscii(x)`.
 * Sûre sur un CHEMIN (les séparateurs `/` et `\` sont ASCII et traversent la table sans changer),
 * mais elle se pense par NOM : c'est un nom que la migration renomme, segment par segment.
 */

/** Table FERMÉE des substitutions, appliquées dans cet ordre. @type {[RegExp, string][]} */
const TABLE = [
  [/[’‘]/g, "'"],
  [/[“”]/g, '"'],
  // `\u00A0` (espace insécable) et `\u202F` (fine insécable) restent ÉCHAPPÉS : ce sont des blancs
  // irréguliers, invisibles à la relecture (et `no-irregular-whitespace` les refuse en clair).
  [/«[ \u00A0\u202F]?/g, ''],
  [/[ \u00A0\u202F]?»/g, ''],
  [/[—–]/g, '-'],
  [/…/g, '...'],
  [/œ/g, 'oe'],
  [/Œ/g, 'OE'],
  [/æ/g, 'ae'],
  [/Æ/g, 'AE'],
  [/￼/g, ''],
];

/** Titre POSÉ quand la translittération vide celui du chapitre — la forme `NN - <titre>.md` est ce
 *  que sept scanners lisent, un `NN.md` en sortirait (cf. règle 7). */
export const TITRE_VIDE = 'Sans titre';

/** Nom du point de code, pour un message qui NOMME ce qu'il refuse. */
const nomDuPointDeCode = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * TRANSLITTÉRATION seule : NFC, table FERMÉE, retrait des combinants (règles 0 à 6). Elle ne JUGE
 * rien et ne lève pas — les règles 7 et 8, qui font d'une chaîne un NOM de fichier, restent à
 * `nomAscii`. Second consommateur : la comparaison de titres d'OUVERTURE
 * (`scripts/raw/lib/marker-pages.mjs#normaliserTitre`), qui doit amener un titre IMPRIMÉ à la forme
 * que le NOM de son fichier porte, sans pour autant exiger un nom.
 * @param {string} texte @returns {string}
 */
export function translitterer(texte) {
  if (typeof texte !== 'string') throw new TypeError(`translitterer : un texte est une chaîne (reçu ${typeof texte})`);
  let s = texte.normalize('NFC');
  for (const [re, par] of TABLE) s = s.replace(re, par);
  return s.normalize('NFD').replace(/\p{M}+/gu, '');
}

/**
 * Le nom, en ASCII imprimable.
 * @param {string} nom nom de fichier ou de dossier (sans séparateur, de préférence)
 * @returns {string}
 * @throws {Error} si un caractère n'est couvert ni par la table, ni par le retrait des combinants
 */
export function nomAscii(nom) {
  if (typeof nom !== 'string') throw new TypeError(`nomAscii : un nom est une chaîne (reçu ${typeof nom})`);
  let s = translitterer(nom);
  s = s.replace(/ +$/, '').replace(/ +(?=\.[A-Za-z0-9]+$)/, '');
  s = s.replace(/^(\d+) *- *(\.[A-Za-z0-9]+)$/, `$1 - ${TITRE_VIDE}$2`);

  const fautifs = [...s].filter((c) => {
    const cp = c.codePointAt(0);
    return cp < 0x20 || cp > 0x7e;
  });
  if (fautifs.length) {
    const liste = [...new Set(fautifs)].map((c) => `« ${c} » (${nomDuPointDeCode(c)})`).join(', ');
    throw new Error(
      `nomAscii : caractère(s) hors table dans « ${nom} » → ${liste}. La table de ` +
        'scripts/source/nom-ascii.mjs est FERMÉE : déclare-y la règle de translittération de ce ' +
        'caractère (et ajoute son cas à scripts/source/nom-ascii.test.mjs).',
    );
  }
  if (!s) throw new Error(`nomAscii : « ${nom} » se réduit au nom VIDE — un fichier a un nom`);
  return s;
}
