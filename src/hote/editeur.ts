/**
 * L'ÉDITEUR DE CARTE À L'ÉCRAN D'UN HÔTE (#3508) : ses zones et leurs éléments (`elements.ts`), lus de la session
 * d'édition du noyau (`SessionDEdition`). Les outils, les options de l'outil actif (pinceau, terrains, hauteurs, sorte
 * et structure d'une arête, étage rejoint et plan d'une volée, engin d'un emplacement de siège, type et cap d'un navire), les couches
 * de la vue de la scène, ponts de ses navires compris, l'historique, la presse,
 * l'enregistrement au dépôt, la case pointée et la sélection, l'inspecteur de l'entité, de l'entrée, de la zone ou de l'arête sélectionnée et le
 * calque de référence de la couche ; chaque geste porte le geste d'édition qu'il joue (`{ edition }`), prêt à envoyer. Ce que le
 * pointeur trace sur la carte en cours de geste, le tracé de la volée, l'arête sélectionnée, les zones de la couche et la poignée de la
 * sélection, vont à la surcouche (`surcoucheDeLEdition`),
 * que l'hôte pose sur le monde, et le calque de la couche, à l'affichage du calque (`calqueAffiche`), avec la planche
 * qu'il garde (`cheminDeLaPlanche`) et ce qu'il garde des calques (`memoireDesCalques`).
 */
import {
  calqueDeLaCouche, calquesAStocker, coinsDuCalque, planDuCalque, type CalquesStockes,
  capDeLEntite, capsOfferts, entiteDeLaSelection, ficheEditee, fichesDePersonnage, nomDEntite, presetDuNarratif, props,
  assoirALaPlace, idDuCorps, labelEmplacement, lightTones, lumiereAllumee, PARTY_MAX, seatSlotsOf, siegeEngines, type SeatOccupant,
  DIFFICULTE_PAR_DEFAUT, DIFFICULTY_LABELS, FACES_D_ARETE, FIRE_ARCS, HAUTEURS, PINCEAUX, planDeLaVolee, areteDessinee, heightAt, libelleDeStructure, porteAuteur, sceneEditee, scenesDeLaSession, secretAuteur,
  segmentDeLaSelection, structureAppearances, structuresCrenelables, structuresDeLArete, crenellatedAt, terrainIds, terrainLabel, tileAt,
  ACTIONS_D_ARCHITECTURE, avertissementsDeLaSession, cadreDeLaSession, BORNES_DE_LA_TROUPE, casesDuDefaut, PLAN_DEFECT_FAMILIES, versLaFautive, AMBIANCES, ENVIRONNEMENTS, METEOS, PARTS_RELIEF, lightLevels, matieresDe, reposDeScene, sceneMetresPerTile, matieresCouvrantes, PENTE_TOIT_DEG, PROFILS_DE_TOIT, toitureEffective, BORNES_D_OUVERTURE, buildingsMeta, corpsActif, DEFAUTS_D_OUVERTURE, FACADE_APPEARANCE_IDS, SORTES_D_OUVERTURE, OUVRAGES, refusDOuvrage, selRect, effectZoneRect, ENTREES_DE_DOSSIER, isRoomZone, poigneeDeLaSelection, sameSel, sceneZoneTiles,
  type AreteDessinee, type BrouillonDArete, type Difficulty, type GesteDEdition, type PatchDArete, type PatchDEntite, type PatchDeScene, type PatchDeZone, type Scene, type Sel, type SessionDEdition,
  type WallPaint, ZONE_VARIANTS, bornesAuPoint, champDeLElement, champsDeclares, champsDuRecord, champsOfferts, choixDuNoeud, elementDuNoeud, formeAuPoint, recordDuNoeud, formulaireDe, gestesDeLaListe, refusDeLaValeur, unionDuNoeud, valeurNeuveDe, varianteCourante, variantesAChoisir, type FieldDesc, type Segment,
  allMusicDefs, apparencesDeLOuverture, champDuMessage, ciblesDAncreDeBataille, groupesDuLieu,
  isWearable, objetsDeLInventaire, trappingsInstanciables,
  candidatsDuSlot, carriereActuelle, careers, designationsDeCarriere, dotationsDuPnj, emplacementsDeDotation, estEmplacementRacine, ficheDuCombattant,
  findCareerById, levelsForCareer, libelleDeLaValeur, parcoursDe, parcoursRetouche, parseRefKey, prisParLesAutres, refKey, refLabel, skillSlots, sousEmplacement, talentsDuParcours,
  trappingRefLabel, valeursDeLEmplacement, type EmplacementDeDotation, type ParcoursDeCarriere,
  findSpellById, listesDeSorts, sortsImprimes,
  aLEchelleDesPonts, CAPS_DES_PONTS, TYPES_DE_NAVIRE, vueDeLaScene,
  PHRASE_REFUS, estChampDAdresse, etatDeLAdresse, type SourceDeLEdition,
} from '../noyau/index';
import { pluriel, t } from '../i18n';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from '../lib/objet.mjs';
import { elementsDesGestes, ligne, SANS_BORNE, type Bouton, type Choix, type Formulaire, type Ligne } from './elements';
import { renduDe, type ArgumentDuGeste, type GesteDeLaFenetre } from './gestes';

/**
 * L'éditeur de carte (#3508) est un état du pont, qu'aucune partie ne touche : la session d'édition du noyau
 * (`SessionDEdition`, `src/noyau/edition/session.ts` : le projet ouvert, l'historique de sa scène éditée, l'outil, la
 * couche, le pinceau, la sélection, le geste du pointeur en cours, l’entité copiée et les calques de référence), que
 * chaque geste fait avancer (`editer`, du même module).
 *
 * `{ ouvrir }` ouvre la première scène de la campagne à l'outil de sélection, sur la couche 0, et remplace la session
 * ouverte : sans `projet`, celui que le jeu embarque, qui ne s'enregistre pas ; avec lui, le texte du projet que sert
 * le dépôt (`GET depot/<id>`, ci-dessus), passé par la porte (`projetDuDepot`), qui s'y enregistre ; avec `calques`, le
 * texte des calques que l'hôte gardait pour cette campagne (`CalquesStockes`, `src/noyau/edition/calque.ts`), retirés
 * s'ils ne sont pas du format courant (`FORMAT_CALQUES`) ou pas du JSON ; avec `manifeste`, le texte de l'index des
 * chapitres du `Source/` que sert le poste (`GET source/manifest.json`, `Manifeste`, `src/data/source/chapitres.ts`).
 *
 * Un geste d'édition est soit un geste du pointeur, `{ geste: 'appui' | 'glisse' | 'relache', point: { case: { x, y },
 * f: { x, y } } }` (la case touchée en entiers, le point de la carte touché en cases continues, une case centrée sur
 * l'entier : `PointDeCarte`, `src/noyau/edition/pointeur.ts` ; un geste d'entité vise la case du point, `caseDe(f)`,
 * pas celle du triangle touché ; l'outil décor pose toujours, au point, parmi ce que la case porte déjà (`poseAuPoint`,
 * `src/noyau/sceneEdit.ts` : la case, le calage dans le jeu libre de son empreinte, aimanté au centre et aux bords, et
 * le décor dont le dessus porte le point) ; un décor glissé se pose de même au point, au relâché aussi, et emporte ce
 * qui est posé sur lui ; la sélection et la gomme désignent, parmi les entités de la case, celle dont l'ancre est la
 * plus proche du point ; sans entité, la sélection désigne le navire dont les ponts posent la case sur la couche
 * éditée (`provenanceDesNavires`), sans glissé ; l'outil navire pose son navire sur la case), soit l'issue de
 * l'écriture d'un enregistrement en cours, `{ geste: 'enregistrement', reussi }`, soit celle du chargement d'une
 * planche en cours, `{ geste: 'chargement', image }`, `image` nulle si l'auteur renonce ou `{ largeur, hauteur }` en
 * pixels entiers positifs, soit celle du chargement du chapitre attendu, `{ geste: 'chapitre', book, ch, texte }`,
 * `texte` le Markdown que sert `GET source/<book>/<ch>.md` ou `null` s'il n'a pas pu se charger, soit le geste
 * `{ edition }` que porte un bouton des zones de l'éditeur, égal en profondeur.
 *
 * Le formulaire de l'inspecteur qui nomme l'entité, l'entrée, le déclencheur, la zone d'effet ou le corps sélectionné,
 * ou la scène sans sélection, se joue `{ type: 'nommer', args }` (`gesteDuFormulaire`, `src/hote/editeur.ts`), en `{
 * geste: 'nommer', nom }`, `nom` absent s'il est laissé vide : l'entité reprend alors le nom de sa fiche, l'entrée, le
 * déclencheur et la zone restent tels quels, comme sous un nom déjà pris ; celui qui change l'identifiant de la zone
 * d'effet sélectionnée, ou de la scène sans sélection, se joue `{ type: 'identifier', args }`, en `{ geste:
 * 'identifier', id }` (`renameEffectZone`, `renameScene`), refusé comme un nom vide ou déjà pris ; celui qui change
 * l'identifiant d'une action authorée du décor sélectionné, `{ type: 'identifier', args: [action, id] }`, en `{ geste:
 * 'identifier', id, action }` (`renameActionAuthoree`), refusé de même ; la scène renommée
 * l'est hors de l'historique, chaque cran portant son nouvel identifiant, et ses calques la suivent ; celui qui décrit
 * la scène se joue `{ type: 'decrire', args }`, en `{ geste: 'scene', patch: { scalaires: { desc } } }`, la description
 * retirée si elle est laissée vide ; celui qui ajoute un drapeau de départ se joue `{ type: 'drapeau', args }`, en `{
 * geste: 'scene', patch: { drapeaux: { [nom]: true } } }`, refusé en `validation` sur un nom vide ;
 *
 * celui qui pose une troupe du personnage sélectionné se joue `{ type: 'troupe', args: [nombre] }`, en `{ geste:
 * 'troupe', nombre }`, refusé en `validation` hors d'un entier de `BORNES_DE_LA_TROUPE` : `nombre` copies
 * (`poserUneTroupe`, `src/noyau/sceneEdit.ts`), chacune d'un id neuf, sur la case la plus proche de l'original, sur sa
 * couche, où toute son empreinte tient debout, joignable à pied depuis lui (`tientDebout`), hors des cases d'une autre
 * entité ou d'une copie posée ; ses Caractéristiques tirées au hasard (`combat.randomChars`, LDB 77 l.108), seedées sur
 * son id ; son inventaire, son parcours de carrière, son apparence et son embuscade hérités, et chaque rencontre de
 * l'original au même titre, sans la monture qu'il chevauche ; moins de copies quand la couche manque de cases, la
 * session telle quelle sans aucune ; l'original reste sélectionné, la troupe entière sur un seul cran de l'historique.
 *
 * Un formulaire tiré du schéma (`formulaireDe`, `src/noyau/sceneEditLecture.ts`, décrit par `inferFields`) se joue `{
 * type: 'valeur', args: [porteur, chemin, valeur?] }`, en `{ geste: 'valeur', porteur, chemin, valeur }`
 * (`gesteDuFormulaire`), refusé en `validation` si aucun formulaire des zones ne porte ce porteur et ce chemin, ni
 * aucune valeur d'un de leurs choix ce geste même ; `porteur` est `{ sorte: 'zone' | 'declencheur' | 'entite', id }`,
 * la zone d'effet, le déclencheur ou l'entité par son identifiant, et `chemin` les clés du champ depuis lui, le rang
 * entier d'un élément de liste et la clé d'une entrée de record compris.
 *
 * Le geste, joué par un bouton ou par ce formulaire, n'écrit que ce que le formulaire offre (`avecLaValeur`) : sous un
 * champ que son porteur offre (`FORMULAIRES`, `cheminOffert`), le rang d'un élément d'une liste présente, une clé
 * d'un record présent qu'il porte, ou qu'il offre (l'une de celles que le contexte de son porteur y pose, sinon une
 * qu'admet sa clé), une clé déclarée d'un objet présent ou de la variante courante d'une union, jamais son discriminant, que tient le choix de la
 * variante, ni une clé `id` qui n'est pas une référence de catalogue ; et l'un des choix admis que le contexte de son
 * porteur y pose (`choixDuChamp`), ou, sans eux, une valeur de la sorte du champ : l'une de ses valeurs pour un choix
 * (`choixDuNoeud`), la valeur neuve d'un objet (`valeurNeuveDe`), l'une de ses variantes à
 * choisir pour une union (`variantesAChoisir`), la liste après l'un de ses gestes (`gestesDeLaListe`), sinon ce que le
 * schéma du champ parse ; `valeur` absente retire le champ si son absence est admise ou si c'est l'entrée d'un record,
 * une liste vidée part si la sienne l'est, et l'objet que ce retrait vide part avec lui, de proche en proche.
 *
 * L'entité s'écrit par sa porte (`editEntity`), et l'écriture qui lui fait enfreindre une règle qu'elle n'enfreignait
 * pas (`refusDeLEntite`, `src/data/schemas/defs-scenes/scene.ts` ; `TypeNonNomme`) est refusée, la règle dite ; une
 * entité déjà fautive reste éditable. Sinon le pont refuse le geste en `regle`, sa raison dite (`refusDeLaValeurDit`,
 * `src/hote/editeur.ts`) : le champ que le formulaire n'offre pas, une valeur hors de sa sorte, un JSON illisible,
 * arrivé `null`, là où le champ ne l'admet pas, ou la règle que l'entité écrite enfreint ; la session reste telle
 * quelle. Le schéma entier ne se vérifie qu'à l'enregistrement, à l'essai et dans la validation : un objet ajouté vide
 * y est une erreur jusqu'à ce qu'on le complète.
 * @contrat Éditeur
 */
/**
 * La réponse porte la vue de l'éditeur : `zones` (`zonesDeLEditeur`, `src/hote/editeur.ts`), les zones de l'éditeur,
 * dans l'ordre où chacune montre ses éléments :
 * @contrat Éditeur
 */
