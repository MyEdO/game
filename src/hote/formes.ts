/**
 * LES FORMES DES ARGUMENTS D'UN VERBE (#2898 lot C, #2928), communes aux hôtes du noyau : la forme JSON d'un paramètre
 * de verbe, lue du TYPE du noyau par `scripts/docs/lib/verbesDeLaPartie.mjs`, sa lecture contrôlée (`lireALaForme`) et
 * son écriture (`formeEcrite`, `signature`). Module sans autre import que le prédicat d'objet (`src/lib/objet.mjs`) : le
 * générateur du doc (`scripts/docs/build-hote-texte.mjs`) l'écrit par la même lecture que l'hôte.
 */

import { estObjet } from '../lib/objet.mjs';

/** La forme JSON d'un argument de verbe, lue du TYPE du paramètre (`scripts/docs/lib/verbesDeLaPartie.mjs`), entière à
 *  toute profondeur : `designe`, la désignation du noyau (`DESIGNATIONS`, src/noyau/designations.ts) dont la chaîne est
 *  un id ; `dictionnaire`, un objet à clés libres, chaque clé à la forme `cle`, chaque valeur à la forme `valeur`, sauf
 *  ses `champs` nommés ; `ref`, la forme d'un type récursif, posée par son nom dans `FormesNommees`. */
export type Forme =
  | { genre: 'chaine'; designe?: Designation }
  | { genre: 'nombre' | 'booleen' | 'null' | 'absent' }
  | { genre: 'litteral'; valeur: string | number | boolean }
  | { genre: 'tableau'; element: Forme }
  | { genre: 'tuple'; elements: Forme[] }
  | { genre: 'objet'; type: string; champs: ChampDeForme[] }
  | { genre: 'dictionnaire'; type: string; cle: Forme; valeur: Forme; champs?: ChampDeForme[] }
  | { genre: 'union'; membres: Forme[]; type?: string }
  | { genre: 'ref'; type: string };

/** Un champ nommé d'un objet : son nom, son optionnalité, sa forme. */
export interface ChampDeForme {
  nom: string;
  optionnel: boolean;
  forme: Forme;
}

/** La forme de chaque type récursif, par nom : ce qu'une forme `ref` désigne (`FORMES`, verbes.generated.ts). */
export type FormesNommees = Readonly<Record<string, Forme>>;

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

/** Ce que l'état désigne, par clé de désignation : les ids valides ; `undefined` pour un nom que l'état ne connaît
 *  pas. */
export type Designes = (cle: string) => readonly string[] | undefined;

/** Une valeur lue à sa forme, ou son écart ; `inconnu` : de la bonne forme, mais un id que l'état ne désigne pas. */
type Lecture = { valeur: unknown } | { ecart: string; inconnu?: true };

/** Nombre d'ids valides qu'un refus nomme, les suivants repliés en « +N ». */
const IDS_NOMMES = 10;

/** Les ids valides d'une désignation, repliés. */
const idsNommes = (ids: readonly string[]): string =>
  ids.length ? `${ids.slice(0, IDS_NOMMES).join(', ')}${ids.length > IDS_NOMMES ? ` +${ids.length - IDS_NOMMES}` : ''}` : 'aucun ici';

/** L'id `v`, ou le refus qui nomme les ids valides. */
function lireLeDesigne(v: string, designe: Designation, ou: string, designes: Designes): Lecture {
  const ids = designes(designe.cle);
  if (!ids || ids.includes(v)) return { valeur: v };
  return { ecart: `${ou} : ${JSON.stringify(v)} n’est pas un ${designe.mot} (valides : ${idsNommes(ids)})`, inconnu: true };
}

/** Les champs nommés `champs` de l'objet `v`, au chemin `ou`, lus dans `valeur` : rend l'écart du premier qui manque
 *  ou qui s'écarte de sa forme, `null` s'il n'y en a aucun. `ecrite` : la forme de l'objet, écrite dans le refus d'un
 *  champ qui manque. */
