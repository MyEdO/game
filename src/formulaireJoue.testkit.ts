/**
 * LE JEU DES OFFRES D'UN FORMULAIRE TIRÉ DU SCHÉMA (garde #841, #4020), pour tout porteur : les éléments qu'un hôte
 * en tire (`src/hote/formulaire.ts`) offrent le geste `valeur` ; chaque offre se joue comme le pont la reçoit, son jeu
 * passé en JSON et validé par les zones de son porteur, et chaque écriture devient un `EcritureJouee`, le document relu
 * avant et après, que la garde crédite (`scripts/guards/lib/editabiliteDesChamps.mjs`). Ce qui diffère d'un porteur
 * à l'autre, ses zones, leur validation, le jeu d'un geste et la lecture de sa donnée, est son banc
 * (`BancDuFormulaire`) : l'éditeur de scène (`src/ecrituresJouees.testkit.ts`), le Compendium
 * (`src/compendiumJoue.testkit.ts`).
 */
import type { Bouton, Choix, Formulaire, Jeu, Ligne } from './hote/elements';
import type { Segment } from './noyau/index';
import { isDeepStrictEqual } from 'node:util';
import { auChemin, estObjet } from './lib/objet.mjs';
import {
  champsDeclares,
  choixDuNoeud,
  elementDuNoeud,
  estTransparent,
  recordDuNoeud,
  unionDuNoeud,
  varianteCourante,
  videDuNoeud,
} from './noyau/codex/editFields';
import { defDe, noeudsAuChemin, ouverts } from './data/schemas/grammaire/descente';
import type { EcritureJouee } from '../scripts/guards/lib/editabiliteDesChamps.mjs';

// ─── Le champ du schéma ─────────────────────────────────────────────────────────────────────────────────────────────

/** Le champ de nœud `noeud` est-il requis et d'une seule valeur, littérale ou d'un enum à une option : un champ que
 *  l'auteur ne choisit pas, sauf champ direct d'une variante d'union, que le choix de sa variante écrit (#841) ? */
export const litteralFige = (noeud: unknown): boolean => videDuNoeud(noeud) !== undefined && ouverts([noeud]).filter((n) => !estTransparent(n)).every((n) => ['literal', 'enum'].includes(defDe(n)?.type ?? '')) && choixDuNoeud(noeud)?.length === 1;

/** Les clés de la variante `valeur`, choisie au chemin `chemin` de l'ancre `ancre` (`BancDuFormulaire.schema`), qu'un
 *  littéral fige (`litteralFige`) : le choix de la variante les écrit. */
function clesFigees(ancre: { noeud: unknown; donnee: unknown } | undefined, chemin: readonly Segment[], valeur: unknown): string[] {
  if (ancre === undefined || !estObjet(valeur)) return [];
  const variantes = ouverts(noeudsAuChemin(ancre.noeud, ancre.donnee, chemin), valeur);
  return Object.keys(valeur).filter((cle) => variantes.some((n) => noeudsAuChemin(n, valeur, [cle]).some(litteralFige)));
}

/** Le pas abstrait de la variante `cle` d'une union au discriminant `discriminant`. */
export const pasDeVariante = (discriminant: string, cle: string): string => `<${discriminant}=${cle}>`;

/** Le pas abstrait d'un rang de liste, et celui d'une clé de record. */
export const RANG = '#';
export const CLE_DE_RECORD = '*';

/** La lecture `lire` d'un nœud, mémoïsée par nœud : le schéma ne change pas pendant le banc. */
function parNoeud<T>(lire: (noeud: unknown) => T): (noeud: unknown) => T {
  const lus = new WeakMap<object, { v: T }>();
  return (noeud) => {
    if (noeud === null || typeof noeud !== 'object') return lire(noeud);
    const lu = lus.get(noeud);
    if (lu) return lu.v;
    const v = lire(noeud);
    lus.set(noeud, { v });
    return v;
  };
}

export const union = parNoeud(unionDuNoeud);

/** Les formes concrètes de la fermeture du nœud : objets, listes et records (`ouverts`, `estTransparent`). */
export const formesConcretes = parNoeud((noeud: unknown): unknown[] =>
  ouverts([noeud]).filter((n) => !estTransparent(n) && ['object', 'array', 'tuple', 'record'].includes(defDe(n)?.type ?? '')));

/** Les clés que pose un record de nœud `record` (`recordDuNoeud`) : les valeurs de son nœud de clé (`choixDuNoeud`) ;
 *  aucune d'un record à clé ouverte. */
export const clesDuRecord = parNoeud((record: unknown): string[] => (choixDuNoeud(recordDuNoeud(record)?.cle) ?? []).map((c) => String(c.valeur)));

/** L'identité d'un nœud de schéma, stable pendant le banc. */
const rangs = new WeakMap<object, number>();
let rangsDonnes = 0;
export const rangDu = (noeud: object): number => rangs.get(noeud) ?? rangs.set(noeud, rangsDonnes++).get(noeud)!;

/** L'id d'un CHAMP : la forme concrète qui le déclare (un objet, ou un record à clés posées) et sa clé. Un champ est la
 *  déclaration de sa forme, comme à #841 : atteint par plusieurs chemins, il est un champ. */
export const idDuChamp = (forme: object, cle: string): string => `${rangDu(forme)}#${cle}`;

/** L'id d'un discriminant TENU par une union englobante : sa variante, l'union et sa clé, quelle que soit la branche
 *  d'une sous-union qui le redéclare. */
export const idDuDiscriminant = (u: { noeud: unknown; discriminant: string }, cle: string): string => `${rangDu(u.noeud as object)}${pasDeVariante(u.discriminant, cle)}`;

/** Le pas `pas` de la donnée `valeur` du nœud `noeud` : chaque union traversée par la variante courante de la donnée
 *  (`varianteCourante`), puis, parmi les formes concrètes du nœud, l'élément d'une liste ou d'un tuple à son rang, le champ déclaré d'un objet,
 *  ou la valeur d'un record ; le nœud de l'enfant, et le champ que le pas désigne (`idDuChamp`, celui de sa variante
 *  pour un discriminant tenu, `idDuDiscriminant`), aucun pour un rang ou une clé de record ouverte ; `undefined` si le
 *  schéma n'y mène pas. Chaque variante traversée s'ajoute à `cas`. */
