/**
 * LES IDS QU'UN VERBE DÉSIGNE (#2898) : un alias de type par genre d'id que le jeu sait énumérer, et LA table
 * (`DESIGNATIONS`) qui, pour chaque nom d'alias, donne son nom en mots et lit dans l'état les ids valides. Les paramètres d'`ActionsDuNoyau` (`actionsDuNoyau.ts`, `rollFlowSpecs.ts`) portent ces alias ; le générateur
 * des verbes (`scripts/docs/lib/verbesDeLaPartie.mjs`) lit le NOM de l'alias écrit dans la déclaration du paramètre,
 * pour les seules clés de cette table, et un hôte (`argumentsDuVerbe`, `src/hote/geste.ts`) refuse un id que la table ne
 * rend pas. Un genre neuf : un alias et une entrée ici, rien dans l'hôte.
 */
import type { Jeu } from './etat';
import { portesDuMobile } from './marcheDuGroupe';
import { entreesDuLieu } from './lieuFlow';
import { itemLabel } from '../engine/items';
import { findMoraleFactor } from '../engine/crewMorale';
import {
  ACTIONS, NAVAL_TRAITS, apparences, careers, conditionIds, crewRoles, findConditionById, findCreatureById, findSeaShantyById,
  findTrappingById, maneuvers, pregens, profilsStandard, shipStations, skills, spells, talents, trappingsInstanciables,
} from '../data';
import { ACTIVITIES, cleDEntrainement, entrainementOptions, libelleDEntrainement, qualitesDArtisanat } from '../engine/activities';
import { parseRefKey } from '../engine/careerSlots';
import { libelleDePsy } from '../engine/psych/ciblage';
import { TAVERN_GAMES } from '../engine/tavernGame';
import { travelVehicles, vehicleTravel } from '../engine/travel';
import { actionsDe } from './monde/usable';
import { creneauxDuHeros } from './partyFlow';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { actFirstIds } from './turnEconomy';
import { preemptShooterIds } from './targeting';
import { BENCHED, chansonsDuChanteur, choixDePaieOuverts } from './shipCrew';
import { creaturesADepecer, entityPickables } from './combatEffects';
import { activeCombatant } from './combatFlow';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { FLOWS } from './rollFlowSpecs';
import { FLOW_VERBS, type FlowKey } from './flowVerbs';
import { traitsPsyChoisissables } from './verdictsDInterlude';
import { actorIn } from './monde/combatants';
import { adversairesADistraire, adversairesDuBattement, availableAttacks } from './combatManeuvers';
import { idsDuCoupleMonte } from './targetingModes';
import { reponsesDuNoeud } from './dialogue';
import { plaiesDeLOperation } from './acteDeSoin';
import { seaActivitiesCatalog } from './seaActivities';
import { catalogEntryOf, echoppesDuLieu, libelleDeLaRepartition } from './merchantFlow';
import { bulkCarriers, lotDeCargaison } from './carriers';
import { offresDeCargaison } from './cargaison';
import { libelleDuDepot } from './interludeEnVue';
import { findCargoById } from '../engine/cargo';
import { BATTLE_HAZARDS } from '../engine/massBattle';
import { battleSceneById, postesDeBataille } from './massBattleFlow';

/** Un combattant : la file de combat et le groupe (`porteurParId`, `monde/combatants.ts`). */
export type IdDeCombattant = string;
/** Un héros du groupe (`party`). */
export type IdDeHeros = string;
/** Un porteur d'objets : un héros du groupe ou une possession (`resolveCarrier`, `monde/carrier.ts`). */
export type IdDePorteur = string;
/** Une possession du groupe, par son `uid`. */
export type IdDePossession = string;
/** Un objet porté (`ItemInstance.uid`) par un héros, un combattant (les munitions de ses pièces, `ShipPoste.ammo`,
 *  comprises) ou une possession. */