function lireLesChamps(v: Record<string, unknown>, champs: readonly ChampDeForme[], ecrite: string, ou: string, lire: Lire, valeur: Record<string, unknown>): Lecture | null {
  for (const c of champs) {
    if (v[c.nom] === undefined) {
      if (c.optionnel) continue;
      return { ecart: `${ou}.${c.nom} manque (${ecrite})` };
    }
    const l = lire(v[c.nom], c.forme, `${ou}.${c.nom}`);
    if ('ecart' in l) return l;
    valeur[c.nom] = l.valeur;
  }
  return null;
}

/** La lecture d'une valeur à une forme, au chemin `ou`, sous les désignations et les formes nommées d'un appel. */
type Lire = (v: unknown, f: Forme, ou: string) => Lecture;

/** La forme qu'une `ref` désigne, ou `f` elle-même. */
const resolue = (f: Forme, formes: FormesNommees): Forme => (f.genre === 'ref' ? formes[f.type] : f);

/** Les membres objets d'une union dont une clé requise est présente dans `v` : ceux que `v` vise. */
function membresVises(v: unknown, membres: readonly Forme[], formes: FormesNommees): number[] {
  if (!estObjet(v)) return [];
  return membres.flatMap((m, i) => {
    const r = resolue(m, formes);
    return (r.genre === 'objet' || r.genre === 'dictionnaire') && (r.champs ?? []).some((c) => !c.optionnel && v[c.nom] !== undefined) ? [i] : [];
  });
}

/** L'écart d'une valeur qu'aucun membre de l'union `f` n'admet : une énumération de littéraux nomme ses valeurs. */
function horsDeLUnion(v: unknown, f: Extract<Forme, { genre: 'union' }>, ou: string): Lecture {
  const valeurs = f.membres.flatMap((m) => (m.genre === 'litteral' ? [JSON.stringify(m.valeur)] : []));
  if (valeurs.length < f.membres.length) return { ecart: `${ou} : ${formeEcrite(f)} attendu` };
  return { ecart: `${ou} : ${JSON.stringify(v)} n’est pas ${f.type ?? 'une valeur admise'} (admises : ${valeurs.join(', ')})` };
}

/** Nombre de lectures imbriquées au-delà duquel une valeur se refuse : une forme récursive (`ref`) n'a pas de fond. */
const PROFONDEUR_LUE = 256;

/** La valeur JSON `v` lue à sa forme `f`, au chemin `ou`, à toute profondeur, bornée (`PROFONDEUR_LUE`) : un id désigné
 *  se contrôle contre les ids de l'état (`designes`), une `ref` à la forme que `formes` nomme ; rend la valeur lue, ou
 *  l'écart. Un objet refuse une clé qu'il ne déclare pas ; dans une union d'objets, l'écart est celui des membres que la
 *  valeur vise (`membresVises`). `profondeur` : le nombre de lectures qui l'englobent. */
