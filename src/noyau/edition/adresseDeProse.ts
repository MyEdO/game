/**
 * L'ADRESSE DE PROSE (`descRef`, #1389) d'un formulaire tiré du schéma (#3606 M2g) : ce que l'auteur en choisit, livre,
 * chapitre, section, genre de fragment, blocs, ou table, ligne et colonne d'une cellule, sur le chapitre que l'hôte a
 * chargé, et le scellement de chaque fragment écrit (`scelle`, `src/data/source/decoupe.ts`), seul point où naît une
 * empreinte : l'auteur ne la saisit jamais.
 *
 * Le chapitre arrive par l'hôte, du `Source/` que sert le poste de développement (`/source/manifest.json` et
 * `/source/<livre>/<NNN>.md`, `scripts/source/prose-source-plugin.mjs`) ; le noyau le parse (`parseChapitre`) et le
 * garde par `livre|chapitre` (`cleDuChapitre`), `null` s'il n'a pas pu se charger. Les libellés et les refus sont ceux
 * de l'éditeur web (`src/ui/compendium/DescRefField.tsx`).
 */
import type { ChapitreManifeste, Manifeste } from '../../data/source/chapitres';
import {
  MAX_FRAGMENTS, MIN_FRAGMENT, estErreur, estGraphieDeChapitre, fragmentBlocs, fragmentCellule, memeTexte, resoudreAdresse, scelle, stripSpans, tablesDeLaLigne, tablesOf,
  type ChapitreParse, type CodeErreur, type DescRef, type ErreurResolution, type Fragment, type Section, type TableDeSection,
} from '../../data/source/decoupe';
import { estAdresseDeProse } from '../../data/schemas/grammaire/valeurs';
import { coDescendre, estConteneur, noeudsAuChemin, ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { coupeAuMot } from '../../lib/coupeAuMot.mjs';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { estObjet } from '../../lib/objet.mjs';
import type { ChoixDuContexte } from '../codex/editFields';
import { gestesDeLaListe } from '../valeursNeuves';
import { t } from '../../i18n';

/** Un pas d'un chemin de donnée. */
type Segment = string | number;

/**
 * Ce que chaque code de refus du parseur veut dire À L'AUTEUR, et ce qu'il doit faire. La table est
 * TOTALE par le TYPE (`satisfies Record<CodeErreur, string>`) : un code neuf sans phrase ne
 * compile pas. Le détail technique du parseur reste disponible, en second rang — un code moteur brut
 * en première ligne n'est pas un texte d'auteur.
 */
export const PHRASE_REFUS = {
  'section-inconnue': 'Cette section n’existe pas dans le chapitre choisi — rechoisissez-en une dans la liste.',
  'bornes-hors-limites': 'Les numéros de bloc sortent de la section — la plage admise est indiquée à côté des champs.',
  'empreinte-divergente': 'Le texte du livre a changé sous cette adresse — relisez le passage, puis rescellez-la.',
  'ligne-introuvable': 'Aucune ligne de la table ne porte cette clé — choisissez-en une dans la liste.',
  'ligne-ambigue': 'Plusieurs lignes de la section portent cette clé — prenez une clé qui ne désigne qu’une ligne.',
  'table-sans-en-tetes': 'La table de cette section n’a pas d’en-têtes : une cellule ne s’y adresse pas — passez en « blocs ».',
  'colonne-inconnue': 'Cette colonne n’existe pas dans la table — choisissez un en-tête de la liste.',
  'fragment-trop-court': `Ce fragment est trop court pour un montage : il en faut au moins ${MIN_FRAGMENT} caractères — étendez les bornes de blocs.`,
  'fragment-ambigu': 'Ce texte apparaît plusieurs fois dans le chapitre : l’adresse désignerait un autre passage — étendez le fragment.',
  'fragments-chevauchants': 'Deux fragments de ce montage citent le même passage — déplacez l’un d’eux sur d’autres blocs.',
  'fragments-contigus': 'Ce fragment reprend au bloc qui suit le précédent : c’est un seul passage — écrivez-le en un seul fragment, en reportant sa fin sur celle de ce fragment.',
  'fin-avant-depart': 'La fin de ce fragment précède son départ dans le chapitre — choisissez une section et un bloc de fin situés après le départ.',
  'montage-hors-plafond': `Une adresse monte ${MAX_FRAGMENTS} fragments au plus — retirez-en un.`,
} satisfies Record<CodeErreur, string>;

/** `ligne-ambigue` quand la rangée PROPOSE le choix de la table : le remède est ce choix. */
export const PHRASE_LIGNE_AMBIGUE_TABLE = 'Plusieurs tables de la section portent cette clé — choisissez sa table dans la liste « table ».';

/** Adresse d'une section : c'est `slug#occ` que le fragment STOCKE, le titre n'est qu'un guide. */
export const cleSection = (slug: string, occ: number) => `${slug}#${occ}`;

/** Libellé d'une table TITRÉE : son titre, et son rang quand la section en porte plusieurs de ce titre. */
export function libelleTable(t: TableDeSection, toutes: TableDeSection[]): string {
  const memes = toutes.filter((u) => u.cle != null && memeTexte(u.table.titre ?? '', t.table.titre ?? ''));
  return memes.length > 1 ? `${t.table.titre} (${memes.findIndex((u) => u.cle === t.cle) + 1})` : t.table.titre ?? '';
}

/** Une section SANS titre est le PRÉAMBULE d'extraction (« Pages PDF 27-47 »), pas un passage du
 *  livre : elle se nomme comme tel et passe en fin de liste (`sectionsOrdonnees`). */
export const libelleSection = (s: Section) => `${cleSection(s.slug, s.occ)} — ${s.title || t('ecran.editeur.adresse.preambule')}`;
/** Sections TITRÉES d'abord, préambule en dernier — l'ordre du document est conservé dans chaque groupe. */
export const sectionsOrdonnees = (l: Section[]): Section[] => [...l.filter((s) => s.title), ...l.filter((s) => !s.title)];

/** Libellé d'un chapitre : son TITRE, jamais le nom de fichier de l'extraction (`17 - _GoBack.md`). */
export const libelleChapitre = (c: ChapitreManifeste) => `${c.ch} — ${c.titre || '(chapitre sans titre)'}`;

/** Ce que l'éditeur tient du `Source/` : l'index des chapitres servis (`null` : le poste ne le sert pas), et chaque
 *  chapitre chargé, par `cleDuChapitre`, `null` s'il n'a pas pu se charger. */
export interface SourceDeLEdition {
  manifeste: Manifeste | null;
  chapitres: Readonly<Record<string, ChapitreParse | null>>;
}

/** Le nœud `noeud` d'un champ est-il celui d'une adresse de prose, à travers ses enveloppes (`ouverts`) ? */
export const estChampDAdresse = (noeud: unknown): boolean => ouverts([noeud]).some(estAdresseDeProse);

/** La clé d'un chapitre : `livre|chapitre`. */
export const cleDuChapitre = (book: string, ch: string): string => `${book}|${ch}`;

/** Le chapitre que l'adresse `adresse` désigne : `undefined` sans chapitre choisi ou tant qu'il n'est pas chargé, `null` s'il n'a
 *  pas pu se charger. */
export function chapitreDeLAdresse(source: SourceDeLEdition, adresse: Pick<DescRef, 'book' | 'ch'>): ChapitreParse | null | undefined {
  return estGraphieDeChapitre(adresse.ch) ? source.chapitres[cleDuChapitre(adresse.book, adresse.ch)] : undefined;
}

/** Une adresse de prose d'une donnée, à son chemin. */
export interface AdresseAuChemin { chemin: readonly Segment[]; adresse: DescRef }

/** Les adresses de prose de la donnée `donnee` de schéma `schema`, chacune à son chemin : les objets dont le nœud est
 *  une adresse (`estAdresseDeProse`), par la co-descente (`coDescendre`). */
export function adressesDe(schema: unknown, donnee: unknown): AdresseAuChemin[] {
  const adresses: AdresseAuChemin[] = [];
  coDescendre(schema, donnee, (p) => {
    if (!estObjet(p.valeur) || !p.noeuds.some(estAdresseDeProse)) return undefined;
    adresses.push({ chemin: p.chemin, adresse: p.valeur as unknown as DescRef });
    return 'elaguer';
  });
  return adresses;
}

/** La valeur de `o` au chemin `chemin`, `undefined` hors de lui. */
const auChemin = (o: unknown, chemin: readonly Segment[]): unknown =>
  chemin.reduce<unknown>((v, pas) => (estObjet(v) || Array.isArray(v) ? (v as Record<Segment, unknown>)[pas] : undefined), o);

/** `o` où la valeur au chemin `[cle, ...reste]` vaut `v`. */
function pose(o: unknown, [cle, ...reste]: readonly Segment[], v: unknown): unknown {
  if (cle === undefined) return v;
  const suite = pose((o as Record<Segment, unknown>)[cle], reste, v);
  return Array.isArray(o) ? o.map((e, i) => (i === cle ? suite : e)) : { ...(o as object), [cle]: suite };
}

/** Le chemin `chemin` de la donnée `donnee`, de schéma `schema`, mène-t-il à ce qu'une adresse de prose dérive : l'empreinte
 *  d'un de ses fragments (`<adresse>/parts/<rang>/sum`), ou la prose de l'objet qui la porte (`desc`, que la forme
 *  vivante tient du texte qu'elle résout) ? Le formulaire ne l'offre pas, et ne l'écrit pas. */
export function estCheminDerive(schema: unknown, donnee: unknown, chemin: readonly Segment[]): boolean {
  const n = chemin.length;
  if (n >= 3 && chemin[n - 1] === 'sum' && chemin[n - 3] === 'parts') return noeudsAuChemin(schema, donnee, chemin.slice(0, -3)).some(estAdresseDeProse);
  const adresse = [...chemin.slice(0, -1), 'descRef'];
  return chemin[n - 1] === 'desc' && auChemin(donnee, adresse) !== undefined && noeudsAuChemin(schema, donnee, adresse).some(estAdresseDeProse);
}

/** La donnée `apres`, de schéma `schema`, où la valeur au chemin `chemin` de `avant` vient de changer, son adresse
 *  recalée : un livre qui change part sans chapitre ni fragment ; un chapitre qui change, sans fragment. */
export function adresseRecalee(schema: unknown, avant: unknown, apres: unknown, chemin: readonly Segment[]): unknown {
  const cle = chemin[chemin.length - 1];
  const ici = chemin.slice(0, -1);
  if ((cle !== 'book' && cle !== 'ch') || auChemin(avant, chemin) === auChemin(apres, chemin) || !noeudsAuChemin(schema, apres, ici).some(estAdresseDeProse)) return apres;
  const adresse = auChemin(apres, ici) as DescRef;
  return pose(apres, ici, cle === 'book' ? { book: adresse.book, ch: '', parts: [] } : { ...adresse, parts: [] });
}

/** La clé d'un fragment `f` de l'adresse `adresse` : son livre, son chapitre, sa désignation et son empreinte. */
const cleDuFragment = (adresse: Pick<DescRef, 'book' | 'ch'>, f: Fragment): string => `${cleDuChapitre(adresse.book, adresse.ch)}|${jsonCanonique(f)}`;

/** Le texte que l'adresse `adresse` résout sur le chapitre `chapitre` (`resoudreAdresse`), `undefined` s'il n'en résout
 *  aucun. */
function texteResolu(chapitre: ChapitreParse | null | undefined, adresse: DescRef): string | undefined {
  const resolue = chapitre && adresse.parts.length ? resoudreAdresse(chapitre, adresse) : undefined;
  return resolue && !estErreur(resolue) ? resolue.md : undefined;
}

/** La donnée `donnee` où l'adresse au chemin `chemin` s'écrit `adresse`, la prose de l'objet qui la porte (`desc`) posée
 *  à `desc`, retirée s'il est `undefined` ; `donnee` elle-même si rien ne change. */
function avecLAdresse(donnee: unknown, chemin: readonly Segment[], adresse: DescRef, desc: unknown): unknown {
  const porteur = chemin.slice(0, -1);
  const ici = auChemin(donnee, porteur) as Record<string, unknown>;
  const { desc: _desc, ...sans } = ici;
  const ecrit = { ...sans, [chemin[chemin.length - 1]]: adresse, ...(desc === undefined ? {} : { desc }) };
  return jsonCanonique(ecrit) === jsonCanonique(ici) ? donnee : pose(donnee, porteur, ecrit);
}

/** Le porteur `porteur` d'une adresse de clé `cle`, sans elle : ce qui l'identifie hors de son adresse, la prose
 *  qu'elle lui donne comprise. */
const sansLAdresse = (porteur: unknown, cle: Segment): string => {
  const { [cle]: _adresse, ...reste } = porteur as Record<Segment, unknown>;
  return jsonCanonique(reste);
};

/** `o` où chaque objet sans adresse que `retires` reconnaît (`sansLAdresse`), qui porte encore exactement la prose que
 *  son adresse lui donnait, la perd (`desc`) ; `o` lui-même si aucun ne la porte. */
function sansLaProseDesAdressesRetirees(o: unknown, retires: ReadonlyMap<string, Segment>): unknown {
  if (Array.isArray(o)) {
    const suite = o.map((e) => sansLaProseDesAdressesRetirees(e, retires));
    return suite.every((e, i) => e === o[i]) ? o : suite;
  }
  if (!estObjet(o)) return o;
  const objet = o as Record<Segment, unknown>;
  const enfants = Object.entries(objet).map(([k, v]) => [k, sansLaProseDesAdressesRetirees(v, retires)] as const);
  const neuf = enfants.some(([k, v]) => v !== objet[k]) ? Object.fromEntries(enfants) : objet;
  const { desc: _desc, ...sans } = neuf;
  const cle = 'desc' in neuf ? [...retires].find(([identite, c]) => !(c in neuf) && sansLAdresse(neuf, c) === identite) : undefined;
  return cle ? sans : neuf;
}

/**
 * La donnée `apres`, de schéma `schema`, écrite sur `avant`, chaque fragment d'adresse posé avec son empreinte : celui
 * que `avant` porte déjà, dans le même chapitre et avec la même empreinte, reste tel quel, à son rang ou à un autre ;
 * tout autre fragment est scellé sur son chapitre (`scelle`). Une empreinte écrite n'est donc jamais reprise : seul le
 * chapitre la donne, et une écriture qui en apporte une sans son chapitre chargé se refuse (`undefined`). La prose de
 * son porteur (`desc`) est celle du porteur d'`avant` qui porte la même adresse, à tout chemin, sinon celle qu'elle
 * résout (`texteResolu`) ; une adresse neuve qu'aucun chapitre chargé ne résout se refuse. Le porteur dont l'écriture
 * retire l'adresse (le même nœud d'`avant`, prose comprise, qui n'en porte plus) perd la prose qu'elle donnait.
 * Une prose écrite n'est jamais reprise. `apres` lui-même si rien ne change.
 */
export function adressesScellees(schema: unknown, avant: unknown, apres: unknown, source: SourceDeLEdition): unknown {
  const anciennes = adressesDe(schema, avant);
  const portes = new Set(anciennes.flatMap(({ adresse }) => adresse.parts.map((f) => cleDuFragment(adresse, f))));
  const proses = new Map(anciennes.map(({ chemin, adresse }) => [jsonCanonique(adresse), auChemin(avant, [...chemin.slice(0, -1), 'desc'])]));
  const retires = new Map(anciennes.map(({ chemin }) => [sansLAdresse(auChemin(avant, chemin.slice(0, -1)), chemin[chemin.length - 1]), chemin[chemin.length - 1]]));
  const scellee = adressesDe(schema, apres).reduce<unknown>((donnee, { chemin, adresse }) => {
    if (donnee === undefined) return undefined;
    const chapitre = chapitreDeLAdresse(source, adresse);
    const parts = adresse.parts.map((f) => (portes.has(cleDuFragment(adresse, f)) ? f : chapitre ? scelle(chapitre, f) : undefined));
    if (!parts.every((f) => f !== undefined)) return undefined;
    const ecrite = { ...adresse, parts };
    const cle = jsonCanonique(ecrite);
    if (!proses.has(cle) && parts.length > 0 && !chapitre) return undefined;
    return avecLAdresse(donnee, chemin, ecrite, proses.has(cle) ? proses.get(cle) : texteResolu(chapitre, ecrite));
  }, apres);
  return scellee === undefined ? undefined : sansLaProseDesAdressesRetirees(scellee, retires);
}

/** La donnée `donnee`, de schéma `schema`, l'adresse de prose au chemin `chemin` rescellée après relecture : chaque
 *  fragment scellé sur le chapitre chargé (`scelle`), la prose de son porteur rematérialisée (`avecLAdresse`) ;
 *  `undefined` si le chemin ne désigne pas une adresse ou que son chapitre n'est pas chargé. */
export function adresseRescellee(schema: unknown, donnee: unknown, chemin: readonly Segment[], source: SourceDeLEdition): unknown {
  const adresse = auChemin(donnee, chemin) as DescRef | undefined;
  if (!estObjet(adresse) || !noeudsAuChemin(schema, donnee, chemin).some(estAdresseDeProse)) return undefined;
  const chapitre = chapitreDeLAdresse(source, adresse);
  if (!chapitre) return undefined;
  const rescellee = { ...adresse, parts: adresse.parts.map((f) => scelle(chapitre, f)) };
  return avecLAdresse(donnee, chemin, rescellee, texteResolu(chapitre, rescellee));
}

/** Ce qu'une adresse montre à l'auteur : le `Source/` que le poste ne sert pas, l'adresse sans chapitre, son chapitre
 *  qui se charge ou qui n'a pas pu se charger, le texte qu'elle résout, ou le refus du parseur. */
export type EtatDeLAdresse =
  | { etat: 'sansSource' | 'sansChapitre' | 'enChargement' | 'introuvable' }
  | { etat: 'resolue'; md: string }
  | { etat: 'refusee'; erreur: ErreurResolution };

/** L'état de l'adresse `adresse` (`EtatDeLAdresse`) sur la source `source`. */
export function etatDeLAdresse(source: SourceDeLEdition, adresse: DescRef): EtatDeLAdresse {
  if (!source.manifeste) return { etat: 'sansSource' };
  const chapitre = chapitreDeLAdresse(source, adresse);
  if (chapitre === undefined) return { etat: estGraphieDeChapitre(adresse.ch) ? 'enChargement' : 'sansChapitre' };
  if (chapitre === null) return { etat: 'introuvable' };
  const r = resoudreAdresse(chapitre, adresse);
  return estErreur(r) ? { etat: 'refusee', erreur: r } : { etat: 'resolue', md: r.md };
}

/** Le libellé d'un bloc `md` au rang `rang` : son rang et le début de son texte. */
const libelleDuBloc = (md: string, rang: number): string => `${rang} — ${coupeAuMot(stripSpans(md).replace(/\s+/g, ' ').trim(), 60)}`;

/** Les choix d'une valeur. */
const choix = (valeur: unknown, libelle: string, refus: string | null = null): ChoixDuContexte => ({ valeur, libelle, refus });

/** Les sections adressables d'un chapitre : celles qui portent un bloc, titrées d'abord (`sectionsOrdonnees`). */
const sectionsAdressables = (chapitre: ChapitreParse): Section[] => sectionsOrdonnees(chapitre.sections.filter((s) => s.blocks.length > 0));

/** Le fragment de blocs neuf de la section `s` du chapitre `chapitre` : de son premier bloc à son dernier, scellé. */
const blocsNeufs = (chapitre: ChapitreParse, s: Section): Fragment => fragmentBlocs(chapitre, { sec: s.slug, secOcc: s.occ, b0: 0, b1: s.blocks.length - 1 });

/** Le fragment de cellule neuf de la section `s` du chapitre `chapitre`, ou `undefined` sans table : la première ligne
 *  de sa première table, à sa première colonne de contenu (la première est la colonne-clé), scellé. */
function celluleNeuve(chapitre: ChapitreParse, s: Section): Fragment | undefined {
  const table = tablesOf(s)[0]?.table;
  const col = table?.headers[1] ?? table?.headers[0];
  return table && col !== undefined ? fragmentCellule(chapitre, { sec: s.slug, secOcc: s.occ, row: table.rows[0]?.[0] ?? '', col }) : undefined;
}

/** Les choix d'un fragment au rang d'une adresse, sur le chapitre `chapitre` : présent, `f`, son genre courant le garde,
 *  l'autre le rebâtit sur sa section (refusé d'une section sans table) ; neuf, un fragment de blocs sur la première
 *  section adressable, et une cellule sur la première qui porte une table. */
function choixDuFragment(chapitre: ChapitreParse, f: Fragment | undefined): ChoixDuContexte[] {
  if (!f) {
    const sections = sectionsAdressables(chapitre);
    if (!sections.length) return [];
    const cellule = sections.map((s) => celluleNeuve(chapitre, s)).find((c) => c !== undefined);
    return [choix(blocsNeufs(chapitre, sections[0]), 'blocs'), ...(cellule ? [choix(cellule, 'cellule')] : [])];
  }
  const section = chapitre.sections.find((s) => s.slug === f.sec && s.occ === f.secOcc);
  const cellule = section && celluleNeuve(chapitre, section);
  return [
    choix(f.kind === 'blocs' ? f : section ? blocsNeufs(chapitre, section) : fragmentBlocs(chapitre, { sec: f.sec, secOcc: f.secOcc, b0: 0, b1: 0 }), 'blocs'),
    choix(f.kind === 'cellule' ? f : cellule ?? f, 'cellule', f.kind === 'cellule' || cellule ? null : PHRASE_REFUS['table-sans-en-tetes']),
  ];
}

/** Les fragments `parts` d'une adresse après chacun de leurs gestes (`gestesDeLaListe`) : retiré, monté, et, sur le
 *  chapitre chargé `chapitre`, chaque fragment neuf ajouté (`choixDuFragment`). */
function choixDesFragments(chapitre: ChapitreParse | null | undefined, parts: readonly Fragment[]): ChoixDuContexte[] {
  const { elements } = gestesDeLaListe(parts, undefined);
  const ajouts = chapitre ? choixDuFragment(chapitre, undefined).map((c) => choix([...parts, c.valeur], c.libelle)) : [];
  return [...ajouts, ...elements.flatMap(({ retirer, monter }) => [retirer, ...(monter ? [monter] : [])]).map((l) => choix(l, ''))];
}

/** Les slugs des sections adressables, chacun une fois, sous le libellé de sa première occurrence. */
const choixDesSections = (chapitre: ChapitreParse): ChoixDuContexte[] =>
  sectionsAdressables(chapitre).filter((s, i, l) => l.findIndex((u) => u.slug === s.slug) === i).map((s) => choix(s.slug, libelleSection(s)));

/** Les occurrences de la section `slug`. */
const choixDesOccurrences = (chapitre: ChapitreParse, slug: string): ChoixDuContexte[] =>
  chapitre.sections.filter((s) => s.slug === slug).map((s) => choix(s.occ, libelleSection(s)));

/** Les blocs de la section `slug#occ`, chacun par son rang. */
const choixDesBlocs = (chapitre: ChapitreParse, slug: string, occ: number): ChoixDuContexte[] =>
  chapitre.sections.find((s) => s.slug === slug && s.occ === occ)?.blocks.map((b, i) => choix(i, libelleDuBloc(b.md, i))) ?? [];

/** Les choix de la clé `cle` du fragment de cellule `f`, dans sa section `section` : sa ligne parmi les clés des
 *  rangées de ses tables ; sa colonne parmi les en-têtes des tables qui portent sa ligne (dans sa table, si elle est
 *  posée), ou de toutes ; sa table parmi les tables titrées qui portent sa ligne, ou toutes les titrées. */
function choixDeLaCellule(section: Section, f: Extract<Fragment, { kind: 'cellule' }>, cle: Segment): ChoixDuContexte[] | undefined {
  const tables = tablesOf(section);
  if (cle === 'row') return [...new Set(tables.flatMap((t) => t.table.rows.map((r) => r[0])))].map((r) => choix(r, r));
  if (cle === 'col') {
    const deLaLigne = tablesDeLaLigne(section, f.row, f.table);
    return [...new Set((deLaLigne.length ? deLaLigne : tables).flatMap((t) => t.table.headers))].map((c) => choix(c, c));
  }
  if (cle !== 'table') return undefined;
  const portent = tablesDeLaLigne(section, f.row).filter((t) => t.cle != null);
  return (portent.length ? portent : tables.filter((t) => t.cle != null)).map((t) => choix(t.cle, libelleTable(t, tables)));
}

/**
 * Les choix que l'adresse de prose `adresse` (`undefined` : absente) pose au chemin `reste` sous elle, sur la source
 * `source` ; `undefined` : ceux de son nœud. Absente, chaque livre servi, à composer ; son livre, chaque livre servi ;
 * son chapitre, chaque chapitre du livre ; sous ses fragments, rien sans chapitre chargé, sinon le fragment au rang
 * (`choixDuFragment`), sa section, son occurrence, ses bornes de blocs, et la ligne, la colonne et la table d'une
 * cellule (`choixDeLaCellule`). Un fragment choisi est bâti scellé (`fragmentBlocs`, `fragmentCellule`), l'écriture
 * le rescelle s'il change (`adressesScellees`).
 */
export function choixDeLAdresse(source: SourceDeLEdition, adresse: DescRef | undefined, reste: readonly Segment[]): readonly ChoixDuContexte[] | undefined {
  const livres = () => Object.entries(source.manifeste ?? {}).map(([book, { abbr }]) => ({ book, abbr }));
  if (adresse === undefined) return reste.length ? undefined : livres().map(({ book, abbr }) => choix({ book, ch: '', parts: [] }, abbr));
  const [cle, rang, champ, ...plus] = reste;
  if (cle === 'book' && rang === undefined) return livres().map(({ book, abbr }) => choix(book, abbr));
  if (cle === 'ch' && rang === undefined) return (source.manifeste?.[adresse.book]?.chapitres ?? []).map((c) => choix(c.ch, libelleChapitre(c)));
  if (cle !== 'parts' || plus.length) return undefined;
  const chapitre = chapitreDeLAdresse(source, adresse);
  if (rang === undefined) return choixDesFragments(chapitre, adresse.parts);
  if (typeof rang !== 'number') return undefined;
  if (!chapitre) return [];
  const f = adresse.parts[rang];
  if (champ === undefined) return choixDuFragment(chapitre, f);
  if (!f) return [];
  if (champ === 'sec' || champ === 'finSec') return choixDesSections(chapitre);
  if (champ === 'secOcc') return choixDesOccurrences(chapitre, f.sec);
  if (f.kind === 'blocs') {
    if (champ === 'finSecOcc') return choixDesOccurrences(chapitre, f.finSec ?? f.sec);
    if (champ === 'b0') return choixDesBlocs(chapitre, f.sec, f.secOcc);
    if (champ === 'b1') return choixDesBlocs(chapitre, f.finSec ?? f.sec, f.finSecOcc ?? f.secOcc);
    return undefined;
  }
  const section = chapitre.sections.find((s) => s.slug === f.sec && s.occ === f.secOcc);
  return section ? choixDeLaCellule(section, f, champ) : [];
}

/** Les choix que la donnée `donnee`, de schéma `schema`, pose au chemin `chemin` sous la première adresse de prose qu'il
 *  traverse ou désigne (`choixDeLAdresse`), sur la source `source` ; `undefined` hors d'une adresse. */
export function choixSousUneAdresse(schema: unknown, donnee: unknown, chemin: readonly Segment[], source: SourceDeLEdition): readonly ChoixDuContexte[] | undefined {
  let valeur = donnee;
  let noeuds = ouverts([schema], valeur);
  for (let k = 0; ; k++) {
    if (noeuds.some(estAdresseDeProse)) return choixDeLAdresse(source, estObjet(valeur) ? (valeur as unknown as DescRef) : undefined, chemin.slice(k));
    if (k === chemin.length) return undefined;
    valeur = estConteneur(valeur) ? valeur[chemin[k]] : undefined;
    noeuds = ouverts(pasDeDonnee(noeuds, chemin[k]), valeur);
  }
}