export type IdDObjet = string;
/** Une entité de la scène courante (`scene.entities`). */
export type IdDEntiteDeScene = string;
/** Ce que le clic d'une case désigne (`cliquerLaCase`) : en combat un combattant, hors combat une entité de la scène. */
export type IdDuClic = string;
/** Un combattant que le choix `debutDuRound.promouvoir` accepte (`actFirstIds`, `turnEconomy.ts`). */
export type IdDeCombattantPromouvable = string;
/** Un tireur que le choix `debutDuRound.viser` et `declencherLeTirPreventif` acceptent (`preemptShooterIds`, `targeting.ts`). */
export type IdDeTireurRapide = string;
/** Une chanson que le réglage `chansonDeMarin.chanson` accepte (`chansonsDuChanteur`, `shipCrew.ts`). */
export type IdDeChanson = string;
/** Une forme d'arme invoquée que le lanceur du Sort en attente peut donner (`conjureFormOptions`), par l'id de son arme. LDB 47 */
export type IdDeFormeConjuree = string;
/** Un choix de paie que le choix `conseil.paie` accepte (`choixDePaieOuverts`, `shipCrew.ts`). */
export type IdDeChoixDePaie = string;
/** Une créature que le choix `victoire.depecer` accepte (`creaturesADepecer`, `combatEffects.ts`). */
export type IdDeCreatureADepecer = string;
/** Un adversaire que le réglage `battement.adversaire` accepte (`adversairesDuBattement`, `combatManeuvers.ts`). */
export type IdDAdversaireDuBattement = string;
/** Un adversaire que le réglage `distraire.adversaire` accepte (`adversairesADistraire`, `combatManeuvers.ts`). */
export type IdDAdversaireADistraire = string;
/** Le cavalier ou la monture que le choix `cibleDeMonture.cible` accepte (`idsDuCoupleMonte`, `targetingModes.ts`). */
export type IdDuCoupleMonte = string;
/** Une Activité en mer du catalogue (`seaActivitiesCatalog`, MDG 15 l.268). */
export type IdDActiviteEnMer = string;
/** Une réponse VISIBLE du nœud de dialogue courant, par son `id` (`reponsesDuNoeud`, `dialogue.ts`). */
export type IdDeReponseDeDialogue = string;
/** Une Blessure Critique que l'opération armée ou son brouillon peut viser, par son `uid` (`plaiesDeLOperation`, `acteDeSoin.ts`). */
export type IdDePlaieDeLOperation = string;
/** Un accès de pièce que le mobile du monde emprunte, par son `id` (`portesDuMobile`, `marcheDuGroupe.ts`). */
export type IdDePorte = string;
/** Un indice présent au carnet (`clues`). */
export type IdDIndice = string;
/** Un pré-tiré de la donnée (`pregens.json`), par son `id`. */
export type IdDePretire = string;
/** Une offre du registre des actions qui arme une intention (`run: armerLIntention`, `actions.json`), par son `id`. */
export type IdDIntention = string;
/** Un article du stock du marchand ouvert, par l'id de son entrée de catalogue (`catalogEntryOf`, `merchantFlow.ts`). */
export type IdDArticle = string;
/** Une ligne du butin ouvert (`pendingLoot`, `pendingVictory`), par son `uid` (`LootGear`). */
export type IdDeLigneDeButin = string;
/** Une ligne de la répartition des achats payés (`MerchantState.pendingDistribution`), par son `uid`. */
export type IdDeLigneDeRepartition = string;
/** Un porteur de vrac du groupe (`bulkCarriers`, `carriers.ts`) : l'`uid` d'une bête ou d'un véhicule possédé, ou
 *  `vessel`, le navire de campagne. */
