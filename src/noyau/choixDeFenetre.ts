/**
 * LE CHOIX D'UNE FENÊTRE (#3369) : un seul verbe, `fenetreChoisir(fenetre, axe, valeur, pid?)`, la fenêtre en argument, le
 * héros en dernier pour un choix de rangée. Chaque
 * choix se déclare à `ChoixDesFenetres` et `CHOIX_DES_FENETRES` (`choixDesFenetres.ts`) ; les valeurs que l'état lui
 * ouvre vivent dans la table totale `OUVERTS_DU_CHOIX`, que lisent le refus du verbe (`refusDuChoix`) et les hôtes du
 * noyau (`reglagesDesChoix`) ; son corps vit dans la table totale `CorpsDesChoix`, assemblée par `fabriquesDuNoyau.ts`.
 */
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import { nomEnVue } from './visionDuGroupe';
import { fateSaveOptions } from '../engine/fortune';
import { isHealable } from '../engine/healing';
import { findMoraleFactor, payChoices } from '../engine/crewMorale';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import { DESIGNATIONS } from './designations';
import { libelleDeLaFermeture, libelleDuChoix, libelleDuLitteral, libelleDuParametre } from './libelles';
import { fenetreDuRegistre, soinEnCours, type GesteDuJeu } from './modalArbiter';
import { plaiesNommees } from './medicFlow';
import { conversationRepond, reponsesDuNoeud } from './dialogue';
import { refuserGesteDuSiege } from './refusVisible';
import type { Reglage, ValeurDuReglage } from './reglages';
import { refusDeChoixDePaie } from './shipCrew';
import { corruptionTarget } from './corruptionFlow';
import { activityById, cleDEntrainement, craftCatalog, entrainementOptions, learnableTalents, qualitesDArtisanat, type ActivityDef, type ActivityResolver } from '../engine/activities';
import { describeQuality } from '../engine/qualities/describe';
import { libelleDePsy } from '../engine/psych/ciblage';
import { formatMoney, fromBrass } from '../engine/money';
import { interludeCatalog } from './interludeFlow';
import {
  brouillonDe, ciblesDActivite, refusDeLaComposition, refusDeLaValeur, type CompositionDActivite,
} from './verdictsDInterlude';
import { plafondDeMiseDOpportunite, plafondDePlanque, seaActivitiesCatalog, seaActivityBlocked, seaActivityRefus } from './seaActivities';
import { decidingSeat } from './netOwnership';
import { seatOwns } from './sieges';
import type { IdDeHeros, IdDeRangee } from './designations';
import { herosDeLaSeance, type AxeDuGroupe, type AxeDuHerosDeLaSeance } from './partyFlow';
import {
  BAISSES_DE_PRIX_MAX, MODES_DE_MARCHE, barterRefusal, catalogEntryOf, contexteDAchat, demandeDuTroc, devisDeTroc, devisDeVente, devisDuPanier, exemplaireCede, libelleDeLaRepartition, objetsAReparer,
  optionsDeTroc, refusDAjout, refusDeMarchandage, refusDeRecherche, refusDeRefusDuMarche, sellRefusal, type MerchantState, type ModeDeMarche,
} from './merchantFlow';
import { findTrappingById } from '../data/index';
import { dormeurDuRepos, foodOptions, lodgingOptions, nourrituresDeTroupe } from './restFlow';
import { itemLabel } from '../engine/items';
import { BATTLE_HAZARDS } from '../engine/massBattle';
import { battleSceneById, herosQuiSePostent, postesDeBataille, refusDAlea, refusDeMelee, refusDeRassemblement, refusDeSceneDeBataille } from './massBattleFlow';
import { formatDice } from '../engine/dice';
import { massBattleHazardsDie } from '../data';
import { actFirstIds } from './turnEconomy';
import { preemptShooterIds } from './targeting';
import type { Combatant, ItemInstance } from '../engine/types';
import type { LootGear } from './pendings';
import { creaturesDeLaRecolte, refusDeDepecer } from './combatEffects';
import { FORMULES_DES_MARCHES, devisDeLAchat, type FenetreDuMarche } from './cargaison';
import { bulkCarriers } from './carriers';
import { carrierFreeEnc, findCargoById } from '../engine/cargo';
import { entreesDuLieu, refusDEntrerAuPoint } from './lieuFlow';
import {
  VERBE_DE_CHOIX, declarationDuChoixNomme, estAxeDe, estFenetreAChoix, type AxeDe, type AxeDuChoix, type CorpsDesChoix, type FenetreAChoix, type OuvertsDuChoix,
} from './choixDesFenetres';

/** Le réglage de l'axe `axe` de la fenêtre `fenetre`, sur le héros `pid` d'un choix de rangée : ses valeurs `valeurs`,
 *  chacune avec la raison qui la ferme, et sa valeur `courant`. */
const reglage = <F extends FenetreAChoix>(fenetre: F, axe: AxeDe<F>, valeurs: (s: Jeu, pid: IdDeHeros | undefined) => readonly ValeurDuReglage[], courant: (s: Jeu, pid: IdDeHeros | undefined) => ValeurDuReglage['valeur'] = () => null) => (s: Jeu, pid: IdDeHeros | undefined): Reglage => ({
  geste: { verbe: VERBE_DE_CHOIX, fenetre, axe: axe as AxeDuChoix },
  libelle: libelleDuChoix(fenetre, axe),
  courant: courant(s, pid),
  valeurs: [...valeurs(s, pid)],
  bornes: null,
  note: null,
});

/** Le réglage de l'axe numérique `axe` de la fenêtre `fenetre`, sur le héros `pid` d'un choix de rangée : de 0 à la borne
 *  `max` (`null` : l'axe n'est pas ouvert), et sa valeur `courant` ; hors de toute rangée, la forme de l'axe le dit. */
