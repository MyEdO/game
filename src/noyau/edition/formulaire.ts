/**
 * LE FORMULAIRE TIRÉ DU SCHÉMA, sans porteur (#3606, #4020) : sa forme (le nœud où s'écrit sa donnée, les champs qu'il
 * offre et ses retraits déclarés), sa description (`champsDuFormulaire`, décrite par `inferFields`), l'écriture d'une
 * valeur à un chemin de sa donnée (`ecritureAuFormulaire`), le retrait de chaque champ (`retraitAuFormulaire`) et le
 * rescellement d'une adresse de prose (`rescellementAuFormulaire`). Un porteur les appelle avec sa forme et les choix de son
 * contexte : ceux de l'éditeur de carte, `FORMULAIRES` (`src/noyau/sceneEditLecture.ts`).
 */
import {
  champsDeclares,
  choixDuNoeud,
  cleOfferte,
  elementDuNoeud,
  formeAuPoint,
  inferFields,
  recordDuNoeud,
  unionDuNoeud,
  varianteCourante,
  videDuNoeud,
  type ChoixDuContexte,
  type ContexteDuChamp,
  type FieldDesc,
} from '../codex/editFields';
import { gestesDeLaListe, valeurNeuveDe, variantesAChoisir } from '../valeursNeuves';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { estObjet } from '../../lib/objet.mjs';
import { adresseRecalee, adresseRescellee, adressesScellees, estCheminDerive, type SourceDeLEdition } from './adresseDeProse';

/** Un pas du chemin d'un champ dans sa donnée : une clé d'objet, ou un rang de liste. */
export type Segment = string | number;

type Objet = Record<string, unknown>;

/** LA règle d'absence des écrivains d'un formulaire : `o` où le champ `k` vaut `v`, ou s'en retire quand `v` est
 *  `undefined`. */
export function champ<T extends object, K extends keyof T>(o: T, k: K, v: T[K] | undefined): T {
  const out = { ...o };
  if (v === undefined) delete out[k];
  else out[k] = v;
  return out;
}


/** Les chemins de clés et de rangs, depuis la donnée d'un formulaire, des champs qu'il offre : chacun avec tout ce
 *  qu'il porte. */
export type CheminsOfferts = readonly (readonly Segment[])[];

/** La forme d'un formulaire tiré du schéma : le nœud où s'écrit sa donnée, à travers les unions de son schéma
 *  (`formeAuPoint`), les champs qu'il offre, et ses retraits déclarés. */
export interface FormeDuFormulaire { noeud: unknown; champs: CheminsOfferts; retraits: CheminsOfferts }

/** Les choix que le contexte d'un formulaire pose à un chemin de sa donnée, dans leur ordre ; `undefined` : ceux du
 *  nœud. */
export type ChoixDuFormulaire = ContexteDuChamp['choix'];

/** `a` est-il un préfixe du chemin `b` ? */
const prefixe = (a: readonly Segment[], b: readonly Segment[]): boolean => a.length <= b.length && a.every((p, i) => p === b[i]);

/** Le chemin `chemin` est-il offert par les champs `offerts` : sous l'un d'eux, ou sur le chemin de l'un d'eux ? */
export const cheminOffert = (offerts: CheminsOfferts, chemin: readonly Segment[]): boolean =>
  offerts.some((o) => prefixe(o, chemin) || prefixe(chemin, o));

/** L'écriture au chemin `chemin`, où la donnée vaut `actuelle`, est-elle offerte par les champs `offerts` : sous l'un
 *  d'eux ; sur le chemin de l'un d'eux, si chaque clé que porte `actuelle`, ou chaque élément d'une liste à son rang,
 *  l'est, de proche en proche (elle n'emporte aucun champ qu'ils n'offrent pas). */
export function ecritureOfferte(offerts: CheminsOfferts, chemin: readonly Segment[], actuelle: unknown): boolean {
  if (offerts.some((o) => prefixe(o, chemin))) return true;
  if (!offerts.some((o) => prefixe(chemin, o))) return false;
  const entrees: [Segment, unknown][] = Array.isArray(actuelle) ? actuelle.map((v, i) => [i, v]) : estObjet(actuelle) ? Object.entries(actuelle) : [];
  return entrees.every(([cle, v]) => v === undefined || ecritureOfferte(offerts, [...chemin, cle], v));
}