export type IdDePorteurDeCargaison = string;
/** Un lot de vrac d'un porteur du groupe, par son `uid` (`CargoLot`). */
export type IdDeCargaison = string;
/** Une offre du marché ouvert, par l'id de sa cargaison (`offresDeCargaison`, `cargaison.ts`). */
export type IdDOffreDeCargaison = string;
/** Un dépôt en banque, par son `uid` (`BankDeposit`). */
export type IdDeDepot = string;
/** Un sort du catalogue (`spells.json`). */
export type IdDeSort = string;
/** Un set d'armes d'un combattant (`WeaponLoadout.id`). */
export type IdDePanoplie = string;
/** Un État du catalogue (`etats.json`). */
export type IdDeCondition = string;
/** Une Faveur due au groupe (`favors`), par son `id`. */
export type IdDeFaveur = string;
/** Une Activité du catalogue (`activities.json`) : d'interlude, de préparation ou Scène de bataille. */
export type IdDActivite = string;
/** Un objet du catalogue (`trappings.json`). */
export type IdDObjetDuCatalogue = string;
/** Un Atout ou un Défaut qu'un ouvrage d'Artisanat peut viser (`qualitesDArtisanat`). */
export type IdDeQualiteDArtisanat = string;
/** Une apparence du catalogue (`apparences.json`), ou la forme propre d'un objet (`TrappingData.shape`). */
export type IdDApparence = string;
/** Un Talent du catalogue (`talents.json`). */
export type IdDeTalent = string;
/** Une Carrière du catalogue (`careers.json`). */
export type IdDeCarriere = string;
/** Un emplacement de carrière d'un héros du groupe (`creneauxDuHeros`, `partyFlow.ts`), par sa clé. */
export type IdDeCreneau = string;
/** Une Compétence ou un Talent du catalogue (`skills.json`, `talents.json`) : l'option d'un emplacement. */
export type IdDeCompetenceOuDeTalent = string;
/** Une Compétence ou une Caractéristique qu'un héros du groupe peut s'entraîner à acquérir (`entrainementOptions`), par sa
 *  clé (`cleDEntrainement`). */
export type IdDEntrainement = string;
/** Une offre nommée d'une entité de la scène courante (`ActionOfferte.id`, `actionsDe`). */
export type IdDActionDEntite = string;
/** Un service à échoppe du lieu où se tient le groupe (`placeServices`, `merchantArchetype`), par son `id`. */
export type IdDeServiceDuLieu = string;
/** Une ligne de la table des facteurs environnementaux de la bataille de masse (`mass-battle.json › hazards`). ADE II 08 l.309 */
export type IdDAleaDeBataille = string;
/** Une Scène de la situation du Round de la bataille de masse (`MassBattleState.situation`). ADE II 08 l.116 */
export type IdDeSceneDeBataille = string;
/** Un poste de la bataille de masse où se poste un PJ (`postesDeBataille`, `massBattleFlow.ts`). ADE II 08 l.81, l.116-118 */
export type IdDePosteDeBataille = string;
/** Un point d'intérêt du plan du lieu où se tient le groupe qui mène à une scène (`entreesDuLieu`, `lieuFlow.ts`). */
export type IdDePointDInteret = string;
/** Un jeu de taverne du catalogue (`tavern-games.json`). */
export type IdDeJeuDeTaverne = string;
/** Un profil standard (`profilsStandard`, LDB 77 l.7). */
export type IdDeProfilStandard = string;
/** Une route de la carte du monde (`MapRoute.id`). */
export type IdDeRoute = string;
/** Un mode de voyage (`TravelMode`) : à pied, à monture, ou un véhicule à passage payant (`travelVehicles`). */
export type IdDeModeDeVoyage = string;
/** Un rôle d'équipage naval (`crew-roles.json`), ou le Repos (`BENCHED`). */
export type IdDeRoleABord = string;
/** Une station à bord (`ship-stations.json`). */
export type IdDeStation = string;
/** Une pièce d'artillerie montée d'un combattant (`ShipPoste.item.uid`). */
export type IdDePoste = string;
/** Un trait naval du catalogue (`naval-traits.json`) : Amélioration ou trait de navire. */
export type IdDeTraitNaval = string;
/** La rangée d'un flux de jet à plusieurs jets ouvert, par l'id de son slot (`RollFlowHandlers.rangees`), ou d'un choix de
 *  fenêtre, par l'id de son héros (`CorpsDesChoix`). */
