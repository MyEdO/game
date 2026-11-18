/**
 * LA SESSION DU COMPENDIUM (#4020), PURE : la consultation du Codex (famille, catégorie, recherche, facettes, entrée
 * montrée et son instance, renvoi suivi) et l'atelier d'une entrée d'une catégorie éditable (modifier, créer, écrire une
 * valeur, monter un élément de liste, resceller une adresse de prose, identifier, écrire le dé d'en-tête, abandonner, enregistrer, supprimer). Elle
 * lit le registre et les datasets et DÉCRIT la transaction demandée (`transactionDemandee`) ; l'hôte la joue
 * (`enregistrerEntree`, `supprimerEntree`) et en rapporte l'issue (`enregistrement`). Le formulaire de l'atelier est
 * celui de l'éditeur de carte (`src/noyau/edition/formulaire.ts`), le `Source/` servi aussi (`SourceServie`).
 */
import {
  designations,
  editableDataset,
  editableObjectDataset,
  isEditableCategory,
  validateEntry,
  type PaquetLu,
} from '../../data/atelierDuCodex';
import { ancetreDuDe, champDEnTete, datasetObject, entreesDuDataset, type EcritureDEnTete } from '../../data/overrides';
import type { DiceSpec } from '../../engine/dice';
import { DATASET_FICHIER_DERIVE } from '../../data/schemas/exposition-derivee';
import { RACINES_VIVANTES } from '../../data/schemas/_racines-vivantes.generated';
import { noeudDeLEntree, noeudsDesEntrees, schemaForFile } from '../../data/schemas/validate';
import { noeudsAuChemin } from '../../data/schemas/grammaire/descente';
import type { Manifeste } from '../../data/source/chapitres';
import { t as tr } from '../../i18n';
import { CODEX_GROUPS, categoryByKey, clustersIn, codexLookupById, type CibleDuCompendium, type CodexGroup, type CodexItem } from './registry';
import { facetRows, filterItems, type FacetSelection } from './search';
import { reverseGroups, type ReverseGroup } from './relations';
import { champsOfferts, type FieldDesc } from './editFields';
import { valeurNeuveDe } from '../valeursNeuves';
import { choixDeLaReferenceLocale } from '../sceneEditLecture';
import {
  champsDuFormulaire,
  cheminOffert,
  ecritureAuFormulaire,
  monteeAuFormulaire,
  rescellementAuFormulaire,
  retraitAuFormulaire,
  type ChoixDuFormulaire,
  type CheminsOfferts,
  type FormeDuFormulaire,
  type RefusDeValeur,
  type Segment,
} from '../edition/formulaire';
import {
  adressesDe,
  avecLeChapitreDemande,
  avecLeChapitreRecu,
  choixSousUneAdresse,
  estCheminDerive,
  sourceServie,
  type SourceServie,
} from '../edition/adresseDeProse';

type Entree = Record<string, unknown>;

/** L'entrée ouverte à l'atelier : sa catégorie, son rang dans son dataset-liste (`-1` : création, ou dataset-objet),
 *  l'id qu'elle portait à l'ouverture (`null` : création, ou dataset-objet), son brouillon, le dé d'en-tête saisi de sa
 *  table (`ancetreDuDe`), et la transaction demandée, que l'hôte joue. */
export interface AtelierDuCompendium {
  categorie: string;
  index: number;
  idDOrigine: string | null;
  entree: Entree;
  enTete: readonly EcritureDEnTete[];
  enCours: 'enregistrer' | 'supprimer' | null;
}

/** Pourquoi le dernier geste n'a rien changé, dit à l'auteur : en clair, ou le refus d'une valeur écrite à son chemin,
 *  que l'hôte dit (`refusDeValeurDit`). */
export type RefusDuCompendium = string | { chemin: readonly Segment[]; refus: RefusDeValeur };