export interface ZonesDeLEditeur {
  /** la scène éditée */
  'editeur.titre': Ligne[];
  /**
   * les scènes du projet en liste, l'éditée pressée, chacune jouant `{ geste: 'scenes', quoi: 'aller', id }` ;
   * « Nouvelle scène », vide, d'identifiant `scene-<n>` libre, en fin de projet (`addProjectScene`), « Dupliquer la
   * scène », l'éditée copiée en fin de projet (`duplicateProjectScene`), et « Retirer la scène », refusé pour la seule
   * scène du projet, sa suivante sinon sa précédente éditée (`deleteProjectScene`), ses calques retirés : `{ geste:
   * 'scenes', quoi: 'ajouter' | 'dupliquer' | 'retirer' }` ; la scène éditée change ainsi, à l'outil de sélection, sur
   * la couche 0, son historique neuf, les changements des autres gardés au projet
   */
  'editeur.scenes': (Choix | Bouton)[];
  /**
   * un choix des outils : sélection, terrain, hauteur, murs, volée, crénelage, décor, personnage, navire, emplacement
   * de siège, départ des héros, entrée, architecture, zone, gomme ; l'actif pressé ; le navire refusé, la raison dite,
   * dans une scène qui n'est pas à l'échelle des ponts (`aLEchelleDesPonts`)
   */
  'editeur.outils': Choix[];
  /**
   * les options de l'outil actif : la taille du pinceau, le rectangle du terrain, chaque terrain en liste, chaque
   * hauteur de `HAUTEURS` ; au crénelage, le pinceau et, en liste, chaque structure crénelable
   * (`structuresCrenelables`) et la gomme de sa marque ; la gomme, qui efface la chose de sa case, n'en a aucune, ni le
   * départ ni l'entrée ; au décor, chaque décor du catalogue (`props`) en liste ; au personnage, chaque fiche du
   * bestiaire qui a des Blessures, les profils standard en tête (`fichesDePersonnage`), en liste ; à l'emplacement de
   * siège, chaque engin (`siegeEngines`) en liste ; au navire, chaque type de navire à ponts (`TYPES_DE_NAVIRE`) en
   * liste, refusé comme l'outil, et son cap parmi les quatre cardinaux (`CAPS_DES_PONTS`) : l'appui pose le navire
   * choisi à ce cap, sur la case appuyée et la couche éditée, et le sélectionne (`poserUnNavire`) ; aux murs, la
   * sorte d'arête posée, cloison, porte ou l'une des deux diagonales, et, pour une cloison ou une porte, son matériau
   * en liste, « Par défaut » ou chaque structure qu'elle peut porter (`structuresDeLArete`) ; à la volée, l'étage
   * qu'elle rejoint, chaque couche de la vue, son tracé en cases, ses cotes quand son plan tient (`planDeLaVolee`,
   * `planStairFlight`), sinon, une case tracée, la raison du plan en
   * clair, « Poser la volée », refusé avec la raison du plan, et « Effacer le tracé », refusé sans case ; la retenue
   * pressée ; à l'architecture, le corps actif parmi ceux de la scène (`corpsActif` : celui de la sélection, sinon le
   * premier ; `{ geste: 'corps', id }` le sélectionne et édite la couche de son premier étage), l'action du clic
   * (`ACTIONS_D_ARCHITECTURE`), sélectionner dans le corps actif, poser une façade sur l'arête appuyée ou tirer au
   * rectangle une exclusion de toiture du corps actif sur la couche éditée, ces deux-là refusées sans corps et suivies
   * du retour à la sélection, et chaque ouvrage à bâtir (`OUVRAGES`, `{ geste: 'batir', ouvrage }`) : un corps ou une
   * partie de l'étage de la couche éditée sur la dernière case appuyée, l'étage au-dessus du corps actif, qui devient
   * la couche éditée, une masse de toiture sur la dernière case appuyée, chacun refusé avec sa raison
   * (`refusDOuvrage` : sans corps, sans étage du corps sur la couche, sans case appuyée sur la couche) et sélectionné
   * une fois bâti ; à la zone, la sorte de zone que le rectangle tiré pose, pièce, déclencheur, repos ou piège
   * (`validerRectangle`) ; à l'emprise d'une zone d'effet, armée de son inspecteur, ajouter ou retirer les cases que le
   * pinceau couvre (`paintEffectZone`), et la terminer
   */
  'editeur.options': (Choix | Ligne | Bouton)[];
  /**
   * un choix des couches de la vue de la scène, celles que posent les ponts de ses navires comprises (`vueDeLaScene`),
   * l'éditée pressée ; ajouter une couche au-dessus de la plus haute ; retirer la couche éditée, refusé au rez et sur
   * une couche que seuls les ponts d'un navire posent
   */
  'editeur.couches': (Choix | Bouton)[];
  /** annuler, rétablir, refusés sans cran */
  'editeur.historique': Bouton[];
  /**
   * copier l'entité sélectionnée et la dupliquer sur la case voisine au sud-est, sur sa couche, refusés sans entité
   * sélectionnée ; coller la copie sur la dernière case appuyée, sur la couche éditée, refusé sans copie ou quand cette
   * case est d'une autre couche
   */
  'editeur.presse': Bouton[];
  /**
   * enregistrer, refusé hors du dépôt, pendant un enregistrement en cours, et sur les scènes que le dépôt porte déjà ;
   * « Tester la scène », `{ geste: 'tester' }`, qui passe le projet, ses scènes à jour, par la porte, refusé avec la
   * raison de la porte (`essaiDeLaScene`), et rend `essai: true` : le lancement du projet, la scène éditée à l'entrée,
   * les autres scènes, sa carte et son narratif, joué par le groupe vitrine (`groupeVitrine`), qu'ouvre `demarrer {
   * essai: true }` ; la session reste telle quelle
   */
  'editeur.fichier': Bouton[];
  /**
   * la dernière case appuyée : sa couche, son terrain, sa hauteur, lus sur la vue, puis son parapet crénelé s'il en porte un ; puis
   * l'arête sélectionnée : sa case, son côté, sa couche, porte, fenêtre ou mur, et son matériau ; ou l'entité
   * sélectionnée, sa sorte, son nom (`nomDEntite`, sinon sa sorte), sa case et sa couche ; ou l'entrée sélectionnée,
   * son nom, sa case et sa couche ; ou la zone, la partie ou la masse de toiture sélectionnée, sa sorte, son nom, son
   * rectangle et sa couche
   */
  'editeur.pointee': Ligne[];
  /**
   * l'inspecteur de la sélection ; sans elle, celui de la scène : le formulaire qui la nomme, celui qui change son
   * identifiant, celui qui la décrit, sa largeur et sa hauteur en cases à la réglette (au moins 5, `resizeGrid`), les
   * entrées de fiche qu'elle couvre comme celles d'une zone, de même ses groupes de lieu parmi ceux du schéma
   * (`groupesDuLieu`), son ambiance (`AMBIANCES`), son échelle en mètres par case à la réglette (au moins 1), sa
   * lumière ambiante en liste, automatique ou l'une de `lightLevels`, son nord à la réglette au pas de 15° ou vers le
   * haut du plan, son environnement (`ENVIRONNEMENTS`) et sa météo en liste (`METEOS`), chacun non spécifié ou l'un des
   * siens, sa musique d'ambiance et de combat en liste, chacune automatique, silence ou l'une du catalogue
   * (`allMusicDefs`), le formulaire de son message de départ, `{ type: 'introduire', args: [texte] }`, sa saisie
   * `saisieMultiligne`, la matière de chaque partie de relief (`PARTS_RELIEF`) en liste parmi `matieresDe('relief')`,
   * sa toiture par défaut, couverture en liste, pente et comble à la réglette, son repos sur place, ses lieux et sa
   * qualité piètre, ses drapeaux de départ, chacun pressé s'il est vrai, que sa pression bascule, puis en liste, à
   * retirer, et le formulaire qui en ajoute un, vrai, puis ses ancres de bataille : de chacune sa Scène de Round en
   * liste (`ciblesDAncreDeBataille`), sa case, la poser à la case pointée, refusé sans case pointée, la retirer, puis
   * en liste chaque Scène de Round à ancrer.
   *
   * Chaque bouton joue `{ geste: 'scene', patch }` (`PatchDeScene`), `patch` portant `scalaires` (`desc`, `ambiance`,
   * `weather`, `couvre`, `groups`, `metresPerTile`, `ambientLight`, `environment`, `null` retirant le champ),
   * `dimensions`, `nord` (`null` : vers le haut du plan), `relief`, `toiture`, `repos` (`lieux`, `pietre`), `drapeaux`
   * (`null` retirant le drapeau), `musique` (`{ piste, id }`, `id` `null` : silence, absent : automatique), `message`
   * (le texte de départ, vide le retirant avec sa provenance) ou `stations` (`{ ajouter }`, `{ rang, sceneId?, pos? }`
   * ou `{ retirer }`, refusé à un rang absent).
   *
   * D'une entité : le formulaire qui la nomme, prérempli de son nom d'auteur ; le type d'un décor ou la fiche d'un
   * personnage du bestiaire, en liste ; son cap parmi ceux que son type admet (`capsOfferts` : les cardinaux d'un
   * décor volumique ou d'un navire à ponts) ; sa couche ;
   *
   * d'un décor, sa lumière, allumée ou éteinte, son rayon à la réglette (−/+, au pas de 1 m, refusé sous 1 m) et son
   * ton en liste, celui du type ou chaque ton de `lightTones`, puis, si son type porte des places (`seatSlotsOf`), son
   * assise et chaque place en liste, tenue par personne, par un personnage de la scène ou par un emplacement du groupe
   * (`labelEmplacement`), chaque occupant refusé avec la raison d'`assoirALaPlace` ; pour chacune de ses actions
   * authorées, le formulaire qui change son identifiant, `{ type: 'identifier', args: [action, id] }`, l'action
   * désignée par son identifiant en vigueur, refusé vide ou déjà porté par une autre action du décor
   * (`renameActionAuthoree`) ; puis le formulaire tiré du schéma de son type, ses actions (`usable.actions`), chacune
   * neuve sous le premier identifiant libre (`actionNeuve`), écrite champ par champ, son identifiant excepté ;
   *
   * d'un emplacement de siège, l'engin de son poste en liste, son arc, omni ou l'un des quatre, ses servants parmi les
   * personnages de la scène et, parmi eux, le chef de pièce ; d'un emplacement ou d'une coque, son équipage exposé ;
   *
   * d'un personnage, son inventaire d'auteur (`inventaire`, chaque objet du catalogue par son id, vrai s'il est
   * porté) : chaque objet sur sa ligne `inventaire/<id>`, nommé du catalogue, « Porté » pour un objet qui se porte
   * (`isWearable`), pressé s'il l'est, que sa pression bascule en ôtant les pièces qu'il chevauche (`inventaireApres`,
   * `equipConflicts`), et « Retirer », ou une ligne qui dit qu'il n'en a aucun, puis, en liste, chaque objet du
   * catalogue instanciable (`trappingsInstanciables`) qu'il n'a pas, à ajouter, non porté ;
   *
   * d'un personnage d'une fiche du bestiaire sans profil d'auteur ni préréglage, son parcours de carrière (EDO 11
   * l.17-21, `porterAuParcours`) : chaque carrière portée, la dernière l'actuelle, ses Niveaux en boutons
   * `carriere/<carrière>/niveau/<n>`, l'atteint pressé, et « Retirer », la carrière actuelle retirée avec ses dotations
   * choisies ; pour chaque Niveau atteint, en liste, chaque Talent qu'il offre (`talentsDuParcours` : ses emplacements,
   * et ce qu'ajoute un Talent désigné à un Niveau antérieur), pressé s'il est désigné ; chaque emplacement de
   * Compétence « Au choix » des Niveaux atteints, en liste, « Tiré » ou chaque Compétence qu'il admet et qu'un autre
   * emplacement ne tient pas (`prisParLesAutres`) ; en liste, chaque carrière qu'il ne porte pas, à ajouter au Niveau 1
   * comme l'actuelle, les dotations choisies retirées, refusé avec la raison s'il porte une tenue d'auteur ; chaque
   * dotation au choix des Niveaux atteints de la carrière actuelle (`dotationsDuPnj`, `emplacementsDeDotation`), d'id
   * `carriere/dotation/<adresse>`, « Tiré » ou chacune de ses valeurs (`valeursDeLEmplacement`), la branche choisie
   * suivie de ses propres choix ;
   *
   * d'un personnage porteur d'une fiche, son entité de son schéma (`ficheEditee`), son profil porté
   * (`ficheDuCombattant`) : d'un PNJ de carrière, le Niveau atteint et son Statut, puis ses Caractéristiques et ses
   * Blessures, ses Compétences, ses Talents et ses possessions, chacun sur sa ligne `profil/<clé>`, puis ses mentions,
   * une ligne `profil/mentions/<nature>` par nature ;
   *
   * d'un personnage qui a une fiche, ses sorts (#3715), lus sur elle : ceux que son profil imprime, sur la ligne
   * `sorts/imprimes` ; sinon, s'il a une liste qu'ouvrent ses Talents ou Traits de lanceur (`listesDeSorts`), ses sorts
   * au combat, choisis et tirés (`sortsDuPnj`), sur la ligne `sorts/connus`, les sorts choisis s'écrivant au formulaire
   * tiré du schéma ;
   *
   * puis chaque rencontre de la scène, enrôlé, ennemi ou allié, et piloté par l'IA s'il est allié, et l'enrôler dans
   * une rencontre neuve ;
   *
   * le formulaire qui en pose une troupe, `{ type: 'troupe', args: [nombre] }`, sa saisie `saisieNombre` de 2 à 30
   * copies (`BORNES_DE_LA_TROUPE`) ;
   *
   * de toute entité, les entrées de fiche qu'elle couvre, comme celles d'une zone, sous `entite/couvre` ;
   *
   * d'un personnage, le formulaire tiré du schéma de son type (`formulaireDe('entite', …)`), comme celui d'une zone
   * d'effet, dans sa scène et le narratif du projet (`cadreDeLaSession`) : son preset (`presetId`) s'il en porte un ou si le narratif en déclare ;
   * son dialogue (`dialogueId`) s'il en porte un ou si sa scène en déclare ; de son
   * rôle au combat (`combat`) ses options, ses Compétences, le tirage de ses Caractéristiques, son embuscade et, s'il en
   * porte ou si sa fiche ouvre une liste de sorts sans imprimer les siens, ses sorts choisis (`combat.spells`) ; son
   * profil personnalisé (`statblock`), champ par champ ; puis sa contrepartie d'amateur des arts (`amateur`), son
   * marchand (`merchant`), son jeu de taverne (`tavernGame`), son
   * apparence (`appearance`), sans tenue pour un PNJ de carrière, ses couleurs par emplacement de palette, son
   * animation (`anim`) et, d'une coque, son véhicule (`vehicule`), ses Améliorations (`upgrades`) et ses postes (`postes`),
   * au contexte de sa fiche (`choixDuChamp`) : un preset, chacun de ceux que le narratif déclare, par son nom (toute référence narrative
   * offre les entrées du registre qu'elle désigne, `entreesNarratives`) ; un dialogue, chacun de ceux que sa scène
   * déclare (`dialoguesDeLaScene`) ; un poste neuf ou la pièce d'un poste, chaque engin de siège (`siegeEngines`), un
   * servant, chaque personnage de la scène sans coque hors des autres servants de la coque, une munition du coffre,
   * chacune que charge sa pièce (`chargeLArme`), sa munition choisie, chacune de son coffre ; le profil absent, « Ajouter » choisit un profil
   * neuf au nom du personnage (`emptyStatblock`) ou la copie de sa créature du Bestiaire (`statblockDeLaCreature`) ;
   * l'identifiant d'une option offre tous les Traits (LDB 76 l.11), les Facultatifs de la fiche puis les Traits standard
   * en tête (LDB 76 l.35), et une option, le Trait ou une note « swap » de la fiche posée entière, que le formulaire
   * édite ensuite ; un sort choisi, chaque sort d'une liste qu'ouvre sa fiche hors des autres choisis, refusé avec sa
   * raison au-delà d'un quota du livre (`refusDesSortsChoisis`) ; l'apparence de ses objets, chacune de ses armes qui
   * admet une autre apparence que sa forme, enrôlé s'il est membre d'une rencontre, puis l'une de ces apparences ; la
   * supprimer.
   *
   * Chaque bouton joue `{ geste: 'entite', patch }`, `patch` portant `ref`, `facing`, `z`, `light` (`null` l'éteint),
   * `assise`, `objet` (l'intention sur un objet de l'inventaire, `{ porter }`, `{ retirer }` ou `{ ajouter }`,
   * appliquée par `inventaireApres`, `src/engine/items.ts`, l'inventaire vidé retiré), `parcours` (le parcours entier,
   * `parcoursRetouche`, sans carrière le retirant), `crewIds` ou `couvre` (`null` : aucune) ; ou, du formulaire tiré du schéma, `{ geste: 'valeur', porteur:
   * { sorte: 'entite', id }, chemin, valeur? }` ; `{ geste: 'place', place, occupant }` (`occupant` nul libère la
   * place) ; `{ geste: 'poste', patch }`, `patch` portant `engin`, `arc` (`null` : omni) ou `servants`, le chef en
   * tête ; ou `{ geste: 'membre', patch: { rencontre, enrole?, camp?, ia? } }`, `rencontre` nulle pour une rencontre
   * neuve.
   *
   * D'une entrée : le formulaire qui la renomme, sa couche (`{ geste: 'entree', z }`), la supprimer.
   *
   * D'une zone : la poignée qui la redimensionne ; d'un déclencheur, le formulaire qui le renomme ; d'une zone d'effet,
   * le formulaire qui la nomme et celui qui change son identifiant, sa nature (non déclarée, intérieur ou extérieur),
   * sa forme (rectangle ou disque), son emprise au pinceau et l'aire rendue entière, refusée sans découpe, si elle
   * coupe la ligne de vue, si elle barre le passage à tous ; sa couche ; d'un déclencheur, s'il ne joue qu'une fois ;
   * d'un déclencheur ou d'une zone d'effet, les entrées de fiche qu'il couvre (`couvre`), chacune sur sa ligne, son
   * texte coupé au mot, puis en liste, à retirer, ou une ligne qui dit qu'il n'en couvre aucune, puis, en liste, chaque
   * entrée des fiches commitées qu'il ne couvre pas (`ENTREES_DE_DOSSIER`), à couvrir ;
   *
   * d'une zone d'effet encore, le formulaire tiré du schéma de son Test de traversée (`crossTest`) et de ses effets à
   * la traversée (`onCross`) et à chaque Round (`perRound`), d'un déclencheur, celui de sa condition d'entrée (`when`)
   * et de son flux (`flow`), chaque élément d'id `valeur/<chemin>`, un élément de liste sous le rang de son chemin : un objet
   * présent, sa ligne titre, ses champs, puis « Retirer » si son absence est admise ; absent, « Ajouter », qui pose sa
   * valeur neuve (ses seuls champs requis) ;
   *
   * une union dont chaque variante est nommée (`unionDuNoeud`, `src/noyau/codex/editFields.ts` : une Condition, une op,
   * toute union discriminée, ou qui se lit à la présence de son discriminant, ou sans discriminant, à la forme de ses
   * branches, comme une formule, son nombre et chacune de ses formes), le choix de sa variante, d'id `valeur/<chemin>/<discriminant>`
   * (`valeur/<chemin>/forme` sans discriminant), chaque variante posant sa valeur neuve (`variantesAChoisir`,
   * `src/noyau/valeursNeuves.ts` : `recast` pour une Condition, qui enveloppe la courante sous ET, OU, NON ; `newOp`
   * pour une op), la courante pressée, précédées de « Aucune » si son absence est admise, puis les champs de la
   * variante courante, sans son discriminant, ou le choix de sa propre union sous le même chemin ;
   *
   * une op sans forme déclarée (`OPS_NON_TYPEES`, #1468), une ligne qui le dit puis la saisie JSON de l'op entière ;
   * d'une variante hors objet, la saisie de sa valeur (le nombre d'une formule, au pas de 1 s'il est entier) ; un objet
   * d'une union sans variantes nommées, sa ligne titre et les champs de la branche qu'il dessine (`formeAuPoint`) ;
   *
   * une liste présente, sa ligne titre, puis chaque élément, ses éléments, « Retirer » et, hors du premier, « Monter »,
   * enfin « Ajouter », qui pose un élément neuf en fin, ou, d'un élément à choix, le choix de l'élément ajouté en fin,
   * parmi ceux que son contexte pose au rang neuf, chacun de ces boutons écrivant la liste entière (`gestesDeLaListe`),
   * et absente, « Ajouter » seul ;
   *
   * un choix, une énumération, un booléen, un littéral ou une référence au catalogue de son type, sa sous-liste
   * comprise, chaque option jouée d'un bouton, en liste au-delà de `CHOIX_EN_BOUTONS`, précédées de « Aucune » si son
   * absence est admise ;
   *
   * un nombre, un texte, ou du JSON pour une union sans variantes nommées, un dictionnaire ou tout autre nœud, un
   * formulaire de verbe `valeur`, ses deux saisies posées (`fixe`) le porteur et le chemin, puis sa saisie
   * (`saisieNombre`, au pas de 1 s'il est entier, `saisieTexte`, `saisieJson`), un texte ou un JSON laissé vide
   * retirant le champ, et « Retirer » pour un nombre présent dont l'absence est admise ;
   *
   * d'une zone de repos, chacun de ses lieux (auberge, chez soi, camper) et sa qualité piètre ; la supprimer.
   *
   * Chaque bouton joue `{ geste: 'zone', patch }` (`patchZone`, `src/noyau/sceneEdit.ts`), `patch` portant `z`, `once`,
   * `lieux`, `pietre`, `presentation` (`null` : non déclarée), `forme`, `pleine`, `blocksLoS`, `barrier` ou `couvre`
   * (`null` : aucune), ou, du formulaire tiré du schéma, `{ geste: 'valeur', porteur, chemin, valeur? }`.
   *
   * D'un corps : le formulaire qui le nomme, son type de bâtiment en liste, sans type ou chaque type de
   * `buildingsMeta`, son nombre d'étages ; sa toiture : celle qui s'applique (`toitureEffective`), puis son profil en
   * liste, qui suit la portée ou l'un de `PROFILS_DE_TOIT`, le côté d'égout bas d'un appentis, à déclarer ou l'un des
   * quatre côtés, sa pente (au pas de 5°, entre `PENTE_TOIT_DEG`) et son comble (au pas d'un étage, au moins un) à la
   * réglette, chacun avec « Suit », et sa couverture en liste, qui suit ou l'une de `matieresCouvrantes` ; chacune de
   * ses exclusions de toiture, à retirer ;
   *
   * d'un étage : sa couche, les pièces de sa couche qu'il révèle, chacune pressée si elle l'est ;
   *
   * d'une façade : son apparence en liste (`FACADE_APPEARANCE_IDS`), son étage parmi ceux du corps, chacune de ses
   * ouvertures (sa sorte en liste, `SORTES_D_OUVERTURE` ; sa position et sa largeur le long de l'arête à la réglette,
   * au pas de 5 %, entre `BORNES_D_OUVERTURE`, ou le défaut du rendu, `DEFAUTS_D_OUVERTURE` ; son apparence en liste,
   * le défaut ou l'une du catalogue de sa sorte (`apparencesDeLOuverture`) ; la retirer), en ajouter une, refusé sans
   * arête, et les pièces de son étage qu'elle révèle ;
   *
   * d'une partie ou d'une masse de toiture : la poignée qui la redimensionne ; d'une masse, son étage sommet parmi ceux
   * du corps, ses niveaux à la réglette (au moins un), son profil, l'axe de son faîtage (long axe, X ou Y), le côté
   * d'égout bas d'un appentis, sa pente à la réglette et sa couverture ; chacun se supprime, l'étage sauf le dernier du
   * corps.
   *
   * Chaque bouton joue `{ geste: 'architecture', patch }`, `patch` portant `style` (`null` : sans type), `pieces`,
   * `apparence`, `z`, `toiture` (les champs de l'intention de toiture, `null` : suit), `retirerExclusion` (le rang de
   * l'exclusion) ou `masse` (`levels`, `profile`, `pitchDeg`, `material`, `ridge` et `eaveSide`, `null` : le long axe,
   * à déclarer) ; ou `{ geste: 'baie', id, patch }`, `id` nul pour en ajouter une, `patch` nul pour la retirer, sinon
   * portant `sorte`, `position`, `largeur` ou `apparence` (`null` : le défaut).
   *
   * D'une arête : cloison ou porte ; d'une porte, fermée au départ, refusé sur une porte secrète, et secrète, sa
   * difficulté de Perception et sa face découvrable ; d'une cloison, fenêtre, volets clos, franchissable, la hauteur
   * d'allège et la chute suspendue, chacune à la réglette (−/+, au pas de 0,1 m et de 0,5 m) ; son matériau, son
   * apparence, son escalade, d'une paroi sa difficulté et le talent Grimpeur ; la supprimer.
   *
   * Chaque bouton joue `{ geste: 'arete', patch?, brouillon? }`, `null` retirant un champ ; ce que le schéma exige sans
   * défaut, la difficulté et la face d'une porte secrète, l'allège d'une croisée franchissable, attend au brouillon de
   * la session, dit en alerte, jusqu'à s'écrire entier
   */
  'editeur.inspecteur': (Choix | Ligne | Bouton | Formulaire)[];
  /**
   * la validation de la scène éditée, celles du projet relues avec elle (`avertissementsDeLaSession`,
   * `validateScene`) : le compte de ses erreurs et avertissements, ou ce qu'elle contrôle sans défaut ; puis chacun, au
   * plus vingt, en ligne `validation/<rang>`, erreur ou avertissement, suivi de « Y aller » s'il désigne un fautif de
   * la carte (`versLaFautive` : un défaut de plan, un ouvrage d'architecture, une entité ou un déclencheur), qui joue
   * `{ geste: 'avertissement', rang }` : sa couche éditée, un défaut de plan suivi à l'outil de sélection, sa zone
   * d'effet sélectionnée s'il en vise une, l'ouvrage sélectionné à l'outil d'architecture, l'entité ou le déclencheur
   * sélectionné à l'outil de sélection ; puis le nombre des autres
   */
  'editeur.validation': (Ligne | Bouton)[];
  /**
   * le calque de référence de la couche éditée : sa couche ; pendant un chargement, la planche à choisir ; sans calque,
   * « Charger une planche… » ; pendant le calage, l'étape à cliquer, un point de l'image ou son nœud de grille, et
   * « Annuler le calage » ; sinon visible, au-dessus ou en dessous, l'opacité à la réglette (−/+, au pas de 10 %),
   * l'échelle de son calage en pixels par case, la rotation que le calage déduit, « Caler par deux points », refusé au
   * calque caché, « Remplacer la planche… » et « Retirer le calque » ; des calques gardés d'un autre format, retirés à
   * l'ouverture, dits en alerte
   */
  'editeur.calque': (Choix | Ligne | Bouton)[];
}

/** Ce que l'éditeur repère sur la carte de la couche éditée : une entité (sa sorte, `kind`) ou une entrée, son id, sa
 *  case, son nom, et si elle est sélectionnée. */
export interface RepereDeLEdition {
  sorte: 'prop' | 'personnage' | 'heroStart' | 'entree';
  id: string;
  x: number;
  y: number;
  z: number;
  nom: string;
  choisi: boolean;
}

/** Les sortes de zone de l'éditeur : un déclencheur, une zone de repos, une pièce (`isRoomZone`), toute autre zone
 *  d'effet, une partie ou une masse de toiture d'un corps. */
export type SorteDeZone = 'declencheur' | 'repos' | 'piece' | 'zone' | 'partie' | 'masse';

/** Une zone de la couche éditée sur la carte, ou le défaut de plan suivi depuis la validation : sa sorte, son nom, ses
 *  cases et si elle est sélectionnée. */
export interface ZoneDeLEdition {
  sorte: SorteDeZone | 'defaut';
  nom: string;
  cases: { x: number; y: number; z: number }[];
  choisi: boolean;
}

/** Les cases que le geste en cours trace sur la carte, chacune sur sa couche : le rectangle tiré, ou les cases que le
 *  pinceau a couvertes, que le monde ne montre qu'au relâché, puis le tracé de la volée ; l'arête sélectionnée, sur
 *  la couche éditée ; les repères et les zones de cette couche ; la case de la poignée qui redimensionne la sélection
 *  (`poigneeDeLaSelection`), `null` sans elle. */
export interface SurcoucheDeLEdition {
  cases: { x: number; y: number; z: number }[];
  arete: AreteDessinee | null;
  reperes: RepereDeLEdition[];
  zones: ZoneDeLEdition[];
  poignee: { x: number; y: number; z: number } | null;
}

/** Le calque de la couche éditée tel que l'hôte le pose sur le monde : la planche qu'il garde (`cheminDeLaPlanche`),
 *  ses quatre coins sur la carte (`coinsDuCalque`), son plan en mètres (`planDuCalque`), son opacité, et s'il passe
 *  au-dessus de la scène construite. */
export interface CalqueAffiche {
  image: string;
  coins: { x: number; y: number }[];
  plan: number;
  opacite: number;
  dessus: boolean;
}

/** Les sortes d'arête que pose l'outil murs. */
const PEINTURES: readonly WallPaint[] = ['wall', 'door', 'diagBack', 'diagFwd'];

const bouton = (id: string, libelle: string, edition: GesteDEdition, presse = false, refus: string | null = null): Bouton => ({
  type: 'bouton', id, libelle, jeu: { edition }, presse, focus: false, refus,
});

const choix = (id: string, libelle: string, valeurs: Bouton[], type: Choix['type'] = 'choix'): Choix => ({
  type, id, ton: 'neutre', libelle, focus: false, refus: null, valeurs,
});

/** Les options de la volée de la session `s` : l'étage qu'elle rejoint, son tracé, ses cotes si son plan tient, sinon,
 *  une case tracée, la raison du plan, en clair ; la poser (refusée avec cette raison) et effacer son tracé. */
function optionsDeLaVolee(s: SessionDEdition, toZ: number): (Choix | Ligne | Bouton)[] {
  const plan = planDeLaVolee(s)!;
  const etages = couchesDeLaVue(s)
    .map((z) => bouton(`etage/${z}`, t('ecran.editeur.couche', { z }), { geste: 'outil', outil: { mode: 'escalier', toZ: z } }, toZ === z));
  const arrondi = (m: number) => Math.round(m * 100) / 100;
  return [
    choix('etages', t('ecran.editeur.volee.etage'), etages),
    ligne('trace', t('ecran.editeur.volee.trace', { n: s.volee.length, s: pluriel(s.volee.length) })),
    ...(plan.ok ? [ligne('plan', t('ecran.editeur.volee.cotes', { de: arrondi(plan.from), a: arrondi(plan.to), cotes: plan.steps.map((p) => arrondi(p.height)).join(' · ') }))]
      : s.volee.length ? [ligne('plan', plan.reason)] : []),
    bouton('volee/poser', t('ecran.editeur.volee.poser'), { geste: 'poserVolee' }, false, plan.ok ? null : plan.reason),
    bouton('volee/effacer', t('ecran.editeur.volee.effacer'), { geste: 'effacerVolee' }, false, s.volee.length ? null : t('ecran.editeur.volee.vide')),
  ];
}

/** Les options de l'outil actif : la taille du pinceau (et le rectangle du terrain), puis les terrains, les hauteurs ou
 *  la structure du parapet, ou la gomme de sa marque ; la sorte et le matériau d'une arête ; la volée ; la sorte de
 *  zone à tracer ; le sens du pinceau d'emprise et sa fin ; le type et le cap du navire à poser. La gomme n'en a
 *  aucune : elle efface la chose de la case. */
