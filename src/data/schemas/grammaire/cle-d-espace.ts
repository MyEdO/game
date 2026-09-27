/**
 * CLÉ D'ESPACE (#1463) — la graphie UNIQUE d'un espace de noms : `fichier` pour la collection de
 * racine, `fichier#…` pour une collection nichée (`skills.json#[art].specs`, `sizes.json#rangedMod`),
 * suffixée d'un FILTRE : `?champ=valeur` (les éléments dont le champ DISCRIMINANT vaut la valeur,
 * `materials.json?domain=prop`) ou `?champ` (les éléments qui PORTENT le champ MARQUEUR,
 * `props.json?volume`). Les filtres sont les paramètres `espace` de la marque de la collection
 * (`grammaire/collection-cle.ts`) ; la table `IDS_PAR_ESPACE` (`_ids.generated.ts`) est keyée ici.
 *
 * FEUILLE : aucun import — `grammaire/ref.ts` et `grammaire/idsVivants.ts` l'atteignent sans passer
 * par les defs (`idsVivants.ts:9-11`).
 */

/** Filtre d'une clé d'espace : `vaut` posé = discriminant ; sinon marqueur. */
export interface FiltreDEspace {
  readonly champ: string;
  readonly vaut?: string;
}

/** Une clé d'espace lue : son fichier, sa suite nichée (après `#`), son filtre (après `?`). */
export interface CleLue {
  readonly fichier: string;
  readonly niche?: string;
  readonly filtre?: FiltreDEspace;
}

