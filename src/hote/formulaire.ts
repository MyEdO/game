/**
 * LE FORMULAIRE TIRÉ DU SCHÉMA À L'ÉCRAN D'UN HÔTE (#3606, #4020) : les éléments qui écrivent chaque champ d'une donnée
 * (`champsDuFormulaire`, `src/noyau/edition/formulaire.ts`), d'id `valeur/<chemin>…`, pour tout porteur (l'éditeur de
 * carte, `editeur.ts`). Un formulaire et le choix d'une valeur jouent le verbe `valeur`, `args` le
 * porteur, le chemin et la valeur saisie (`valeurDuFormulaire` le relit) ; un bouton joue le geste
 * (`GesteDuFormulaire`) que l'écrivain du porteur emballe (`EcrivainDuFormulaire`).
 */
import {
  bornesAuPoint, champDeLElement, champsDeclares, champsDuRecord, champsOfferts, choixDuNoeud, clesPosees, cleDeLElement, designeDesEntrees, elementDuNoeud,
  estChampDAdresse, etatDeLAdresse, formeAuPoint, gestesDeLaListe, PHRASE_REFUS, unionDuNoeud, valeurNeuveDe, varianteCourante, variantesAChoisir,
  type CheminsOfferts, type FieldDesc, type RefusDeValeur, type Segment, type SourceDeLEdition,
} from '../noyau/index';
import { t } from '../i18n';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from '../lib/objet.mjs';
import { bouton, choix, elementsDesGestes, ligne, SANS_BORNE, type Bouton, type Choix, type Formulaire, type Jeu, type Ligne } from './elements';
import { renduDe, type ArgumentDuGeste, type GesteDeLaFenetre } from './gestes';

/** Un geste d'un formulaire tiré du schéma sur le porteur `P` : écrire `valeur` au chemin `chemin` (absente : le champ
 *  se retire), ou resceller l'adresse de prose au chemin `chemin`. */
export type GesteDuFormulaire<P> = { geste: 'valeur'; porteur: P; chemin: Segment[]; valeur?: unknown } | { geste: 'resceller'; porteur: P; chemin: Segment[] };

/** Ce qu'un porteur de formulaire donne à ses éléments : lui-même, en JSON, en tête des arguments du verbe `valeur` et
 *  dans chaque geste de ses boutons (`GesteDuFormulaire`), et le jeu qui emballe un tel geste. */
export interface EcrivainDuFormulaire<P = unknown> {
  porteur: P;
  emballe(geste: GesteDuFormulaire<P>): Jeu;
}

/** Le jeu qui écrit `valeur` au chemin `chemin` du porteur de `ecrivain` (absente : le champ se retire). */
const ecrire = (ecrivain: EcrivainDuFormulaire, chemin: Segment[], valeur?: unknown): Jeu =>
  ecrivain.emballe({ geste: 'valeur', porteur: ecrivain.porteur, chemin, ...(valeur === undefined ? {} : { valeur }) });

/** Un élément d'un formulaire tiré du schéma. */
export type ElementDuFormulaire = Choix | Ligne | Bouton | Formulaire;

/** Le refus `refus` d'une valeur écrite au chemin `chemin` (`RefusDeValeur`), dit à l'auteur, la règle enfreinte
 *  telle qu'elle se dit. */
export const refusDeValeurDit = (refus: RefusDeValeur, chemin: readonly Segment[]): string =>
  typeof refus === 'object' ? t('ecran.formulaire.valeur.refus.regle', { chemin: chemin.join('/'), regle: refus.regle }) : t(`ecran.formulaire.valeur.refus.${refus}`, { chemin: chemin.join('/') });

/** Les éléments du formulaire de champs `champs` du porteur que sert `ecrivain`, de donnée `donnee`
 *  (`elementsDuFormulaire`), la saisie de texte (`SAISIES_DE_TEXTE`) d'un geste `valeur` optionnelle là où le retrait de
 *  son champ s'écrit (`retire`) : laissée vide, la valeur part absente, qui le retire ; puis, après les éléments de
 *  chacun de ses retraits déclarés `retraits`, « Retirer » (`retraitDeclare`). */