/** Le formulaire de forme `forme`, de donnée `donnee` : le champ de tête de chacun de ses champs offerts, décrit par
 *  `inferFields` sur son nœud, dans son contexte : ce qu'il offre sous lui (`cheminOffert`, jamais ce qu'une adresse de
 *  prose dérive, `estCheminDerive`), où il s'écrit entier (`ecritureOfferte`), ses choix `choix` et le `Source/`
 *  `source` de ses adresses. */
export function champsDuFormulaire({ noeud, champs }: FormeDuFormulaire, donnee: unknown, choix: ChoixDuFormulaire, source: SourceDeLEdition): FieldDesc[] {
  const decrits = inferFields([donnee as Record<string, unknown>], { noeud, niveau: 'profondeur' });
  const contexte: ContexteDuChamp = {
    offert: (chemin) => cheminOffert(champs, chemin) && !estCheminDerive(noeud, donnee, chemin),
    ecrivable: (chemin, actuelle) => ecritureOfferte(champs, chemin, actuelle),
    choix,
    source,
  };
  return [...new Set(champs.map(([tete]) => tete))].flatMap((cle) => decrits.filter((f) => f.key === cle)).map((f) => ({ ...f, contexte }));
}

/** Le nœud admet-il que son champ soit retiré ? */
const retirable = (noeud: unknown): boolean => videDuNoeud(noeud) === undefined;

/** La valeur `valeur` est-elle de la sorte du nœud `noeud`, où la valeur `actuelle` est écrite ? `undefined` : s'il
 *  admet le retrait ; d'un champ à choix, l'une de ses valeurs (`choixDuNoeud`) ; d'un objet, sa valeur neuve
 *  (`valeurNeuveDe`) ; d'une union, l'une de ses variantes à choisir (`variantesAChoisir`), ou de l'union ou de la liste
 *  qu'est sa variante courante ; d'une liste, l'actuelle après l'un de ses gestes (`gestesDeLaListe`) ; sinon, et pour une union
 *  ou une liste saisie entière, une valeur que le nœud parse. */
function admise(noeud: unknown, actuelle: unknown, valeur: unknown): boolean {
  if (valeur === undefined) return retirable(noeud);
  const choix = choixDuNoeud(noeud);
  if (choix) return choix.some((o) => o.valeur === valeur);
  if (champsDeclares(noeud)) return jsonCanonique(valeur) === jsonCanonique(valeurNeuveDe(noeud));
  const parse = () => (noeud as { safeParse: (v: unknown) => { success: boolean } }).safeParse(valeur).success;
  const jouee = jsonCanonique(valeur);
  const union = unionDuNoeud(noeud);
  if (union) {
    const courante = varianteCourante(union, actuelle)?.noeud;
    return variantesAChoisir(noeud, actuelle)!.some((v) => jsonCanonique(v.valeur) === jouee)
      || ((unionDuNoeud(courante) !== undefined || elementDuNoeud(courante) !== undefined) && admise(courante, actuelle, valeur)) || parse();
  }
  const element = elementDuNoeud(noeud);
  if (element !== undefined) {
    const gestes = gestesDeLaListe(Array.isArray(actuelle) ? actuelle : [], valeurNeuveDe(element));
    return [gestes.ajouter, ...gestes.elements.flatMap((e) => [e.retirer, e.monter])].some((l) => l && jsonCanonique(l) === jouee) || parse();
  }
  return parse();
}

/** Le conteneur `o` où le champ au chemin `[cle, ...reste]` vaut `valeur`, posé par `champ` (un élément de liste se
 *  remplace à son rang, s'ajoute en fin au rang qui suit le dernier) ; un objet que ce retrait vide, au rang `rang` du
 *  chemin, en part aussi quand `vidable(rang)`. */