export function pasDuNoeud(noeud: unknown, valeur: unknown, pas: Segment, cas?: Set<string>): { noeud: unknown; champ?: string } | undefined {
  let n = noeud;
  const tenus: Record<string, string> = {};
  for (let u = union(n); u; u = union(n)) {
    const courante = varianteCourante(u, valeur);
    if (courante?.noeud === undefined) return undefined;
    const variante = idDuDiscriminant(u, courante.cle);
    cas?.add(variante);
    if (u.discriminant) tenus[u.discriminant] = variante;
    n = courante.noeud;
  }
  const formes = formesConcretes(n);
  if (typeof pas === 'number') {
    const liste = formes.find((f) => elementDuNoeud(f) !== undefined);
    return liste === undefined ? undefined : { noeud: elementDuNoeud(liste, pas) };
  }
  const cles = estObjet(valeur) ? Object.keys(valeur) : [];
  const objets = formes.filter((f) => champsDeclares(f)?.some(([cle]) => cle === pas));
  const objet = objets.find((f) => cles.every((k) => champsDeclares(f)!.some(([cle]) => cle === k))) ?? objets[0];
  if (objet !== undefined) return { noeud: champsDeclares(objet)!.find(([cle]) => cle === pas)![1], champ: tenus[pas] ?? idDuChamp(objet as object, pas) };
  const record = formes.find((f) => recordDuNoeud(f) !== undefined);
  if (record === undefined) return undefined;
  return { noeud: recordDuNoeud(record)!.valeur, ...(clesDuRecord(record).includes(pas) ? { champ: idDuChamp(record as object, pas) } : {}) };
}

/** Les pas du chemin `chemin` de la donnée `donnee` de nœud `noeud`, de pas en pas (`pasDuNoeud`), chacun avec son
 *  nœud et le champ qu'il désigne ; s'arrête où le schéma n'y mène pas. */
function pasDuChemin(noeud: unknown, donnee: unknown, chemin: readonly Segment[]): { noeud: unknown; champ?: string }[] {
  const pas: { noeud: unknown; champ?: string }[] = [];
  let ici: { noeud: unknown; champ?: string } = { noeud };
  let v = donnee;
  for (const p of chemin) {
    const suite = pasDuNoeud(ici.noeud, v, p);
    if (!suite) break;
    pas.push(suite);
    ici = suite;
    v = estObjet(v) || Array.isArray(v) ? (v as Record<Segment, unknown>)[p] : undefined;
  }
  return pas;
}

/** Le nœud au chemin `chemin` de la donnée `donnee` de nœud `noeud` (`pasDuChemin`), et le champ que désigne son
 *  dernier pas ; `undefined` si le schéma n'y mène pas. */
export function marcher(noeud: unknown, donnee: unknown, chemin: readonly Segment[]): { noeud: unknown; champ?: string } | undefined {
  const pas = pasDuChemin(noeud, donnee, chemin);
  return pas.length < chemin.length ? undefined : pas[pas.length - 1] ?? { noeud };
}

/** Le champ (`idDuChamp`) que désigne le dernier pas du chemin `chemin` de la donnée `donnee` de nœud `noeud`
 *  (`marcher`) ; `undefined` sans lui. */
export const champDuChemin = (noeud: unknown, donnee: unknown, chemin: readonly Segment[]): string | undefined => marcher(noeud, donnee, chemin)?.champ;

/** Le champ qu'écrit une écriture au chemin `chemin` de la donnée `donnee` de nœud `noeud` : celui du dernier pas de
 *  clé de son chemin (`champDuChemin`), suivi d'un `#` par rang qui le suit ; `undefined` sans lui. */
export function champEcrit(noeud: unknown, donnee: unknown, chemin: readonly Segment[]): string | undefined {
  let cle = chemin.length;
  while (cle > 0 && typeof chemin[cle - 1] === 'number') cle--;
  const champ = champDuChemin(noeud, donnee, chemin.slice(0, cle));
  return champ === undefined ? undefined : `${champ}${RANG.repeat(chemin.length - cle)}`;
}

/** Le chemin `chemin` de la donnée `donnee` de nœud `noeud` traverse-t-il deux fois le même champ (`pasDuChemin`) :
 *  un schéma récursif (le Trait conféré d'un Trait), qui se joue à son premier niveau ? Le même champ deux fois porte
 *  deux fois la même clé : seul un tel chemin se descend. */
function recursif(noeud: unknown, donnee: unknown, chemin: readonly Segment[]): boolean {
  const cles = chemin.filter((p) => typeof p === 'string');
  if (new Set(cles).size === cles.length) return false;
  const champs = pasDuChemin(noeud, donnee, chemin).flatMap((p) => p.champ ?? []);
  return new Set(champs).size < champs.length;
}

/** Un élément d'un formulaire tiré du schéma, tel que ses zones le portent. */
type Element = Choix | Ligne | Bouton | Formulaire;

/** Le geste `valeur` d'un porteur : écrire `valeur` au chemin `chemin` de sa donnée (absente : le champ se retire). */
interface GesteDeValeur { geste: 'valeur'; chemin: Segment[]; valeur?: unknown }

/** Ce qu'un porteur donne au jeu de ses offres, de session `S`, de zones `Z`, de gestes `G` :
 *  - `zones`, celles de la session que lit le jeu de ses offres, et `elements`, les éléments de son formulaire ;
 *  - `deballe`, le geste qu'emballe le jeu d'un bouton ; `geste`, celui que valident les zones d'un jeu reçu en JSON ;
 *  - `jouer`, la session après un geste ;
 *  - `porteur`, la clé qui nomme le porteur d'un geste `valeur`, sa donnée et son chemin depuis son document ;
 *    `document`, ce document, que la garde relit avant et après ;
 *  - `schema`, le nœud du schéma du porteur qu'écrit le jeu d'une offre et sa donnée, où se lit le champ qu'écrit une
 *    offre (`champEcrit`) : un chemin qui traverse deux fois le même champ ne se joue pas (`recursif`) ;
 *  - `explorerLesUnions`, qui joue leurs variantes par identité de schéma et dédouble les offres au champ ;
 *  - `exemplaires`, les valeurs que le corpus du porteur porte au nœud de schéma d'un champ. Ce corpus ouvre aussi
 *    l'exploration des unions et le rejeu d'une écriture que le porteur refuse (`valeurDeRepli`, `exemplaireDe`). */