export function elementsDuFormulaireTire<P>(ecrivain: EcrivainDuFormulaire<P>, champs: readonly FieldDesc[], donnee: unknown, retire: (chemin: readonly Segment[]) => boolean, retraits: CheminsOfferts): ElementDuFormulaire[] {
  const elements = elementsDuFormulaire(ecrivain as EcrivainDuFormulaire, champs, donnee as Record<string, unknown>).map((e) => {
    if (e.type !== 'formulaire' || e.verbe !== 'valeur' || !e.champs.some((c) => SAISIES_DE_TEXTE.includes(c.type))) return e;
    const [, chemin] = e.champs;
    return chemin.type === 'fixe' && retire(chemin.valeur as Segment[]) ? { ...e, champs: e.champs.map((c) => (SAISIES_DE_TEXTE.includes(c.type) ? { ...c, optionnel: true } : c)) } : e;
  });
  return retraits.reduce((els, chemin) => retraitDeclare(ecrivain as EcrivainDuFormulaire, els, [...chemin]), elements);
}

/** Ce que joue le formulaire `jeu` du verbe `valeur` parmi les éléments `elements` : son porteur, son chemin et sa
 *  valeur saisie (absente : le champ se retire), quand un formulaire des éléments porte ce porteur et ce chemin, ou
 *  qu'une valeur d'un de leurs choix joue ce jeu même ; `undefined` sinon. */
export function valeurDuFormulaire(elements: readonly unknown[], jeu: unknown): Extract<GesteDuFormulaire<unknown>, { geste: 'valeur' }> | undefined {
  if (!estObjet(jeu) || Object.keys(jeu).length !== 2 || jeu.type !== 'valeur' || !Array.isArray(jeu.args)) return undefined;
  const [porteur, chemin, ...valeur] = jeu.args as unknown[];
  const pose = jsonCanonique([porteur, chemin]);
  const joue = jsonCanonique(jeu);
  const els = elements as ElementDuFormulaire[];
  const offert = els.some((f) => f.type === 'formulaire' && f.verbe === 'valeur' && jsonCanonique(f.champs.slice(0, 2).map((c) => (c.type === 'fixe' ? c.valeur : undefined))) === pose)
    || els.some((e) => (e.type === 'choix' || e.type === 'liste') && e.valeurs.some((b) => jsonCanonique(b.jeu) === joue));
  return offert && valeur.length <= 1 ? { geste: 'valeur', porteur, chemin: chemin as Segment[], ...(valeur.length ? { valeur: valeur[0] } : {}) } : undefined;
}

/** Le pas d'une saisie de nombre qui n'est pas entier. */
const PAS_D_UN_REEL = 0.01;

/** L'argument `nom` du verbe `valeur`, posé à `valeur` (`fixe`). */
const fixe = (nom: string, valeur: unknown): ArgumentDuGeste => ({ nom, optionnel: false, saisie: 'fixe', libelle: null, valeur, valeurs: null, bornes: null, note: null, champs: null });

/** L'argument de la valeur saisie du champ `f`, de valeur courante `valeur` (`undefined` : absent), au chemin `ici` : un
 *  choix parmi ceux que son contexte y pose (`FieldDesc.contexte`), sinon parmi ses valeurs (`choixDuNoeud`), un
 *  nombre entre ses bornes (`FieldDesc.bornes`, ou celles du nombre qu'admet son nœud, `bornesAuPoint`), au pas de 1
 *  s'il est entier, un texte, ou du JSON. */