function ecrit(o: unknown, [cle, ...reste]: readonly Segment[], valeur: unknown, vidable: (rang: number) => boolean, rang = 0): unknown {
  const sous = (o as Record<Segment, unknown>)[cle];
  const suite = reste.length ? ecrit(sous, reste, valeur, vidable, rang + 1) : valeur;
  if (Array.isArray(o)) return cle === o.length ? (suite === undefined ? o : [...o, suite]) : o.map((e, i) => (i === cle ? suite : e));
  const vide = valeur === undefined && reste.length > 0 && Object.keys(sous as object).length > 0 && !Object.keys(suite as object).length;
  return champ(o as Objet, cle as string, vide && vidable(rang) ? undefined : suite);
}

/** Le nœud du pas `pas` depuis le point de nœud `noeud` et de valeur `point`, où le contexte pose les choix `poses` : le
 *  rang d'un élément d'une liste présente (`elementDuNoeud`), la variante courante d'une union comprise (`formeAuPoint`),
 *  ou celui qui suit son dernier, où l'élément s'ajoute ; une clé du record présent (`recordDuNoeud`) qu'il porte, ou
 *  qu'il offre (`champsDuRecord`) : l'un des choix admis que le contexte y pose, sinon une clé qu'admet son nœud ; une clé
 *  déclarée de l'objet présent (`champsDeclares`), à travers ses unions (`formeAuPoint`), ni discriminant que tient le
 *  choix d'une variante, ni identité (`cleOfferte`) ; `undefined` si le formulaire ne l'offre pas. */
function noeudDuPas(noeud: unknown, point: unknown, pas: Segment, poses: () => readonly ChoixDuContexte[] | undefined): unknown {
  if (typeof pas === 'number') {
    const element = elementDuNoeud(formeAuPoint(noeud, point)?.noeud ?? noeud);
    return element !== undefined && Array.isArray(point) && Number.isInteger(pas) && pas >= 0 && pas <= point.length ? element : undefined;
  }
  if (!estObjet(point)) return undefined;
  const record = recordDuNoeud(noeud);
  if (record) {
    const cles = poses();
    const offerte = cles ? cles.some((c) => c.refus === null && c.valeur === pas) : (record.cle as { safeParse: (v: unknown) => { success: boolean } }).safeParse(pas).success;
    return offerte || Object.keys(point).includes(pas) ? record.valeur : undefined;
  }
  const forme = formeAuPoint(noeud, point);
  const n = forme && champsDeclares(forme.noeud)?.find(([cle]) => cle === pas)?.[1];
  return n !== undefined && !forme!.tenus.includes(pas) && cleOfferte(pas, n) ? n : undefined;
}

/** Les nœuds de chaque pas du chemin `chemin` (`noeudDuPas`) depuis la donnée `donnee` de l'objet de schéma `objet`, aux
 *  choix `choix` que pose le contexte de son porteur, et la valeur au bout ; `undefined` si le formulaire n'offre pas
 *  l'un de ses pas, ou s'il est vide. */
function noeudsDuChemin(objet: unknown, donnee: Objet, chemin: readonly Segment[], choix: ChoixDuFormulaire): { noeuds: unknown[]; point: unknown } | undefined {
  const noeuds: unknown[] = [];
  let point: unknown = donnee;
  for (const [rang, pas] of chemin.entries()) {
    const noeud = noeudDuPas(noeuds.length ? noeuds[noeuds.length - 1] : objet, point, pas, () => choix(chemin.slice(0, rang)));
    if (noeud === undefined) return undefined;
    noeuds.push(noeud);
    point = (point as Record<Segment, unknown>)[pas];
  }
  return noeuds.length ? { noeuds, point } : undefined;
}

/** L'objet `point`, de nœud `noeud`, porte-t-il une donnée exigée présente hors de sa clé `cle` : un champ déclaré de
 *  sa forme (`formeAuPoint`) présent, dont l'absence n'est pas admise (`retirable`), ni `cle` ni un discriminant que
 *  tient le choix d'une variante ? */
function porteUneAutreExigee(noeud: unknown, point: unknown, cle: Segment): boolean {
  const forme = formeAuPoint(noeud, point);
  return (champsDeclares(forme?.noeud) ?? []).some(([k, n]) => k !== cle && !forme!.tenus.includes(k) && !retirable(n) && (point as Objet)[k] !== undefined);
}