/** La session du Compendium. `refus` vaut pour le dernier geste seul : tout geste le lève. */
export interface SessionDuCompendium {
  famille: CodexGroup;
  /** La clé de la catégorie consultée (`CODEX`), `null` avant tout choix. */
  categorie: string | null;
  recherche: string;
  facettes: FacetSelection;
  /** L'entrée montrée, et son instance : le libellé qui porte ses Indices (« 8 Tentacules +8 », `CodexRow` `ref`). */
  montree: { id: string; instance?: string } | null;
  atelier: AtelierDuCompendium | null;
  refus: RefusDuCompendium | null;
  /** Le `Source/` que l'hôte sert aux adresses de prose du brouillon. */
  source: SourceServie;
  /** Les paquets de campagne que le jeu embarque, où une désignation se cherche aussi (`designations`). */
  paquets: readonly PaquetLu[];
}

/** Un geste du Compendium. Consultation : choisir la famille, la catégorie, le terme de recherche, basculer une valeur
 *  de facette, montrer une entrée, suivre un renvoi vers une entrée d'une autre catégorie. Atelier : modifier l'entrée
 *  montrée, en créer une, écrire une valeur au chemin `chemin` du brouillon (`valeur` absente : le champ se retire), y
 *  monter l'élément d'une liste avant le précédent, y resceller une adresse de prose, donner son identifiant, écrire le dé d'en-tête de sa table, abandonner, demander son
 *  enregistrement ou sa suppression, puis l'issue que l'hôte en rapporte ; l'issue du chargement du chapitre attendu. */
export type GesteDuCompendium =
  | { geste: 'famille'; famille: CodexGroup }
  | { geste: 'categorie'; categorie: string }
  | { geste: 'recherche'; terme: string }
  | { geste: 'facette'; cle: string; valeur: string }
  | { geste: 'montrer'; id: string; instance?: string }
  | { geste: 'suivre'; categorie: string; id: string; instance?: string }
  | { geste: 'modifier' }
  | { geste: 'creer' }
  | { geste: 'valeur'; chemin: Segment[]; valeur?: unknown }
  | { geste: 'monter'; chemin: Segment[] }
  | { geste: 'resceller'; chemin: Segment[] }
  | { geste: 'identifier'; id: string }
  | { geste: 'enTete'; valeur: DiceSpec }
  | { geste: 'abandonner' }
  | { geste: 'enregistrer' }
  | { geste: 'supprimer' }
  | { geste: 'enregistrement'; reussi: boolean; refus?: string }
  | { geste: 'chapitre'; book: string; ch: string; texte: string | null };


/** Le Compendium ouvert sur la première famille, le `Source/` d'index `manifeste` servi, les paquets `paquets` lus ; sur
 *  l'entrée `cible`, si elle est donnée, comme un renvoi suivi (`suivre`). */
export function ouvrirLeCompendium(manifeste: Manifeste | null, paquets: readonly PaquetLu[], cible?: CibleDuCompendium): SessionDuCompendium {
  const ouverte: SessionDuCompendium = {
    famille: CODEX_GROUPS[0],
    categorie: null,
    recherche: '',
    facettes: {},
    montree: null,
    atelier: null,
    refus: null,
    source: sourceServie(manifeste),
    paquets,
  };
  return cible ? compendium(ouverte, { geste: 'suivre', ...cible }) : ouverte;
}

/** La clé du dataset de la catégorie éditable `categorie` : son dataset-liste, ou son dataset-objet. */
const datasetDe = (categorie: string): string => editableDataset(categorie) ?? editableObjectDataset(categorie)!.ds;

/** La forme du formulaire de l'atelier `a` : le nœud de son entrée (`noeudDeLEntree`), ouvert sur son cas, chacun de ses
 *  champs offerts (`champsOfferts`) hors de son identité, que change `identifier`, et de ce qu'une adresse de prose
 *  dérive (`estCheminDerive`), aucun retrait déclaré. */
function formeDeLAtelier(a: AtelierDuCompendium): FormeDuFormulaire {
  const noeud = noeudDeLEntree(datasetDe(a.categorie), a.entree);
  const champs = champsOfferts(noeud, a.entree, ['id']).filter((f) => !estCheminDerive(noeud, a.entree, [f.key])).map((f) => [f.key]);
  return { noeud, champs, retraits: [] };
}