function argumentDeValeur(f: FieldDesc, valeur: unknown, ici: readonly Segment[]): ArgumentDuGeste {
  const choix = f.contexte?.choix(ici) ?? choixDuNoeud(f.noeud)?.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: null }));
  const base = { nom: 'valeur', optionnel: false, libelle: f.label, valeur: valeur ?? null, valeurs: null, bornes: null, note: null, champs: null };
  if (choix) return { ...base, saisie: 'choix', valeurs: [...choix] };
  const nombre = f.kind === 'number' ? f.bornes ?? null : bornesAuPoint(f.noeud, valeur);
  if (nombre !== undefined) return { ...base, saisie: 'nombre', bornes: { min: nombre?.min ?? SANS_BORNE.min, max: nombre?.max ?? SANS_BORNE.max, pas: nombre?.entier ? 1 : PAS_D_UN_REEL } };
  return { ...base, saisie: f.kind === 'text' ? 'texte' : f.kind === 'textarea' ? 'multiligne' : 'json' };
}

/** L'élément du geste d'id `cle`, de verbe `verbe` et d'arguments `args`, rendu par `renduDe` et dessiné par
 *  `elementsDesGestes` (un choix, en liste au-delà de `CHOIX_EN_BOUTONS`, en liste quel que soit son compte parmi des
 *  `entrees`, ou un formulaire), libellé `libelle` d'après son rendu. */
function elementDuGeste(cle: string, verbe: string, args: ArgumentDuGeste[], libelle: (rendu: GesteDeLaFenetre['rendu']) => string, entrees: boolean): Bouton | Choix | Formulaire {
  const lu = renduDe(args);
  const rendu = entrees && lu.rendu === 'choix' ? { ...lu, rendu: 'liste' as const } : lu;
  return elementsDesGestes([{ cle, verbe, libelle: libelle(rendu.rendu), arguments: args, ...rendu, attendu: false, ouvert: true, raison: null, reglage: false }])[0];
}

/** L'élément qui écrit au champ `f`, au chemin `chemin` du porteur de `ecrivain`, la valeur de son argument `a` : le geste
 *  `valeur` qui pose le porteur et le chemin (`elementDuGeste`), son choix parmi des entrées si son nœud désigne des
 *  entrées (`designeDesEntrees`), hors du choix des variantes d'une union (`unionDuNoeud`), ensemble fermé. */
const elementDeValeur = (id: string, ecrivain: EcrivainDuFormulaire, chemin: Segment[], f: FieldDesc, a: ArgumentDuGeste): Bouton | Choix | Formulaire =>
  elementDuGeste(id, 'valeur', [fixe('porteur', ecrivain.porteur), fixe('chemin', chemin), a], (rendu) => (rendu === 'formulaire' ? t('ecran.formulaire.valeur.ecrire') : f.label), designeDesEntrees(f.noeud) && !unionDuNoeud(f.noeud));

/** Les saisies de texte, qui, laissées vides, retirent leur champ. */
const SAISIES_DE_TEXTE: readonly string[] = ['saisieTexte', 'saisieMultiligne'];

/** Les éléments `elements` d'un formulaire du porteur de `ecrivain` où « Retirer » du retrait déclaré au chemin `chemin`,
 *  d'id `valeur/<chemin>/retirer`, libellé de la ligne de son objet, suit le dernier élément sous ce chemin, jouant
 *  le geste `valeur` sans valeur (`GesteDuFormulaire`) ; tels quels si aucun n'y est. */
function retraitDeclare(ecrivain: EcrivainDuFormulaire, elements: ElementDuFormulaire[], chemin: Segment[]): ElementDuFormulaire[] {
  const id = `valeur/${chemin.join('/')}`;
  const tete = elements.find((e): e is Ligne => e.type === 'ligne' && e.id === id);
  const fin = elements.map((e) => e.id === id || e.id.startsWith(`${id}/`)).lastIndexOf(true);
  if (!tete || fin < 0) return elements;
  return [...elements.slice(0, fin + 1), bouton(`${id}/retirer`, t('ecran.formulaire.valeur.retirer', { libelle: tete.texte }), ecrire(ecrivain, chemin)), ...elements.slice(fin + 1)];
}

