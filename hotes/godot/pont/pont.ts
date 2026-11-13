/**
 * LE PONT DE L'HÔTE GODOT (#2928, contrat `CONTRAT.md`) : le transport JSON entre Godot et le noyau. Une méthode reçoit
 * au plus une chaîne JSON et rend toujours une chaîne JSON, `{ ok: true, … }` ou `{ ok: false, erreur }` ; elle ne lève
 * jamais. Le pont ne porte aucune règle : un geste passe par le module commun des hôtes (`src/hote/`), la vue est faite
 * des lecteurs du noyau, les jetons programmés sont tenus par numéro et rejoués quand Godot les rend. Le panneau que
 * l'écran tient ouvert, un seul à la fois (la fiche d'un combattant en statbloc, la création d'un héros), est un état
 * du pont, que les méthodes `fiche` et `creation` posent, jamais de la partie ; seul
 * l'engagement du héros créé la touche, et l'Effet de scène qui demande un héros neuf
 * (`demandeUnHeros`) ouvre la création comme « Nouveau héros ». Les modèles servis (`modeles`) sont un état du pont
 * aussi, que l'atelier et le combat lisent : chaque combattant dessiné se compose sur la base comme une composition de
 * l'atelier (`composerSurLaBase`).
 */
/**
 * @contrat En-tête
 * v8 (#2928, #2948, #3086, #3253, #3508).
 *
 * Godot est un hôte du noyau, au même titre que l'hôte texte (`src/hoteTexte/`) : il envoie des gestes et lit une vue
 * faite des lecteurs du noyau. Le pont (`pont.ts`) ne porte aucune règle ; il passe par le module commun des hôtes
 * (`src/hote/`). Ticket : #2928. Les tests `*.hors-store.test.ts` de ce dossier vérifient ce contrat.
 */
import { CLIC_DU_CHAMP, chargerLaSave, estUnPointDeReprise, nommerLesRetraits, pointDeRepriseAGarder, refusDeSauvegarde, ruleOverrides, snapshotSave, partieEnCours, refusDeLancer, brouillonDeLaPartie, cataloguesDeComposition, enTeteDuPorteur, ficheDuPorteur, editer, herosDuRosterOfferts, ouvrirLEdition, projetDuDepot, essaiDeLaScene, texteAEnregistrer, pagesDeCreation, vueDeLaScene, FIRE_ARCS, ficheDEntite, libelleDuBord, lireApparenceDAuteur, lireComposition, lireSurchargesDEmblemes, siegeEngines, vehiculeDuCombattant, type FireArc, lumiereDeLaScene, porteeDuCombattant, type Jeu, effetsDeLAppel, vitrineDesEffets, type Effet, type VitrineDesEffets, PREFERENCES, type PrefValue, meteoDuRegard, aretesDeLaCouche, aretesDeLaScene, type AreteDessinee, type Combatant, naviresDeLaScene, stationsDuNavire, type EmprisesDesCases, type NavireDeLaScene, type StationDeNavire, casesDuGroupe, masqueDuRegard, plateauDeLaScene, regardDuJeu, REGARDS, type Regard, porteeDeComposition, presetDeComposition, couronnesDuMonde, retraitDuMonde, toitsDuMonde, volumeDuMonde, echantillonDessine, famillesDEchantillons, type EchantillonDessine, type FamilleDEchantillons, type Composition, type GesteDEdition, type Scene, type SessionDEdition, type LectureAuSchema, type LigneDuJournal, type LumiereDeLaScene, type ProjectDoc, type Intention, type Partie, type Programme, type ResultatDeLAppel, type VehiculeDuCombattant, type EmblemeResolu, planDeLaCouche, type OeilDuPlan, musiqueDeLaPartie, type MusiqueDeLaPartie, zonesQuiDurentEnVue, type ZoneQuiDure, marquesDesEtats, type MarqueDEtat, type MeteoDuRegard, type MorceauDuMonde, type NappeDuMonde, type PlateauDeLaScene, type RetraitDuMonde, type VolumeDuMonde, cleDeLaVision, porteurEnVue, visionDuMonde, type VisionDuMonde } from '../../../src/noyau/index';
import { ErreurDeGeste, entreesDuJeu, nouvelEntete, nouvellesEntrees, ouvrirAuGroupe, ouvrirLaPartie, ouvrirLeLancement, valider, type CategorieDErreur, type PartieAuGroupe } from '../../../src/hote/partie';
import { envoyerLIntention, gesteDuVerbe, intentionDuGeste, SANS_PISTE } from '../../../src/hote/geste';
import { casesAtteignables, horsCombat, projeter, type BornesDeLaProjection, type CaseAtteignable, type Projection } from '../../../src/hote/projection';
import { estObjet } from '../../../src/lib/objet.mjs';
import { fenetreADessiner } from '../../../src/hote/gestes';
import { lignesDuJournal, zonesDeLEcran, type ZonesDeLaSuite, type ZonesDeLEcran } from '../../../src/hote/ecran';
import { ameliorationsMontables, ameliorationsMontees, emblemeMonte, modelesDeLAtelier, noeudsCaches, postesEnVigueur, postesMontes, type AmeliorationMontee, type ModelesDeLAtelier, type PosteMonte } from './atelier';
import { composerSurLaBase, paletteDesCouleurs, type CompositionSurLaBase } from './composition';
import { estListeDeChaines } from '../asset/attache';
import type { TableDeClips } from '../asset/clips';
import { type CreationOuverte, type GesteDeLaCreation, type GesteDuRoster, type PanneauDeLHote } from '../../../src/hote/elements';
import { apresLaCreation, boutonDeLaCreation } from '../../../src/hote/creation';
import { boutonDeLEdition, calqueAffiche, cheminDeLaPlanche, estLIssueDUnChargement, estLIssueDUnChapitre, gesteDuFormulaire, estLIssueDUnEnregistrement, estUnGesteDuPointeur, memoireDesCalques, refusDeLaValeurDit, surcoucheDeLEdition, zonesDeLEditeur } from '../../../src/hote/editeur';
import { allBuiltinCampaigns, campagneDuJeu, lancementDeLaCampagne, paquetDuJeu } from '../../../src/scenes/campaign';
import { zonesDesScenarios } from '../../../src/hote/scenarios';
import { AUTO_SLOT, MESSAGE_DU_REFUS, SAVE_SLOTS, ecrireLaSauvegarde, lireLaSauvegarde, nomDEmplacement, zonesDesSauvegardes, type AnySlot, type SaveSlot } from '../../../src/hote/sauvegardes';
import { graineDEntropie, idDEntropie } from '../../../src/hote/entropie';
import { boutonDuRoster } from '../../../src/hote/groupe';
import { zonesDeLAccueil } from '../../../src/hote/accueil';
import { chargerLesPreferences } from '../../../src/hote/preferences';
import { jouerUnReglage, zonesDesReglages } from '../../../src/hote/reglages';
import { lireUnGesteDuSalon, zonesDuSalon, type OuvertureDuSalon } from '../../../src/hote/salon';
import { creerLeSalon, type PortsDuSalon } from '../../../src/hote/coop/salon';
import type { SocketLike } from '../../../src/hote/coop/relay';
import { reposerLesReglesMaison } from '../../../src/hote/reglesMaison';
import { SANS_ROSTER, engagerLeHeros, fichierDuHeros, importerAuRoster, mettreAJourLeRoster, retirerDuRoster, rosterAMontrer, type RosterMontre } from '../../../src/hote/roster';
import { garanti } from '../../../src/lib/garanti';
import type { Stockage } from '../../../src/lib/stockage';
import { t } from '../../../src/i18n';
import { enOctets } from './octets';

/** La catégorie d'une erreur du pont : celle d'un geste, ou `interne` pour une levée qu'aucun contrôle n'attendait. */
export type CategorieDuPont = CategorieDErreur | 'interne';

/** Une réponse du pont, avant sa mise en JSON. */
type Reponse = ({ ok: true } & Record<string, unknown>) | { ok: false; erreur: { categorie: CategorieDuPont; message: string } };

/** Le réseau que l'hôte donne au pont : les ports du salon (`PortsDuSalon`, `src/hote/coop/salon.ts`) qui ne sont
 *  pas ceux de la partie. */
export type ReseauDuPont = Pick<PortsDuSalon, 'relais' | 'fetch' | 'socket' | 'minuterie' | 'compression' | 'stockage'>;

/** Une erreur de la page (`error`, `unhandledrejection`) ou du réseau, relevée entre deux appels de `erreursGlobales`. */
interface ErreurGlobale {
  message: string;
  source: string | null;
}

/**
 * @contrat Corps d'un combattant
 * Les corps du combat (`VueDuPont.corps`). La vue compose chaque combattant dessiné (`combat.voisins.liste` en combat,
 * `exploration.heros` hors combat) sur la base servie par le dernier `modeles`, par `composerSurLaBase`
 * (`composition.ts`), comme `composer` compose une composition à l'atelier : les modèles servis sont un état du pont,
 * que l'atelier et le combat lisent, et aucun index de combat ne double celui de l'atelier (`corpsDe`, `pont.ts`).
 * `modeles` s'appelle avant ou après `demarrer` ; chaque vue suivante compose sur le dernier.
 */
export interface CorpsDuCombat {
  /**
   * `[sans-modeles]` avant tout `modeles` ; `[base-ambigue]` quand le dernier `modeles` sert zéro ou plusieurs bases
   * (le message les compte et les nomme) ; `null` sinon. Avec un refus, chaque combattant vaut `null`.
   */
  refus: string | null;
  /**
   * Par id de combattant dessiné (`combat.voisins.liste`, sinon `exploration.heros`), puis de héros du groupe qu'elle ne
   * dessine pas, que son portrait montre (`Portrait`, `src/hote/elements.ts`) : `null` pour un combattant sans
   * portée ; sinon sa composition sur la base (`CompositionSurLaBase`, section « Composition d'un personnage ») et
   * `base`, l'id de cette base. Sa portée se compose sur la base par `composerSurLaBase` ; sous refus, il vaut `null`.
   */
  combattants: Record<string, (CompositionSurLaBase & { base: string }) | null>;
  /**
   * Par id de combattant dessiné : pour un combattant dessiné qui est un véhicule ou un engin, hors d'un navire de
   * `navires`, (`vehicule` de sa projection) dont le dernier `modeles` sert un élément `vehicule` de même `definition`
   * (`vehicules` de sa réponse, section « Atelier 3D »), son corps (`corpsDuVehicule`, `pont.ts`, que `vehicule`
   * compose aussi pour l'atelier) (`CorpsDuVehicule`, `CombattantProjete.vehicule`). Un véhicule n'a pas de base :
   * `refus` ne le touche pas (#2987).
   */
  vehicules: Record<string, CorpsDuVehicule>;
  /**
   * pour chaque navire de la scène dont elle pose les ponts (#3686 : une entité `personnage` dont le `vehicule` est un
   * véhicule à plan des ponts, dans une scène à l'échelle de ce plan) et dont le dernier `modeles` sert un élément
   * `vehicule` de même `definition`, par l'id de son entité (`naviresDeLaScene`, `src/noyau/planDeNavire.ts`) : son
   * corps, son centre et ses stations (`NavireServi`).
   */
  navires: Record<string, NavireServi>;
}

/**
 * @contrat Corps d'un combattant
 * Un navire de la scène servi (#3686) : son corps, où se pose l'origine de son modèle (`NavireDeLaScene`), et où se
 * tient l'occupant de chaque case de ses ponts que son modèle rogne (`stationsDuNavire`, des `cases` du manifeste de
 * son élément, #3767).
 */
export interface NavireServi {
  /**
   * le corps de son véhicule (`corpsDuVehicule`, comme `vehicules[id]`, du véhicule de sa fiche,
   * `vehiculeDuCombattant`, à son cap, `taille` `reelle`).
   */
  corps: CorpsDuVehicule;
  /**
   * le point de la scène, en cases continues (la case centrée sur l'entier), sous l'origine de son modèle : le centre
   * de l'emprise de ses ponts, le repère du plan de ses ponts étant celui du modèle (`pontsDeLaFiche.ts`), sa
   * flottaison à la hauteur 0 de la scène.
   */
  centre: NavireDeLaScene['centre'];
  /**
   * pour chaque case de ses ponts que son modèle rogne (`cases` du manifeste de l'élément, l'emprise libre de
   * chacune, #3767), la case et son étage (`x`, `y`, `z`) et `point`, le centre de cette emprise, en cases continues
   * (`stationsDuNavire`) : l'occupant de la case s'y tient (`Monde.lieu`, que pose `Monde.poser_les_stations`), à sa
   * place au centre de toute autre case.
   */
  stations: StationDeNavire[];
}

/**
 * @contrat Corps d'un combattant
 * Le corps d'un véhicule servi (#2987), que le combat (`corpsDe`) et l'atelier (`vehicule`) composent tous deux
 * (`corpsDuVehicule`).
 */
export interface CorpsDuVehicule {
  /** l'id de cet élément, l'élément `vehicule` qui dessine sa fiche (`ModelesDeLAtelier.vehicules`). */
  element: string;
  /** le côté N des N×N cases qu'il couvre depuis sa case (coin nord-ouest). */
  empreinte: number;
  /** celle de sa projection. */
  taille: VehiculeDuCombattant['taille'];
  /** celui de sa projection. */
  cap: VehiculeDuCombattant['cap'];
  /**
   * la couleur `#rrggbb` de chaque emplacement de palette que colorent les `couleurs` de sa projection, résolues au
   * nuancier (`paletteDesCouleurs`, `composition.ts`).
   */
  palette: Record<string, string>;
  /**
   * celui de sa projection si cet élément porte une surface `blason` (`emblemeMonte`, `atelier.ts`, la règle des
   * entrées de `montes`), absent sinon.
   */
  embleme?: EmblemeResolu;
  /**
   * les pièces montées à ses postes (`postesMontes`, `atelier.ts`) : chaque pièce de `postes` de sa projection dont le
   * dernier `modeles` sert un élément `vehicule` de même `definition`, à la position de son bord qui suit celles des
   * pièces précédentes de ce bord dans ses postes en vigueur (`postesEnVigueur`, `atelier.ts`) : `postes` du manifeste
   * de l'élément du véhicule (section « Atelier 3D »), chaque bord que nomme `selon.<amelioration>.postes` d'une
   * Amélioration de `ameliorations` de sa projection remplacé par les siens (MDG 12 l.362, Sabord), si ces postes
   * l'offrent ; chacune y porte `element`, l'id de son élément, `bord`, `position` et `palette`, celle du véhicule où
   * la palette de sa `teinte` colore (`findTeinteById`).
   */
  postes: PosteMonte[];
  /**
   * les pièces de ses Améliorations (`ameliorationsMontees`, `atelier.ts`) : pour chaque Amélioration de
   * `ameliorations` de sa projection dont le dernier `modeles` sert un élément `amelioration` de même
   * `cle.amelioration`, selon le `montage` de cet élément, une pièce à chacune des positions de `ancrages` de cette
   * Amélioration dans le manifeste du véhicule, ou une pièce à chaque position de `selon.<amelioration>.postes` de ce
   * manifeste, qui porte `poste` : son `bord`, `montre`, `ouvert` si une pièce de `postes` y est montée, `ferme` sinon,
   * et `cache`, l'autre (`ETATS_AU_POSTE`, `asset/element.ts`) ; chacune y porte `element` et `position`.
   */
  ameliorations: AmeliorationMontee[];
  /**
   * les noms des nœuds à cacher (`noeudsCaches`, `atelier.ts`) : pour chaque Amélioration que nomme le `selon` du
   * manifeste du véhicule ou celui d'une pièce de `ameliorations`, `sans-<amelioration>` si elle est dans
   * `ameliorations` de sa projection, `avec-<amelioration>` sinon (`noeudSelon`, `asset/element.ts`).
   */
  caches: string[];
  /** la table rôle → clip de cet élément (`clips` de son manifeste, `{}` sans clips). */
  clips: TableDeClips;
}