/** Le chemin où s'écrit le retrait du champ au chemin `chemin` de la donnée `donnee` de l'objet de schéma `objet`, aux
 *  choix `choix` : le sien si son absence est admise (son nœud l'admet, ou il est l'entrée d'un record) ; sinon, de
 *  proche en proche à travers les clés des objets qui le portent, tant que chacun ne porte aucune autre donnée exigée
 *  présente (`porteUneAutreExigee`), celui du plus proche dont l'absence est admise, qui se retire entier, ses champs
 *  facultatifs avec lui ; ou son refus : un chemin que le formulaire n'offre pas (`nonOffert`), un champ que son objet
 *  exige (`requis`). */
function cheminDuRetrait(objet: unknown, donnee: Objet, chemin: readonly Segment[], choix: ChoixDuFormulaire): readonly Segment[] | 'nonOffert' | 'requis' {
  const noeuds = noeudsDuChemin(objet, donnee, chemin, choix)?.noeuds;
  if (!noeuds) return 'nonOffert';
  const absenceAdmise = (rang: number) => retirable(noeuds[rang]) || recordDuNoeud(rang ? noeuds[rang - 1] : objet) !== undefined;
  if (absenceAdmise(noeuds.length - 1)) return chemin;
  const points = chemin.reduce<unknown[]>((pts, pas) => [...pts, (pts[pts.length - 1] as Record<Segment, unknown>)[pas]], [donnee]);
  for (let rang = noeuds.length - 2; rang >= 0 && typeof chemin[rang + 1] === 'string'; rang--) {
    if (porteUneAutreExigee(noeuds[rang], points[rang + 1], chemin[rang + 1])) return 'requis';
    if (absenceAdmise(rang)) return chemin.slice(0, rang + 1);
  }
  return 'requis';
}

/** Pourquoi une valeur ne s'écrit pas : le formulaire n'offre pas son chemin, elle n'est pas de la sorte du champ, elle
 *  est arrivée `null` (un JSON illisible) là où le champ ne l'admet pas, elle est absente d'un champ que son objet exige
 *  (`cheminDuRetrait`), ou son porteur écrit enfreint une règle, dite. */
export type RefusDeValeur = 'nonOffert' | 'horsSorte' | 'illisible' | 'requis' | { regle: string };

/** Ce qu'écrit une valeur : la donnée écrite, ou son refus. */
export type EcritureDeValeur<T> = { ok: true; valeur: T } | { ok: false; refus: RefusDeValeur };

/** Les fautes du parse de l'objet de schéma `objet` sur `donnee`, chacune par son message et son chemin, ses rangs
 *  effacés : un retrait décale les rangs des éléments qui le suivent. */
const fautesDuParse = (objet: unknown, donnee: unknown): { cle: string; message: string }[] =>
  ((objet as { safeParse: (v: unknown) => { error?: { issues: { path: PropertyKey[]; message: string }[] } } }).safeParse(donnee).error?.issues ?? [])
    .map((i) => ({ cle: jsonCanonique([i.path.map((p) => (typeof p === 'number' ? '#' : String(p))), i.message]), message: i.message }));

/** Le message de la première faute du parse de `objet` sur `apres` qui n'était pas déjà sur `avant`, compte tenu des
 *  fautes égales (`fautesDuParse`) ; `undefined` sans faute neuve. */
export function fauteNeuve(objet: unknown, avant: unknown, apres: unknown): string | undefined {
  const deja = new Map<string, number>();
  for (const { cle } of fautesDuParse(objet, avant)) deja.set(cle, (deja.get(cle) ?? 0) + 1);
  for (const { cle, message } of fautesDuParse(objet, apres)) {
    const reste = deja.get(cle) ?? 0;
    if (!reste) return message;
    deja.set(cle, reste - 1);
  }
  return undefined;
}