function options(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const outil = s.outil;
  if (outil.mode === 'selection' || outil.mode === 'gomme' || outil.mode === 'entree' || (outil.mode === 'entite' && outil.kind === 'heroStart')) return [];
  if (outil.mode === 'escalier') return optionsDeLaVolee(s, outil.toZ);
  if (outil.mode === 'zone') {
    return [choix('zones', t('ecran.editeur.zones'),
      ZONE_VARIANTS.map((zone) => bouton(`zone/${zone}`, t(`ecran.editeur.zone.${zone}`), { geste: 'outil', outil: { mode: 'zone', zone } }, outil.zone === zone)))];
  }
  if (outil.mode === 'architecture') return optionsDArchitecture(s, outil.action);
  if (outil.mode === 'casesDeZone') return [...emprise(outil.zoneId, outil), bouton('emprise/finir', t('ecran.editeur.zone.emprise.finir'), { geste: 'outil', outil: { mode: 'selection' } })];
  if (outil.mode === 'emplacement') {
    return [choix('engins', t('ecran.editeur.engins'),
      siegeEngines().map((e) => bouton(`engin/${e.id}`, e.label, { geste: 'outil', outil: { mode: 'emplacement', trappingId: e.id } }, outil.trappingId === e.id)), 'liste')];
  }
  if (outil.mode === 'navire') {
    const scene = sceneEditee(s);
    return [
      choix('navires', t('ecran.editeur.navires'), TYPES_DE_NAVIRE.map(({ id, label }) =>
        bouton(`navire/${id}`, label, { geste: 'outil', outil: { ...outil, ref: id } }, outil.ref === id, refusDuNavire(scene, id))), 'liste'),
      choix('navire/cap', t('ecran.editeur.entite.cap'), CAPS_DES_PONTS.map((cap) =>
        bouton(`navire/cap/${cap}`, t(`ecran.editeur.cap.${cap}`), { geste: 'outil', outil: { ...outil, cap } }, outil.cap === cap))),
    ];
  }
  if (outil.mode === 'entite') {
    const kind = outil.kind;
    const offerts = kind === 'prop' ? props : fichesDePersonnage();
    return [choix(kind === 'prop' ? 'decors' : 'fiches', t(kind === 'prop' ? 'ecran.editeur.decors' : 'ecran.editeur.fiches'),
      offerts.map((o) => bouton(`${kind}/${o.id}`, o.label, { geste: 'outil', outil: { mode: 'entite', kind, ref: o.id } }, outil.ref === o.id)), 'liste')];
  }
  const pinceaux = PINCEAUX.map((n) => bouton(`pinceau/${n}`, t('ecran.editeur.pinceau.taille', { n }), { geste: 'pinceau', taille: n }, s.pinceau === n && !s.rectangle));
  if (outil.mode === 'terrain') {
    const rectangle = bouton('pinceau/rectangle', t('ecran.editeur.pinceau.rectangle'), { geste: 'rectangle', actif: !s.rectangle }, s.rectangle);
    const terrains = terrainIds().map((id) => bouton(`terrain/${id}`, terrainLabel(id), { geste: 'outil', outil: { mode: 'terrain', terrain: id } }, outil.terrain === id));
    return [choix('pinceau', t('ecran.editeur.pinceau'), [...pinceaux, rectangle]), choix('terrains', t('ecran.editeur.terrains'), terrains, 'liste')];
  }
  if (outil.mode === 'arete') {
    const peintures = PEINTURES.map((paint) => bouton(`arete/${paint}`, t(`ecran.editeur.arete.${paint}`), { geste: 'outil', outil: { mode: 'arete', paint } }, outil.paint === paint));
    const posables = structuresDeLArete(outil.paint);
    if (!posables.length) return [choix('aretes', t('ecran.editeur.aretes'), peintures)];
    const structuresDeLOutil = [
      bouton('structure/defaut', t('ecran.editeur.structure.defaut'), { geste: 'outil', outil: { mode: 'arete', paint: outil.paint } }, outil.structure === undefined),
      ...posables.map((st) => bouton(`structure/${st.id}`, st.label, { geste: 'outil', outil: { mode: 'arete', paint: outil.paint, structure: st.id } }, outil.structure === st.id)),
    ];
    return [choix('aretes', t('ecran.editeur.aretes'), peintures), choix('structures', t('ecran.editeur.structures'), structuresDeLOutil, 'liste')];
  }
  if (outil.mode === 'crenelage') {
    const parapets = [
      ...structuresCrenelables().map((st) => bouton(`crenelage/${st.id}`, st.label, { geste: 'outil', outil: { mode: 'crenelage', structure: st.id } }, outil.structure === st.id)),
      bouton('crenelage/gomme', t('ecran.editeur.crenelage.gomme'), { geste: 'outil', outil: { mode: 'crenelage', structure: null } }, outil.structure === null),
    ];
    return [choix('pinceau', t('ecran.editeur.pinceau'), pinceaux), choix('parapets', t('ecran.editeur.crenelage'), parapets, 'liste')];
  }
  const hauteurs = HAUTEURS.map((h) => bouton(`hauteur/${h.cle}`, `${t(`ecran.editeur.hauteur.${h.cle}`)} (${h.metres} m)`, { geste: 'outil', outil: { mode: 'hauteur', metres: h.metres } }, outil.metres === h.metres));
  return [choix('pinceau', t('ecran.editeur.pinceau'), pinceaux), choix('hauteurs', t('ecran.editeur.hauteurs'), hauteurs)];
}

/** La ligne de l'arête sélectionnée de la session `s` : sa case, son côté, sa couche, sa sorte et sa structure. */
function ligneDeLArete(s: SessionDEdition): Ligne[] {
  const seg = segmentDeLaSelection(sceneEditee(s), s.sel);
  if (!seg) return [];
  const sorte = porteAuteur(seg) ? 'porte' : seg.window ? 'fenetre' : 'mur';
  const structure = libelleDeStructure(seg.structure) ?? t('ecran.editeur.structure.defaut');
  return [ligne('arete', t('ecran.editeur.areteChoisie', { x: seg.x, y: seg.y, cote: seg.side, z: seg.z ?? 0, sorte: t(`ecran.editeur.sorte.${sorte}`), structure }))];
}

/** Le nom de l'entité `ent` de la scène éditée de `s` : celui que l'auteur lui donne, celui de sa fiche
 *  (`nomDEntite`), ou sa sorte. */
const nomALEcran = (s: SessionDEdition, ent: Scene['entities'][number]): string =>
  nomDEntite(ent, presetDuNarratif(s.projet.narratif)) ?? t(`ecran.editeur.entite.${ent.kind}`);

/** L'entrée sélectionnée de la session `s` : son nom et sa case, `undefined` hors d'une entrée sélectionnée. */
function entreeDeLaSelection(s: SessionDEdition): { nom: string; x: number; y: number; z: number } | undefined {
  const pos = s.sel?.type === 'entry' ? sceneEditee(s).entryPoints?.[s.sel.id] : undefined;
  return pos && s.sel?.type === 'entry' ? { nom: s.sel.id, x: pos.x, y: pos.y, z: pos.z ?? 0 } : undefined;
}

/** Les options de l'outil d'architecture de la session `s`, à l'action `action` : le corps actif parmi ceux de la
 *  scène, sélectionner ou poser une façade (refusée sans corps), et chaque ouvrage à bâtir, refusé avec sa raison. */
function optionsDArchitecture(s: SessionDEdition, action: (typeof ACTIONS_D_ARCHITECTURE)[number]): (Choix | Bouton)[] {
  const corps = sceneEditee(s).architecture ?? [];
  const actif = corpsActif(s);
  return [
    ...(corps.length ? [choix('corps', t('ecran.editeur.corps'), corps.map((c) => bouton(`corps/${c.id}`, c.label ?? c.id, { geste: 'corps', id: c.id }, c.id === actif?.id)))] : []),
    choix('architecture/action', t('ecran.editeur.architecture.action'), ACTIONS_D_ARCHITECTURE.map((a) =>
      bouton(`architecture/${a}`, t(`ecran.editeur.architecture.${a}`), { geste: 'outil', outil: { mode: 'architecture', action: a } }, action === a, a === 'selection' || actif ? null : t('ecran.editeur.ouvrage.refus.sansCorps')))),
    ...OUVRAGES.map((o) => {
      const refus = refusDOuvrage(s, o);
      return bouton(`batir/${o}`, t(`ecran.editeur.ouvrage.${o}`), { geste: 'batir', ouvrage: o }, false, refus && t(`ecran.editeur.ouvrage.refus.${refus}`));
    }),
  ];
}

/** La ligne de l'entité, de l'entrée ou de la zone sélectionnée de la session `s` : sa sorte, son nom, sa case (le
 *  rectangle d'une zone) et sa couche. */
function ligneDeLaSelection(s: SessionDEdition): Ligne[] {
  const ent = entiteDeLaSelection(sceneEditee(s), s.sel);
  if (ent) return [ligne('entite', t('ecran.editeur.entite', { sorte: t(`ecran.editeur.entite.${ent.kind}`), nom: nomALEcran(s, ent), x: ent.pos.x, y: ent.pos.y, z: ent.z ?? 0 }))];
  const entree = entreeDeLaSelection(s);
  if (entree) return [ligne('entree', t('ecran.editeur.entree', entree))];
  const zone = [...zonesLues(sceneEditee(s)), ...ouvragesLus(s)].find((z) => sameSel(z.sel, s.sel));
  return zone ? [ligne('zone', t('ecran.editeur.zone.choisie', { sorte: t(`ecran.editeur.zone.sorte.${zone.sorte}`), nom: zone.nom, ...zone.rect, z: zone.z }))] : [];
}

/** Le formulaire qui nomme la sélection de la session `s` (`{ geste: 'nommer', nom }`), son champ prérempli de `nom`,
 *  vide sans nom d'auteur. */
const formulaireDuNom = (nom: string | undefined, optionnel: boolean): Formulaire => ({
  type: 'formulaire', id: 'nommer', libelle: t('ecran.editeur.entite.nommer'), verbe: 'nommer', focus: false, refus: null,
  champs: [{ type: 'saisieTexte', id: 'nommer/nom', ton: 'neutre', nom: 'nom', optionnel, libelle: t('ecran.editeur.entite.nom'), valeur: nom ?? '' }],
});

/** Le formulaire de verbe `verbe`, à un champ texte `nom` prérempli de `valeur`. */
const formulaireAUnChamp = (verbe: string, libelle: string, nom: string, intitule: string, valeur: string, optionnel: boolean): Formulaire => ({
  type: 'formulaire', id: verbe, libelle, verbe, focus: false, refus: null,
  champs: [{ type: 'saisieTexte', id: `${verbe}/${nom}`, ton: 'neutre', nom, optionnel, libelle: intitule, valeur }],
});

/** Le formulaire qui pose une troupe du personnage sélectionné (`{ type: 'troupe', args: [nombre] }`), son nombre de
 *  copies entre `BORNES_DE_LA_TROUPE`. */
const formulaireDeLaTroupe = (): Formulaire => ({
  type: 'formulaire', id: 'troupe', libelle: t('ecran.editeur.troupe'), verbe: 'troupe', focus: false, refus: null,
  champs: [{ type: 'saisieNombre', id: 'troupe/nombre', ton: 'neutre', nom: 'nombre', optionnel: false, libelle: t('ecran.editeur.troupe.nombre'), valeur: BORNES_DE_LA_TROUPE.min, ...BORNES_DE_LA_TROUPE, pas: 1 }],
});

/** Le formulaire qui change l'identifiant `id` de la sélection, ou de la scène sans elle. */
const formulaireDeLIdentifiant = (id: string): Formulaire =>
  formulaireAUnChamp('identifier', t('ecran.editeur.identifier'), 'id', t('ecran.editeur.identifiant'), id, false);

/** Le formulaire qui change l'identifiant de chaque action authorée du décor `ent` (`renameActionAuthoree`), l'action
 *  désignée par son identifiant en vigueur, en saisie fixe, son champ prérempli de lui. */
const identifiantsDesActions = (ent: Scene['entities'][number]): Formulaire[] => (ent.usable?.actions ?? []).map((a) => {
  const id = `identifier/action/${a.id}`;
  return {
    type: 'formulaire', id, libelle: t('ecran.editeur.action.identifier', { id: a.id }), verbe: 'identifier', focus: false, refus: null,
    champs: [
      { type: 'fixe', id: `${id}/action`, nom: 'action', optionnel: false, valeur: a.id },
      { type: 'saisieTexte', id: `${id}/id`, ton: 'neutre', nom: 'id', optionnel: false, libelle: t('ecran.editeur.identifiant'), valeur: a.id },
    ],
  };
});

/** Par entrée des fiches commitées, son texte coupé au mot. */
const COURT_DE_L_ENTREE = new Map(ENTREES_DE_DOSSIER.map((e) => [e.id, coupeAuMot(e.libelle, 70)]));

/** La liste d'ids `poses` à l'id `id`, tirés du catalogue `catalogue` (le texte de chaque id), dite par les textes
 *  `ecran.editeur.<famille>.*` : une ligne par id posé, son texte, ou la ligne qui dit qu'il n'y en a aucun ; la liste
 *  des ids posés, chacun retiré à son choix ; la liste des ids du catalogue qui ne le sont pas, chacun ajouté à son
 *  choix ; chaque article joue `jeu` des ids posés après lui, `null` pour aucun. */
function listeDIds(id: string, famille: 'zone.couvre' | 'scene.groupes', poses: readonly string[] = [], catalogue: ReadonlyMap<string, string>, jeu: (ids: string[] | null) => GesteDEdition): (Choix | Ligne)[] {
  const reste = (sans: string) => poses.filter((e) => e !== sans);
  return [
    ...(poses.length
      ? [
        ...poses.map((e) => ligne(`${id}/${e}`, t(`ecran.editeur.${famille}.entree`, { id: e, texte: catalogue.get(e) ?? t(`ecran.editeur.${famille}.introuvable`) }))),
        choix(`${id}/retirer`, t(`ecran.editeur.${famille}.retirer`), poses.map((e) => bouton(`${id}/retirer/${e}`, e, jeu(reste(e).length ? reste(e) : null), false)), 'liste'),
      ]
      : [ligne(id, t(`ecran.editeur.${famille}.aucune`))]),
    choix(`${id}/ajouter`, t(`ecran.editeur.${famille}.ajouter`), [...catalogue].filter(([e]) => !poses.includes(e)).map(([e, texte]) =>
      bouton(`${id}/ajouter/${e}`, `${e} — ${texte}`, jeu([...poses, e]), false)), 'liste'),
  ];
}

/** Les entrées de fiche couvertes (`couvre`), à l'id `id` (`listeDIds`), parmi les entrées des fiches commitées. */
const couverture = (id: string, couvre: readonly string[] | undefined, jeu: (couvre: string[] | null) => GesteDEdition): (Choix | Ligne)[] =>
  listeDIds(id, 'zone.couvre', couvre, COURT_DE_L_ENTREE, jeu);

/** Pourquoi le navire du type `ref` ne se pose pas dans `scene` : elle n'est pas à l'échelle de ses ponts
 *  (`aLEchelleDesPonts`) ; `null` s'il s'y pose. */
const refusDuNavire = (scene: Scene, ref: string): string | null =>
  aLEchelleDesPonts(scene, ref) ? null : t('ecran.editeur.navire.echelle', { m: sceneMetresPerTile(scene) });

/** Les couches de la vue de la scène éditée de `s` (`vueDeLaScene`), dans l'ordre. */
const couchesDeLaVue = (s: SessionDEdition): number[] => vueDeLaScene(s).layers.map((l) => l.z).sort((a, b) => a - b);

/** La rangée des couches de la vue de la scène éditée de `s`, la couche `z` pressée, chacune jouant `jeu`. */
const choixDeLaCouche = (s: SessionDEdition, id: string, z: number, jeu: (z: number) => GesteDEdition): Choix =>
  choix(id, t('ecran.editeur.entite.couche'), couchesDeLaVue(s)
    .map((c) => bouton(`${id}/${c}`, t('ecran.editeur.couche', { z: c }), jeu(c), c === z)));

/** L'inspecteur de l'entité sélectionnée de la session `s` : son nom ; le type d'un décor, la fiche d'un personnage du
 *  bestiaire ; son cap parmi ceux que son type admet (`capsOfferts`) ; sa couche ; la lumière, les places et l'identifiant
 *  de chaque action d'un décor ;
 *  le poste d'un emplacement de siège et l'équipage exposé d'une coque ; l'inventaire d'un personnage, son parcours de carrière, son
 *  profil porté, ses sorts, ses rencontres, et le formulaire qui en pose une troupe ; les entrées de fiche qu'elle
 *  couvre ; le formulaire tiré du schéma de son type (`formulaireDe`) ; la supprimer. */