export interface BancDuFormulaire<S, Z, G extends { geste: string }> {
  zones(s: S): Z;
  elements(z: Z): readonly Element[];
  deballe(jeu: Jeu): unknown;
  geste(z: Z, s: S, jeu: Jeu): G | undefined;
  jouer(s: S, g: G): S;
  porteur(s: S, g: Extract<G, GesteDeValeur>): { cle: string; donnee: unknown; chemin: Segment[]; noeud?: unknown } | undefined;
  document(s: S, g: Extract<G, GesteDeValeur>): unknown;
  schema(s: S, jeu: Jeu): { noeud: unknown; donnee: unknown } | undefined;
  explorerLesUnions?: (noeud: unknown) => boolean;
  exemplaires?: (noeud: unknown) => readonly unknown[];
}

/** L'union que choisit le choix de dernier pas `discriminant` (`forme` d'une union sans discriminant) au chemin
 *  `chemin` de la donnée de nœud de l'`ancre` : le rang du nœud de l'union (`rangDu`), parmi celles qu'ouvre la donnée
 *  à son chemin (`varianteCourante`) ; le champ que le choix pose (`champEcrit`) si aucune union ne porte ce
 *  discriminant ; `undefined` hors du schéma. */
function unionDuChoix(ancre: { noeud: unknown; donnee: unknown } | undefined, chemin: readonly Segment[], discriminant: string, explore?: (noeud: unknown) => boolean): string | undefined {
  if (!ancre) return undefined;
  const champ = champEcrit(ancre.noeud, ancre.donnee, chemin);
  const valeur = auChemin(ancre.donnee, chemin);
  let n = marcher(ancre.noeud, ancre.donnee, chemin)?.noeud;
  for (;;) {
    const u = union(n);
    if (!u) return champ;
    if (u.discriminant === discriminant || (u.discriminant === '' && discriminant === 'forme')) {
      return !explore || explore(u.noeud) ? String(rangDu(u.noeud as object)) : undefined;
    }
    n = varianteCourante(u, valeur)?.noeud;
  }
}

/** Ce qu'un élément du formulaire offre de jouer au geste `valeur` : son id, le jeu de l'élément, sa saisie, le chemin
 *  qu'il écrit et la valeur qu'il y pose, s'il emporte des champs (`emporte` : le retrait d'un élément de liste, son
 *  déplacement, le choix d'une autre variante d'union), à jouer après ceux qu'il emporte, et le jeu de REPLI d'une
 *  saisie de texte que le porteur refuse (`repli`, `valeurDeRepli`), et le jeu d'une autre valeur de sa saisie
 *  (`poser`). Le geste d'un élément de liste à son rang (`rang` : « Ajouter », « Retirer », « Monter ») écrit la liste
 *  qui le porte, au chemin de celle-ci, sa valeur lue après lui ; l'ajout d'une clé à un record à clé ouverte (`cle`,
 *  la saisie de sa clé) écrit de même le record. */
interface Offre { id: string; jeu: Jeu; saisie: string; chemin: Segment[]; valeur: unknown; emporte: boolean; rang?: true; cle?: true; repli?: Jeu; poser?: (valeur: unknown) => Jeu }

/** Au plus autant de gestes joués : la boucle se termine même si un formulaire en ouvrait sans fin. */
const GESTES_AU_PLUS = 4000;

/** La valeur à jouer dans la saisie `s` d'un formulaire `valeur` : un nombre autre que le courant, dans ses bornes ; un
 *  texte ; une liste vide pour du JSON. */
function valeurSaisie(s: Formulaire['champs'][number]): unknown {
  switch (s.type) {
    case 'saisieNombre': return s.valeur + s.pas <= s.max ? s.valeur + s.pas : s.valeur - s.pas;
    case 'saisieTexte':
    case 'saisieMultiligne': return 'texte joué';
    default: return [];
  }
}

/** Le texte de repli de la saisie `s` d'un formulaire `valeur`, quand le texte joué (`valeurSaisie`) est refusé : son
 *  texte courant préfixé, qui garde sa forme (une extension, un identifiant) ; `undefined` sans texte courant. */
function valeurDeRepli(s: Formulaire['champs'][number]): string | undefined {
  return (s.type === 'saisieTexte' || s.type === 'saisieMultiligne') && s.valeur !== '' ? `j${s.valeur}` : undefined;
}

/** L'élément d'id `id`, qui écrit au chemin `chemin`, est-il « Ajouter » d'une liste, au rang qui suit son dernier
 *  élément (`valeur/<chemin de la liste>/ajouter`, ou l'une de ses valeurs) ? */
const ajoutAuRang = (id: string, chemin: readonly Segment[]): boolean => {
  const ajout = `valeur/${chemin.slice(0, -1).join('/')}/ajouter`;
  return typeof chemin[chemin.length - 1] === 'number' && (id === ajout || id.startsWith(`${ajout}/`));
};

/** Les offres du geste `valeur` des éléments `elements` d'un porteur au banc `banc` : un bouton qui pose une valeur
 *  (« Ajouter »), ou qui ajoute, retire ou monte un élément de liste à son rang (`Offre.rang`) ; la première valeur non pressée
 *  d'un choix, qui emporte des champs si elle choisit une variante (son id n'est pas celui de son chemin) ; un
 *  formulaire, sa saisie remplie (`valeurSaisie`). Un retrait (« Retirer »,
 *  « Aucune ») hors d'un élément de liste ne pose aucune valeur et ne s'offre pas. */