/** Les choix que le contexte de l'atelier `a`, de nœud `noeud`, pose à un chemin de son brouillon : sous une adresse de
 *  prose, ceux du `Source/` `source` (`choixSousUneAdresse`) ; d'une référence locale, ceux de la portée que l'entrée ou
 *  la racine de son fichier ouvre (`choixDeLaReferenceLocale`) ; sinon ceux du nœud. */
function choixDeLAtelier(a: AtelierDuCompendium, noeud: unknown, source: SourceServie): ChoixDuFormulaire {
  const fichier = DATASET_FICHIER_DERIVE[datasetDe(a.categorie)];
  const ouvreurs = [[noeud, a.entree], [schemaForFile(fichier), RACINES_VIVANTES[fichier]]] as const;
  return (chemin) => choixSousUneAdresse(noeud, a.entree, chemin, source) ?? choixDeLaReferenceLocale(noeudsAuChemin(noeud, a.entree, chemin), ouvreurs);
}

/** Ce dont l'hôte tire les éléments du formulaire de l'atelier (`elementsDuFormulaireTire`) : ses champs décrits
 *  (`champsDuFormulaire`), le brouillon, le retrait de chaque champ (`retraitAuFormulaire`) et ses retraits déclarés ;
 *  `undefined` sans atelier. */
export function formulaireDeLAtelier(s: SessionDuCompendium): { champs: FieldDesc[]; donnee: Entree; retire: (chemin: readonly Segment[]) => boolean; retraits: CheminsOfferts } | undefined {
  const a = s.atelier;
  if (!a) return undefined;
  const forme = formeDeLAtelier(a);
  const choix = choixDeLAtelier(a, forme.noeud, s.source);
  return { champs: champsDuFormulaire(forme, a.entree, choix, s.source), donnee: a.entree, retire: retraitAuFormulaire(forme, a.entree, choix), retraits: forme.retraits };
}

/** La transaction que l'atelier de `s` demande, que l'hôte joue : l'enregistrement de son brouillon à son rang, son dé
 *  d'en-tête avec lui, ou la suppression de l'entrée à son rang ; `null` sans demande. */
export type TransactionDuCompendium =
  | { sorte: 'enregistrer'; categorie: string; entree: Entree; index: number; enTete: readonly EcritureDEnTete[] }
  | { sorte: 'supprimer'; categorie: string; index: number };

/** La transaction demandée de `s` (`TransactionDuCompendium`), `null` sans elle. */
export function transactionDemandee(s: SessionDuCompendium): TransactionDuCompendium | null {
  const a = s.atelier;
  if (!a?.enCours) return null;
  return a.enCours === 'enregistrer'
    ? { sorte: 'enregistrer', categorie: a.categorie, entree: a.entree, index: a.index, enTete: a.enTete }
    : { sorte: 'supprimer', categorie: a.categorie, index: a.index };
}

/** L'entrée de l'atelier `a` porte-t-elle un identifiant : une entrée d'un dataset-liste, jamais une configuration unique. */
export const atelierIdentifiable = (a: AtelierDuCompendium): boolean => editableDataset(a.categorie) !== undefined;

/** Le dé d'en-tête de la table de l'atelier `a` (`ancetreDuDe`), saisi sinon imprimé ; `undefined` si sa table n'en porte pas. */
export function deDeLAtelier(a: AtelierDuCompendium): DiceSpec | undefined {
  const ds = editableDataset(a.categorie);
  const ancetre = ds && ancetreDuDe(ds);
  if (!ds || ancetre === undefined) return undefined;
  const saisi = a.enTete.find((e) => e.champ === 'die');
  return (saisi ? saisi.valeur : champDEnTete(ds, ancetre, 'die')) as DiceSpec;
}

/** Les catégories de la famille de `s`, à plat et par sous-groupe (`clustersIn`). */
export const categoriesDeLaFamille = (s: SessionDuCompendium): ReturnType<typeof clustersIn> => clustersIn(s.famille);

/** Les entrées de la catégorie de `s` qui passent sa recherche et ses facettes (`filterItems`) ; aucune sans catégorie. */
export function entreesListees(s: SessionDuCompendium): CodexItem[] {
  const c = s.categorie === null ? undefined : categoryByKey(s.categorie);
  return c ? filterItems(c.items, s.recherche, c.facets ?? [], s.facettes) : [];
}