function inspecteurDEntite(s: SessionDEdition, ent: Scene['entities'][number]): (Choix | Ligne | Bouton | Formulaire)[] {
  const fiches = fichesDePersonnage();
  const types = ent.kind === 'prop' ? props : fiches.some((f) => f.id === ent.creature?.id) ? fiches : [];
  const cap = capDeLEntite(ent);
  return [
    formulaireDuNom(ent.label, true),
    ...(types.length ? [choix('entite/type', t(ent.kind === 'prop' ? 'ecran.editeur.entite.type' : 'ecran.editeur.entite.fiche'),
      types.map((o) => bouton(`entite/type/${o.id}`, o.label, { geste: 'entite', patch: { ref: o.id } }, idDuCorps(ent) === o.id)), 'liste')] : []),
    choix('entite/cap', t('ecran.editeur.entite.cap'), capsOfferts(ent).map((c) => bouton(`entite/cap/${c}`, t(`ecran.editeur.cap.${c}`), { geste: 'entite', patch: { facing: c } }, c === cap))),
    choixDeLaCouche(s, 'entite/couche', ent.z ?? 0, (z) => ({ geste: 'entite', patch: { z } })),
    ...(ent.kind === 'prop' ? [...lumiere(ent), ...places(s, ent), ...identifiantsDesActions(ent)] : []),
    ...(ent.postes?.length ? poste(s, ent, ent.postes[0]) : []),
    ...(ent.postes?.length || ent.vehicule
      ? equipe(s, ent, 'equipage', ent.crewIds ?? [], (crewIds) => ({ geste: 'entite', patch: { crewIds } }))
      : []),
    ...(ent.kind === 'personnage' ? [...inventaire(ent), ...carrieres(ent), ...profilDeLEntite(s, ent), ...sorts(s, ent), ...rencontres(s, ent), formulaireDeLaTroupe()] : []),
    ...couverture('entite/couvre', ent.couvre, (couvre) => ({ geste: 'entite', patch: { couvre } })),
    ...elementsDuFormulaire({ sorte: 'entite', id: ent.id }, formulaireDe('entite', ent, cadreDeLaSession(s)), ent as unknown as Record<string, unknown>),
    bouton('entite/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }),
  ];
}

/** Le pas du rayon d'une lumière, en mètres, et son plancher (`light.radiusM`). */
const PAS_DE_RAYON = 1;

/** La lumière du décor `ent` : l'allumer ou l'éteindre ; allumée, son rayon et son ton. */
function lumiere(ent: Scene['entities'][number]): (Choix | Ligne | Bouton)[] {
  const allumer = bouton('lumiere', t('ecran.editeur.lumiere'), { geste: 'entite', patch: { light: ent.light ? null : lumiereAllumee(ent) } }, !!ent.light);
  const l = ent.light;
  if (!l) return [allumer];
  const rayon = (r: number) => ({ geste: 'entite' as const, patch: { light: { ...l, radiusM: r } } });
  return [
    allumer,
    ligne('lumiere/rayon', t('ecran.editeur.lumiere.rayon', { m: l.radiusM })),
    bouton('lumiere/moins', t('ecran.editeur.lumiere.moins'), rayon(l.radiusM - PAS_DE_RAYON), false, l.radiusM - PAS_DE_RAYON < PAS_DE_RAYON ? t('ecran.editeur.lumiere.plancher') : null),
    bouton('lumiere/plus', t('ecran.editeur.lumiere.plus'), rayon(l.radiusM + PAS_DE_RAYON)),
    choix('lumiere/ton', t('ecran.editeur.lumiere.ton'), [
      bouton('lumiere/ton/herite', t('ecran.editeur.lumiere.ton.herite'), { geste: 'entite', patch: { light: { radiusM: l.radiusM } } }, l.tone === undefined),
      ...lightTones.map((ton) => bouton(`lumiere/ton/${ton.id}`, ton.label, { geste: 'entite', patch: { light: { ...l, tone: ton.id } } }, l.tone === ton.id)),
    ], 'liste'),
  ];
}

/** Les personnages de la scène éditée de `s` hors de l'entité `ent`. */
const personnagesHors = (s: SessionDEdition, ent: Scene['entities'][number]) =>
  sceneEditee(s).entities.filter((e) => e.kind === 'personnage' && e.id !== ent.id);

/** Le libellé de chaque équipe d'une entité, et sa consigne sans personnage à y mettre. */
const EQUIPES = {
  equipage: ['ecran.editeur.equipage', 'ecran.editeur.equipage.aucun'],
  'poste/servants': ['ecran.editeur.poste.servants', 'ecran.editeur.poste.servants.aucun'],
} as const;

/** L'équipe `ids` de l'entité `ent` de la session `s` sous l'id `id` : chaque personnage de la scène hors d'elle, pressé
 *  s'il en est, qui l'y ajoute à la fin ou l'en retire (`jeu`) ; sans personnage, la consigne d'en poser. */
function equipe(s: SessionDEdition, ent: Scene['entities'][number], id: keyof typeof EQUIPES, ids: readonly string[], jeu: (ids: string[]) => GesteDEdition): (Choix | Ligne)[] {
  const candidats = personnagesHors(s, ent);
  const [libelle, aucun] = EQUIPES[id];
  if (!candidats.length) return [ligne(id, t(aucun))];
  return [choix(id, t(libelle), candidats.map((c) => {
    const a = ids.includes(c.id);
    return bouton(`${id}/${c.id}`, nomALEcran(s, c), jeu(a ? ids.filter((i) => i !== c.id) : [...ids, c.id]), a);
  }))];
}

/** Les clés d'un occupant de place, sa nature en tête. */
const cleDeLOccupant = (o: SeatOccupant): string => (o.kind === 'groupe' ? `heros-${o.rang}` : o.entityId);

/** L'assise du décor `ent` de la session `s` : l'ouvrir au jeu ; chacune des places que son type porte, tenue par
 *  personne, par un personnage de la scène ou par un emplacement du groupe, chaque occupant refusé avec sa raison. */
function places(s: SessionDEdition, ent: Scene['entities'][number]): (Choix | Bouton)[] {
  const scene = sceneEditee(s);
  const slots = seatSlotsOf(scene, ent.id);
  if (!slots.length) return [];
  const tenues = scene.seatAssignments?.[ent.id] ?? {};
  const occupants: { occupant: SeatOccupant; nom: string }[] = [
    ...scene.entities.filter((e) => e.kind === 'personnage').map((e) => ({ occupant: { kind: 'entite' as const, entityId: e.id }, nom: nomALEcran(s, e) })),
    ...Array.from({ length: PARTY_MAX }, (_, i) => ({ occupant: { kind: 'groupe' as const, rang: i + 1 }, nom: labelEmplacement(i + 1) })),
  ];
  return [
    bouton('assise', t('ecran.editeur.assise'), { geste: 'entite', patch: { assise: !ent.usable?.assise } }, !!ent.usable?.assise),
    ...slots.map(({ slotId }) => {
      const tenant = tenues[slotId];
      const id = `place/${slotId}`;
      return choix(id, t('ecran.editeur.place', { place: slotId }), [
        bouton(`${id}/personne`, t('ecran.editeur.place.personne'), { geste: 'place', place: slotId, occupant: null }, !tenant),
        ...occupants.map(({ occupant, nom }) => {
          const tient = !!tenant && cleDeLOccupant(tenant) === cleDeLOccupant(occupant);
          const res = tient ? null : assoirALaPlace(scene, ent.id, slotId, occupant);
          return bouton(`${id}/${cleDeLOccupant(occupant)}`, nom, { geste: 'place', place: slotId, occupant }, tient,
            res && !res.ok ? t(`ecran.editeur.place.refus.${res.reason}`) : null);
        }),
      ], 'liste');
    }),
  ];
}

/** Le poste de l'emplacement de siège `ent` de la session `s` : son engin, son arc (omni ou l'un des quatre), ses
 *  servants, et parmi eux le chef de pièce, en tête. */
function poste(s: SessionDEdition, ent: Scene['entities'][number], p: NonNullable<Scene['entities'][number]['postes']>[number]): (Choix | Ligne)[] {
  const servants = p.crewIds ?? [];
  const parId = new Map(sceneEditee(s).entities.map((e) => [e.id, e]));
  const nom = (id: string) => { const e = parId.get(id); return e ? nomALEcran(s, e) : id; };
  return [
    choix('poste/engin', t('ecran.editeur.poste.engin'), siegeEngines().map((e) => bouton(`poste/engin/${e.id}`, e.label, { geste: 'poste', patch: { engin: e.id } }, p.trappingId === e.id)), 'liste'),
    choix('poste/arc', t('ecran.editeur.poste.arc'), [
      bouton('poste/arc/omni', t('ecran.editeur.poste.arc.omni'), { geste: 'poste', patch: { arc: null } }, !p.side),
      ...FIRE_ARCS.map((a) => bouton(`poste/arc/${a}`, t(`ecran.editeur.poste.arc.${a}`), { geste: 'poste', patch: { arc: a } }, p.side === a)),
    ]),
    ...equipe(s, ent, 'poste/servants', servants, (ids) => ({ geste: 'poste', patch: { servants: ids } })),
    ...(servants.length ? [choix('poste/chef', t('ecran.editeur.poste.chef'), servants.map((id) =>
      bouton(`poste/chef/${id}`, nom(id), { geste: 'poste', patch: { servants: [id, ...servants.filter((i) => i !== id)] } }, servants[0] === id)))] : []),
  ];
}

/** L'inventaire du personnage `ent` : chaque objet, par son id, à retirer et, s'il se porte (`isWearable`), porté ou
 *  non ; ou la ligne qui dit qu'il n'en a aucun ; puis, en liste, chaque objet du catalogue (`trappingsInstanciables`)
 *  qu'il n'a pas, à y ajouter. Chaque bouton écrit son intention sur l'objet (`inventaireApres`). */
function inventaire(ent: Scene['entities'][number]): (Choix | Ligne)[] {
  const objets = ent.inventaire ?? {};
  const instances = objetsDeLInventaire(objets, String);
  const ecrire = (objet: NonNullable<PatchDEntite['objet']>): GesteDEdition => ({ geste: 'entite', patch: { objet } });
  return [
    ...(instances.length
      ? instances.map((objet) => {
        const id = `inventaire/${objet.uid}`;
        return choix(id, objet.label, [
          ...(isWearable(objet) ? [bouton(`${id}/porte`, t('ecran.editeur.inventaire.porte'), ecrire({ porter: objet.uid }), objet.equipped)] : []),
          bouton(`${id}/retirer`, t('ecran.editeur.inventaire.retirer'), ecrire({ retirer: objet.uid })),
        ]);
      })
      : [ligne('inventaire', t('ecran.editeur.inventaire.aucun'))]),
    choix('inventaire/ajouter', t('ecran.editeur.inventaire.ajouter'),
      trappingsInstanciables().filter((tr) => !(tr.id in objets)).map((tr) => bouton(`inventaire/ajouter/${tr.id}`, tr.label, ecrire({ ajouter: tr.id }))), 'liste'),
  ];
}

/** Le parcours de carrière du personnage `ent`, s'il part d'une fiche du bestiaire (EDO 11 l.19) :
 *  chaque carrière, la dernière actuelle, à son Niveau ou à retirer ; les Talents choisis de chacun de ses Niveaux
 *  atteints ; la Compétence de chacun de ses emplacements à choix ; une carrière à ajouter, qui devient l'actuelle ;
 *  chaque emplacement de dotation de l'actuelle, l'emplacement de la branche choisie dessous. Ce que l'auteur ne choisit
 *  pas se tire au spawn (« Tiré »).
 *  Chaque bouton écrit le parcours entier, retouché (`parcoursRetouche`). */
function carrieres(ent: Scene['entities'][number]): (Choix | Ligne | Bouton)[] {
  if (ent.statblock || ent.presetId || !fichesDePersonnage().some((f) => f.id === ent.creature?.id)) return [];
  const p: ParcoursDeCarriere = parcoursDe(ent) ?? { carrieres: {} };
  const ecrire = (q: ParcoursDeCarriere): GesteDEdition => ({ geste: 'entite', patch: { parcours: parcoursRetouche(q) } });
  const actuelle = carriereActuelle(p);
  const refusDeTenue = ent.appearance?.tenue ? t('ecran.editeur.carriere.tenue') : null;
  const tiree = (id: string, choisi: boolean, jeu: GesteDEdition) => bouton(`${id}/tiree`, t('ecran.editeur.carriere.tiree'), jeu, choisi);
  const parTalents = talentsDuParcours(p).niveaux;
  const etapes = Object.entries(p.carrieres).flatMap(([id, niveau]) => {
    const levels = levelsForCareer(id);
    const cle = `carriere/${id}`;
    const talents = p.talentsDeCarriere?.[id] ?? [];
    const competences = p.competencesDeCarriere?.[id] ?? [];
    const slots = skillSlots(levels, niveau);
    const { designations } = designationsDeCarriere(id, niveau, competences);
    const sans = <T>(table: Readonly<Record<string, T>> | undefined, cle: string) => Object.fromEntries(Object.entries(table ?? {}).filter(([c]) => c !== cle));
    return [
      choix(cle, t(id === actuelle?.id ? 'ecran.editeur.carriere.actuelle' : 'ecran.editeur.carriere', { carriere: findCareerById(id)!.label }), [
        ...levels.map((l) => bouton(`${cle}/niveau/${l.level}`, t('ecran.editeur.carriere.niveau', { n: l.level, niveau: l.label }), ecrire({ ...p, carrieres: { ...p.carrieres, [id]: l.level } }), l.level === niveau)),
        bouton(`${cle}/retirer`, t('ecran.editeur.carriere.retirer'), ecrire({ ...p, carrieres: sans(p.carrieres, id), ...(id === actuelle?.id ? { dotationsDeCarriere: undefined } : {}) })),
      ]),
      ...levels.filter((l) => l.level <= niveau).map((l) => {
        const { offerts } = parTalents[id][l.level - 1];
        return choix(`${cle}/talents/${l.level}`, t('ecran.editeur.carriere.talents', { n: l.level }), offerts.map((k) => {
          const pris = talents.some((r) => refKey(r.id, r.spec) === k);
          const autres = talents.filter((r) => refKey(r.id, r.spec) !== k);
          return bouton(`${cle}/talents/${l.level}/${k}`, refLabel('talents', parseRefKey(k)), ecrire({ ...p, talentsDeCarriere: { ...p.talentsDeCarriere, [id]: pris ? autres : [...talents, parseRefKey(k)] } }), pris);
        }), 'liste');
      }),
      ...slots.filter((sl) => sl.needsChoice).map((sl) => {
        const designee = designations[sl.key];
        const pris = prisParLesAutres(sl, slots, designations);
        const i = competences.findIndex((r) => refKey(r.id, r.spec) === designee);
        const autres = competences.filter((_, j) => j !== i);
        const poser = (refs: typeof competences) => ecrire({ ...p, competencesDeCarriere: { ...p.competencesDeCarriere, [id]: refs } });
        const id_ = `${cle}/competence/${sl.key}`;
        return choix(id_, sl.entry, [
          tiree(id_, !designee, poser(autres)),
          ...candidatsDuSlot(sl).filter((k) => k === designee || !pris.has(k)).map((k) => bouton(`${id_}/${k}`, refLabel('skills', parseRefKey(k)), poser([...autres, parseRefKey(k)]), k === designee)),
        ], 'liste');
      }),
    ];
  });
  const choisis = p.dotationsDeCarriere ?? {};
  const dotation = (e: EmplacementDeDotation): Choix[] => {
    const v = choisis[e.adresse];
    const sous = e.sorte === 'branches' && typeof v === 'number' ? sousEmplacement(e, v) : undefined;
    const id = `carriere/dotation/${e.adresse}`;
    const poser = (x?: number | string) => ecrire({ ...p, dotationsDeCarriere: { ...Object.fromEntries(Object.entries(choisis).filter(([a]) => a !== e.adresse)), ...(x === undefined ? {} : { [e.adresse]: x }) } });
    return [choix(id, e.sorte === 'branches' ? t('ecran.editeur.carriere.dotation') : trappingRefLabel(e.ref), [
      tiree(id, v === undefined, poser()),
      ...valeursDeLEmplacement(e).map((x) => bouton(`${id}/${x}`, libelleDeLaValeur(e, x), poser(x), v === x)),
    ], 'liste'), ...(sous ? dotation(sous) : [])];
  };
  return [
    ...etapes,
    choix('carriere/ajouter', t('ecran.editeur.carriere.ajouter'), careers.filter((c) => !(c.id in p.carrieres))
      .map((c) => bouton(`carriere/ajouter/${c.id}`, c.label, ecrire({ ...p, carrieres: { ...p.carrieres, [c.id]: 1 }, dotationsDeCarriere: undefined }), false, refusDeTenue)), 'liste'),
    ...(actuelle ? emplacementsDeDotation(dotationsDuPnj(actuelle.id, actuelle.niveau)).filter(estEmplacementRacine).flatMap(dotation) : []),
  ];
}

/** Le profil porté du personnage `ent` de la session `s`, s'il porte une fiche (`ficheEditee`, `ficheDuCombattant`) : d'un
 *  PNJ de carrière, le Niveau atteint de sa carrière actuelle et son Statut ; ses Caractéristiques et ses Blessures, ses
 *  Compétences à la valeur de leur Test, ses Talents, ses possessions et ses mentions, une ligne par nature. */
function profilDeLEntite(s: SessionDEdition, ent: Scene['entities'][number]): Ligne[] {
  const scene = sceneEditee(s);
  const porte = ficheEditee(ent, presetDuNarratif(s.projet.narratif));
  const fiche = porte && ficheDuCombattant(porte, (id) => {
    const e = scene.entities.find((x) => x.id === id);
    return e && nomALEcran(s, e);
  });
  if (!fiche) return [];
  const actuelle = carriereActuelle(parcoursDe(ent) ?? { carrieres: {} });
  const niveau = actuelle && levelsForCareer(actuelle.id).find((l) => l.level === actuelle.niveau);
  const liste = (cle: 'competences' | 'talents' | 'possessions', elements: string[]) => ligne(`profil/${cle}`, t(`ecran.editeur.profil.${cle}`, { liste: elements.join(', ') || t('ecran.editeur.profil.aucun') }));
  return [
    ...(niveau ? [ligne('profil/statut', t('ecran.editeur.profil.statut', { niveau: niveau.label, statut: niveau.status }))] : []),
    ligne('profil/caracteristiques', t('ecran.editeur.profil.caracteristiques', { liste: fiche.caracteristiques.map((c) => `${c.abrege} ${c.valeur}`).join(' · '), blessures: fiche.blessures[1] })),
    liste('competences', fiche.competences.map((c) => `${c.libelle} ${c.valeur}`)),
    liste('talents', fiche.talents.map((x) => (x.fois > 1 ? `${x.libelle} ×${x.fois}` : x.libelle))),
    liste('possessions', fiche.possessions.map((x) => (x.nombre > 1 ? `${x.libelle} (${x.nombre})` : x.libelle))),
    ...fiche.mentions.map((m) => ligne(`profil/mentions/${m.nature}`, t('ecran.editeur.profil.mentions', { nature: m.titre, liste: m.mentions.map((x) => (x.nombre > 1 ? `${x.libelle} (${x.nombre})` : x.libelle)).join(', ') }))),
  ];
}

/** Les sorts du personnage `ent` de la session `s`, lus sur sa fiche (`ficheEditee`), s'il en a une : ceux que son profil
 *  imprime ; sinon, s'il a une liste de sorts (`listesDeSorts`), ses sorts au combat, choisis et tirés (`sortsDuPnj`).
 *  Les sorts choisis s'écrivent au formulaire tiré du schéma (`formulaireDe`). */
function sorts(s: SessionDEdition, ent: Scene['entities'][number]): Ligne[] {
  const fiche = ficheEditee(ent, presetDuNarratif(s.projet.narratif));
  if (!fiche) return [];
  const liste = (ids: readonly string[]) => ids.map((id) => findSpellById(id)?.label ?? id).join(', ') || t('ecran.editeur.profil.aucun');
  const imprimes = sortsImprimes(fiche.porteurDeFiche);
  if (imprimes.length) return [ligne('sorts/imprimes', t('ecran.editeur.sorts.imprimes', { liste: liste(imprimes) }))];
  return listesDeSorts(fiche).length ? [ligne('sorts/connus', t('ecran.editeur.sorts.connus', { liste: liste(fiche.spells ?? []) }))] : [];
}

/** Les rencontres du personnage `ent` de la session `s` : dans chacune, enrôlé ou non, ennemi ou allié, piloté par l'IA
 *  s'il est allié ; l'enrôler dans une rencontre neuve. */
function rencontres(s: SessionDEdition, ent: Scene['entities'][number]): (Choix | Bouton)[] {
  return [
    ...sceneEditee(s).encounters.map((enc) => {
      const m = enc.members?.find((mm) => mm.entityId === ent.id);
      const membre = (patch: Omit<Extract<GesteDEdition, { geste: 'membre' }>['patch'], 'rencontre'>): GesteDEdition => ({ geste: 'membre', patch: { rencontre: enc.id, ...patch } });
      const id = `rencontre/${enc.id}`;
      return choix(id, t('ecran.editeur.rencontre', { id: enc.id }), [
        bouton(`${id}/enrole`, t('ecran.editeur.rencontre.enrole'), membre({ enrole: !m }), !!m),
        ...(m ? [
          bouton(`${id}/ennemi`, t('ecran.editeur.rencontre.ennemi'), membre({ camp: 'ennemi' }), m.side !== 'allie'),
          bouton(`${id}/allie`, t('ecran.editeur.rencontre.allie'), membre({ camp: 'allie' }), m.side === 'allie'),
        ] : []),
        ...(m?.side === 'allie' ? [bouton(`${id}/ia`, t('ecran.editeur.rencontre.ia'), membre({ ia: !m.ai }), !!m.ai)] : []),
      ]);
    }),
    bouton('rencontre/neuve', t('ecran.editeur.rencontre.neuve'), { geste: 'membre', patch: { rencontre: null, enrole: true } }),
  ];
}

/** L'inspecteur de l'entrée sélectionnée de la session `s` : son nom, sa couche ; la supprimer. */
function inspecteurDEntree(s: SessionDEdition, entree: { nom: string; z: number }): (Choix | Bouton | Formulaire)[] {
  return [
    formulaireDuNom(entree.nom, false),
    choixDeLaCouche(s, 'entree/couche', entree.z, (z) => ({ geste: 'entree', z })),
    bouton('entree/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }),
  ];
}

/** Les lieux de repos qu'une scène ou une zone de repos offre. */
const LIEUX = ['auberge', 'maison', 'camp'] as const;

type Rect = { x: number; y: number; w: number; h: number };

/** Les cases du rectangle `r`, ligne à ligne. */
const casesDuRect = (r: Rect): { x: number; y: number }[] =>
  Array.from({ length: r.w * r.h }, (_, i) => ({ x: r.x + (i % r.w), y: r.y + Math.floor(i / r.w) }));

/** Une zone de la scène telle que l'éditeur la lit : sa sélection, sa sorte, son nom (l'id d'un déclencheur, le
 *  libellé d'une zone d'effet), son rectangle, sa couche et ses cases (`sceneZoneTiles` d'une zone d'effet). */
interface ZoneLue {
  sel: Sel;
  sorte: SorteDeZone;
  nom: string;
  rect: Rect;
  z: number;
  cases: { x: number; y: number }[];
}

/** Les zones de la scène `scene` : ses déclencheurs, ses zones de repos, puis ses zones d'effet. */
function zonesLues(scene: Scene): ZoneLue[] {
  return [
    ...scene.triggers.map((tr) => ({ sel: { type: 'trigger' as const, id: tr.id }, sorte: 'declencheur' as const, nom: tr.id, rect: tr.rect, z: tr.rect.z ?? 0, cases: casesDuRect(tr.rect) })),
    ...(scene.restZones ?? []).map((r, idx) => ({
      sel: { type: 'restZone' as const, idx }, sorte: 'repos' as const, nom: t('ecran.editeur.zone.sorte.repos'), rect: r.rect, z: r.rect.z ?? 0, cases: casesDuRect(r.rect),
    })),
    ...(scene.effectZones ?? []).map((ez) => ({
      sel: { type: 'effectZone' as const, id: ez.id }, sorte: isRoomZone(ez) ? 'piece' as const : 'zone' as const, nom: ez.label, rect: effectZoneRect(ez.area), z: ez.z ?? 0, cases: sceneZoneTiles(ez),
    })),
  ];
}

/** Les ouvrages du corps actif de la session `s` sur sa carte : les parties de chaque étage, puis ses masses de toiture
 *  posées à la main (une masse dérivée se règle sur le corps). */
function ouvragesLus(s: SessionDEdition): ZoneLue[] {
  const corps = corpsActif(s);
  if (!corps) return [];
  return [
    ...corps.storeys.flatMap((e) => e.parts.map((p) => ({ sel: { type: 'architecturePart' as const, bodyId: corps.id, storeyId: e.id, id: p.id }, sorte: 'partie' as const, nom: p.id, rect: p.foot, z: e.z, cases: casesDuRect(p.foot) }))),
    ...corps.masses.filter((m) => !m.derived).map((m) => {
      const sel = { type: 'roofSection' as const, bodyId: corps.id, id: m.id };
      return { sel, sorte: 'masse' as const, nom: m.id, rect: selRect(sceneEditee(s), sel)!, z: m.z, cases: m.footprint.flatMap(casesDuRect) };
    }),
  ];
}

/** Les pièces de la couche `z` qu'un étage ou une façade révèle (`roomZoneIds`). */
const piecesDeLaCouche = (scene: Scene, z: number) => (scene.effectZones ?? []).filter((zone) => isRoomZone(zone) && (zone.z ?? 0) === z);

/** L'inspecteur de la sélection d'architecture de la session `s`, vide hors d'elle. D'un corps : son nom, son type de
 *  bâtiment, son nombre d'étages ; d'un étage : sa couche, les pièces qu'il révèle ; d'une partie, la poignée qui la
 *  redimensionne ; chacun se supprime, l'étage sauf le dernier du corps. */
function inspecteurDArchitecture(s: SessionDEdition): (Choix | Ligne | Bouton | Formulaire)[] {
  const scene = sceneEditee(s);
  const sel = s.sel;
  const corps = corpsActif(s);
  const supprimer = (refus: string | null = null) => bouton('architecture/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }, false, refus);
  if (sel?.type === 'architectureBody' && corps) {
    const styles = Object.values(buildingsMeta());
    return [
      formulaireDuNom(corps.label, true),
      choix('corps/style', t('ecran.editeur.corps.style'), [
        bouton('corps/style/aucun', t('ecran.editeur.corps.style.aucun'), { geste: 'architecture', patch: { style: null } }, corps.style === undefined),
        ...styles.map((m) => bouton(`corps/style/${m.id}`, m.label, { geste: 'architecture', patch: { style: { id: m.id } } }, corps.style?.id === m.id)),
      ], 'liste'),
      ligne('corps/etages', t('ecran.editeur.corps.etages', { n: corps.storeys.length, s: pluriel(corps.storeys.length) })),
      ...toitureDuCorps(scene, corps),
      supprimer(),
    ];
  }
  if (sel?.type === 'architectureStorey' && corps) {
    const etage = corps.storeys.find((e) => e.id === sel.id)!;
    const pieces = piecesDeLaCouche(scene, etage.z);
    const basculer = (id: string) => (etage.roomZoneIds.includes(id) ? etage.roomZoneIds.filter((p) => p !== id) : [...etage.roomZoneIds, id]);
    return [
      ligne('etage', t('ecran.editeur.etage', { id: etage.id, z: etage.z })),
      pieces.length
        ? choix('etage/pieces', t('ecran.editeur.pieces'), pieces.map((p) => bouton(`etage/pieces/${p.id}`, p.label, { geste: 'architecture', patch: { pieces: basculer(p.id) } }, etage.roomZoneIds.includes(p.id))))
        : ligne('etage/pieces', t('ecran.editeur.pieces.aucune')),
      supprimer(corps.storeys.length > 1 ? null : t('ecran.editeur.etage.dernier')),
    ];
  }
  if (sel?.type === 'facadeSection' && corps) return [...inspecteurDeFacade(scene, corps, corps.facades.find((f) => f.id === sel.id)!), supprimer()];
  if (sel?.type === 'roofSection' && corps) return [ligne('architecture/poignee', t('ecran.editeur.zone.poignee')), ...reglagesDeLaMasse(corps, corps.masses.find((m) => m.id === sel.id)!), supprimer()];
  if (sel?.type === 'architecturePart') return [ligne('architecture/poignee', t('ecran.editeur.zone.poignee')), supprimer()];
  return [];
}

/** Les pas des réglettes de la pente d'un toit, en degrés, du comble d'un corps et des niveaux d'une masse. */
const PAS_DE_PENTE: Pas = { pas: 5, unite: '°', ...PENTE_TOIT_DEG };
const PAS_D_ETAGE: Pas = { pas: 1, unite: '', min: 1, max: Infinity };
const COTES_D_EGOUT = ['N', 'E', 'S', 'O'] as const;

type Corps = NonNullable<ReturnType<typeof corpsActif>>;
type Toiture = NonNullable<Extract<GesteDEdition, { geste: 'architecture' }>['patch']['toiture']>;
type ReglageDeMasse = NonNullable<Extract<GesteDEdition, { geste: 'architecture' }>['patch']['masse']>;

/** Le pas d'une réglette, l'unité qu'affichent ses boutons (le pas multiplié par `facteur`), et ses bornes. */
interface Pas { pas: number; unite: string; facteur?: number; min: number; max: number }

/** Une réglette `id` : sa ligne `texte`, moins et plus au pas `p` depuis `v` (au centième), chacun jouant `jeu` de la
 *  valeur visée, refusés à la borne, et, si `defaut` est donné, son bouton `libelle`, qui joue `jeu`, pressé quand la
 *  valeur est le défaut. */
function reglette(id: string, texte: string, v: number, p: Pas, jeu: (v: number) => GesteDEdition, defaut?: { libelle: string; jeu: GesteDEdition; presse: boolean }): (Ligne | Bouton)[] {
  const vers = (sens: number) => Math.min(p.max, Math.max(p.min, Math.round((v + sens * p.pas) * 100) / 100));
  const affiche = { pas: Math.round(p.pas * (p.facteur ?? 1) * 100) / 100, unite: p.unite };
  return [
    ligne(id, texte),
    bouton(`${id}/moins`, t('ecran.editeur.reglette.moins', affiche), jeu(vers(-1)), false, v <= p.min ? t('ecran.editeur.reglette.auMinimum') : null),
    bouton(`${id}/plus`, t('ecran.editeur.reglette.plus', affiche), jeu(vers(1)), false, v >= p.max ? t('ecran.editeur.reglette.auMaximum') : null),
    ...(defaut ? [bouton(`${id}/defaut`, defaut.libelle, defaut.jeu, defaut.presse)] : []),
  ];
}

/** Le choix du côté d'égout bas d'un appentis : à déclarer (`null`), ou chacun des quatre côtés. */
const choixDEgout = (id: string, cote: string | undefined, jeu: (c: (typeof COTES_D_EGOUT)[number] | null) => GesteDEdition): Choix =>
  choix(id, t('ecran.editeur.toiture.egout'), [null, ...COTES_D_EGOUT].map((c) => bouton(`${id}/${c ?? 'aucun'}`, t(`ecran.editeur.toiture.egout.${c ?? 'aucun'}`), jeu(c), (cote ?? null) === c)));

/** La couverture `material` : le bouton qui la fait suivre, s'il est donné (pressé sans couverture), puis chaque matière
 *  couvrante. */
const choixDeCouverture = (id: string, material: { id: string } | undefined, jeu: (m: { id: string }) => GesteDEdition, suit: GesteDEdition | null): Choix =>
  choix(id, t('ecran.editeur.toiture.couverture'), [
    ...(suit ? [bouton(`${id}/suit`, t('ecran.editeur.toiture.suit'), suit, material === undefined)] : []),
    ...matieresCouvrantes().map((m) => bouton(`${id}/${m.id}`, m.label, jeu({ id: m.id }), material?.id === m.id)),
  ], 'liste');

/** La toiture du corps `corps` : celle qui s'applique, puis chaque champ de son intention, profil, côté d'égout d'un
 *  appentis, pente, comble et couverture, chacun réglé ou suivant (`toitureEffective`) ; ses exclusions, chacune à
 *  retirer. */
function toitureDuCorps(scene: Scene, corps: Corps): (Choix | Ligne | Bouton)[] {
  const effective = toitureEffective(scene, corps);
  const rd = corps.roofDefaults;
  const sur = (toiture: Toiture): GesteDEdition => ({ geste: 'architecture', patch: { toiture } });
  const couverture = matieresCouvrantes().find((m) => m.id === effective.material.id)?.label ?? effective.material.id;
  return [
    ligne('toiture', t('ecran.editeur.toiture', { couverture, pente: effective.penteReference, comble: effective.riseMaxStoreys })),
    choix('toiture/profil', t('ecran.editeur.toiture.profil'), [
      bouton('toiture/profil/suit', t('ecran.editeur.toiture.suitLaPortee'), sur({ profile: null }), rd?.profile === undefined),
      ...PROFILS_DE_TOIT.map(([p, libelle]) => bouton(`toiture/profil/${p}`, libelle, sur({ profile: p }), rd?.profile === p)),
    ], 'liste'),
    ...(effective.profile === 'shed' ? [choixDEgout('toiture/egout', rd?.eaveSide, (c) => sur({ eaveSide: c }))] : []),
    ...reglette('toiture/pente', t('ecran.editeur.toiture.pente', { v: rd?.pitchDeg ?? effective.penteReference }), rd?.pitchDeg ?? effective.penteReference, PAS_DE_PENTE,
      (v) => sur({ pitchDeg: v }), { libelle: t('ecran.editeur.toiture.suit'), jeu: sur({ pitchDeg: null }), presse: rd?.pitchDeg === undefined }),
    ...reglette('toiture/comble', t('ecran.editeur.toiture.comble', { v: effective.riseMaxStoreys }), effective.riseMaxStoreys, PAS_D_ETAGE,
      (v) => sur({ riseMaxStoreys: v }), { libelle: t('ecran.editeur.toiture.suit'), jeu: sur({ riseMaxStoreys: null }), presse: rd?.riseMaxStoreys === undefined }),
    choixDeCouverture('toiture/couverture', rd?.material, (m) => sur({ material: m }), sur({ material: null })),
    ...(corps.roofExclusions ?? []).flatMap((ex, i) => [
      ligne(`toiture/exclusion/${i}`, t('ecran.editeur.toiture.exclusion', { ...ex.rect, z: ex.z })),
      bouton(`toiture/exclusion/${i}/retirer`, t('ecran.editeur.toiture.exclusion.retirer'), { geste: 'architecture', patch: { retirerExclusion: i } }),
    ]),
  ];
}

/** Les réglages de la masse de toiture `masse` du corps `corps` : son étage sommet, ses niveaux, son profil, l'axe de
 *  son faîtage, le côté d'égout d'un appentis, sa pente et sa couverture. */
function reglagesDeLaMasse(corps: Corps, masse: Corps['masses'][number]): (Choix | Ligne | Bouton)[] {
  const sur = (m: ReglageDeMasse): GesteDEdition => ({ geste: 'architecture', patch: { masse: m } });
  return [
    choix('masse/couche', t('ecran.editeur.masse.sommet'), corps.storeys.map((e) => e.z).sort((a, b) => a - b)
      .map((z) => bouton(`masse/couche/${z}`, t('ecran.editeur.couche', { z }), { geste: 'architecture', patch: { z } }, masse.z === z))),
    ...reglette('masse/niveaux', t('ecran.editeur.masse.niveaux', { v: masse.levels }), masse.levels, PAS_D_ETAGE, (v) => sur({ levels: v })),
    choix('masse/profil', t('ecran.editeur.toiture.profil'), PROFILS_DE_TOIT.map(([p, libelle]) => bouton(`masse/profil/${p}`, libelle, sur({ profile: p }), masse.profile === p)), 'liste'),
    choix('masse/faitage', t('ecran.editeur.masse.faitage'), ([null, 'x', 'y'] as const).map((a) => bouton(`masse/faitage/${a ?? 'auto'}`, t(`ecran.editeur.masse.faitage.${a ?? 'auto'}`), sur({ ridge: a }), (masse.ridge ?? null) === a))),
    ...(masse.profile === 'shed' ? [choixDEgout('masse/egout', masse.eaveSide, (c) => sur({ eaveSide: c }))] : []),
    ...reglette('masse/pente', t('ecran.editeur.toiture.pente', { v: masse.pitchDeg }), masse.pitchDeg, PAS_DE_PENTE, (v) => sur({ pitchDeg: v })),
    choixDeCouverture('masse/couverture', masse.material, (m) => sur({ material: m }), null),
  ];
}

/** Le pas des réglettes de position et de largeur d'une ouverture, en fraction de l'arête, affiché en pourcents. */
const PAS_D_OUVERTURE = 0.05;

/** L'inspecteur de la façade `facade` du corps `corps` : son apparence en liste, son étage parmi ceux du corps, chacune
 *  de ses ouvertures (sa sorte ; sa position et sa largeur à la réglette, ou le défaut du rendu ; son apparence en
 *  liste, le défaut du rendu ou l'une de celles que sa sorte nomme, `apparencesDeLOuverture` ; la retirer), en ajouter
 *  une (refusé sans arête), les pièces de son étage qu'elle révèle. */
function inspecteurDeFacade(scene: Scene, corps: NonNullable<ReturnType<typeof corpsActif>>, facade: NonNullable<ReturnType<typeof corpsActif>>['facades'][number]): (Choix | Ligne | Bouton)[] {
  const sur = (patch: Extract<GesteDEdition, { geste: 'architecture' }>['patch']): GesteDEdition => ({ geste: 'architecture', patch });
  const pieces = piecesDeLaCouche(scene, facade.z);
  const revelees = facade.roomZoneIds ?? [];
  const basculer = (id: string) => (revelees.includes(id) ? revelees.filter((p) => p !== id) : [...revelees, id]);
  const ouvertures = (facade.features ?? []).flatMap((o) => {
    const id = `baie/${o.id}`;
    const jeu = (patch: Extract<GesteDEdition, { geste: 'baie' }>['patch']): GesteDEdition => ({ geste: 'baie', id: o.id, patch });
    const regler = (cle: 'offset' | 'width', champ: 'position' | 'largeur') => {
      const v = o[cle] ?? DEFAUTS_D_OUVERTURE[cle];
      const texte = t(`ecran.editeur.baie.${champ}`, { v: Math.round(v * 100) }) + (o[cle] === undefined ? ` ${t('ecran.editeur.baie.defaut')}` : '');
      return reglette(`${id}/${champ}`, texte, v, { pas: PAS_D_OUVERTURE, unite: ' %', facteur: 100, ...BORNES_D_OUVERTURE[cle] }, (x) => jeu({ [champ]: x }),
        { libelle: t('ecran.editeur.baie.auDefaut'), jeu: jeu({ [champ]: null }), presse: o[cle] === undefined });
    };
    return [
      choix(`${id}/sorte`, t('ecran.editeur.baie', { id: o.id }), SORTES_D_OUVERTURE.map(([k, libelle]) => bouton(`${id}/sorte/${k}`, libelle, jeu({ sorte: k }), o.kind === k)), 'liste'),
      ...regler('offset', 'position'),
      ...regler('width', 'largeur'),
      choix(`${id}/apparence`, t('ecran.editeur.baie.apparence'), [
        bouton(`${id}/apparence/defaut`, t('ecran.editeur.baie.auDefaut'), jeu({ apparence: null }), o.appearance === undefined),
        ...apparencesDeLOuverture(o.kind).map((a) => bouton(`${id}/apparence/${a.id}`, a.label, jeu({ apparence: a.id }), o.appearance === a.id)),
      ], 'liste'),
      bouton(`${id}/retirer`, t('ecran.editeur.baie.retirer'), jeu(null)),
    ];
  });
  return [
    choix('facade/apparence', t('ecran.editeur.facade.apparence'), FACADE_APPEARANCE_IDS.map((a) => bouton(`facade/apparence/${a}`, a, sur({ apparence: a }), facade.appearance === a)), 'liste'),
    choix('facade/couche', t('ecran.editeur.entite.couche'), corps.storeys.map((e) => e.z).sort((a, b) => a - b).map((z) => bouton(`facade/couche/${z}`, t('ecran.editeur.couche', { z }), sur({ z }), facade.z === z))),
    ...ouvertures,
    bouton('baie/ajouter', t('ecran.editeur.baie.ajouter'), { geste: 'baie', id: null, patch: null }, false, facade.edges[0] ? null : t('ecran.editeur.baie.sansArete')),
    pieces.length
      ? choix('facade/pieces', t('ecran.editeur.pieces'), pieces.map((p) => bouton(`facade/pieces/${p.id}`, p.label, sur({ pieces: basculer(p.id) }), revelees.includes(p.id))))
      : ligne('facade/pieces', t('ecran.editeur.pieces.aucune')),
  ];
}

/** L'emprise au pinceau de la zone d'effet `zoneId` : y ajouter des cases, en retirer (l'outil d'emprise armé dans ce
 *  sens, pressé). */
function emprise(zoneId: string, outil: SessionDEdition['outil']): Choix[] {
  const sens = outil.mode === 'casesDeZone' && outil.zoneId === zoneId ? outil.paint : null;
  return [choix('emprise', t('ecran.editeur.zone.emprise'), (['add', 'remove'] as const).map((paint) =>
    bouton(`emprise/${paint}`, t(`ecran.editeur.zone.emprise.${paint}`), { geste: 'outil', outil: { mode: 'casesDeZone', zoneId, paint } }, sens === paint)))];
}

/** Le porteur des valeurs qu'écrit un formulaire tiré du schéma (`{ geste: 'valeur' }`). */
type PorteurDeValeur = Extract<GesteDEdition, { geste: 'valeur' }>['porteur'];

/** Le pas d'une saisie de nombre qui n'est pas entier. */
const PAS_D_UN_REEL = 0.01;

/** L'argument `nom` du verbe `valeur`, posé à `valeur` (`fixe`). */
const fixe = (nom: string, valeur: unknown): ArgumentDuGeste => ({ nom, optionnel: false, saisie: 'fixe', libelle: null, valeur, valeurs: null, bornes: null, note: null, champs: null });

/** L'argument de la valeur saisie du champ `f`, de valeur courante `valeur` (`undefined` : absent), au chemin `ici` : un
 *  choix parmi ceux que son contexte y pose (`FieldDesc.contexte`), sinon parmi ses valeurs (`choixDuNoeud`), un
 *  nombre entre ses bornes (`FieldDesc.bornes`, ou celles du nombre qu'admet son nœud, `bornesAuPoint`), au pas de 1
 *  s'il est entier, un texte, ou du JSON. */
function argumentDeValeur(f: FieldDesc, valeur: unknown, ici: readonly Segment[]): ArgumentDuGeste {
  const choix = f.contexte?.choix(ici) ?? choixDuNoeud(f.noeud)?.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: null }));
  const base = { nom: 'valeur', optionnel: false, libelle: f.label, valeur: valeur ?? null, valeurs: null, bornes: null, note: null, champs: null };
  if (choix) return { ...base, saisie: 'choix', valeurs: [...choix] };
  const nombre = f.kind === 'number' ? f.bornes ?? null : bornesAuPoint(f.noeud, valeur);
  if (nombre !== undefined) return { ...base, saisie: 'nombre', bornes: { min: nombre?.min ?? SANS_BORNE.min, max: nombre?.max ?? SANS_BORNE.max, pas: nombre?.entier ? 1 : PAS_D_UN_REEL } };
  return { ...base, saisie: f.kind === 'text' ? 'texte' : f.kind === 'textarea' ? 'multiligne' : 'json' };
}

