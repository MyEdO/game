// CODE SEUL — la vue « ce que la machine exécute » d'un texte source. Module ESM pur, exécutable
// par `node` nu, sans état ni lecture disque — même patron que `dialecte.mjs`.
//
// POURQUOI UN MODULE À LUI : une garde lexicale cherche un MOTIF DE CODE. Un commentaire est de la
// PROSE et une chaîne est une DONNÉE : les y compter fait rougir une garde sur un texte qui
// n'exécute rien, et l'oblige alors à une liste de sites tolérés — c'est-à-dire à une garde qui
// valide des défauts. Le blanchiment est donc un prérequis de toute garde lexicale, en UN
// exemplaire. Il ne vit PAS dans `sourceCorpus.mjs` : cette lib-là LIT et MÉMOÏSE, sa frontière
// écrite (en-tête de `sourceCorpus.mjs`) lui interdit d'interpréter — blanchir EST une lecture lexicale.
//
// CONTRAT :
//  - LIGNES PRÉSERVÉES, et COLONNES aussi : chaque caractère retiré devient une espace, tout `\n`
//    est gardé — un numéro de ligne rapporté sur la vue code désigne la même ligne à la source.
//  - Sont blanchis : commentaires de bloc et de ligne (entièrement), CONTENU des chaînes `'…'`,
//    `"…"` et des SEGMENTS TEXTE d'un gabarit. Les délimiteurs restent : `f('abc')` devient
//    `f('   ')` — la FORME de l'appel survit, sa donnée non.
//  - Les SUBSTITUTIONS d'un gabarit (`${ … }`) sont du CODE et restent intactes, récursivement :
//    un gabarit `sans ${substitution}` est donc blanchi en entier, un gabarit qui en porte une
//    garde l'expression et perd le reste.
//  - Un littéral de REGEXP est du CODE : il est TRAVERSÉ intact (ses quotes n'ouvrent aucune
//    chaîne). `/` ouvre une regexp quand le dernier jeton significatif ne peut pas être une valeur
//    (ponctuation ouvrante, ou mot-clé préfixe) — la règle du lexeur JS, faite ici sur le dernier
//    jeton, sans grammaire.
//
// COUVERTURE DITE : la classification `/` division vs regexp est la seule heuristique. Un cas
// pathologique (`a++ /re/`, une regexp après `)` fermant un `if`) serait lu en division ; les deux
// formes laissent le texte INTACT en division, le risque se borne donc à traverser en code une
// chaîne ouverte dans une regexp.

/** Ponctuation après laquelle un `/` ne peut pas être une division : le jeton précédent n'est pas
 *  une valeur, donc `/` ouvre un littéral de regexp. */
const AVANT_REGEXP = /[(,=:[!&|?{};+\-*%~^<>\n]/;
/** Mots-clés préfixes après lesquels un `/` ouvre un littéral de regexp. */
const MOT_AVANT_REGEXP =
  /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/**
 * Le texte RÉDUIT À SON CODE : commentaires et données littérales blanchies en espaces, lignes et
 * colonnes préservées (voir le contrat, ci-dessus).
 * @param {string} src
 * @returns {string} même longueur, mêmes retours-ligne.
 */
export function codeSeul(src) {
  const out = src.split('');
  const blanchir = (debut, fin) => {
    for (let k = debut; k < fin && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  /** Pile des contextes de gabarit : `'texte'` = segment littéral, un NOMBRE = profondeur d'accolades
   *  de la substitution `${ … }` en cours. */
  const pile = [];
  let i = 0;
  let precedent = ''; // dernier caractère de CODE significatif
  let mot = ''; // mot en cours, pour les mots-clés préfixes de regexp
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const suivant = src[i + 1];

    if (pile[pile.length - 1] === 'texte') {
      if (c === '`') {
        pile.pop();
        precedent = '`';
        mot = '';
        i += 1;
        continue;
      }
      if (c === '\\') {
        blanchir(i, i + 2);
        i += 2;
        continue;
      }
      if (c === '$' && suivant === '{') {
        pile.push(0);
        i += 2;
        precedent = '{';
        mot = '';
        continue;
      }
      blanchir(i, i + 1);
      i += 1;
      continue;
    }

    if (c === '/' && suivant === '*') {
      const fin = src.indexOf('*/', i + 2);
      const j = fin < 0 ? n : fin + 2;
      blanchir(i, j);
      i = j;
      continue;
    }
    if (c === '/' && suivant === '/') {
      const fin = src.indexOf('\n', i);
      const j = fin < 0 ? n : fin;
      blanchir(i, j);
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      blanchir(i + 1, j);
      i = j < n && src[j] === c ? j + 1 : j;
      precedent = c;
      mot = '';
      continue;
    }
    if (c === '`') {
      pile.push('texte');
      i += 1;
      continue;
    }
    if (c === '/' && (precedent === '' || AVANT_REGEXP.test(precedent) || MOT_AVANT_REGEXP.test(mot))) {
      let j = i + 1;
      let classe = false;
      while (j < n && src[j] !== '\n') {
        const k = src[j];
        if (k === '\\') { j += 2; continue; }
        if (k === '[') classe = true;
        else if (k === ']') classe = false;
        else if (k === '/' && !classe) break;
        j += 1;
      }
      i = j < n && src[j] === '/' ? j + 1 : j;
      precedent = '/';
      mot = '';
      continue;
    }
    const dessus = pile[pile.length - 1];
    if (typeof dessus === 'number') {
      if (c === '{') pile[pile.length - 1] = dessus + 1;
      else if (c === '}') {
        if (dessus === 0) {
          pile.pop();
          i += 1;
          continue;
        }
        pile[pile.length - 1] = dessus - 1;
      }
    }
    if (/[\w$]/.test(c)) mot += c;
    else mot = '';
    if (!/\s/.test(c) || c === '\n') precedent = c;
    i += 1;
  }
  return out.join('');
}