const quantite = <F extends FenetreAChoix>(fenetre: F, axe: AxeDe<F>, max: (s: Jeu, pid: IdDeHeros) => number | null, courant: (s: Jeu, pid: IdDeHeros) => number) => (s: Jeu, pid: IdDeHeros | undefined): Reglage => {
  const base = { geste: { verbe: VERBE_DE_CHOIX, fenetre, axe: axe as AxeDuChoix }, libelle: libelleDuChoix(fenetre, axe), note: null };
  if (pid === undefined) return { ...base, courant: null, valeurs: null, bornes: null };
  const borne = max(s, pid);
  return borne === null
    ? { ...base, courant: null, valeurs: [], bornes: null }
    : { ...base, courant: courant(s, pid), valeurs: null, bornes: { min: 0, max: borne, pas: 1 } };
};

/** Le paramètre du verbe qui désigne le héros d'un choix de rangée. */
const PARAMETRE_DE_RANGEE = 'pid';

/** Une valeur ouverte, nommée `libelle`, que ferme `refus` (`null` : ouverte). */
const ouverte = (valeur: ValeurDuReglage['valeur'], libelle: string, refus: string | null = null): ValeurDuReglage => ({ valeur, libelle, refus });
/** Oui, puis non, tant que `ouvert` (sur le héros `pid` d'un choix de rangée) ; chacune fermée par la raison de `refus`. */
const ouiNon = (ouvert: (s: Jeu, pid: IdDeHeros | undefined) => boolean, refus: (s: Jeu, v: boolean) => string | null = () => null) => (s: Jeu, pid: IdDeHeros | undefined): ValeurDuReglage[] =>
  (ouvert(s, pid) ? [true, false].map((v) => ouverte(v, garanti(libelleDuLitteral(v), String(v), 'libellé du booléen'), refus(s, v))) : []);

/** Le héros `pid` de la semaine en mer : un héros du groupe qui tient encore une Activité (MDG 15 l.268). */
const herosDeLaSemaine = (s: Jeu, pid: IdDeHeros) => (s.pendingSeaActivities ? s.party.find((h) => h.id === pid && !h.dead && !h.outOfRencontre) : undefined);
/** Le choix du héros `pid` pour la semaine en mer, et l'Activité qu'il a choisie. */
const choixDuHeros = (s: Jeu, pid: IdDeHeros | undefined) => (pid === undefined ? undefined : s.pendingSeaActivities?.picks[pid] ?? undefined);
const activiteChoisie = (s: Jeu, pid: IdDeHeros) => {
  const id = choixDuHeros(s, pid)?.activityId;
  return id === undefined ? undefined : activityById(id);
};

/** La fin de séance ouverte, sur le héros `pid` d'une case de héros (hors de toute rangée : tout héros). */
const seanceOuverte = (s: Jeu, pid: IdDeHeros | undefined): boolean => !!s.finDeSeance && (pid === undefined || herosDeLaSeance(s).some((h) => h.id === pid));
/** La case `axe` du groupe de la fin de séance. */
const caseDuGroupe = (axe: AxeDuGroupe) => reglage('finDeSeance', axe, ouiNon(seanceOuverte), (s) => s.finDeSeance?.groupe[axe] ?? false);
/** La case `axe` du héros `pid` de la fin de séance. */
const caseDuHeros = (axe: AxeDuHerosDeLaSeance) => reglage('finDeSeance', axe, ouiNon(seanceOuverte), (s, pid) => (pid === undefined ? null : s.finDeSeance?.heros[pid]?.[axe] ?? false));

/** L'article `id` du stock du marchand, nommé par son catalogue. */
const article = (id: string): ValeurDuReglage => ouverte(id, garanti(catalogEntryOf(id), id, 'article du marchand').label);
/** La seule valeur d'un geste qui vide (`axe`) tant que `plein` : `true`. */
const vider = (axe: 'viderLePanier' | 'viderLaVente', plein: (m: MerchantState) => boolean) => reglage('marchand', axe, (s) => (s.merchant && plein(s.merchant) ? [ouverte(true, libelleDuChoix('marchand', axe))] : []));
/** Chaque objet du groupe que `retenu` garde, l'échoppe ouverte, fermé par la raison de `refus`. */
const objetsALEchoppe = (axe: AxeDe<'marchand'>, retenu: (it: ItemInstance, m: MerchantState) => boolean, refus: (it: ItemInstance) => string | null = () => null) =>
  reglage('marchand', axe, (s) => {
    const m = s.merchant;
    return m ? s.party.flatMap((h) => (h.items ?? []).filter((it) => retenu(it, m)).map((it) => ouverte(it.uid, itemLabel(it), refus(it)))) : [];
  });
/** Les valeurs du choix `axe` de l'échoppe ouverte `m` (`valeurs`), et sa valeur courante. */
const aLEchoppe = (axe: AxeDe<'marchand'>, valeurs: (s: Jeu, m: MerchantState) => readonly ValeurDuReglage[], courant?: (s: Jeu) => ValeurDuReglage['valeur']) =>
  reglage('marchand', axe, (s) => (s.merchant ? valeurs(s, s.merchant) : []), courant);
