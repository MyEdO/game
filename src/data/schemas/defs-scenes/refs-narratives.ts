/**
 * RÉFÉRENCES NARRATIVES d'un document de campagne (#679) — toute clé de `REFERENCES_NARRATIVES`
 * (`./registres-narratifs.ts`) désigne une entrée du registre qu'elle nomme, PAR ID ; le `stade` d'un
 * `indiceId` désigne un stade de cet indice.
 *
 * UN visiteur (`sitesDuProjet`) énumère chaque référence d'un projet, à son chemin complet :
 *  - scènes : entités (`presetId`), chaque RACINE de Flow (`racinesDeFlow`), l'arbre entier par
 *    `walkFlow`, et les Flows PORTÉS par une feuille par `carriedFlows` (`src/engine/flowCore.ts`) ;
 *  - carte du monde : Effects des péripéties de route (`worldMap.routes[].perils[].effects`) ;
 *  - narratif : `indices[].affaireId` et `indices[].stades[].documentId`.
 *
 * Lecteurs : la porte du projet (`refsNarrativesPendantes`, `./projet.ts`), le raffinage du narratif
 * (`./narratif.ts`), le contrat des scénarios de test (`./scenarios-contrat.test.ts`) et l'éditeur
 * (`referencesA` garde une suppression, `renommeRef` propage un renommage).
 */
import { carriedFlows, isFlowNode, racinesDeFlow, walkFlow, type CheminDeFlow, type Flow } from '../../../engine/flowCore';
import { aucunDe, inconnuDe, REFERENCES_NARRATIVES, type RegistreReference } from './registres-narratifs';

type Chemin = readonly (string | number)[];

/** Clé d'une référence narrative. */
export type CleDeReference = keyof typeof REFERENCES_NARRATIVES;

/** Une faute de référence narrative : son chemin depuis la racine du document, son message. */
export interface FauteDeRefNarrative {
  readonly chemin: Chemin;
  readonly message: string;
}

/** Une référence trouvée : son PORTEUR (l'objet qui la tient) et son chemin, la clé qui la tient, et ce
 *  qu'elle désigne — l'entrée `id` du `registre`, ou, pour la clé `stade`, le stade `id` de l'indice
 *  `indiceId`. */
export interface SiteDeRef {
  readonly chemin: Chemin;
  readonly porteur: Record<string, unknown>;
  readonly cle: CleDeReference | 'stade';
  readonly registre: RegistreReference;
  readonly id: string;
  readonly indiceId?: string;
}

/** Ce que le visiteur lit d'un projet — sa forme AVANT `normalizeScene` (collections optionnelles). */
export interface ProjetAReferences {
  readonly scenes: readonly unknown[];
  readonly worldMap?: unknown;
  readonly narratif?: unknown;
}

/** Ce que la résolution lit du narratif : chaque registre désigné, et les stades des indices. */
export type NarratifAReferences = { readonly [R in Exclude<RegistreReference, 'indices'>]: readonly { readonly id: string }[] } & {
  readonly indices: readonly { readonly id: string; readonly stades: readonly { readonly id: string }[] }[];
};

const REFERENCES = Object.entries(REFERENCES_NARRATIVES) as [CleDeReference, RegistreReference][];

