/**
 * Tenue d'un porteur de dé par un siège, lue sur `s.net` (#1426).
 */
import type { Jeu, NetState } from './etat';
import type { Intention } from './partie';
import type { Combatant } from '../engine/types';
import { PARTY_MAX, inBattleId, porteurParId } from './monde/combatants';
import { WORLD_STEP_OWNER } from './pendings';
import { t } from '../i18n';

/**
 * Le réseau après la FERMETURE définitive d'un siège : ses héros et ses emplacements reviennent à l'hôte
 * (siège 0), chaque héros à son rang (`net.rangs`), et s'il portait le rôle MJ, le rôle tombe — `gmSeat` ne désigne jamais un siège absent,
 * sans quoi `pilotedByHuman` rendrait les ennemis à personne. Tout hôte coop l'applique au départ d'un siège.
 */
export function fermerLeSiege(net: NetState, seat: number): NetState {
  const seatNames = { ...net.seatNames };
  delete seatNames[seat];
  const presence = { ...net.presence };
  delete presence[seat];
  const ownership = Object.fromEntries(Object.entries(net.ownership).map(([h, s]) => [h, s === seat ? 0 : s]));
  return { ...net, seatNames, presence, ownership, slots: net.slots.map((s) => (s === seat ? 0 : s)), gmSeat: net.gmSeat === seat ? undefined : net.gmSeat };
}

/** Le nom d'un siège de coop : celui que le joueur a donné, sinon « Hôte » (siège 0) ou « Joueur n » (#1906) —
 *  SOURCE UNIQUE, jamais « L'hôte » pour un invité. */
export function nomDuSiege(net: Pick<NetState, 'seatNames'>, seat: number): string {
  return net.seatNames[seat] ?? (seat === 0 ? t('party.seat.host') : t('party.seat.player', { n: seat + 1 }));
}

/** Un siège de la table tel qu'il se montre : son nom, s'il est le siège local, s'il se reconnecte. */
export interface SiegeDeLaTable {
  seat: number;
  nom: string;
  moi: boolean;
  absent: boolean;
}

/** Les sièges de la table, dans l'ordre de leur numéro : les sièges nommés, et l'hôte (siège 0) TOUJOURS, nommé ou
 *  non (en solo, `seatNames` est vide, `initialNet`). Seuls ces sièges reçoivent un héros, un emplacement ou le rôle MJ. */
export function siegesDeLaTable(net: Pick<NetState, 'seatNames' | 'mySeat' | 'presence'>): SiegeDeLaTable[] {
  const seats = [...new Set([0, ...Object.keys(net.seatNames).map(Number)])].sort((a, b) => a - b);
  return seats.map((seat) => ({ seat, nom: nomDuSiege(net, seat), moi: seat === net.mySeat, absent: net.presence[seat] === 'absent' }));
}

/** Le siège attribué à ce héros (`net.ownership`), l'hôte (siège 0) s'il n'en a aucun. */
export function siegeDuHeros(net: Pick<NetState, 'ownership'>, heroId: string): number {
  return net.ownership[heroId] ?? 0;
}

/** Un EMPLACEMENT de l'écran d'équipe : son rang (0 à `PARTY_MAX` − 1), le siège qui le remplit (`net.slots`), le héros
 *  qui l'occupe et le siège de ce héros (`siegeDuHeros`), qui peut différer de celui de l'emplacement après une
 *  réattribution. */
export interface Emplacement {
  rang: number;
  siege: number;
  heroId: string | null;
  proprietaire: number | null;
}

/** Ce que lisent les emplacements : le groupe, et le réseau qui porte les rangs, les sièges des emplacements et des héros. */
export interface GroupeAssis {
  net: Pick<NetState, 'rangs' | 'slots' | 'ownership'>;
  party: readonly Pick<Combatant, 'id'>[];
}

/** Les `PARTY_MAX` emplacements du groupe, en solo comme en coop : chaque héros à son rang (`net.rangs`), un héros
 *  sans rang valide ou au rang déjà pris aux rangs vides, dans l'ordre de `party`. Un rang libéré reste vide. */