/** Le côté `mode` d'un marché, fermé par `refus`. */
const duMarche = (mode: ModeDeMarche, refus: string | null): ValeurDuReglage => ouverte(mode, garanti(libelleDuLitteral(mode), mode, 'côté du marché'), refus);
const baissesDe = (m: MerchantState, it: ItemInstance): number => m.sellHalvings?.[it.uid] ?? 0;
const enVente = (m: MerchantState, it: ItemInstance): boolean => (m.sellCart ?? []).some((c) => c.uid === it.uid);
/** Le héros `pid` d'une rangée, hors de toute rangée tout héros : un héros du groupe. */
const duGroupe = (s: Jeu, pid: IdDeHeros | undefined): boolean => pid === undefined || s.party.some((h) => h.id === pid);
/** Chaque ligne du butin `lignes`, au héros `pid` du groupe. */
const lignesDuButin = (fenetre: 'butin' | 'victoire', lignes: (s: Jeu) => readonly LootGear[] | undefined) =>
  reglage(fenetre, 'ligne', (s, pid) => (duGroupe(s, pid) ? (lignes(s) ?? []).map((g) => ouverte(g.uid, g.label)) : []));
/** La nuit à régler, au dormeur `pid` (hors de toute rangée, la troupe). */
const nuitDuDormeur = (s: Jeu, pid: IdDeHeros | undefined) => {
  const p = s.pendingRest;
  return p?.phase === 'setup' && (pid === undefined || dormeurDuRepos(s, pid)) ? { p, dormeur: dormeurDuRepos(s, pid) } : null;
};
/** Une valeur du repos, nommée par son axe (`couchage`, `pitance`). */
const duRepos = (v: string, axe: 'couchage' | 'pitance'): ValeurDuReglage => ouverte(v, garanti(libelleDuLitteral(v, axe), v, 'valeur du repos'));

/** Le nom du porteur `id` tel que le groupe le connaît (`nomEnVue`, #4017). */
const nomDuPorteur = (s: Jeu, id: string): string => garanti(nomEnVue(s, id), id, 'porteur du réglage');

/** Le combattant `id` de la bataille, nommé. */
const combattant = (s: Jeu, id: string): ValeurDuReglage => ouverte(id, nomDuPorteur(s, id));

/** Ce qu'une valeur coûte, dit avec elle : une valeur de liste ne se montre que par son libellé. */
export const auPrix = (label: string, prix: string): string => t('interlude.prix', { label, prix });

/** Les Activités que compose un héros de l'interlude : celles du catalogue de ce lieu (`interludeCatalog`), hors de la
 *  préparation de bataille (`menerLActionDeBataille`) et du Mécénat, une Opération bancaire. LDB 23 l.5 */
export const activitesComposables = (s: Jeu): ActivityDef[] => interludeCatalog(s).filter((d) => !d.contexts.includes('bataille') && d.resolver !== 'mecenat');

/** Le héros `pid` de l'interlude ouvert, l'Activité qu'il compose et sa composition, quand ce que lit `lue` (le
 *  résolveur de l'Activité, et l'Artisanat en cours) la retient. */
const composee = (s: Jeu, pid: IdDeHeros | undefined, lue: (resolver: ActivityResolver | undefined, h: Combatant) => boolean) => {
  const c = pid === undefined ? undefined : s.interlude?.perHero[pid]?.composition;
  const h = c && s.party.find((x) => x.id === pid);
  const def = c && activityById(c.activite);
  return h && c && def && lue(def.resolver, h) ? { h, c, def } : null;
};
/** Une Activité du catalogue, hors de ce que l'Artisanat, l'Apprentissage et l'Entraînement composent à part. */
const duCatalogue = (r: ActivityResolver | undefined): boolean => r !== 'craftExtended' && r !== 'learnTalent' && r !== 'entrainement';
/** L'ouvrage d'Artisanat à engager, le héros n'en ayant pas en cours. LDB 23 l.76 */
const aEngager = (r: ActivityResolver | undefined, h: Combatant): boolean => r === 'craftExtended' && !h.craft;
/** Le choix de la cible `cle` de l'Activité composée du catalogue : chacune de `liste`, fermée par son refus (`refusDeLaValeur`). */
const cibleDuCatalogue = <T>(axe: 'objet' | 'sort' | 'traitPsychologique', cle: keyof CompositionDActivite['cibles'], liste: (h: Combatant, def: ActivityDef) => readonly T[], valeur: (x: T) => string, libelle: (x: T) => string) =>
  reglage('interlude', axe, (s, pid) => {
    const lu = composee(s, pid, duCatalogue);
    return lu ? liste(lu.h, lu.def).map((x) => ouverte(valeur(x), libelle(x), refusDeLaValeur(s, lu.h.id, lu.c, axe, valeur(x)))) : [];
  }, (s, pid) => composee(s, pid, duCatalogue)?.c.cibles[cle] ?? null);
/** Un Atout ou un Défaut d'Artisanat, nommé. */
const qualite = (id: string): ValeurDuReglage => ouverte(id, garanti(describeQuality({ id }), id, 'qualité d’artisanat').label);
/** Les qualités que vise l'ouvrage composé (`retenue`), parmi les Atouts puis les Défauts. LDB 23 l.95 */
const qualitesDeLOuvrage = (axe: 'ajouterLaQualite' | 'retirerLaQualite', retenue: (c: CompositionDActivite, q: string) => boolean) =>
  reglage('interlude', axe, (s, pid) => {
    const lu = composee(s, pid, aEngager);
    const { atouts, defauts } = qualitesDArtisanat();
    return lu ? [...atouts, ...defauts].filter((q) => retenue(lu.c, q)).map(qualite) : [];
  });
const visee = (c: CompositionDActivite, q: string): boolean => c.atouts.includes(q) || c.defauts.includes(q);
/** Les choix du marché de cargaison `fenetre` ouvert : chaque offre, et sur l'achat en composition (`cargaison.ts`) chaque
 *  porteur du groupe fermé par la raison du marché, l'Enc borné par le devis, la conclusion fermée par sa raison ; chaque
 *  lot des porteurs du groupe, sa vente et son bradage fermés par la raison du marché. */