const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Ce que vaut une référence VIDE chez un porteur : une `absence` chez un porteur dont la référence est
 *  FACULTATIVE (entité, #1882 ; stade d'indice) — son propre schéma en juge la forme ; une `faute` chez
 *  un porteur qui l'EXIGE (Effect, indice). */
type VideDuPorteur = 'absence' | 'faute';

/** Les références que porte DIRECTEMENT `porteur` : ses clés de `REFERENCES_NARRATIVES`, et le `stade`
 *  de son `indiceId`. */
function sitesDuPorteur(porteur: Record<string, unknown>, chemin: Chemin, out: SiteDeRef[], vide: VideDuPorteur = 'faute'): void {
  for (const [cle, registre] of REFERENCES) {
    const v = porteur[cle];
    if (typeof v === 'string' && !(v === '' && vide === 'absence')) out.push({ chemin, porteur, cle, registre, id: v });
  }
  if (typeof porteur.indiceId === 'string' && typeof porteur.stade === 'string')
    out.push({ chemin, porteur, cle: 'stade', registre: REFERENCES_NARRATIVES.indiceId, id: porteur.stade, indiceId: porteur.indiceId });
}

function sitesDEffet(effet: unknown, chemin: Chemin, out: SiteDeRef[]): void {
  sitesDuPorteur(objet(effet), chemin, out);
  for (const porte of carriedFlows(effet)) sitesDeFlow(porte.flow, [...chemin, ...porte.chemin], out);
}

function sitesDeFlow(flow: Flow<unknown>, chemin: Chemin, out: SiteDeRef[]): void {
  walkFlow(flow, (noeud, sous: CheminDeFlow) => {
    if (noeud.kind === 'do') sitesDEffet(noeud.effect, [...chemin, ...sous, 'effect'], out);
  });
}

/** Les références d'UNE scène, chemins préfixés de `chemin`. */
export function sitesDeScene(scene: unknown, chemin: Chemin = []): SiteDeRef[] {
  const out: SiteDeRef[] = [];
  liste(objet(scene).entities).forEach((e, i) => sitesDuPorteur(objet(e), [...chemin, 'entities', i], out, 'absence'));
  for (const r of racinesDeFlow(scene)) if (isFlowNode(r.flow)) sitesDeFlow(r.flow, [...chemin, ...r.chemin], out);
  return out;
}

/** Les références de la carte du monde, chemins préfixés de `chemin`. */
export function sitesDeCarte(worldMap: unknown, chemin: Chemin = []): SiteDeRef[] {
  const out: SiteDeRef[] = [];
  liste(objet(worldMap).routes).forEach((route, i) =>
    liste(objet(route).perils).forEach((peril, j) =>
      liste(objet(peril).effects).forEach((effet, k) => sitesDEffet(effet, [...chemin, 'routes', i, 'perils', j, 'effects', k], out)),
    ),
  );
  return out;
}

/** Les références internes au narratif, chemins préfixés de `chemin`. */
export function sitesDuNarratif(narratif: unknown, chemin: Chemin = []): SiteDeRef[] {
  const out: SiteDeRef[] = [];
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

/** Les fautes des `sites` contre `narratif` : id vide (« aucun document choisi »), entrée inconnue, stade
 *  inconnu de son indice. */
export function fautesDeSites(sites: readonly SiteDeRef[], narratif: NarratifAReferences): FauteDeRefNarrative[] {
  const ids = Object.fromEntries(REFERENCES.map(([, reg]) => [reg, new Set(narratif[reg].map((x) => x.id))])) as Record<RegistreReference, Set<string>>;
  const indices = new Map(narratif.indices.map((ind) => [ind.id, ind]));
  const fautes: FauteDeRefNarrative[] = [];
  for (const s of sites) {
    const chemin = [...s.chemin, s.cle];
    if (s.cle === 'stade') {
      const ind = indices.get(s.indiceId!);
      if (ind && !ind.stades.some((st) => st.id === s.id)) fautes.push({ chemin, message: `stade inconnu « ${s.id} » de l'indice « ${ind.id} ».` });
    } else if (s.id === '') fautes.push({ chemin, message: `${aucunDe(s.registre)} : choisissez-en un au sélecteur (narratif.${s.registre}).` });
    else if (!ids[s.registre].has(s.id)) fautes.push({ chemin, message: `${inconnuDe(s.registre)} « ${s.id} » (narratif.${s.registre}).` });
  }
  return fautes;
}

/** Les fautes de référence narrative des scènes et de la carte du monde de `doc` contre `narratif` — la
 *  FK de la porte du projet ; celles du narratif lui-même sont au raffinage de `narratifSchema`. */
export function refsNarrativesPendantes(doc: ProjetAReferences, narratif: NarratifAReferences): FauteDeRefNarrative[] {
  return fautesDeSites([
    ...doc.scenes.flatMap((s, i) => sitesDeScene(s, ['scenes', i])),
    ...sitesDeCarte(doc.worldMap, ['worldMap']),
  ], narratif);
}

/** Ce que désigne une référence : l'entrée `id` du `registre`, ou le `stade` de l'indice `id`. */
export interface CibleNarrative {
  readonly registre: RegistreReference;
  readonly id: string;
  readonly stade?: string;
}

const vise = (s: SiteDeRef, c: CibleNarrative): boolean =>
  c.stade === undefined
    ? s.cle !== 'stade' && s.registre === c.registre && s.id === c.id
    : s.cle === 'stade' && c.registre === REFERENCES_NARRATIVES.indiceId && s.indiceId === c.id && s.id === c.stade;

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