/** Les champs offerts du nœud `noeud` à la donnée `objet` (`champsOfferts`, hors des discriminants `tenus`), sous le champ
 *  `f` au chemin `ici` : ceux que son contexte offre (`FieldDesc.contexte`), dans ce contexte. */
const champsSous = (f: FieldDesc, ici: Segment[], noeud: unknown, objet: Record<string, unknown>, tenus?: readonly string[]): FieldDesc[] => {
  const { contexte } = f;
  return contexte ? champsOfferts(noeud, objet, tenus).filter((c) => contexte.offert([...ici, c.key])).map((c) => ({ ...c, contexte })) : champsOfferts(noeud, objet, tenus);
};

/** Les éléments du formulaire tiré du schéma des champs `champs` (`FieldDesc`) du porteur de `ecrivain`, de donnée
 *  `donnee`, au chemin `chemin` : ceux de chaque champ (`elementsDuChamp`), à plat. */
function elementsDuFormulaire(ecrivain: EcrivainDuFormulaire, champs: readonly FieldDesc[], donnee: Record<string, unknown>, chemin: Segment[] = []): ElementDuFormulaire[] {
  return champs.flatMap((f) => elementsDuChamp(ecrivain, f, donnee[f.key], [...chemin, f.key]));
}

/** Les éléments du champ `f` du porteur de `ecrivain`, de valeur `valeur` (`undefined` : absent), au chemin `ici`, d'id
 *  `valeur/<chemin>`, chacun jouant le geste `valeur` (`GesteDuFormulaire`). Un objet (`champsDeclares`)
 *  présent : son libellé, ses champs offerts (`champsOfferts`), et « Retirer » si son absence est admise ; absent ou
 *  vide (`null`, un objet nullable) : « Ajouter » (`ajoutDeLObjet`). Une union nommée : sa variante (`elementsDeLUnion`). Une
 *  liste : ses éléments (`elementsDeLaListe`). Un record dont les clés sont posées (`clesPosees`) : ses entrées (`elementsDuRecord`). Un objet d'une union sans variantes nommées : son libellé et les champs
 *  de la branche qu'il dessine (`formeAuPoint`), et « Retirer » si son absence est admise. Tout autre champ : l'élément de sa valeur (`elementDeValeur`), puis, si
 *  son absence est admise, « Aucune » sous un choix, pressé quand il est absent, ou « Retirer » sous un champ présent.
 *  « Retirer » ne se pose que là où son contexte écrit le champ entier (`ContexteDuChamp.ecrivable`). */
function elementsDuChamp(ecrivain: EcrivainDuFormulaire, f: FieldDesc, valeur: unknown, ici: Segment[]): ElementDuFormulaire[] {
  const id = `valeur/${ici.join('/')}`;
  const retirable = valeur !== undefined && f.nullable && (f.contexte?.ecrivable(ici, valeur) ?? true);
  const retirer = retirable ? [bouton(`${id}/retirer`, t('ecran.formulaire.valeur.retirer', { libelle: f.label }), ecrire(ecrivain, ici))] : [];
  if (f.contexte && estChampDAdresse(f.noeud)) return elementsDeLAdresse(ecrivain, f, valeur, ici, retirer, f.contexte.source);
  if (champsDeclares(f.noeud)) {
    if (valeur == null) return ajoutDeLObjet(ecrivain, f, ici);
    const objet = valeur as Record<string, unknown>;
    return [ligne(id, f.label), ...elementsDuFormulaire(ecrivain, champsSous(f, ici, f.noeud, objet), objet, ici), ...retirer];
  }
  if (unionDuNoeud(f.noeud)) return elementsDeLUnion(ecrivain, f, valeur, ici);
  if (elementDuNoeud(f.noeud) !== undefined) return elementsDeLaListe(ecrivain, f, valeur, ici);
  if (clesPosees(f, ici)) return elementsDuRecord(ecrivain, f, valeur, ici, retirer);
  const forme = formeAuPoint(f.noeud, valeur)?.noeud;
  if (estObjet(valeur) && champsDeclares(forme)) return [ligne(id, f.label), ...elementsDuFormulaire(ecrivain, champsSous(f, ici, forme, valeur), valeur, ici), ...retirer];
  const a = argumentDeValeur(f, valeur, ici);
  const aucune = a.saisie === 'choix' && f.nullable ? [bouton(`${id}/aucune`, t('ecran.formulaire.valeur.aucune'), ecrire(ecrivain, ici), valeur === undefined)] : [];
  return [elementDeValeur(id, ecrivain, ici, f, a), ...(a.saisie === 'choix' ? aucune : retirer)];
}