const choixDuMarche = (fenetre: FenetreDuMarche) => {
  const f = FORMULES_DES_MARCHES[fenetre];
  const ouvert = (s: Jeu): boolean => garanti(fenetreDuRegistre(fenetre), fenetre, 'fenêtre de marché').ouverte(s);
  const brouillon = (s: Jeu) => (ouvert(s) ? f.brouillon(s) : undefined);
  const lots = (s: Jeu, refus: (porteur: string, cargoId: string) => string | null): ValeurDuReglage[] => (ouvert(s)
    ? bulkCarriers(s).flatMap((c) => c.cargo.map((l) => ouverte(l.uid, t('valeur.lot', { lot: findCargoById(l.cargoId)?.label ?? l.cargoId, enc: l.enc, porteur: c.label }), refus(c.id, l.cargoId))))
    : []);
  return {
    offre: reglage(fenetre, 'offre', (s) => (ouvert(s) ? f.offres(s).map((o) => ouverte(o.cargoId, o.label)) : []), (s) => brouillon(s)?.offre ?? null),
    porteur: reglage(fenetre, 'porteur', (s) => {
      const achat = brouillon(s);
      return achat ? bulkCarriers(s).map((c) => ouverte(c.id, t('valeur.porteur', { nom: c.label, libre: carrierFreeEnc(c), capacite: c.capacity }), f.refusDuPorteur(s, c.id))) : [];
    }, (s) => brouillon(s)?.porteur ?? null),
    // De 1 à la borne du devis.
    encombrement: (s: Jeu): Reglage => {
      const base = { geste: { verbe: VERBE_DE_CHOIX, fenetre, axe: 'encombrement' as const }, libelle: libelleDuChoix(fenetre, 'encombrement'), note: null };
      const achat = brouillon(s);
      const max = achat ? f.devis(s, achat.porteur, achat.offre).max : 0;
      return achat && max >= 1
        ? { ...base, courant: achat.enc, valeurs: null, bornes: { min: 1, max, pas: 1 } }
        : { ...base, courant: null, valeurs: [], bornes: null };
    },
    acheter: reglage(fenetre, 'acheter', (s) => {
      const achat = brouillon(s);
      return achat ? [ouverte(true, libelleDuChoix(fenetre, 'acheter'), devisDeLAchat(s, f, achat).refus)] : [];
    }),
    vendre: reglage(fenetre, 'vendre', (s) => lots(s, (porteur) => f.refusDuPorteur(s, porteur))),
    jeter: reglage(fenetre, 'jeter', (s) => lots(s, (porteur, cargoId) => f.refusDuPorteur(s, porteur) ?? f.refusDeBradage(s, cargoId))),
  };
};

/** La bataille de masse est-elle à un Round ? */
const enRoundDeBataille = (s: Jeu): boolean => s.massBattle?.phase === 'round';
/** Chaque poste de la bataille (`postesDeBataille`) que `retenu` garde pour le héros `pid` qui se poste
 *  (`herosQuiSePostent`), lu sur les PJ qui y sont postés ; hors de toute rangée, ce qu'il garde pour l'un d'eux. */
const postesDuHeros = (s: Jeu, pid: IdDeHeros | undefined, retenu: (postes: readonly string[], heroId: string) => boolean): ValeurDuReglage[] => {
  const mb = s.massBattle;
  if (!mb) return [];
  const heros = herosQuiSePostent(mb, s.party).map((h) => h.id).filter((id) => pid === undefined || id === pid);
  return postesDeBataille(mb).filter((def) => heros.some((h) => retenu(mb.assignment[def.id] ?? [], h))).map((def) => ouverte(def.id, def.label));
};

/** L'issue du Sauvetage par le Destin, dans l'ordre de la fenêtre : celles que sa source offre (`fateSaveOptions`), puis
 *  la mort acceptée. LDB 17 l.29-32 */
const ISSUES_DU_DESTIN = ['eviter', 'survivre', 'accepter'] as const;

