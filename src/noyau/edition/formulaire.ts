/**
 * LE FORMULAIRE TIRÉ DU SCHÉMA, sans porteur (#3606, #4020) : sa forme (le nœud où s'écrit sa donnée, les champs qu'il
 * offre et ses retraits déclarés), sa description (`champsDuFormulaire`, décrite par `inferFields`), l'écriture d'une
 * valeur à un chemin de sa donnée (`ecritureAuFormulaire`), le retrait de chaque champ (`retraitAuFormulaire`) et le
 * rescellement d'une adresse de prose (`rescellementAuFormulaire`). Un porteur les appelle avec sa forme et les choix de son
 * contexte : ceux de l'éditeur de carte, `FORMULAIRES` (`src/noyau/sceneEditLecture.ts`).
 */
import {
  ariteDuNoeud,
  champsDeclares,
  choixDuNoeud,
  identiteTenue,
  elementDuNoeud,
  exigeParSonPorteur,
  formeAuPoint,
  inferFields,
  noeudDuChampAuPoint,
  recordDuNoeud,
  unionDuNoeud,
  varianteCourante,
  absenceDuNoeud,
  type ChoixDuContexte,
  type ContexteDuChamp,
  type FieldDesc,
} from '../codex/editFields';
import { valeurNeuveDe, variantesAChoisir } from '../valeursNeuves';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { noeudsAuChemin } from '../../data/schemas/grammaire/descente';
import { auChemin, estObjet } from '../../lib/objet.mjs';
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

/** La clé présente au bout du chemin `chemin` de la donnée `donnee` de l'objet de schéma `objet` est-elle exigée par le
 *  record qui la porte : son retrait y pose une faute du parse de son nœud que le record ne portait pas (`fauteNeuve`,
 *  un nombre de clés au moins) ? */
function cleExigeeParSonRecord(objet: unknown, donnee: unknown, chemin: readonly Segment[]): boolean {
  const cle = chemin[chemin.length - 1];
  const record = auChemin(donnee, chemin.slice(0, -1));
  if (typeof cle !== 'string' || !estObjet(record) || !(cle in record)) return false;
  const sans = Object.fromEntries(Object.entries(record).filter(([k]) => k !== cle));
  return noeudsAuChemin(objet, donnee, chemin.slice(0, -1)).some((n) => recordDuNoeud(n) !== undefined && fauteNeuve(n, record, sans) !== undefined);
}

/** Le formulaire de forme `forme`, de donnée `donnee` : le champ de tête de chacun de ses champs offerts, décrit par
 *  `inferFields` sur son nœud, vidable si aucun porteur ne l'exige, dans son contexte : ce qu'il offre sous lui
 *  (`cheminOffert`, jamais ce qu'une adresse de prose dérive, `estCheminDerive`), où il s'écrit entier
 *  (`ecritureOfferte`), ce qu'un porteur exige (`exigeParSonPorteur`) ou la clé que son record exige
 *  (`cleExigeeParSonRecord`), ses choix `choix` et le `Source/` `source` de ses adresses. */
export function champsDuFormulaire({ noeud, champs }: FormeDuFormulaire, donnee: unknown, choix: ChoixDuFormulaire, source: SourceDeLEdition): FieldDesc[] {
  const decrits = inferFields([donnee as Record<string, unknown>], { noeud, niveau: 'profondeur' });
  const contexte: ContexteDuChamp = {
    offert: (chemin) => cheminOffert(champs, chemin) && !estCheminDerive(noeud, donnee, chemin),
    ecrivable: (chemin, actuelle) => ecritureOfferte(champs, chemin, actuelle),
    exige: (chemin) => exigeParSonPorteur((j) => noeudsAuChemin(noeud, donnee, chemin.slice(0, j)), chemin.length) || cleExigeeParSonRecord(noeud, donnee, chemin),
    choix,
    source,
  };
  return [...new Set(champs.map(([tete]) => tete))].flatMap((cle) => decrits.filter((f) => f.key === cle)).map((f) => ({ ...f, nullable: f.nullable && !contexte.exige([f.key]), contexte }));
}