/** L'élément du geste d'id `cle`, de verbe `verbe` et d'arguments `args`, rendu par `renduDe` et dessiné par
 *  `elementsDesGestes` (un choix, en liste au-delà de `CHOIX_EN_BOUTONS`, ou un formulaire), libellé `libelle` d'après
 *  son rendu. */
function elementDuGeste(cle: string, verbe: string, args: ArgumentDuGeste[], libelle: (rendu: GesteDeLaFenetre['rendu']) => string): Bouton | Choix | Formulaire {
  const rendu = renduDe(args);
  return elementsDesGestes([{ cle, verbe, libelle: libelle(rendu.rendu), arguments: args, ...rendu, attendu: false, ouvert: true, raison: null, reglage: false }])[0];
}

/** L'élément qui écrit au champ `f`, au chemin `chemin` du porteur `porteur`, la valeur de son argument `a` : le geste
 *  `valeur` qui pose le porteur et le chemin (`elementDuGeste`). */
const elementDeValeur = (id: string, porteur: PorteurDeValeur, chemin: Segment[], f: FieldDesc, a: ArgumentDuGeste): Bouton | Choix | Formulaire =>
  elementDuGeste(id, 'valeur', [fixe('porteur', porteur), fixe('chemin', chemin), a], (rendu) => (rendu === 'formulaire' ? t('ecran.editeur.valeur.ecrire') : f.label));

/** Le geste `valeur` qui écrit `v` au chemin `chemin` du porteur `porteur` (`v` absente : le champ se retire). */
const ecrireLaValeur = (porteur: PorteurDeValeur, chemin: Segment[], v?: unknown): GesteDEdition => ({ geste: 'valeur', porteur, chemin, ...(v === undefined ? {} : { valeur: v }) });

/** Les champs offerts du nœud `noeud` à la donnée `objet` (`champsOfferts`, hors des discriminants `tenus`), sous le champ
 *  `f` au chemin `ici` : ceux que son contexte offre (`FieldDesc.contexte`), dans ce contexte. */
const champsSous = (f: FieldDesc, ici: Segment[], noeud: unknown, objet: Record<string, unknown>, tenus?: readonly string[]): FieldDesc[] => {
  const { contexte } = f;
  return contexte ? champsOfferts(noeud, objet, tenus).filter((c) => contexte.offert([...ici, c.key])).map((c) => ({ ...c, contexte })) : champsOfferts(noeud, objet, tenus);
};

/** Les éléments du formulaire tiré du schéma des champs `champs` (`FieldDesc`) du porteur `porteur`, de donnée
 *  `donnee`, au chemin `chemin` : ceux de chaque champ (`elementsDuChamp`), à plat. */
function elementsDuFormulaire(porteur: PorteurDeValeur, champs: readonly FieldDesc[], donnee: Record<string, unknown>, chemin: Segment[] = []): (Choix | Ligne | Bouton | Formulaire)[] {
  return champs.flatMap((f) => elementsDuChamp(porteur, f, donnee[f.key], [...chemin, f.key]));
}

/** Les éléments du champ `f` du porteur `porteur`, de valeur `valeur` (`undefined` : absent), au chemin `ici`, d'id
 *  `valeur/<chemin>`, chacun jouant `{ geste: 'valeur', porteur, chemin, valeur }`. Un objet (`champsDeclares`)
 *  présent : son libellé, ses champs offerts (`champsOfferts`), et « Retirer » si son absence est admise ; absent :
 *  « Ajouter » (`ajoutDeLObjet`). Une union nommée : sa variante (`elementsDeLUnion`). Une
 *  liste : ses éléments (`elementsDeLaListe`). Un record qui offre des clés : ses entrées (`elementsDuRecord`). Un objet d'une union sans variantes nommées : son libellé et les champs
 *  de la branche qu'il dessine (`formeAuPoint`), et « Retirer » si son absence est admise. Tout autre champ : l'élément de sa valeur (`elementDeValeur`), puis, si
 *  son absence est admise, « Aucune » sous un choix, pressé quand il est absent, ou « Retirer » sous un champ présent.
 *  « Retirer » ne se pose que là où son contexte écrit le champ entier (`ContexteDuChamp.ecrivable`). */
function elementsDuChamp(porteur: PorteurDeValeur, f: FieldDesc, valeur: unknown, ici: Segment[]): (Choix | Ligne | Bouton | Formulaire)[] {
  const id = `valeur/${ici.join('/')}`;
  const retirable = valeur !== undefined && f.nullable && (f.contexte?.ecrivable(ici, valeur) ?? true);
  const retirer = retirable ? [bouton(`${id}/retirer`, t('ecran.editeur.valeur.retirer', { libelle: f.label }), ecrireLaValeur(porteur, ici))] : [];
  if (f.contexte && estChampDAdresse(f.noeud)) return elementsDeLAdresse(porteur, f, valeur, ici, retirer, f.contexte.source);
  if (champsDeclares(f.noeud)) {
    if (valeur === undefined) return [ajoutDeLObjet(porteur, f, ici)];
    const objet = valeur as Record<string, unknown>;
    return [ligne(id, f.label), ...elementsDuFormulaire(porteur, champsSous(f, ici, f.noeud, objet), objet, ici), ...retirer];
  }
  if (unionDuNoeud(f.noeud)) return elementsDeLUnion(porteur, f, valeur, ici);
  if (elementDuNoeud(f.noeud) !== undefined) return elementsDeLaListe(porteur, f, valeur, ici);
  if (recordDuNoeud(f.noeud) && champsDuRecord(f, {}, ici).length) return elementsDuRecord(porteur, f, valeur, ici, retirer);
  const forme = formeAuPoint(f.noeud, valeur)?.noeud;
  if (estObjet(valeur) && champsDeclares(forme)) return [ligne(id, f.label), ...elementsDuFormulaire(porteur, champsSous(f, ici, forme, valeur), valeur, ici), ...retirer];
  const a = argumentDeValeur(f, valeur, ici);
  const aucune = a.saisie === 'choix' && f.nullable ? [bouton(`${id}/aucune`, t('ecran.editeur.valeur.aucune'), ecrireLaValeur(porteur, ici), valeur === undefined)] : [];
  return [elementDeValeur(id, porteur, ici, f, a), ...(a.saisie === 'choix' ? aucune : retirer)];
}

/** Les éléments du champ adresse de prose `f` (`estChampDAdresse`), de valeur `valeur`, au chemin `ici`, « Retirer »
 *  `retirer`, sur le `Source/` `source` : absente, le choix de son livre (`ajoutDeLObjet`), ou, sans `Source/` servi, la
 *  ligne qui le dit ; présente, son libellé, ses champs offerts (son empreinte jamais), ses fragments seulement sur son
 *  chapitre chargé, puis ce que dit son état (`etatDeLAdresse`) : le `Source/` absent, le chapitre à choisir, qui se
 *  charge ou introuvable, le passage qu'elle résout, ou le refus du parseur (`PHRASE_REFUS`), et, d'une empreinte qui
 *  diverge, « Resceller après relecture » (`{ geste: 'resceller', porteur, chemin }`). */