/** Les valeurs ouvertes de chaque choix, table TOTALE sur `ChoixDesFenetres`. */
export const OUVERTS_DU_CHOIX = {
  destin: {
    issue: reglage('destin', 'issue', (s) => {
      const p = s.pendingFateSave;
      const offertes = p ? fateSaveOptions(p.source) : [];
      return p ? ISSUES_DU_DESTIN.filter((v) => v === 'accepter' || offertes.includes(v)).map((v) => ouverte(v, t(`valeur.issue.${v}`))) : [];
    }),
  },
  // LDB 17 l.67
  renier: { renier: reglage('renier', 'renier', ouiNon((s) => !!s.pendingRenounce, (s, renier) => (renier && (corruptionTarget(s, s.pendingRenounce?.heroId)?.resilience ?? 0) <= 0 ? libelleDeLaFermeture('sansResilience') : null))) },
  cibleDeMonture: {
    cible: reglage('cibleDeMonture', 'cible', (s) => {
      const nom = DESIGNATIONS.IdDuCoupleMonte.nom(s);
      return DESIGNATIONS.IdDuCoupleMonte.lire(s).map((id) => ouverte(id, garanti(nom(id), id, 'couple monté')));
    }),
  },
  conseil: {
    paie: reglage('conseil', 'paie', (s) => (s.pendingCouncil?.phase === 'choix'
      ? payChoices().map(({ factorId }) => ouverte(factorId, garanti(findMoraleFactor(factorId), factorId, 'choix de paie').label, refusDeChoixDePaie(s, factorId)))
      : [])),
  },
  relacheATerre: { accorder: reglage('relacheATerre', 'accorder', ouiNon((s) => !!s.pendingShoreLeave)) },
  infirmerie: {
    patient: reglage('infirmerie', 'patient', (s) => {
      const verrou = soinEnCours(s) ? libelleDeLaFermeture('soinEnCours') : null;
      return s.party.map((h) => ouverte(h.id, nomDuPorteur(s, h.id), verrou ?? (isHealable(h) ? null : t('medic.patientSansSoin'))));
    }, (s) => s.medic?.patientId ?? null),
    abandon: reglage('infirmerie', 'abandon', (s) => (s.medic?.surgery || s.pendingSurgery ? [ouverte(true, libelleDuChoix('infirmerie', 'abandon'))] : [])),
    plaie: reglage('infirmerie', 'plaie', (s) => plaiesNommees(s).map((p) => ouverte(p.uid, p.libelle)), (s) => s.medic?.surgery?.traumaUid ?? s.pendingHeal?.plaie ?? null),
  },
  dialogue: { reponse: reglage('dialogue', 'reponse', (s) => reponsesDuNoeud(s).map((r) => ouverte(r.id, r.label, r.refus ?? (conversationRepond(s) ? null : t('barre.mainTenue'))))) },
  // EDO 02 l.91 : seuls les héros vivants se désignent.
  designationHeros: {
    heros: reglage('designationHeros', 'heros', (s) => (s.pendingDesignationHeros ? s.party.filter((h) => !h.dead).map((h) => ouverte(h.id, nomDuPorteur(s, h.id))) : [])),
  },
  // MDG 15 l.268 : une Activité par héros, ou aucune ; fermée pour tous (`seaActivityBlocked`), ou pour ce héros seul
  // (`seaActivityRefus`, LDB 09 l.30). Hors de toute rangée, chaque Activité avec ce qui la ferme pour tous.
  activitesEnMer: {
    activite: reglage('activitesEnMer', 'activite', (s, pid) => {
      const hero = pid === undefined ? undefined : herosDeLaSemaine(s, pid);
      if (!s.pendingSeaActivities || (pid !== undefined && !hero)) return [];
      return [ouverte(null, t('valeur.activite.repos')), ...seaActivitiesCatalog().map((def) => ouverte(def.id, def.label, seaActivityBlocked(s, def) ?? (hero && seaActivityRefus(hero, def)) ?? null))];
    }, (s, pid) => choixDuHeros(s, pid)?.activityId ?? null),
    investir: quantite('activitesEnMer', 'investir', (s, pid) => (herosDeLaSemaine(s, pid) && activiteChoisie(s, pid)?.resolver === 'opportunityTrade' ? plafondDeMiseDOpportunite(s, pid) : null), (s, pid) => choixDuHeros(s, pid)?.investGold ?? 0),
    cacher: quantite('activitesEnMer', 'cacher', (s, pid) => {
      const hero = herosDeLaSemaine(s, pid);
      return hero && activiteChoisie(s, pid)?.resolver === 'seaChart' ? plafondDePlanque(s, hero) : null;
    }, (s, pid) => choixDuHeros(s, pid)?.stashGold ?? 0),
  },
  // LDB 59 l.43-60
  marchand: {
    ajouterAuPanier: reglage('marchand', 'ajouterAuPanier', (s) => {
      const m = s.merchant;
      return m ? m.stock.map((l) => ({ ...article(l.id), refus: refusDAjout(m, l.id, contexteDAchat(s, m)) })) : [];
    }),
    oterDuPanier: reglage('marchand', 'oterDuPanier', (s) => (s.merchant?.cart ?? []).map((c) => article(c.id))),
    retirerDuPanier: reglage('marchand', 'retirerDuPanier', (s) => (s.merchant?.cart ?? []).map((c) => article(c.id))),
    viderLePanier: vider('viderLePanier', (m) => m.cart.length > 0),
    ajouterALaVente: objetsALEchoppe('ajouterALaVente', (it, m) => !enVente(m, it), (it) => {
      const raison = sellRefusal(it);
      return raison === null ? null : t('trade.sellRefused', { reason: raison });
    }),
    retirerDeLaVente: objetsALEchoppe('retirerDeLaVente', (it, m) => enVente(m, it)),
    viderLaVente: vider('viderLaVente', (m) => !!m.sellCart?.length),
    baisserLePrix: objetsALEchoppe('baisserLePrix', (it, m) => sellRefusal(it) === null && baissesDe(m, it) < BAISSES_DE_PRIX_MAX),
    releverLePrix: objetsALEchoppe('releverLePrix', (it, m) => baissesDe(m, it) > 0),
    repartition: reglage('marchand', 'repartition', (s, pid) => (duGroupe(s, pid) ? (s.merchant?.pendingDistribution ?? []).map((d) => ouverte(d.uid, libelleDeLaRepartition(d))) : [])),
    payer: aLEchoppe('payer', (s, m) => [ouverte(true, libelleDuChoix('marchand', 'payer'), devisDuPanier(m, contexteDAchat(s, m)).refus)]),
    vendre: aLEchoppe('vendre', (s, m) => [ouverte(true, libelleDuChoix('marchand', 'vendre'), devisDeVente(m, s.party).refus)]),
    refuser: aLEchoppe('refuser', (_s, m) => MODES_DE_MARCHE.map((mode) => duMarche(mode, refusDeRefusDuMarche(m, mode)))),
    marchander: aLEchoppe('marchander', (s, m) => MODES_DE_MARCHE.map((mode) => duMarche(mode, refusDeMarchandage(s, m, mode)))),
    chercher: aLEchoppe('chercher', (s, m) => [ouverte(true, libelleDuChoix('marchand', 'chercher'), refusDeRecherche(s, m))]),
    reparer: aLEchoppe('reparer', (s) => objetsAReparer(s.party).map((o) => ouverte(o.item.uid, `${o.item.label} · ${nomDuPorteur(s, o.hero.id)}`, o.refus))),
    // LDB 59 l.64-76
    trocCeder: aLEchoppe('trocCeder', (s) => optionsDeTroc(s.party).map((o) => {
      const hero = garanti(s.party.find((h) => h.id === o.heroId), o.heroId, 'héros cédant');
      return ouverte(exemplaireCede(hero, o.trappingId), `${garanti(findTrappingById(o.trappingId), o.trappingId, 'bien cédé').label} ×${o.count} (${nomDuPorteur(s, hero.id)})`, o.refus);
    }), (s) => {
      const cede = s.merchant?.troc?.cede;
      const hero = cede && s.party.find((h) => h.id === cede.heroId);
      return hero && cede ? exemplaireCede(hero, cede.trappingId) : null;
    }),
    trocRecevoir: aLEchoppe('trocRecevoir', (_s, m) => m.stock.filter((l) => l.qty > 0).map((l) => {
      const refus = barterRefusal(l.id);
      return { ...article(l.id), refus: refus && t('trade.barterRefused', { reason: refus }) };
    }), (s) => s.merchant?.troc?.recu ?? null),
    // Les exemplaires acquis : de 1 au stock de l'article choisi.
    trocQuantite: (s): Reglage => {
      const base = { geste: { verbe: VERBE_DE_CHOIX, fenetre: 'marchand' as const, axe: 'trocQuantite' as const }, libelle: libelleDuChoix('marchand', 'trocQuantite'), note: null };
      const troc = s.merchant?.troc;
      const stock = troc?.recu ? s.merchant?.stock.find((l) => l.id === troc.recu)?.qty ?? 0 : 0;
      return troc && stock > 0
        ? { ...base, courant: troc.quantite, valeurs: null, bornes: { min: 1, max: stock, pas: 1 } }
        : { ...base, courant: null, valeurs: [], bornes: null };
    },
    troquer: aLEchoppe('troquer', (s, m) => {
      const demande = demandeDuTroc(m);
      return demande ? [ouverte(true, libelleDuChoix('marchand', 'troquer'), devisDeTroc(m, s.party, demande).refus)] : [];
    }),
  },
  butin: { ligne: lignesDuButin('butin', (s) => s.pendingLoot?.gear) },
  // ZI 13
  victoire: {
    ligne: lignesDuButin('victoire', (s) => s.pendingVictory?.gear),
    depecer: reglage('victoire', 'depecer', (s) => {
      const nom = DESIGNATIONS.IdDeCreatureADepecer.nom(s);
      return creaturesDeLaRecolte(s).map((id) => ouverte(id, garanti(nom(id), id, 'créature à dépecer'), refusDeDepecer(s, id)));
    }),
  },
  // LDB 66
  repos: {
    couchage: reglage('repos', 'couchage', (s, pid) => {
      const nuit = nuitDuDormeur(s, pid);
      return nuit ? lodgingOptions(nuit.p.places).map((v) => duRepos(v, 'couchage')) : [];
    }, (s, pid) => (pid === undefined ? null : s.pendingRest?.perHero[pid]?.lodging ?? null)),
    pitance: reglage('repos', 'pitance', (s, pid) => {
      const nuit = nuitDuDormeur(s, pid);
      return nuit ? (nuit.dormeur ? foodOptions(nuit.p.places, nuit.dormeur) : nourrituresDeTroupe(nuit.p.places)).map((v) => duRepos(v, 'pitance')) : [];
    }, (s, pid) => (pid === undefined ? null : s.pendingRest?.perHero[pid]?.food ?? null)),
  },
  // LDB 17 l.25, LDB 11 l.97-103
  debutDuRound: {
    promouvoir: reglage('debutDuRound', 'promouvoir', (s) => actFirstIds(s).map((id) => combattant(s, id))),
    viser: reglage('debutDuRound', 'viser', (s) => {
      const tireurs = preemptShooterIds(() => s);
      return tireurs.length || s.preemptAiming ? [ouverte(null, t('valeur.viser.aucun')), ...tireurs.map((id) => combattant(s, id))] : [];
    }, (s) => s.preemptAiming),
  },
  // LDB 23 l.5 : chaque héros compose son Activité, puis la pratique.
  interlude: {
    activite: reglage('interlude', 'activite', (s, pid) => {
      const h = pid === undefined || !s.interlude?.perHero[pid] ? undefined : s.party.find((x) => x.id === pid && !x.dead);
      return h ? activitesComposables(s).map((def) => ouverte(def.id, def.label, refusDeLaComposition(s, h.id, brouillonDe(s.interlude?.perHero[h.id]?.composition, def.id), false))) : [];
    }, (s, pid) => (pid === undefined ? null : s.interlude?.perHero[pid]?.composition?.activite ?? null)),
    // LDB 23 l.66-72
    talent: reglage('interlude', 'talent', (s, pid) => {
      const lu = composee(s, pid, (r) => r === 'learnTalent');
      return lu ? learnableTalents(lu.h).map((o) => ouverte(o.id, auPrix(o.label, t('interlude.px', { px: o.xpCost })), refusDeLaValeur(s, lu.h.id, lu.c, 'talent', o.id))) : [];
    }, (s, pid) => composee(s, pid, (r) => r === 'learnTalent')?.c.cibles.talentId ?? null),
    // LDB 23 l.132-136
    entrainement: reglage('interlude', 'entrainement', (s, pid) => {
      const lu = composee(s, pid, (r) => r === 'entrainement');
      return lu ? entrainementOptions(lu.h).map((o) => ouverte(cleDEntrainement(o), auPrix(o.label, t('interlude.px', { px: o.xpCost })), refusDeLaValeur(s, lu.h.id, lu.c, 'entrainement', cleDEntrainement(o)))) : [];
    }, (s, pid) => composee(s, pid, (r) => r === 'entrainement')?.c.entrainement ?? null),
    // LDB 23 l.74-78
    ouvrage: reglage('interlude', 'ouvrage', (s, pid) => {
      const lu = composee(s, pid, aEngager);
      return lu ? craftCatalog().map((o) => ouverte(o.id, auPrix(o.label, formatMoney(fromBrass(o.materialsBrass))), refusDeLaValeur(s, lu.h.id, lu.c, 'ouvrage', o.id))) : [];
    }, (s, pid) => composee(s, pid, aEngager)?.c.ouvrage ?? null),
    ajouterLaQualite: qualitesDeLOuvrage('ajouterLaQualite', (c, q) => !visee(c, q)),
    retirerLaQualite: qualitesDeLOuvrage('retirerLaQualite', visee),
    objet: cibleDuCatalogue('objet', 'itemUid', (h, def) => { const { armes, artefacts } = ciblesDActivite(h, def); return [...armes, ...artefacts]; }, (i) => i.uid, (i) => i.label),
    sort: cibleDuCatalogue('sort', 'spellId', (h, def) => ciblesDActivite(h, def).sorts, (x) => x.spell.id, (x) => auPrix(x.spell.label, t('interlude.px', { px: x.cost }))),
    traitPsychologique: cibleDuCatalogue('traitPsychologique', 'traitPsy', (h, def) => ciblesDActivite(h, def).traitsPsy, (x) => x.cle, (x) => libelleDePsy(x.trait.type, x.trait.cible)),
    pratiquer: reglage('interlude', 'pratiquer', (s, pid) => {
      const lu = composee(s, pid, () => true);
      return lu ? [ouverte(true, libelleDuChoix('interlude', 'pratiquer'), refusDeLaComposition(s, lu.h.id, lu.c))] : [];
    }),
  },
  // ADE II 08 l.81, l.116-124, l.309 : la Scène et le Test spectaculaire au Round ; les postes en préparation aussi.
  batailleDeMasse: {
    scene: reglage('batailleDeMasse', 'scene', (s) => (enRoundDeBataille(s) ? s.massBattle!.situation.map((id) => ouverte(id, garanti(battleSceneById(id), id, 'Scène de bataille').label, refusDeSceneDeBataille(s, id))) : [])),
    engager: reglage('batailleDeMasse', 'engager', (s) => (enRoundDeBataille(s) ? [ouverte(true, libelleDuChoix('batailleDeMasse', 'engager'), refusDeMelee(s))] : [])),
    rallier: reglage('batailleDeMasse', 'rallier', (s) => (s.massBattle ? [ouverte(true, libelleDuChoix('batailleDeMasse', 'rallier'), refusDeRassemblement(s))] : [])),
    ajouterAuPoste: reglage('batailleDeMasse', 'ajouterAuPoste', (s, pid) => postesDuHeros(s, pid, (postes, h) => !postes.includes(h))),
    retirerDuPoste: reglage('batailleDeMasse', 'retirerDuPoste', (s, pid) => postesDuHeros(s, pid, (postes, h) => postes.includes(h))),
    alea: reglage('batailleDeMasse', 'alea', (s) => (s.massBattle
      ? [ouverte(null, t('mbf.tirerAlea', { die: formatDice(massBattleHazardsDie()) }), refusDAlea(s)), ...BATTLE_HAZARDS.map((h) => ouverte(h.id, h.label, refusDAlea(s)))]
      : [])),
  },
  // MDG 15 l.319-399, MSRC 13 l.129-160
  port: choixDuMarche('port'),
  marcheDeTerre: choixDuMarche('marcheDeTerre'),
  ecranDuLieu: { entrer: reglage('ecranDuLieu', 'entrer', (s) => entreesDuLieu(s).map((p) => ouverte(p.id, p.label, refusDEntrerAuPoint(s, p)))) },
  // LDB 05 l.793-841, LDB 17 l.81 : chaque case se coche ou se décoche jusqu'à la fin de la séance, par l'hôte.
  finDeSeance: {
    ambitionCourte: caseDuGroupe('ambitionCourte'),
    ambitionLongue: caseDuGroupe('ambitionLongue'),
    ambitionPersonnelleCourte: caseDuHeros('ambitionPersonnelleCourte'),
    ambitionPersonnelleLongue: caseDuHeros('ambitionPersonnelleLongue'),
    motivation: caseDuHeros('motivation'),
  },
} as const satisfies OuvertsDuChoix;