/** La donnée `donnee` de l'objet de schéma `objet` où `valeur` s'écrit au chemin `chemin` (`ecrit`), le champ retiré si
 *  elle vaut `undefined` (l'entrée d'un record partiel ou à clé ouverte, `recordDuNoeud`, se retire toujours), une liste
 *  vidée retirée si son nœud admet l'absence ; ou son refus : un pas que le formulaire n'offre pas (`noeudDuPas`), une
 *  valeur qui n'est pas l'un des choix admis que le contexte de son porteur y pose (`choix`, qui, d'un record, pose ses
 *  clés), ou, sans eux, pas de la sorte du champ (`admise`) ni, d'une liste, elle où s'ajoute en fin l'un des choix
 *  admis que ce contexte pose au rang qui suit son dernier élément ; un retrait (le champ retiré, la liste raccourcie) dont
 *  l'objet écrit porte une faute de son parse que la donnée ne portait pas (`fauteNeuve`), dite. Hors retrait, le schéma
 *  entier ne se vérifie qu'à l'enregistrement et à l'essai (#3606, décision 3). */
export function avecLaValeur(objet: unknown, donnee: Objet, chemin: readonly Segment[], valeur: unknown, choix: ChoixDuFormulaire = () => undefined): EcritureDeValeur<Objet> {
  const pas = noeudsDuChemin(objet, donnee, chemin, choix);
  if (!pas) return { ok: false, refus: 'nonOffert' };
  const { noeuds, point } = pas;
  const dernier = noeuds[noeuds.length - 1];
  const ecrite = Array.isArray(valeur) && !valeur.length && elementDuNoeud(dernier) !== undefined && retirable(dernier) ? undefined : valeur;
  const poses = ecrite === undefined || recordDuNoeud(dernier) ? undefined : choix(chemin);
  const entreeRetiree = ecrite === undefined && recordDuNoeud(noeuds.length > 1 ? noeuds[noeuds.length - 2] : objet) !== undefined;
  const liste = Array.isArray(point) ? point : [];
  const ajoutee = () => elementDuNoeud(dernier) !== undefined && !!choix([...chemin, liste.length])?.some((c) => c.refus === null && jsonCanonique([...liste, c.valeur]) === jsonCanonique(ecrite));
  const ecrivable = poses ? poses.some((c) => c.refus === null && jsonCanonique(c.valeur) === jsonCanonique(ecrite)) : entreeRetiree || admise(dernier, point, ecrite) || ajoutee();
  if (!ecrivable) return { ok: false, refus: valeur === null ? 'illisible' : 'horsSorte' };
  const apres = ecrit(donnee, chemin, ecrite, (rang) => retirable(noeuds[rang])) as Objet;
  const retrait = ecrite === undefined || (Array.isArray(point) && Array.isArray(ecrite) && ecrite.length < point.length);
  const faute = retrait ? fauteNeuve(objet, donnee, apres) : undefined;
  return faute === undefined ? { ok: true, valeur: apres } : { ok: false, refus: { regle: faute } };
}

/** Le retrait déclaré au chemin `chemin` des retraits `retraits` du formulaire (`FormeDuFormulaire`), de la donnée `donnee` :
 *  d'un rang, la liste qui le porte, sans l'élément ; d'une clé, l'objet qu'elle porte, par le chemin de son retrait
 *  `ecrit` (`cheminDuRetrait`), s'il ne remonte pas au-delà ; `undefined` hors d'eux. */
function retraitDeclare(retraits: CheminsOfferts, donnee: unknown, chemin: readonly Segment[], ecrit: readonly Segment[] | 'nonOffert' | 'requis'): { ecrit: readonly Segment[]; valeur: unknown } | undefined {
  if (!retraits.some((r) => jsonCanonique(r) === jsonCanonique(chemin))) return undefined;
  const rang = chemin[chemin.length - 1];
  if (typeof rang === 'string') return typeof ecrit !== 'string' && jsonCanonique(ecrit) === jsonCanonique(chemin) ? { ecrit, valeur: undefined } : undefined;
  const parent = chemin.slice(0, -1);
  const liste = parent.reduce<unknown>((o, pas) => (o as Record<Segment, unknown>)[pas], donnee) as readonly unknown[];
  return { ecrit: parent, valeur: liste.filter((_, i) => i !== rang) };
}


/** Où s'écrit `valeur` au chemin `chemin` du formulaire de forme `forme`, de donnée `donnee`, aux choix `choix`, et ce
 *  qui s'y écrit : `valeur` au chemin, ou, `valeur` absente, le retrait déclaré qu'est ce chemin (`retraitDeclare`),
 *  sinon le retrait au chemin du sien (`cheminDuRetrait`) ; ou son refus : celui du retrait, une écriture hors de ses
 *  champs, ou qui emporte un champ qu'ils n'offrent pas (`ecritureOfferte`), hors d'un retrait déclaré, à ce qu'une
 *  adresse de prose dérive (`estCheminDerive`), n'est pas offerte. */