/** Les éléments du champ adresse de prose `f` (`estChampDAdresse`), de valeur `valeur`, au chemin `ici`, « Retirer »
 *  `retirer`, sur le `Source/` `source` : absente, le choix de son livre (`ajoutDeLObjet`), ou, sans `Source/` servi, la
 *  ligne qui le dit ; présente, son libellé, ses champs offerts (son empreinte jamais), ses fragments seulement sur son
 *  chapitre chargé, puis ce que dit son état (`etatDeLAdresse`) : le `Source/` absent, le chapitre à choisir, qui se
 *  charge ou introuvable, le passage qu'elle résout, ou le refus du parseur (`PHRASE_REFUS`), et, d'une empreinte qui
 *  diverge, « Resceller après relecture » (le geste `resceller`). */
function elementsDeLAdresse(ecrivain: EcrivainDuFormulaire, f: FieldDesc, valeur: unknown, ici: Segment[], retirer: Bouton[], source: SourceDeLEdition): ElementDuFormulaire[] {
  const id = `valeur/${ici.join('/')}`;
  const sansSource = ligne(`${id}/etat`, t('ecran.formulaire.adresse.sansSource'));
  if (valeur === undefined) return source.manifeste ? ajoutDeLObjet(ecrivain, f, ici) : [sansSource];
  const adresse = valeur as Parameters<typeof etatDeLAdresse>[1];
  const etat = etatDeLAdresse(source, adresse);
  const charge = etat.etat === 'resolue' || etat.etat === 'refusee';
  const champs = champsSous(f, ici, f.noeud, adresse as unknown as Record<string, unknown>).filter((c) => charge || c.key !== 'parts');
  const dit = (texte: string) => [ligne(`${id}/etat`, texte)];
  const lignes = etat.etat === 'sansSource' ? [sansSource]
    : etat.etat === 'resolue' ? (etat.md ? dit(t('ecran.formulaire.adresse.passage', { texte: coupeAuMot(etat.md, LONGUEUR_DU_PASSAGE) })) : [])
      : etat.etat === 'refusee' ? dit(etat.erreur.fragment === undefined ? PHRASE_REFUS[etat.erreur.error] : t('ecran.formulaire.adresse.refus', { rang: etat.erreur.fragment + 1, phrase: PHRASE_REFUS[etat.erreur.error] }))
        : dit(t(`ecran.formulaire.adresse.${etat.etat}`));
  const resceller = etat.etat === 'refusee' && etat.erreur.error === 'empreinte-divergente'
    ? [bouton(`${id}/resceller`, t('ecran.formulaire.adresse.resceller'), ecrivain.emballe({ geste: 'resceller', porteur: ecrivain.porteur, chemin: ici }))] : [];
  return [ligne(id, f.label), ...elementsDuFormulaire(ecrivain, champs, adresse as unknown as Record<string, unknown>, ici), ...lignes, ...resceller, ...retirer];
}

/** Le plus long passage qu'une adresse de prose montre, en caractères (`coupeAuMot`). */
const LONGUEUR_DU_PASSAGE = 240;