export function emplacementsDuGroupe(s: GroupeAssis): Emplacement[] {
  const occupants: (string | null)[] = Array.from({ length: PARTY_MAX }, () => null);
  const sansRang: string[] = [];
  for (const h of s.party) {
    const rang = s.net.rangs[h.id];
    if (rang !== undefined && rang >= 0 && rang < PARTY_MAX && occupants[rang] === null) occupants[rang] = h.id;
    else sansRang.push(h.id);
  }
  for (const id of sansRang) {
    const vide = occupants.indexOf(null);
    if (vide >= 0) occupants[vide] = id;
  }
  return occupants.map((heroId, rang) => ({
    rang,
    siege: s.net.slots[rang] ?? 0,
    heroId,
    proprietaire: heroId === null ? null : siegeDuHeros(s.net, heroId),
  }));
}

/** Le rang de chaque héros du groupe, tel que `emplacementsDuGroupe` le projette : ce qu'écrit tout geste de composition. */
export function rangsDuGroupe(s: GroupeAssis): Record<string, number> {
  return Object.fromEntries(emplacementsDuGroupe(s).flatMap((e) => (e.heroId === null ? [] : [[e.heroId, e.rang]])));
}

/** Le rang que reçoit un héros ajouté par `seat` : le premier emplacement vide de ce siège, sinon le premier vide ;
 *  `null` si le groupe est complet. */
export function rangDAjout(s: GroupeAssis, seat: number): number | null {
  const vides = emplacementsDuGroupe(s).filter((e) => e.heroId === null);
  return (vides.find((e) => e.siege === seat) ?? vides[0])?.rang ?? null;
}

/** Le refus de `siege` comme destinataire d'une attribution : un siège absent de la table (`siegesDeLaTable`). */
function refusDuSiegeInconnu(net: NetState, siege: number): string | null {
  return siegesDeLaTable(net).some((x) => x.seat === siege) ? null : t('coop.assign.seatUnknown');
}

/** Le refus d'attribuer le héros `heroId` au siège `siege` : un héros hors du groupe, un siège hors de la table ;
 *  `null` s'il s'attribue. */
export function refusDAttribuerLeHeros(net: NetState, party: GroupeAssis['party'], heroId: string, siege: number): string | null {
  if (!party.some((h) => h.id === heroId)) return t('coop.assign.heroAbsent');
  return refusDuSiegeInconnu(net, siege);
}

/** Le refus de poser le rôle MJ au siège `siege` (`null` : l'IA, toujours permise) : un siège hors de la table. */
export function refusDuSiegeMJ(net: NetState, siege: number | null): string | null {
  return siege === null ? null : refusDuSiegeInconnu(net, siege);
}

/** Le refus d'attribuer l'emplacement `rang` au siège `siege` : un rang hors des emplacements, un emplacement occupé
 *  (`emplacementsDuGroupe`), un siège hors de la table ; `null` s'il s'attribue. */
export function refusDAttribuerLEmplacement(net: NetState, party: GroupeAssis['party'], rang: number, siege: number): string | null {
  if (!Number.isInteger(rang) || rang < 0 || rang >= net.slots.length) return t('coop.assign.slotUnknown');
  if (emplacementsDuGroupe({ net, party })[rang]?.heroId) return t('coop.assign.slotTaken');
  return refusDuSiegeInconnu(net, siege);
}

/** Le réseau après l'attribution du héros `heroId` au siège `seat` (lobby) : décidée par l'hôte seul, refusée par
 *  `refusDAttribuerLeHeros`, sinon `net` inchangé. */
export function attribuerLeHeros(net: NetState, party: GroupeAssis['party'], heroId: string, seat: number): NetState {
  if (net.mode !== 'hote' || refusDAttribuerLeHeros(net, party, heroId, seat)) return net;
  return { ...net, ownership: { ...net.ownership, [heroId]: seat } };
}

/** Le réseau après la pose du RÔLE MJ au siège `seat` (`null` : IA) — UNIQUE, le désigner le retire à tout
 *  autre siège. Décidé par l'hôte, ou en solo pour le siège unique, refusé par `refusDuSiegeMJ` ; chez un invité,
 *  `net` inchangé. */
export function poserLeSiegeMJ(net: NetState, seat: number | null): NetState {
  if (net.mode === 'invite' || refusDuSiegeMJ(net, seat)) return net;
  return { ...net, gmSeat: seat ?? undefined };
}