export type IdDeRangee = string;
/** Une Compétence du catalogue (`skills.json`). */
export type IdDeCompetence = string;
/** Une Manœuvre du catalogue (`maneuvers.json`). LDB 85 */
export type IdDeManoeuvre = string;
/** Une attaque que le combattant actif peut armer (`availableAttacks`, `combatManeuvers.ts`), par son `id`. */
export type IdDAttaque = string;
/** Un objet que le décor d'une entité de la scène courante donne à ramasser, par sa clé (`entityPickables`,
 *  `combatEffects.ts`). */
export type IdDObjetRamassable = string;
/** Un stade qu'un indice du carnet a franchi (`ClueState.historique`), son stade courant compris. */
export type IdDeStadeDIndice = string;
/** Un Trait psychologique porté par un héros du groupe, par sa clé d'instance (`traitsPsyChoisissables`,
 *  `verdictsDInterlude.ts`). */
export type IdDeTraitPsyPorte = string;
/** Une classe de passage d'un véhicule à passage payant (`VehicleData.travel.classes`). */
export type IdDeClasseDePassage = string;
/** Une option d'une étape « choix » de la séquence ouverte, par sa clé (`CascadeStep.options`). */
export type IdDOptionDEtape = string;

/** Une désignation : son nom en mots, les ids valides qu'elle lit dans l'état, et le nom en mots du joueur de
 *  l'élément d'un id (`null` : l'élément n'a pas de nom). */
interface Designation {
  mot: string;
  lire: (s: Jeu) => readonly string[];
  nom: (s: Jeu, id: string) => string | null;
}

const ids = (xs: readonly { id: string }[]): string[] => xs.map((x) => x.id);
const sansDoublon = (xs: readonly string[]): string[] => [...new Set(xs)];
/** Chaque combattant une fois par id : sa copie de bataille d'abord, puis les héros du groupe hors de la bataille. */
const lesCombattants = (s: Jeu) => {
  const enBataille = s.battle?.combatants ?? [];
  const engages = new Set(ids(enBataille));
  return [...enBataille, ...s.party.filter((h) => !engages.has(h.id))];
};
const combattants = (s: Jeu): string[] => ids(lesCombattants(s));
/** Le `label` de l'élément d'id `id` parmi `xs`. */
const labelParmi = (xs: readonly { id: string; label?: string }[], id: string): string | null => xs.find((x) => x.id === id)?.label ?? null;
const nomDeCombattant = (s: Jeu, id: string): string | null => labelParmi(lesCombattants(s), id);
const lesObjets = (s: Jeu) => [
  ...lesCombattants(s).flatMap((c) => [...(c.items ?? []), ...(c.postes ?? []).flatMap((p) => p.ammo ?? [])]),
  ...s.possessions.flatMap((p) => p.items),
];
const lesPostes = (s: Jeu) => lesCombattants(s).flatMap((c) => c.postes ?? []);
const lesPanoplies = (s: Jeu) => lesCombattants(s).flatMap((c) => c.loadouts ?? []);
const lesEntites = (s: Jeu) => s.scene?.entities ?? [];
const lesActionsDEntite = (s: Jeu) => (s.scene ? lesEntites(s).flatMap((e) => actionsDe(s.scene!, e, s)) : []);
const lesModesDeVoyage = (): { id: string; label?: string }[] => [{ id: 'pied' }, { id: 'monture' }, ...travelVehicles()];
const lesEntrainements = (s: Jeu) => s.party.flatMap(entrainementOptions);
/** Les armes dont le lanceur du Sort en attente peut donner la forme (`conjureFormOptions`), LDB 47. */
const formesConjurables = (s: Jeu): string[] => {
  const lanceur = s.pendingCast ? actorIn(s, s.pendingCast.casterId) : undefined;
  return lanceur ? conjureFormOptions(lanceur).map((f) => f.weapon) : [];
};
const labelDePossession = (s: Jeu, uid: string): string | null => s.possessions.find((p) => p.uid === uid)?.label ?? null;
const lignesDuButin = (s: Jeu) => [...(s.pendingLoot?.gear ?? []), ...(s.pendingVictory?.gear ?? [])];
const lesAttaques = (s: Jeu) => {
  const actif = s.battle ? activeCombatant(s.battle) : undefined;
  return actif && s.battle ? availableAttacks(s.scene, actif, s.battle) : [];
};
const lesRamassables = (s: Jeu) =>
  (s.scene?.entities ?? []).flatMap((e) => entityPickables(e, s.flags, objetDuNarratif(s.campaignNarratif), s.objetsAuSol));
