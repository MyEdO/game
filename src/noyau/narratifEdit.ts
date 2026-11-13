/**
 * ÉCRITURES du narratif qui lisent le PROJET édité (#3059) : renommer une entrée ou une sous-entrée
 * (stade d'un indice, valeur d'un état, repère de son identité) en propageant à toute référence du projet
 * (`renommeRef`), la retirer tant qu'aucune référence ne la désigne (`referencesA`), et changer la forme d'un état. Chaque écrivain refuse ce que le schéma
 * du narratif refuse (`raffineNarratif`) et rend alors le projet inchangé. PURES : tout hôte les joue,
 * l'éditeur web compris. Les écritures qui ne lisent que le narratif : `ecritures-du-narratif.ts`.
 */
import type { Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { LIBELLE_NARRATIF } from './codex/libellesNarratifs';
import { t } from '../i18n';
import { collisionneAvecLeGlobal, type NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { REGISTRES_NARRATIFS } from '../data/schemas/defs-scenes/registres-narratifs';
import { FORMES_D_ETAT, valeursDeclarees, type FormeDEtatKind } from '../data/schemas/defs-scenes/formes-d-etat';
import { lieuDuSite, referencesA, renommeRef, type CibleNarrative, type LieuDeSite } from '../data/schemas/defs-scenes/refs-narratives';
import { recoupementsSans, recoupementsVers, repereRenomme, repereRetire, type Identite } from '../data/schemas/defs-scenes/ecritures-du-narratif';
import { sexeSchema, type RaceKey, type Sexe } from '../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import type { EtatNarratif } from '../data/schemas/defs-scenes/narratif';

/** Le projet ÉDITÉ, tel qu'un éditeur le détient : ses scènes (dans l'ordre du document), sa carte du
 *  monde, son narratif. */
export interface ProjetEdite {
  scenes: Scene[];
  worldMap: WorldMap | null;
  narratif: NarratifBlock;
}

/** Ce que les écrivains lisent d'un projet : celui de l'éditeur web (`ProjetEdite`) comme celui de la session du noyau,
 *  dont la carte du monde peut manquer. */
type ProjetDesEcrivains = Pick<ProjetEdite, 'scenes' | 'narratif'> & { worldMap?: WorldMap | null };

/** L'identité que porte l'état `etat`, s'il en porte une (forme `heros`). */
const identiteDe = (etat: EtatNarratif): Identite | undefined => ('identite' in etat.forme ? etat.forme.identite : undefined);

/** La famille d'une sous-entrée : le stade d'un indice, la valeur déclarée d'un état, le repère de son identité. */
type FamilleDeSousEntree = 'stade' | 'valeur' | 'repere';

/** Les sous-entrées que `cible` (sans `sous`) déclare, et leur famille : les stades d'un indice ; d'un état, ses valeurs
 *  si sa forme en déclare, sinon les repères de son identité ; `undefined` si l'entrée n'existe pas ou n'en déclare pas. */
function sousEntrees(narratif: NarratifBlock, cible: CibleNarrative): { famille: FamilleDeSousEntree; elements: readonly { id: string }[] } | undefined {
  if (cible.registre === 'indices') {
    const indice = narratif.indices.find((i) => i.id === cible.id);
    return indice && { famille: 'stade', elements: indice.stades };
  }
  if (cible.registre !== 'etats') return undefined;
  const etat = narratif.etats.find((e) => e.id === cible.id);
  if (!etat) return undefined;
  if (FORMES_D_ETAT[etat.forme.kind].valeursDeclarees) return { famille: 'valeur', elements: valeursDeclarees(etat) };
  const identite = identiteDe(etat);
  return identite && { famille: 'repere', elements: identite.reperes };
}

/** Ce qui porte déjà l'id `candidat`, hors `cible` elle-même, nommé pour l'auteur ; `null` s'il est
 *  libre. Une entrée : toute entrée d'un registre (unicité inter-registres), puis la règle globale ; une
 *  sous-entrée : une autre sous-entrée de la même entrée. */
export function porteurDeLId(narratif: NarratifBlock, cible: CibleNarrative, candidat: string): string | null {
  if (cible.sous !== undefined) {
    const soeurs = sousEntrees(narratif, { registre: cible.registre, id: cible.id });
    const j = soeurs ? soeurs.elements.findIndex((s) => s.id !== cible.sous && s.id === candidat) : -1;
    return j >= 0 ? t(`narratifEdit.porteur.${soeurs!.famille}`, { n: j + 1 }) : null;
  }
  for (const r of REGISTRES_NARRATIFS) {
    const e = (narratif[r.cle] as readonly { id: string }[]).find((x) => x.id === candidat && !(r.cle === cible.registre && x.id === cible.id));
    if (e) return t('narratifEdit.porteur.entree', { nom: r.nom, libelle: (LIBELLE_NARRATIF[r.cle] as (x: { id: string }) => string)(e) });
  }
  return collisionneAvecLeGlobal(candidat) ? t('narratifEdit.porteur.regleGlobale') : null;
}

/** Le refus de renommer l'id `actuel` en `candidat` (déjà rogné) : vide, ou déjà porté (`porteurDe`) ;
 *  `null` s'il est retenu ou inchangé. */
export function refusDId(actuel: string, candidat: string, porteurDe: (candidat: string) => string | null): string | null {
  if (candidat === actuel) return null;
  if (candidat === '') return t('narratifEdit.idVide');
  const porteur = porteurDe(candidat);
  return porteur && t('narratifEdit.idPorte', { candidat, porteur });
}

/** Le refus de renommer `cible` en `candidat` (`refusDId`, `porteurDeLId`). */
export const refusDeRenommage = (narratif: NarratifBlock, cible: CibleNarrative, candidat: string): string | null =>
  refusDId(cible.sous ?? cible.id, candidat.trim(), (c) => porteurDeLId(narratif, cible, c));

/** Le narratif où l'entrée (ou la sous-entrée) `cible` porte l'id `nouveau`. */
function renommeDansLeNarratif(n: NarratifBlock, cible: CibleNarrative, nouveau: string): NarratifBlock {
  const { registre, id, sous } = cible;
  if (sous === undefined) {
    const renomme = { ...n, [registre]: (n[registre] as readonly { id: string }[]).map((e) => (e.id === id ? { ...e, id: nouveau } : e)) };
    return registre === 'indices' ? recoupementsVers(renomme, id, nouveau) : renomme;
  }
  if (registre === 'indices')
    return { ...n, indices: n.indices.map((i) => (i.id === id ? { ...i, stades: i.stades.map((s) => (s.id === sous ? { ...s, id: nouveau } : s)) } : i)) };
  return { ...n, etats: n.etats.map((x) => (x.id === id ? sousEntreesEcrites(x, (vs) => vs.map((v) => (v.id === sous ? { ...v, id: nouveau } : v)), (i) => repereRenomme(i, sous, nouveau)) : x)) };
}

/** L'état `etat` dont les sous-entrées sont réécrites : ses valeurs déclarées par `valeurs`, ou, sans elles, son
 *  identité par `identite` ; tel quel s'il n'en porte pas. */
function sousEntreesEcrites(etat: EtatNarratif, valeurs: (vs: readonly { id: string; label: string }[]) => { id: string; label: string }[], identite: (i: Identite) => Identite): EtatNarratif {
  if (FORMES_D_ETAT[etat.forme.kind].valeursDeclarees) return { ...etat, forme: { ...etat.forme, valeurs: valeurs(valeursDeclarees(etat)) } as EtatNarratif['forme'] };
  const avant = identiteDe(etat);
  return avant ? { ...etat, forme: { ...etat.forme, identite: identite(avant) } as EtatNarratif['forme'] } : etat;
}

/** Renomme `cible` en `nouveau` (rogné) et propage à toute référence du projet (`renommeRef`), les
 *  recoupements d'indices compris. Refusé (projet inchangé) : `refusDeRenommage`. */
export function renommeAuProjet<P extends ProjetDesEcrivains>(projet: P, cible: CibleNarrative, nouveau: string): P {
  const next = nouveau.trim();
  if (next === (cible.sous ?? cible.id) || refusDeRenommage(projet.narratif, cible, next)) return projet;
  const p = renommeRef(projet, cible, next);
  return { ...p, narratif: renommeDansLeNarratif(p.narratif, cible, next) };
}

/** Un lieu de site, lisible par l'auteur : « scène « Le relais » », « carte du monde », « indice « L'affiche » ». */
const lieuLisible = (l: LieuDeSite): string => (l.racine === 'carte' ? t('narratifEdit.lieu.carte') : t(l.racine === 'scene' ? 'narratifEdit.lieu.scene' : 'narratifEdit.lieu.indice', { nom: l.nom }));

/** Une ligne d'identité, lisible par l'auteur : « Humain homme ». */
export const libelleDeLigne = (l: { espece: RaceKey; sexe: Sexe }): string => `${t(`espece.individu.${l.espece}`)} ${libelleDeValeur(sexeSchema, l.sexe).toLowerCase()}`;

/** Les lignes de l'identité de l'état `cible` où une valeur du repère `cible.sous` est saisie, lisibles ; aucune hors
 *  d'un repère. */
function saisiesDuRepere(narratif: NarratifBlock, cible: CibleNarrative): string[] {
  const etat = cible.registre === 'etats' ? narratif.etats.find((e) => e.id === cible.id) : undefined;
  const identite = etat && !FORMES_D_ETAT[etat.forme.kind].valeursDeclarees ? identiteDe(etat) : undefined;
  return (identite?.lignes ?? []).filter((l) => l.valeurs.some((v) => v.repere === cible.sous && v.valeur.trim())).map(libelleDeLigne);
}

/** La raison qui refuse de retirer `cible` : la dernière sous-entrée de son entrée, ou les lieux DISTINCTS
 *  qui la désignent encore ; `undefined` : le retrait est permis. */
export function refusDeRetrait(projet: ProjetDesEcrivains, cible: CibleNarrative): string | undefined {
  const soeurs = cible.sous === undefined ? undefined : sousEntrees(projet.narratif, { registre: cible.registre, id: cible.id });
  if (soeurs && soeurs.elements.length <= 1) return t(`narratifEdit.minimum.${soeurs.famille}`);
  const saisies = saisiesDuRepere(projet.narratif, cible);
  if (saisies.length) return t('narratifEdit.repere.saisi', { lignes: saisies.join(', ') });
  const sites = referencesA(projet, cible);
  const lieux = [...new Set(sites.map((s) => lieuLisible(lieuDuSite(projet, s))))].join(', ');
  return sites.length ? t('narratifEdit.encoreDesigne', { lieux }) : undefined;
}

/** Retire `cible` du narratif ; un indice retiré l'est aussi des recoupements. Refusé (projet inchangé) :
 *  `refusDeRetrait`. */
export function retireDuProjet<P extends ProjetDesEcrivains>(projet: P, cible: CibleNarrative): P {
  if (refusDeRetrait(projet, cible)) return projet;
  const n = projet.narratif;
  const { registre, id, sous } = cible;
  let narratif: NarratifBlock;
  if (sous === undefined) {
    const sans = { ...n, [registre]: (n[registre] as readonly { id: string }[]).filter((e) => e.id !== id) };
    narratif = registre === 'indices' ? recoupementsSans(sans, id) : sans;
  } else if (registre === 'indices') {
    narratif = { ...n, indices: n.indices.map((i) => (i.id === id ? { ...i, stades: i.stades.filter((s) => s.id !== sous) } : i)) };
  } else {
    narratif = { ...n, etats: n.etats.map((x) => (x.id === id ? sousEntreesEcrites(x, (vs) => vs.filter((v) => v.id !== sous), (i) => repereRetire(i, sous)) : x)) };
  }
  return { ...projet, narratif };
}

/** La forme NEUVE d'un état de forme `kind` : une forme à valeurs déclarées en porte une, que l'auteur renomme. */
export function formeNeuve(kind: FormeDEtatKind): EtatNarratif['forme'] {
  return (FORMES_D_ETAT[kind].valeursDeclarees ? { kind, valeurs: [{ id: 'valeur-1', label: t('ecran.editeur.narratif.valeurNeuve', { n: 1 }) }] } : { kind }) as EtatNarratif['forme'];
}

/** La raison qui refuse de changer la forme de l'état `id` : une référence le désigne encore, dont l'usage dépend de sa
 *  forme (`refusDeRetrait`), ou il porte une identité qu'une autre forme ne porte pas ; `undefined` : permis. */
export function refusDeForme(projet: ProjetDesEcrivains, id: string): string | undefined {
  const etat = projet.narratif.etats.find((e) => e.id === id);
  return refusDeRetrait(projet, { registre: 'etats', id }) ?? (etat && identiteDe(etat) ? t('narratifEdit.forme.identite') : undefined);
}

/** Le projet `projet` où l'état `id` prend la forme neuve `kind` (`formeNeuve`) ; tel quel si elle est la sienne, ou si
 *  le changement est refusé (`refusDeForme`). */
export function formeChangee<P extends ProjetDesEcrivains>(projet: P, id: string, kind: FormeDEtatKind): P {
  const etat = projet.narratif.etats.find((e) => e.id === id);
  if (!etat || etat.forme.kind === kind || refusDeForme(projet, id) !== undefined) return projet;
  return { ...projet, narratif: { ...projet.narratif, etats: projet.narratif.etats.map((e) => (e === etat ? { ...e, forme: formeNeuve(kind) } : e)) } };
}