/** Le réseau après l'attribution de l'EMPLACEMENT `slot` de l'écran d'équipe au siège `seat`, que son
 *  joueur remplira : décidée par l'hôte seul, refusée par `refusDAttribuerLEmplacement`, sinon `net` inchangé. */
export function attribuerLEmplacement(net: NetState, party: GroupeAssis['party'], slot: number, seat: number): NetState {
  if (net.mode !== 'hote' || refusDAttribuerLEmplacement(net, party, slot, seat)) return net;
  const slots = [...net.slots];
  slots[slot] = seat;
  return { ...net, slots };
}

/** Un siège de la table, ou l'IA (`siege: null`, rôle MJ seul), tel qu'une offre le propose : son nom, s'il tient
 *  déjà la chose offerte, et l'intention qui la lui attribue. */
export interface ChoixDeSiege {
  siege: number | null;
  nom: string;
  tenu: boolean;
  intention: Intention;
}

/** Ce qui s'attribue à un siège : un héros du groupe, un emplacement vide, le rôle MJ ; un choix par siège de la table
 *  (`siegesDeLaTable`), et l'IA pour le rôle MJ. */
export interface SiegeOffert {
  id: `heros/${string}` | `emplacement/${number}` | 'mj';
  nom: string;
  choix: ChoixDeSiege[];
}

/** Chaque attribution de siège que l'hôte d'une session peut jouer (#3009) : chaque héros du groupe, chaque emplacement
 *  vide (`emplacementsDuGroupe`), puis le rôle MJ ; aucune hors du mode `hote`. */
export function siegesOfferts(s: Pick<Jeu, 'net' | 'party'>): SiegeOffert[] {
  if (s.net.mode !== 'hote') return [];
  const table = siegesDeLaTable(s.net);
  const parSiege = (tient: (seat: number) => boolean, intention: (seat: number) => Intention): ChoixDeSiege[] =>
    table.map(({ seat, nom }) => ({ siege: seat, nom, tenu: tient(seat), intention: intention(seat) }));
  return [
    ...s.party.map((h): SiegeOffert => ({
      id: `heros/${h.id}`,
      nom: h.label,
      choix: parSiege((seat) => siegeDuHeros(s.net, h.id) === seat, (seat) => ({ type: 'affecterLeHerosAuSiege', args: [h.id, seat] })),
    })),
    ...emplacementsDuGroupe(s).flatMap((e): SiegeOffert[] => (e.heroId !== null ? [] : [{
      id: `emplacement/${e.rang}`,
      nom: t('party.slot.adventurer', { n: e.rang + 1 }),
      choix: parSiege((seat) => e.siege === seat, (seat) => ({ type: 'affecterLEmplacementAuSiege', args: [e.rang, seat] })),
    }])),
    {
      id: 'mj',
      nom: t('ecran.salon.mj'),
      choix: [
        { siege: null, nom: t('ecran.salon.ia'), tenu: s.net.gmSeat === undefined, intention: { type: 'affecterLeSiegeMJ', args: [null] } },
        ...parSiege((seat) => s.net.gmSeat === seat, (seat) => ({ type: 'affecterLeSiegeMJ', args: [seat] })),
      ],
    },
  ];
}

/**
 * LE SIÈGE DU MONDE — celui qui tient l'environnement (météo, périls, marché, désertion) : le siège
 * MJ quand il existe (bac-à-sable), l'hôte (siège 0) sinon. Il existe TOUJOURS, et il est humain :
 * c'est ce qui rend un jet de monde surfaçable au même titre que celui d'un héros (`rollSeam.surfaceOf`).
 */
export function worldSeat(s: Pick<Jeu, 'net'>): number {
  return s.net.gmSeat ?? 0;
}

/**
 * LE PORTEUR EST-IL CONDUIT PAR LE SIÈGE DU MONDE ? (#1479) — les deux routes que `seatOwns`
 * distingue depuis toujours, NOMMÉES : un porteur de l'ENVIRONNEMENT (sentinelle `WORLD_STEP_OWNER` :
 * désertion, Moral, météo) et un ennemi du bac-à-sable MJ reviennent au `worldSeat` ; tout autre
 * porteur est ATTRIBUÉ à un siège par `net.ownership` (réservé aux héros).
 *
 * Un seul site pour cette route : `seatOwns` la consomme pour dire QUI possède, `rollSeam` pour dire
 * qui VOIT (un héros dont le siège est aussi le siège MJ — hôte-MJ solo — reste tenu par SON joueur,
 * il n'est pas « conduit par le monde »).
 */