/**
 * @contrat Corps d'un combattant
 * Chaque combattant (`combat.actif`, `combat.voisins.liste` et `exploration.heros`) porte `vehicule`
 * (`vehiculeDuCombattant`, `src/noyau/apparence/combattant.ts`) : `null`, sauf pour une coque de `vehicles.json` ou un
 * engin `armes-de-siege` de `trappings.json` (`findFicheDeVehicule`), qui y porte `definition`, l'id de sa fiche,
 * `empreinte`, le côté de son empreinte (`footprintN`), `taille`, `reelle` pour un engin, `empreinte` pour une coque,
 * dont la taille réelle à terre est le plateau de son pont (arbitrage du 2026-11-08, #2987), `cap`, son cap (`facing`
 * de l'état, `N` sans cap, comme au combat), `couleurs`, celles de son apparence (ci-dessous), `postes`, la pièce de
 * chacun de ses postes à un bord (`postes` du combattant, MDG 12), dans leur ordre : `definition`, l'id de sa fiche
 * (`trappingId` de la pièce), `bord` (`FIRE_ARCS`) et `teinte`, celle de la pièce (`teinteDeLObjet`), `ameliorations`,
 * les ids des Améliorations de sa coque, celles de sa fiche puis celles installées (`hullNavalTraits`), sans ses Traits
 * (`kind` de `naval-traits.json`), et `embleme`, son emblème (`emblemeDe`, comme celui d'une portée ci-dessous), absent
 * sans emblème. Il porte aussi `portee`, ce qu'il porte (`porteeDuCombattant`, `src/noyau/apparence/combattant.ts`) :
 * une portée de composition, `null` quand son espèce n'a aucune race de rendu (la race d'apparence d'une espèce
 * jouable, `refChar`, sinon l'espèce si elle est une race de `raceAppearance.json`). Elle porte la tête de sa race ;
 * ses armes tenues, chacune à sa main (`prise`), puis rangées, chacune par ses apparences candidates
 * (`apparencesCandidates`), la première et, si elle est une variante, sa racine, sans les attaques naturelles ; les
 * objets équipés qui revêtent des pièces (`piecesDeLObjet`) ; son armure : ses armures équipées, chacune par ses
 * localisations (`locs`), sinon, si son apparence déclare son armure de statbloc portée (`armurePortee`, de son
 * apparence d'auteur, sinon de sa créature, #774), un objet par Groupe d'armure atteint, couvrant les localisations
 * dont les PA (`armour`) ont ce Groupe pour palier (`palierPA` le plus haut atteint), de la `couche` la plus haute à la
 * plus basse ; chaque objet par le seul assembleur d'objet (`porteesDesObjets`), à sa teinte (`teinte` de l'arme ou de
 * l'objet, à défaut celle de son Groupe d'armure) ; puis la tenue de sa carrière (`career`, la tenue de la garde-robe
 * dont elle est une des `carrieres`, `findTenueDeCarriere`, #3456). Une pièce n'y est portée qu'une fois, par le
 * premier qui la revêt (sa pièce racine). Les mains s'attribuent en un seul lieu (`armesDuCombattant`,
 * `src/noyau/equipementDessine.ts`) : les mains explicites du set passent avant les armes sans main du statbloc, qui
 * prennent `main` puis `secondaire` ; un bouclier demande `secondaire` ; une arme à deux mains réserve les deux mains ; une attaque
 * naturelle n'en réserve aucune ; le surplus est rangé, après les objets des sets non tenus, sans modifier les armes
 * persistées ni leurs règles de combat. Son emblème est celui de son apparence d'auteur (`EntityAppearance.embleme`,
 * une référence `{ id }` à un emblème de la garde-robe, que le schéma refuse inconnue ou d'une autre catégorie), sinon
 * celui de sa créature (`emblemeDe`). Son sexe est celui de son apparence, `M` par défaut : le corps neutre de la base,
 * clé `feminin` à 0. Ses `couleurs`, absentes si aucune ne colore un emplacement, sont celles de l'apparence de sa
 * créature (`EntityAppearance.couleurs`, une couleur du nuancier par emplacement de palette, `couleursSchema`), chacune
 * remplacée par celle de son apparence d'auteur. Une surface prend la palette de la teinte de l'objet qui l'apporte,
 * sinon ces couleurs, sinon garde la matière du modèle.
 */
/** Le corps du véhicule `vehicule` (`vehiculeDuCombattant`) sur les modèles servis `servis`, `null` si aucun élément
 *  `vehicule` de sa fiche n'est servi. Le combat (`corpsDe`) et l'atelier (`vehicule`) le composent tous deux ici. */
function corpsDuVehicule(vehicule: VehiculeDuCombattant, servis: { manifestes: Record<string, unknown>; modeles: ModelesDeLAtelier }): CorpsDuVehicule | null {
  const element = servis.modeles.vehicules[vehicule.definition];
  if (!element) return null;
  const palette = paletteDesCouleurs(vehicule.couleurs);
  const manifeste = servis.manifestes[element];
  const postes = postesMontes(manifeste, vehicule.ameliorations, vehicule.postes, servis.modeles.vehicules, palette);
  const ameliorations = ameliorationsMontees(manifeste, vehicule.ameliorations, postes, servis.modeles.ameliorations, servis.manifestes);
  const caches = noeudsCaches(manifeste, vehicule.ameliorations, ameliorations, servis.manifestes);
  const clips = estObjet(manifeste) && estObjet(manifeste.clips) ? manifeste.clips as TableDeClips : {};
  return { element, empreinte: vehicule.empreinte, taille: vehicule.taille, cap: vehicule.cap, palette, ...emblemeMonte(vehicule.embleme, manifeste), postes, ameliorations, caches, clips };
}

/** Une place d'un bord du véhicule de l'atelier : son bord, son rang parmi les places de ce bord (compté de 0), son libellé
 *  (`libelleDuBord`, puis le rang compté de 1) et la fiche de la pièce qui s'y monte (`null` : aucune). */
export interface PlaceDuVehicule {
  bord: FireArc;
  rang: number;
  label: string;
  piece: string | null;
}

/** Le véhicule de l'atelier (`vehicule`) : son corps, les places de ses bords dans ses postes en vigueur
 *  (`postesEnVigueur`), dans l'ordre de `FIRE_ARCS`, les fiches servies qui se montent à un poste, ses Améliorations, et
 *  celles qu'il peut monter (`montables`, `ameliorationsMontables`). */
export interface VehiculeDeLAtelier {
  vehicule: CorpsDuVehicule;
  places: PlaceDuVehicule[];
  pieces: string[];
  ameliorations: readonly string[];
  montables: string[];
}

/**
 * @contrat Vue
 * La vue : ce que rend `vue`, et la `vue` de chaque `Suite`.
 */
export interface VueDuPont {
  /**
   * la projection commune aux hôtes (`projeter`, `src/hote/projection.ts`), sans borne : Godot reçoit chaque liste
   * entière. Ses champs sont des données, jamais du texte mis en forme. Elle porte notamment `fenetre`
   * (`fenetreDuJeu` : la clé de la fenêtre qui tient la main, son propriétaire, ses gestes, `fermes` (chaque geste que
   * son flux de jet ferme maintenant, par sa clé, avec sa raison en mots du joueur, `fermeturesDeLaFenetre`), l'id de
   * la rangée que ses gestes désignent), `jets` (`jetsEnVue`), et `combat`, avec `barre` (`etatDeLaBarre` :
   * `{ forme, raison }`), `offres` (`offresDeLActif`), `cibles` (`validTargets`), `apercu` (`battle.preview` :
   * `{ genre, cible, case, cout }`) et `voisins` (les combattants en vue, chacun avec ses États `{ id, valeur }`) ; hors
   * combat, `exploration`, avec `groupe` (la case du groupe) et `etage` (sa couche, `null` sur une scène d'une seule
   * couche), `heros` (chaque héros projeté comme un combattant, à la case et la couche du groupe), `entites` (celles que
   * le groupe connaît, `entiteConnue`, hors des navires posés par leurs ponts, `estPoseParSesPonts`, qui ne tiennent
   * aucune case) et `gestes`
   * (`gestesDExploration`). Une position projetée (`pos` d'un combattant ou d'une entité, `case` de l'aperçu) est
   * `[x, y, z]`, la case et sa couche ; le plateau pose chacun, sa surbrillance comprise, sur le sol de sa couche
   * (`hauteurs`).
   */
  projection: Projection;
  /** les corps de ses combattants (`corpsDe`, `pont.ts`) : section « Corps d'un combattant ». */
  corps: CorpsDuCombat;
  /**
   * nomme la forme de la fenêtre qui tient la main (`FenetreADessiner.disposition`, `src/hote/gestes.ts`) : sa clé, ou
   * `<clé>/<jet>` pour l'étape d'un jet (`cascade/attaque` pour la fenêtre d'attaque) ; `null` sans fenêtre. L'hôte
   * n'écrit aucune clé de fenêtre : il cherche la scène qu'elle nomme.
   */
  disposition: string | null;
  /**
   * l'écran en éléments (`src/hote/elements.ts`), une liste par zone, dans l'ordre où la zone les montre
   * (`zonesDeLEcran`, `src/hote/ecran.ts`), chacune sous sa clé de `ZonesDeLEcran`.
   */
  zones: ZonesDeLEcran;
  /**
   * liste les cases que le champ peint au tour de l'actif (`casesAtteignables`, `porteesDuTour`), et rien hors de ce
   * tour.
   */
  cases: CaseAtteignable[];
  /** le plateau de la scène (`plateauDeLaScene`, `src/noyau/monde/aretes.ts`) ; `null` sans scène. */
  plateau: PlateauDeLaScene | null;
  /**
   * la lumière de la scène (`lumiereDeLaScene`, `src/noyau/lumiereDeLaScene.ts`) : section « Lumière » ; `null` sans
   * scène.
   */
  lumiere: LumiereDeLaScene | null;
  /**
   * la musique que la partie joue (`musiqueDeLaPartie`, `src/noyau/musiqueDeLaPartie.ts`) : section « Musique » ;
   * `null` au silence.
   */
  musique: MusiqueDeLaPartie | null;
  /**
   * les zones qui durent sur le plateau (`zonesQuiDurentEnVue`, `src/noyau/effetsDeLAppel.ts`), chacune dessinée tant
   * qu'elle dure et nommée par sa `cle` d'une vue à l'autre (#3834) ;
   * chacune réduite à ses cases que le groupe voit (`caseDeZoneEnVue`), absente sans aucune (#3950) ;
   * une zone qui coupe la vue se montre entière dès que le groupe en voit le bord.
   */
  zonesQuiDurent: ZoneQuiDure[];
  /**
   * par id d'un combattant dessiné, les marques de ses États (`marquesDesEtats`, `src/noyau/marquesDesEtats.ts`),
   * dans leur ordre : le texte, la teinte, le visuel et le son en boucle de chacune (#3834).
   */
  marques: Record<string, MarqueDEtat[]>;
  /**
   * nomme le verbe du clic du champ (`CLIC_DU_CHAMP`, `src/noyau/actionsDuNoyau.ts` ; la barre de l'actif ouverte, ou
   * en exploration sans fenêtre), qui prend la case cliquée, `{ x, y }` au rez, `{ x, y, z }` à la couche `z` (`Pt`),
   * puis, en combat, le combattant qui s'y tient : `{ type: champ, args: [case, occupant] }`, ou `[case]` sur une case
   * libre et hors combat, où il mène le groupe à la case ; `null` quand la barre de l'actif n'est pas ouverte ou qu'une
   * fenêtre tient la main hors combat : le champ ne se clique pas.
   */
  champ: typeof CLIC_DU_CHAMP | null;
  /**
   * donne, par case et couche `"x,y,z"`, l'id du combattant qui s'y tient, hors de combat exclus : le clic sur une case
   * occupée désigne son occupant.
   * Il tient chaque combattant posé, hors de vue compris : son id et sa case, rien d'autre.
   */
  occupants: Record<string, string>;
  /**
   * donne, par id, la case `[x, y, z]` de chaque cible du combat :
   * celles de `combat.cibles` et celle de l'aperçu (`combat.apercu.cible`).
   * En vue ou non, lue à `battle.combatants`.
   * Vide hors combat.
   */
  casesDesCibles: Record<string, [number, number, number]>;
  /**
   * la clé de la vision du groupe (`cleDeLaVision`, `src/noyau/visionDuGroupe.ts`).
   * `null` sans scène.
   * À son changement, Godot rappelle `vision`.
   */
  vision: string | null;
}

/**
 * @contrat Suite
 * Ce que la partie a produit depuis la `Suite` précédente, dont le plateau anime le journal.
 * Tout résultat que la partie rend au pont et qui porte un événement ou une ligne entre à sa file ; chaque `Suite`
 * relève d'abord la partie (ce que le réseau a écrit hors appel), puis prend la file entière : rien ne sort deux fois.
 * Limites :
 * - ce qu'un appel en erreur avait produit sort à la `Suite` suivante, lu sur l'état de cette `Suite` : ses effets
 *   s'y placent, son point de reprise s'y juge (`pointDeRepriseAGarder`), un héros neuf demandé y ouvre la création
 *   par-dessus un panneau ouvert entre-temps, la ligne et le son d'un geste refusé à un siège sortent avec une `Suite`
 *   sans rapport ;
 * - un jeton programmé par un appel en erreur attend la `Suite` suivante ;
 * - une réponse `interne` levée pendant la construction d'une `Suite` perd ce que cette `Suite` devait porter, jetons
 *   numérotés compris, restes de la file compris ; un reste dont le rendu lève fait donc répondre `interne` à l'appel
 *   suivant qui rend une `Suite`, une fois : la file est vide après lui.
 */
export interface Suite {
  /** la vue d'après (section « Vue »). */
  vue: VueDuPont;
  /**
   * les jetons que la partie a programmés, chacun numéroté dans l'ordre d'arrivée (`tenueDesJetons`,
   * `src/hote/partie.ts`). Godot arme un minuteur de `delai` millisecondes, puis appelle `reprendre { jeton: id }`. Un
   * jeton se reprend une seule fois.
   */
  programmes: Programme[];
  /**
   * les lignes que la partie a écrites, `{ de: 'journal', texte, heure }` ou `{ de: 'combat', evenement, heure }`
   * (`LigneDuJournal`, `src/noyau/partie.ts`, `heure` le temps de jeu où elle s'écrit).
   */
  journal: LigneDuJournal[];
  /**
   * ce que la `Suite` ajoute à l'écran (`ZonesDeLaSuite`) : sous `journal.lignes`, les lignes du journal en éléments
   * (`lignesDuJournal`, `src/hote/ecran.ts`), chacune son id (`journal/<n>`, numérotée à la suite de la partie) ; une
   * ligne par événement, les sous-lignes d'un événement à son `detail`, montré au survol ; son ton dit ce qu'il pèse
   * (le début d'un round en `alerte`, un Critique ou une mort en `echec` sur un héros, en `reussite` sur un
   * adversaire) ; un événement sans texte n'en écrit aucune. Chaque jour de jeu s'ouvre sur sa date
   * (`journal/jour/<jour>`, en `alerte` : « Festag · 30 Jahrdrung 2512 CI »), avant la première ligne écrite ce
   * jour-là, le premier jour de la partie compris. Godot les ajoute à la zone de même source.
   */
  zones: ZonesDeLaSuite;
  /**
   * ce que la partie donne à voir et à entendre, dans l'ordre où elle l'a joué (`effetsDeLAppel`,
   * `src/noyau/effetsDeLAppel.ts` : section « Effets »).
   */
  effets: Effet[];
}