export function lireALaForme(v: unknown, f: Forme, ou: string, designes: Designes, formes: FormesNommees, profondeur = 0): Lecture {
  if (profondeur > PROFONDEUR_LUE) return { ecart: `${ou} : plus de ${PROFONDEUR_LUE} niveaux d’imbrication` };
  const lire: Lire = (x, g, o) => lireALaForme(x, g, o, designes, formes, profondeur + 1);
  const attendu = (quoi: string): Lecture => ({ ecart: `${ou} : ${quoi} attendu` });
  switch (f.genre) {
    case 'absent': return v === undefined ? { valeur: v } : { ecart: `${ou} : aucune valeur attendue` };
    case 'null': return v === null ? { valeur: v } : attendu('null');
    case 'chaine':
      if (typeof v !== 'string') return { ecart: `${ou} : une chaîne attendue` };
      return f.designe ? lireLeDesigne(v, f.designe, ou, designes) : { valeur: v };
    case 'nombre': return typeof v === 'number' ? { valeur: v } : attendu('un nombre');
    case 'booleen': return typeof v === 'boolean' ? { valeur: v } : attendu('un booléen');
    case 'litteral': return v === f.valeur ? { valeur: v } : attendu(JSON.stringify(f.valeur));
    case 'ref': return lire(v, formes[f.type], ou);
    case 'union': {
      const lectures = f.membres.map((m) => lire(v, m, ou));
      const ecarts = membresVises(v, f.membres, formes).flatMap((i) => { const l = lectures[i]; return 'ecart' in l ? [l.ecart] : []; });
      return lectures.find((l) => 'valeur' in l) ?? lectures.find((l) => 'inconnu' in l)
        ?? (ecarts.length === 1 ? { ecart: ecarts[0] } : ecarts.length ? { ecart: `${ou} : vise plusieurs membres de ${formeEcrite(f)} (${ecarts.join(' ; ')})` } : horsDeLUnion(v, f, ou));
    }
    case 'tableau': {
      if (!Array.isArray(v)) return { ecart: `${ou} : un tableau JSON attendu` };
      const valeur: unknown[] = [];
      for (const [i, e] of v.entries()) {
        const l = lire(e, f.element, `${ou}[${i}]`);
        if ('ecart' in l) return l;
        valeur.push(l.valeur);
      }
      return { valeur };
    }
    case 'tuple': {
      if (!Array.isArray(v) || v.length !== f.elements.length) return attendu(`un tableau JSON de ${f.elements.length} élément(s)`);
      const valeur: unknown[] = [];
      for (const [i, e] of f.elements.entries()) {
        const l = lire(v[i], e, `${ou}[${i}]`);
        if ('ecart' in l) return l;
        valeur.push(l.valeur);
      }
      return { valeur };
    }
    case 'objet': {
      if (!estObjet(v)) return { ecart: `${ou} : un objet JSON ${formeEcrite(f)} attendu` };
      const admises = f.champs.map((c) => c.nom);
      const inconnue = Object.keys(v).find((k) => v[k] !== undefined && !admises.includes(k));
      if (inconnue !== undefined) return { ecart: `${ou}.${inconnue} : clé inconnue (admises : ${admises.join(', ')})` };
      const valeur: Record<string, unknown> = { ...v };
      return lireLesChamps(v, f.champs, formeEcrite(f), ou, lire, valeur) ?? { valeur };
    }
    case 'dictionnaire': {
      if (!estObjet(v)) return { ecart: `${ou} : un objet JSON ${formeEcrite(f)} attendu` };
      const valeur: Record<string, unknown> = {};
      const nommes = new Set((f.champs ?? []).map((c) => c.nom));
      for (const [cle, x] of Object.entries(v)) {
        if (nommes.has(cle)) continue;
        const k = lire(cle, f.cle, `${ou}[clé ${JSON.stringify(cle)}]`);
        if ('ecart' in k) return k;
        const l = lire(x, f.valeur, `${ou}[${JSON.stringify(cle)}]`);
        if ('ecart' in l) return l;
        // Une clé `__proto__` reste une propriété propre, sans toucher au prototype.
        Object.defineProperty(valeur, cle, { value: l.valeur, enumerable: true, writable: true, configurable: true });
      }
      return lireLesChamps(v, f.champs ?? [], formeEcrite(f), ou, lire, valeur) ?? { valeur };
    }
  }
}

/** Longueur au-delà de laquelle une union nommée s'écrit par son nom. */
const UNION_ECRITE = 60;

/** Une forme écrite en une ligne : un objet montre ses champs au premier niveau, le NOM de son type au-delà ; une union
 *  nommée s'écrit par son nom au-delà du premier niveau, ou quand ses membres sont longs. */
export function formeEcrite(f: Forme, profondeur = 0): string {
  switch (f.genre) {
    case 'ref': case 'dictionnaire': return f.type;
    case 'litteral': return JSON.stringify(f.valeur);
    case 'chaine': return f.designe ? f.designe.mot : f.genre;
    case 'union': {
      const membres = f.membres.map((m) => formeEcrite(m, profondeur)).join(' | ');
      return f.type && (profondeur > 0 || membres.length > UNION_ECRITE) ? f.type : membres;
    }
    case 'tableau': return `[${formeEcrite(f.element, profondeur)}, …]`;
    case 'tuple': return `[${f.elements.map((e) => formeEcrite(e, profondeur)).join(', ')}]`;
    case 'objet': return profondeur === 0 ? `{${f.champs.map((c) => `"${c.nom}"${c.optionnel ? '?' : ''}: ${formeEcrite(c.forme, profondeur + 1)}`).join(', ')}}` : f.type;
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