/** Le réglage du choix `axe` de la fenêtre `fenetre` dans l'état `s`, sur le héros `pid` d'un choix de rangée
 *  (`OUVERTS_DU_CHOIX`). */
export const reglageDuChoixDeFenetre = (s: Jeu, fenetre: FenetreAChoix, axe: AxeDuChoix, pid?: IdDeRangee): Reglage =>
  (OUVERTS_DU_CHOIX[fenetre] as Readonly<Record<string, (s: Jeu, pid: IdDeRangee | undefined) => Reglage>>)[axe](s, pid);

/** Un réglage ouvre-t-il une valeur ? */
const ouvreUneValeur = (r: Reglage): boolean => !!r.bornes || !!r.valeurs?.length;

/** Le réglage de la rangée (`pid`) du choix de rangée `axe` de la fenêtre `fenetre` : chaque héros du groupe auquel il
 *  ouvre une valeur. */
const reglageDeLaRangee = (s: Jeu, fenetre: FenetreAChoix, axe: AxeDuChoix): Reglage => ({
  geste: { verbe: VERBE_DE_CHOIX, fenetre, axe },
  parametre: PARAMETRE_DE_RANGEE,
  libelle: libelleDuParametre(VERBE_DE_CHOIX, PARAMETRE_DE_RANGEE),
  courant: null,
  valeurs: s.party.filter((h) => ouvreUneValeur(reglageDuChoixDeFenetre(s, fenetre, axe, h.id))).map((h) => ouverte(h.id, nomDuPorteur(s, h.id))),
  bornes: null,
  note: null,
});