/** Les éléments du champ record `f` dont les clés sont posées (`clesPosees`), de valeur `valeur`, au chemin `ici`,
 *  « Retirer » `retirer` : présent, son libellé, chacune de ses entrées (`champsDuRecord`), comme les champs d'un objet,
 *  et « Retirer » ; absent, « Ajouter », qui le pose vide (`valeurNeuveDe`), si une clé lui est offerte. */
function elementsDuRecord(ecrivain: EcrivainDuFormulaire, f: FieldDesc, valeur: unknown, ici: Segment[], retirer: Bouton[]): ElementDuFormulaire[] {
  const id = `valeur/${ici.join('/')}`;
  if (estObjet(valeur)) return [ligne(id, f.label), ...elementsDuFormulaire(ecrivain, champsDuRecord(f, valeur, ici), valeur, ici), ...retirer];
  return champsDuRecord(f, {}, ici).length ? [bouton(`${id}/ajouter`, t('ecran.formulaire.valeur.ajouter', { libelle: f.label }), ecrire(ecrivain, ici, valeurNeuveDe(f.noeud)))] : [];
}

/** Les éléments du champ union `f` (`unionDuNoeud`), de valeur `valeur`, au chemin `ici`, les discriminants `tenus` déjà
 *  choisis : le choix de sa variante, d'id `valeur/<chemin>/<discriminant>` (`…/forme` d'une union sans discriminant),
 *  chacune posant sa valeur (celles que son
 *  contexte y pose, `FieldDesc.contexte`, sinon `variantesAChoisir`), suivi de « Aucune » si son absence est
 *  admise ; puis, de la variante courante, une union
 *  choisie sous le même chemin, ses champs offerts, les éléments de sa liste (`elementsDeLaListe`), la saisie de sa valeur hors objet (le nombre d'une formule), ou, d'une op sans forme déclarée, la ligne qui le dit et la saisie
 *  JSON de l'op entière. */
function elementsDeLUnion(ecrivain: EcrivainDuFormulaire, f: FieldDesc, valeur: unknown, ici: Segment[], tenus: readonly string[] = []): ElementDuFormulaire[] {
  const id = `valeur/${ici.join('/')}`;
  const u = unionDuNoeud(f.noeud)!;
  const idDuChoix = `${id}/${u.discriminant || 'forme'}`;
  const variantes = f.contexte?.choix(ici) ?? variantesAChoisir(f.noeud, valeur)!.map((v) => ({ valeur: v.valeur, libelle: v.libelle, refus: null }));
  const a: ArgumentDuGeste = { nom: 'valeur', optionnel: false, saisie: 'choix', libelle: f.label, valeur: valeur ?? null, valeurs: [...variantes], bornes: null, note: null, champs: null };
  const aucune = f.nullable ? [bouton(`${idDuChoix}/aucune`, t('ecran.formulaire.valeur.aucune'), ecrire(ecrivain, ici), valeur === undefined)] : [];
  const courante = varianteCourante(u, valeur);
  const choisis = [...tenus, u.discriminant];
  const suite = (): ElementDuFormulaire[] => {
    if (!courante) return [];
    if (courante.noeud === undefined) {
      return [ligne(`${id}/motif`, t('ecran.formulaire.valeur.motif.opNonTypee')), elementDeValeur(id, ecrivain, ici, f, { ...a, saisie: 'json', valeurs: null })];
    }
    if (unionDuNoeud(courante.noeud)) return elementsDeLUnion(ecrivain, { ...f, label: courante.libelle, nullable: false, noeud: courante.noeud }, valeur, ici, choisis);
    if (elementDuNoeud(courante.noeud) !== undefined) return elementsDeLaListe(ecrivain, { ...f, label: courante.libelle, noeud: courante.noeud }, valeur, ici);
    if (!champsDeclares(courante.noeud)) {
      const scalaire = { ...f, label: courante.libelle, noeud: courante.noeud };
      return [elementDeValeur(id, ecrivain, ici, scalaire, argumentDeValeur(scalaire, valeur, ici))];
    }
    const objet = valeur as Record<string, unknown>;
    return elementsDuFormulaire(ecrivain, champsSous(f, ici, courante.noeud, objet, choisis), objet, ici);
  };
  return [elementDeValeur(idDuChoix, ecrivain, ici, f, a), ...aucune, ...suite()];
}