function elementsDeLAdresse(porteur: PorteurDeValeur, f: FieldDesc, valeur: unknown, ici: Segment[], retirer: Bouton[], source: SourceDeLEdition): (Choix | Ligne | Bouton | Formulaire)[] {
  const id = `valeur/${ici.join('/')}`;
  const sansSource = ligne(`${id}/etat`, t('ecran.editeur.adresse.sansSource'));
  if (valeur === undefined) return [source.manifeste ? ajoutDeLObjet(porteur, f, ici) : sansSource];
  const adresse = valeur as Parameters<typeof etatDeLAdresse>[1];
  const etat = etatDeLAdresse(source, adresse);
  const charge = etat.etat === 'resolue' || etat.etat === 'refusee';
  const champs = champsSous(f, ici, f.noeud, adresse as unknown as Record<string, unknown>).filter((c) => charge || c.key !== 'parts');
  const dit = (texte: string) => [ligne(`${id}/etat`, texte)];
  const lignes = etat.etat === 'sansSource' ? [sansSource]
    : etat.etat === 'resolue' ? (etat.md ? dit(t('ecran.editeur.adresse.passage', { texte: coupeAuMot(etat.md, LONGUEUR_DU_PASSAGE) })) : [])
      : etat.etat === 'refusee' ? dit(etat.erreur.fragment === undefined ? PHRASE_REFUS[etat.erreur.error] : t('ecran.editeur.adresse.refus', { rang: etat.erreur.fragment + 1, phrase: PHRASE_REFUS[etat.erreur.error] }))
        : dit(t(`ecran.editeur.adresse.${etat.etat}`));
  const resceller = etat.etat === 'refusee' && etat.erreur.error === 'empreinte-divergente'
    ? [bouton(`${id}/resceller`, t('ecran.editeur.adresse.resceller'), { geste: 'resceller', porteur, chemin: ici })] : [];
  return [ligne(id, f.label), ...elementsDuFormulaire(porteur, champs, adresse as unknown as Record<string, unknown>, ici), ...lignes, ...resceller, ...retirer];
}

/** Le plus long passage qu'une adresse de prose montre, en caractères (`coupeAuMot`). */
const LONGUEUR_DU_PASSAGE = 240;

/** Les éléments du champ record `f` (`recordDuNoeud`) qui offre des clés (`champsDuRecord`), de valeur `valeur`, au
 *  chemin `ici`, « Retirer » `retirer` : présent, son libellé, chacune de ses entrées, comme les champs d'un objet, et
 *  « Retirer » ; absent, « Ajouter », qui le pose vide (`valeurNeuveDe`). */
function elementsDuRecord(porteur: PorteurDeValeur, f: FieldDesc, valeur: unknown, ici: Segment[], retirer: Bouton[]): (Choix | Ligne | Bouton | Formulaire)[] {
  const id = `valeur/${ici.join('/')}`;
  if (estObjet(valeur)) return [ligne(id, f.label), ...elementsDuFormulaire(porteur, champsDuRecord(f, valeur, ici), valeur, ici), ...retirer];
  return [bouton(`${id}/ajouter`, t('ecran.editeur.valeur.ajouter', { libelle: f.label }), ecrireLaValeur(porteur, ici, valeurNeuveDe(f.noeud)))];
}

/** Les éléments du champ union `f` (`unionDuNoeud`), de valeur `valeur`, au chemin `ici`, les discriminants `tenus` déjà
 *  choisis : le choix de sa variante, d'id `valeur/<chemin>/<discriminant>` (`…/forme` d'une union sans discriminant),
 *  chacune posant sa valeur (celles que son
 *  contexte y pose, `FieldDesc.contexte`, sinon `variantesAChoisir`), suivi de « Aucune » si son absence est
 *  admise ; puis, de la variante courante, une union
 *  choisie sous le même chemin, ses champs offerts, la saisie de sa valeur hors objet (le nombre d'une formule), ou, d'une op sans forme déclarée, la ligne qui le dit et la saisie
 *  JSON de l'op entière. */
function elementsDeLUnion(porteur: PorteurDeValeur, f: FieldDesc, valeur: unknown, ici: Segment[], tenus: readonly string[] = []): (Choix | Ligne | Bouton | Formulaire)[] {
  const id = `valeur/${ici.join('/')}`;
  const u = unionDuNoeud(f.noeud)!;
  const idDuChoix = `${id}/${u.discriminant || 'forme'}`;
  const variantes = f.contexte?.choix(ici) ?? variantesAChoisir(f.noeud, valeur)!.map((v) => ({ valeur: v.valeur, libelle: v.libelle, refus: null }));
  const a: ArgumentDuGeste = { nom: 'valeur', optionnel: false, saisie: 'choix', libelle: f.label, valeur: valeur ?? null, valeurs: [...variantes], bornes: null, note: null, champs: null };
  const aucune = f.nullable ? [bouton(`${idDuChoix}/aucune`, t('ecran.editeur.valeur.aucune'), ecrireLaValeur(porteur, ici), valeur === undefined)] : [];
  const courante = varianteCourante(u, valeur);
  const choisis = [...tenus, u.discriminant];
  const suite = (): (Choix | Ligne | Bouton | Formulaire)[] => {
    if (!courante) return [];
    if (courante.noeud === undefined) {
      return [ligne(`${id}/motif`, t('ecran.editeur.valeur.motif.opNonTypee')), elementDeValeur(id, porteur, ici, f, { ...a, saisie: 'json', valeurs: null })];
    }
    if (unionDuNoeud(courante.noeud)) return elementsDeLUnion(porteur, { ...f, label: courante.libelle, nullable: false, noeud: courante.noeud }, valeur, ici, choisis);
    if (!champsDeclares(courante.noeud)) {
      const scalaire = { ...f, label: courante.libelle, noeud: courante.noeud };
      return [elementDeValeur(id, porteur, ici, scalaire, argumentDeValeur(scalaire, valeur, ici))];
    }
    const objet = valeur as Record<string, unknown>;
    return elementsDuFormulaire(porteur, champsSous(f, ici, courante.noeud, objet, choisis), objet, ici);
  };
  return [elementDeValeur(idDuChoix, porteur, ici, f, a), ...aucune, ...suite()];
}

/** Les éléments du champ liste `f` (`elementDuNoeud`), de valeur `valeur`, au chemin `ici` : présente, son libellé puis
 *  chacun de ses éléments, au chemin de son rang (`champDeLElement`), ses éléments, « Retirer » et, hors du premier,
 *  « Monter » ; puis « Ajouter » (`ajoutALaListe`). Chaque bouton écrit la liste entière (`gestesDeLaListe`). Une liste
 *  à laquelle rien ne s'ajoute (un élément récursif, sans valeur neuve ni choix) : la saisie de sa valeur entière
 *  (`argumentDeValeur`), en JSON. */
function elementsDeLaListe(porteur: PorteurDeValeur, f: FieldDesc, valeur: unknown, ici: Segment[]): (Choix | Ligne | Bouton | Formulaire)[] {
  const id = `valeur/${ici.join('/')}`;
  const liste = Array.isArray(valeur) ? valeur : [];
  const element = elementDuNoeud(f.noeud);
  const gestes = gestesDeLaListe(liste, valeurNeuveDe(element));
  const elements = liste.flatMap((e, rang) => {
    const champ = champDeLElement(f, rang);
    const { retirer, monter } = gestes.elements[rang];
    return [
      ...elementsDuChamp(porteur, champ, e, [...ici, rang]),
      bouton(`${id}/${rang}/retirer`, t('ecran.editeur.valeur.retirer', { libelle: champ.label }), ecrireLaValeur(porteur, ici, retirer)),
      ...(monter ? [bouton(`${id}/${rang}/monter`, t('ecran.editeur.valeur.monter', { libelle: champ.label }), ecrireLaValeur(porteur, ici, monter))] : []),
    ];
  });
  const ajouter = ajoutALaListe(porteur, f, liste, ici, element, gestes.ajouter);
  if (!ajouter) return [elementDeValeur(id, porteur, ici, f, argumentDeValeur(f, valeur, ici))];
  return valeur === undefined ? [ajouter] : [ligne(id, f.label), ...elements, ajouter];
}

/** « Ajouter » de l'objet absent du champ `f`, au chemin `ici`, d'id `valeur/<chemin>/ajouter` : le choix de l'objet posé
 *  parmi ceux que son contexte y pose (`FieldDesc.contexte`), sinon le bouton qui écrit sa valeur neuve (`valeurNeuveDe`). */
function ajoutDeLObjet(porteur: PorteurDeValeur, f: FieldDesc, ici: Segment[]): Bouton | Choix | Formulaire {
  const id = `valeur/${ici.join('/')}/ajouter`;
  const libelle = t('ecran.editeur.valeur.ajouter', { libelle: f.label });
  const valeurs = f.contexte?.choix(ici);
  if (!valeurs) return bouton(id, libelle, ecrireLaValeur(porteur, ici, valeurNeuveDe(f.noeud)));
  const a: ArgumentDuGeste = { nom: 'valeur', optionnel: false, saisie: 'choix', libelle, valeur: null, valeurs: [...valeurs], bornes: null, note: null, champs: null };
  return elementDeValeur(id, porteur, ici, { ...f, label: libelle }, a);
}

/** « Ajouter » à la liste `liste` du champ `f`, au chemin `ici`, d'élément `element`, d'id `valeur/<chemin>/ajouter` :
 *  le choix de l'élément ajouté en fin, parmi ceux que son contexte pose au rang qui suit le dernier
 *  (`FieldDesc.contexte`), sinon, d'un élément à choix (`choixDuNoeud`), parmi ses valeurs ; sinon, le bouton qui écrit
 *  `neuve`, la liste où s'ajoute un élément neuf (`valeurNeuveDe`) ; `undefined` sans elle. */
function ajoutALaListe(porteur: PorteurDeValeur, f: FieldDesc, liste: readonly unknown[], ici: Segment[], element: unknown, neuve: unknown[] | null): Bouton | Choix | Formulaire | undefined {
  const id = `valeur/${ici.join('/')}/ajouter`;
  const libelle = t('ecran.editeur.valeur.ajouter', { libelle: f.label });
  const valeurs = f.contexte?.choix([...ici, liste.length]) ?? choixDuNoeud(element)?.map((o) => ({ valeur: o.valeur, libelle: o.libelle, refus: null }));
  if (!valeurs) return neuve ? bouton(id, libelle, ecrireLaValeur(porteur, ici, neuve)) : undefined;
  const a: ArgumentDuGeste = { nom: 'valeur', optionnel: false, saisie: 'choix', libelle, valeur: null, valeurs: valeurs.map((v) => ({ ...v, valeur: [...liste, v.valeur] })), bornes: null, note: null, champs: null };
  return elementDeValeur(id, porteur, ici, { ...f, label: libelle }, a);
}

/** L'inspecteur de la zone sélectionnée `zone` de la session `s` : la poignée qui la redimensionne ; d'un déclencheur,
 *  son nom ; d'une zone d'effet, son nom, son identifiant, sa nature, sa forme, son emprise au pinceau et toute son aire
 *  rendue, si elle coupe la ligne de vue, si elle barre le passage, les entrées de fiche qu'elle couvre, et le formulaire
 *  tiré du schéma de son Test de traversée et de ses effets à la traversée et à chaque Round (`formulaireDe`) ; sa couche ;
 *  d'un déclencheur, s'il ne joue qu'une fois, les entrées de fiche qu'il couvre et le formulaire tiré du schéma de sa
 *  condition d'entrée et de son flux ; d'une zone de repos, ses lieux et
 *  sa qualité ; la supprimer. */
function inspecteurDeZone(s: SessionDEdition, zone: ZoneLue): (Choix | Ligne | Bouton | Formulaire)[] {
  const scene = sceneEditee(s);
  const sur = (patch: PatchDeZone): GesteDEdition => ({ geste: 'zone', patch });
  const sel = zone.sel;
  const propre: (Choix | Ligne | Bouton | Formulaire)[] = [];
  if (sel?.type === 'effectZone') {
    const ez = scene.effectZones!.find((z) => z.id === sel.id)!;
    propre.push(
      formulaireDuNom(ez.label, false),
      formulaireDeLIdentifiant(ez.id),
      choix('zone/nature', t('ecran.editeur.zone.nature'), ([null, 'interior', 'exterior'] as const).map((n) =>
        bouton(`zone/nature/${n ?? 'aucune'}`, t(`ecran.editeur.zone.nature.${n ?? 'aucune'}`), sur({ presentation: n }), (ez.presentation ?? null) === n))),
      choix('zone/forme', t('ecran.editeur.zone.forme'), (['rect', 'disc'] as const).map((f) =>
        bouton(`zone/forme/${f}`, t(`ecran.editeur.zone.forme.${f}`), sur({ forme: f }), ez.area.kind === f))),
      ...emprise(ez.id, s.outil),
      bouton('zone/pleine', t('ecran.editeur.zone.emprise.pleine'), sur({ pleine: true }), false, ez.tiles ? null : t('ecran.editeur.zone.emprise.dejaPleine')),
      bouton('zone/blocksLoS', t('ecran.editeur.zone.blocksLoS'), sur({ blocksLoS: !ez.blocksLoS }), !!ez.blocksLoS),
      bouton('zone/barrier', t('ecran.editeur.zone.barrier'), sur({ barrier: !ez.barrier }), !!ez.barrier),
      ...couverture('zone/couvre', ez.couvre, (couvre) => sur({ couvre })),
      ...elementsDuFormulaire({ sorte: 'zone', id: ez.id }, formulaireDe('zone', ez, cadreDeLaSession(s)), ez as unknown as Record<string, unknown>),
    );
  }
  propre.push(choixDeLaCouche(s, 'zone/couche', zone.z, (z) => sur({ z })));
  if (sel?.type === 'trigger') {
    const declencheur = scene.triggers.find((tr) => tr.id === sel.id)!;
    propre.unshift(formulaireDuNom(declencheur.id, false));
    propre.push(
      bouton('zone/uneFois', t('ecran.editeur.zone.uneFois'), sur({ once: !declencheur.once }), !!declencheur.once),
      ...couverture('zone/couvre', declencheur.couvre, (couvre) => sur({ couvre })),
      ...elementsDuFormulaire({ sorte: 'declencheur', id: declencheur.id }, formulaireDe('declencheur', declencheur, cadreDeLaSession(s)), declencheur as unknown as Record<string, unknown>),
    );
  }
  if (sel?.type === 'restZone') {
    const repos = scene.restZones![sel.idx];
    propre.push(
      choix('zone/lieux', t('ecran.editeur.zone.lieux'), LIEUX.map((l) => bouton(`zone/lieux/${l}`, t(`ecran.editeur.zone.lieu.${l}`), sur({ lieux: { [l]: !repos.places[l] } }), !!repos.places[l]))),
      bouton('zone/pietre', t('ecran.editeur.zone.pietre'), sur({ pietre: repos.quality !== 'pietre' }), repos.quality === 'pietre'),
    );
  }
  return [ligne('zone/poignee', t('ecran.editeur.zone.poignee')), ...propre, bouton('zone/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' })];
}

/** Copier l'entité sélectionnée de la session `s`, la coller sur la case pointée, la dupliquer. */
function presse(s: SessionDEdition): Bouton[] {
  const choisie = entiteDeLaSelection(sceneEditee(s), s.sel) ? null : t('ecran.editeur.presse.aucune');
  const coller = !s.presse ? t('ecran.editeur.coller.vide') : s.pointee?.z !== s.z ? t('ecran.editeur.coller.horsCouche') : null;
  return [
    bouton('copier', t('ecran.editeur.copier'), { geste: 'copier' }, false, choisie),
    bouton('coller', t('ecran.editeur.coller'), { geste: 'coller' }, false, coller),
    bouton('dupliquer', t('ecran.editeur.dupliquer'), { geste: 'dupliquer' }, false, choisie),
  ];
}

/** Le pas des réglettes de l'allège et de la chute suspendue, en mètres, et leur plancher (`wallSegSchema`). */
const PAS_D_ALLEGE = 0.1;
const PAS_DE_SUSPENSION = 0.5;
const arrondi = (m: number) => Math.round(m * 100) / 100;

/** Le geste d'inspecteur qui écrit `patch` sur l'arête sélectionnée et, s'il est donné, pose le brouillon `brouillon`. */
const surLArete = (patch: PatchDArete | null, brouillon?: BrouillonDArete | null): GesteDEdition =>
  ({ geste: 'arete', ...(patch ? { patch } : {}), ...(brouillon !== undefined ? { brouillon } : {}) });

/** L'inspecteur de l'arête sélectionnée de la session `s` (vide sans elle) : cloison ou porte ; d'une porte, fermée au
 *  départ et secrète, la difficulté de Perception et la face d'où elle se découvre ; d'une cloison, fenêtre, volets
 *  clos, franchissable, la hauteur d'allège et la chute suspendue ; son matériau, son apparence, son escalade (échelle,
 *  paroi : difficulté, Grimpeur requis) ; la supprimer. Ce que le schéma exige sans valeur par défaut (la difficulté et
 *  la face d'une porte secrète, l'allège d'une croisée franchissable) attend au brouillon de la session, dit en alerte. */
function inspecteurDArete(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const seg = segmentDeLaSelection(sceneEditee(s), s.sel);
  if (!seg) return [];
  const brouillon = s.brouillon ?? {};
  const avec = (b: BrouillonDArete) => (Object.keys(b).length ? b : null);
  const sans = <K extends keyof BrouillonDArete>(...cles: K[]) => avec(Object.fromEntries(Object.entries(brouillon).filter(([k]) => !cles.includes(k as K))));
  const bascule = (id: 'fermee' | 'secrete' | 'fenetre' | 'volets' | 'franchissable' | 'grimpeur', presse: boolean, jeu: GesteDEdition, refus: string | null = null) => bouton(`arete/${id}`, t(`ecran.editeur.inspecteur.${id}`), jeu, presse, refus);
  const porte = porteAuteur(seg);
  const elements: (Choix | Ligne | Bouton)[] = [
    choix('arete/sorte', t('ecran.editeur.inspecteur.sorte'), [
      bouton('arete/cloison', t('ecran.editeur.arete.wall'), surLArete({ door: null, closed: null }), !porte),
      bouton('arete/porte', t('ecran.editeur.arete.door'), surLArete({ door: true, window: null, shuttered: null, crossable: null, allege: null, suspendu: null }, sans('crossable')), porte),
    ]),
  ];
  if (porte) {
    const secret = secretAuteur(seg) ?? brouillon.secret;
    elements.push(
      bascule('fermee', !!seg.closed, surLArete({ closed: seg.closed ? null : true }), secretAuteur(seg) ? t('ecran.editeur.inspecteur.fermee.secrete') : null),
      bascule('secrete', !!secret, secret ? surLArete(secretAuteur(seg) ? { secret: null } : null, sans('secret')) : surLArete(null, { ...brouillon, secret: {} })),
    );
    if (secret) {
      const choisir = (v: Partial<NonNullable<BrouillonDArete['secret']>>) => {
        const suite = { ...secret, ...v };
        return suite.difficulty && suite.face
          ? surLArete({ secret: { difficulty: suite.difficulty, face: suite.face }, closed: true }, sans('secret'))
          : surLArete(null, { ...brouillon, secret: suite });
      };
      elements.push(
        choix('arete/perception', t('ecran.editeur.inspecteur.perception'), (Object.entries(DIFFICULTY_LABELS) as [Difficulty, string][])
          .map(([d, libelle]) => bouton(`arete/perception/${d}`, libelle, choisir({ difficulty: d }), secret.difficulty === d)), 'liste'),
        choix('arete/face', t('ecran.editeur.inspecteur.face'), FACES_D_ARETE.map(([f, libelle]) => bouton(`arete/face/${f}`, libelle, choisir({ face: f }), secret.face === f))),
        ...(secret.difficulty && secret.face ? [] : [ligne('arete/secreteIncomplete', t('ecran.editeur.inspecteur.secrete.incomplete'), 'alerte')]),
      );
    }
  } else {
    elements.push(bascule('fenetre', !!seg.window, seg.window ? surLArete({ window: null }, sans('crossable')) : surLArete({ window: true })));
    if (seg.window) {
      const franchissable = !!(seg.crossable || brouillon.crossable);
      elements.push(
        bascule('volets', !!seg.shuttered, surLArete({ shuttered: seg.shuttered ? null : true })),
        bascule('franchissable', franchissable, franchissable ? surLArete(seg.crossable ? { crossable: null } : null, sans('crossable')) : surLArete(null, { ...brouillon, crossable: true })),
      );
      if (franchissable) {
        const allege = seg.allege;
        const poserLAllege = (m: number) => surLArete({ crossable: true, allege: arrondi(Math.max(0, m)) }, sans('crossable'));
        elements.push(
          allege === undefined
            ? ligne('arete/allege', t('ecran.editeur.inspecteur.allege.manquante'), 'alerte')
            : ligne('arete/allege', t('ecran.editeur.inspecteur.allege', { m: allege })),
          bouton('arete/allege/moins', t('ecran.editeur.inspecteur.moins', { pas: PAS_D_ALLEGE }), poserLAllege((allege ?? 0) - PAS_D_ALLEGE), false, allege ? null : t('ecran.editeur.inspecteur.auPlancher')),
          bouton('arete/allege/plus', t('ecran.editeur.inspecteur.plus', { pas: PAS_D_ALLEGE }), poserLAllege((allege ?? 0) + PAS_D_ALLEGE)),
        );
      }
      if (seg.crossable) {
        const suspendu = seg.suspendu;
        const poserLaChute = (m: number) => surLArete({ suspendu: arrondi(Math.max(PAS_DE_SUSPENSION, m)) });
        elements.push(
          ligne('arete/suspendu', suspendu === undefined ? t('ecran.editeur.inspecteur.suspendu.aucune') : t('ecran.editeur.inspecteur.suspendu', { m: suspendu })),
          bouton('arete/suspendu/aucune', t('ecran.editeur.inspecteur.aucune'), surLArete({ suspendu: null }), false, suspendu === undefined ? t('ecran.editeur.inspecteur.suspendu.aucune') : null),
          bouton('arete/suspendu/moins', t('ecran.editeur.inspecteur.moins', { pas: PAS_DE_SUSPENSION }), poserLaChute((suspendu ?? 0) - PAS_DE_SUSPENSION), false, suspendu !== undefined && suspendu > PAS_DE_SUSPENSION ? null : t('ecran.editeur.inspecteur.auPlancher')),
          bouton('arete/suspendu/plus', t('ecran.editeur.inspecteur.plus', { pas: PAS_DE_SUSPENSION }), poserLaChute(suspendu === undefined ? PAS_DE_SUSPENSION : suspendu + PAS_DE_SUSPENSION)),
        );
      }
    }
  }
  const climb = seg.climb;
  elements.push(
    choix('arete/structure', t('ecran.editeur.structures'), [
      bouton('arete/structure/defaut', t('ecran.editeur.structure.defaut'), surLArete({ structure: null }), seg.structure === undefined),
      ...structuresDeLArete(porte ? 'door' : 'wall').map((st) => bouton(`arete/structure/${st.id}`, st.label, surLArete({ structure: st.id }), seg.structure === st.id)),
    ], 'liste'),
    choix('arete/apparence', t('ecran.editeur.inspecteur.apparence'), [
      bouton('arete/apparence/derivee', t('ecran.editeur.inspecteur.apparence.derivee'), surLArete({ appearance: null }), seg.appearance === undefined),
      ...structureAppearances.map((a) => bouton(`arete/apparence/${a.id}`, a.label, surLArete({ appearance: a.id }), seg.appearance === a.id)),
    ], 'liste'),
    choix('arete/escalade', t('ecran.editeur.inspecteur.escalade'), [
      bouton('arete/escalade/non', t('ecran.editeur.inspecteur.escalade.non'), surLArete({ climb: null }), !climb),
      bouton('arete/escalade/echelle', t('ecran.editeur.inspecteur.escalade.echelle'), surLArete({ climb: { kind: 'ladder' } }), climb?.kind === 'ladder'),
      bouton('arete/escalade/paroi', t('ecran.editeur.inspecteur.escalade.paroi'), surLArete({ climb: { ...(climb?.kind === 'surface' ? climb : {}), kind: 'surface' } }), climb?.kind === 'surface'),
    ]),
  );
  if (climb?.kind === 'surface') {
    elements.push(
      choix('arete/escalade/difficulte', t('ecran.editeur.inspecteur.escalade.difficulte'), (Object.entries(DIFFICULTY_LABELS) as [Difficulty, string][])
        .map(([d, libelle]) => bouton(`arete/escalade/difficulte/${d}`, libelle, surLArete({ climb: { ...climb, difficulty: d } }), (climb.difficulty ?? DIFFICULTE_PAR_DEFAUT) === d)), 'liste'),
      bascule('grimpeur', !!climb.requiresGrimpeur, surLArete({ climb: { kind: 'surface', ...(climb.difficulty ? { difficulty: climb.difficulty } : {}), ...(climb.requiresGrimpeur ? {} : { requiresGrimpeur: true }) } })),
    );
  }
  elements.push(bouton('arete/supprimer', t('ecran.editeur.inspecteur.supprimer'), { geste: 'supprimer' }));
  return elements;
}

