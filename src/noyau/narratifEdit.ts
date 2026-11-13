/**
 * ÉCRITURES du narratif qui lisent le PROJET édité (#3059) : renommer une entrée ou une sous-entrée
 * (stade d'un indice, valeur d'un état) en propageant à toute référence du projet (`renommeRef`), et la
 * retirer tant qu'aucune référence ne la désigne (`referencesA`). Chaque écrivain refuse ce que le schéma
 * du narratif refuse (`raffineNarratif`) et rend alors le projet inchangé. PURES : tout hôte les joue,
 * l'éditeur web compris. Les écritures qui ne lisent que le narratif : `ecritures-du-narratif.ts`.
 */
import type { Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { LIBELLE_NARRATIF } from './codex/libellesNarratifs';
import { t } from '../i18n';
import { collisionneAvecLeGlobal, type NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { REGISTRES_NARRATIFS } from '../data/schemas/defs-scenes/registres-narratifs';
import { FORMES_D_ETAT, valeursDeclarees } from '../data/schemas/defs-scenes/formes-d-etat';
import { lieuDuSite, referencesA, renommeRef, type CibleNarrative, type LieuDeSite } from '../data/schemas/defs-scenes/refs-narratives';
import { recoupementsSans, recoupementsVers } from '../data/schemas/defs-scenes/ecritures-du-narratif';

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

/** Les sous-entrées que `cible` (sans `sous`) déclare : les stades d'un indice, les valeurs d'un état ;
 *  `undefined` si l'entrée n'existe pas ou n'en déclare pas. */
function sousEntrees(narratif: NarratifBlock, cible: CibleNarrative): readonly { id: string }[] | undefined {
  if (cible.registre === 'indices') return narratif.indices.find((i) => i.id === cible.id)?.stades;
  if (cible.registre === 'etats') {
    const etat = narratif.etats.find((e) => e.id === cible.id);
    return etat && FORMES_D_ETAT[etat.forme.kind].valeursDeclarees ? valeursDeclarees(etat) : undefined;
  }
  return undefined;
}
const NOM_DE_SOUS_ENTREE = { indices: 'narratifEdit.porteur.stade', etats: 'narratifEdit.porteur.valeur' } as const;

/** Ce qui porte déjà l'id `candidat`, hors `cible` elle-même, nommé pour l'auteur ; `null` s'il est
 *  libre. Une entrée : toute entrée d'un registre (unicité inter-registres), puis la règle globale ; une
 *  sous-entrée : une autre sous-entrée de la même entrée. */
export function porteurDeLId(narratif: NarratifBlock, cible: CibleNarrative, candidat: string): string | null {
  if (cible.sous !== undefined) {
    const soeurs = sousEntrees(narratif, { registre: cible.registre, id: cible.id }) ?? [];
    const j = soeurs.findIndex((s) => s.id !== cible.sous && s.id === candidat);
    return j >= 0 ? t(NOM_DE_SOUS_ENTREE[cible.registre as keyof typeof NOM_DE_SOUS_ENTREE], { n: j + 1 }) : null;
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
  return {
    ...n,
    etats: n.etats.map((x) => (x.id === id && FORMES_D_ETAT[x.forme.kind].valeursDeclarees
      ? { ...x, forme: { ...x.forme, valeurs: valeursDeclarees(x).map((v) => (v.id === sous ? { ...v, id: nouveau } : v)) } as typeof x.forme }
      : x)),
  };
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

const MINIMUM_DE_SOUS_ENTREES = { indices: 'narratifEdit.minimum.stade', etats: 'narratifEdit.minimum.valeur' } as const;

/** La raison qui refuse de retirer `cible` : la dernière sous-entrée de son entrée, ou les lieux DISTINCTS
 *  qui la désignent encore ; `undefined` : le retrait est permis. */
export function refusDeRetrait(projet: ProjetDesEcrivains, cible: CibleNarrative): string | undefined {
  if (cible.sous !== undefined && (sousEntrees(projet.narratif, { registre: cible.registre, id: cible.id })?.length ?? 0) <= 1)
    return t(MINIMUM_DE_SOUS_ENTREES[cible.registre as keyof typeof MINIMUM_DE_SOUS_ENTREES]);
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
    narratif = {
      ...n,
      etats: n.etats.map((x) => (x.id === id && FORMES_D_ETAT[x.forme.kind].valeursDeclarees
        ? { ...x, forme: { ...x.forme, valeurs: valeursDeclarees(x).filter((v) => v.id !== sous) } as typeof x.forme }
        : x)),
    };
  }
  return { ...projet, narratif };
}