function offres<S, Z, G extends { geste: string }>(banc: BancDuFormulaire<S, Z, G>, elements: readonly Element[]): Offre[] {
  return elements.flatMap((e): Offre[] => {
    if (e.type === 'bouton') {
      const g = banc.deballe(e.jeu);
      if (!estObjet(g) || !Array.isArray(g.chemin)) return [];
      const chemin = g.chemin as Segment[];
      const pose = g.geste === 'valeur' && 'valeur' in g;
      if (pose && !ajoutAuRang(e.id, chemin)) return [{ id: e.id, jeu: e.jeu, saisie: 'bouton', chemin, valeur: g.valeur, emporte: false }];
      const auRang = typeof chemin[chemin.length - 1] === 'number' && (g.geste === 'monter' || g.geste === 'valeur');
      return auRang ? [{ id: e.id, jeu: e.jeu, saisie: 'bouton', chemin: chemin.slice(0, -1), valeur: [], emporte: !pose, rang: true }] : [];
    }
    if (e.type === 'choix' || e.type === 'liste') {
      const b = e.valeurs.find((v) => !v.presse && 'type' in v.jeu && v.jeu.type === 'valeur');
      const [ecrit, pose] = (b && 'args' in b.jeu ? b.jeu.args.slice(1) : [[]]) as [Segment[], unknown];
      const rang = ajoutAuRang(e.id, ecrit);
      const [chemin, valeur] = rang ? [ecrit.slice(0, -1), []] : [ecrit, pose];
      return b ? [{ id: e.id, jeu: b.jeu, saisie: 'saisieChoix', chemin, valeur, emporte: e.id !== `valeur/${chemin.join('/')}`, ...(rang ? { rang: true as const } : {}) }] : [];
    }
    if (e.type !== 'formulaire' || e.verbe !== 'valeur') return [];
    const [porteur, chemin, neuve, cle] = e.champs;
    if (cle?.nom === 'cle' && porteur.type === 'fixe' && chemin.type === 'fixe' && neuve.type === 'fixe' && cle.type === 'saisieTexte') {
      const poser = (c: unknown): Jeu => ({ type: 'valeur', args: [porteur.valeur, chemin.valeur, neuve.valeur, c] });
      return [{ id: e.id, jeu: poser(valeurSaisie(cle)), saisie: cle.type, chemin: chemin.valeur as Segment[], valeur: {}, emporte: false, rang: true, cle: true, poser }];
    }
    const saisie = neuve;
    if (porteur.type !== 'fixe' || chemin.type !== 'fixe' || !saisie) return [];
    const repli = valeurDeRepli(saisie);
    const jeu = (valeur: unknown): Jeu => ({ type: 'valeur', args: [porteur.valeur, chemin.valeur, valeur] });
    const valeur = valeurSaisie(saisie);
    return [{ id: e.id, jeu: jeu(valeur), saisie: saisie.type, chemin: chemin.valeur as Segment[], valeur, emporte: false, poser: jeu, ...(repli === undefined ? {} : { repli: jeu(repli) }) }];
  });
}

/** La FORME d'une valeur : ses clés, pour un objet, chacun des `discriminants` avec sa valeur ; sinon son type. */
const forme = (v: unknown, discriminants: ReadonlySet<string>): string =>
  Array.isArray(v) ? '[]' : estObjet(v) ? Object.keys(v).sort().map((k) => (discriminants.has(k) ? `${k}=${JSON.stringify(v[k])}` : k)).join(',') : typeof v;

/** L'empreinte d'une écriture de la valeur `valeur` portée par la saisie `saisie` au champ `champ` : sa forme, sous les
 *  `discriminants` des variantes déjà choisies dans la partie (`forme`). */
const empreinteAuChamp = (champ: string, saisie: string, valeur: unknown, discriminants: ReadonlySet<string>): string =>
  JSON.stringify([champ, saisie, forme(valeur, discriminants)]);

/** Les empreintes déjà jouées de chaque partie, par son `out`. */
const empreintesJouees = new WeakMap<EcritureJouee[], Set<string>>();

/** Les variantes de chaque union dont la branche est jouée dans chaque partie (`jouerLesVariantes`), par son `out`. */
const variantesJouees = new WeakMap<EcritureJouee[], Set<string>>();

/** Les unions dont une autre variante que la pressée est choisie sous chaque champ dans chaque partie
 *  (`jouerLesVariantes`), par son `out`. */
const unionsPosees = new WeakMap<EcritureJouee[], Set<string>>();

/** Les clés que le choix de chaque variante a changées dans chaque partie (`jouerLesVariantes`, `clesChangees`), par
 *  son `out`. */
const clesPosees = new WeakMap<EcritureJouee[], Set<string>>();

/** Les clés de la variante `variante` que son choix écrit et change, quittant la valeur `quittee` (`consigner`) :
 *  portant son `discriminant` sur une quittée objet, celui-ci s'il diffère et chaque clé que la quittée ne porte pas ;
 *  sinon, chaque clé de valeur autre ; la clé vide d'une variante qui n'est pas un objet. */
const clesChangees = (quittee: unknown, variante: unknown, discriminant: string): string[] => {
  if (!estObjet(variante)) return isDeepStrictEqual(quittee, variante) ? [] : [''];
  const avant = estObjet(quittee) ? quittee : {};
  return Object.keys(variante).filter((cle) => (discriminant in variante && estObjet(quittee)
    ? (cle === discriminant ? avant[cle] !== variante[cle] : !(cle in avant))
    : !isDeepStrictEqual(avant[cle], variante[cle])));
};

/** Les clés des discriminants des variantes choisies dans chaque partie (`ecrire`), par son `out`. */
const discriminantsJoues = new WeakMap<EcritureJouee[], Set<string>>();

/** L'ensemble de la partie `out` dans `table`, créé vide. */
const deLaPartie = <T>(table: WeakMap<EcritureJouee[], Set<T>>, out: EcritureJouee[]): Set<T> => table.get(out) ?? table.set(out, new Set()).get(out)!;

/** Un chapitre du `Source/` versionné dont la première section à table porte une table titrée : le chapitre 13 du
 *  Livre de base (« Localisation »), où une cellule se désigne avec sa table. */
const CHAPITRE_A_TABLE = { book: 'livre-de-base', ch: '13' } as const;

/** Un chapitre du `Source/` versionné où une section à table revient (`secOcc`) : les « Armures » du chapitre 63 du
 *  Livre de base. */
const CHAPITRE_A_OCCURRENCES = { book: 'livre-de-base', ch: '63', sec: 'armures' } as const;

/** Le fragment `v` est-il une cellule ? */
const estCellule = (v: unknown): boolean => estObjet(v) && v.kind === 'cellule';

/** Le choix d'id `id`, qui écrit au chemin `chemin`, choisit-il la variante d'une union : son id est celui de son
 *  chemin suivi de son discriminant (`…/forme` d'une union sans discriminant), jamais « Ajouter » ? */
const estLeChoixDUneVariante = (id: string, chemin: readonly Segment[]): boolean => {
  const sous = `valeur/${chemin.join('/')}/`;
  const pas = id.slice(sous.length);
  return id.startsWith(sous) && pas !== 'ajouter' && !pas.includes('/');
};

/** Le choix d'id `id` des éléments `elements`. */
function choixDes(elements: readonly Element[], id: string): Choix {
  const choix = elements.find((e): e is Choix => (e.type === 'choix' || e.type === 'liste') && e.id === id);
  if (!choix) throw new Error(`aucun choix ${id} dans le formulaire`);
  return choix;
}