/** Les réglages des choix que nomment les gestes `gestes` d'une fenêtre (`fenetreChoisir`), hors de toute rangée, et pour
 *  un choix de rangée, celui de sa rangée (`reglageDeLaRangee`). */
export const reglagesDesChoix = (s: Jeu, gestes: readonly GesteDuJeu[]): Reglage[] =>
  gestes.flatMap((g) => {
    if (g.verbe !== VERBE_DE_CHOIX || !g.fenetre || !g.axe) return [];
    const fenetre = g.fenetre as FenetreAChoix;
    const deRangee = declarationDuChoixNomme(fenetre, g.axe)?.portee === 'rangee';
    return [reglageDuChoixDeFenetre(s, fenetre, g.axe), ...(deRangee ? [reglageDeLaRangee(s, fenetre, g.axe)] : [])];
  });

/** La valeur `valeur` est-elle dans les bornes `bornes` d'un réglage ? */
const dansLesBornes = (valeur: unknown, bornes: NonNullable<Reglage['bornes']>): boolean =>
  typeof valeur === 'number' && Number.isInteger(valeur) && valeur >= bornes.min && valeur <= bornes.max;

/** Un choix de la semaine en mer d'un héros de la semaine que l'état n'ouvre plus (MDG 15 l.268) : son Activité fermée
 *  ou hors du catalogue, sa mise ou sa planque hors de ses bornes — l'état a changé depuis le choix (héros remplacé,
 *  bourse, cale). La validation de la semaine reste fermée jusqu'à ce qu'il se reprenne. */
