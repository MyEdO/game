/**
 * LES OBJETS AU SOL (#3741) : un objet qu'un porteur du groupe pose devient un décor de la scène vivante, à la case du
 * groupe, et ce qu'il est (l'objet, puis le contenu de son contenant, uids et état intacts) vit dans `Jeu.objetsAuSol`,
 * par l'id de ce décor. Le ramasser le remet sur un combattant et retire le décor par le funnel des retraits
 * (`removeEntity`), qui retire l'entrée. Le décor survit au départ de la scène comme toute entité changée en jeu
 * (`SceneMutation.entitesChangees`).
 */
import type { ItemInstance } from '../engine/types';
import { itemLabel } from '../engine/items';
import { t } from '../i18n';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { SceneEntity } from './monde/scene';
import { refusDInventaire } from './verrousDeFiche';
import { refuserGeste } from './refusVisible';
import { avecLeLot, ecrireLesPorteurs, lotDeLObjet, porteurDeLObjet, porteurLocalise, resolveCarrier, sansLeLot, type Carrier } from './monde/carrier';
import { possessionLabel } from '../engine/possession';
import { aPorteeDe } from './monde/exploreNav';
import { meneurDuMonde } from './monde/combatants';
import { removeEntity } from './combatPlacement';
import { bus, EVT } from './bus';

/** Le décor qui montre un objet posé au sol : le petit sac du catalogue des décors (`props.json`), non bloquant. */
const DECOR_DE_L_OBJET_AU_SOL = 'bourse';

/** Les objets du porteur `c`. */
const objetsDe = (c: Carrier): ItemInstance[] => (c.kind === 'hero' ? (c.hero.items ?? []) : c.possession.items);

/** Le nom d'un porteur. */
const nomDe = (c: Carrier): string => (c.kind === 'hero' ? c.hero.label : possessionLabel(c.possession));

/** Pourquoi l'objet `uid` ne se pose pas au sol maintenant, `null` s'il se pose : en combat, l'inventaire se gère depuis
 *  la barre d'action (`refusDInventaire`) ; personne ne le porte ; aucune scène ; son porteur n'est pas avec le groupe ;
 *  une arme conjurée, qui ne vit que le temps de son Sort, ne quitte pas son lanceur. */
export function refusDePoser(s: Pick<Jeu, 'battle' | 'party' | 'possessions' | 'scene'>, uid: string): string | null {
  const verrou = refusDInventaire(s);
  if (verrou) return verrou;
  const porteurId = porteurDeLObjet(s, uid);
  const porteur = porteurId ? resolveCarrier(s, porteurId) : undefined;
  if (!porteur) return t('pf.objetSansPorteur');
  const objet = objetsDe(porteur).find((i) => i.uid === uid)!;
  if (!s.scene) return t('pf.poserSansScene', { item: itemLabel(objet) });
  if (porteurLocalise(porteur).location.kind !== 'avec-le-groupe') return t('pf.poserHorsDuGroupe', { from: nomDe(porteur), item: itemLabel(objet) });
  if (objet.conjured) return t('pf.poserConjure', { item: itemLabel(objet) });
  return null;
}

/** Pose au sol, à la case du groupe, l'objet `uid` et le contenu de son contenant (`lotDeLObjet`) : ils quittent leur
 *  porteur (`sansLeLot`, armes re-dérivées), un décor naît dans la scène et le lot entre dans `objetsAuSol` sous son id,
 *  l'objet déséquipé et libre. */
export function poserLObjet(get: Get, set: Set, uid: string): void {
  const refus = refusDePoser(get(), uid);
  if (refus) return void refuserGeste(get, set, refus);
  const s = get();
  const porteurId = porteurDeLObjet(s, uid)!;
  const porteur = resolveCarrier(s, porteurId)!;
  const [objet, ...contenu] = lotDeLObjet(objetsDe(porteur), uid);
  const lot: ItemInstance[] = [{ ...objet, equipped: false, inside: undefined }, ...contenu.map((i) => ({ ...i, equipped: false }))];
  const { x, y, z } = s.partyPos;
  const decor: SceneEntity = { id: get().forgerUnId('depot-au-sol'), kind: 'prop', ref: DECOR_DE_L_OBJET_AU_SOL, pos: { x, y }, ...(z ? { z } : {}) };
  set((e) => ({
    ...ecrireLesPorteurs(e, { [porteurId]: (items) => sansLeLot(items, lot) }),
    scene: { ...e.scene!, entities: [...e.scene!.entities, decor] },
    objetsAuSol: { ...e.objetsAuSol, [decor.id]: lot },
  }));
  get().ecrireAuJournal(t('pf.poser', { from: nomDe(porteur), item: itemLabel(objet) }));
  bus.emit(EVT.SCENE_DIRTY);
}

/** Ce que le décor `ent` donne à ramasser d'objet posé au sol : l'objet de son lot, par son uid ; son contenu part avec
 *  lui. Vide pour un décor sans objet au sol. */
export function objetDuSol(ent: SceneEntity, objetsAuSol: Jeu['objetsAuSol']): { key: string; label: string }[] {
  const objet = objetsAuSol[ent.id]?.[0];
  return objet ? [{ key: objet.uid, label: itemLabel(objet) }] : [];
}

/** Remet le lot du décor `entityId` au combattant `receveurId` (`avecLeLot` : une Bourse rejoint la sienne) et retire le
 *  décor (`removeEntity`, qui retire son entrée d'`objetsAuSol`). Rend le nom de l'objet. */
export function ramasserDuSol(get: Get, set: Set, entityId: string, receveurId: string): string {
  const lot = get().objetsAuSol[entityId];
  set((e) => ecrireLesPorteurs(e, { [receveurId]: (items) => avecLeLot(items, lot, true) }));
  removeEntity(get, set, entityId);
  return itemLabel(lot[0]);
}

/** Pourquoi `receveurId` (le meneur sans lui) ne ramasse pas hors combat l'objet `key` du décor `entityId`, `null` s'il le
 *  ramasse : le décor ne montre pas cet objet posé au sol (un décor authoré se fouille, `jouerAction`) ; le groupe n'est
 *  pas à sa portée (`aPorteeDe`) ; le receveur n'est pas un héros du groupe. */
export function refusDeRamasserHorsCombat(s: Pick<Jeu, 'scene' | 'objetsAuSol' | 'partyPos' | 'party'>, entityId: string, key: string, receveurId: string | undefined): string | null {
  const ent = s.scene?.entities.find((e) => e.id === entityId);
  if (!ent || s.objetsAuSol[entityId]?.[0]?.uid !== key) return t('pf.ramasserInconnu');
  if (!aPorteeDe(s.partyPos, ent)) return t('pf.ramasserHorsDePortee', { item: itemLabel(s.objetsAuSol[entityId][0]) });
  if (!s.party.some((h) => h.id === receveurId)) return t('pf.ramasserSansHeros');
  return null;
}

/** Ramasse hors combat l'objet `key` posé au sol du décor `entityId` : le héros `pid` le reçoit, le meneur sans lui. */
export function ramasserHorsCombat(get: Get, set: Set, entityId: string, key: string, pid?: string): void {
  const receveurId = pid ?? meneurDuMonde(get())?.id;
  const refus = refusDeRamasserHorsCombat(get(), entityId, key, receveurId);
  if (refus) return void refuserGeste(get, set, refus);
  const label = ramasserDuSol(get, set, entityId, receveurId!);
  get().ecrireAuJournal(t('cs.pickup', { name: get().party.find((h) => h.id === receveurId)!.label, label }));
}