const lesTraitsPsyPortes = (s: Jeu) => s.party.flatMap(traitsPsyChoisissables);
const lesClassesDePassage = (): string[] => sansDoublon(travelVehicles().flatMap((v) => (vehicleTravel(v.id)?.classes ?? []).map((c) => c.id)));
const lesOptionsDEtape = (s: Jeu) => (s.pendingCascade?.participants ?? []).flatMap((st) => st.options ?? []);
const FLUX_A_RANGEES = (Object.keys(FLOW_VERBS) as FlowKey[]).filter((flux) => FLOW_VERBS[flux].kind === 'multi');

/** Les désignations, par NOM d'alias. `mot` est un littéral : le générateur des
 *  verbes le lit au source. */
export const DESIGNATIONS = {
  IdDeCombattant: { mot: 'id de combattant', lire: combattants, nom: nomDeCombattant },
  IdDeHeros: { mot: 'id de héros', lire: (s) => ids(s.party), nom: (s, id) => labelParmi(s.party, id) },
  IdDePorteur: { mot: 'id de porteur', lire: (s) => [...ids(s.party), ...s.possessions.map((p) => p.uid)], nom: (s, id) => labelParmi(s.party, id) ?? labelDePossession(s, id) },
  IdDePossession: { mot: 'id de possession', lire: (s) => s.possessions.map((p) => p.uid), nom: labelDePossession },
  IdDObjet: {
    mot: 'id d’objet',
    lire: (s) => lesObjets(s).map((i) => i.uid),
    nom: (s, uid) => {
      const objet = lesObjets(s).find((i) => i.uid === uid);
      return objet ? itemLabel(objet) : null;
    },
  },
  IdDEntiteDeScene: { mot: 'id d’entité de scène', lire: (s) => ids(s.scene?.entities ?? []), nom: (s, id) => labelParmi(s.scene?.entities ?? [], id) },
  IdDuClic: {
    mot: 'id de combattant ou d’entité de scène',
    lire: (s) => (s.battle ? combattants(s) : ids(s.scene?.entities ?? [])),
    nom: (s, id) => (s.battle ? nomDeCombattant(s, id) : labelParmi(s.scene?.entities ?? [], id)),
  },
  IdDeCombattantPromouvable: { mot: 'id de combattant promouvable', lire: actFirstIds, nom: nomDeCombattant },
  IdDeTireurRapide: { mot: 'id de tireur rapide', lire: (s) => preemptShooterIds(() => s), nom: nomDeCombattant },
  IdDeChanson: { mot: 'id de chanson', lire: chansonsDuChanteur, nom: (_s, id) => findSeaShantyById(id)?.label ?? null },
  IdDeFormeConjuree: { mot: 'id de forme conjurée', lire: formesConjurables, nom: (_s, id) => findTrappingById(id)?.label ?? null },
  IdDeChoixDePaie: { mot: 'id de choix de paie', lire: choixDePaieOuverts, nom: (_s, id) => findMoraleFactor(id)?.label ?? null },
  IdDeCreatureADepecer: { mot: 'id de créature à dépecer', lire: creaturesADepecer, nom: (_s, id) => findCreatureById(id)?.label ?? null },
  IdDAdversaireDuBattement: { mot: 'id d’adversaire du Battement', lire: (s) => ids(adversairesDuBattement(s)), nom: nomDeCombattant },
  IdDAdversaireADistraire: { mot: 'id d’adversaire à distraire', lire: (s) => ids(adversairesADistraire(s)), nom: nomDeCombattant },
  IdDuCoupleMonte: { mot: 'id du couple monté', lire: idsDuCoupleMonte, nom: nomDeCombattant },
  IdDActiviteEnMer: { mot: 'id d’Activité en mer', lire: () => ids(seaActivitiesCatalog()), nom: (_s, id) => labelParmi(seaActivitiesCatalog(), id) },
  IdDeReponseDeDialogue: { mot: 'id de réponse de dialogue', lire: (s) => ids(reponsesDuNoeud(s)), nom: (s, id) => labelParmi(reponsesDuNoeud(s), id) },
  IdDePlaieDeLOperation: {
    mot: 'id de plaie de l’opération',
    lire: (s) => plaiesDeLOperation(s).map((p) => p.uid),
    nom: (s, uid) => plaiesDeLOperation(s).find((p) => p.uid === uid)?.label ?? null,
  },
  IdDePorte: { mot: 'id de porte', lire: (s) => ids(portesDuMobile(s)), nom: () => null },
  IdDePretire: { mot: 'id de pré-tiré', lire: () => ids(pregens), nom: (_s, id) => labelParmi(pregens, id) },
  IdDIntention: { mot: 'id d’intention', lire: () => ids(ACTIONS.filter((a) => a.run === 'armerLIntention')), nom: (_s, id) => labelParmi(ACTIONS, id) },
  IdDArticle: { mot: 'id d’article', lire: (s) => (s.merchant?.stock ?? []).map((l) => l.id), nom: (_s, id) => catalogEntryOf(id)?.label ?? null },
  IdDeLigneDeButin: { mot: 'id de ligne de butin', lire: (s) => lignesDuButin(s).map((g) => g.uid), nom: (s, uid) => lignesDuButin(s).find((g) => g.uid === uid)?.label ?? null },
  IdDeLigneDeRepartition: {
    mot: 'id de ligne de répartition',
    lire: (s) => (s.merchant?.pendingDistribution ?? []).map((d) => d.uid),
    nom: (s, uid) => {
      const d = s.merchant?.pendingDistribution?.find((x) => x.uid === uid);
      return d ? libelleDeLaRepartition(d) : null;
    },
  },
  IdDePorteurDeCargaison: { mot: 'id de porteur de cargaison', lire: (s) => ids(bulkCarriers(s)), nom: (s, id) => labelParmi(bulkCarriers(s), id) },
  IdDeCargaison: {
    mot: 'id de cargaison',
    lire: (s) => bulkCarriers(s).flatMap((c) => c.cargo.map((l) => l.uid)),
    nom: (s, uid) => {
      const lot = lotDeCargaison(s, uid)?.lot;
      return lot ? findCargoById(lot.cargoId)?.label ?? null : null;
    },
  },
  IdDOffreDeCargaison: {
    mot: 'id d’offre de cargaison',
    lire: (s) => offresDeCargaison(s).map((o) => o.cargoId),
    nom: (s, id) => offresDeCargaison(s).find((o) => o.cargoId === id)?.label ?? null,
  },
  IdDeDepot: {
    mot: 'id de dépôt',
    lire: (s) => s.bank.map((d) => d.uid),
    nom: (s, uid) => {
      const d = s.bank.find((x) => x.uid === uid);
      return d ? libelleDuDepot(s, d) : null;
    },
  },
  IdDeSort: { mot: 'id de sort', lire: () => ids(spells), nom: (_s, id) => labelParmi(spells, id) },
  IdDePanoplie: { mot: 'id de panoplie', lire: (s) => sansDoublon(ids(lesPanoplies(s))), nom: (s, id) => labelParmi(lesPanoplies(s), id) },
  IdDeCondition: { mot: 'id d’État', lire: conditionIds, nom: (_s, id) => findConditionById(id)?.label ?? null },
  IdDeFaveur: { mot: 'id de Faveur', lire: (s) => ids(s.favors), nom: () => null },
  IdDActivite: { mot: 'id d’Activité', lire: () => ids(ACTIVITIES), nom: (_s, id) => labelParmi(ACTIVITIES, id) },
  IdDObjetDuCatalogue: { mot: 'id d’objet du catalogue', lire: () => ids(trappingsInstanciables()), nom: (_s, id) => findTrappingById(id)?.label ?? null },
  IdDeQualiteDArtisanat: { mot: 'id de qualité d’Artisanat', lire: () => [...qualitesDArtisanat().atouts, ...qualitesDArtisanat().defauts], nom: () => null },
  IdDApparence: {
    mot: 'id d’apparence',
    lire: () => sansDoublon([...ids(apparences), ...trappingsInstanciables().flatMap((t) => (t.shape ? [t.shape.id] : []))]),
    nom: (_s, id) => labelParmi(apparences, id),
  },
  IdDeTalent: { mot: 'id de Talent', lire: () => ids(talents), nom: (_s, id) => labelParmi(talents, id) },
  IdDeCarriere: { mot: 'id de Carrière', lire: () => ids(careers), nom: (_s, id) => labelParmi(careers, id) },
  IdDeCreneau: { mot: 'id d’emplacement de carrière', lire: (s) => sansDoublon(s.party.flatMap(creneauxDuHeros)), nom: () => null },
  IdDeCompetenceOuDeTalent: {
    mot: 'id de Compétence ou de Talent',
    lire: () => sansDoublon([...ids(skills), ...ids(talents)]),
    nom: (_s, id) => labelParmi(skills, id) ?? labelParmi(talents, id),
  },
  IdDEntrainement: { mot: 'id d’Entraînement', lire: (s) => sansDoublon(lesEntrainements(s).map(cleDEntrainement)), nom: (_s, cle) => libelleDEntrainement(parseRefKey(cle)) },
  IdDActionDEntite: { mot: 'id d’offre d’entité', lire: (s) => sansDoublon(ids(lesActionsDEntite(s))), nom: (s, id) => labelParmi(lesActionsDEntite(s), id) },
  IdDeServiceDuLieu: { mot: 'id de service du lieu', lire: (s) => ids(echoppesDuLieu(s)), nom: (s, id) => labelParmi(echoppesDuLieu(s), id) },
  IdDAleaDeBataille: { mot: 'id d’aléa de bataille', lire: () => ids(BATTLE_HAZARDS), nom: (_s, id) => labelParmi(BATTLE_HAZARDS, id) },
  IdDeSceneDeBataille: { mot: 'id de Scène de bataille', lire: (s) => s.massBattle?.situation ?? [], nom: (_s, id) => battleSceneById(id)?.label ?? null },
  IdDePosteDeBataille: { mot: 'id de poste de bataille', lire: (s) => (s.massBattle ? ids(postesDeBataille(s.massBattle)) : []), nom: (_s, id) => labelParmi(ACTIVITIES, id) },
  IdDePointDInteret: { mot: 'id de point d’intérêt du lieu', lire: (s) => ids(entreesDuLieu(s)), nom: (s, id) => labelParmi(entreesDuLieu(s), id) },
  IdDeJeuDeTaverne: { mot: 'id de jeu de taverne', lire: () => ids(TAVERN_GAMES), nom: (_s, id) => labelParmi(TAVERN_GAMES, id) },
  IdDeProfilStandard: { mot: 'id de profil standard', lire: profilsStandard, nom: (_s, id) => findCreatureById(id)?.label ?? null },
  IdDeRoute: { mot: 'id de route', lire: (s) => ids(s.worldMap?.routes ?? []), nom: (s, id) => labelParmi(s.worldMap?.routes ?? [], id) },
  IdDeModeDeVoyage: { mot: 'id de mode de voyage', lire: () => ids(lesModesDeVoyage()), nom: (_s, id) => labelParmi(lesModesDeVoyage(), id) },
  IdDeRoleABord: { mot: 'id de rôle à bord', lire: () => [...ids(crewRoles), BENCHED], nom: (_s, id) => labelParmi(crewRoles, id) },
  IdDeStation: { mot: 'id de station', lire: () => ids(shipStations), nom: (_s, id) => labelParmi(shipStations, id) },
  IdDePoste: {
    mot: 'id de poste',
    lire: (s) => lesPostes(s).map((p) => p.item.uid),
    nom: (s, uid) => {
      const poste = lesPostes(s).find((p) => p.item.uid === uid);
      return poste ? itemLabel(poste.item) : null;
    },
  },
  IdDeTraitNaval: { mot: 'id de trait naval', lire: () => ids(NAVAL_TRAITS), nom: (_s, id) => labelParmi(NAVAL_TRAITS, id) },
  IdDeRangee: { mot: 'id de rangée', lire: (s) => sansDoublon([...FLUX_A_RANGEES.flatMap((flux) => FLOWS[flux].rangees(() => s)), ...ids(s.party)]), nom: nomDeCombattant },
  IdDeCompetence: { mot: 'id de Compétence', lire: () => ids(skills), nom: (_s, id) => labelParmi(skills, id) },
  IdDeManoeuvre: { mot: 'id de Manœuvre', lire: () => ids(maneuvers), nom: (_s, id) => labelParmi(maneuvers, id) },
  IdDAttaque: { mot: 'id d’attaque', lire: (s) => ids(lesAttaques(s)), nom: (s, id) => labelParmi(lesAttaques(s), id) },
  IdDObjetRamassable: {
    mot: 'id d’objet à ramasser',
    lire: (s) => lesRamassables(s).map((p) => p.key),
    nom: (s, cle) => lesRamassables(s).find((p) => p.key === cle)?.label ?? null,
  },
  IdDeStadeDIndice: {
    mot: 'id de stade d’indice',
    lire: (s) => sansDoublon(Object.values(s.clues).flatMap((c) => [c.stadeCourant, ...c.historique.map((h) => h.stade)])),
    nom: () => null,
  },
  IdDeTraitPsyPorte: {
    mot: 'id de Trait psychologique porté',
    lire: (s) => sansDoublon(lesTraitsPsyPortes(s).map((x) => x.cle)),
    nom: (s, cle) => {
      const porte = lesTraitsPsyPortes(s).find((x) => x.cle === cle);
      return porte ? libelleDePsy(porte.trait.type, porte.trait.cible) : null;
    },
  },
  IdDeClasseDePassage: { mot: 'id de classe de passage', lire: lesClassesDePassage, nom: () => null },
  IdDOptionDEtape: {
    mot: 'id d’option d’étape',
    lire: (s) => sansDoublon(lesOptionsDEtape(s).map((o) => o.key)),
    nom: (s, cle) => lesOptionsDEtape(s).find((o) => o.key === cle)?.label ?? null,
  },
  IdDIndice: { mot: 'id d’indice', lire: (s) => Object.keys(s.clues), nom: (s, id) => s.campaignNarratif?.indices.find((i) => i.id === id)?.titre ?? null },
} satisfies Record<string, Designation>;
