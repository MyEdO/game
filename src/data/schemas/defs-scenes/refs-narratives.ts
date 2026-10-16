/**
 * RÉFÉRENCES NARRATIVES d'un document de campagne (#679) — toute clé de `REFERENCES_NARRATIVES`
 * (`./registres-narratifs.ts`) désigne une entrée du registre qu'elle nomme, PAR ID ; une clé de
 * `SOUS_REFERENCES` désigne une SOUS-ENTRÉE de cette entrée (le `stade` d'un `indiceId`, la `valeur` ou la
 * `value` d'un `etat` énuméré).
 *
 * UN visiteur (`sitesDuProjet`) énumère chaque référence d'un projet, à son chemin complet :
 *  - chaque site de Condition et d'Effet du paquet, par l'énumérateur unique `./sites-de-paquet.ts` —
 *    l'Effet lui-même, chaque nœud de Condition et son sélecteur de héros (`who: {etat}`) ;
 *  - scènes : entités (`presetId`) ;
 *  - narratif : `indices[].affaireId` et `indices[].stades[].documentId`.
 * Une référence `etat` est en outre confrontée à la FORME de l'état qu'elle désigne
 * (`fautesDUsageDEtat`, table `./formes-d-etat.ts`) ; ses valeurs, aux valeurs que la forme déclare.
 *
 * Lecteurs : la porte du projet (`refsNarrativesPendantes`, `./projet.ts`), le raffinage du narratif
 * (`./narratif.ts`), le contrat des scénarios de test (`./scenarios-contrat.test.ts`) et l'éditeur
 * (`referencesA` garde une suppression, `renommeRef` propage un renommage).
 */
import { aucunDe, inconnuDe, nomDe, REFERENCES_NARRATIVES, type RegistreReference } from './registres-narratifs';
import { noeudsDeCondition, sitesDeLaCarte, sitesDeLaScene, sitesDuNarratifDuPaquet, type SitesDuPaquet } from './sites-de-paquet';
import { FORMES_D_ETAT, LIBELLE_D_USAGE, type FormeDEtatKind, type UsageDEtat } from './formes-d-etat';

type Chemin = readonly (string | number)[];

/** Clé d'une référence narrative. */
export type CleDeReference = keyof typeof REFERENCES_NARRATIVES;

/** SOUS-RÉFÉRENCES : clé → la référence PARENTE du même porteur, dont elle désigne une sous-entrée. */
const SOUS_REFERENCES = {
  stade: 'indiceId',
  valeur: 'etat',
  value: 'etat',
} as const satisfies Readonly<Record<string, CleDeReference>>;
export type CleDeSousReference = keyof typeof SOUS_REFERENCES;
const SOUS = Object.entries(SOUS_REFERENCES) as [CleDeSousReference, CleDeReference][];
const estSousReference = (cle: string): cle is CleDeSousReference => Object.prototype.hasOwnProperty.call(SOUS_REFERENCES, cle);

/** Une faute de référence narrative : son chemin depuis la racine du document, son message. */
export interface FauteDeRefNarrative {
  readonly chemin: Chemin;
  readonly message: string;
}

/** Une référence trouvée : son PORTEUR (l'objet qui la tient) et son chemin, la clé qui la tient, et ce
 *  qu'elle désigne — l'entrée `id` du `registre`, ou, pour une sous-référence, la sous-entrée `id` de
 *  l'entrée `parentId`. */
export interface SiteDeRef {
  readonly chemin: Chemin;
  readonly porteur: Record<string, unknown>;
  readonly cle: CleDeReference | CleDeSousReference;
  readonly registre: RegistreReference;
  readonly id: string;
  readonly parentId?: string;
}

/** Ce que le visiteur lit d'un projet — sa forme AVANT `normalizeScene` (collections optionnelles). */
export interface ProjetAReferences {
  readonly scenes: readonly unknown[];
  readonly worldMap?: unknown;
  readonly narratif?: unknown;
}

/** Ce que la résolution lit du narratif : chaque registre désigné, les stades des indices, la forme des états
 *  (et ses valeurs). */
