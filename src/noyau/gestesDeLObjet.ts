/**
 * LES GESTES D'UN OBJET (#3328) — ce qu'un porteur peut faire d'un de ses objets depuis sa fiche, chaque geste écrit en
 * verbe du noyau, et ce qui le ferme maintenant : le porter (`equiperLObjet`), le tenir dans une main du set actif
 * (`garnirLaPanoplie`), le ranger dans un contenant ou l'en sortir (`rangerLObjet`), le donner à un porteur à ses côtés
 * (`transmettreLObjet`), le poser au sol (`poserLObjet`), l'utiliser (`utiliserLObjet`), l'évaluer ou le détecter (`evaluerLObjet`). Chaque refus est le verdict
 * que le verbe applique. Lecteur PUR, lu par la fiche de personnage et par les
 * hôtes du noyau (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau, GesteFermable } from './actionsDuNoyau';
import type { ItemInstance, Main } from '../engine/types';
import { canStow, isWearable, itemLabel } from '../engine/items';
import { possessionLabel } from '../engine/possession';
import { isConsumable } from '../engine/consumables';
import { carriersColocated } from '../engine/cargo';
import { resolveCarrier, porteurLocalise, type Carrier } from './monde/carrier';
import { refusDInventaire } from './verrousDeFiche';
import { refusEmplacementDeMain } from './partyFlow';
import { refusDeConsommer } from './consumableFlow';
import { gameDay, refusDEvaluation } from './merchantFlow';
import { refusDePoser } from './objetsAuSol';
import { nomDe } from '../engine/nom';

/** Une main du set actif : si elle tient l'objet (son geste la vide alors). */
export interface MainDuSet extends GesteFermable { tenue: boolean }

/** Un geste à choix : pourquoi il ne se joue pas maintenant, et chacun de ses choix, son nom (`libelle`) et le verbe
 *  qui le joue. */
export interface GesteAChoix<T> { refus: string | null; choix: { cible: T; libelle: string; geste: GesteDuNoyau }[] }

/** Les gestes d'un objet, chacun `null` quand il n'a pas d'objet pour lui. */
export interface GestesDeLObjet {
  /** Un objet porté sur le corps (`isWearable`), hors consommable : s'il est porté. */
  porter: (GesteFermable & { porte: boolean }) | null;
  /** Une arme d'un héros : chaque main du set actif (`set`, son id). */
  mains: { set: string; main: MainDuSet; secondaire: MainDuSet } | null;
  /** Un objet en vrac qui tient dans un contenant du porteur (`canStow`) : chacun de ces contenants. */
  ranger: GesteAChoix<ItemInstance> | null;
  /** Un objet rangé dans un contenant. */
  sortir: GesteFermable | null;
  /** Chacun des autres porteurs à ses côtés (`carriersColocated`) : héros du groupe, possessions intactes. */
  donner: GesteAChoix<Carrier> | null;
  /** Tout objet : le poser au sol, à la case du groupe. */
  poser: GesteFermable;
  /** Un consommable d'un héros (`isConsumable`). */
  utiliser: GesteFermable | null;
  /** Un objet non identifié d'un héros, refusé tant que court le délai de son Évaluation manquée (`refusDEvaluation`). */
  evaluer: GesteFermable | null;
  /** Un objet non identifié d'un héros, jamais détecté (LDB 10 l.336). */
  detecter: GesteFermable | null;
}

/** L'id d'un porteur et son nom. */
const porteurDit = (c: Carrier): [id: string, libelle: string] => (c.kind === 'heros' ? [c.hero.id, nomDe(c.hero)] : [c.possession.uid, possessionLabel(c.possession)]);

/** Les gestes de l'objet `uid` du porteur `porteurId` (`resolveCarrier` : un héros du groupe ou une possession),
 *  `null` sans lui ou sans l'objet. PUR. */
export function gestesDeLObjet(s: Pick<Jeu, 'battle' | 'party' | 'possessions' | 'gameTime' | 'scene'>, porteurId: string, uid: string): GestesDeLObjet | null {
  const porteur = resolveCarrier(s, porteurId);
  const items = !porteur ? [] : porteur.kind === 'heros' ? (porteur.hero.items ?? []) : porteur.possession.items;
  const it = items.find((i) => i.uid === uid);
  if (!porteur || !it) return null;
  const verrou = refusDInventaire(s);
  const sur = (verbe: GesteDuNoyau['verbe'], args: unknown[], refus: string | null = null): GesteFermable => ({ geste: { verbe, args }, refus: verrou ?? refus });
  const hero = porteur.kind === 'heros' ? porteur.hero : null;
  const consommable = isConsumable(it);
  const contenants = it.container || it.inside ? [] : items.filter((i) => i.container && canStow({ items }, it, i.uid));
  const ici = porteurLocalise(porteur);
  const porteurs: Carrier[] = [
    ...s.party.filter((h) => h.id !== porteurId).map((h): Carrier => ({ kind: 'heros', hero: h })),
    ...s.possessions.filter((p) => p.uid !== porteurId && !p.destroyed).map((p): Carrier => ({ kind: 'possession', possession: p })),
  ].filter((c) => carriersColocated(ici, porteurLocalise(c)));
  const set = hero && (it.kind === 'melee' || it.kind === 'distance') ? ((hero.loadouts ?? []).find((l) => l.id === hero.activeLoadoutId) ?? hero.loadouts?.[0]) : undefined;
  const main = (slot: Main): MainDuSet => {
    const tenue = set![slot] === uid;
    const vise = tenue ? null : uid;
    return { tenue, geste: { verbe: 'garnirLaPanoplie', args: [porteurId, set!.id, slot, vise] }, refus: refusEmplacementDeMain(s, hero!, set!.id, slot, vise) };
  };
  const inconnu = hero && it.identified === false;
  return {
    porter: isWearable(it) && !consommable ? { ...sur('equiperLObjet', [uid]), porte: it.equipped } : null,
    mains: set ? { set: set.id, main: main('main'), secondaire: main('secondaire') } : null,
    ranger: contenants.length ? { refus: verrou, choix: contenants.map((c) => ({ cible: c, libelle: itemLabel(c), geste: { verbe: 'rangerLObjet', args: [uid, c.uid] } })) } : null,
    sortir: it.inside ? sur('rangerLObjet', [uid, null]) : null,
    donner: porteurs.length ? { refus: verrou, choix: porteurs.map((c) => {
      const [id, libelle] = porteurDit(c);
      return { cible: c, libelle, geste: { verbe: 'transmettreLObjet', args: [uid, id] } };
    }) } : null,
    poser: { geste: { verbe: 'poserLObjet', args: [uid] }, refus: refusDePoser(s, uid) },
    utiliser: hero && consommable ? sur('utiliserLObjet', [uid], refusDeConsommer(hero, it)) : null,
    evaluer: inconnu ? sur('evaluerLObjet', [uid], refusDEvaluation(s.party, it, 'evaluation', gameDay(s))) : null,
    detecter: inconnu ? sur('evaluerLObjet', [uid, 'detection'], refusDEvaluation(s.party, it, 'detection', gameDay(s))) : null,
  };
}
