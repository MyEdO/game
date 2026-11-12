/**
 * LES OBJETS AU SOL (#3741, #3744) : un objet qu'un porteur pose, ou qu'un combattant lâche (`crochetDuSol`), devient un
 * décor de la scène vivante, à sa case, et ce qu'il est (l'objet, puis le contenu de son contenant, uids et état intacts)
 * vit dans `Jeu.objetsAuSol`, par l'id de ce décor (`deposerAuSol`, seul écrivain). Le ramasser le remet sur un combattant
 * et retire le décor par le funnel des retraits (`removeEntity`), qui retire l'entrée. Le décor survit au départ de la
 * scène comme toute entité changée en jeu (`SceneMutation.entitesChangees`) ; il s'offre à ramasser par `actionsDe`.
 */
import type { Combatant, ItemInstance } from '../engine/types';
import type { OpsCtx } from '../engine/ops';
import { itemLabel } from '../engine/items';
import { t } from '../i18n';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { SceneEntity } from './monde/scene';
import type { Pt } from './monde/path';
import { refusDInventaire } from './verrousDeFiche';
import { refuserGeste } from './refusVisible';
import { avecLeLot, ecrireLesPorteurs, lotDeLObjet, porteurDeLObjet, porteurLocalise, resolveCarrier, sansLeLot, type Carrier } from './monde/carrier';
import { possessionLabel } from '../engine/possession';
import { aPorteeDe } from './monde/exploreNav';
import { meneurDuMonde } from './monde/combatants';
import { removeEntity } from './combatPlacement';
import { etatDeLaBarre } from './actionRegistry';
import { journaliser } from './combatLog';
import { bus, EVT } from './bus';

/** Le décor qui montre un objet posé au sol : le petit sac du catalogue des décors (`props.json`), non bloquant. */
const DECOR_DE_L_OBJET_AU_SOL = 'bourse';

/** Les objets du porteur `c`. */
const objetsDe = (c: Carrier): ItemInstance[] => (c.kind === 'heros' ? (c.hero.items ?? []) : c.possession.items);

/** Le nom d'un porteur. */
const nomDe = (c: Carrier): string => (c.kind === 'heros' ? c.hero.label : possessionLabel(c.possession));

/** Pourquoi l'objet `uid` ne se pose pas au sol hors combat, `null` s'il se pose : en combat, l'inventaire de la fiche
 *  est fermé (`refusDInventaire`) ; personne ne le porte ; aucune scène ; son porteur n'est pas avec le groupe ; une arme
 *  conjurée, qui ne vit que le temps de son Sort, ne quitte pas son lanceur. */
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

/** Pourquoi l'objet `uid` ne se pose pas au sol en combat, `null` s'il se pose : la barre fermée (`etatDeLaBarre`) ; il
 *  n'est pas à l'actif ; une arme conjurée. */
function refusDePoserEnCombat(s: Jeu, uid: string): string | null {
  const barre = etatDeLaBarre(s);
  if (barre.forme !== 'ouverte') return barre.raison;
  const objet = (barre.active.items ?? []).find((i) => i.uid === uid);
  if (!objet) return t('cs.poserHorsDuTour', { name: barre.active.label });
  if (objet.conjured) return t('pf.poserConjure', { item: itemLabel(objet) });
  return null;
}

/** Fait naître à la case `pos` le décor qui montre le lot `lot` (son objet en tête, nommé par lui) et l'y range dans
 *  `objetsAuSol` : seul écrivain d'un objet au sol. */
export function deposerAuSol(get: Get, set: Set, lot: ItemInstance[], pos: Pt): void {
  const decor: SceneEntity = { id: get().forgerUnId('depot-au-sol'), kind: 'prop', decor: { id: DECOR_DE_L_OBJET_AU_SOL }, label: itemLabel(lot[0]), pos: { x: pos.x, y: pos.y }, ...(pos.z ? { z: pos.z } : {}) };
  set((e) => ({ scene: { ...e.scene!, entities: [...e.scene!.entities, decor] }, objetsAuSol: { ...e.objetsAuSol, [decor.id]: lot } }));
  bus.emit(EVT.SCENE_DIRTY);
}

/** Pose au sol l'objet `uid` et le contenu de son contenant (`lotDeLObjet`) : ils quittent leur porteur (`sansLeLot`,
 *  armes re-dérivées), l'objet déséquipé et libre, et se déposent (`deposerAuSol`). Hors combat, à la case du groupe ; en
 *  combat, à celle de l'actif qui le porte, Action gratuite (`depot` de `actions.json`). */
export function poserLObjet(get: Get, set: Set, uid: string): void {
  const s = get();
  const refus = s.battle ? refusDePoserEnCombat(s, uid) : refusDePoser(s, uid);
  if (refus) return void refuserGeste(get, set, refus);
  const barre = etatDeLaBarre(s);
  const actif = barre.forme === 'ouverte' ? barre.active : undefined;
  const porteur: Carrier = actif ? { kind: 'heros', hero: actif } : resolveCarrier(s, porteurDeLObjet(s, uid)!)!;
  const porteurId = porteur.kind === 'heros' ? porteur.hero.id : porteur.possession.uid;
  const [objet, ...contenu] = lotDeLObjet(objetsDe(porteur), uid);
  const lot: ItemInstance[] = [{ ...objet, equipped: false, inside: undefined }, ...contenu.map((i) => ({ ...i, equipped: false }))];
  set((e) => ecrireLesPorteurs(e, { [porteurId]: (items) => sansLeLot(items, lot) }));
  deposerAuSol(get, set, lot, actif?.pos ?? s.partyPos);
  journaliser(get, set, [t('pf.poser', { from: nomDe(porteur), item: itemLabel(objet) })], 'objet', { actorId: porteurId });
}

/** Le crochet d'`applyOps` qui dépose au sol, à la case du combattant, l'objet qu'il lâche (`OpsCtx.onLacher`, op
 *  `disarm`) : l'objet a déjà quitté le combattant que l'op mute en place, la copie de combat qui fait foi. */
export function crochetDuSol(get: Get, set: Set): Required<Pick<OpsCtx, 'onLacher'>> {
  return { onLacher: (porteur: Combatant, objet: ItemInstance) => deposerAuSol(get, set, [{ ...objet, equipped: false, inside: undefined }], porteur.pos!) };
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

/** Ramasse hors combat l'objet `key` posé au sol du décor `entityId` : le héros `heroId` le reçoit, le meneur sans lui. */
export function ramasserHorsCombat(get: Get, set: Set, entityId: string, key: string, heroId?: string): void {
  const receveurId = heroId ?? meneurDuMonde(get())?.id;
  const refus = refusDeRamasserHorsCombat(get(), entityId, key, receveurId);
  if (refus) return void refuserGeste(get, set, refus);
  const label = ramasserDuSol(get, set, entityId, receveurId!);
  get().ecrireAuJournal(t('cs.pickup', { name: get().party.find((h) => h.id === receveurId)!.label, label }));
}