/**
 * @contrat Monde
 * Ce qui nomme un morceau du volume ou une nappe dans un manifeste.
 */
interface EmpreinteDuMonde {
  /** Sa clé (`MorceauDuMonde.cle`, `NappeDuMonde.cle`). */
  cle: string;
  /** L'empreinte de son contenu : Godot garde le nœud posé tant qu'elle ne bouge pas. */
  empreinte: string;
}

/**
 * @contrat Monde
 * Le manifeste du volume du monde (`VolumeDuMonde`), sans géométrie : Godot demande à `morceaux` ceux dont
 * l'empreinte a bougé.
 */
interface ManifesteDuVolume {
  /** L'échelle de la scène, en mètres par case (`VolumeDuMonde.metresParCase`). */
  metresParCase: number;
  /** La hauteur (m) de la surface de chaque case, par couche (`VolumeDuMonde.hauteurs`). */
  hauteurs: VolumeDuMonde['hauteurs'];
  /** Chaque morceau du volume, sa clé et son empreinte, dans l'ordre du volume. */
  morceaux: EmpreinteDuMonde[];
}

/** Le manifeste du volume `v`. */
const manifesteDe = ({ metresParCase, hauteurs, morceaux }: VolumeDuMonde): ManifesteDuVolume => ({ metresParCase, hauteurs, morceaux: empreintesDe(morceaux) });

/** La clé et l'empreinte de chacun de `contenus`. */
const empreintesDe = (contenus: readonly EmpreinteDuMonde[]): EmpreinteDuMonde[] => contenus.map(({ cle, empreinte }) => ({ cle, empreinte }));

/** Ceux de `contenus()` dont la clé est dans `cles`, dans l'ordre de `contenus()` ; `contenus` n'est pas appelé si
 *  `cles` est vide. */
const parCles = <T extends EmpreinteDuMonde>(contenus: () => readonly T[], cles: readonly string[]): T[] => {
  if (!cles.length) return [];
  const voulues = new Set(cles);
  return contenus().filter(({ cle }) => voulues.has(cle));
};

/**
 * @contrat Monde
 * La réponse de `monde` : le manifeste du volume du monde de la scène en cours, de ses nappes de toit, de ses
 * couronnes crénelées, et sa météo sous le regard de la partie.
 */
export interface MondeDuPont {
  /** le manifeste du volume du monde de la scène en cours (`ManifesteDuVolume`), `null` sans scène. */
  monde: ManifesteDuVolume | null;
  /** la clé (`nappeKey`) et l'empreinte de chaque nappe de toit (`toitsDuMonde`), une par masse de bâtiment. */
  toits: EmpreinteDuMonde[];
  /**
   * la clé (`edgeKey`) et l'empreinte de chaque couronne crénelée (`couronnesDuMonde`), une par mur fortifié de chaque
   * couche.
   */
  couronnes: EmpreinteDuMonde[];
  /**
   * La météo (`meteoDuRegard`, `src/noyau/monde/meteo.ts`, `MeteoDuRegard`) est celle que la scène montre
   * (`sceneWeatherFx` : aucune en intérieur ni pour un id hors de `ambiance.json › iso.weather`), sous le regard de la
   * partie. Ce qui tombe (`pluie`, `null` sans `precip` en donnée et au plateau, où une particule vue dans l'axe de sa
   * chute n'est qu'un point) ne tombe qu'au-dessus des bandes de cases à ciel ouvert (`openSkyRuns`, la vérité d'abri
   * `shelterField`) : une averse par bande (`averses` : la boîte d'où partent ses particules, centre et demi-étendues
   * en mètres au plafond de la donnée au-dessus du sol le plus haut, et leur nombre, la densité de la donnée par m² de
   * sol, `MAX_PRECIP` au plus pour la scène), le sens unitaire de la chute vent compris et sa vitesse (m/s), la taille
   * d'une particule (m), le temps qu'elle met à tomber jusqu'au sol le plus bas (s), sa teinte et son opacité. Les
   * nappes de brume (`nappes`, en tactique seulement : vues d'en haut, elles s'empileraient en voile, et l'immersion
   * resserre la brume de profondeur, section « Lumière ») sont plates, une par couche de la donnée, au-dessus du sol le
   * plus bas et des seules bandes à ciel ouvert : leurs triangles en mètres, leur teinte, leur opacité. La météo de la
   * scène entre dans `plateau.cleDuMonde`.
   */
  meteo: MeteoDuRegard | null;
}

/**
 * @contrat Monde
 * La réponse de `morceaux` : la géométrie de chaque clé demandée, une clé absente de la scène omise.
 * Par `appeler`, ses tableaux en nombres.
 * Par `appelerEnOctets`, l'en-tête d'`enOctets` (`EnteteDesMorceaux`, `pont/octets.ts`) : ses tableaux en bornes.
 */
export interface MorceauxDuPont {
  /** les morceaux du volume demandés (`MorceauDuMonde`). */
  volume: MorceauDuMonde[];
  /**
   * les nappes de toit demandées (`NappeDuMonde`) : leurs pans de couverture (matière `roof--<id>`) et leurs pignons,
   * de la matière du mur qu'ils prolongent (`structure--<id>`, `closureAppearance`).
   */
  toits: NappeDuMonde[];
  /**
   * les couronnes crénelées demandées (`NappeDuMonde`), posées au sommet de la face pleine du mur dressé à leur pied
   * (`crownFaces`, `piedDeLArete`).
   */
  couronnes: NappeDuMonde[];
}

/** Par id, la case de chaque cible de `combat` (ses `cibles`, la cible de son aperçu), lue à `battle.combatants`
 *  (`VueDuPont.casesDesCibles`). */
export function casesDesCiblesDe(etat: Jeu, combat: Projection['combat']): VueDuPont['casesDesCibles'] {
  const vises = new Set([...(combat?.cibles.liste ?? []), combat?.apercu?.cible]);
  return Object.fromEntries((etat.battle?.combatants ?? []).flatMap((c) => (c.pos && vises.has(c.id) ? [[c.id, [c.pos.x, c.pos.y, c.pos.z ?? 0]]] : [])));
}

/** Le clic du champ sur le combattant `id`, comme Godot le joue (`combat.gd`) : le verbe de `champ`, la case où
 *  `occupants` le tient, puis l'id ; `null` quand le champ ne se clique pas ou que le combattant n'a pas de case. */
export function clicDuCombattant(vue: VueDuPont, id: string): { type: typeof CLIC_DU_CHAMP; args: [{ x: number; y: number; z?: number }, string] } | null {
  const cle = Object.keys(vue.occupants).find((k) => vue.occupants[k] === id);
  if (!vue.champ || !cle) return null;
  const [x, y, z] = cle.split(',').map(Number);
  return { type: vue.champ, args: [z ? { x, y, z } : { x, y }, id] };
}

/** L'événement du noyau qui demande la création d'un héros neuf (`EVT.HEROS_A_CREER`, `src/noyau/bus.ts`). */
const demandeUnHeros = (e: ResultatDeLAppel['evenements'][number]): boolean => e.type === 'emis' && e.evt === 'heros_a_creer';

/** La partie `partie` dont chaque résultat rendu passe d'abord à `verser` : tout résultat entre à la file au moment où
 *  il est rendu. */
const enFile = (partie: Partie, verser: (resultat: ResultatDeLAppel) => ResultatDeLAppel): Partie => ({
  etat: partie.etat,
  envoyer: (intention) => verser(partie.envoyer(intention)),
  lancer: (lancement) => verser(partie.lancer(lancement)),
  reprendre: (jeton) => verser(partie.reprendre(jeton)),
  abonner: partie.abonner,
  relever: () => verser(partie.relever()),
  recevoir: (instantane) => {
    const { neuve, autreScene, ...resultat } = partie.recevoir(instantane);
    return { ...verser(resultat), neuve, autreScene };
  },
  fermer: partie.fermer,
});

/** Godot dessine tout : aucune liste de la projection n'est bornée. */
export const SANS_BORNE: BornesDeLaProjection = { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity };

/** Les clés de l'entrée d'un geste : celles d'une suite, ou celles d'un verbe (`Geste`). */
const clesDuGeste = (e: Record<string, unknown>): readonly string[] => ('suite' in e ? ['suite'] : ['type', 'args', 'siege']);

/** La valeur de `lu`, le champ `champ` de l'entrée de `methode` lu par le noyau ; refusée en `validation`, chaque faute à
 *  son chemin. */
function valeurLue<T>(methode: string, champ: string, lu: LectureAuSchema<T>): T {
  if (lu.ok) return lu.valeur;
  throw new ErreurDeGeste('validation', `${methode} : ${champ}, ${lu.fautes.map(({ chemin, message }) => `${chemin.join('.') || '(racine)'} : ${message}`).join(' ; ')}`);
}

/** La composition `brut` de `methode`, lue par le noyau (`lireComposition`). */
const compositionDe = (methode: string, brut: unknown): Composition => valeurLue(methode, 'composition', lireComposition(brut));

/** L'entrée d'une méthode : l'objet JSON de `json` (aucune entrée, ou `null` : `{}`), dont chaque clé est l'une de ses
 *  `cles`. */
function entreeDe(methode: string, json: string | null | undefined, cles: readonly string[] | ((e: Record<string, unknown>) => readonly string[])): Record<string, unknown> {
  if (json == null) return {};
  let entree: unknown;
  try {
    entree = JSON.parse(json);
  } catch {
    throw new ErreurDeGeste('validation', `${methode} : entrée JSON illisible`);
  }
  valider(estObjet(entree), `${methode} : l’entrée est un objet JSON`);
  const e = entree as Record<string, unknown>;
  const admises = typeof cles === 'function' ? cles(e) : cles;
  const enTrop = Object.keys(e).filter((k) => !admises.includes(k));
  valider(!enTrop.length, `${methode} : ${enTrop.join(', ')} hors de l’entrée (${admises.length ? `clés : ${admises.join(', ')}` : 'aucune clé'})`);
  return e;
}

/** Le projet de la campagne `id` que porte `texte`, le texte que le dépôt sert (`servir.mjs`, `depot/<id>`) : du JSON,
 *  que la porte prouve (`projetDuDepot`), de cet `id`. */
function projetServi(id: string, texte: unknown): ProjectDoc {
  valider(typeof texte === 'string', 'editer : projet, le texte du projet que sert le dépôt');
  let lu: unknown;
  try {
    lu = JSON.parse(texte as string);
  } catch {
    throw new ErreurDeGeste('validation', 'editer : projet, JSON illisible');
  }
  const passe = projetDuDepot(lu);
  if (!passe.ok) throw new ErreurDeGeste('validation', `editer : ${passe.refus}`);
  valider(passe.valeur.id === id, `editer : projet, le projet ${passe.valeur.id} au lieu de ${id}`);
  return passe.valeur;
}

/** Les calques que l'hôte garde, lus de leur texte `texte` ; `null`, que la session tient pour d'un autre format, s'il
 *  n'est pas du JSON. */
function calquesGardes(texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
}

/** L'index des chapitres du `Source/` que porte `texte`, le texte que sert le poste (`servir.mjs`, `source/manifest.json`) :
 *  du JSON, par livre son sigle et ses chapitres, chacun sa graphie et son titre. */
function manifesteServi(texte: unknown): NonNullable<SessionDEdition['manifeste']> {
  valider(typeof texte === 'string', 'editer : manifeste, le texte de l’index des chapitres que sert le poste');
  let lu: unknown;
  try {
    lu = JSON.parse(texte as string);
  } catch {
    throw new ErreurDeGeste('validation', 'editer : manifeste, JSON illisible');
  }
  const chapitre = (c: unknown) => estObjet(c) && typeof c.ch === 'string' && typeof c.titre === 'string';
  const livre = (l: unknown) => estObjet(l) && typeof l.abbr === 'string' && Array.isArray(l.chapitres) && l.chapitres.every(chapitre);
  valider(estObjet(lu) && Object.values(lu).every(livre), 'editer : manifeste, par livre { abbr, chapitres: { ch, titre }[] }');
  return lu as NonNullable<SessionDEdition['manifeste']>;
}

/** Le pont sur le stockage `stockage` de son hôte (`null` : aucun, rien ne se sauvegarde) et sur son réseau `reseau`
 *  (`null` : aucun, aucun salon) : ses méthodes, chacune appelée par `appeler`. */