/** Les facettes utiles de la catégorie de `s`, chacune avec ses valeurs comptées (`facetRows`) ; aucune sans catégorie. */
export function facettesOffertes(s: SessionDuCompendium): ReturnType<typeof facetRows> {
  const c = s.categorie === null ? undefined : categoryByKey(s.categorie);
  return c ? facetRows(c.items, s.recherche, c.facets ?? [], s.facettes) : [];
}

/** La fiche de l'entrée montrée de `s` (`codexLookupById`), `undefined` sans elle. */
export const entreeMontree = (s: SessionDuCompendium): CodexItem | undefined =>
  s.montree && s.categorie !== null ? codexLookupById(s.categorie, s.montree.id) : undefined;

/** Les renvois inverses vers l'entrée montrée de `s` (`reverseGroups`) ; aucun sans elle. */
export const renvoisDeLEntree = (s: SessionDuCompendium): ReverseGroup[] =>
  s.montree && s.categorie !== null ? reverseGroups(s.categorie, s.montree.id) : [];

/** La session `s` où le geste n'a rien changé, pour `refus`. */
const refusee = (s: SessionDuCompendium, refus: RefusDuCompendium): SessionDuCompendium => ({ ...s, refus });

/** Les désignations de l'entrée d'origine de l'atelier `a`, dites en une ligne ; `undefined` si rien ne la désigne. */
function designee(s: SessionDuCompendium, a: AtelierDuCompendium): string | undefined {
  const par = a.idDOrigine === null ? [] : designations(a.categorie, a.idDOrigine, s.paquets);
  return par.length ? par.join(' ; ') : undefined;
}

/** La session `s` où le geste de consultation `g` est joué : refusé tant qu'un atelier est ouvert. */
function consulter(s: SessionDuCompendium, g: Extract<GesteDuCompendium, { geste: 'famille' | 'categorie' | 'recherche' | 'facette' | 'montrer' | 'suivre' }>): SessionDuCompendium {
  if (s.atelier) return refusee(s, tr('ecran.compendium.refus.atelierOuvert'));
  switch (g.geste) {
    case 'famille':
      return CODEX_GROUPS.includes(g.famille) ? { ...s, famille: g.famille, categorie: null, facettes: {}, montree: null } : refusee(s, tr('ecran.compendium.refus.familleInconnue', { famille: g.famille }));
    case 'categorie': {
      const c = categoryByKey(g.categorie);
      return c ? { ...s, famille: c.group, categorie: c.key, facettes: {}, montree: null } : refusee(s, tr('ecran.compendium.refus.categorieInconnue', { categorie: g.categorie }));
    }
    case 'recherche':
      return { ...s, recherche: g.terme };
    case 'facette': {
      const c = s.categorie === null ? undefined : categoryByKey(s.categorie);
      if (!c?.facets?.some((f) => f.key === g.cle)) return refusee(s, tr('ecran.compendium.refus.facetteInconnue', { cle: g.cle }));
      const cochees = s.facettes[g.cle] ?? [];
      return { ...s, facettes: { ...s.facettes, [g.cle]: cochees.includes(g.valeur) ? cochees.filter((v) => v !== g.valeur) : [...cochees, g.valeur] } };
    }
    case 'montrer':
      if (s.categorie === null) return refusee(s, tr('ecran.compendium.refus.sansCategorie'));
      return codexLookupById(s.categorie, g.id) ? { ...s, montree: { id: g.id, ...(g.instance === undefined ? {} : { instance: g.instance }) } } : refusee(s, tr('ecran.compendium.refus.entreeInconnue', { id: g.id, categorie: s.categorie }));
    case 'suivre': {
      const c = categoryByKey(g.categorie);
      const item = c && codexLookupById(c.key, g.id);
      if (!c || !item) return refusee(s, tr('ecran.compendium.refus.entreeInconnue', { id: g.id, categorie: g.categorie }));
      const facettes = s.categorie === c.key ? s.facettes : {};
      const passe = filterItems([item], s.recherche, c.facets ?? [], facettes).length > 0;
      const montree = { id: g.id, ...(g.instance === undefined ? {} : { instance: g.instance }) };
      return { ...s, famille: c.group, categorie: c.key, recherche: passe ? s.recherche : '', facettes: passe ? facettes : {}, montree };
    }
  }
}