function ouSEcrit({ noeud, champs: offerts, retraits }: FormeDuFormulaire, donnee: unknown, chemin: readonly Segment[], valeur: unknown, choix: ChoixDuFormulaire): { ok: true; ecrit: readonly Segment[]; valeur: unknown } | { ok: false; refus: RefusDeValeur } {
  const retrait = valeur === undefined ? cheminDuRetrait(noeud, donnee as Objet, chemin, choix) : chemin;
  const declare = valeur === undefined ? retraitDeclare(retraits, donnee, chemin, retrait) : undefined;
  if (!declare && typeof retrait === 'string') return { ok: false, refus: retrait };
  const ecrit = declare?.ecrit ?? (retrait as readonly Segment[]);
  const actuelle = ecrit.reduce<unknown>((o, pas) => (estObjet(o) || Array.isArray(o) ? (o as Record<Segment, unknown>)[pas] : undefined), donnee);
  const offerte = declare !== undefined || ecritureOfferte(offerts, ecrit, actuelle);
  return offerte && !estCheminDerive(noeud, donnee, ecrit) ? { ok: true, ecrit, valeur: declare ? declare.valeur : valeur } : { ok: false, refus: 'nonOffert' };
}

/** Le retrait de chaque champ, à son chemin, du formulaire de forme `forme`, de donnée `donnee`, aux choix `choix`,
 *  s'écrit-il (`ouSEcrit`), sans compter les fautes du parse qu'il porterait (`fauteNeuve`) ? */
export const retraitAuFormulaire = (forme: FormeDuFormulaire, donnee: unknown, choix: ChoixDuFormulaire) =>
  (chemin: readonly Segment[]): boolean => ouSEcrit(forme, donnee, chemin, undefined, choix).ok;

/** La donnée `donnee` du formulaire de forme `forme` où `valeur` s'écrit au chemin `chemin`, là où elle s'écrit
 *  (`ouSEcrit` ; `avecLaValeur`, aux choix `choix`), son adresse de prose recalée (`adresseRecalee`) et chaque
 *  fragment d'adresse scellé sur le `Source/` `source` (`adressesScellees`) ; ou son refus : celui de `ouSEcrit`, ou
 *  une écriture qui apporte un fragment que seul un chapitre non chargé scellerait, n'est pas offerte. */
export function ecritureAuFormulaire<T>(forme: FormeDuFormulaire, donnee: T, chemin: readonly Segment[], valeur: unknown, choix: ChoixDuFormulaire, source: SourceDeLEdition): EcritureDeValeur<T> {
  const ou = ouSEcrit(forme, donnee, chemin, valeur, choix);
  if (!ou.ok) return ou;
  const { noeud } = forme;
  const ecrite = avecLaValeur(noeud, donnee as Objet, ou.ecrit, ou.valeur, choix);
  if (!ecrite.ok) return ecrite;
  const scellee = adressesScellees(noeud, donnee, adresseRecalee(noeud, donnee, ecrite.valeur, ou.ecrit), source);
  return scellee === undefined ? { ok: false, refus: 'nonOffert' } : { ok: true, valeur: scellee as T };
}

/** La donnée `donnee` du formulaire de forme `forme` où l'adresse de prose au chemin `chemin` est rescellée après
 *  relecture (`adresseRescellee`), sur le `Source/` `source` ; ou son refus : un chemin que le formulaire n'offre pas,
 *  qui ne désigne pas une adresse, ou dont le chapitre n'est pas chargé. */
export function rescellementAuFormulaire<T>({ noeud, champs }: FormeDuFormulaire, donnee: T, chemin: readonly Segment[], source: SourceDeLEdition): EcritureDeValeur<T> {
  const rescellee = cheminOffert(champs, chemin) ? adresseRescellee(noeud, donnee, chemin, source) : undefined;
  return rescellee === undefined ? { ok: false, refus: 'nonOffert' } : { ok: true, valeur: rescellee as T };
}