/** L'inspecteur de la sélection de la session `s` : de l'entité, de l'entrée, de la zone ou de l'arête sélectionnée ;
 *  vide sans elle. */
function inspecteur(s: SessionDEdition): (Choix | Ligne | Bouton | Formulaire)[] {
  const ent = entiteDeLaSelection(sceneEditee(s), s.sel);
  const entree = entreeDeLaSelection(s);
  const zone = zonesLues(sceneEditee(s)).find((z) => sameSel(z.sel, s.sel));
  if (ent) return inspecteurDEntite(s, ent);
  if (entree) return inspecteurDEntree(s, entree);
  if (zone) return inspecteurDeZone(s, zone);
  const architecture = inspecteurDArchitecture(s);
  if (architecture.length) return architecture;
  return s.sel ? inspecteurDArete(s) : inspecteurDeScene(s);
}

/** Les pas des réglettes de la grille, en cases, de l'échelle, en mètres par case, et du nord, en degrés. */
const PAS_DE_GRILLE: Pas = { pas: 1, unite: '', min: 5, max: Infinity };
const PAS_D_ECHELLE: Pas = { pas: 1, unite: ' m', min: 1, max: Infinity };
const PAS_DU_NORD: Pas = { pas: 15, unite: '°', min: 0, max: 345 };

/** Les pistes de la musique de la scène `scene`, chacune en liste : automatique, le silence ou chaque piste du
 *  registre (`allMusicDefs`), la courante pressée. */
const musiqueDeLaScene = (scene: Scene): Choix[] => (['ambient', 'combat'] as const).map((piste) => {
  const v = scene.music?.[piste];
  const sur = (id?: string | null): GesteDEdition => ({ geste: 'scene', patch: { musique: { piste, ...(id === undefined ? {} : { id }) } } });
  return choix(`scene/musique/${piste}`, t(`ecran.editeur.scene.musique.${piste}`), [
    bouton(`scene/musique/${piste}/auto`, t('ecran.editeur.scene.musique.auto'), sur(), v === undefined),
    bouton(`scene/musique/${piste}/silence`, t('ecran.editeur.scene.musique.silence'), sur(null), v === null),
    ...allMusicDefs().map((d) => bouton(`scene/musique/${piste}/${d.id}`, d.id, sur(d.id), v === d.id)),
  ], 'liste');
});

/** Le formulaire du message d'introduction de la scène `scene` (`{ type: 'introduire', args: [texte] }`), sa saisie
 *  tirée du schéma (`champDuMessage`), multiligne pour une prose, préremplie de son texte. */
const formulaireDuMessage = (scene: Scene): Formulaire =>
  elementDuGeste('introduire', 'introduire', [{ ...argumentDeValeur(champDuMessage(), scene.startMessage?.texte, []), nom: 'texte' }], () => t('ecran.editeur.scene.introduire')) as Formulaire;

/** Les ancres de bataille de la scène éditée de la session `s` : la ligne qui dit qu'elle n'en a aucune, ou de chacune
 *  sa Scène de Round en liste (`ciblesDAncreDeBataille`), sa case, la poser à la case pointée (refusé sans case
 *  pointée), la retirer ; puis en liste, chaque Scène de Round à ancrer. */
function ancresDeBataille(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const stations = sceneEditee(s).stations ?? [];
  const cibles = ciblesDAncreDeBataille();
  const sur = (p: NonNullable<PatchDeScene['stations']>): GesteDEdition => ({ geste: 'scene', patch: { stations: p } });
  const p = s.pointee;
  return [
    ligne('scene/stations', t(stations.length ? 'ecran.editeur.scene.stations' : 'ecran.editeur.scene.stations.aucune')),
    ...stations.flatMap((st, rang) => {
      const id = `scene/stations/${rang}`;
      const n = rang + 1;
      return [
        choix(id, t('ecran.editeur.scene.station', { rang: n }), cibles.map((c) => bouton(`${id}/${c.id}`, c.label, sur({ rang, sceneId: c.id }), st.sceneId === c.id)), 'liste'),
        ligne(`${id}/position`, t('ecran.editeur.scene.station.position', { rang: n, x: st.pos.x, y: st.pos.y, z: st.pos.z ?? 0 })),
        bouton(`${id}/pointee`, t('ecran.editeur.scene.station.pointee', { rang: n }), sur({ rang, pos: p ? { x: p.x, y: p.y, ...(p.z ? { z: p.z } : {}) } : st.pos }), false, p ? null : t('ecran.editeur.scene.station.sansCase')),
        bouton(`${id}/retirer`, t('ecran.editeur.scene.station.retirer', { rang: n }), sur({ retirer: rang })),
      ];
    }),
    choix('scene/stations/ajouter', t('ecran.editeur.scene.stations.ajouter'), cibles.map((c) => bouton(`scene/stations/ajouter/${c.id}`, c.label, sur({ ajouter: c.id }))), 'liste'),
  ];
}

/** L'inspecteur de la scène éditée de la session `s`, sans sélection : le formulaire qui la nomme, celui qui la décrit ;
 *  sa grille, largeur et hauteur à la réglette ; les entrées de fiche qu'elle couvre ; les groupes du lieu
 *  (`groupesDuLieu`) ; son ambiance, son échelle, sa lumière ambiante, son nord, son environnement et sa météo ; sa
 *  musique ; le formulaire de son message d'introduction ; la matière de chaque partie de son relief ; sa toiture par
 *  défaut ; son repos sur place ; ses drapeaux de départ, et le formulaire qui en ajoute un ; ses ancres de bataille. */
function inspecteurDeScene(s: SessionDEdition): (Choix | Ligne | Bouton | Formulaire)[] {
  const scene = sceneEditee(s);
  const sur = (patch: PatchDeScene): GesteDEdition => ({ geste: 'scene', patch });
  const scalaire = (patch: NonNullable<PatchDeScene['scalaires']>) => sur({ scalaires: patch });
  const { w, h } = scene.dimensions;
  const echelle = sceneMetresPerTile(scene);
  const toit = scene.roofDefaults;
  const repos = reposDeScene(scene);
  const nonDit = t('ecran.editeur.scene.nonDit');
  return [
    formulaireDuNom(scene.label, false),
    formulaireDeLIdentifiant(scene.id),
    formulaireAUnChamp('decrire', t('ecran.editeur.scene.decrire'), 'desc', t('ecran.editeur.scene.description'), scene.desc ?? '', true),
    ...reglette('scene/largeur', t('ecran.editeur.scene.largeur', { v: w }), w, PAS_DE_GRILLE, (v) => sur({ dimensions: { w: v, h } })),
    ...reglette('scene/hauteur', t('ecran.editeur.scene.hauteur', { v: h }), h, PAS_DE_GRILLE, (v) => sur({ dimensions: { w, h: v } })),
    ...couverture('scene/couvre', scene.couvre, (couvre) => scalaire({ couvre })),
    ...listeDIds('scene/groupes', 'scene.groupes', scene.groups, new Map(groupesDuLieu().map((g) => [String(g.valeur), g.libelle])), (groups) => scalaire({ groups })),
    choix('scene/ambiance', t('ecran.editeur.scene.ambiance'), AMBIANCES.map((a) => bouton(`scene/ambiance/${a}`, t(`ecran.editeur.scene.ambiance.${a}`), scalaire({ ambiance: a }), (scene.ambiance ?? 'exterieur') === a))),
    ...reglette('scene/echelle', t('ecran.editeur.scene.echelle', { v: echelle }), echelle, PAS_D_ECHELLE, (v) => scalaire({ metresPerTile: v })),
    choix('scene/lumiere', t('ecran.editeur.scene.lumiere'), [
      bouton('scene/lumiere/auto', t('ecran.editeur.scene.lumiere.auto'), scalaire({ ambientLight: null }), scene.ambientLight === undefined),
      ...lightLevels.map((l) => bouton(`scene/lumiere/${l.id}`, l.label, scalaire({ ambientLight: l.id }), scene.ambientLight === l.id)),
    ], 'liste'),
    ...reglette('scene/nord', scene.northDeg === undefined ? t('ecran.editeur.scene.nord.haut') : t('ecran.editeur.scene.nord', { v: scene.northDeg }), scene.northDeg ?? 0, PAS_DU_NORD,
      (v) => sur({ nord: v }), { libelle: t('ecran.editeur.scene.nord.defaut'), jeu: sur({ nord: null }), presse: scene.northDeg === undefined }),
    choix('scene/environnement', t('ecran.editeur.scene.environnement'), [null, ...ENVIRONNEMENTS].map((e) =>
      bouton(`scene/environnement/${e ?? 'aucun'}`, e ? t(`ecran.editeur.scene.environnement.${e}`) : nonDit, scalaire({ environment: e }), (scene.environment ?? null) === e))),
    choix('scene/meteo', t('ecran.editeur.scene.meteo'), [
      bouton('scene/meteo/aucune', nonDit, scalaire({ weather: null }), scene.weather === undefined),
      ...METEOS.map(([m, libelle]) => bouton(`scene/meteo/${m}`, libelle, scalaire({ weather: m }), scene.weather === m)),
    ], 'liste'),
    ...musiqueDeLaScene(scene),
    formulaireDuMessage(scene),
    ...PARTS_RELIEF.map((part) => choix(`scene/relief/${part}`, t(`ecran.editeur.scene.relief.${part}`), matieresDe('relief').map((m) =>
      bouton(`scene/relief/${part}/${m.id}`, m.label, sur({ relief: { [part]: { id: m.id } } }), scene.reliefDefaults[part].id === m.id)), 'liste')),
    ligne('scene/toiture', t('ecran.editeur.scene.toiture')),
    choixDeCouverture('scene/toiture/couverture', toit.material, (m) => sur({ toiture: { material: m } }), null),
    ...reglette('scene/toiture/pente', t('ecran.editeur.toiture.pente', { v: toit.pitchDeg }), toit.pitchDeg, PAS_DE_PENTE, (v) => sur({ toiture: { pitchDeg: v } })),
    ...reglette('scene/toiture/comble', t('ecran.editeur.toiture.comble', { v: toit.riseMaxStoreys }), toit.riseMaxStoreys, PAS_D_ETAGE, (v) => sur({ toiture: { riseMaxStoreys: v } })),
    choix('scene/repos', t('ecran.editeur.scene.repos'), LIEUX.map((l) => bouton(`scene/repos/${l}`, t(`ecran.editeur.zone.lieu.${l}`), sur({ repos: { lieux: { [l]: !repos[l] } } }), !!repos[l]))),
    bouton('scene/repos/pietre', t('ecran.editeur.zone.pietre'), sur({ repos: { pietre: repos.quality !== 'pietre' } }), repos.quality === 'pietre'),
    ...(Object.keys(scene.flags).length ? [
      choix('scene/drapeau', t('ecran.editeur.scene.drapeaux'), Object.entries(scene.flags).map(([cle, valeur]) => bouton(`scene/drapeau/${cle}`, cle, sur({ drapeaux: { [cle]: !valeur } }), valeur))),
      choix('scene/drapeau/retirer', t('ecran.editeur.scene.drapeau.retirer'), Object.keys(scene.flags).map((cle) => bouton(`scene/drapeau/retirer/${cle}`, cle, sur({ drapeaux: { [cle]: null } }))), 'liste'),
    ] : []),
    formulaireAUnChamp('drapeau', t('ecran.editeur.scene.drapeau.ajouter'), 'cle', t('ecran.editeur.scene.drapeau.cle'), '', false),
    ...ancresDeBataille(s),
  ];
}

/** La ligne du parapet crénelé de la case pointée de la session `s`, sa structure ; aucune sans parapet. */
function ligneDuParapet(s: SessionDEdition): Ligne[] {
  const p = s.pointee;
  const parapet = p ? crenellatedAt(sceneEditee(s), p.x, p.y, p.z) : null;
  return parapet === null ? [] : [ligne('crenelage', t('ecran.editeur.pointee.crenelage', { structure: libelleDeStructure(parapet) ?? parapet }))];
}

/** Le pas de la réglette d'opacité du calque. */
const PAS_D_OPACITE = 0.1;

/** Le calque de référence de la couche éditée de la session `s` : sa couche ; la planche qui se charge, ou, sans
 *  calque, de quoi en charger une ; pendant le calage, l'étape à cliquer et l'abandon ; sinon, visible, au-dessus ou en
 *  dessous, l'opacité à la réglette, l'échelle de son calage, la rotation que le calage déduit, le calage (refusé au
 *  calque caché), remplacer la planche, retirer le calque. Des calques d'un autre format retirés à l'ouverture se
 *  disent en alerte. */
function zoneDuCalque(s: SessionDEdition): (Choix | Ligne | Bouton)[] {
  const tete = [ligne('calque', t('ecran.editeur.calque', { z: s.z })), ...(s.ecartes ? [ligne('calque/ecartes', t('ecran.editeur.calque.ecartes'), 'alerte')] : [])];
  if (s.chargement) return [...tete, ligne('calque/chargement', t('ecran.editeur.calque.chargement'))];
  const calque = calqueDeLaCouche(s);
  const charger = bouton('calque/charger', t(calque ? 'ecran.editeur.calque.remplacer' : 'ecran.editeur.calque.charger'), { geste: 'planche' });
  if (!calque) return [...tete, ligne('calque/aucun', t('ecran.editeur.calque.aucun')), charger];
  if (s.calage.step !== 'idle') {
    return [...tete, ligne('calque/calage', t(`ecran.editeur.calque.calage.${s.calage.step}`)), bouton('calque/calage/annuler', t('ecran.editeur.calque.calage.annuler'), { geste: 'caler', actif: false })];
  }
  const regler = (reglage: { opacite?: number; visible?: boolean; dessus?: boolean; rotation?: boolean }): GesteDEdition => ({ geste: 'calque', reglage });
  const pas = Math.round(PAS_D_OPACITE * 100);
  return [
    ...tete,
    bouton('calque/visible', t('ecran.editeur.calque.visible'), regler({ visible: !calque.visible }), calque.visible),
    choix('calque/position', t('ecran.editeur.calque.position'), [
      bouton('calque/dessus', t('ecran.editeur.calque.dessus'), regler({ dessus: true }), calque.dessus),
      bouton('calque/dessous', t('ecran.editeur.calque.dessous'), regler({ dessus: false }), !calque.dessus),
    ]),
    ligne('calque/opacite', t('ecran.editeur.calque.opacite', { pourcent: Math.round(calque.opacite * 100) })),
    bouton('calque/opacite/moins', t('ecran.editeur.calque.moins', { pas }), regler({ opacite: arrondi(Math.max(0, calque.opacite - PAS_D_OPACITE)) }), false, calque.opacite > 0 ? null : t('ecran.editeur.inspecteur.auPlancher')),
    bouton('calque/opacite/plus', t('ecran.editeur.calque.plus', { pas }), regler({ opacite: arrondi(Math.min(1, calque.opacite + PAS_D_OPACITE)) }), false, calque.opacite < 1 ? null : t('ecran.editeur.calque.auMaximum')),
    ligne('calque/echelle', t('ecran.editeur.calque.echelle', { px: arrondi(1 / calque.calage.scale) })),
    bouton('calque/rotation', t('ecran.editeur.calque.rotation'), regler({ rotation: !calque.rotation }), calque.rotation),
    bouton('calque/caler', t('ecran.editeur.calque.caler'), { geste: 'caler', actif: true }, false, calque.visible ? null : t('ecran.editeur.calque.caler.cache')),
    charger,
    bouton('calque/retirer', t('ecran.editeur.calque.retirer'), { geste: 'retirerCalque' }),
  ];
}

/** La planche que l'hôte garde pour le calque de la couche `z` de la scène `sceneId` du projet `projetId`. */
export const cheminDeLaPlanche = (projetId: string, sceneId: string, z: number): string => `calques/${projetId}/${sceneId}/${z}`;

/** Le calque de la couche éditée de la session `s` à poser sur le monde, `null` sans lui ou caché. */
export function calqueAffiche(s: SessionDEdition): CalqueAffiche | null {
  const c = calqueDeLaCouche(s);
  return c?.visible
    ? { image: cheminDeLaPlanche(s.projet.id, s.sceneId, s.z), coins: coinsDuCalque(c), plan: planDuCalque(sceneEditee(s), s.z), opacite: c.opacite, dessus: c.dessus }
    : null;
}

/** Ce que l'hôte garde des calques après le geste qui mène de `avant` (`null` : l'ouverture) à `apres` : `null` s'ils
 *  n'ont pas changé ; sinon leur forme stockée, les planches des calques retirés, à oublier, et celles de la scène
 *  renommée, à déplacer sous son nouvel identifiant. À l'ouverture, ils ne changent que retirés d'un autre format. */
export function memoireDesCalques(avant: SessionDEdition | null, apres: SessionDEdition): { calques: CalquesStockes; oublier: string[]; deplacer: { de: string; vers: string }[] } | null {
  if (avant ? apres.calques === avant.calques : !apres.ecartes) return null;
  const siens = avant && avant.sceneId !== apres.sceneId && !avant.calques[apres.sceneId] ? avant.calques[avant.sceneId] : undefined;
  const renommee = siens && apres.calques[apres.sceneId] === siens ? avant!.sceneId : null;
  const oublier = Object.entries(avant?.calques ?? {}).filter(([sceneId]) => sceneId !== renommee).flatMap(([sceneId, couches]) =>
    Object.keys(couches).filter((z) => !apres.calques[sceneId]?.[z]).map((z) => cheminDeLaPlanche(apres.projet.id, sceneId, Number(z))));
  const deplacer = renommee ? Object.keys(siens!).map((z) => ({ de: cheminDeLaPlanche(apres.projet.id, renommee, Number(z)), vers: cheminDeLaPlanche(apres.projet.id, apres.sceneId, Number(z)) })) : [];
  return { calques: calquesAStocker(apres.calques), oublier, deplacer };
}

/** Les scènes du projet de la session `s` : chacune en liste, l'éditée pressée, qui s'édite à sa pression ; en ajouter
 *  une vide, dupliquer l'éditée, la retirer, refusé pour la seule scène du projet. */
function scenesDuProjet(s: SessionDEdition): (Choix | Bouton)[] {
  const scenes = s.projet.scenes;
  return [
    choix('scenes', t('ecran.editeur.scenes', { n: scenes.length }), scenes.map((sc) => bouton(`scenes/${sc.id}`, sc.id === s.sceneId ? sceneEditee(s).label || sc.id : sc.label || sc.id, { geste: 'scenes', quoi: 'aller', id: sc.id }, sc.id === s.sceneId)), 'liste'),
    bouton('scenes/ajouter', t('ecran.editeur.scenes.ajouter'), { geste: 'scenes', quoi: 'ajouter' }),
    bouton('scenes/dupliquer', t('ecran.editeur.scenes.dupliquer'), { geste: 'scenes', quoi: 'dupliquer' }),
    bouton('scenes/retirer', t('ecran.editeur.scenes.retirer'), { geste: 'scenes', quoi: 'retirer' }, false, scenes.length > 1 ? null : t('ecran.editeur.scenes.seule')),
  ];
}

/** Pourquoi la session `s` ne s'enregistre pas : son projet vient du jeu, un enregistrement est en cours, ou ses
 *  scènes sont celles que le dépôt porte. */
function refusDEnregistrer(s: SessionDEdition): string | null {
  if (!s.depot) return t('ecran.editeur.enregistrer.horsDuDepot');
  if (s.depot.enCours) return t('ecran.editeur.enregistrer.enCours');
  const scenes = scenesDeLaSession(s);
  const memes = scenes.length === s.depot.enregistrees.length && scenes.every((sc, i) => sc === s.depot!.enregistrees[i]);
  return memes ? t('ecran.editeur.rien.enregistrer') : null;
}

