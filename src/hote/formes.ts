/**
 * LES FORMES DES ARGUMENTS D'UN VERBE (#2898 lot C, #2928), communes aux hôtes du noyau : la forme JSON d'un paramètre
 * de verbe, lue du TYPE du noyau par `scripts/docs/lib/verbesDeLaPartie.mjs`, sa lecture contrôlée (`lireALaForme`) et
 * son écriture (`formeEcrite`, `signature`). Module feuille, sans import : le générateur du doc
 * (`scripts/docs/build-hote-texte.mjs`) l'écrit par la même lecture que l'hôte.
 */

export const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** La forme JSON d'un argument de verbe, lue du TYPE du paramètre (`scripts/docs/lib/verbesDeLaPartie.mjs`) : une
 *  forme `libre` ne se contrôle pas ; un objet sans `champs` ne contrôle que d'être un objet. `designe` : la
 *  désignation du noyau (`DESIGNATIONS`, src/noyau/designations.ts) dont la chaîne est un id, ou l'objet un `id`. */
export type Forme =
  | { genre: 'chaine'; designe?: Designation }
  | { genre: 'nombre' | 'booleen' | 'null' | 'absent' }
  | { genre: 'litteral'; valeur: string | number | boolean }
  | { genre: 'tableau'; element: Forme }
  | { genre: 'objet'; type: string; champs: { nom: string; optionnel: boolean; forme: Forme }[] | null; designe?: Designation }
  | { genre: 'union'; membres: Forme[]; type?: string }
  | { genre: 'libre'; type: string };

/** Une désignation du noyau : sa clé dans `DESIGNATIONS` et son nom en mots. */
export interface Designation {
  cle: string;
  mot: string;
}

/** Un paramètre d'un verbe de la partie : son nom, son optionnalité, son type écrit et sa forme JSON. */
export interface ParametreDeVerbe {
  nom: string;
  optionnel: boolean;
  type: string;
  forme: Forme;
}

/** Ce que l'état désigne, par clé de désignation : les ids valides, ou les objets désignés par leur `id` ; `undefined`
 *  pour un nom que l'état ne connaît pas. */
export type Designes = (cle: string) => readonly (string | { id: string })[] | undefined;

/** Une valeur lue à sa forme, ou son écart ; `inconnu` : de la bonne forme, mais un id que l'état ne désigne pas. */
type Lecture = { valeur: unknown } | { ecart: string; inconnu?: true };

/** Nombre d'ids valides qu'un refus nomme, les suivants repliés en « +N ». */
const IDS_NOMMES = 10;

/** Une valeur écrite à sa forme, comme l'hôte la relit (`lireALaForme`) : un objet désigné s'écrit par son `id`. */
export function ecritALaForme(v: unknown, f: Forme): unknown {
  if (f.genre === 'objet' && f.designe && estObjet(v) && typeof v.id === 'string') return v.id;
  if (f.genre === 'tableau' && Array.isArray(v)) return v.map((e) => ecritALaForme(e, f.element));
  if (f.genre === 'union') return f.membres.map((m) => ecritALaForme(v, m)).find((e) => e !== v) ?? v;
  return v;
}

/** Les ids valides d'une désignation, repliés. */
const idsNommes = (ids: readonly string[]): string =>
  ids.length ? `${ids.slice(0, IDS_NOMMES).join(', ')}${ids.length > IDS_NOMMES ? ` +${ids.length - IDS_NOMMES}` : ''}` : 'aucun ici';

/** L'élément désigné par l'id `v`, ou le refus qui nomme les ids valides. */
function lireLeDesigne(v: string, designe: Designation, ou: string, designes: Designes): Lecture {
  const elements = designes(designe.cle);
  if (!elements) return { valeur: v };
  const ids = elements.map((e) => (typeof e === 'string' ? e : e.id));
  const i = ids.indexOf(v);
  if (i < 0) return { ecart: `${ou} : ${JSON.stringify(v)} n’est pas un ${designe.mot} (valides : ${idsNommes(ids)})`, inconnu: true };
  return { valeur: elements[i] };
}

/** La valeur JSON `v` lue à sa forme `f`, au chemin `ou` : un id désigné se contrôle contre les ids de l'état
 *  (`designes`) et un objet désigné par son id se complète ; rend la valeur lue, ou l'écart. */
export function lireALaForme(v: unknown, f: Forme, ou: string, designes: Designes): Lecture {
  const attendu = (quoi: string): Lecture => ({ ecart: `${ou} : ${quoi} attendu` });
  switch (f.genre) {
    case 'libre': return { valeur: v };
    case 'absent': return v === undefined ? { valeur: v } : { ecart: `${ou} : aucune valeur attendue` };
    case 'null': return v === null ? { valeur: v } : attendu('null');
    case 'chaine':
      if (typeof v !== 'string') return { ecart: `${ou} : une chaîne attendue` };
      return f.designe ? lireLeDesigne(v, f.designe, ou, designes) : { valeur: v };
    case 'nombre': return typeof v === 'number' ? { valeur: v } : attendu('un nombre');
    case 'booleen': return typeof v === 'boolean' ? { valeur: v } : attendu('un booléen');
    case 'litteral': return v === f.valeur ? { valeur: v } : attendu(JSON.stringify(f.valeur));
    case 'union': {
      const lectures = f.membres.map((m) => lireALaForme(v, m, ou, designes));
      return lectures.find((l) => 'valeur' in l) ?? lectures.find((l) => 'inconnu' in l) ?? attendu(formeEcrite(f));
    }
    case 'tableau': {
      if (!Array.isArray(v)) return { ecart: `${ou} : un tableau JSON attendu` };
      const valeur: unknown[] = [];
      for (const [i, e] of v.entries()) {
        const l = lireALaForme(e, f.element, `${ou}[${i}]`, designes);
        if ('ecart' in l) return l;
        valeur.push(l.valeur);
      }
      return { valeur };
    }
    case 'objet': {
      if (f.designe && typeof v === 'string') return lireLeDesigne(v, f.designe, ou, designes);
      if (!estObjet(v)) return { ecart: `${ou} : un objet JSON ${formeEcrite(f)} attendu` };
      const valeur: Record<string, unknown> = { ...v };
      for (const c of f.champs ?? []) {
        if (v[c.nom] === undefined) {
          if (c.optionnel) continue;
          return { ecart: `${ou}.${c.nom} manque (${formeEcrite(f)})` };
        }
        const l = lireALaForme(v[c.nom], c.forme, `${ou}.${c.nom}`, designes);
        if ('ecart' in l) return l;
        valeur[c.nom] = l.valeur;
      }
      return { valeur };
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
    case 'chaine': return f.designe ? f.designe.mot : f.genre;
    case 'union': {
      const membres = f.membres.map((m) => formeEcrite(m, profondeur)).join(' | ');
      return f.type && (profondeur > 0 || membres.length > UNION_ECRITE) ? f.type : membres;
    }
    case 'tableau': return `[${formeEcrite(f.element, profondeur)}, …]`;
    case 'objet': return f.designe ? f.designe.mot : f.champs && profondeur === 0 ? `{${f.champs.map((c) => `"${c.nom}"${c.optionnel ? '?' : ''}: ${formeEcrite(c.forme, profondeur + 1)}`).join(', ')}}` : f.type;
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