/** Le jeu des offres du formulaire du porteur au banc `banc` :
 *  - `jouerLInspecteur`, la session où chaque offre de son formulaire est jouée une fois, celles qui emportent des
 *    champs après les autres, la plus profonde d'abord, jusqu'à ce qu'aucune ne reste ; le choix d'une autre variante
 *    rouvre les offres de ses champs, ou, pour une union à explorer, joue chacune d'elles
 *    (`jouerLesVariantes`) sous son union, avant toute autre offre, le choix le moins profond d'abord, sur le document
 *    le plus petit ; seules jouent les offres dont l'id commence par l'une des `branches` (toutes, par défaut), hors
 *    de celles qui traversent deux fois le même champ (`estRecursive`), qui tronquent la branche (`tronquee`) ; chaque écriture s'ajoute à `out` (`ecrire`), le discriminant du choix d'une
 *    variante à l'id de son choix (`valeur/<chemin>/<discriminant>`). Une offre dont l'empreinte (`empreinte`, sous son
 *    propre discriminant s'il est une clé de sa valeur) a déjà été jouée dans la partie ne s'y ajoute pas ; elle se joue
 *    encore si sa valeur est un objet ou une liste, qui ouvre les offres de ses champs dans l'inspecteur restreint ;
 *  - `ecrire`, la session où un geste `valeur` est joué, son écriture, avec son chemin depuis le document de son
 *    porteur et la saisie qui l'a portée, ajoutée à `out` : celle du choix d'une variante qui porte le `discriminant`,
 *    marquée de sa `variante`, sur une variante quittée, son discriminant et chaque champ qu'elle pose et que la
 *    variante quittée ne portait pas ; sur un champ absent, la variante entière, qui pose le champ ;
 *  - `jouerLesVariantes`, chaque valeur du choix d'id `id`, choisie depuis la session et consignée sous son
 *    discriminant (`ecrire`), les offres de sa seule branche jouées (`jouerLInspecteur`, l'id du choix sans son dernier
 *    pas), ce choix hors d'elles au régime fort ; sous une `union`, la branche de chaque variante,
 *    à sa forme (`forme`), une fois par partie, hors d'une union dont les variantes se jouent déjà plus haut
 *    (`unionsEnCours`) ; et chaque choix qui change une clé de sa variante qu'aucun choix n'a encore changée dans la
 *    partie (`clesChangees`), depuis la quittée, puis depuis l'autre variante qui en change le plus, et l'union posée
 *    une fois sous chaque champ qui la porte (`BancDuFormulaire.schema`) ;
 *  - `choix`, le choix d'id `id` du formulaire de la session ; `gesteDuJeu`, le geste du jeu d'un élément de ses
 *    zones, passé en JSON, et `valeurDuJeu`, ce geste quand il est `valeur` ; `gesteDuChoix`, le geste `valeur` du
 *    choix d'id `id` dont la valeur satisfait `voulue` ;
 *  - `composerLAdresse`, les écritures de l'adresse de prose au préfixe d'id `adresse` de la session, chacune choisie
 *    parmi les valeurs que son formulaire offre (`ecrire`) : sur le `CHAPITRE_A_TABLE`, une cellule neuve, une autre
 *    ligne, une autre colonne, sa table, le genre blocs puis de nouveau cellule (`kind`), puis le reste de ses offres
 *    (`jouerLInspecteur`) ; sur le `CHAPITRE_A_OCCURRENCES`, un fragment neuf de chaque genre porté sur sa section,
 *    puis sur une autre occurrence de celle-ci (`secOcc`). Chaque fragment est scellé par l'écriture. */