export type NarratifAReferences = { readonly [R in Exclude<RegistreReference, 'indices' | 'etats'>]: readonly { readonly id: string }[] } & {
  readonly indices: readonly { readonly id: string; readonly stades: readonly { readonly id: string }[] }[];
  readonly etats: readonly { readonly id: string; readonly forme: { readonly kind: FormeDEtatKind; readonly valeurs?: readonly { readonly id: string }[] } }[];
};

const REFERENCES = Object.entries(REFERENCES_NARRATIVES) as [CleDeReference, RegistreReference][];

/** Les sous-entrées d'une entrée de registre (`undefined` : l'entrée n'en déclare pas). */
const SOUS_ENTREES: { readonly [R in RegistreReference]?: (e: NarratifAReferences[R][number]) => readonly { readonly id: string }[] | undefined } = {
  indices: (e) => e.stades,
  etats: (e) => e.forme.valeurs,
};
const NOM_DE_SOUS_ENTREE: { readonly [K in CleDeSousReference]: string } = { stade: 'stade inconnu', valeur: 'valeur non déclarée', value: 'valeur non déclarée' };

const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Ce que vaut une référence VIDE chez un porteur : une `absence` chez un porteur dont la référence est
 *  FACULTATIVE (entité, #1882 ; stade d'indice) — son propre schéma en juge la forme ; une `faute` chez
 *  un porteur qui l'EXIGE (Effect, indice). */
type VideDuPorteur = 'absence' | 'faute';

/** Les références que porte DIRECTEMENT `porteur` : ses clés de `REFERENCES_NARRATIVES`, et ses
 *  sous-références (`SOUS_REFERENCES`) quand la référence parente est là. */
function sitesDuPorteur(porteur: Record<string, unknown>, chemin: Chemin, out: SiteDeRef[], vide: VideDuPorteur = 'faute'): void {
  for (const [cle, registre] of REFERENCES) {
    const v = porteur[cle];
    if (typeof v === 'string' && !(v === '' && vide === 'absence')) out.push({ chemin, porteur, cle, registre, id: v });
  }
  for (const [cle, parent] of SOUS) {
    const v = porteur[cle];
    const parentId = porteur[parent];
    if (typeof parentId === 'string' && typeof v === 'string') out.push({ chemin, porteur, cle, registre: REFERENCES_NARRATIVES[parent], id: v, parentId });
  }
}

/** Les références que portent les sites de Condition et d'Effet (`./sites-de-paquet.ts`) : l'Effet, chaque
 *  nœud de Condition, et le sélecteur de héros `who` quand il est un objet. */
function sitesDesPorteurs(sites: SitesDuPaquet, out: SiteDeRef[]): void {
  for (const e of sites.effets) sitesDuPorteur(e.effet, e.chemin, out);
  for (const c of sites.conditions)
    for (const { noeud, chemin } of noeudsDeCondition(c.condition, c.chemin)) {
      sitesDuPorteur(noeud, chemin, out);
      if (noeud.who && typeof noeud.who === 'object') sitesDuPorteur(objet(noeud.who), [...chemin, 'who'], out);
    }
}

/** Les références d'UNE scène, chemins préfixés de `chemin`. */
export function sitesDeScene(scene: unknown, chemin: Chemin = []): SiteDeRef[] {
  const out: SiteDeRef[] = [];
  liste(objet(scene).entities).forEach((e, i) => sitesDuPorteur(objet(e), [...chemin, 'entities', i], out, 'absence'));
  sitesDesPorteurs(sitesDeLaScene(scene, chemin), out);
  return out;
}

/** Les références de la carte du monde, chemins préfixés de `chemin`. */
export function sitesDeCarte(worldMap: unknown, chemin: Chemin = []): SiteDeRef[] {
  const out: SiteDeRef[] = [];
  sitesDesPorteurs(sitesDeLaCarte(worldMap, chemin), out);
  return out;
}

/** Les références internes au narratif, chemins préfixés de `chemin`. */
export function sitesDuNarratif(narratif: unknown, chemin: Chemin = []): SiteDeRef[] {
  const out: SiteDeRef[] = [];
  sitesDesPorteurs(sitesDuNarratifDuPaquet(narratif, chemin), out);
  liste(objet(narratif).indices).forEach((ind, i) => {
    sitesDuPorteur(objet(ind), [...chemin, 'indices', i], out);
    liste(objet(ind).stades).forEach((st, j) => sitesDuPorteur(objet(st), [...chemin, 'indices', i, 'stades', j], out, 'absence'));
  });
  return out;
}

/** TOUTES les références d'un projet, dans l'ordre du document. */
export function sitesDuProjet(projet: ProjetAReferences): SiteDeRef[] {
  return [
    ...projet.scenes.flatMap((s, i) => sitesDeScene(s, ['scenes', i])),
    ...sitesDeCarte(projet.worldMap, ['worldMap']),
    ...sitesDuNarratif(projet.narratif, ['narratif']),
  ];
}

/** L'USAGE que fait d'une référence `etat` son porteur — lu sur sa FORME (`./formes-d-etat.ts`) : l'Effet
 *  qui désigne ou pose, la Condition qui compare (sans `value` : « est défini », admis partout, `undefined`),
 *  le sélecteur de héros. */
function usageDuPorteur(p: Record<string, unknown>): UsageDEtat | undefined {
  if (p.type === 'designerHeros') return 'designer';
  if (p.type === 'poserEtat') return 'poser';
  if (p.kind === 'etat') return p.value === undefined ? undefined : 'comparer';
  return 'selectionner';
}

/** Les fautes d'USAGE des références `etat` résolues : usage que la forme refuse. */
export function fautesDUsageDEtat(sites: readonly SiteDeRef[], narratif: NarratifAReferences): FauteDeRefNarrative[] {
  const etats = new Map(narratif.etats.map((e) => [e.id, e]));
  const fautes: FauteDeRefNarrative[] = [];
  for (const s of sites) {
    const etat = s.cle === 'etat' ? etats.get(s.id) : undefined;
    const usage = etat && usageDuPorteur(s.porteur);
    if (!etat || !usage) continue;
    const forme = FORMES_D_ETAT[etat.forme.kind];
    if (!forme.usages.includes(usage))
      fautes.push({ chemin: [...s.chemin, s.cle], message: `l'état « ${s.id} » (${forme.label}) ne se prête pas à : ${LIBELLE_D_USAGE[usage]}.` });
  }
  return fautes;
}

/** La sous-entrée qu'une sous-référence désigne existe-t-elle ? `undefined` : rien à juger (entrée parente
 *  inconnue — sa propre faute la dit —, ou qui ne déclare pas de sous-entrées). */
function sousEntreeConnue(narratif: NarratifAReferences, s: SiteDeRef): boolean | undefined {
  const parent = (narratif[s.registre] as readonly { id: string }[]).find((e) => e.id === s.parentId);
  const sous = parent && (SOUS_ENTREES[s.registre] as ((e: unknown) => readonly { id: string }[] | undefined) | undefined)?.(parent);
  return sous && sous.some((x) => x.id === s.id);
}

/** Les fautes des `sites` contre `narratif` : id vide (« aucun document choisi »), entrée inconnue,
 *  sous-entrée inconnue de son entrée (stade d'un indice, valeur d'un état), usage d'un état que sa forme
 *  refuse. */
export function fautesDeSites(sites: readonly SiteDeRef[], narratif: NarratifAReferences): FauteDeRefNarrative[] {
  const ids = Object.fromEntries(REFERENCES.map(([, reg]) => [reg, new Set(narratif[reg].map((x) => x.id))])) as Record<RegistreReference, Set<string>>;
  const fautes: FauteDeRefNarrative[] = [];
  for (const s of sites) {
    const chemin = [...s.chemin, s.cle];
    if (estSousReference(s.cle)) {
      if (sousEntreeConnue(narratif, s) === false)
        fautes.push({ chemin, message: `${NOM_DE_SOUS_ENTREE[s.cle]} « ${s.id} » de ${nomDe(s.registre)} « ${s.parentId} ».` });
    } else if (s.id === '') fautes.push({ chemin, message: `${aucunDe(s.registre)} : choisissez-en un au sélecteur (narratif.${s.registre}).` });
    else if (!ids[s.registre].has(s.id)) fautes.push({ chemin, message: `${inconnuDe(s.registre)} « ${s.id} » (narratif.${s.registre}).` });
  }
  return [...fautes, ...fautesDUsageDEtat(sites, narratif)];
}

/** Les fautes de référence narrative des scènes et de la carte du monde de `doc` contre `narratif` — la
 *  FK de la porte du projet ; celles du narratif lui-même sont au raffinage de `narratifSchema`. */
export function refsNarrativesPendantes(doc: ProjetAReferences, narratif: NarratifAReferences): FauteDeRefNarrative[] {
  return fautesDeSites([
    ...doc.scenes.flatMap((s, i) => sitesDeScene(s, ['scenes', i])),
    ...sitesDeCarte(doc.worldMap, ['worldMap']),
  ], narratif);
}

/** Ce que désigne une référence : l'entrée `id` du `registre`, ou sa sous-entrée `sous` (stade d'un
 *  indice, valeur d'un état). */
export interface CibleNarrative {
  readonly registre: RegistreReference;
  readonly id: string;
  readonly sous?: string;
}

const vise = (s: SiteDeRef, c: CibleNarrative): boolean =>
  s.registre === c.registre && (c.sous === undefined
    ? !estSousReference(s.cle) && s.id === c.id
    : estSousReference(s.cle) && s.parentId === c.id && s.id === c.sous);

/** Un renommage à propager : ce que désignait l'ancien id, et le nouvel id. */
export interface Renommage {
  readonly cible: CibleNarrative;
  readonly nouveau: string;
}

/** Les sites du projet qui désignent `cible`. */
export function referencesA(projet: ProjetAReferences, cible: CibleNarrative): SiteDeRef[] {
  return sitesDuProjet(projet).filter((s) => vise(s, cible));
}

/** Le projet où chaque site qui désigne `cible` désigne `nouveau` à la place. Seules les racines
 *  touchées (scène, carte, narratif) sont copiées ; les autres restent les mêmes objets. PURE. */
export function renommeRef<P extends ProjetAReferences>(projet: P, cible: CibleNarrative, nouveau: string): P {
  const reecrit = <T>(racine: T, sitesDe: (r: unknown) => SiteDeRef[]): T => {
    if (!sitesDe(racine).some((s) => vise(s, cible))) return racine;
    const copie = structuredClone(racine);
    for (const s of sitesDe(copie)) if (vise(s, cible)) s.porteur[s.cle] = nouveau;
    return copie;
  };
  return {
    ...projet,
    scenes: projet.scenes.map((s) => reecrit(s, (r) => sitesDeScene(r))),
    ...(projet.worldMap != null ? { worldMap: reecrit(projet.worldMap, (r) => sitesDeCarte(r)) } : {}),
    ...(projet.narratif != null ? { narratif: reecrit(projet.narratif, (r) => sitesDuNarratif(r)) } : {}),
  } as P;
}

/** Le LIEU d'un site : la racine qui le porte et, pour une scène ou un indice, son nom (libellé de la
 *  scène, titre de l'indice, sinon son id). La phrase se compose à l'affichage. */
export type LieuDeSite = { racine: 'scene' | 'indice'; nom: string } | { racine: 'carte' };

export function lieuDuSite(projet: ProjetAReferences, site: SiteDeRef): LieuDeSite {
  const [racine, , rang] = site.chemin;
  if (racine === 'scenes') {
    const sc = objet(projet.scenes[site.chemin[1] as number]);
    return { racine: 'scene', nom: String(sc.label || sc.id) };
  }
  if (racine === 'worldMap') return { racine: 'carte' };
  const ind = objet(liste(objet(projet.narratif).indices)[rang as number]);
  return { racine: 'indice', nom: String(ind.titre || ind.id) };
}