/**
 * La réponse porte `zones`, ci-dessus, et `couche`, la couche éditée. `surcouche.cases` porte les cases `{ x, y, z }`
 * que trace le geste en cours (`surcoucheDeLEdition`) : le rectangle tiré, ou les cases que le pinceau a couvertes,
 * puis le tracé de la volée, dont chaque case appuyée ou glissée bascule ; `surcouche.arete`, l'arête sélectionnée
 * (`areteDessinee`), `null` sans elle ; `surcouche.zones`, chaque zone de la couche éditée, déclencheurs, zones de
 * repos puis zones d'effet, `{ sorte, nom, cases, choisi }` (`declencheur`, `repos`, `piece` (`isRoomZone`) ou `zone` ;
 * son nom, l'id d'un déclencheur ou le libellé d'une zone d'effet ; ses cases `{ x, y, z }`, l'emprise d'une zone
 * d'effet (`sceneZoneTiles`) ; et si elle est sélectionnée), puis, à l'outil d'architecture, chaque partie du corps
 * actif et chacune de ses masses de toiture posées à la main (`partie`, `masse`, nommées de leur id), puis le défaut de
 * plan suivi, tant que la validation le relève (`defaut`, « Défaut », ses cases sur la couche éditée, `casesDuDefaut`,
 * choisi) ; `surcouche.poignee`, la case `{ x, y, z }` du coin sud-est du rectangle de la sélection sur la couche
 * éditée (`poigneeDeLaSelection`), `null` sans elle : l'appui de la sélection sur elle redimensionne la sélection au
 * glissé (`resizeSel`) ; `surcouche.reperes`, chaque entité puis chaque entrée de la couche éditée, `{ sorte, id, x, y,
 * z, nom, choisi }` (plusieurs peuvent tenir dans une case : deux décors calés, un objet posé sur une table ; l'hôte y
 * montre la plaque de la sélection et joint leurs noms) (`prop`, `personnage`, `heroStart` ou `entree`, son nom comme à
 * `editeur.pointee`, et si elle est sélectionnée). `aretes` porte les arêtes de la couche éditée hors des ponts des
 * navires (`aretesDeLaCouche`, chacune comme la méthode `aretes` la sert), rendues avec `monde`, comme `navires`, les navires de la
 * scène sous la forme de `corps.navires` (section « Corps d'un combattant »). `monde` porte le manifeste du volume du monde de
 * la vue de la scène éditée, les ponts de ses navires posés (`vueDeLaScene`), comme `monde.monde` (section « Monde ») ;
 * `morceaux`, source `edition`, en sert la géométrie. `retrait` porte le masque des couches au-dessus de la couche
 * éditée (`retraitDuMonde(scene, z)`, section « Monde »). Tous deux ne sont rendus qu'à l'ouverture, et sans geste en
 * cours quand la scène ou la couche a changé depuis le dernier rendu : jamais pendant un glissé, dont la surcouche
 * tient lieu. Le
 * geste « Enregistrer » rend `depot: { id, texte }`, le texte du projet, ses scènes à jour (`scenesDeLaSession`), passé
 * par la porte, en forme dépôt (`texteAEnregistrer`) ; l'enregistrement est en cours jusqu'à son issue, et les scènes
 * écrites ne sont tenues pour enregistrées qu'à l'issue réussie.
 *
 * Le calque de référence (#830) est une planche de livre posée sur le plan d'une couche pour la décalquer, un par
 * couche de chaque scène : une aide d'auteur que l'hôte garde chez lui, jamais une donnée de scène. `calque` porte
 * celui de la couche éditée, `null` sans lui ou caché (`calqueAffiche`, `src/hote/editeur.ts`) : `{ image, coins, plan,
 * opacite, dessus }`, le chemin de sa planche chez l'hôte (`calques/<projet>/<scène>/<couche>`), ses quatre coins sur
 * la carte en cases continues, dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche de l'image
 * (`coinsDuCalque`), son plan, la hauteur la plus fréquente des cases de sa couche en mètres (`planDuCalque`), son
 * opacité de 0 à 1, et s'il passe au-dessus de la scène construite. Le geste « Charger une planche… » rend `planche: {
 * image }`, le chemin où l'hôte écrit l'image que l'auteur choisit ; le chargement est en cours jusqu'à son issue, qui
 * pose le calque neuf, l'image entière sur la carte, son coin haut-gauche au coin de la case 0, 0, à 60 %. Pendant le
 * calage, l'appui cale le calque au point touché (`caler`, `src/noyau/edition/calque.ts` ; `advanceCalibration`,
 * `src/noyau/edition/calage.ts`) et le glissé n'ouvre aucun geste : deux points de l'image, chacun suivi du nœud de
 * grille le plus proche du point touché ; au second nœud, la similitude qui les y envoie, à angle nul sans la rotation.
 * Changer de couche l'abandonne. Chaque geste qui change les calques rend `memoire: { calques, oublier, deplacer }`
 * (`memoireDesCalques`) : tous les calques de la campagne dans la forme que l'hôte garde (`{ version, calques }`), les
 * chemins des planches des calques retirés, et ceux des planches de la scène renommée, `{ de, vers }`, le chemin quitté
 * et le chemin pris ; l'ouverture le rend aussi quand elle a retiré des calques d'un autre format.
 * @contrat Éditeur
 */
/** Les zones de l'éditeur de la session `s`. Le terrain s'ouvre sur le premier terrain, ou garde celui de l'outil ; le
 *  navire, sur le premier type et le premier cap. Les couches et la case pointée se lisent sur la vue de la scène
 *  (`vueDeLaScene`), ses navires posés par leurs ponts. */
export function zonesDeLEditeur(s: SessionDEdition): ZonesDeLEditeur {
  const scene = sceneEditee(s);
  const terrain = s.outil.mode === 'terrain' ? s.outil.terrain : terrainIds()[0];
  const outil = s.outil;
  const kindDeLOutil = (kind: 'prop' | 'personnage') => (outil.mode === 'entite' && outil.kind === kind ? outil.ref : undefined);
  const etages = couchesDeLaVue(s);
  const navire = outil.mode === 'navire' ? outil : { ref: TYPES_DE_NAVIRE[0].id, cap: CAPS_DES_PONTS[0] };
  const outils = [
    bouton('outil/select', t('ecran.editeur.outil.select'), { geste: 'outil', outil: { mode: 'selection' } }, s.outil.mode === 'selection'),
    bouton('outil/tile', t('ecran.editeur.outil.tile'), { geste: 'outil', outil: { mode: 'terrain', terrain } }, s.outil.mode === 'terrain'),
    bouton('outil/height', t('ecran.editeur.outil.height'), { geste: 'outil', outil: { mode: 'hauteur', metres: HAUTEURS[0].metres } }, s.outil.mode === 'hauteur'),
    bouton('outil/wall', t('ecran.editeur.outil.wall'), { geste: 'outil', outil: { mode: 'arete', paint: 'wall' } }, s.outil.mode === 'arete'),
    bouton('outil/stair', t('ecran.editeur.outil.stair'), { geste: 'outil', outil: { mode: 'escalier', toZ: etages.find((z) => z > s.z) ?? s.z } }, s.outil.mode === 'escalier'),
    bouton('outil/crenellated', t('ecran.editeur.outil.crenellated'), { geste: 'outil', outil: { mode: 'crenelage', structure: structuresCrenelables()[0]?.id ?? null } }, s.outil.mode === 'crenelage'),
    bouton('outil/prop', t('ecran.editeur.outil.prop'), { geste: 'outil', outil: { mode: 'entite', kind: 'prop', ref: kindDeLOutil('prop') ?? props[0].id } }, kindDeLOutil('prop') !== undefined),
    bouton('outil/personnage', t('ecran.editeur.outil.personnage'), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: kindDeLOutil('personnage') ?? fichesDePersonnage()[0].id } }, kindDeLOutil('personnage') !== undefined),
    bouton('outil/navire', t('ecran.editeur.outil.navire'), { geste: 'outil', outil: { mode: 'navire', ref: navire.ref, cap: navire.cap } }, outil.mode === 'navire', refusDuNavire(scene, navire.ref)),
    bouton('outil/emplacement', t('ecran.editeur.outil.emplacement'), { geste: 'outil', outil: { mode: 'emplacement', trappingId: outil.mode === 'emplacement' ? outil.trappingId : siegeEngines()[0].id } }, outil.mode === 'emplacement'),
    bouton('outil/heroStart', t('ecran.editeur.outil.heroStart'), { geste: 'outil', outil: { mode: 'entite', kind: 'heroStart' } }, s.outil.mode === 'entite' && s.outil.kind === 'heroStart'),
    bouton('outil/entry', t('ecran.editeur.outil.entry'), { geste: 'outil', outil: { mode: 'entree' } }, s.outil.mode === 'entree'),
    bouton('outil/architecture', t('ecran.editeur.outil.architecture'), { geste: 'outil', outil: { mode: 'architecture', action: 'selection' } }, outil.mode === 'architecture'),
    bouton('outil/zone', t('ecran.editeur.outil.zone'), { geste: 'outil', outil: { mode: 'zone', zone: outil.mode === 'zone' ? outil.zone : ZONE_VARIANTS[0] } }, outil.mode === 'zone'),
    bouton('outil/erase', t('ecran.editeur.outil.erase'), { geste: 'outil', outil: { mode: 'gomme' } }, s.outil.mode === 'gomme'),
  ];
  const couches = etages.map((z) => bouton(`couche/${z}`, t('ecran.editeur.couche', { z }), { geste: 'couche', z }, s.z === z));
  const p = s.pointee;
  const vue = vueDeLaScene(s);
  return {
    'editeur.titre': [ligne('scene', scene.label || scene.id)],
    'editeur.scenes': scenesDuProjet(s),
    'editeur.outils': [choix('outils', t('ecran.editeur.outils'), outils)],
    'editeur.options': options(s),
    'editeur.couches': [
      choix('couches', t('ecran.editeur.couches'), couches),
      bouton('couche/ajouter', t('ecran.editeur.couche.ajouter'), { geste: 'ajouterCouche' }),
      bouton('couche/retirer', t('ecran.editeur.couche.retirer'), { geste: 'retirerCouche' }, false,
        s.z === 0 ? t('ecran.editeur.couche.rez') : scene.layers.some((l) => l.z === s.z) ? null : t('ecran.editeur.couche.ponts')),
    ],
    'editeur.historique': [
      bouton('annuler', t('ecran.editeur.annuler'), { geste: 'annuler' }, false, s.historique.passe.length ? null : t('ecran.editeur.rien.annuler')),
      bouton('retablir', t('ecran.editeur.retablir'), { geste: 'retablir' }, false, s.historique.futur.length ? null : t('ecran.editeur.rien.retablir')),
    ],
    'editeur.presse': presse(s),
    'editeur.fichier': [
      bouton('enregistrer', t('ecran.editeur.enregistrer'), { geste: 'enregistrer' }, false, refusDEnregistrer(s)),
      bouton('tester', t('ecran.editeur.tester'), { geste: 'tester' }),
    ],
    'editeur.pointee': [
      ...(p ? [ligne('pointee', t('ecran.editeur.pointee', { x: p.x, y: p.y, z: p.z, terrain: terrainLabel(tileAt(vue, p.x, p.y, p.z)), hauteur: heightAt(vue, p.x, p.y, p.z) }))] : []),
      ...ligneDuParapet(s),
      ...ligneDeLArete(s),
      ...ligneDeLaSelection(s),
    ],
    'editeur.inspecteur': inspecteur(s),
    'editeur.validation': validation(s),
    'editeur.calque': zoneDuCalque(s),
  };
}

/** Les avertissements que la validation montre d'emblée ; au-delà, leur nombre. */
const AVERTISSEMENTS_MONTRES = 20;

/** La validation de la scène éditée de la session `s` (`avertissementsDeLaSession`) : sans défaut, ce qu'elle a
 *  contrôlé ; sinon leur décompte, puis chaque avertissement, son niveau et son message, et, s'il désigne un fautif de
 *  la carte (`versLaFautive`), le bouton qui y mène ; au-delà des premiers, le nombre des autres. */
function validation(s: SessionDEdition): (Ligne | Bouton)[] {
  const ws = avertissementsDeLaSession(s);
  if (!ws.length) return [ligne('validation', t('ecran.editeur.validation.aucun', { controle: [t('ecran.editeur.validation.logique'), t('ecran.editeur.validation.architecture'), ...PLAN_DEFECT_FAMILIES.map((f) => f.title)].join(' ; ') }))];
  const erreurs = ws.filter((w) => w.level === 'error').length;
  return [
    ligne('validation', t('ecran.editeur.validation', { erreurs, avertissements: ws.length - erreurs })),
    ...ws.slice(0, AVERTISSEMENTS_MONTRES).flatMap((w, rang) => [
      ligne(`validation/${rang}`, t(`ecran.editeur.validation.${w.level}`, { message: w.message })),
      ...(versLaFautive(w) ? [bouton(`validation/${rang}/aller`, t('ecran.editeur.validation.aller'), { geste: 'avertissement', rang })] : []),
    ]),
    ...(ws.length > AVERTISSEMENTS_MONTRES ? [ligne('validation/reste', t('ecran.editeur.validation.reste', { n: ws.length - AVERTISSEMENTS_MONTRES }))] : []),
  ];
}

/** Les repères de la couche éditée de la session `s` : ses entités, puis ses entrées. */
function reperes(s: SessionDEdition): RepereDeLEdition[] {
  const scene = sceneEditee(s);
  const choisi = (type: 'entity' | 'entry', id: string) => s.sel?.type === type && s.sel.id === id;
  return [
    ...scene.entities.filter((e) => (e.z ?? 0) === s.z)
      .map((e) => ({ sorte: e.kind, id: e.id, x: e.pos.x, y: e.pos.y, z: s.z, nom: nomALEcran(s, e), choisi: choisi('entity', e.id) })),
    ...Object.entries(scene.entryPoints ?? {}).filter(([, p]) => (p.z ?? 0) === s.z)
      .map(([id, p]) => ({ sorte: 'entree' as const, id, x: p.x, y: p.y, z: s.z, nom: id, choisi: choisi('entry', id) })),
  ];
}

/** La surcouche du geste en cours de la session `s`, sur sa couche éditée, ses repères, ses zones et la poignée de la
 *  sélection. */
export function surcoucheDeLEdition(s: SessionDEdition): SurcoucheDeLEdition {
  const scene = sceneEditee(s);
  const g = s.geste;
  const cases = g?.sorte === 'trait' ? g.trace : g?.sorte === 'rectangle' ? casesDuRect(g.rect) : [];
  const seg = segmentDeLaSelection(scene, s.sel);
  const poignee = poigneeDeLaSelection(scene, s.sel, s.z);
  const aLaCouche = (c: { x: number; y: number }) => ({ x: c.x, y: c.y, z: s.z });
  return {
    cases: [...cases, ...s.volee].map(aLaCouche),
    arete: seg ? areteDessinee(scene, seg) : null,
    reperes: reperes(s),
    zones: [
      ...[...zonesLues(scene), ...(s.outil.mode === 'architecture' ? ouvragesLus(s) : [])].filter((z) => z.z === s.z).map((z) => ({ sorte: z.sorte, nom: z.nom, cases: z.cases.map(aLaCouche), choisi: sameSel(z.sel, s.sel) })),
      ...defautSuivi(s),
    ],
    poignee: poignee && aLaCouche(poignee),
  };
}

/** Le défaut de plan que suit la session `s`, ses cases de la couche éditée, choisi ; aucun sans lui, ou corrigé. */
function defautSuivi(s: SessionDEdition): ZoneDeLEdition[] {
  const cases = casesDuDefaut(s).filter((c) => c.z === s.z);
  return cases.length ? [{ sorte: 'defaut', nom: t('ecran.editeur.validation.defaut'), cases, choisi: true }] : [];
}

/** Le bouton des zones `z` qui joue le geste d'édition `edition`, un qui l'offre sans refus d'abord ; `undefined` si
 *  aucun ne le joue. */
export function boutonDeLEdition(z: ZonesDeLEditeur, edition: unknown): Bouton | undefined {
  const cle = jsonCanonique({ edition });
  const jouant = Object.values(z).flat().flatMap((e: Ligne | Choix | Bouton) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : []))
    .filter((b) => jsonCanonique(b.jeu) === cle);
  return jouant.find((b) => !b.refus) ?? jouant[0];
}

const estEntier = (v: unknown): v is number => Number.isInteger(v);
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Le geste du formulaire de l'inspecteur que portent les zones `z`, joué `{ type, args }` : celui qui nomme la
 *  sélection ou la scène (`formulaireDuNom`), `{ geste: 'nommer', nom }`, le nom saisi, absent s'il est laissé vide ;
 *  celui qui change l'identifiant de la zone d'effet (`formulaireDeLIdentifiant`), `{ geste: 'identifier', id }`, ou
 *  d'une action du décor (`identifiantsDesActions`), `{ geste: 'identifier', id, action }`, quand un formulaire des zones
 *  désigne cette action ; celui
 *  qui décrit la scène, sa description, retirée si elle est laissée vide ; celui qui écrit le message d'introduction de
 *  la scène, son texte tel quel, retiré s'il est laissé vide ; celui qui ajoute un drapeau de départ à la
 *  scène, vrai ; celui qui pose une troupe du personnage sélectionné, `{ geste: 'troupe', nombre }`, un entier entre
 *  `BORNES_DE_LA_TROUPE` ; celui qui écrit une valeur d'un formulaire tiré du schéma (`elementDeValeur`), `args` son porteur,
 *  son chemin et la valeur saisie, `{ geste: 'valeur', porteur, chemin, valeur }`, quand un formulaire des zones porte
 *  ce porteur et ce chemin, ou qu'une valeur d'un de leurs choix joue ce geste même ; `undefined` si les zones ne
 *  portent pas ce formulaire ou si `args` n'est pas ce qu'il saisit. */
export function gesteDuFormulaire(z: ZonesDeLEditeur, jeu: unknown): GesteDEdition | undefined {
  if (!estObjet(jeu) || Object.keys(jeu).length !== 2 || !VERBES_DE_FORMULAIRE.includes(jeu.type as string) || !Array.isArray(jeu.args)) return undefined;
  const formulaires = z['editeur.inspecteur'].filter((e): e is Formulaire => e.type === 'formulaire' && e.verbe === jeu.type);
  if (jeu.type === 'valeur') {
    const [porteur, chemin, ...valeur] = jeu.args as unknown[];
    const pose = jsonCanonique([porteur, chemin]);
    const joue = jsonCanonique(jeu);
    const offert = formulaires.some((f) => jsonCanonique(f.champs.slice(0, 2).map((c) => (c.type === 'fixe' ? c.valeur : undefined))) === pose)
      || z['editeur.inspecteur'].some((e) => (e.type === 'choix' || e.type === 'liste') && e.valeurs.some((b) => jsonCanonique(b.jeu) === joue));
    return offert && valeur.length <= 1 ? { geste: 'valeur', porteur: porteur as PorteurDeValeur, chemin: chemin as Segment[], ...(valeur.length ? { valeur: valeur[0] } : {}) } : undefined;
  }
  if (jeu.type === 'identifier') {
    const [premier, second, ...reste] = jeu.args as unknown[];
    const [action, id] = jeu.args.length === 2 ? [premier, second] : [undefined, premier];
    const offert = formulaires.some(({ champs: [designe] }) => (designe.type === 'fixe' ? designe.valeur === action : action === undefined));
    if (!offert || reste.length || typeof id !== 'string') return undefined;
    return typeof action === 'string' ? { geste: 'identifier', id, action } : { geste: 'identifier', id };
  }
  if (jeu.type === 'troupe') {
    const [nombre, ...reste] = jeu.args as unknown[];
    const borne = estEntier(nombre) && nombre >= BORNES_DE_LA_TROUPE.min && nombre <= BORNES_DE_LA_TROUPE.max;
    return formulaires.length && !reste.length && borne ? { geste: 'troupe', nombre } : undefined;
  }
  const [valeur, ...reste] = jeu.args as unknown[];
  const vide = valeur === undefined || valeur === null;
  const optionnel = jeu.type === 'nommer' || jeu.type === 'decrire' || jeu.type === 'introduire';
  if (reste.length || !(typeof valeur === 'string' || (vide && optionnel))) return undefined;
  if (!formulaires.length) return undefined;
  const texte = typeof valeur === 'string' ? valeur : undefined;
  switch (jeu.type) {
    case 'decrire': return { geste: 'scene', patch: { scalaires: { desc: texte?.trim() || null } } };
    case 'introduire': return { geste: 'scene', patch: { message: texte ?? '' } };
    case 'drapeau': return texte?.trim() ? { geste: 'scene', patch: { drapeaux: { [texte.trim()]: true } } } : undefined;
    default: return { geste: 'nommer', ...(texte !== undefined ? { nom: texte } : {}) };
  }
}

/** Pourquoi la session `s` n'écrit pas la valeur du geste `g` (`refusDeLaValeur`), dit à l'auteur, la règle enfreinte
 *  telle qu'elle se dit ; `null` si elle l'écrit. */
export function refusDeLaValeurDit(s: SessionDEdition, g: Extract<GesteDEdition, { geste: 'valeur' }>): string | null {
  const refus = refusDeLaValeur(s, g);
  if (refus === null) return null;
  const chemin = g.chemin.join('/');
  return typeof refus === 'object' ? t('ecran.editeur.valeur.refus.regle', { chemin, regle: refus.regle }) : t(`ecran.editeur.valeur.refus.${refus}`, { chemin });
}

/** Les verbes des formulaires de l'inspecteur. */
const VERBES_DE_FORMULAIRE: readonly string[] = ['nommer', 'identifier', 'decrire', 'introduire', 'drapeau', 'valeur', 'troupe'];

/** Si `g` est l'issue de l'écriture d'un enregistrement au dépôt : `{ geste: 'enregistrement', reussi }`, rien de plus. */
export function estLIssueDUnEnregistrement(g: unknown): g is Extract<GesteDEdition, { geste: 'enregistrement' }> {
  return estObjet(g) && g.geste === 'enregistrement' && typeof g.reussi === 'boolean' && Object.keys(g).length === 2;
}

/** Si `g` est l'issue du chargement d'une planche : `{ geste: 'chargement', image }`, `image` nulle ou
 *  `{ largeur, hauteur }` en pixels entiers positifs, rien de plus. */
export function estLIssueDUnChargement(g: unknown): g is Extract<GesteDEdition, { geste: 'chargement' }> {
  if (!estObjet(g) || g.geste !== 'chargement' || Object.keys(g).length !== 2 || !('image' in g)) return false;
  const { image } = g;
  return image === null || (estObjet(image) && Object.keys(image).length === 2 && [image.largeur, image.hauteur].every((n) => estEntier(n) && n > 0));
}

/** Si `g` est l'issue du chargement d'un chapitre du `Source/` : `{ geste: 'chapitre', book, ch, texte }`, son livre et
 *  son chapitre en chaînes, `texte` le Markdown du chapitre ou `null` s'il n'a pas pu se charger, rien de plus. */
export function estLIssueDUnChapitre(g: unknown): g is Extract<GesteDEdition, { geste: 'chapitre' }> {
  return estObjet(g) && g.geste === 'chapitre' && Object.keys(g).length === 4 && typeof g.book === 'string' && typeof g.ch === 'string'
    && 'texte' in g && (g.texte === null || typeof g.texte === 'string');
}

/** Si `g` est un geste du pointeur : `{ geste: 'appui' | 'glisse' | 'relache', point: { case: { x, y }, f: { x, y } } }`,
 *  la case en entiers, le point fractionnaire en nombres finis, rien de plus. */
export function estUnGesteDuPointeur(g: unknown): g is Extract<GesteDEdition, { point: unknown }> {
  if (!estObjet(g) || !['appui', 'glisse', 'relache'].includes(g.geste as string) || Object.keys(g).length !== 2 || !estObjet(g.point)) return false;
  const { point } = g;
  if (Object.keys(point).length !== 2 || !estObjet(point.case) || !estObjet(point.f)) return false;
  const { case: c, f } = point;
  return Object.keys(c).length === 2 && estEntier(c.x) && estEntier(c.y) && Object.keys(f).length === 2 && estNombre(f.x) && estNombre(f.y);
}