/** Ce qu'écrit le retrait du champ de nœud `noeud`, son VIDE (`absenceDuNoeud`) : `{ vide: undefined }`, le champ s'en
 *  retire ; `{ vide: null }`, d'un nœud qui n'admet que `null`, il s'y vide ; `false`, il ne se retire pas. */
const retraitDuNoeud = (noeud: unknown): { vide: null | undefined } | false => absenceDuNoeud(noeud) ?? false;

/** Le nœud admet-il que son champ soit retiré, absent (`retraitDuNoeud`) ? */
const retirable = (noeud: unknown): boolean => { const r = retraitDuNoeud(noeud); return r !== false && r.vide === undefined; };

/** Le nœud admet-il que son champ se vide à `null` (`retraitDuNoeud`) ? */
const vidableANull = (noeud: unknown): boolean => { const r = retraitDuNoeud(noeud); return r !== false && r.vide === null; };

/** La valeur `valeur` est-elle de la sorte du nœud `noeud`, où la valeur `actuelle` est écrite ? `undefined` : s'il
 *  admet le retrait ; d'un champ à choix, l'une de ses valeurs (`choixDuNoeud`) ; d'un objet, sa valeur neuve
 *  (`valeurNeuveDe`) ; d'une union, l'une de ses variantes à choisir (`variantesAChoisir`), ou de l'union ou de la liste
 *  qu'est sa variante courante ; sinon, et pour une union ou une liste saisie entière, une valeur que le nœud parse. */
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
  return parse();
}

/** Le conteneur `o` où le champ au chemin `[cle, ...reste]` vaut `valeur`, posé par `champ` (un élément de liste se
 *  remplace à son rang, s'ajoute en fin au rang qui suit le dernier, d'une liste absente au rang 0, et se retire de la
 *  liste, absent) ; un objet que ce retrait vide, au rang `rang` du chemin, en part aussi quand `vidable(rang)`. */
function ecrit(o: unknown, [cle, ...reste]: readonly Segment[], valeur: unknown, vidable: (rang: number) => boolean, rang = 0): unknown {
  const sous = (o as Record<Segment, unknown> | undefined)?.[cle];
  const suite = reste.length ? ecrit(sous, reste, valeur, vidable, rang + 1) : valeur;
  if (typeof cle === 'number') {
    const liste = (o ?? []) as unknown[];
    return suite === undefined ? liste.filter((_, i) => i !== cle) : cle === liste.length ? [...liste, suite] : liste.map((e, i) => (i === cle ? suite : e));
  }
  const vide = valeur === undefined && reste.length > 0 && Object.keys(sous ?? {}).length > 0 && !Object.keys(suite as object).length;
  return champ(o as Objet, cle as string, vide && vidable(rang) ? undefined : suite);
}

/** Le nœud du pas `pas` depuis le point de nœud `noeud` et de valeur `point`, où le contexte pose les choix `poses` : le
 *  rang d'un élément d'une liste ou d'un tuple présent (`elementDuNoeud`), la variante courante d'une union comprise
 *  (`formeAuPoint`), ou, d'une liste seule, celui qui suit son dernier, où l'élément s'ajoute (0 d'une liste absente),
 *  un tuple tenant son arité (`ariteDuNoeud`) ; une clé du record présent (`recordDuNoeud`) qu'il porte, ou
 *  qu'il offre (`champsDuRecord`) : l'un des choix admis que le contexte y pose, sinon une clé qu'admet son nœud ; une clé
 *  déclarée de l'objet présent (`champsDeclares`), à travers ses unions (`formeAuPoint`), ni discriminant que tient le
 *  choix d'une variante, ni l'identité `tenue` que tient la liste qui le porte (`identiteTenue`) ; `undefined` si le
 *  formulaire ne l'offre pas. */