export function semaineAReprendre(s: Jeu): boolean {
  return Object.keys(s.pendingSeaActivities?.picks ?? {}).some((pid) => herosDeLaSemaine(s, pid) && (['activite', 'investir', 'cacher'] as const).some((axe) => {
    const lu = reglageDuChoixDeFenetre(s, 'activitesEnMer', axe, pid);
    if (lu.bornes) return !dansLesBornes(lu.courant, lu.bornes);
    if (axe !== 'activite') return false;
    const lue = lu.valeurs?.find((v) => v.valeur === lu.courant);
    return !lue || lue.refus !== null;
  }));
}

/** Ce qui refuse le choix venu d'une frontière (JSON d'un hôte, intention d'un siège) : un choix que la fenêtre ne
 *  déclare pas, une fenêtre fermée, une rangée absente d'un choix de rangée, ou posée sur un choix de la fenêtre, le choix
 *  de l'hôte dans l'état d'un invité, le choix du héros d'un autre siège, une valeur que l'état n'ouvre pas ou hors de
 *  ses bornes, ou la raison qui la ferme ; `null` : il se joue. */
export function refusDuChoix(s: Jeu, fenetre: unknown, axe: unknown, valeur: unknown, pid?: unknown): string | null {
  return estFenetreAChoix(fenetre) && estAxeDe(fenetre, axe)
    ? refusDuChoixNomme(s, fenetre, axe, valeur, typeof pid === 'string' ? pid : undefined)
    : t('choix.refus.inconnu');
}

/** Ce qui refuse le choix `axe` de la fenêtre `fenetre` à la valeur `valeur`, sur la rangée `pid` d'un choix de rangée
 *  (`refusDuChoix`) ; `null` : il se joue. */
export function refusDuChoixNomme(s: Jeu, fenetre: FenetreAChoix, axe: AxeDuChoix, valeur: unknown, pid?: IdDeRangee): string | null {
  const declaration = garanti(declarationDuChoixNomme(fenetre, axe), `${fenetre}.${axe}`, 'choix déclaré');
  if (!garanti(fenetreDuRegistre(fenetre), fenetre, 'fenêtre à choix').ouverte(s)) return t('choix.refus.fermee');
  if ((pid !== undefined) !== (declaration.portee === 'rangee')) return t('choix.refus.rangee');
  if (declaration.qui === 'hote' && s.net.mode === 'invite') return t('choix.refus.hoteSeul');
  if (declaration.portee === 'rangee' && declaration.qui === 'proprietaire' && !seatOwns(s, decidingSeat(s), pid as IdDeHeros)) return t('choix.refus.autreSiege');
  const lu = reglageDuChoixDeFenetre(s, fenetre, axe, pid);
  if (lu.bornes) return dansLesBornes(valeur, lu.bornes) ? null : t('choix.refus.bornes');
  const lue = lu.valeurs?.find((v) => v.valeur === valeur);
  return lue ? lue.refus : t('choix.refus.valeur');
}

/** Le verbe de choix du noyau sur `get`/`set` : il refuse, et le dit, le choix que `refusDuChoix` refuse, sinon joue le
 *  corps de son axe (`corps`). */
export function creerChoixDeFenetre(get: Get, set: Set, corps: CorpsDesChoix): Pick<ActionsDuNoyau, 'fenetreChoisir'> {
  return {
    fenetreChoisir: (...[fenetre, axe, valeur, pid]) => {
      const refus = refusDuChoix(get(), fenetre, axe, valeur, pid);
      if (refus) { refuserGesteDuSiege(get, set, refus); return; }
      (corps[fenetre] as unknown as Readonly<Record<string, (v: unknown, pid: IdDeRangee | undefined) => void>>)[axe](valeur, pid);
    },
  };
}