export function jeuDuFormulaire<S, Z, G extends { geste: string }>(banc: BancDuFormulaire<S, Z, G>) {
  type Valeur = Extract<G, GesteDeValeur>;
  /** Le régime FORT du banc (`BancDuFormulaire`) : il porte ses exemplaires. */
  const fort = banc.exemplaires !== undefined;
  const explore = fort || banc.explorerLesUnions !== undefined;
  const estValeur = (g: G | undefined): g is Valeur => g?.geste === 'valeur';

  /** L'identité de l'offre au schéma du porteur. Dans un document, un même nœud réutilisé reçoit des porteurs
   *  déclarés distincts : l'offre du champ se qualifie par celle de son parent immédiat. */
  const champDe = (s: S, jeu: Jeu, chemin: readonly Segment[]): string | undefined => {
    const ancre = banc.schema(s, jeu);
    if (!ancre) return undefined;
    const champ = champEcrit(ancre.noeud, ancre.donnee, chemin);
    if (champ === undefined || banc.explorerLesUnions === undefined) return champ;
    const parent = champEcrit(ancre.noeud, ancre.donnee, chemin.slice(0, -1));
    return JSON.stringify([parent, champ]);
  };

  /** L'offre `o` de la session `s` traverse-t-elle deux fois le même champ du schéma de son porteur (`recursif`) ? */
  const estRecursive = (s: S, o: Offre): boolean => {
    const ancre = banc.schema(s, o.jeu);
    return ancre !== undefined && recursif(ancre.noeud, ancre.donnee, o.chemin);
  };

  /** Le geste que joue le jeu `jeu` des zones `zones` de la session `s`, passé en JSON comme le pont le reçoit
   *  (`BancDuFormulaire.geste`) ; `undefined` si les zones ne l'offrent pas. */
  const gesteDuJeu = (zones: Z, s: S, jeu: Jeu): G | undefined => banc.geste(zones, s, JSON.parse(JSON.stringify(jeu)) as Jeu);

  /** Le geste `valeur` du jeu `jeu` de l'offre `offre` des zones `zones` de la session `s` (`gesteDuJeu`) ; lève sans lui. */
  function valeurDuJeu(zones: Z, s: S, jeu: Jeu, offre: string): Valeur {
    const geste = gesteDuJeu(zones, s, jeu);
    if (!estValeur(geste)) throw new Error(`l’offre ${offre} ne joue pas le geste valeur`);
    return geste;
  }

  /** L'EMPREINTE de l'écriture `geste` portée par la saisie `saisie` sur la session `s` : le champ `champ` qu'elle
   *  écrit, quand le banc explore les unions (`champDe`), sinon la clé de son porteur,
   *  son chemin aux rangs effacés, la forme du porteur et de chaque objet que le chemin traverse ; et la forme de la valeur jouée, sous les `discriminants` des
   *  variantes déjà choisies dans la partie. Deux écritures de même empreinte écrivent les mêmes champs de la même
   *  variante : la seconde ne s'ajoute à rien. */
  function empreinte(s: S, geste: Valeur, saisie: string, discriminants: ReadonlySet<string>, champ: string | undefined): string {
    if (champ !== undefined) return empreinteAuChamp(champ, saisie, geste.valeur, discriminants);
    const porteur = banc.porteur(s, geste);
    let v: unknown = porteur?.donnee;
    const formes = [forme(v, discriminants)];
    for (const pas of geste.chemin.slice(0, -1)) {
      v = estObjet(v) || Array.isArray(v) ? (v as Record<string | number, unknown>)[pas] : undefined;
      formes.push(forme(v, discriminants));
    }
    return JSON.stringify([porteur?.cle, geste.chemin.map((p) => (typeof p === 'number' ? '#' : p)), saisie, formes, forme(geste.valeur, discriminants)]);
  }

  /** Le jeu de l'exemplaire de l'offre `offre` de la session `s`, de geste `geste` : la première valeur que le corpus du
   *  porteur porte au nœud du champ qu'elle écrit (`BancDuFormulaire.exemplaires`, `marcher`), de la sorte de sa
   *  valeur, autre que la courante ; de l'ajout d'une clé (`Offre.cle`), la première clé que le corpus porte au record,
   *  absente du courant ; `undefined` sans elle. */
  function exemplaireDe(s: S, offre: Offre, geste: Valeur): Jeu | undefined {
    const ancre = banc.exemplaires && offre.poser ? banc.schema(s, offre.jeu) : undefined;
    const noeud = ancre && marcher(ancre.noeud, ancre.donnee, offre.chemin)?.noeud;
    if (noeud === undefined) return undefined;
    const courante = auChemin(banc.porteur(s, geste)?.donnee, geste.chemin);
    const admise = (v: unknown): boolean => (offre.cle ? typeof v === 'string' && !(estObjet(courante) && v in courante) : typeof v === typeof offre.valeur && !isDeepStrictEqual(v, courante));
    const exemplaire = banc.exemplaires!(noeud).find(admise);
    return exemplaire === undefined ? undefined : offre.poser!(exemplaire);
  }

  function ecrire(s: S, geste: Valeur, saisie: string, out: EcritureJouee[], discriminant?: string, figees: readonly string[] = []): S {
    return consigner(s, banc.jouer(s, geste), geste, saisie, out, discriminant, figees);
  }

  /** La session `suite`, jouée depuis `s` par l'écriture `geste`, consignée à `out` (`ecrire`) ; du choix d'une variante,
   *  chacune de ses clés `figees` (`clesFigees`) hors de son discriminant, écrite par ce choix. */
  function consigner(s: S, suite: S, geste: Valeur, saisie: string, out: EcritureJouee[], discriminant?: string, figees: readonly string[] = [], mouvement?: EcritureJouee['mouvement']): S {
    const avant = banc.document(s, geste);
    const apres = banc.document(suite, geste);
    const porteur = banc.porteur(s, geste)!;
    const quittee = auChemin(porteur.donnee, geste.chemin);
    const variante = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur ? geste.valeur : undefined;
    const ecrits = [{ chemin: geste.chemin, valeur: geste.valeur }];
    const parent = geste.chemin.slice(0, -1);
    const crediteParent = porteur.noeud !== undefined && !mouvement && discriminant === undefined && typeof parent[parent.length - 1] === 'string'
      && estObjet(auChemin(porteur.donnee, parent))
      && marcher(porteur.noeud, porteur.donnee, parent)?.champ !== undefined;
    if (variante && estObjet(quittee)) {
      for (const cle of Object.keys(variante)) {
        if (cle === discriminant || !(cle in quittee)) ecrits.push({ chemin: [...geste.chemin, cle], valeur: variante[cle] });
      }
    }
    if (variante) deLaPartie(discriminantsJoues, out).add(discriminant!);
    for (const ecrit of ecrits) out.push({
      avant, apres, chemin: [...porteur.chemin, ...ecrit.chemin], valeur: ecrit.valeur, saisie,
      ...(variante ? { variante: discriminant } : {}), ...(mouvement ? { mouvement } : {}), ...(crediteParent ? { crediteParent: true as const } : {}),
    });
    for (const cle of figees) if (cle !== discriminant) out.push({ avant, apres, chemin: [...porteur.chemin, ...geste.chemin, cle], valeur: (geste.valeur as Record<string, unknown>)[cle], saisie, variante: cle });
    return suite;
  }

  /** Le geste à son rang, consigné au conteneur avec sa position. Une valeur scalaire offerte à l'ajout s'écrit
   *  aussi à son rang ou à sa clé, par le geste qui l'a posée. */
  function consignerLeConteneur(s: S, suite: S, joue: G, geste: Valeur, offre: Offre, out: EcritureJouee[]): S {
    const porteur = banc.porteur(s, geste)!;
    const ecrit = { ...geste, valeur: auChemin(banc.porteur(suite, geste)?.donnee, geste.chemin) };
    if (!('chemin' in joue) || !Array.isArray(joue.chemin)) throw new Error(`l’offre ${offre.id} ne désigne aucun rang ni clé`);
    const ajoute = estValeur(joue) && joue.valeur !== undefined;
    const mouvement: EcritureJouee['mouvement'] = offre.cle ? undefined : {
      geste: joue.geste === 'monter' ? 'monter' : ajoute ? 'inserer' : 'retirer',
      chemin: [...porteur.chemin, ...joue.chemin],
    };
    consigner(s, suite, ecrit, offre.saisie, out, undefined, [], mouvement);
    if (ajoute && (joue.valeur === null || typeof joue.valeur !== 'object')) {
      consigner(s, suite, joue, offre.saisie, out, undefined, [], mouvement);
    }
    return suite;
  }

  function jouerLInspecteur(depart: S, out: EcritureJouee[], branches: readonly string[] = [''], jouees = new Set<string>(), tronquee = { oui: false }): S {
    let s = depart;
    const deja = deLaPartie(empreintesJouees, out);
    const rejoueLesStructures = !fort && branches.some(Boolean);
    const ouvreDesChamps = (valeur: unknown) => estObjet(valeur) || Array.isArray(valeur);
    for (let n = 0; n < GESTES_AU_PLUS; n++) {
      const zones = banc.zones(s);
      const offertes = offres(banc, banc.elements(zones)).filter((o) => branches.some((b) => o.id.startsWith(b)));
      const restantes = offertes.filter((o) => !estRecursive(s, o));
      if (restantes.length < offertes.length) tronquee.oui = true;
      for (;;) {
        const libres = restantes.filter((o) => !jouees.has(o.id));
        const variantes = explore ? libres.filter((o) => o.saisie === 'saisieChoix' && o.emporte && estLeChoixDUneVariante(o.id, o.chemin)) : [];
        const offre = variantes.reduce<Offre | undefined>((a, o) => (a && a.chemin.length <= o.chemin.length ? a : o), undefined)
          ?? libres.find((o) => !o.emporte)
          ?? libres.reduce((a, o) => (o.chemin.length > a.chemin.length ? o : a), libres[0]);
        if (!offre) return s;
        jouees.add(offre.id);
        const champ = explore ? champDe(s, offre.jeu, offre.chemin) : undefined;
        const choixDeVariante = offre.emporte && offre.saisie === 'saisieChoix';
        // Sous un champ que dit le banc, une offre déjà jouée se lit à l'offre même : son geste ne s'en tire pas.
        if (champ !== undefined && !choixDeVariante && (!rejoueLesStructures || !ouvreDesChamps(offre.valeur)) &&
          deja.has(empreinteAuChamp(champ, offre.saisie, offre.valeur, deLaPartie(discriminantsJoues, out)))) continue;
        const joue = gesteDuJeu(zones, s, offre.jeu);
        if (!joue) throw new Error(`l’offre ${offre.id} n’est pas offerte`);
        // Le geste d'un élément à son rang s'empreint et se consigne en écriture de sa liste (`Offre.rang`).
        const geste = offre.rang ? ({ ...joue, geste: 'valeur', chemin: offre.chemin, valeur: offre.valeur } as Valeur) : valeurDuJeu(zones, s, offre.jeu, offre.id);
        const discriminant = choixDeVariante ? offre.id.slice(`valeur/${geste.chemin.join('/')}/`.length) : undefined;
        const propre = discriminant !== undefined && estObjet(geste.valeur) && discriminant in geste.valeur;
        const cle = empreinte(s, geste, offre.saisie, propre ? new Set([...deLaPartie(discriminantsJoues, out), discriminant]) : deLaPartie(discriminantsJoues, out), champ);
        if (explore && discriminant !== undefined && estLeChoixDUneVariante(offre.id, geste.chemin)) {
          const union = unionDuChoix(banc.schema(s, offre.jeu), geste.chemin, discriminant, banc.explorerLesUnions);
          if (fort || union !== undefined) {
            jouerLesVariantes(s, offre.id, out, union ?? cle);
            continue;
          }
        }
        const neuve = !deja.has(cle);
        if (!neuve && (!ouvreDesChamps(geste.valeur) || (champ !== undefined && !rejoueLesStructures))) continue;
        deja.add(cle);
        // Une autre variante choisie rouvre les champs qu'elle porte, homonymes de ceux de la variante quittée.
        if (choixDeVariante) {
          const sous = `valeur/${offre.chemin.join('/')}/`;
          for (const id of jouees) if (id !== offre.id && id.startsWith(sous)) jouees.delete(id);
        }
        const jouee = banc.jouer(s, offre.rang ? joue : geste);
        const suite = !neuve ? jouee
          : offre.rang ? consignerLeConteneur(s, jouee, joue, geste, offre, out)
            : consigner(s, jouee, geste, offre.saisie, out, discriminant);
        // Une écriture refusée se rejoue : un texte en son repli, le porteur jugeant sa forme (une extension, un
        // identifiant) ; refusée encore, en un exemplaire du corpus (`exemplaireDe`) ; sans lui, toute autre, ou un
        // texte sans texte courant, là où une autre donnée la porte.
        const refuse = neuve && explore && !offre.emporte && isDeepStrictEqual(banc.document(s, geste), banc.document(suite, geste));
        const relue = refuse && offre.repli ? ecrire(s, valeurDuJeu(zones, s, offre.repli, offre.id), offre.saisie, out) : suite;
        const exemplaire = refuse && isDeepStrictEqual(banc.document(s, geste), banc.document(relue, geste)) ? exemplaireDe(s, offre, geste) : undefined;
        if (refuse && !offre.repli && !exemplaire) deja.delete(cle);
        s = exemplaire ? ecrireLExemplaire(s, offre, geste, exemplaire, out) : relue;
        break;
      }
    }
    throw new Error(`plus de ${GESTES_AU_PLUS} offres du geste valeur`);
  }

  /** La session où l'exemplaire `jeu` de l'offre `offre` de la session `s`, de geste `geste`, est joué et consigné à
   *  `out` (`ecrire`) ; d'un geste à son rang (`Offre.rang`), en écriture de ce qui le porte, sa valeur lue après lui. */
  function ecrireLExemplaire(s: S, offre: Offre, geste: Valeur, jeu: Jeu, out: EcritureJouee[]): S {
    const joue = valeurDuJeu(banc.zones(s), s, jeu, offre.id);
    if (!offre.rang) return ecrire(s, joue, offre.saisie, out);
    return consignerLeConteneur(s, banc.jouer(s, joue), joue, geste, offre, out);
  }

  /** Les unions dont `jouerLesVariantes` joue les variantes, à cet instant. */
  const unionsEnCours = new Set<unknown>();

  function jouerLesVariantes(s: S, id: string, out: EcritureJouee[], union?: unknown): void {
    const branche = id.slice(0, id.lastIndexOf('/') + 1);
    const zones = banc.zones(s);
    const valeurs = choixDes(banc.elements(zones), id).valeurs;
    if (banc.explorerLesUnions && union === undefined) {
      const premier = valeurDuJeu(zones, s, valeurs[0].jeu, valeurs[0].id);
      const discriminant = id.slice(`valeur/${premier.chemin.join('/')}/`.length);
      union = unionDuChoix(banc.schema(s, valeurs[0].jeu), premier.chemin, discriminant, banc.explorerLesUnions);
    }
    if (union === undefined) {
      for (const v of valeurs) {
        const geste = valeurDuJeu(zones, s, v.jeu, v.id);
        jouerLInspecteur(ecrire(s, geste, 'saisieChoix', out, id.slice(`valeur/${geste.chemin.join('/')}/`.length)), out, [branche]);
      }
      return;
    }
    const explorees = deLaPartie(variantesJouees, out);
    const posees = deLaPartie(unionsPosees, out);
    const cles = deLaPartie(clesPosees, out);
    const premier = valeurDuJeu(zones, s, valeurs[0].jeu, valeurs[0].id);
    const chemin = premier.chemin;
    const discriminant = id.slice(`valeur/${chemin.join('/')}/`.length);
    const pose = JSON.stringify([union, typeof chemin[chemin.length - 1] === 'number' ? null : champDe(s, valeurs[0].jeu, chemin)]);
    const quittee = auChemin(banc.porteur(s, premier)?.donnee, chemin);
    const valeurDe = (v: Choix['valeurs'][number]): unknown => ('args' in v.jeu ? v.jeu.args[2] : undefined);
    const ancre = banc.schema(s, valeurs[0].jeu);
    const figeesDe = (v: unknown): string[] => clesFigees(ancre, chemin, v);
    const formeDe = (v: unknown): string => JSON.stringify([union, forme(v, new Set([discriminant, ...figeesDe(v)]))]);
    /** Le choix de la variante `w` joué depuis `x`, ses clés figées (`clesFigees`) écrites avec lui. */
    const ecrireLaVariante = (x: S, w: Choix['valeurs'][number]): S => {
      const geste = valeurDuJeu(banc.zones(x), x, w.jeu, w.id);
      return ecrire(x, geste, 'saisieChoix', out, discriminant, figeesDe(geste.valeur));
    };
    const enCours = unionsEnCours.has(union);
    unionsEnCours.add(union);
    for (const v of valeurs) {
      const variante = formeDe(valeurDe(v));
      const neuve = !enCours && !explorees.has(variante);
      const aPoser = (depuis: unknown): string[] => clesChangees(depuis, valeurDe(v), discriminant).map((cle) => JSON.stringify([variante, cle])).filter((c) => !cles.has(c));
      const ici = aPoser(quittee);
      if (neuve || ici.length || (!v.presse && !posees.has(pose))) {
        const choisie = ecrireLaVariante(s, v);
        for (const c of ici) cles.add(c);
        if (!v.presse) posees.add(pose);
        if (neuve) {
          const tronquee = { oui: false };
          jouerLInspecteur(choisie, out, [branche], new Set([id]), tronquee);
          if (!tronquee.oui) explorees.add(variante);
        }
      }
      // Les clés que le choix ne change pas depuis la quittée se changent depuis l'autre variante qui en change le plus.
      const depuis = valeurs.map((w) => ({ w, gain: aPoser(valeurDe(w)) })).reduce((a, x) => (x.gain.length > a.gain.length ? x : a));
      if (!depuis.gain.length) continue;
      const autre = ecrireLaVariante(s, depuis.w);
      const retour = choix(autre, id).valeurs.find((r) => formeDe(valeurDe(r)) === variante);
      if (retour) ecrireLaVariante(autre, retour);
      for (const c of depuis.gain) cles.add(c);
    }
    if (!enCours) unionsEnCours.delete(union);
  }

  const choix = (s: S, id: string): Choix => choixDes(banc.elements(banc.zones(s)), id);

  function gesteDuChoix(s: S, id: string, voulue: (valeur: unknown) => boolean): Valeur {
    const b = choix(s, id).valeurs.find((v) => 'args' in v.jeu && v.jeu.type === 'valeur' && voulue(v.jeu.args[2]));
    const geste = b && gesteDuJeu(banc.zones(s), s, b.jeu);
    if (!estValeur(geste)) throw new Error(`aucune valeur voulue au choix ${id}`);
    return geste;
  }

  /** Le geste d'une valeur du choix d'id `id` de la session `s` autre que sa valeur pressée. */
  function uneAutreValeur(s: S, id: string): Valeur {
    const pressee = choix(s, id).valeurs.find((v) => v.presse);
    return gesteDuChoix(s, id, (v) => !pressee || !('args' in pressee.jeu) || !Object.is(v, pressee.jeu.args[2]));
  }

  /** La session `s` où l'adresse de prose au préfixe d'id `adresse` (`…/descRef/`) porte le livre et le chapitre de
   *  `chapitre`, chacun choisi à son choix. */
  const surLeChapitre = (s: S, adresse: string, chapitre: { book: string; ch: string }): S =>
    (['book', 'ch'] as const).reduce((x, cle) => banc.jouer(x, gesteDuChoix(x, `${adresse}${cle}`, (v) => v === chapitre[cle])), s);

  function composerLAdresse(s: S, adresse: string, out: EcritureJouee[]): void {
    const parts = `${adresse}parts/`;
    const neuf = (x: S, genre: (v: unknown) => boolean): [S, string] => {
      const ajout = gesteDuChoix(x, `${parts}ajouter`, genre);
      return [ecrire(x, ajout, 'saisieChoix', out), `${parts}${ajout.chemin[ajout.chemin.length - 1]}/`];
    };
    const [cellule, fragment] = neuf(surLeChapitre(s, adresse, CHAPITRE_A_TABLE), estCellule);
    const genre = (kind: string) => (x: S) => ecrire(x, gesteDuChoix(x, `${fragment}kind`, (v) => estObjet(v) && v.kind === kind), 'saisieChoix', out, 'kind');
    const composee = ['row', 'col', 'table'].reduce((x, cle) => ecrire(x, uneAutreValeur(x, `${fragment}${cle}`), 'saisieChoix', out), cellule);
    jouerLInspecteur(genre('cellule')(genre('blocs')(composee)), out, [parts]);
    const occurrences = surLeChapitre(s, adresse, CHAPITRE_A_OCCURRENCES);
    for (const genreNeuf of [estCellule, (v: unknown) => !estCellule(v)]) {
      const [x, f] = neuf(occurrences, genreNeuf);
      const surLaSection = ecrire(x, gesteDuChoix(x, `${f}sec`, (v) => v === CHAPITRE_A_OCCURRENCES.sec), 'saisieChoix', out);
      ecrire(surLaSection, uneAutreValeur(surLaSection, `${f}secOcc`), 'saisieChoix', out);
    }
  }

  return { jouerLInspecteur, ecrire, jouerLesVariantes, choix, gesteDuJeu, valeurDuJeu, gesteDuChoix, composerLAdresse };
}