export function creerPont(stockage: Stockage | null, reseau: ReseauDuPont | null) {
  /** Les réglages du joueur reposés : ses préférences et ses règles maison persistées, que le scénario de test d'un
   *  `demarrer` ou la sauvegarde d'un `charger` remplacent en mémoire. */
  const reposerLesReglages = (): void => {
    chargerLesPreferences(stockage);
    reposerLesReglesMaison(stockage);
  };
  reposerLesReglages();
  /** Une partie que le pont tient (`tenir`) ; `miroir` : celle d'un invité assis, reflet de la partie de l'hôte. */
  type Tenue = PartieAuGroupe & { file: ResultatDeLAppel[]; aDire: boolean; miroir: boolean; graine: number; pas: number; lignes: number; jour: number | null; panneau: PanneauDeLHote; roster: RosterMontre; brouillons: number; regard: Regard };
  let ouverte: Tenue | null = null;
  /** La partie que le pont tient pendant qu'il rejoint un salon, avant que son joueur soit assis (méthode `salon`). */
  let jonction: Tenue | null = null;
  /** Les lignes des miroirs clos que `nouvelles` dira (`quittee`), le rang de la suivante et le jour dit
   *  (`lignesDuJournal`), `null` sans clôture à dire. */
  let quittee: { lignes: ZonesDeLaSuite['journal.lignes']; rang: number; jour: number | null } | null = null;
  /** Le service `persisterLeHeros` du pont : le héros déjà au roster de son stockage y est mis à jour (#3041). */
  const persisterLeHeros = (hero: Combatant): void => mettreAJourLeRoster(stockage, hero);
  /** Le numéro du premier jeton de la prochaine partie : celui qui suit le dernier de la partie quittée (`quitter`). */
  let premierJeton = 0;
  const erreurs: ErreurGlobale[] = [];
  /** La levée `erreur` du réseau, hors d'un appel de Godot, dite à `erreurs` ; ne lève pas. */
  const dire = (erreur: unknown): void => {
    erreurs.push({ message: erreur instanceof Error ? erreur.message : String(erreur), source: 'reseau' });
  };
  /** `f`, dont la levée est dite (`dire`). */
  const enrobee = <A extends unknown[]>(f: (...a: A) => void) => (...a: A): void => {
    try {
      f(...a);
    } catch (erreur) {
      dire(erreur);
    }
  };
  /** L'écouteur `f` enrobé, `null` sans lui. */
  const ecouteurEnrobe = <A extends unknown[]>(f: ((...a: A) => void) | null) => f && enrobee(f);
  /** La socket `ws` du réseau, dont chaque écouteur posé est enrobé ; `bufferedAmount` relu, `send` et `close` délégués. */
  const socketEnrobee = (ws: SocketLike): SocketLike => ({
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    get bufferedAmount() { return ws.bufferedAmount; },
    get onopen() { return ws.onopen; },
    set onopen(f: SocketLike['onopen']) { ws.onopen = ecouteurEnrobe(f); },
    get onmessage() { return ws.onmessage; },
    set onmessage(f: SocketLike['onmessage']) { ws.onmessage = ecouteurEnrobe(f); },
    get onclose() { return ws.onclose; },
    set onclose(f: SocketLike['onclose']) { ws.onclose = ecouteurEnrobe(f); },
    get onerror() { return ws.onerror; },
    set onerror(f: SocketLike['onerror']) { ws.onerror = ecouteurEnrobe(f); },
  });
  /** Le salon du pont, sur les ports de `reseau` enrobés et sur la partie ouverte ; aucun sans réseau. */
  const salon = reseau && creerLeSalon({
    ...reseau,
    socket: (url) => socketEnrobee(reseau.socket(url)),
    minuterie: { programmer: (suite, delai) => reseau.minuterie.programmer(enrobee(suite), delai) },
    panne: dire,
    abonner: (ecouteur) => demarree().partie.abonner(ecouteur),
  });
  /** L'ouverture du salon que le pont tient, hors de la partie. */
  let ouverture: OuvertureDuSalon = null;
  /** Pose l'ouverture `o`, et lève le drapeau de la partie ouverte. */
  const poserLOuverture = (o: OuvertureDuSalon): void => {
    ouverture = o;
    if (ouverte) ouverte.aDire = true;
  };
  /** Les manifestes et les modèles du dernier `modeles`, que `composer` et les corps de la vue lisent. */
  let modeles: { manifestes: Record<string, unknown>; modeles: ModelesDeLAtelier } | null = null;
  /** La session de l'éditeur de carte (`editer`), et la scène et la couche du dernier monde qu'elle a rendu. */
  let edition: { session: SessionDEdition; monde: { vue: Scene; z: number } } | null = null;
  /** Ce qui construit le lancement de la dernière scène mise à l'essai par l'éditeur, que `demarrer { essai }` ouvre. */
  let essai: Parameters<typeof ouvrirLeLancement>[1] | null = null;

  const demarree = () => {
    if (!ouverte) throw new ErreurDeGeste('validation', 'aucune partie : demarrer ou ouvrir d’abord');
    return ouverte;
  };

  /** Refuse `methode`, qui ouvre une partie, quand une partie est ouverte ou qu'un salon se rejoint. */
  const sansPartie = (methode: string): void => {
    valider(!ouverte, `${methode} : une partie est ouverte ; quitter d’abord`);
    valider(!jonction, `${methode} : un salon se rejoint ; quitter le salon d’abord`);
  };

  /** Par id de son entité, chaque navire de `scene` dont un élément `vehicule` est servi (`NavireServi`) : le jeu et
   *  l'éditeur les montrent tous deux. */
  const naviresServis = (scene: Scene): Record<string, NavireServi> => Object.fromEntries(naviresDeLaScene(scene).flatMap(({ id, vehicule, centre }) => {
    const corps = modeles && corpsDuVehicule(vehicule, modeles);
    if (!modeles || !corps) return [];
    const manifeste = modeles.manifestes[corps.element];
    const emprises = estObjet(manifeste) && estObjet(manifeste.cases) ? manifeste.cases as EmprisesDesCases : {};
    return [[id, { corps, centre, stations: stationsDuNavire(scene, id, emprises) }]];
  }));

  /** Les corps des combattants dessinés de `projection`, puis des héros du groupe de `etat` qu'elle ne dessine pas, chacun
   *  sa portée composée sur l'unique base servie, leurs véhicules servis, hors des navires de la scène, et les navires
   *  servis de la scène. */
  const corpsDe = (projection: Projection, etat: Jeu): CorpsDuCombat => {
    const { scene } = etat;
    const dessines = projection.combat?.voisins.liste ?? projection.exploration?.heros ?? [];
    const portees = [
      ...dessines.map(({ id, portee }) => ({ id, portee })),
      ...etat.party.filter((h) => !dessines.some((d) => d.id === h.id)).map((h) => ({ id: h.id, portee: porteeDuCombattant(h) })),
    ];
    const navires = scene ? naviresDeLaScene(scene) : [];
    const bases = modeles?.modeles.bases ?? [];
    const refus = !modeles
      ? '[sans-modeles] aucun modeles appelé'
      : bases.length !== 1 ? `[base-ambigue] ${bases.length} base(s) servie(s)${bases.length ? ` (${bases.map((b) => b.id).join(', ')})` : ''}, une attendue` : null;
    const base = refus === null ? bases[0] : null;
    return {
      refus,
      combattants: Object.fromEntries(portees.map(({ id, portee }) => [id, base && portee ? { base: base.id, ...composerSurLaBase(base, modeles!.manifestes, portee) } : null])),
      vehicules: Object.fromEntries(dessines.flatMap(({ id, vehicule }) => {
        const corps = vehicule && modeles && !navires.some((n) => n.id === id) && corpsDuVehicule(vehicule, modeles);
        return corps ? [[id, corps]] : [];
      })),
      navires: scene ? naviresServis(scene) : {},
    };
  };

  const vueDe = (o: Tenue): VueDuPont => {
    const etat = o.partie.etat();
    const projection = projeter(etat, o.pas, o.lignes, SANS_BORNE);
    const combat = projection.combat;
    const fenetre = fenetreADessiner(etat);
    return {
      projection,
      corps: corpsDe(projection, etat),
      disposition: fenetre?.disposition ?? null,
      zones: zonesDeLEcran(etat, projection, fenetre, o.panneau, o.roster),
      cases: casesAtteignables(etat),
      plateau: etat.scene ? plateauDeLaScene(etat.scene, casesDuGroupe(etat), regardDuJeu(o.regard, !!etat.battle)) : null,
      lumiere: etat.scene ? lumiereDeLaScene({ ...etat, scene: etat.scene }, regardDuJeu(o.regard, !!etat.battle)) : null,
      musique: musiqueDeLaPartie(etat),
      zonesQuiDurent: zonesQuiDurentEnVue(etat),
      marques: Object.fromEntries((combat?.voisins.liste ?? projection.exploration?.heros ?? []).map((c) => [c.id, marquesDesEtats(c.etats)])),
      champ: (combat ? combat.barre.forme === 'ouverte' : projection.exploration && !fenetre) ? CLIC_DU_CHAMP : null,
      occupants: Object.fromEntries((etat.battle?.combatants ?? []).flatMap((c) => (c.pos && !horsCombat(c) ? [[`${c.pos.x},${c.pos.y},${c.pos.z ?? 0}`, c.id]] : []))),
      casesDesCibles: casesDesCiblesDe(etat, combat),
      vision: etat.scene ? cleDeLaVision({ ...etat, scene: etat.scene }) : null,
    };
  };

  /** La création que le panneau ouvert tient, `null` sous un autre panneau ou sans panneau. */
  const creationOuverte = (o: Tenue): CreationOuverte | null => (o.panneau && 'creation' in o.panneau ? o.panneau.creation : null);

  /**
   * @contrat Méthodes
   * La fiche est un état du pont, jamais de la partie : aucun verbe ne l'ouvre ni ne la ferme. Elle reste ouverte, à sa
   * possession choisie, tant qu'aucun `fiche` ne la change, la partie avançant ; sans son combattant, ses zones sont
   * vides ; une possession choisie qui quitte la fiche (donnée, consommée) n'est plus dite. Les gestes d'une
   * possession, eux, sont des verbes de la partie, joués par `jouer`.
   */
  /** Le panneau `cle` fermé : sans panneau s'il est celui ouvert, l'autre panneau laissé ouvert sinon. */
  const fermerLePanneau = (o: Tenue, cle: 'fiche' | 'creation'): void => {
    if (o.panneau && cle in o.panneau) o.panneau = null;
  };

  /**
   * @contrat Méthodes
   * La création d'un héros est un état du pont aussi (`CreationOuverte` : un brouillon du noyau et sa page ouverte),
   * qu'aucun verbe n'ouvre ni ne ferme. `{ geste: 'ouvrir' }` l'ouvre sur un brouillon neuf, dont la graine dérive de
   * celle de la partie et du rang de la création (`brouillonDeLaPartie`), à sa première page, et ferme la fiche
   * (`PanneauDeLHote`, `src/hote/elements.ts` : la fiche ou la création, une seule à la fois) ; un appel dont le noyau
   * émet `heros_a_creer` (l'Effet de scène `openCharacterCreator`) l'ouvre de même, sauf si une création est déjà
   * ouverte ; ouvrir la fiche la ferme. Chaque geste se joue tel qu'un bouton de l'écran l'offre (égal en profondeur),
   * et ce bouton refusé se refuse avec sa raison : `{ geste: 'page' }` va à une page (`pagesDeCreation`), la suivante
   * tant que la page ouverte ne se quitte pas (`refusDeLaPage`) ; un geste du brouillon (`GesteDuBrouillon`, surface du
   * noyau) le change, chaque tirage aux dés de la graine du brouillon, son résultat dit seulement après le geste ;
   * `{ geste: 'engager' }`, à la dernière page, écrit l'entrée du héros au roster de l'hôte, sous un id de son
   * entropie (`engagerLeHeros`, `src/hote/roster.ts`), envoie l'intention qui engage le brouillon au groupe sous cet
   * id, où le noyau bâtit le héros et crédite sa Richesse de départ, puis ferme la création. Seul l'engagement touche
   * la partie.
   */
  /** Ouvre la création sur un brouillon neuf, à sa première page, à la place du panneau ouvert. */
  const ouvrirLaCreation = (o: Tenue): void => {
    o.panneau = { creation: { brouillon: brouillonDeLaPartie(o.graine, o.brouillons++), page: pagesDeCreation()[0] } };
  };

  /** La partie `o` écrite à l'emplacement `slot` du stockage, datée de l'heure réelle, ses règles maison en vigueur
   *  comprises ; si sa relecture la confirme. */
  const sauver = (o: Tenue, slot: AnySlot): boolean => ecrireLaSauvegarde(stockage, slot, snapshotSave(o.partie.etat(), new Date().toISOString(), ruleOverrides()));

  /** Le point de reprise de `o` gardé à l'emplacement automatique, quand le noyau le dit à garder
   *  (`pointDeRepriseAGarder`). */
  const garderLePointDeReprise = (o: Tenue): void => {
    const etat = o.partie.etat();
    if (pointDeRepriseAGarder(etat, etat.net.mySeat)) sauver(o, AUTO_SLOT);
  };

  /** La suite de tout ce que la file de `o` tient, la partie relevée d'abord, qu'elle vide, le drapeau `aDire`
   *  baissé : ses jetons numérotés résultat par résultat, ses
   *  événements et son journal joints dans l'ordre de la file ; un héros neuf demandé (`demandeUnHeros`) ouvre la
   *  création, sauf déjà ouverte ; un point de reprise posé (`estUnPointDeReprise`, surface du noyau) se garde
   *  (`garderLePointDeReprise`). Seul constructeur d'une `Suite`. */
  const suite = (o: Tenue): Suite => {
    o.partie.relever();
    const resultats = o.file.splice(0);
    const programmes = resultats.flatMap((r) => o.jetons.programmes(r));
    const evenements = resultats.flatMap((r) => r.evenements);
    const journal = resultats.flatMap((r) => r.journal);
    if (!creationOuverte(o) && evenements.some(demandeUnHeros)) ouvrirLaCreation(o);
    if (evenements.some(estUnPointDeReprise)) garderLePointDeReprise(o);
    const { lignes, jour } = lignesDuJournal(o.partie.etat(), o.lignes, journal, o.jour);
    const zones = { 'journal.lignes': lignes };
    o.lignes += journal.length;
    o.jour = jour;
    const rendue = { vue: vueDe(o), programmes, journal, zones, effets: effetsDeLAppel(o.partie.etat(), evenements) };
    o.aDire = false;
    return rendue;
  };

  /** La partie `o` fermée, ni ouverte ni en jonction : le numéro du prochain jeton gardé. */
  const fermerLaPartie = (o: Tenue): void => {
    premierJeton = o.jetons.suivant();
    o.partie.fermer();
    if (ouverte === o) ouverte = null;
    if (jonction === o) jonction = null;
  };

  /** La clôture du miroir ou de la jonction `o`, son salon quitté : la partie fermée (`fermerLaPartie`), les réglages
   *  du joueur reposés ; dite (`dite`), la partie relevée d'abord, ce que sa file tenait en lignes du journal
   *  (`lignesDuJournal`) s'ajoute à `quittee`, à la suite de ses lignes pendantes. Rien ne se sauvegarde. */
  const clore = (o: Tenue, dite: boolean): void => {
    if (dite) {
      o.partie.relever();
      const journal = o.file.splice(0).flatMap((r) => r.journal);
      const avant = quittee ?? { lignes: [], rang: o.lignes, jour: o.jour };
      const { lignes, jour } = lignesDuJournal(o.partie.etat(), avant.rang, journal, avant.jour);
      quittee = { lignes: [...avant.lignes, ...lignes], rang: avant.rang + journal.length, jour };
    }
    fermerLaPartie(o);
    reposerLesReglages();
  };

  /** Un geste joué : un verbe et ses arguments, celui qu'une offre déclare compris. Le refus que le verbe dit (`refus`,
   *  celui de son geste, `refusDuGeste` pour un verbe de la barre) est une erreur de règle, avec sa raison. */
  const jouerUnGeste = (o: Tenue, e: Record<string, unknown>): void => {
    const etat = o.partie.etat();
    const intention = intentionDuGeste(etat, gesteDuVerbe(etat, e as { type: unknown }, SANS_PISTE));
    const refusAvant = etat.refus;
    envoyerLIntention(o.partie, intention);
    const refus = o.partie.etat().refus;
    if (refus && refus !== refusAvant) throw new ErreurDeGeste('regle', `${intention.type} : ${refus.texte}`);
    o.pas++;
  };

  /**
   * @contrat Méthodes
   * Le roster de l'hôte, les héros que le joueur a créés, vit dans le stockage du pont et traverse les parties. Tant
   * que le groupe de la partie se compose, le pont le montre (zones `groupe.roster` et `groupe.avis`), relu du
   * stockage à l'ouverture de la partie et après chaque geste qui l'écrit ; ce que son chargement retire se dit
   * jusqu'au lancement. En partie, le héros du roster que le noyau persiste (`persisterLeHeros`) y est mis à jour.
   */
  /** Le roster que `o` montre, relu du stockage tant que son groupe se compose ; aucun, la partie en cours. */
  const relireLeRoster = (o: Tenue): Tenue => {
    o.roster = partieEnCours(o.partie.etat()) ? SANS_ROSTER : rosterAMontrer(stockage, o.roster.avis);
    return o;
  };

  /** La graine des dés d'une partie du jeu : celle de l'entrée `e`, sinon tirée de l'entropie de l'hôte. */
  const graineDUnePartieDuJeu = (e: Record<string, unknown>): number => (e.graine as number | undefined) ?? graineDEntropie();
  /** La partie `o` devenue celle du pont, à la graine `graine` : son pas, son journal, son panneau et son regard à
   *  leur départ ; sa file tient son lancement, quand elle en a un, puis chaque résultat que sa partie (`enFile`) ou la
   *  reprise d'un jeton rend et qui porte un événement ou une ligne ; son drapeau `aDire` se lève à chaque écriture de
   *  son état. L'appelant la pose (`ouverte`, `jonction`). */
  const tenir = (o: PartieAuGroupe & { lancement?: ResultatDeLAppel }, graine: number): Tenue => {
    const file: ResultatDeLAppel[] = o.lancement ? [o.lancement] : [];
    const verser = (resultat: ResultatDeLAppel): ResultatDeLAppel => {
      if (resultat.evenements.length || resultat.journal.length) file.push(resultat);
      return resultat;
    };
    const jetons = { ...o.jetons, reprendre: (id: number) => verser(o.jetons.reprendre(id)) };
    const tenue: Tenue = { partie: enFile(o.partie, verser), jetons, file, aDire: false, miroir: false, graine, pas: 0, lignes: 0, jour: null, panneau: null, roster: SANS_ROSTER, brouillons: 0, regard: 'tactique' };
    tenue.partie.abonner(() => { tenue.aDire = true; });
    return relireLeRoster(tenue);
  };

  const methodes: Record<string, (json?: string | null) => object> = {
    /**
     * aucune
     *
     * @returns `{ zones }` : la zone de l'accueil (`ZonesDeLAccueil`, `src/hote/accueil.ts`), les entrées de l'hôte
     * avant toute partie.
     */
    accueil(json) {
      entreeDe('accueil', json, []);
      return { zones: zonesDeLAccueil(stockage) };
    },
    /**
     * `{ scenario, graine? }` : l'id d'un scénario de test du catalogue (`testScenarios`), la graine des dés (entier, 1
     * par défaut) ; ou `{ essai: true, graine? }` : la dernière scène que l'éditeur a mise à l'essai (section
     * « Éditeur »), refusé sans elle
     *
     * @returns une `Suite` : le lancement du scénario, ou de l'essai
     */
    demarrer(json) {
      const e = entreeDe('demarrer', json, (e) => ('essai' in e ? ['essai', 'graine'] : ['scenario', 'graine']));
      sansPartie('demarrer');
      if ('essai' in e) {
        valider(e.essai === true && essai, 'demarrer : essai, aucune scène mise à l’essai par editer');
        const entrees = nouvellesEntrees({ graine: e.graine as number | undefined });
        const o = ouvrirLeLancement(entrees, essai!, persisterLeHeros, premierJeton);
        return suite((ouverte = tenir(o, entrees.graine)));
      }
      valider(typeof e.scenario === 'string', 'demarrer : scenario, l’id d’un scénario de test');
      const entete = nouvelEntete(e.scenario as string, { graine: e.graine as number | undefined });
      const o = ouvrirLaPartie(entete, persisterLeHeros, premierJeton);
      return suite((ouverte = tenir(o, entete.graine)));
    },
    /**
     * `{ graine? }` : la graine des dés (entier ; sans elle, tirée de l'entropie de l'hôte, `graineDEntropie`)
     *
     * @returns une `Suite` : la partie ouverte au groupe, sans scène ni lancement. Son groupe se
     * compose par les verbes du noyau que portent les zones `groupe.pretires` et `groupe.heros` (`jouer`), par le
     * roster de l'hôte (`roster`) et par la création d'un héros (`creation`) ; `lancer` la lance. Elle s'ouvre aux
     * règles maison, à la cadence et aux dés fixés en vigueur (`reglages`). Refusé quand une partie est ouverte.
     */
    ouvrir(json) {
      const e = entreeDe('ouvrir', json, ['graine']);
      sansPartie('ouvrir');
      reposerLesReglages();
      const entrees = entreesDuJeu(graineDUnePartieDuJeu(e));
      return suite((ouverte = tenir(ouvrirAuGroupe(entrees, persisterLeHeros, premierJeton), entrees.graine)));
    },
    /**
     * `{ lancer }` : l'id d'une campagne du jeu, le `jeu` d'un bouton de la zone `groupe.campagnes`
     *
     * @returns une `Suite` : le lancement de la campagne par le groupe composé (`lancementDeLaCampagne`,
     * `src/scenes/campaign.ts`), sur la séquence unique du lancement, à sa scène d'entrée. Refusé (`validation`) sans
     * partie ouverte, sur un id qui n'est celui d'aucune campagne du jeu, ou quand la partie est déjà en cours
     * (`partieEnCours`, surface du noyau) ; refusé (`regle`) avec la raison du noyau quand le groupe ne se lance pas
     * (`refusDeLancer`).
     */
    lancer(json) {
      const o = demarree();
      const e = entreeDe('lancer', json, ['lancer']);
      const campagne = allBuiltinCampaigns.find((c) => c.id === e.lancer);
      valider(campagne, `lancer : lancer, l’id d’une campagne du jeu (${allBuiltinCampaigns.map((c) => c.id).join(', ')})`);
      const etat = o.partie.etat();
      valider(!partieEnCours(etat), 'lancer : la partie est déjà en cours ; quitter, puis ouvrir, pour en lancer une autre');
      const refus = refusDeLancer(etat);
      if (refus) throw new ErreurDeGeste('regle', `lancer : ${refus}`);
      o.partie.lancer(lancementDeLaCampagne(campagneDuJeu(campagne!), etat.party));
      o.pas++;
      return suite(o);
    },
    /**
     * aucune (le `jeu` `{ quitter: true }` du bouton de la zone `partie.gestes` la désigne à l'hôte)
     *
     * @returns rien : la partie ouverte est fermée, son point de reprise gardé à l'emplacement automatique quand le
     * noyau le dit à garder (`pointDeRepriseAGarder` : une campagne lancée, hors combat), ses jetons en attente perdus
     * (un jeton rendu après elle se refuse, `jeton inconnu`, aucun numéro ne resservant sous ce pont), ce que sa file
     * tenait encore perdu avec eux (section « Suite ») ; `ouvrir`,
     * `charger` ou `demarrer` en ouvre une autre. Les modèles servis, la carte ouverte par `editer` et la scène mise à
     * l'essai restent. Son salon est quitté (méthode `salon`) avant qu'elle ne se ferme. Le miroir d'un invité se ferme
     * sans point de reprise, ses réglages reposés, sans `quittee`. Refusé sans partie ouverte.
     */
    quitter(json) {
      entreeDe('quitter', json, []);
      const o = demarree();
      if (!o.miroir) garderLePointDeReprise(o);
      if (salon) {
        poserLOuverture(null);
        salon.quitter(o.partie.etat);
      }
      if (o.miroir) clore(o, false);
      else fermerLaPartie(o);
      return {};
    },
    /**
     * aucune
     *
     * @returns `{ zones }` : les zones des sauvegardes (`ZonesDesSauvegardes`, `src/hote/sauvegardes.ts`), avec ou sans
     * partie ouverte : chaque emplacement du stockage de l'hôte, l'automatique d'abord, « Charger » sur ceux qui
     * portent une sauvegarde, « Sauvegarder » sur les emplacements manuels quand une partie est ouverte. Une
     * sauvegarde d'un autre format ou illisible est retirée du stockage à cette lecture, et dite une fois
     * (`sauvegardes.avis`)
     */
    sauvegardes(json) {
      entreeDe('sauvegardes', json, []);
      return { zones: zonesDesSauvegardes(stockage, ouverte?.partie.etat() ?? null) };
    },
    /**
     * `{ sauvegarder }` : un emplacement manuel (1, 2 ou 3), le `jeu` d'un bouton de la zone `sauvegardes.emplacements`
     *
     * @returns `{ zones }` : les zones des sauvegardes relues, la partie ouverte écrite à l'emplacement (son état de
     * jeu et ses règles maison, `snapshotSave`, surface du noyau). Refusé (`validation`) sans partie ouverte ou sur un
     * autre emplacement ; refusé (`regle`) avec la raison du noyau (`refusDeSauvegarde` : en combat), ou quand le
     * stockage ne garde pas l'écriture (absent, plein).
     */
    sauvegarder(json) {
      const o = demarree();
      const e = entreeDe('sauvegarder', json, ['sauvegarder']);
      valider(SAVE_SLOTS.includes(e.sauvegarder as SaveSlot), `sauvegarder : sauvegarder, un emplacement manuel (${SAVE_SLOTS.join(', ')})`);
      const etat = o.partie.etat();
      const refus = refusDeSauvegarde(etat, etat.net.mySeat);
      if (refus) throw new ErreurDeGeste('regle', `sauvegarder : ${t(MESSAGE_DU_REFUS[refus])}`);
      if (!sauver(o, e.sauvegarder as SaveSlot)) throw new ErreurDeGeste('regle', `sauvegarder : ${t('store.saveKo')}`);
      return { zones: zonesDesSauvegardes(stockage, etat) };
    },
    /**
     * `{ charger, graine? }` : un emplacement (`auto`, 1, 2 ou 3), le `jeu` d'un bouton de la zone
     * `sauvegardes.emplacements`, et la graine des dés (entier ; sans elle, tirée de l'entropie de l'hôte)
     *
     * @returns une `Suite`, la partie ouverte sur la sauvegarde de l'emplacement (`chargerLaSave`, surface du noyau),
     * ses règles maison posées ; son `journal` dit ce que cette version du jeu ne connaît plus et que le chargement a
     * retiré. Refusé (`validation`) quand une partie est ouverte, sur un emplacement inconnu, vide, ou
     * dont la sauvegarde est d'un autre format ou illisible (retirée du stockage).
     */
    charger(json) {
      const e = entreeDe('charger', json, ['charger', 'graine']);
      sansPartie('charger');
      const slot = [AUTO_SLOT, ...SAVE_SLOTS].find((s) => s === e.charger);
      valider(slot !== undefined, `charger : charger, un emplacement (${[AUTO_SLOT, ...SAVE_SLOTS].join(', ')})`);
      const save = lireLaSauvegarde(stockage, slot!);
      valider(save, `charger : ${nomDEmplacement(slot!)}, ${t('saveload.error.load')}`);
      const { etat, regles, retraits } = chargerLaSave(save!);
      reposerLesReglages();
      const entrees = entreesDuJeu(graineDUnePartieDuJeu(e), regles);
      const o = (ouverte = tenir(ouvrirAuGroupe(entrees, persisterLeHeros, premierJeton, etat), entrees.graine));
      if (retraits) o.file.push({ issue: 'appliquee', evenements: [], journal: [{ de: 'journal', texte: t('saveload.elague', { liste: nommerLesRetraits(retraits) }), heure: etat.gameTime }] });
      return suite(o);
    },
    /**
     * aucune
     *
     * @returns `{ zones: { 'scenarios.sections' } }` : le choix d'un scénario de test (`zonesDesScenarios`,
     * `src/hote/scenarios.ts`), avant ou après `demarrer` : une entité par section du catalogue (`SCENARIO_SECTIONS`)
     * qui en range un, chacun de ses scénarios en entité, son titre au nom, ce qu'il vérifie, son groupe et le bouton
     * qui le démarre, dont le `jeu` `{ scenario }` porte l'id que `demarrer` reçoit
     */
    scenarios(json) {
      entreeDe('scenarios', json, []);
      return { zones: zonesDesScenarios() };
    },
    /**
     * aucune
     *
     * @returns `{ vue }`
     */
    vue(json) {
      entreeDe('vue', json, []);
      return { vue: vueDe(demarree()) };
    },
    /**
     * aucune
     *
     * @returns `{ monde, toits, couronnes, meteo }` (`MondeDuPont`) : le manifeste du volume du monde de la scène en
     * cours (section « Monde »), `null` sans scène, les clés et empreintes de ses nappes de toit et de ses couronnes
     * crénelées, vides sans scène, et la météo que le regard montre (`meteoDuRegard`), `null` sans scène ou sans météo
     * à montrer ; à rappeler quand la scène ou `plateau.cleDuMonde` change
     */
    monde(json): MondeDuPont {
      entreeDe('monde', json, []);
      const o = demarree();
      const etat = o.partie.etat();
      const scene = etat.scene;
      if (!scene) return { monde: null, toits: [], couronnes: [], meteo: null };
      return { monde: manifesteDe(volumeDuMonde(scene)), toits: empreintesDe(toitsDuMonde(scene)), couronnes: empreintesDe(couronnesDuMonde(scene)), meteo: meteoDuRegard(scene, regardDuJeu(o.regard, !!etat.battle)) };
    },
    /**
     * `{ source, volume, toits, couronnes }` : `partie` (la scène de la partie) ou `edition` (celle du dernier
     * manifeste que `editer` a rendu, ses navires posés), puis les clés demandées des morceaux du volume, des nappes de
     * toit et des couronnes crénelées
     *
     * @returns `{ volume, toits, couronnes }` (`MorceauxDuPont`) : la géométrie de chaque clé demandée, dans l'ordre du
     * manifeste, une clé absente de la scène omise ; une liste de clés vide rend un tableau vide sans rien calculer ;
     * refusé sans scène de la partie (`partie`) ou sans carte ouverte (`edition`).
     * Par `appelerEnOctets`, l'en-tête d'`enOctets` : chaque tableau en `[debut, fin]` dans `octets()`.
     */
    morceaux(json): MorceauxDuPont {
      const e = entreeDe('morceaux', json, ['source', 'volume', 'toits', 'couronnes']);
      valider(e.source === 'partie' || e.source === 'edition', 'morceaux : source, partie ou edition');
      for (const champ of ['volume', 'toits', 'couronnes']) valider(estListeDeChaines(e[champ]), `morceaux : ${champ}, une liste de clés`);
      let scene: Scene | null;
      if (e.source === 'partie') scene = demarree().partie.etat().scene;
      else {
        valider(edition !== null, 'morceaux : aucune carte ouverte, editer { ouvrir } d’abord');
        scene = edition!.monde.vue;
      }
      valider(scene, 'morceaux : aucune scène');
      return {
        volume: parCles(() => volumeDuMonde(scene!).morceaux, e.volume as string[]),
        toits: parCles(() => toitsDuMonde(scene!), e.toits as string[]),
        couronnes: parCles(() => couronnesDuMonde(scene!), e.couronnes as string[]),
      };
    },
    /**
     * aucune
     *
     * @returns `{ masque, largeur, rangees }` (`RetraitDuMonde`, section « Monde ») : ce que le regard de la partie
     * retire du volume du monde pour le groupe (`masqueDuRegard`, section « Vue ») ; refusé sans scène ; à rappeler
     * quand `plateau.cleDuRetrait` change
     */
    retrait(json): RetraitDuMonde {
      entreeDe('retrait', json, []);
      const o = demarree();
      const etat = o.partie.etat();
      valider(etat.scene, 'retrait : aucune scène');
      return masqueDuRegard(etat.scene!, casesDuGroupe(etat), regardDuJeu(o.regard, !!etat.battle));
    },
    /**
     * aucune
     *
     * @returns `{ masque, largeur, rangees, rangeesParPlan, teintes }` (`VisionDuMonde`, section « Monde ») : ce que
     * le groupe connaît de chaque case de la scène (`visionDuMonde`) ; refusé sans scène ; à rappeler quand
     * `vue.vision` change
     */
    vision(json): VisionDuMonde {
      entreeDe('vision', json, []);
      const etat = demarree().partie.etat();
      valider(etat.scene, 'vision : aucune scène');
      return visionDuMonde({ ...etat, scene: etat.scene! });
    },
    /**
     * aucune
     *
     * @returns `{ aretes }` : les arêtes de toutes les couches de la scène en cours hors des ponts de ses navires, que
     * la marche garde et que le modèle du navire montre (`aretesDeLaScene`, `src/noyau/monde/aretes.ts`), vides sans
     * scène ; à rappeler quand `plateau.cleDesAretes` change. Chacune (`areteDessinee`) : `{ cle, cases, milieu, sens,
     * pied, piece, famille, hauteurM, bloc }`, sa clé `edgeKey`, les cases `{ x, y, z }` qu'elle sépare, dans la carte, à
     * sa couche (`casesDeFace`, une ou deux : celle dont elle borde un côté, puis sa voisine), son milieu et le sens où
     * elle court, en coins de grille (`wallEnds`) ; la hauteur en mètres d'où elle se dresse, celle de la plus basse des
     * deux cases qu'elle sépare (`piedDeLArete`, `src/noyau/monde/scene.ts`) ; sa pièce : une porte en jeu fermée ou
     * ouverte, la brèche d'une structure abattue, une fenêtre aux volets ouverts ou clos, sinon un mur ; la famille du
     * kit de son apparence (`kit` de `structureAppearance.json`, l'apparence étant celle du mur de la façade authorée
     * qui régit l'arête, sinon celle du segment : `apparenceDArete`, `src/noyau/monde/facades/`), `null` pour une
     * apparence hors du catalogue ; la hauteur de son mur en mètres, `wallHeightM` sinon un étage ; son bloc
     * `<z>/<bx>/<by>`, celui de sa case à sa couche (`blocDeLaCase`, `src/noyau/monde/volume/volume.ts`)
     */
    aretes(json): { aretes: AreteDessinee[] } {
      entreeDe('aretes', json, []);
      const scene = demarree().partie.etat().scene;
      return { aretes: scene ? aretesDeLaScene(scene) : [] };
    },
    /**
     * un geste : `{ type, args?, siege? }` (un verbe de la partie, ses arguments, le siège qui le joue ; une offre se
     * joue par le verbe qu'elle déclare, `jeu` de son bouton) ou `{ suite }` (les verbes `{ type, args? }` d'un geste
     * d'exploration, joués dans l'ordre tant qu'aucune fenêtre ne tient la main)
     *
     * @returns une `Suite` ; pour `suite`, les jetons, le journal et les effets de chaque verbe joué, dans l'ordre
     */
    jouer(json) {
      const o = demarree();
      const e = entreeDe('jouer', json, clesDuGeste);
      if (!('suite' in e)) {
        jouerUnGeste(o, e);
        return suite(o);
      }
      valider(Array.isArray(e.suite) && e.suite.length > 0 && e.suite.every(estObjet), 'jouer : suite, une liste non vide de verbes { type, args }');
      const [premier, ...reste] = e.suite as Record<string, unknown>[];
      jouerUnGeste(o, premier);
      for (const g of reste) {
        if (fenetreADessiner(o.partie.etat())) break;
        jouerUnGeste(o, g);
      }
      return suite(o);
    },
    /**
     * `{ z?, oeil? }` : une couche de la scène (celle de `oeil`, sinon celle du groupe, sans elle) et l'œil d'une
     * caméra, `{ case: [x, y, z], lacet }` (la case et l'azimut, en degrés au compas, de la caméra que rend
     * `wfrpCadrer`, section « Écran publié »)
     *
     * @returns `{ plan }` : le plan de la couche en texte (`planDeLaCouche`, `src/noyau/monde/sceneToAscii.ts`), la
     * grille box-drawing de `sceneToAscii` (`GRAMMAIRE_ASCII`, `src/data/schemas/grammaire/carte-ascii.ts`), ponts
     * des navires compris, chaque case qui porte une marque sous elle (`MARQUES_DU_PLAN` : l'œil au cap le plus proche
     * de son azimut, s'il est sur la couche, les héros du groupe, les autres personnages, les décors à leur case
     * d'ancrage), puis la légende des glyphes que ses cases montrent ; refusé hors scène ou hors de ses couches. La
     * partie n'en change pas.
     */
    plan(json) {
      const o = demarree();
      const e = entreeDe('plan', json, ['z', 'oeil']);
      const etat = o.partie.etat();
      const scene = etat.scene;
      valider(scene, 'plan : aucune scène');
      const lu = e.oeil as { case?: unknown; lacet?: unknown } | undefined;
      valider(lu === undefined || (estObjet(lu) && Object.keys(lu).every((k) => k === 'case' || k === 'lacet') && Array.isArray(lu.case) && lu.case.length === 3
        && lu.case.every(Number.isInteger) && typeof lu.lacet === 'number'), 'plan : oeil, { case: [x, y, z] entiers, lacet } en degrés (0 au nord, 90 à l’est)');
      const oeil: OeilDuPlan | null = lu ? { x: (lu.case as number[])[0], y: (lu.case as number[])[1], z: (lu.case as number[])[2], azimut: lu.lacet as number } : null;
      const z = e.z ?? oeil?.z ?? casesDuGroupe(etat)[0]?.z ?? 0;
      const couches = scene!.layers.map((l) => l.z);
      valider(couches.includes(z as number), `plan : z, l’une des couches de la scène (${couches.join(', ')})`);
      return { plan: planDeLaCouche({ ...etat, scene: scene! }, z as number, oeil) };
    },
    /**
     * `{ regard }` : `tactique`, `plateau` ou `immersion` (`REGARDS`, `src/noyau/monde/aretes.ts`)
     *
     * @returns une `Suite` : la vue, son plateau sous ce regard (section « Vue »,
     * `plateau.regard`), gardé jusqu'au prochain `regarder` ; `tactique` à l'ouverture de la partie
     */
    regarder(json) {
      const o = demarree();
      const e = entreeDe('regarder', json, ['regard']);
      valider(REGARDS.includes(e.regard as Regard), `regarder : regard, l’un de ${REGARDS.join(', ')}`);
      o.regard = e.regard as Regard;
      return suite(o);
    },
    /**
     * `{ fiche }` : la fiche que l'écran montre, `{ porteur, objet? }` (l'id d'un combattant qui en a une,
     * `ficheDuPorteur`, surface du noyau : un héros du groupe, ou tout combattant de la bataille hors coque et engin,
     * et la possession choisie, l'`uid` qui la désigne), ou `null` pour la fermer ; refusé sur un combattant hors de
     * la vue du groupe (`porteurEnVue`)
     *
     * @returns une `Suite` : la vue, la fiche posée ; la partie n'est pas touchée
     */
    fiche(json) {
      const o = demarree();
      const e = entreeDe('fiche', json, ['fiche']);
      const f = e.fiche as Record<string, unknown> | null | undefined;
      const etat = o.partie.etat();
      const aFiche = [...new Set([...(etat.battle?.combatants ?? []), ...etat.party].map((c) => c.id))].filter((id) => enTeteDuPorteur(etat, id));
      const porteurs = aFiche.filter((id) => porteurEnVue(etat, id));
      valider(!estObjet(f) || !aFiche.includes(f.porteur as string) || porteurs.includes(f.porteur as string), `fiche : porteur, ${t('vision.ficheHorsDeVue')}`);
      valider(f === null || (estObjet(f) && Object.keys(f).every((k) => k === 'porteur' || k === 'objet') && porteurs.includes(f.porteur as string)),
        `fiche : fiche, null ou { porteur, objet? } : l’id d’un combattant à fiche (${porteurs.join(', ')})`);
      if (f && f.objet !== undefined) {
        const objets = ficheDuPorteur(etat, f.porteur as string)!.possessions.map((p) => p.uid);
        valider(objets.includes(f.objet as string), `fiche : objet, l’uid d’une possession de la fiche (${objets.join(', ') || 'aucune'})`);
      }
      if (f === null) fermerLePanneau(o, 'fiche');
      else o.panneau = { fiche: { porteur: f!.porteur as string, ...(f!.objet === undefined ? {} : { objet: f!.objet as string }) } };
      return suite(o);
    },
    /**
     * `{ creation }` : un geste de la création d'un héros (`GesteDeLaCreation`, `src/hote/elements.ts`), celui que
     * porte un bouton de l'écran, ou `null` pour la fermer
     *
     * @returns une `Suite`, la création posée, la partie n'étant pas touchée ; à l'engagement, la `Suite` de
     * l'intention qui engage le brouillon au groupe, où le noyau bâtit le héros, son entrée écrite au roster
     */
    creation(json) {
      const o = demarree();
      const e = entreeDe('creation', json, ['creation']);
      const b = boutonDeLaCreation(vueDe(o).zones, e.creation);
      valider(b, 'creation : creation, un geste de la création que l’écran offre (`{ creation }` d’un bouton des zones groupe.gestes et creation.*)');
      if (b!.refus) throw new ErreurDeGeste('regle', `creation : ${b!.refus}`);
      const g = e.creation as GesteDeLaCreation | null;
      if (g === null) fermerLePanneau(o, 'creation');
      else if (g.geste === 'ouvrir') ouvrirLaCreation(o);
      else if (g.geste === 'engager') {
        const engage = engagerLeHeros(stockage, o.partie.etat(), creationOuverte(o)!.brouillon, idDEntropie);
        if ('refus' in engage) throw new ErreurDeGeste('regle', `creation : ${engage.refus}`);
        envoyerLIntention(o.partie, engage.intention);
        fermerLePanneau(o, 'creation');
        o.pas++;
        return suite(relireLeRoster(o));
      } else o.panneau = { creation: apresLaCreation(creationOuverte(o)!, g) };
      return suite(o);
    },
    /**
     * `{ roster }` : un geste sur le roster de l'hôte (`GesteDuRoster`, `src/hote/elements.ts`), celui que porte un
     * bouton des zones `groupe.roster` et `groupe.import`, ou `{ importe }`, le texte du fichier que le joueur a choisi
     * (`null` s'il renonce), tant que l'écran offre l'import
     *
     * @returns une `Suite` : `{ recruter }`, celle de l'intention qui recrute au groupe le héros de l'entrée, que le
     * noyau rebâtit de son brouillon sous l'id que le roster garde ; les autres, la partie n'étant pas touchée.
     * `{ retirer }` : l'entrée retirée du roster. `{ exporter }` : la suite porte `fichier: { nom, texte }`, le
     * fichier d'export du héros, que l'hôte remet au joueur. `{ importer }` : la suite porte `choix: true`, l'hôte
     * fait choisir un fichier au joueur et en rend le texte par `{ importe }`.
     * `{ importe }` : le héros du fichier entre au roster, en place de l'entrée du même héros ; un fichier refusé, ou
     * ce que le jeu ne connaît plus et retire du héros, se dit en `groupe.avis`. Un bouton refusé se refuse avec sa
     * raison.
     */
    roster(json) {
      const o = demarree();
      const e = entreeDe('roster', json, ['roster']);
      const zones = vueDe(o).zones;
      const g = e.roster as GesteDuRoster;
      if (estObjet(g) && 'importe' in g) {
        valider((g.importe === null || typeof g.importe === 'string') && Object.keys(g).length === 1 && boutonDuRoster(zones, { importer: true }), 'roster : importe, le texte du fichier choisi ou null, tant que l’écran offre l’import');
        if (g.importe === null) return suite(o);
        const importe = importerAuRoster(stockage, g.importe);
        o.roster = rosterAMontrer(stockage, 'refus' in importe ? importe.refus : importe.avis);
        return suite(o);
      }
      const b = boutonDuRoster(zones, g);
      valider(b, 'roster : roster, un geste du roster que l’écran offre (`{ roster }` d’un bouton des zones groupe.roster et groupe.import)');
      if (b!.refus) throw new ErreurDeGeste('regle', `roster : ${b!.refus}`);
      if ('importer' in g) return { ...suite(o), choix: true };
      if ('exporter' in g) {
        const fichier = garanti(fichierDuHeros(stockage, g.exporter), g.exporter, 'héros du roster');
        return { ...suite(o), fichier };
      }
      if ('retirer' in g) {
        retirerDuRoster(stockage, g.retirer);
        return suite(relireLeRoster(o));
      }
      const offert = garanti(herosDuRosterOfferts(o.partie.etat(), o.roster.heros).find((h) => h.id === g.recruter), g.recruter, 'héros du roster');
      envoyerLIntention(o.partie, offert.recrutement);
      o.pas++;
      return suite(o);
    },
    /**
     * `{ jeton }` : le numéro d'un jeton programmé
     *
     * @returns une `Suite` qui porte la reprise du jeton
     */
    reprendre(json) {
      const o = demarree();
      const e = entreeDe('reprendre', json, ['jeton']);
      valider(Number.isInteger(e.jeton), 'reprendre : jeton, le numéro d’un jeton programmé');
      o.jetons.reprendre(e.jeton as number);
      return suite(o);
    },
    /**
     * `{ manifestes, osDesRigides }` : un objet id de modèle → manifeste et un objet id de modèle → liste d'os, ceux du
     * listage (`GET modeles/listage.json`, section « Atelier 3D »)
     *
     * @returns `{ bases, fichiers, refus, rapport, surfaces, libelles, secondesPrises, couches, emblemes, vehicules,
     * ameliorations }` : les modèles de l'atelier (`modelesDeLAtelier`, `atelier.ts`), retenus comme état du pont, que
     * lisent `composer` et le corps de chaque combattant de la vue (section « Corps d'un combattant ») ; avant ou après
     * `demarrer`
     */
    modeles(json) {
      const e = entreeDe('modeles', json, ['manifestes', 'osDesRigides']);
      valider(estObjet(e.manifestes), 'modeles : manifestes, un objet id de modèle → manifeste');
      valider(estObjet(e.osDesRigides) && Object.values(e.osDesRigides).every(estListeDeChaines), 'modeles : osDesRigides, un objet id de modèle → os de ses meshes rigides');
      const manifestes = e.manifestes as Record<string, unknown>;
      modeles = { manifestes, modeles: modelesDeLAtelier(manifestes, e.osDesRigides as Record<string, string[]>) };
      return modeles.modeles;
    },
    /**
     * `{ base, composition, emblemes? }` : l'id d'une base servie par le dernier `modeles`, une composition (section
     * « Composition d'un personnage »)
     *
     * @returns `{ montes, manquants, rapport, gabarit, morphes, materiaux, palette }` (`composerSurLaBase`,
     * `composition.ts`, qui compose aussi le corps de chaque combattant) ; refusé avant tout `modeles`, sur une base
     * qu'il n'a pas servie, sur une composition que `lireComposition` refuse, et sur des surcharges `emblemes` que
     * `lireSurchargesDEmblemes` refuse (table de lignes vers `{ id }` d’un emblème connu ou `null`)
     */
    composer(json) {
      const e = entreeDe('composer', json, ['base', 'composition', 'emblemes']);
      valider(modeles !== null, 'composer : aucun modèle, appeler modeles d’abord');
      const base = modeles!.modeles.bases.find((b) => b.id === e.base);
      valider(base !== undefined, `composer : base, l’id d’une base servie par modeles (${modeles!.modeles.bases.map((b) => b.id).join(', ') || 'aucune'})`);
      const emblemes = valeurLue('composer', 'emblemes', lireSurchargesDEmblemes(e.emblemes === undefined ? {} : e.emblemes));
      return composerSurLaBase(base!, modeles!.manifestes, porteeDeComposition(compositionDe('composer', e.composition)), emblemes);
    },
    /**
     * `{ definition, postes?, ameliorations?, couleurs?, embleme? }` : la fiche d'un véhicule ou d'un engin dont le
     * dernier `modeles` sert un élément `vehicule` (une clé de `vehicules` de sa réponse), les pièces de ses postes
     * (`{ definition, bord }`, chacune une fiche servie qui est un engin `armes-de-siege` de `trappings.json`, à un
     * bord de `FIRE_ARCS`, dans l'ordre de leurs places), ses Améliorations installées (des clés de `ameliorations` de
     * la réponse de `modeles`) et son apparence (`couleurs` et `embleme`, lues par `lireApparenceDAuteur`, surface du
     * noyau : le schéma de l'apparence d'auteur)
     *
     * @returns `{ vehicule, places, pieces, ameliorations, montables }` (section « Atelier 3D ») : le corps du véhicule
     * que le noyau bâtit de cette entité (`ficheDEntite`, puis `vehiculeDuCombattant`, comme la vue d'un combattant),
     * composé par `corpsDuVehicule` (`pont.ts`) comme `vehicules[id]` de la vue (section « Corps d'un combattant »), au
     * cap `N` ; refusé avant tout `modeles`, sur une fiche, une pièce, un bord ou une Amélioration hors de ces listes
     * (le message les nomme), et sur une apparence que le schéma refuse
     */
    vehicule(json): VehiculeDeLAtelier {
      const e = entreeDe('vehicule', json, ['definition', 'postes', 'ameliorations', 'couleurs', 'embleme']);
      valider(modeles !== null, 'vehicule : aucun modèle, appeler modeles d’abord');
      const servis = modeles!;
      const fiches = Object.keys(servis.modeles.vehicules);
      valider(typeof e.definition === 'string' && fiches.includes(e.definition), `vehicule : definition, la fiche d’un véhicule servi par modeles (${fiches.join(', ') || 'aucune'})`);
      const pieces = fiches.filter((d) => siegeEngines().some((t) => t.id === d));
      const postes = e.postes ?? [];
      valider(Array.isArray(postes) && postes.every((p) => estObjet(p) && Object.keys(p).sort().join() === 'bord,definition' && pieces.includes(p.definition as string) && FIRE_ARCS.includes(p.bord as FireArc)),
        `vehicule : postes, une liste de { definition, bord } : une pièce servie (${pieces.join(', ') || 'aucune'}) à un bord (${FIRE_ARCS.join(', ')})`);
      const offertes = Object.keys(servis.modeles.ameliorations);
      const ameliorations = e.ameliorations ?? [];
      valider(estListeDeChaines(ameliorations) && ameliorations.every((a) => offertes.includes(a)), `vehicule : ameliorations, une liste d’Améliorations servies par modeles (${offertes.join(', ') || 'aucune'})`);
      const appearance = valeurLue('vehicule', 'apparence', lireApparenceDAuteur(Object.fromEntries(Object.entries({ couleurs: e.couleurs, embleme: e.embleme }).filter(([, v]) => v !== undefined))));
      const definition = e.definition as string;
      const fiche = ficheDEntite({
        id: 'atelier', kind: 'personnage', ...(pieces.includes(definition) ? { engin: { id: definition } } : { vehicule: { id: definition } }), pos: { x: 0, y: 0 }, appearance,
        postes: (postes as { definition: string; bord: FireArc }[]).map(({ definition, bord }) => ({ trappingId: definition, side: bord })),
        upgrades: (ameliorations as string[]).map((id) => ({ id })),
      }, () => undefined);
      const vehicule = vehiculeDuCombattant(fiche, undefined)!;
      const manifeste = servis.manifestes[servis.modeles.vehicules[vehicule.definition]];
      const enVigueur = postesEnVigueur(manifeste, vehicule.ameliorations) ?? {};
      return {
        vehicule: corpsDuVehicule(vehicule, servis)!,
        places: FIRE_ARCS.flatMap((bord) => {
          const montees = vehicule.postes.filter((p) => p.bord === bord);
          return (enVigueur[bord] ?? []).map((_, rang) => ({ bord, rang, label: `${libelleDuBord(bord)} ${rang + 1}`, piece: montees[rang]?.definition ?? null }));
        }),
        pieces,
        ameliorations: vehicule.ameliorations,
        montables: ameliorationsMontables(manifeste, offertes),
      };
    },
    /**
     * aucune
     *
     * @returns les choix de chaque champ d'une composition, ses axes, le nuancier, et les presets avec leur composition
     * (`cataloguesDeComposition`, surface du noyau)
     */
    catalogues(json) {
      entreeDe('catalogues', json, []);
      return cataloguesDeComposition();
    },
    /**
     * aucune
     *
     * @returns `{ de, vers, distanceM, metresParCase, armes, sorts, manoeuvres, souffles, sons, flottants, musiques,
     * lumieres, attaques, zonesQuiDurent, marques, meteos, deplacement }` : la vitrine des effets que le jeu joue
     * (`vitrineDesEffets`, surface du noyau, section « Effets ») ; avant ou après `demarrer`
     */
    vitrine(json): VitrineDesEffets {
      entreeDe('vitrine', json, []);
      return vitrineDesEffets();
    },
    /**
     * aucune
     *
     * @returns `{ preferences }` : la valeur effective de chaque préférence de confort, par id (`PREFERENCES`, surface
     * du noyau), dont `volume-<canal>` pour chaque canal du mixage ; avant ou après `demarrer`
     */
    preferences(json): { preferences: Record<string, PrefValue> } {
      entreeDe('preferences', json, []);
      return { preferences: Object.fromEntries(PREFERENCES.map((p) => [p.id, p.get()])) };
    },
    /**
     * aucune, ou `{ type, args }` : un geste des réglages, le `jeu` d'une valeur ou le formulaire d'une zone des
     * réglages : `{ type: 'preference', args: [id, valeur] }` règle une préférence de confort,
     * `{ type: 'regle', args: [id, valeur] }` surcharge une règle maison, `{ type: 'retablir', args: [id] }` la remet à
     * son défaut
     *
     * @returns `{ zones }` : les zones des réglages (`ZonesDesReglages`, `src/hote/reglages.ts`), avec ou sans partie
     * ouverte, le geste joué et persisté au stockage de l'hôte d'abord. Les préférences et les règles maison du
     * stockage sont posées à la création du pont, et reposées par `ouvrir` et `charger`. Refusé (`validation`) sur un geste, un id ou une valeur que la
     * table des préférences ou le registre des règles refuse ; refusé (`regle`) avec la raison du noyau quand un
     * combat verrouille les règles maison (`reglesMaisonMutables`).
     */
    reglages(json) {
      const e = entreeDe('reglages', json, (e) => ('type' in e ? ['type', 'args'] : []));
      const etat = ouverte?.partie.etat() ?? null;
      if ('type' in e) jouerUnReglage(stockage, etat, { type: e.type, args: e.args });
      return { zones: zonesDesReglages(stockage, etat) };
    },
    /**
     * aucune, ou un geste que les zones du salon offrent (`ZonesDuSalon`, `src/hote/salon.ts`) : le formulaire
     * `{ type: 'heberger', args: [nom] }`, le formulaire `{ type: 'rejoindre', args: [code, nom] }`, le `jeu`
     * `{ salon: 'quitter' }` de « Quitter le salon », ou le `jeu` `{ type, args }` d'une valeur de `salon.sieges`
     *
     * @returns `{ zones }` : les zones du salon d'après le geste, avec ou sans partie ouverte. Le geste se lit dans les
     * zones d'avant lui (`lireUnGesteDuSalon`) : héberger pose l'ouverture en cours, qui finit quand la room répond,
     * en session ou sur le texte de son échec ; quitter achève la session ou l'ouverture ; une valeur de siège joue
     * son intention comme `jouer`. Rejoindre, sans partie, pose l'ouverture en cours et tient une partie neuve sans
     * l'ouvrir (la jonction : `jouer` et les autres méthodes de jeu répondent « aucune partie », `ouvrir`, `charger`
     * et `demarrer` se refusent) ; assis, elle devient la partie ouverte, le miroir de celle de l'hôte, que nourrit
     * chaque instantané reçu. Toute fin d'un miroir ou d'une jonction (son échec, quitter le salon, la session finie
     * par le réseau, `quitter`) ferme sa partie sans rien sauvegarder ni garder de point de reprise, et repose les
     * réglages du joueur. Ce que le réseau change ensuite se lit par `nouvelles` ; Godot relit `salon` après
     * chaque `Suite`. Un message illisible du réseau est ignoré sans être dit. Refusé (`validation`) sur un geste que
     * les zones n'offrent pas ou des arguments mal formés ; refusé (`regle`) avec le refus du formulaire offert (sans
     * réseau, sans partie). Un refus n'écrit ni l'état ni l'ouverture.
     */
    salon(json) {
      const e = entreeDe('salon', json, (e) => ('salon' in e ? ['salon'] : ['type', 'args']));
      const zones = () => zonesDuSalon(ouverte?.partie.etat() ?? null, ouverture, salon !== null);
      if (json == null) return { zones: zones() };
      const geste = lireUnGesteDuSalon(zones(), e);
      const leSalon = garanti(salon, 'salon', 'salon du pont');
      if (geste.sorte === 'rejoindre') {
        reposerLesReglages();
        const entrees = entreesDuJeu(graineDEntropie());
        const j = (jonction = tenir(ouvrirAuGroupe(entrees, persisterLeHeros, premierJeton), entrees.graine));
        const enCours: OuvertureDuSalon = { enCours: 'rejoindre' };
        poserLOuverture(enCours);
        void leSalon.rejoindre(j.partie.etat, (data) => { j.partie.recevoir(data); }, geste.code, geste.nom).then((issue) => {
          if (ouverture !== enCours) return;
          poserLOuverture(null);
          if (issue === null) {
            jonction = null;
            j.miroir = true;
            j.aDire = true;
            ouverte = j;
            return;
          }
          j.partie.etat().ecrireAuJournal(issue);
          clore(j, true);
        });
        return { zones: zones() };
      }
      if (geste.sorte === 'quitter' && jonction) {
        const j = jonction;
        poserLOuverture(null);
        leSalon.quitter(j.partie.etat);
        clore(j, true);
        return { zones: zones() };
      }
      const o = demarree();
      if (geste.sorte === 'siege') jouerUnGeste(o, { ...geste.intention });
      else if (geste.sorte === 'quitter') {
        poserLOuverture(null);
        leSalon.quitter(o.partie.etat);
        if (o.miroir) clore(o, true);
      } else {
        const enCours: OuvertureDuSalon = { enCours: 'heberger' };
        poserLOuverture(enCours);
        void leSalon.heberger(o.partie.etat, (action, args, siege) => { o.partie.envoyer({ type: action, args, siege } as Intention); }, geste.nom).then((issue) => {
          if (ouverture === enCours) poserLOuverture(issue === null ? null : { echec: issue });
        });
      }
      return { zones: zones() };
    },
    /**
     * aucune
     *
     * @returns `{ quittee: { lignes } }` d'abord, une fois, quand un miroir ou une jonction a fini depuis le
     * précédent `nouvelles` hors de `quitter` : les lignes du journal (section « Suite ») que chacun n'avait pas dites,
     * dont la raison de sa fin, ajoutées dans l'ordre des fins ; sinon une `Suite` quand la partie ouverte a quelque
     * chose à dire depuis la précédente : un résultat à sa file, ce que le réseau a écrit hors appel (relevé), une
     * écriture de son état sans événement ni ligne (une présence), l'ouverture du salon posée ; sinon
     * `{ rien: true }`, et sans partie ouverte. Godot l'appelle sur sa minuterie
     * tant qu'un salon est ouvert ou s'ouvre, et après chaque geste de `salon`.
     */
    nouvelles(json) {
      entreeDe('nouvelles', json, []);
      if (quittee) {
        const { lignes } = quittee;
        quittee = null;
        return { quittee: { lignes } };
      }
      if (!ouverte) return { rien: true };
      const o = ouverte;
      o.partie.relever();
      return o.aDire || o.file.length ? suite(o) : { rien: true };
    },
    /**
     * aucune
     *
     * @returns `{ familles: { id, libelle, entrees: { id, libelle }[] }[] }` : chaque famille de ce que le jeu dessine
     * en 3D hors des modèles servis, `decor`, `sol`, `relief`, `toit` et `mur`, et chacune de ses entrées, au libellé de
     * sa donnée, dans l'ordre des libellés (`famillesDEchantillons`, surface du noyau, section « Atelier 3D ») ; avant
     * ou après `demarrer`
     */
    echantillons(json): { familles: FamilleDEchantillons[] } {
      entreeDe('echantillons', json, []);
      return { familles: famillesDEchantillons() };
    },
    /**
     * `{ famille, id }` : l'id d'une famille de `echantillons` et celui d'une de ses entrées
     *
     * @returns `{ monde, aretes, toits, couronnes, couronnesAbattues }` : la scène d'échantillon que le noyau bâtit
     * pour cette entrée, dessinée comme le monde de la partie (`echantillonDessine`, surface du noyau, section «
     * Atelier 3D ») : son volume (section « Monde »), les arêtes de son plateau au regard `immersion` (`aretes`,
     * section « Vue »), ses nappes de toit, ses couronnes et les clés des couronnes que sa brèche abat
     * (`couronnesAbattues`) ; refusé sur une famille hors de `echantillons` (le message les nomme) et sur une entrée
     * hors de sa famille (le message nomme la famille) ; avant ou après `demarrer`
     */
    echantillon(json): EchantillonDessine {
      const e = entreeDe('echantillon', json, ['famille', 'id']);
      const familles = famillesDEchantillons();
      const famille = familles.find((f) => f.id === e.famille);
      valider(famille !== undefined, `echantillon : famille, l’id d’une famille d’échantillons (${familles.map((f) => f.id).join(', ')})`);
      valider(famille!.entrees.some((entree) => entree.id === e.id), `echantillon : id, l’id d’une entrée de la famille ${famille!.id}`);
      return echantillonDessine(famille!.id, e.id as string);
    },
    /**
     * `{ composition, preset? }` : une composition (section « Composition d'un personnage ») et l'id d'un preset de
     * `catalogues` dont l'entrée reprend l'enveloppe
     *
     * @returns `{ entree, verdict }` (`presetDeComposition`, surface du noyau) ; refusé sur une composition que
     * `lireComposition` refuse, et sur un `preset` inconnu
     */
    presetDeComposition(json) {
      const e = entreeDe('presetDeComposition', json, ['composition', 'preset']);
      const composition = compositionDe('presetDeComposition', e.composition);
      valider(e.preset === undefined || typeof e.preset === 'string', 'presetDeComposition : preset, l’id d’un preset de catalogues');
      const rendu = presetDeComposition(composition, e.preset as string | undefined);
      if (!rendu.ok) throw new ErreurDeGeste('validation', `presetDeComposition : preset, l’id d’un preset de catalogues (${rendu.presets.join(', ')})`);
      return rendu;
    },
    /**
     * `{ ouvrir, projet?, calques?, manifeste? }` : l'id d'une campagne du jeu (`allBuiltinCampaigns`,
     * `src/scenes/campaign.ts`), le texte de son projet que sert le dépôt, celui des calques que l'hôte garde, et celui de
     * l'index des chapitres du `Source/` que sert le poste ; ou `{ edition }` : un geste d'édition (`GesteDEdition`,
     * `src/noyau/edition/session.ts`), un geste du pointeur, l'issue d'un enregistrement, d'un chargement de planche ou
     * de celui du chapitre attendu (refusée en `validation` hors d'une attente, ou d'un autre chapitre), ou celui que
     * porte un bouton des zones de l'éditeur, un qui l'offre sans refus d'abord ; ou `{ type: 'nommer' | 'identifier' |
     * 'decrire' | 'drapeau', args }` : le formulaire de l'inspecteur
     * qui nomme la sélection ou la scène, `args` le nom saisi ou rien, qui change l'identifiant de la zone d'effet
     * sélectionnée, `args` l'identifiant saisi, qui décrit la scène, `args` la description ou rien, ou qui ajoute un
     * drapeau de départ, `args` son nom ; ou `{ type: 'valeur', args: [porteur, chemin, valeur?] }` : un formulaire
     * tiré du schéma, ses deux saisies posées égales en profondeur à celles d'un formulaire des zones, `valeur` absente
     * pour retirer le champ (section « Éditeur »)
     *
     * @returns `{ vue: { zones, couche }, surcouche, calque, monde?, retrait?, aretes?, navires?, depot?, essai?,
     * planche?, chapitre?, memoire? }` (section « Éditeur »), `chapitre` le `{ book, ch }` du chapitre que la session se
     * met à attendre, que l'hôte charge (`GET source/<book>/<ch>.md`) puis rend en `{ edition: { geste: 'chapitre', book,
     * ch, texte } }` ; un bouton refusé se refuse en `regle`, avec sa raison, comme un enregistrement que la
     * porte refuse
     */
    editer(json) {
      const e = entreeDe('editer', json, (e) => ('ouvrir' in e ? ['ouvrir', 'projet', 'calques', 'manifeste'] : 'type' in e ? ['type', 'args'] : ['edition']));
      const avant = 'ouvrir' in e ? null : edition?.session ?? null;
      let session: SessionDEdition;
      let depot: { id: string; texte: string } | null = null;
      if ('ouvrir' in e) {
        const campagne = allBuiltinCampaigns.find((c) => c.id === e.ouvrir);
        valider(campagne !== undefined, `editer : ouvrir, l’id d’une campagne du jeu (${allBuiltinCampaigns.map((c) => c.id).join(', ')})`);
        valider(e.calques === undefined || typeof e.calques === 'string', 'editer : calques, le texte des calques que l’hôte garde');
        const gardes = e.calques === undefined ? undefined : calquesGardes(e.calques as string);
        const manifeste = e.manifeste === undefined ? null : manifesteServi(e.manifeste);
        session = e.projet === undefined ? ouvrirLEdition(paquetDuJeu(campagne!), false, gardes, manifeste) : ouvrirLEdition(projetServi(campagne!.id, e.projet), true, gardes, manifeste);
      } else {
        valider(edition !== null, 'editer : aucune carte ouverte, editer { ouvrir } d’abord');
        const s = edition!.session;
        const nomme = 'type' in e ? gesteDuFormulaire(zonesDeLEditeur(s), e) : undefined;
        if ('type' in e) valider(nomme, 'editer : un formulaire des zones editeur.*, { type: nommer | identifier | decrire | drapeau, args: [texte] } ou { type: valeur, args: [porteur, chemin, valeur?] }');
        else if (estLIssueDUnEnregistrement(e.edition)) valider(s.depot?.enCours, 'editer : aucun enregistrement en cours');
        else if (estLIssueDUnChargement(e.edition)) valider(s.chargement, 'editer : aucun chargement de planche en cours');
        else if (estLIssueDUnChapitre(e.edition)) {
          const { book, ch } = e.edition;
          valider(s.chapitreEnAttente?.book === book && s.chapitreEnAttente.ch === ch, `editer : chapitre, ${book} ch.${ch} n’est pas le chapitre attendu`);
        }
        else if (!estUnGesteDuPointeur(e.edition)) {
          const b = boutonDeLEdition(zonesDeLEditeur(s), e.edition);
          valider(b, 'editer : edition, un geste du pointeur ({ geste: appui | glisse | relache, point: { case: { x, y }, f: { x, y } } }, la case en entiers), l’issue d’un enregistrement ({ geste: enregistrement, reussi }), celle d’un chargement de planche ({ geste: chargement, image: { largeur, hauteur } | null }), celle du chapitre attendu ({ geste: chapitre, book, ch, texte: texte | null }) ou le geste `{ edition }` d’un bouton des zones editeur.*');
          if (b!.refus) throw new ErreurDeGeste('regle', `editer : ${b!.refus}`);
        }
        const geste = nomme ?? (e.edition as GesteDEdition);
        const refusDeValeur = geste.geste === 'valeur' ? refusDeLaValeurDit(s, geste) : null;
        if (refusDeValeur) throw new ErreurDeGeste('regle', `editer : ${refusDeValeur}`);
        if (geste.geste === 'enregistrer') {
          const passe = texteAEnregistrer(s);
          if (!passe.ok) throw new ErreurDeGeste('regle', `editer : ${passe.refus}`);
          depot = { id: s.projet.id, texte: passe.valeur };
        }
        if (geste.geste === 'tester') {
          const lance = essaiDeLaScene(s);
          if (!lance.ok) throw new ErreurDeGeste('regle', `editer : ${lance.refus}`);
          essai = lance.valeur;
        }
        session = editer(s, geste);
      }
      const vue = vueDeLaScene(session);
      const neuf = !edition || 'ouvrir' in e || (session.geste === null && (vue !== edition.monde.vue || session.z !== edition.monde.z));
      edition = { session, monde: neuf ? { vue, z: session.z } : edition!.monde };
      const memoire = memoireDesCalques(avant, session);
      const charge = session.chargement && !avant?.chargement ? session.chargement : null;
      const attendu = session.chapitreEnAttente;
      const demande = attendu && (attendu.book !== avant?.chapitreEnAttente?.book || attendu.ch !== avant.chapitreEnAttente.ch) ? attendu : null;
      return {
        vue: { zones: zonesDeLEditeur(session), couche: session.z },
        surcouche: surcoucheDeLEdition(session),
        calque: calqueAffiche(session),
        ...(neuf ? { monde: manifesteDe(volumeDuMonde(vue)), retrait: retraitDuMonde(vue, session.z), aretes: aretesDeLaCouche(vue, session.z), navires: naviresServis(vue) } : {}),
        ...(depot ? { depot } : {}),
        ...('edition' in e && (e.edition as GesteDEdition).geste === 'tester' ? { essai: true } : {}),
        ...(charge ? { planche: { image: cheminDeLaPlanche(session.projet.id, charge.sceneId, charge.z) } } : {}),
        ...(demande ? { chapitre: demande } : {}),
        ...(memoire ? { memoire } : {}),
      };
    },
    /**
     * aucune
     *
     * @returns `{ erreurs: { message, source }[] }` : les événements `error` et `unhandledrejection` de la page, et
     * les levées du réseau hors d'un appel (un écouteur de la socket, une suite de sa minuterie, une panne du salon),
     * depuis le dernier relevé, puis vidés ; `source` vaut `fichier:ligne`, `unhandledrejection`, `reseau` ou `null`
     */
    erreursGlobales(json) {
      entreeDe('erreursGlobales', json, []);
      return { erreurs: erreurs.splice(0) };
    },
  };

  const page = globalThis as { addEventListener?: (type: string, ecouteur: (ev: unknown) => void) => void };
  page.addEventListener?.('error', (ev) => {
    const e = ev as { message?: string; filename?: string; lineno?: number };
    erreurs.push({ message: e.message ?? String(ev), source: e.filename ? `${e.filename}:${e.lineno ?? 0}` : null });
  });
  page.addEventListener?.('unhandledrejection', (ev) => {
    const raison = (ev as { reason?: unknown }).reason;
    erreurs.push({ message: raison instanceof Error ? raison.message : String(raison), source: 'unhandledrejection' });
  });

  /**
   * @contrat Transport
   * - `wfrpPont.appeler(methode, entree?)` est la porte des outils (tests, vues figées, `recette.mjs`) ; Godot
   *   appelle `appelerEnOctets`, hors du choix d'un fichier sur le disque du joueur
   *   (`wfrpPont.choisirUnFichier(accepte, rendre)` : la planche d'un calque, section « Éditeur », le fichier d'export
   *   d'un héros, méthode `roster`), qui lit le document de la page et `FileReader` à son appel seulement, hors de
   *   l'exécution de la construction. `methode` est le nom d'une méthode ; `entree` est une chaîne JSON qui encode un
   *   objet, ou rien (absente ou `null`) pour une méthode sans entrée. Elle rend toujours une chaîne JSON.
   * - La réponse vaut `{ "ok": true, … }` ou `{ "ok": false, "erreur": { "categorie", "message" } }`. `appeler` ne lève
   *   jamais.
   * - Une clé de l'entrée que la méthode ne lit pas se refuse.
   * - `wfrpPont.appelerEnOctets(methode, entree?)` est la porte des transports de Godot.
   * - Elle rend la chaîne d'`appeler`, sauf pour une réponse réussie de `morceaux`.
   * - Celle-ci est l'en-tête d'`enOctets` (`pont/octets.ts`) : ses tableaux en bornes, `octets` sa longueur.
   * - `wfrpPont.octets()` rend un `ArrayBuffer`, les octets de la dernière réponse d'`appelerEnOctets`.
   * - Il vaut `null` quand elle n'en porte pas : autre méthode, ou refus.
   */
  /**
   * @contrat Erreurs
   * - `validation` : méthode inconnue (le message nomme les méthodes) ; fiche qui n'est ni `null` ni
   *   `{ porteur, objet? }` d'un combattant à fiche, héros du groupe ou combattant de la bataille (le message les
   *   nomme), ou dont l'`objet` n'est pas l'`uid` d'une possession de la fiche (le message les nomme) ; geste de la
   *   création qu'aucun bouton de l'écran n'offre ; entrée illisible, qui n'est pas un objet, ou avec une clé hors
   *   contrat ; aucune partie avant `demarrer` ou `ouvrir`, ou après la fin d'une session d'invité (`nouvelles` en
   *   donne la raison, `quittee`) ; `demarrer`, `ouvrir` ou `charger` sur une partie ouverte ou pendant une jonction ; `lancer`
   *   d'une campagne qui n'est pas du jeu (le message nomme les ids), ou sur une partie déjà en cours ; scénario
   *   inconnu, graine non entière ; verbe
   *   inconnu (le message nomme les gestes de la fenêtre qui tient la main et les voisins de nom) ; argument de forme
   *   fausse, en trop ou manquant, id que l'état ne désigne pas ; verbe qui lève ; intention hors de l'allowlist d'un
   *   siège ; jeton inconnu ou déjà repris ; `composer` avant tout `modeles`, ou sur une base qu'il n'a pas servie ;
   *   composition de `composer` ou de `presetDeComposition` absente ou hors de son schéma (`lireComposition`, le
   *   message porte le chemin de chaque faute, `(racine)` pour la composition entière) ; surcharges `emblemes` de
   *   `composer` hors de leur schéma (`lireSurchargesDEmblemes`, même forme de message) ; `preset` de
   *   `presetDeComposition` qui n'est l'id d'aucun preset de `catalogues` (le message nomme les ids) ; `editer` sur une
   *   campagne qui n'est pas du jeu (le message nomme les ids), d'un `projet` servi illisible, d'un autre id ou que la
   *   porte refuse, avant toute carte ouverte, d'un geste qui n'est ni un geste du pointeur bien formé, ni l'issue d'un
   *   enregistrement en cours, ni celui d'un bouton des zones de l'éditeur, ni un formulaire que portent les zones de
   *   l'éditeur, saisi de ses arguments (`gesteDuFormulaire`) ; `morceaux` d'une source hors de `partie` et `edition`,
   *   dont `volume`, `toits` ou `couronnes` n'est pas une liste de clés, de source `edition` avant toute carte ouverte,
   *   ou sans scène ; `retrait` ou `vision` sans scène ; fiche d'un combattant hors de la vue du groupe
   *   (`porteurEnVue`, la raison en mots du joueur)
   * - `permission` : intention d'un siège qui ne tient pas la main
   * - `regle` : campagne que le groupe ne lance pas (`refusDeLancer`, sa raison : groupe vide, siège invité à
   *   pourvoir) ; geste de la création refusé (sa raison : la page qui ne se quitte pas, l'engagement que la partie
   *   refuse) ; verbe de la barre refusé par le refus de son geste (`refusDuGeste`, sa raison) : barre non ouverte,
   *   aucune entrée pertinente qui déclare ce geste, argument qui ne désigne aucun candidat de l'entrée, entrée fermée
   *   par ses gates ; valeur d'un formulaire tiré du schéma que la session d'édition n'écrit pas (sa raison, section
   *   « Éditeur ») ; en combat, chez un invité, verbe de classe `hôte` ou intention qui porte un siège
   *   (`refusChezLInvite`, sa raison ; hors combat, la raison est une ligne du journal de la `Suite`)
   * - `interne` : levée qu'aucun contrôle n'attendait
   *
   * Les trois premières catégories sont celles du module commun (`CategorieDErreur`, `src/hote/partie.ts`) ; le texte
   * de chaque message vient de lui ou du noyau.
   */
  /** La réponse de la méthode `methode` sur l'entrée `json`, jamais une levée. */
  function repondre(methode: string, json?: string | null): Reponse {
    try {
      const faire = Object.prototype.hasOwnProperty.call(methodes, methode) ? methodes[methode] : null;
      if (!faire) throw new ErreurDeGeste('validation', `méthode inconnue : ${String(methode)} (méthodes : ${Object.keys(methodes).join(', ')})`);
      if (ouverte?.miroir && ouverte.partie.etat().net.mode !== 'invite') clore(ouverte, true);
      return { ok: true, ...faire(json) };
    } catch (erreur) {
      return erreur instanceof ErreurDeGeste
        ? { ok: false, erreur: { categorie: erreur.categorie, message: erreur.message } }
        : { ok: false, erreur: { categorie: 'interne', message: erreur instanceof Error ? erreur.message : String(erreur) } };
    }
  }

  /** Appelle la méthode `methode` sur l'entrée `json` : la réponse en JSON, jamais une levée. */
  function appeler(methode: string, json?: string | null): string {
    return JSON.stringify(repondre(methode, json));
  }

  /** Les octets de la dernière réponse d'`appelerEnOctets`, `null` sans octets. */
  let tenus: ArrayBuffer | null = null;

  /** Appelle comme `appeler` ; une réponse réussie de `morceaux` rend l'en-tête d'`enOctets` et tient ses octets. */
  function appelerEnOctets(methode: string, json?: string | null): string {
    const reponse = repondre(methode, json);
    tenus = null;
    if (methode !== 'morceaux' || !reponse.ok) return JSON.stringify(reponse);
    const { entete, octets } = enOctets(reponse as unknown as MorceauxDuPont);
    tenus = octets;
    return JSON.stringify({ ok: true, ...entete } satisfies Reponse);
  }

  /** Les octets de la dernière réponse d'`appelerEnOctets`, `null` si elle n'en porte pas. */
  function octets(): ArrayBuffer | null {
    return tenus;
  }

  /**
   * @contrat Méthodes
   * Le pont tient une partie à la fois, comme le noyau n'en tient qu'une par processus : `demarrer` (un scénario de
   * test, l'essai de l'éditeur), `ouvrir` (une partie au groupe, que `lancer` lance sur une campagne du jeu) ou
   * `charger` (une sauvegarde) l'ouvre, `quitter` la ferme, et une autre s'ouvre ensuite sous le même pont, sans
   * recharger la page. La file des résultats (section « Suite ») est celle de la partie : elle s'ouvre et se ferme
   * avec elle. Un `demarrer`, un `ouvrir` ou un `charger` refusé n'ouvre rien. Les sauvegardes vivent dans le
   * stockage que l'hôte donne au pont (`creerPont`) : celui de la page (`localStorage`), un fichier pour le pont du
   * processus.
   */
  return { appeler, appelerEnOctets, octets };
}

/** Le pont que la page expose à Godot. */
export type Pont = ReturnType<typeof creerPont>;