/** Les éléments du champ liste `f` (`elementDuNoeud`), de valeur `valeur`, au chemin `ici` : présente, son libellé puis
 *  chacun de ses éléments, au chemin de son rang (`champDeLElement`), la clé qui l'identifie à son libellé
 *  (`cleDeLElement`, sinon son identifiant s'il en porte un, #3606), ses éléments, « Retirer » et, hors du premier,
 *  « Monter » ; puis « Ajouter » (`ajoutALaListe`). Chaque bouton écrit la liste entière (`gestesDeLaListe`). Une liste
 *  à laquelle rien ne s'ajoute (un élément récursif, sans valeur neuve ni choix) : la saisie de sa valeur entière
 *  (`argumentDeValeur`), en JSON. Une liste que son contexte n'écrit pas entière (`ContexteDuChamp.ecrivable`) : son
 *  libellé et les éléments de chacun, la clé qui l'identifie à son libellé, sans « Retirer » ni « Monter », puis
 *  « Ajouter » au rang qui suit le dernier (`ajoutAuRangNeuf`). */
function elementsDeLaListe(ecrivain: EcrivainDuFormulaire, f: FieldDesc, valeur: unknown, ici: Segment[]): ElementDuFormulaire[] {
  const id = `valeur/${ici.join('/')}`;
  const liste = Array.isArray(valeur) ? valeur : [];
  const champ = (e: unknown, rang: number): FieldDesc => {
    const rangee = champDeLElement(f, rang);
    const cle = cleDeLElement(f.noeud, e) ?? (estObjet(e) && typeof e.id === 'string' ? e.id : undefined);
    return cle === undefined ? rangee : { ...rangee, label: t('ecran.formulaire.valeur.elementCle', { libelle: rangee.label, id: cle }) };
  };
  if (!(f.contexte?.ecrivable(ici, valeur) ?? true)) return [ligne(id, f.label), ...liste.flatMap((e, rang) => elementsDuChamp(ecrivain, champ(e, rang), e, [...ici, rang])), ...ajoutAuRangNeuf(ecrivain, f, [...ici, liste.length])];
  const element = elementDuNoeud(f.noeud);
  const gestes = gestesDeLaListe(liste, valeurNeuveDe(element));
  const elements = liste.flatMap((e, rang) => {
    const { label } = champ(e, rang);
    const { retirer, monter } = gestes.elements[rang];
    return [
      ...elementsDuChamp(ecrivain, champ(e, rang), e, [...ici, rang]),
      bouton(`${id}/${rang}/retirer`, t('ecran.formulaire.valeur.retirer', { libelle: label }), ecrire(ecrivain, ici, retirer)),
      ...(monter ? [bouton(`${id}/${rang}/monter`, t('ecran.formulaire.valeur.monter', { libelle: label }), ecrire(ecrivain, ici, monter))] : []),
    ];
  });
  const ajouter = ajoutALaListe(ecrivain, f, liste, ici, element, gestes.ajouter);
  if (!ajouter) return [elementDeValeur(id, ecrivain, ici, f, argumentDeValeur(f, valeur, ici))];
  return valeur === undefined ? [ajouter] : [ligne(id, f.label), ...elements, ajouter];
}

/** « Ajouter » au rang neuf `rangNeuf` de la liste du champ `f`, d'id `valeur/<chemin>/ajouter`, là où son contexte
 *  l'offre (`ContexteDuChamp.offert`) : l'élément qu'il y pose (`ContexteDuChamp.choix`), écrit à ce rang ; de plusieurs,
 *  leur liste, chacun `…/ajouter/<k>` à son libellé ; aucun sans eux. */