/** L'atelier ouvert sur la catégorie de `s` par le geste `g` : l'entrée montrée, ou une entrée neuve, valeur neuve du
 *  nœud du premier cas de ses entrées (`noeudsDesEntrees`, `valeurNeuveDe`) ; refusé hors d'une catégorie éditable, ou
 *  d'une entrée montrée à modifier. */
function ouvrir(s: SessionDuCompendium, g: { geste: 'modifier' | 'creer' }): SessionDuCompendium {
  if (s.atelier) return refusee(s, tr('ecran.compendium.refus.atelierOuvert'));
  const categorie = s.categorie;
  if (categorie === null) return refusee(s, tr('ecran.compendium.refus.sansCategorie'));
  if (!isEditableCategory(categorie)) return refusee(s, tr('ecran.compendium.refus.lectureSeule', { categorie }));
  const ds = editableDataset(categorie);
  const atelier = (entree: Entree, index: number, idDOrigine: string | null): SessionDuCompendium =>
    ({ ...s, atelier: { categorie, index, idDOrigine, entree: structuredClone(entree), enTete: [], enCours: null } });
  if (g.geste === 'creer') return ds ? atelier(valeurNeuveDe(noeudsDesEntrees(ds)[0]) as Entree, -1, null) : refusee(s, tr('ecran.compendium.refus.creerConfiguration'));
  if (!ds) return atelier(datasetObject(editableObjectDataset(categorie)!.ds) as unknown as Entree, -1, null);
  const id = s.montree?.id;
  const index = id === undefined ? -1 : entreesDuDataset(ds).findIndex((e) => e.id === id);
  return index < 0 ? refusee(s, tr('ecran.compendium.refus.sansEntree')) : atelier(entreesDuDataset(ds)[index], index, id!);
}

/** La session `s` où le geste d'atelier `g` est joué sur l'atelier `a` ; refusé pendant une transaction demandée. */
function travailler(s: SessionDuCompendium, a: AtelierDuCompendium, g: Extract<GesteDuCompendium, { geste: 'valeur' | 'monter' | 'resceller' | 'identifier' | 'enTete' | 'enregistrer' | 'supprimer' }>): SessionDuCompendium {
  if (a.enCours) return refusee(s, tr('ecran.compendium.refus.enCours'));
  const avec = (atelier: Partial<AtelierDuCompendium>): SessionDuCompendium => ({ ...s, atelier: { ...a, ...atelier } });
  const ds = editableDataset(a.categorie);
  switch (g.geste) {
    case 'valeur':
    case 'monter':
    case 'resceller': {
      const forme = formeDeLAtelier(a);
      const choix = () => choixDeLAtelier(a, forme.noeud, s.source);
      const ecrite = g.geste === 'valeur' ? ecritureAuFormulaire(forme, a.entree, g.chemin, g.valeur, choix(), s.source)
        : g.geste === 'monter' ? monteeAuFormulaire(forme, a.entree, g.chemin, choix(), s.source)
        : rescellementAuFormulaire(forme, a.entree, g.chemin, s.source);
      return ecrite.ok ? avec({ entree: ecrite.valeur }) : refusee(s, { chemin: g.chemin, refus: ecrite.refus });
    }
    case 'identifier': {
      if (!ds) return refusee(s, tr('ecran.compendium.refus.sansIdentite'));
      const id = g.id.trim();
      if (!id) return refusee(s, tr('ecran.compendium.refus.idVide'));
      if (entreesDuDataset(ds).some((e, i) => i !== a.index && e.id === id)) return refusee(s, tr('ecran.compendium.refus.idPris', { id }));
      const par = id === a.idDOrigine ? undefined : designee(s, a);
      return par ? refusee(s, tr('ecran.compendium.refus.idDesigne', { id: a.idDOrigine!, designations: par })) : avec({ entree: { ...a.entree, id } });
    }
    case 'enTete': {
      const ancetre = ds && ancetreDuDe(ds);
      if (!ds || ancetre === undefined) return refusee(s, tr('ecran.compendium.refus.sansDe'));
      const imprime = champDEnTete(ds, ancetre, 'die') as DiceSpec;
      return avec({ enTete: g.valeur.n === imprime.n && g.valeur.sides === imprime.sides ? [] : [{ ancetre, champ: 'die', valeur: g.valeur }] });
    }
    case 'enregistrer': {
      const erreurs = ds ? validateEntry(a.categorie, a.entree, entreesDuDataset(ds), a.index) : [];
      return erreurs.length ? refusee(s, tr('ecran.compendium.refus.invalide', { erreurs: erreurs.join(' ; ') })) : avec({ enCours: 'enregistrer' });
    }
    case 'supprimer': {
      if (!ds) return refusee(s, tr('ecran.compendium.refus.supprimerConfiguration'));
      if (a.idDOrigine === null) return refusee(s, tr('ecran.compendium.refus.supprimerCreation'));
      const par = designee(s, a);
      return par ? refusee(s, tr('ecran.compendium.refus.designee', { designations: par })) : avec({ enCours: 'supprimer' });
    }
  }
}