function noeudDuPas(noeud: unknown, point: unknown, pas: Segment, poses: () => readonly ChoixDuContexte[] | undefined, tenue: readonly string[]): unknown {
  if (typeof pas === 'number') {
    const forme = formeAuPoint(noeud, point)?.noeud ?? noeud;
    const element = elementDuNoeud(forme, pas);
    const longueur = Array.isArray(point) ? point.length : point === undefined ? 0 : -1;
    const dernier = ariteDuNoeud(forme) === undefined ? longueur : longueur - 1;
    return element !== undefined && Number.isInteger(pas) && pas >= 0 && pas <= dernier ? element : undefined;
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
  return n !== undefined && !forme!.tenus.includes(pas) && !tenue.includes(pas) ? noeudDuChampAuPoint(noeud, point, pas, n) : undefined;
}

/** Les nœuds de chaque pas du chemin `chemin` (`noeudDuPas`) depuis la donnée `donnee` de l'objet de schéma `objet`, aux
 *  choix `choix` que pose le contexte de son porteur, et la valeur au bout ; l'identité que tient une liste
 *  (`identiteTenue`) reportée au pas qui suit son rang ; `undefined` si le formulaire n'offre pas l'un de ses pas, ou
 *  s'il est vide. */
function noeudsDuChemin(objet: unknown, donnee: Objet, chemin: readonly Segment[], choix: ChoixDuFormulaire): { noeuds: unknown[]; point: unknown } | undefined {
  const noeuds: unknown[] = [];
  let point: unknown = donnee;
  let tenue: readonly string[] = [];
  for (const [rang, pas] of chemin.entries()) {
    const parent = noeuds.length ? noeuds[noeuds.length - 1] : objet;
    const noeud = noeudDuPas(parent, point, pas, () => choix(chemin.slice(0, rang)), tenue);
    if (noeud === undefined) return undefined;
    noeuds.push(noeud);
    const suivant = (point as Record<Segment, unknown> | undefined)?.[pas];
    tenue = typeof pas === 'number' ? identiteTenue(formeAuPoint(parent, point)?.noeud ?? parent, suivant) : [];
    point = suivant;
  }
  return noeuds.length ? { noeuds, point } : undefined;
}

/** L'objet `point`, de nœud `noeud`, porte-t-il une donnée exigée présente hors de sa clé `cle` : un champ déclaré de
 *  sa forme (`formeAuPoint`) présent, dont l'absence n'est pas admise (`retirable`) ou que son porteur exige (`exigee`),
 *  ni `cle` ni un discriminant que tient le choix d'une variante ? */
function porteUneAutreExigee(noeud: unknown, point: unknown, cle: Segment, exigee: (n: unknown) => boolean): boolean {
  const forme = formeAuPoint(noeud, point);
  return (champsDeclares(forme?.noeud) ?? []).some(([k, n]) => k !== cle && !forme!.tenus.includes(k) && (!retirable(n) || exigee(n)) && (point as Objet)[k] !== undefined);
}

/** Le chemin où s'écrit le retrait du champ au chemin `chemin` de la donnée `donnee` de l'objet de schéma `objet`, aux
 *  choix `choix`, et le vide qu'il y écrit (`retraitDuNoeud`) : le sien si son nœud admet son vide sans qu'un porteur
 *  l'exige (`exigeParSonPorteur`), ou s'il est l'entrée d'un record ou l'élément présent d'une liste, qui s'en retire ;
 *  sinon, de proche en proche à travers les clés des objets qui le portent, tant que chacun ne porte aucune autre donnée
 *  exigée présente (`porteUneAutreExigee`), celui du plus proche qui admet son vide, retiré entier, ses champs
 *  facultatifs avec lui, ou vidé à `null` ; ou son refus : un chemin que le formulaire n'offre pas (`nonOffert`), un
 *  champ que son objet exige (`requis`). */
function cheminDuRetrait(objet: unknown, donnee: Objet, chemin: readonly Segment[], choix: ChoixDuFormulaire): { chemin: readonly Segment[]; vide: null | undefined } | 'nonOffert' | 'requis' {
  const pas = noeudsDuChemin(objet, donnee, chemin, choix);
  if (!pas) return 'nonOffert';
  const { noeuds } = pas;
  const prefixe = (j: number) => [j ? noeuds[j - 1] : objet];
  /** Le vide qu'admet le champ du rang `rang` du chemin : retiré, l'entrée d'un record ; sinon celui de son nœud, hors
   *  d'un champ qu'un porteur exige. */
  const videAdmis = (rang: number): { vide: null | undefined } | false =>
    recordDuNoeud(rang ? noeuds[rang - 1] : objet) !== undefined ? { vide: undefined } : !exigeParSonPorteur(prefixe, rang + 1) && retraitDuNoeud(noeuds[rang]);
  if (typeof chemin[chemin.length - 1] === 'number' && pas.point !== undefined) return { chemin, vide: undefined };
  const ici = videAdmis(noeuds.length - 1);
  if (ici) return { chemin, vide: ici.vide };
  const points = [donnee, ...chemin.map((_, i) => auChemin(donnee, chemin.slice(0, i + 1)))];
  for (let rang = noeuds.length - 2; rang >= 0 && typeof chemin[rang + 1] === 'string'; rang--) {
    const soeur = (n: unknown) => (j: number) => (j <= rang + 1 ? prefixe(j) : [n]);
    if (porteUneAutreExigee(noeuds[rang], points[rang + 1], chemin[rang + 1], (n) => exigeParSonPorteur(soeur(n), rang + 2))) return 'requis';
    const vide = videAdmis(rang);
    if (vide) return { chemin: chemin.slice(0, rang + 1), vide: vide.vide };
  }
  return 'requis';
}

/** Pourquoi une valeur ne s'écrit pas : le formulaire n'offre pas son chemin, elle n'est pas de la sorte du champ, elle
 *  est arrivée `null` (un JSON illisible) là où le champ ne l'admet pas, elle est absente d'un champ que son objet exige
 *  (`cheminDuRetrait`), ou elle enfreint une règle, dite : la faute de son parse (`refusDeSorte`), ou celle de son
 *  porteur écrit. */
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

/** Le refus d'une valeur écrite `valeur` qui n'est pas de la sorte du champ de nœud `noeud` : le message de la première
 *  faute de son parse, qui dit la forme attendue ; `horsSorte` si le parse l'admet (une valeur hors des choix que le
 *  contexte pose). */
function refusDeSorte(noeud: unknown, valeur: unknown): RefusDeValeur {
  const [faute] = fautesDuParse(noeud, valeur);
  return faute ? { regle: faute.message } : 'horsSorte';
}

/** La donnée `donnee` de l'objet de schéma `objet` où `valeur` s'écrit au chemin `chemin` (`ecrit`), le champ retiré si
 *  elle vaut `undefined` (l'entrée d'un record partiel ou à clé ouverte, `recordDuNoeud`, et l'élément présent d'une
 *  liste, qui s'en retire, se retirent toujours), vidé si elle vaut `null` là où son nœud n'admet que lui
 *  (`vidableANull`), une liste vidée retirée si son nœud admet l'absence ; ou son refus : un
 *  pas que le formulaire n'offre pas (`noeudDuPas`), une valeur qui n'est pas l'un des choix admis que le contexte de son
 *  porteur y pose (`choix`, qui, d'un record, pose ses clés), ou, sans eux, pas de la sorte du champ (`admise`) ni, au
 *  rang qui suit le dernier élément d'une liste ou à une clé neuve d'un record, sa valeur neuve (`valeurNeuveDe`), dite
 *  par son parse (`refusDeSorte`) ;
 *  un retrait (le champ retiré ou vidé, la liste raccourcie) dont l'objet écrit porte une faute de son parse que la donnée ne portait pas (`fauteNeuve`), dite. Hors retrait, le schéma
 *  entier ne se vérifie qu'à l'enregistrement et à l'essai (#3606, décision 3). */
export function avecLaValeur(objet: unknown, donnee: Objet, chemin: readonly Segment[], valeur: unknown, choix: ChoixDuFormulaire = () => undefined): EcritureDeValeur<Objet> {
  const pas = noeudsDuChemin(objet, donnee, chemin, choix);
  if (!pas) return { ok: false, refus: 'nonOffert' };
  const { noeuds, point } = pas;
  const dernier = noeuds[noeuds.length - 1];
  const ecrite = Array.isArray(valeur) && !valeur.length && elementDuNoeud(dernier) !== undefined && retirable(dernier) ? undefined : valeur;
  const videe = ecrite === null && vidableANull(dernier);
  const poses = ecrite === undefined || videe || recordDuNoeud(dernier) ? undefined : choix(chemin);
  const rang = typeof chemin[chemin.length - 1] === 'number';
  const retiree = ecrite === undefined && ((rang && point !== undefined) || recordDuNoeud(noeuds.length > 1 ? noeuds[noeuds.length - 2] : objet) !== undefined);
  const cleNeuve = !rang && recordDuNoeud(noeuds.length > 1 ? noeuds[noeuds.length - 2] : objet) !== undefined;
  const neuve = () => (rang || cleNeuve) && point === undefined && jsonCanonique(ecrite) === jsonCanonique(valeurNeuveDe(dernier));
  const ecrivable = poses ? poses.some((c) => c.refus === null && jsonCanonique(c.valeur) === jsonCanonique(ecrite)) : retiree || videe || admise(dernier, point, ecrite) || neuve();
  if (!ecrivable) return { ok: false, refus: valeur === null ? 'illisible' : ecrite === undefined ? 'horsSorte' : refusDeSorte(dernier, ecrite) };
  const apres = ecrit(donnee, chemin, ecrite, (rang) => retirable(noeuds[rang])) as Objet;
  const retrait = ecrite === undefined || videe || (Array.isArray(point) && Array.isArray(ecrite) && ecrite.length < point.length);
  const faute = retrait ? fauteNeuve(objet, donnee, apres) : undefined;
  return faute === undefined ? { ok: true, valeur: apres } : { ok: false, refus: { regle: faute } };
}

/** Où s'écrit `valeur` au chemin `chemin` du formulaire de forme `forme`, de donnée `donnee`, aux choix `choix`, et ce
 *  qui s'y écrit : `valeur` au chemin, ou, `valeur` absente, le vide de son retrait au chemin de celui-ci
 *  (`cheminDuRetrait`) ; ou son refus : celui du retrait, une
 *  écriture hors de ses champs, ou qui emporte un champ qu'ils n'offrent pas (`ecritureOfferte`, sur la liste entière
 *  pour le retrait d'un de ses éléments, qui décale ceux qui le suivent), hors d'un retrait déclaré qu'est ce chemin
 *  (`FormeDuFormulaire.retraits`), à ce qu'une adresse de prose dérive (`estCheminDerive`), n'est pas offerte. */
function ouSEcrit({ noeud, champs: offerts, retraits }: FormeDuFormulaire, donnee: unknown, chemin: readonly Segment[], valeur: unknown, choix: ChoixDuFormulaire): { ok: true; ecrit: readonly Segment[]; valeur: unknown } | { ok: false; refus: RefusDeValeur } {
  const retrait = valeur === undefined ? cheminDuRetrait(noeud, donnee as Objet, chemin, choix) : { chemin, vide: valeur };
  if (typeof retrait === 'string') return { ok: false, refus: retrait };
  const ecrit = retrait.chemin;
  const declare = valeur === undefined && jsonCanonique(ecrit) === jsonCanonique(chemin) && retraits.some((r) => jsonCanonique(r) === jsonCanonique(chemin));
  const porte = valeur === undefined && typeof ecrit[ecrit.length - 1] === 'number' ? ecrit.slice(0, -1) : ecrit;
  const offerte = declare || ecritureOfferte(offerts, porte, auChemin(donnee, porte));
  return offerte && !estCheminDerive(noeud, donnee, ecrit) ? { ok: true, ecrit, valeur: retrait.vide } : { ok: false, refus: 'nonOffert' };
}

/** Le retrait de chaque champ, à son chemin, du formulaire de forme `forme`, de donnée `donnee`, aux choix `choix`,
 *  s'écrit-il (`ouSEcrit`), sans compter les fautes du parse qu'il porterait (`fauteNeuve`) ? */
export const retraitAuFormulaire = (forme: FormeDuFormulaire, donnee: unknown, choix: ChoixDuFormulaire) =>
  (chemin: readonly Segment[]): boolean => ouSEcrit(forme, donnee, chemin, undefined, choix).ok;

/** La donnée `donnee` du formulaire de forme `forme` où `valeur` s'écrit au chemin `chemin`, là où elle s'écrit
 *  (`ouSEcrit` ; `avecLaValeur`, aux choix `choix`), son adresse de prose recalée (`adresseRecalee`) et chaque
 *  fragment d'adresse scellé sur le `Source/` `source` (`scellee`) ; ou son refus : celui de `ouSEcrit`, d'`avecLaValeur`
 *  ou de `scellee`. */
export function ecritureAuFormulaire<T>(forme: FormeDuFormulaire, donnee: T, chemin: readonly Segment[], valeur: unknown, choix: ChoixDuFormulaire, source: SourceDeLEdition): EcritureDeValeur<T> {
  const ou = ouSEcrit(forme, donnee, chemin, valeur, choix);
  if (!ou.ok) return ou;
  const { noeud } = forme;
  const ecrite = avecLaValeur(noeud, donnee as Objet, ou.ecrit, ou.valeur, choix);
  return ecrite.ok ? scellee(noeud, donnee, adresseRecalee(noeud, donnee, ecrite.valeur, ou.ecrit), source) : ecrite;
}

/** La donnée `apres`, écrite depuis `donnee` de schéma `noeud`, chaque fragment d'adresse scellé sur le `Source/`
 *  `source` (`adressesScellees`) ; ou son refus : un fragment que seul un chapitre non chargé scellerait n'est pas
 *  offert. */
function scellee<T>(noeud: unknown, donnee: T, apres: unknown, source: SourceDeLEdition): EcritureDeValeur<T> {
  const ecrite = adressesScellees(noeud, donnee, apres, source);
  return ecrite === undefined ? { ok: false, refus: 'nonOffert' } : { ok: true, valeur: ecrite as T };
}

/** La donnée `donnee` du formulaire de forme `forme` où l'élément au chemin `chemin`, le rang d'une liste, passe avant
 *  le précédent, aux choix `choix`, chaque fragment d'adresse scellé sur le `Source/` `source` (`scellee`) ; ou son
 *  refus : un chemin que le formulaire n'offre pas (`noeudsDuChemin`), qui ne désigne pas un élément présent après le
 *  premier, ou une liste qu'il n'écrit pas entière (`ecritureOfferte`) ou qu'une adresse de prose dérive
 *  (`estCheminDerive`), n'est pas offert. */
export function monteeAuFormulaire<T>({ noeud, champs }: FormeDuFormulaire, donnee: T, chemin: readonly Segment[], choix: ChoixDuFormulaire, source: SourceDeLEdition): EcritureDeValeur<T> {
  const rang = chemin[chemin.length - 1];
  const ici = chemin.slice(0, -1);
  const liste = auChemin(donnee, ici);
  const offerte = typeof rang === 'number' && rang > 0 && Array.isArray(liste) && rang < liste.length && noeudsDuChemin(noeud, donnee as Objet, chemin, choix) !== undefined
    && ecritureOfferte(champs, ici, liste) && !estCheminDerive(noeud, donnee, ici);
  if (!offerte) return { ok: false, refus: 'nonOffert' };
  const montee = liste.map((e, i) => (i === rang - 1 ? liste[rang] : i === rang ? liste[rang - 1] : e));
  return scellee(noeud, donnee, ecrit(donnee, ici, montee, () => false), source);
}

/** La donnée `donnee` du formulaire de forme `forme` où l'adresse de prose au chemin `chemin` est rescellée après
 *  relecture (`adresseRescellee`), sur le `Source/` `source` ; ou son refus : un chemin que le formulaire n'offre pas,
 *  qui ne désigne pas une adresse, ou dont le chapitre n'est pas chargé. */
export function rescellementAuFormulaire<T>({ noeud, champs }: FormeDuFormulaire, donnee: T, chemin: readonly Segment[], source: SourceDeLEdition): EcritureDeValeur<T> {
  const rescellee = cheminOffert(champs, chemin) ? adresseRescellee(noeud, donnee, chemin, source) : undefined;
  return rescellee === undefined ? { ok: false, refus: 'nonOffert' } : { ok: true, valeur: rescellee as T };
}