function ajoutAuRangNeuf(ecrivain: EcrivainDuFormulaire, f: FieldDesc, rangNeuf: Segment[]): (Bouton | Choix)[] {
  const id = `valeur/${rangNeuf.slice(0, -1).join('/')}/ajouter`;
  const libelle = t('ecran.formulaire.valeur.ajouter', { libelle: f.label });
  const neufs = f.contexte?.offert(rangNeuf) ? f.contexte.choix(rangNeuf) ?? [] : [];
  const ajout = (c: (typeof neufs)[number], ici: string, texte: string) => bouton(ici, texte, ecrire(ecrivain, rangNeuf, c.valeur), false, c.refus);
  if (neufs.length === 1) return [ajout(neufs[0], id, libelle)];
  return neufs.length ? [choix(id, libelle, neufs.map((c, k) => ajout(c, `${id}/${k}`, c.libelle)), 'liste')] : [];
}

/** « Ajouter » de l'objet absent du champ `f`, au chemin `ici`, d'id `valeur/<chemin>/ajouter` : le choix de l'objet posé
 *  parmi ceux que son contexte y pose (`FieldDesc.contexte`), aucun s'il n'en pose aucun, sinon le bouton qui écrit sa
 *  valeur neuve (`valeurNeuveDe`). */
function ajoutDeLObjet(ecrivain: EcrivainDuFormulaire, f: FieldDesc, ici: Segment[]): (Bouton | Choix | Formulaire)[] {
  const id = `valeur/${ici.join('/')}/ajouter`;
  const libelle = t('ecran.formulaire.valeur.ajouter', { libelle: f.label });
  const valeurs = f.contexte?.choix(ici);
  if (!valeurs) return [bouton(id, libelle, ecrire(ecrivain, ici, valeurNeuveDe(f.noeud)))];
  const a: ArgumentDuGeste = { nom: 'valeur', optionnel: false, saisie: 'choix', libelle, valeur: null, valeurs: [...valeurs], bornes: null, note: null, champs: null };
  return valeurs.length ? [elementDeValeur(id, ecrivain, ici, { ...f, label: libelle }, a)] : [];
}

/** « Ajouter » à la liste `liste` du champ `f`, au chemin `ici`, d'élément `element`, d'id `valeur/<chemin>/ajouter` :
 *  le choix de l'élément ajouté en fin, parmi ceux que son contexte pose au rang qui suit le dernier
 *  (`FieldDesc.contexte`), sinon, d'un élément à choix (`choixDuNoeud`), parmi ses valeurs ; sinon, le bouton qui écrit
 *  `neuve`, la liste où s'ajoute un élément neuf (`valeurNeuveDe`) ; `undefined` sans elle. */
function ajoutALaListe(ecrivain: EcrivainDuFormulaire, f: FieldDesc, liste: readonly unknown[], ici: Segment[], element: unknown, neuve: unknown[] | null): Bouton | Choix | Formulaire | undefined {
  const id = `valeur/${ici.join('/')}/ajouter`;
  const libelle = t('ecran.formulaire.valeur.ajouter', { libelle: f.label });
  const valeurs = f.contexte?.choix([...ici, liste.length]) ?? choixDuNoeud(element)?.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: null }));
  if (!valeurs) return neuve ? bouton(id, libelle, ecrire(ecrivain, ici, neuve)) : undefined;
  const a: ArgumentDuGeste = { nom: 'valeur', optionnel: false, saisie: 'choix', libelle, valeur: null, valeurs: valeurs.map((v) => ({ ...v, valeur: [...liste, v.valeur] })), bornes: null, note: null, champs: null };
  return elementDeValeur(id, ecrivain, ici, { ...f, label: libelle, noeud: element }, a);
}
