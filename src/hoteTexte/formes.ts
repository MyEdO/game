/**
 * LES FORMES DES ARGUMENTS DE L'HÔTE TEXTE (#2898 lot C) : la forme JSON d'un paramètre de verbe, lue du TYPE du noyau
 * par `scripts/docs/lib/verbesDeLaPartie.mjs`, son contrôle (`ecartALaForme`) et son écriture (`formeEcrite`,
 * `signature`). Module feuille, sans import : le générateur du doc (`scripts/docs/build-hote-texte.mjs`) l'écrit par la
 * même lecture que l'hôte.
 */

export const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** La forme JSON d'un argument de verbe, lue du TYPE du paramètre (`scripts/docs/lib/verbesDeLaPartie.mjs`) : une
 *  forme `libre` ne se contrôle pas ; un objet sans `champs` ne contrôle que d'être un objet. */
export type Forme =
  | { genre: 'chaine' | 'nombre' | 'booleen' | 'null' | 'absent' }
  | { genre: 'litteral'; valeur: string | number | boolean }
  | { genre: 'tableau'; element: Forme }
  | { genre: 'objet'; type: string; champs: { nom: string; optionnel: boolean; forme: Forme }[] | null }
  | { genre: 'union'; membres: Forme[]; type?: string }
  | { genre: 'libre'; type: string };

/** Un paramètre d'un verbe de la partie : son nom, son optionnalité, son type écrit et sa forme JSON. */
export interface ParametreDeVerbe {
  nom: string;
  optionnel: boolean;
  type: string;
  forme: Forme;
}

/** Ce qu'une valeur JSON n'a pas de sa forme (`null` : elle est conforme), au chemin `ou`. */
export function ecartALaForme(v: unknown, f: Forme, ou: string): string | null {
  switch (f.genre) {
    case 'libre': return null;
    case 'absent': return v === undefined ? null : `${ou} : aucune valeur attendue`;
    case 'null': return v === null ? null : `${ou} : null attendu`;
    case 'chaine': return typeof v === 'string' ? null : `${ou} : une chaîne attendue`;
    case 'nombre': return typeof v === 'number' ? null : `${ou} : un nombre attendu`;
    case 'booleen': return typeof v === 'boolean' ? null : `${ou} : un booléen attendu`;
    case 'litteral': return v === f.valeur ? null : `${ou} : ${JSON.stringify(f.valeur)} attendu`;
    case 'union': {
      const ecarts = f.membres.map((m) => ecartALaForme(v, m, ou));
      return ecarts.includes(null) ? null : `${ou} : ${formeEcrite(f)} attendu`;
    }
    case 'tableau': {
      if (!Array.isArray(v)) return `${ou} : un tableau JSON attendu`;
      for (const [i, e] of v.entries()) {
        const ecart = ecartALaForme(e, f.element, `${ou}[${i}]`);
        if (ecart) return ecart;
      }
      return null;
    }
    case 'objet': {
      if (!estObjet(v)) return `${ou} : un objet JSON ${formeEcrite(f)} attendu`;
      for (const c of f.champs ?? []) {
        if (v[c.nom] === undefined) {
          if (c.optionnel) continue;
          return `${ou}.${c.nom} manque (${formeEcrite(f)})`;
        }
        const ecart = ecartALaForme(v[c.nom], c.forme, `${ou}.${c.nom}`);
        if (ecart) return ecart;
      }
      return null;
    }
  }
}

/** Longueur au-delà de laquelle une union nommée s'écrit par son nom. */
const UNION_ECRITE = 60;

/** Une forme écrite en une ligne : un objet montre ses champs au premier niveau, le NOM de son type au-delà ; une union
 *  nommée s'écrit par son nom au-delà du premier niveau, ou quand ses membres sont longs. */
export function formeEcrite(f: Forme, profondeur = 0): string {
  switch (f.genre) {
    case 'libre': return f.type;
    case 'litteral': return JSON.stringify(f.valeur);
    case 'union': {
      const membres = f.membres.map((m) => formeEcrite(m, profondeur)).join(' | ');
      return f.type && (profondeur > 0 || membres.length > UNION_ECRITE) ? f.type : membres;
    }
    case 'tableau': return `[${formeEcrite(f.element, profondeur)}, …]`;
    case 'objet': return f.champs && profondeur === 0 ? `{${f.champs.map((c) => `"${c.nom}"${c.optionnel ? '?' : ''}: ${formeEcrite(c.forme, profondeur + 1)}`).join(', ')}}` : f.type;
    default: return f.genre;
  }
}

/** Longueur au-delà de laquelle la forme d'un paramètre s'écrit par le nom de son type. */
const FORME_ECRITE = 120;

/** La forme d'un paramètre en une ligne, ou le nom de son type quand elle est longue. */
const parametreEcrit = (p: ParametreDeVerbe): string => {
  const forme = formeEcrite(p.forme);
  return `${p.nom}${p.optionnel ? '?' : ''}: ${forme.length > FORME_ECRITE ? p.type : forme}`;
};

/** Les paramètres d'un verbe en une ligne : `nom: forme, nom?: forme` ; `aucun` sans paramètre. */
export const parametresEcrits = (parametres: readonly ParametreDeVerbe[]): string =>
  parametres.length ? parametres.map(parametreEcrit).join(', ') : 'aucun';

/** La signature d'un verbe en une ligne : `verbe(nom: forme, nom?: forme)`. */
export const signature = (verbe: string, parametres: readonly ParametreDeVerbe[]): string =>
  `${verbe}(${parametres.length ? parametresEcrits(parametres) : ''})`;