export function conduitParLeSiegeDuMonde(s: Pick<Jeu, 'battle' | 'net'>, combatantId: string | undefined): boolean {
  if (combatantId === WORLD_STEP_OWNER) return true;
  if (!combatantId) return false;
  const c = inBattleId(s.battle, combatantId);
  return !!c && c.kind === 'ennemi' && s.net.gmSeat != null;
}

/** Le siège qui possède ce combattant (héros non attribué → hôte, siège 0). */
export function siegeDe(s: Pick<Jeu, 'battle' | 'net'>, combatantId: string | undefined): number {
  if (conduitParLeSiegeDuMonde(s, combatantId)) return worldSeat(s);
  if (!combatantId) return 0;
  return siegeDuHeros(s.net, combatantId);
}

/** Le siège possède-t-il ce combattant ? */
export function seatOwns(s: Pick<Jeu, 'battle' | 'net'>, seat: number, combatantId: string | undefined): boolean {
  return siegeDe(s, combatantId) === seat;
}

/**
 * Le JET de ce combattant doit-il être SURFACÉ (fenêtre influençable) plutôt que roulé en silence ?
 * INVARIANT : un jet se surface dès qu'un siège humain QUELCONQUE possède son porteur — le pilote de
 * l'ADVERSAIRE n'entre pas dans la condition ; un porteur surfacé n'est JAMAIS roulé en silence.
 * SEAT-AGNOSTIQUE (≠ `pilotedByHuman`, qui décide de l'AFFORDANCE LOCALE) : le héros d'un AUTRE siège
 * surface aussi — c'est SON joueur qui roulera. Les gardes RAW restent au site appelant (Défense :
 * portée de mêlée, `rangedDefenseModes` — un tir sans mode de défense RAW reste NON OPPOSÉ, LDB 13
 * l.125 ; Contre-sort : éligibilité `counterspellCandidates`, LDB 46 l.156).
 * SOURCE UNIQUE du surfaçage RÉACTIF : Défense (#989) et Contre-sort (#1028).
 */
export function jetSurfaced(s: Jeu, c: Combatant): boolean {
  if (c.kind === 'heros') return !c.aiControlled;
  if (c.kind === 'ennemi') return s.net.gmSeat != null;
  return false;
}

/**
 * UN SIÈGE HUMAIN TIENT-IL CE PORTEUR ? (#1426) — LE prédicat de possession HUMAINE, keyé par ID, pour
 * TOUT porteur de dé : héros (en combat COMME hors combat), ennemi, et le MONDE (`WORLD_STEP_OWNER`).
 * C'est `jetSurfaced` ci-dessus, atteint par id plutôt que par objet ; le surfaçage d'un jet
 * (`rollSeam.surfaceOf`) n'y ajoute que la cadence.
 *
 * « TENU PAR UN HUMAIN » N'EST PAS « POSSÉDÉ » : `seatOwns(s, 0, ennemi)` rend vrai par REPLI quand
 * aucun siège MJ n'existe — ce repli sert l'ACTION (l'hôte exécute pour l'automate qui conduit cet
 * ennemi), pas la TENUE du dé. Un ennemi sans siège MJ, un héros `aiControlled`, un porteur inconnu
 * ne tiennent donc aucune fenêtre : leur étape se résout d'office et se montre au bilan.
 * Le MONDE fait exception par construction : `worldSeat` existe TOUJOURS et est humain — la
 * résolution de ce siège reste ici (`seatOwns` route déjà la sentinelle vers lui), jamais recopiée
 * chez un appelant.
 */
export function tenuParUnHumain(s: Jeu, porteurId: string | undefined): boolean {
  if (!porteurId) return false;
  if (porteurId === WORLD_STEP_OWNER) return seatOwns(s, worldSeat(s), porteurId);
  const c = porteurParId(s, porteurId);
  return !!c && jetSurfaced(s, c);
}