/** Caractères qu'un pas `[clé]`, une valeur de discriminant ou un marqueur ne portent jamais. */
export const HORS_DE_LA_GRAPHIE = /[?=#]/;

/** Un PAS de suite nichée : un `champ`, l'élément `[clé]` d'une liste marquée, ou le `rang` (`[]`)
 *  d'un élément d'une liste non marquée. */
export type PasDeSuite = { readonly champ: string } | { readonly cle: string } | { readonly rang: true };

/** SEUL écrivain d'une suite nichée : `suite` prolongée de `pas` — premier pas sans point, `.champ`
 *  ensuite, `[clé]` et `[]` collés (`[art].specs`, `rangedMod`, `lots[].items`). */
export function suiteAvecPas(suite: string, pas: PasDeSuite): string {
  if ('champ' in pas) return suite === '' ? pas.champ : `${suite}.${pas.champ}`;
  return 'cle' in pas ? `${suite}[${pas.cle}]` : `${suite}[]`;
}

/** Lecture d'une suite nichée en pas — l'inverse de `suiteAvecPas`, `[]` y redevient `rang`. */
export function pasDeLaSuite(suite: string): PasDeSuite[] {
  const pas: PasDeSuite[] = [];
  for (let i = 0; i < suite.length; ) {
    if (suite[i] === '[') {
      const fin = suite.indexOf(']', i);
      if (fin < 0) throw new Error(`suite nichée « ${suite} » : « [ » sans « ] ».`);
      const cle = suite.slice(i + 1, fin);
      pas.push(cle === '' ? { rang: true } : { cle });
      i = fin + 1;
      continue;
    }
    const debut = suite[i] === '.' ? i + 1 : i;
    const fin = [suite.indexOf('.', debut), suite.indexOf('[', debut)].filter((j) => j >= 0).reduce((a, b) => Math.min(a, b), suite.length);
    pas.push({ champ: suite.slice(debut, fin) });
    i = fin;
  }
  return pas;
}

/** `prefixe` est-elle la suite d'un point sur le chemin de `suite` (`''`, `suite` elle-même, ou suivie
 *  d'un pas `.champ` ou `[…]`) ? */
export function estPrefixeDeSuite(prefixe: string, suite: string): boolean {
  return prefixe === '' || prefixe === suite || (suite.startsWith(prefixe) && (suite[prefixe.length] === '.' || suite[prefixe.length] === '['));
}

/** Clé d'une collection NICHÉE sous `base` (un fichier, ou déjà une clé nichée) : `suite` est le pas
 *  qui y mène, `[clé]` d'un élément ou `champ` (`skills.json#[art].specs`, `sizes.json#rangedMod`) ;
 *  une suite vide désigne `base` elle-même. */
export function cleNichee(base: string, suite: string): string {
  if (suite === '') return base;
  if (!base.includes('#')) return `${base}#${suite}`;
  return suite.startsWith('[') ? `${base}${suite}` : `${base}.${suite}`;
}

/** Clé de l'espace des `specs` de l'élément `id` de l'espace `espace`. */
export function cleDesSpecs(espace: string, id: string): string {
  return cleNichee(espace, suiteAvecPas(suiteAvecPas('', { cle: id }), { champ: 'specs' }));
}

/** Le fichier d'une clé d'espace, au type. */
export type FichierDe<K extends string> = K extends `${infer F}#${string}` ? F : K extends `${infer F}?${string}` ? F : K;

/** Le fichier d'une clé d'espace, typé par sa clé littérale. */
export function fichierDe<K extends string>(cle: K): FichierDe<K> {
  return lireCleDEspace(cle).fichier as FichierDe<K>;
}

/** La clé NON FILTRÉE d'une clé lue : `fichier`, ou `fichier#…`. */
export function baseDe(lue: CleLue): string {
  return lue.niche === undefined ? lue.fichier : `${lue.fichier}#${lue.niche}`;
}

/** Clé d'espace filtrée d'un espace `base`. */
export function cleFiltree(base: string, filtre: FiltreDEspace): string {
  return filtre.vaut === undefined ? `${base}?${filtre.champ}` : `${base}?${filtre.champ}=${filtre.vaut}`;
}

/** Lecture d'une clé d'espace. */
export function lireCleDEspace(cle: string): CleLue {
  const q = cle.indexOf('?');
  const base = q < 0 ? cle : cle.slice(0, q);
  const d = base.indexOf('#');
  const fichier = d < 0 ? base : base.slice(0, d);
  const niche = d < 0 ? undefined : base.slice(d + 1);
  if (q < 0) return niche === undefined ? { fichier } : { fichier, niche };
  const suite = cle.slice(q + 1);
  const e = suite.indexOf('=');
  const filtre: FiltreDEspace = e < 0 ? { champ: suite } : { champ: suite.slice(0, e), vaut: suite.slice(e + 1) };
  return niche === undefined ? { fichier, filtre } : { fichier, niche, filtre };
}

/**
 * Un élément PORTE-t-il le champ marqueur `champ` ? Présent, autre que `false` (la case à cocher
 * générique du Codex, `editFields.ts`, écrit `false` au décochage), et autre qu'une liste vide
 * (`gods.json › blessings: []`). SEUL prédicat du marqueur.
 */
export function porteLeChampMarqueur(e: Readonly<Record<string, unknown>>, champ: string): boolean {
  const v = e[champ];
  return v !== undefined && v !== null && v !== false && v !== '' && !(Array.isArray(v) && v.length === 0);
}

/** L'élément `e` est-il retenu par le filtre ? SEUL prédicat de filtre, lu par la phase 2 de
 *  `npm run gen` (`scripts/gen-espaces.mts`) et par le régime vivant (`idsVivants.ts`). */
export function retenuParFiltre(filtre: FiltreDEspace, e: Readonly<Record<string, unknown>>): boolean {
  return filtre.vaut === undefined ? porteLeChampMarqueur(e, filtre.champ) : e[filtre.champ] === filtre.vaut;
}

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Ids d'un espace lus sur la racine VIVE de son fichier, dans l'ordre de la donnée : les `id` d'une
 * liste (filtrée), les clés d'un record. La suite nichée ne s'y lit qu'en pas de CHAMP
 * (`sizes.json#rangedMod`) ; un pas `[clé]` ou un filtre sur un record LÈVENT, nommément.
 */
export function idsSurLaRacine(cle: string, racine: unknown): string[] {
  const { niche, filtre } = lireCleDEspace(cle);
  let noeud = racine;
  for (const pas of niche === undefined ? [] : niche.split('.')) {
    if (pas.startsWith('[')) throw new Error(`clé d'espace « ${cle} » : le pas « ${pas} » ne se lit pas sur une racine vive.`);
    noeud = estObjet(noeud) ? noeud[pas] : undefined;
  }
  if (Array.isArray(noeud))
    return noeud.flatMap((e) => (estObjet(e) && typeof e.id === 'string' && (!filtre || retenuParFiltre(filtre, e)) ? [e.id] : []));
  if (filtre) throw new Error(`clé d'espace « ${cle} » : un filtre ne se lit que sur une liste.`);
  return estObjet(noeud) ? Object.keys(noeud) : [];
}