/** La session `s` où l'issue `g` de la transaction demandée est reçue : réussie, l'atelier se ferme sur l'entrée
 *  enregistrée, montrée (rien après une suppression) ; échouée, l'atelier reste ouvert, son refus dit. */
function recevoir(s: SessionDuCompendium, g: Extract<GesteDuCompendium, { geste: 'enregistrement' }>): SessionDuCompendium {
  const a = s.atelier;
  if (!a?.enCours) return refusee(s, tr('ecran.compendium.refus.aucuneTransaction'));
  if (!g.reussi) return { ...s, atelier: { ...a, enCours: null }, refus: g.refus ?? tr('ecran.compendium.refus.echec') };
  const id = a.entree.id;
  const montree = a.enCours === 'supprimer' ? null : typeof id === 'string' && editableDataset(a.categorie) ? { id } : s.montree;
  return { ...s, atelier: null, montree };
}

/** La session `s` après le geste `g`, sans atelier, ou l'atelier ouvert sur une catégorie éditable : jouer son geste
 *  (`consulter`, `ouvrir`, `travailler`, `recevoir`). */
function jouer(s: SessionDuCompendium, g: GesteDuCompendium): SessionDuCompendium {
  switch (g.geste) {
    case 'famille':
    case 'categorie':
    case 'recherche':
    case 'facette':
    case 'montrer':
    case 'suivre':
      return consulter(s, g);
    case 'modifier':
    case 'creer':
      return ouvrir(s, g);
    case 'abandonner':
      return s.atelier ? { ...s, atelier: null } : refusee(s, tr('ecran.compendium.refus.sansAtelier'));
    case 'enregistrement':
      return recevoir(s, g);
    case 'chapitre': {
      const source = avecLeChapitreRecu(s.source, g.book, g.ch, g.texte);
      return source === s.source ? s : { ...s, source };
    }
    default:
      return s.atelier ? travailler(s, s.atelier, g) : refusee(s, tr('ecran.compendium.refus.sansAtelier'));
  }
}

/** La session `s`, le chapitre qu'elle attend demandé (`avecLeChapitreDemande`) parmi les adresses de prose du
 *  brouillon de son atelier (`adressesDe`), sous un champ qu'il offre (`cheminOffert`) ; `s` elle-même sans atelier. */
function avecSonChapitreDemande(s: SessionDuCompendium): SessionDuCompendium {
  const a = s.atelier;
  if (!a) return s;
  const { noeud, champs } = formeDeLAtelier(a);
  const adresses = adressesDe(noeud, a.entree).filter(({ chemin }) => cheminOffert(champs, chemin)).map(({ adresse }) => adresse);
  const source = avecLeChapitreDemande(s.source, adresses);
  return source === s.source ? s : { ...s, source };
}

/** La session après le geste `g` (`jouer`), son refus levé ou posé, le chapitre qu'elle attend demandé
 *  (`avecSonChapitreDemande`). */
export function compendium(s: SessionDuCompendium, g: GesteDuCompendium): SessionDuCompendium {
  return avecSonChapitreDemande(jouer({ ...s, refus: null }, g));
}
