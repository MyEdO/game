## L'atelier 3D (#3086) : les modèles listés à côté de l'export (`GET modeles/listage.json`), indexés par le pont
## (`modeles`, `hotes/godot/pont/atelier.ts`), et chaque modèle chargé à l'exécution sous la forme que sert le listage (`GET modeles/<fichier>`). Le joueur y
## choisit un corps, compose un personnage depuis un preset ou ses axes (`composer`, `catalogues`, `presetDeComposition`,
## `hotes/godot/pont/composition.ts`), le colore au nuancier, monte un élément par point d'accroche ou par ligne de pièce,
## joue les clips de la base image par image, fait marcher la base au clavier (`MarcheDeLAtelier`), montre les aides
## (os, emplacements, prises) et recharge les GLB réexportés sans relancer l'atelier. La base et ce qui s'y monte sont
## ceux de son montage (`MontageDeComposition`, le nœud `Modele`), que l'atelier offre au joueur. À côté des bases, il pose
## un véhicule ou un engin servi (#2987), tel que le pont le compose (`vehicule`) : les pièces de ses postes, ses
## Améliorations, la palette de la composition et l'emblème de ses voiles, montés par son montage (`MontageDeVehicule`, le
## nœud `Vehicule`), au sol et cadrés à sa taille ; l'engin posé attaque, son clip d'attaque puis son coup. Il pose aussi
## ce que le jeu dessine en 3D hors des modèles servis (#3802, `echantillons`, `echantillon`, `CONTRAT.md`, section
## « Atelier 3D ») : chaque entrée de chaque famille servie, dans une scène bâtie par le noyau, rendue par le volume de
## scène du jeu (`VolumeDeScene`, le nœud `Echantillon/Scene`) à l'échelle métrique, au sol et cadrée à sa taille.
## Son onglet Effets montre la vitrine des effets que le jeu joue (#3777, `vitrine`, `CONTRAT.md`, section « Effets ») :
## chaque variante de chaque rendu d'arme, de chaque Domaine et de la Prière, chaque son et chaque flottant, rejoués par
## son nœud `Effets` de l'auteur posé à l'origine vers la cible (`Cible`), et chaque musique, jouée par sa `Musique`
## jusqu'à ce que son bouton se relâche (#3825) ; son onglet Animation, le déplacement de la vitrine, que la base posée
## parcourt (#3822).
## Le modèle se choisit en tête du panneau ; chaque onglet, et ce qu'il porte, se montre si le modèle posé lui offre
## quelque chose (#3792, `_adapter_les_onglets`, `.claude/rules/hote-godot.md`).
## Chaque geste mis en page, il publie ce que l'écran porte (`PontDuNoyau.publier_l_ecran`).
extends Node3D

const VIDE := MontageDeComposition.VIDE
## Le texte du choix « vide » d'une liste : aucun élément, aucun emblème, aucune valeur d'axe.
const AUCUN := "Aucun"
const AIDE_DU_GENRE := {emplacement = "emplacements", prise = "prises"}
const COULEUR_DES_AIDES := {os = Color(0.95, 0.85, 0.2), emplacements = Color(0.3, 0.8, 1.0), prises = Color(1.0, 0.4, 0.35)}
const RAYON_DU_REPERE_D_OS := 0.02
## Plus grand que celui d'un os : le repère d'un point déborde de celui de son os, quel que soit l'ordre de rendu.
const RAYON_DU_REPERE_DE_POINT := 0.035
const TAILLE_DE_L_ETIQUETTE := 0.0015
const DEBUT_D_EMPREINTE := 12
## Le bouton d'un axe `plage` qui retire son champ de la composition, sa valeur au `neutre` de l'axe.
const NEUTRE := "neutre"
## Le pas de la glissière d'un axe `plage`.
const PAS_DE_PLAGE := 0.05
## La largeur minimale du libellé d'une rangée du panneau, qui aligne les listes.
const LARGEUR_DU_LIBELLE := 150.0
## Les sections de l'onglet Équipement, dans leur ordre : leur titre, et ce qu'elles rangent.
const SECTIONS := [
	{id = "tete", titre = "Tête et coiffure"},
	{id = "piece", titre = "Vêtements et armures"},
	{id = "emplacement", titre = "Accessoires"},
	{id = "prise", titre = "Objets tenus"},
	{id = "poste", titre = "Postes"},
	{id = "amelioration", titre = "Améliorations"},
	{id = "pavillon", titre = "Emblème"},
]
## L'emplacement d'emblème d'un véhicule : ses voiles et son pavillon, les surfaces `blason` de son élément.
const PAVILLON := "vehicule"

## Le texte du choix d'une couleur absente de la composition : la matière du modèle.
const PAR_DEFAUT := "Par défaut"
## Le côté, en pixels, de la pastille d'une couleur du nuancier.
const COTE_DE_LA_PASTILLE := 16
## Le texte du bouton de chaque variante de la vitrine des effets (`VarianteDeVitrine`).
const VARIANTES := {"touche": "Touché", "manque": "Manqué", "pare": "Paré", "incantation": "Incantation", "incantation-ratee": "Ratée", "zone": "Zone"}
## Les mètres que vaut une unité de la scène de l'atelier : ses modèles sont à leur taille réelle.
const METRES_PAR_UNITE := 1.0

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _montage: MontageDeComposition = $Modele
@onready var _interface: CanvasLayer = $Interface
@onready var _marche: MarcheDeLAtelier = $Marche
@onready var _vehicule: MontageDeVehicule = $Vehicule
@onready var _echantillon: Node3D = $Echantillon
@onready var _scene_de_l_echantillon: VolumeDeScene = $Echantillon/Scene
@onready var _sol: MeshInstance3D = $Sol
@onready var _effets: Effets = $Effets
@onready var _cible: Node3D = $Cible
var _musique := Musique.new()
## La zone qui dure de la vitrine posée autour de la cible, et les marques d'États posées sur elle (#3834).
var _zones := ZonesQuiDurent.new()
var _marques := MarquesDEtats.new()
@onready var _etat: Label = %Etat
@onready var _choix_du_modele: VBoxContainer = %ChoixDuModele
@onready var _panneau_des_emplacements: VBoxContainer = %Emplacements
@onready var _clips: OptionButton = %Clips
@onready var _instant: Label = %Instant
@onready var _cases_des_aides := {os = %AideOs, emplacements = %AideEmplacements, prises = %AidePrises}
@onready var _onglets := {personnage = %DefilementPersonnage, equipement = %DefilementEquipement, couleurs = %DefilementCouleurs, animation = %DefilementAnimation, effets = %DefilementEffets, outils = %DefilementOutils}
@onready var _boutons_des_onglets := {personnage = %OngletPersonnage, equipement = %OngletEquipement, couleurs = %OngletCouleurs, animation = %OngletAnimation, effets = %OngletEffets, outils = %OngletOutils}

## L'id de la base demandée en dernier, posée ou en chargement.
var _base_demandee: Variant = null
## Le chargement retenu : un chargement qu'un autre remplace jette son résultat.
var _chargement: RefCounted = null
var _pose_des_os: Dictionary = {}
## Les boîtes des meshes skinnés montés (`_peaux`), mesurées à la dernière publication d'un geste ou d'un changement
## d'état (`_publier`) ; `_peaux_a_mesurer` tant qu'elles restent à mesurer.
var _peaux_mesurees: Dictionary = {}
var _peaux_a_mesurer := true
var _pas := 0.0
var _vitesse := 1.0
## Le clip que « Recharger » rejoue, à son instant, en lecture ou en pause.
var _reprise: Dictionary = {}
## Par id d'emplacement de montage, l'emplacement : un point (son id) ou une ligne de pièce (`ligne/<ligne>`), sa clé
## publiée, `montes` ou `lignes` qui la publie, son bloc au panneau, les éléments qu'il offre et son contrôle : la liste de
## ses choix, ou la case d'une pièce.
var _emplacements: Dictionary = {}
## Par id d'emplacement, la référence d'emblème choisie, ou null pour une surface sans emblème.
var _surcharges_des_emblemes: Dictionary = {}
## Par id d'emplacement, la rangée de ses emblèmes, s'il en offre.
var _lignes_des_emblemes: Dictionary = {}
## Par id de section de l'onglet Équipement, la colonne de ses rangées.
var _sections: Dictionary = {}
## La liste des bases (`corps`) et celle des véhicules et engins (`vehicule`), en tête du panneau.
var _listes_des_modeles: Dictionary = {}
var _boutons_des_emblemes: Dictionary = {}
## Par emplacement de palette (`couleurs` de `catalogues`), sa liste au panneau Couleurs.
var _listes_des_couleurs: Dictionary = {}
var _aides := {os = false, emplacements = false, prises = false}
var _reperes := {os = [], emplacements = [], prises = []}
## Les erreurs du chargement, du montage et de la page.
var _erreurs: Array[String] = []
## Les erreurs du dernier geste de composition (`_composer`, `_copier`), que le suivant remplace.
var _erreurs_de_composition: Array[String] = []
## Les erreurs du gabarit posé (`os-absent`), que chaque pose remplace.
var _erreurs_du_gabarit: Array[String] = []
## Où va une erreur signalée : `_erreurs`, `_erreurs_de_composition` le temps d'un geste de composition.
var _recueil: Array[String] = []
## La réponse de `catalogues` : les choix de chaque champ d'une composition, et les presets.
var _catalogues: Dictionary = {}
## La composition courante (`CONTRAT.md`, « Composition d'un personnage ») : un preset appliqué la remplace, un axe changé
## la modifie.
var _composition: Dictionary = {}
## L'id du dernier preset appliqué, `null` avant tout preset : l'enveloppe de « Copier ».
var _preset: Variant = null
## Le texte affiché du refus de la composition courante par `composer` (erreur `validation`), vide sans refus.
var _refus_de_composition := ""
## Les axes de `catalogues`, dans leur ordre.
var _axes: Array = []
## Par champ d'axe, son sélecteur : la liste d'un axe `ref` ou `valeur`, la glissière d'un axe `plage`.
var _selecteurs_d_axe: Dictionary = {}
var _onglet := "personnage"
## Le véhicule demandé (#2987) : sa fiche (`null` : aucun), les pièces de ses postes (`{ definition, bord }`, dans l'ordre
## des `places` de la réponse) et ses Améliorations installées, dans l'ordre de `ameliorations` de la
## réponse de `modeles`.
var _definition_du_vehicule: Variant = null
var _postes_du_vehicule: Array = []
var _ameliorations_du_vehicule: Array = []
## La dernière réponse de `vehicule`.
var _offre_du_vehicule: Dictionary = {}
## La réponse de `vitrine`, vide avant elle.
var _vitrine: Dictionary = {}
## Le parcours en cours du chemin de la vitrine (`_parcourir`).
var _parcours: Tween
## Les familles d'échantillons de `echantillons`, vides avant elle.
var _familles_d_echantillons: Array = []
## L'échantillon demandé, `{ famille, id }` (l'entrée de `echantillon`), `null` : aucun.
var _echantillon_demande: Variant = null


func _ready() -> void:
	_musique.name = "Musique"
	add_child(_musique)
	_zones.name = "ZonesQuiDurent"
	add_child(_zones)
	_marques.name = "Marques"
	_cible.add_child(_marques)
	_recueil = _erreurs
	_montage.erreurs = _erreurs
	_montage.empilee.connect(_publier)
	%Recharger.pressed.connect(_recharger)
	%Lecture.pressed.connect(_lire)
	%Pause.pressed.connect(_mettre_en_pause)
	%ImagePrecedente.pressed.connect(_aller_a_l_image.bind(-1.0))
	%ImageSuivante.pressed.connect(_aller_a_l_image.bind(1.0))
	for bouton in %Vitesses.get_children():
		bouton.pressed.connect(_regler_la_vitesse.bind(float(bouton.get_meta("vitesse"))))
	for aide in _cases_des_aides:
		_cases_des_aides[aide].toggled.connect(_montrer_l_aide.bind(aide))
	for onglet in _onglets:
		_onglets[onglet].get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publier())
		_boutons_des_onglets[onglet].pressed.connect(_montrer_l_onglet.bind(onglet))
	%Copier.pressed.connect(_copier)
	%Attaquer.pressed.connect(_attaquer)
	%Parcourir.pressed.connect(func() -> void: _jouer_l_effet(_vitrine.deplacement))
	_effets.deplacement.connect(_parcourir)
	%AProduire.toggled.connect(func(montre: bool) -> void:
		%ListeAProduire.visible = montre
		_publier())
	_clips.set_meta("cle", "clip")
	_clips.item_selected.connect(func(rang: int) -> void: _jouer_le_clip(_clips.get_item_metadata(rang)))
	_marche.marche_commencee.connect(_jouer_le_clip)
	_marche.marche_arretee.connect(_jouer_le_repos)
	if await _pont.rejoindre(_signaler, _signaler):
		_poser_les_catalogues()
		_poser_la_vitrine()
		_lire_les_echantillons()
		await _charger({}, {})


func _process(_delta: float) -> void:
	_instant.text = "%.3f s" % _lecteur().current_animation_position if _a_un_clip() else ""
	if _pont.en_recette and (_peaux_a_mesurer or (_a_un_clip() and _lecteur().is_playing())):
		_publier_l_ecran.call_deferred()


## Le listage du serveur, puis l'index du pont (`MontageDeComposition.lister`, `indexer`), retenu par le montage, puis
## l'échantillon demandé reposé, sinon le véhicule demandé s'il reste servi, sinon la base retenue (la demandée si elle
## reste listée, la première sinon), qui remonte les éléments `montes` que ses emplacements offrent encore, sous leurs
## `emblemes`.
func _charger(montes: Dictionary, emblemes: Dictionary) -> void:
	var chargement := RefCounted.new()
	_chargement = chargement
	_erreurs.clear()
	var recueil: Array[String] = []
	var listage := await MontageDeComposition.lister(self, recueil)
	if chargement != _chargement:
		return
	_erreurs.append_array(recueil)
	var reponse := MontageDeComposition.indexer(_pont, listage)
	if reponse.get("ok") != true:
		_montrer_l_etat()
		return
	MontageDeComposition.retenir_les_modeles(reponse, listage)
	for refus in reponse.refus:
		_erreurs.append(str(refus))
	%Rapport.text = "\n".join(PackedStringArray(reponse.rapport))
	%Rapport.visible = not reponse.rapport.is_empty()
	var retenue: Variant = null
	for base in reponse.bases:
		if retenue == null or base.id == _base_demandee:
			retenue = base
	_poser_les_listes_des_modeles(reponse)
	if _echantillon_demande != null:
		_poser_l_echantillon()
		return
	if reponse.vehicules.has(_definition_du_vehicule):
		_vehicule.oublier()
		await _demander_le_vehicule()
		return
	_definition_du_vehicule = null
	_base_demandee = null if retenue == null else retenue.id
	await _poser(retenue, montes, emblemes, chargement)


## La base `id` demandée : le dernier clic gagne, contre le modèle posé comme contre celui en chargement.
func _choisir_la_base(id: String) -> void:
	_montrer_le_modele_pose()
	if id == _base_demandee:
		_publier()
		return
	for base in MontageDeComposition.modeles.bases:
		if base.id == id:
			_base_demandee = id
			_definition_du_vehicule = null
			_echantillon_demande = null
			_surcharges_des_emblemes.clear()
			_reprise = {}
			_montage.composee = {}
			_refus_de_composition = ""
			_erreurs_de_composition = []
			_montrer_la_composition()
			var chargement := RefCounted.new()
			_chargement = chargement
			await _poser(base, {}, {}, chargement)


func _recharger() -> void:
	_reprise = {}
	if _a_un_clip():
		_reprise = {clip = _lecteur().assigned_animation, instant = _lecteur().current_animation_position, lecture = _lecteur().is_playing()}
	await _charger(_montage.montes.duplicate(), _montage.emblemes.duplicate())


## La base `base` (aucune si `null`) posée dans la scène depuis son GLB par le montage, si `chargement` reste le
## chargement retenu : ses points, ses lignes de pièce, ses aides, ses clips, et les éléments `montes` que ses
## emplacements offrent encore, sous leurs `emblemes`.
func _poser(base: Variant, montes: Dictionary, emblemes: Dictionary, chargement: RefCounted) -> void:
	var scene: Node3D = null
	if base != null:
		scene = await _montage.scene_du_modele(base.id, _erreurs)
	if chargement != _chargement:
		if scene != null:
			scene.free()
		return
	_remettre_a_zero()
	_montage.poser_le_modele({} if base == null else base, scene)
	_montrer_le_modele_pose()
	if _montage.squelette != null:
		_montage.squelette.skeleton_updated.connect(_memoriser_la_pose)
		_montage.gabarit.mesure.connect(_cadrer)
		for os in _montage.squelette.get_bone_count():
			var declaration := {os = _montage.squelette.get_bone_name(os), position = MontageDeComposition.ORIGINE, rotation = MontageDeComposition.ORIGINE}
			var support := MontageDeComposition.attacher(_montage.squelette, declaration, "Os_%d" % os)
			support.add_child(_repere(COULEUR_DES_AIDES.os, RAYON_DU_REPERE_D_OS))
			_reperes.os.append(support)
	for ligne in _montage.base.get("lignes", []):
		_emplacement_de_la_ligne(ligne)
	for point in _montage.base.get("points", []):
		_emplacement_du_point(point)
		_poser_l_aide_du_point(point)
	_montrer_ce_qu_il_reste_a_produire()
	for id in _emplacements:
		if montes.get(id) in _emplacements[id].elements:
			_choisir(_emplacements[id], montes[id], emblemes.get(id, VIDE))
	_monter_hors_panneau(_montage.cibles())
	_poser_les_clips()
	_poser_le_gabarit()
	_montage.poser_les_morphes()
	_marche.suivre(_montage.modele, _montage.lecteur, _montage.clip.bind("marche"), _montage.base.get("vitesseAuSol", 0.0))
	for aide in _aides:
		_montrer_l_aide(_aides[aide], aide)
	_montrer_l_etat()


## L'écran ramené à aucun modèle : le squelette posé n'informe plus la pose des os, le montage vidé
## (`MontageDeComposition.vider`), aucun véhicule (`MontageDeVehicule.vider`), aucun échantillon (`VolumeDeScene.vider`),
## ni pose d'os, ni emplacement, ni clip, ni repère, ni rangée d'emblèmes.
func _remettre_a_zero() -> void:
	if _montage.squelette != null and _montage.squelette.skeleton_updated.is_connected(_memoriser_la_pose):
		_montage.squelette.skeleton_updated.disconnect(_memoriser_la_pose)
	_montage.vider()
	_vehicule.vider()
	_scene_de_l_echantillon.vider()
	_pose_des_os = {}
	_pas = 0.0
	Controles.vider(_panneau_des_emplacements)
	_clips.clear()
	_sections.clear()
	_reperes = {os = [], emplacements = [], prises = []}
	_emplacements.clear()
	_lignes_des_emblemes.clear()
	_boutons_des_emblemes = {}


## @contrat Atelier 3D
## Un emplacement de montage est un point ou une ligne de pièce. Le panneau porte en tête le choix du modèle (#3792) :
## la rangée « Corps », sa liste (`cle` `modele/corps`) de chaque base par son id, la rangée « Véhicule ou engin »,
## puis une rangée par famille de `echantillons` ; chaque liste montre le modèle posé ou demandé, les autres aucun
## choix. Suivent six bascules d'onglet d'un même
## groupe : « Personnage », montré à l'ouverture, « Équipement », « Couleurs », « Animation », « Effets » et « Outils
## » ; chacun a son défilement, jamais imbriqué. Une bascule ne se montre que si le modèle posé offre son onglet
## (`_onglets_offerts`, `.claude/rules/hote-godot.md`) : « Personnage », une base posée ; « Équipement », une section
## qui porte une rangée, ou un reste à produire ; « Couleurs », une surface posée qui prend une couleur de palette ; «
## Animation », un clip au lecteur du modèle posé, ou une attaque de l'engin posé ; « Effets » et « Outils »,
## toujours. L'onglet montré qui cesse d'être offert cède la place au premier offert. L'état (la base posée et son
## empreinte, ou les `erreurs`, en rouge) reste en pied du panneau, sous tous les onglets.

## En tête du panneau, la rangée « Corps », la liste de clé `modele/corps` de chaque base de la réponse `reponse` de
## `modeles` par son id, puis la rangée « Véhicule ou engin », la liste de clé `modele/vehicule` de chaque fiche de
## `vehicules`, dans son ordre, au libellé de son élément, puis une rangée par famille d'échantillons, à son libellé, la
## liste de clé `modele/<famille>` de ses entrées dans l'ordre servi : choisi, un article pose son modèle.
func _poser_les_listes_des_modeles(reponse: Dictionary) -> void:
	Controles.vider(_choix_du_modele)
	var bases := []
	for base in reponse.bases:
		bases.append({id = base.id, texte = base.id})
	var vehicules := []
	for definition in reponse.vehicules:
		vehicules.append({id = definition, texte = reponse.libelles[reponse.vehicules[definition]]})
	_listes_des_modeles = {
		corps = _liste_deroulante("modele/corps", bases, _choisir_la_base),
		vehicule = _liste_deroulante("modele/vehicule", vehicules, _choisir_le_vehicule),
	}
	_rangee("Corps", _choix_du_modele).add_child(_listes_des_modeles.corps)
	_rangee("Véhicule ou engin", _choix_du_modele).add_child(_listes_des_modeles.vehicule)
	for famille in _familles_d_echantillons:
		var entrees: Array = famille.entrees.map(func(entree: Dictionary) -> Dictionary: return {id = entree.id, texte = entree.libelle})
		_listes_des_modeles[famille.id] = _liste_deroulante("modele/%s" % famille.id, entrees, _choisir_l_echantillon.bind(famille.id))
		_rangee(famille.libelle, _choix_du_modele).add_child(_listes_des_modeles[famille.id])


## Les listes de tête sur le modèle posé ou demandé : la base posée, le véhicule demandé ou l'échantillon demandé ; les
## autres listes sans choix. Le sol de l'atelier cède la place à celui d'un échantillon.
func _montrer_le_modele_pose() -> void:
	var poses := {corps = _montage.base.get("id"), vehicule = _definition_du_vehicule}
	if _echantillon_demande != null:
		poses[_echantillon_demande.famille] = _echantillon_demande.id
	for liste in _listes_des_modeles:
		_selectionner(_listes_des_modeles[liste], poses.get(liste))
	_sol.visible = _echantillon_demande == null


## @contrat Atelier 3D
## Un véhicule s'affiche dans l'atelier à côté des bases (#2987). La liste de tête « Véhicule ou engin » (`cle`
## `modele/vehicule`) offre chaque fiche de `vehicules`, dans son ordre, au libellé de son élément (`libelles`) :
## choisie, elle retire la base posée, ses emplacements, ses surcharges d'emblème et ses clips, et demande le
## véhicule, sans pièce ni Amélioration. Godot l'obtient du pont, jamais en relisant un manifeste : il appelle
## `vehicule` (section « Méthodes ») sur la fiche, les pièces et les Améliorations demandées, les `couleurs` de la
## composition courante et l'emblème de ses voiles, et la réponse porte `vehicule`, le corps à monter, `places`,
## chaque place de ses postes en vigueur (`postesEnVigueur`, `atelier.ts`), bord après bord dans l'ordre de
## `FIRE_ARCS`, `{ bord, rang, label, piece }` (`PlaceDuVehicule`, `pont.ts` : son rang parmi les places du bord,
## compté de 0, son libellé, celui du bord, `libelleDuBord`, surface du noyau, suivi du rang compté de 1, et la fiche
## de la pièce que le corps y monte, `null` sans pièce), `pieces`, les fiches servies qui se montent à un poste, dans
## l'ordre de `vehicules`, `ameliorations`, celles que le véhicule porte (`vehiculeDuCombattant`), et `montables`,
## celles qu'il peut monter : les clés de `ameliorations` de la réponse de `modeles`, dans leur ordre, que nomment les
## `ancrages` ou le `selon` du manifeste de son élément (`ameliorationsMontables`, `atelier.ts`). Le corps se monte
## sous le nœud `Vehicule` de l'atelier par `MontageDeVehicule`, comme au combat (section « Corps d'un combattant »),
## sa scène nue posée au sol, sa boîte centrée sur l'origine et son dessous sur le sol, à l'échelle de son auteur (un
## mètre du modèle vaut un mètre), puis l'orbite cadre la boîte entière, pièces comprises, sa diagonale tenant dans la
## hauteur que la caméra de la scène voit au pivot (`MarcheDeLAtelier.cadrer_la_boite`,
## `MiseEnPage.echelle_de_la_boite`) ; le zoom se borne de 0,3 à 3 fois l'échelle de ce cadre, comme autour du cadre
## d'un corps (`MiseEnPage.echelle_zoomee`). L'onglet « Équipement » porte alors, sous les sections du personnage, «
## Postes » : une rangée par place de `places`, à son `label`, sa liste déroulante (`cle` `poste/<bord>/<rang>`)
## offrant « Aucun » puis chaque fiche de `pieces` au libellé de son élément, sur sa `piece` ; « Améliorations » : une
## case par Amélioration de `montables` (`cle` `amelioration/<id>`, au libellé de son élément), cochée si
## `ameliorations` de la réponse de `vehicule` la porte, aucune section sans Amélioration montable ; et « Emblème »,
## si l'élément du véhicule porte une surface `blason`, la rangée « Voiles et pavillon » et sa liste (`cle`
## `vehicule/embleme`) : « Aucun », puis chaque emblème. Une pièce choisie remplace la `piece` de sa place, et
## l'atelier redemande la pièce de chaque place qui en a une, dans l'ordre de `places` : le noyau les monte comme les
## pièces d'un combattant (`postesMontes`), une place vide prenant la pièce suivante de son bord, et la réponse dit où
## chacune est montée ; les pièces que la réponse ne place plus (un bord réduit) ne se redemandent pas. Une case
## installe ou retire son Amélioration, les Améliorations installées suivant l'ordre de la réponse de `modeles`.
## L'emblème choisi surcharge celui de la composition, comme à un emplacement ; une couleur de l'onglet « Couleurs »,
## un preset ou un axe recompose le véhicule. Chaque geste rappelle `vehicule` et remonte le corps rendu, l'état de
## l'atelier publiant `vehicule` (section « Écran publié »). « Recharger les modèles » redemande le véhicule s'il est
## toujours servi, ses GLB relus. Une base choisie retire le véhicule.
## Ce que le jeu dessine en 3D hors des modèles servis s'affiche aussi dans l'atelier (#3802) : le décor, le sol, la
## matière de relief, la matière de toit, l'apparence de mur, ses ouvertures et sa crénelure. Godot lit les familles
## par `echantillons` à l'ouverture ; chacune a sa rangée de tête, à son `libelle`, et sa liste (`cle`
## `modele/<famille>`) qui offre ses entrées dans l'ordre servi, à leur `libelle`. Choisie, une entrée retire la base
## posée, ses emplacements, ses surcharges d'emblème et ses clips, et le véhicule, et Godot obtient sa scène du pont,
## jamais en la bâtissant : il appelle `echantillon` (section « Méthodes »), dont la scène est bâtie par les écrivains
## de l'éditeur (`src/noyau/monde/echantillons.ts`) : un décor au centre de son empreinte ; un sol sur 5 × 5 cases ;
## un relief en falaise, en rampe vers une case bâtie et en terrasse sur une couche haute, chaque partie à la matière
## ; chaque profil de toit (`roofProfileSchema`) sur sa masse, à la matière ; et un enclos de l'apparence, un mur, une
## porte fermée, une porte ouverte, une fenêtre, une fenêtre close et une brèche, et, pour une apparence à couronne
## (`parapet`), une case haussée d'un étage, crénelée de l'apparence, que sa crête ceint (`cretesDePerimetre`, #3818).
## La réponse se pose sous le nœud `Echantillon/Scene` de l'atelier, une `VolumeDeScene` comme celle du monde de la
## partie (section « Monde ») : le volume en morceaux complets, les arêtes, les nappes de toit et les couronnes, celles de
## `couronnesAbattues` retirées (`VolumeDeScene.retirer_les_couronnes`), à l'échelle de `metresParCase`, sa boîte au
## sol et cadrée comme celle d'un véhicule (`MarcheDeLAtelier.cadrer_la_boite`) ; le sol de l'atelier se cache tant
## qu'un échantillon est posé. Seuls « Effets » et « Outils » sont alors offerts ; un effet cadre aussi l'échantillon.
## « Recharger les modèles » repose l'échantillon demandé, l'état de l'atelier publiant `echantillon` (section « Écran
## publié »). Une base ou un véhicule choisi retire l'échantillon.

## Le véhicule de fiche `definition` demandé (#2987) : le dernier clic gagne, contre le modèle posé comme contre celui en
## chargement ; ni pièce ni Amélioration, aucune base (`_poser_sans_base`), puis le véhicule composé
## (`_demander_le_vehicule`).
func _choisir_le_vehicule(definition: String) -> void:
	_montrer_le_modele_pose()
	if definition == _definition_du_vehicule:
		_publier()
		return
	_definition_du_vehicule = definition
	_echantillon_demande = null
	_postes_du_vehicule = []
	_ameliorations_du_vehicule = []
	_poser_sans_base(_vehicule)
	await _demander_le_vehicule()


## L'entrée `id` de la famille d'échantillons `famille` demandée (#3802) : le dernier clic gagne ; aucun véhicule, aucune
## base (`_poser_sans_base`), puis l'échantillon dessiné (`_poser_l_echantillon`).
func _choisir_l_echantillon(id: String, famille: String) -> void:
	_montrer_le_modele_pose()
	var demande := {famille = famille, id = id}
	if demande == _echantillon_demande:
		_publier()
		return
	_echantillon_demande = demande
	_definition_du_vehicule = null
	_poser_sans_base(_echantillon)
	_poser_l_echantillon()


## Aucune base, demandée ou en chargement : ni surcharge d'emblème, ni reprise, ni composition composée, ni erreur de
## composition ou de gabarit, l'écran ramené à aucun modèle (`_remettre_a_zero`), la marche sur `racine`, sans clip ni
## vitesse, et les listes de tête et le sol sur le modèle demandé (`_montrer_le_modele_pose`).
func _poser_sans_base(racine: Node3D) -> void:
	_base_demandee = null
	_chargement = RefCounted.new()
	_surcharges_des_emblemes.clear()
	_reprise = {}
	_montage.composee = {}
	_refus_de_composition = ""
	_erreurs_de_composition = []
	_erreurs_du_gabarit = []
	_remettre_a_zero()
	_montage.poser_le_modele({}, null)
	_montrer_ce_qu_il_reste_a_produire()
	_marche.suivre(racine, null, func() -> String: return "", 0.0)
	_montrer_la_composition()
	_montrer_le_modele_pose()


## L'échantillon demandé dessiné par `echantillon` (`CONTRAT.md`, « Atelier 3D ») : son volume en morceaux complets, ses
## nappes de toit, ses couronnes (`VolumeDeScene.poser`, la réponse pour manifeste et pour géométries reçues) et ses
## arêtes posés par sa scène, les couronnes tombées retirées, en mètres
## (`MiseEnPage.echelle_en_metres`), au sol (`_poser_au_sol`) et cadré à sa taille (`MarcheDeLAtelier.cadrer_la_boite`).
func _poser_l_echantillon() -> void:
	var reponse := _pont.appeler("echantillon", _echantillon_demande)
	if reponse.get("ok") != true:
		return
	var scene := _scene_de_l_echantillon
	scene.poser(reponse, {volume = reponse.monde.morceaux, toits = reponse.toits, couronnes = reponse.couronnes})
	scene.poser_les_aretes(reponse.aretes)
	scene.retirer_les_couronnes(reponse.couronnesAbattues)
	scene.scale = MiseEnPage.echelle_en_metres(reponse.monde.metresParCase)
	scene.position = Vector3.ZERO
	_poser_au_sol(scene)
	_marche.cadrer_la_boite(MontageDeVehicule.boite(scene, _echantillon))
	_montrer_le_modele_pose()
	_montrer_l_etat()


## Le véhicule demandé composé par `vehicule` (`CONTRAT.md`, « Atelier 3D ») : ses pièces, ses Améliorations, les
## couleurs de la composition courante et l'emblème de ses voiles (`_embleme_de_l_emplacement`) ; son panneau reposé
## (`_poser_le_panneau_du_vehicule`), puis son corps monté par son montage (`MontageDeVehicule.monter`), au sol
## (`_poser_au_sol`) et cadré à sa taille (`MarcheDeLAtelier.cadrer_la_boite`). Un refus va aux erreurs (`_signaler`).
func _demander_le_vehicule() -> void:
	var entree := {definition = _definition_du_vehicule, postes = _postes_du_vehicule, ameliorations = _ameliorations_du_vehicule}
	if _composition.has("couleurs"):
		entree.couleurs = _composition.couleurs
	var embleme := _embleme_de_l_emplacement(PAVILLON)
	if embleme != VIDE:
		entree.embleme = {id = embleme}
	var reponse := _pont.appeler("vehicule", entree)
	if reponse.get("ok") != true:
		return
	_offre_du_vehicule = reponse
	_poser_le_panneau_du_vehicule()
	if await _vehicule.monter(reponse.vehicule, _montage, _poser_au_sol):
		if _vehicule.scene != null:
			_marche.cadrer_la_boite(MontageDeVehicule.boite(_vehicule.scene, _vehicule))
		_poser_les_clips()
	_montrer_le_modele_pose()
	_montrer_l_etat()


## La scène nue `scene` d'un véhicule ou d'un échantillon au sol : sa boîte, dans le repère de son parent, centrée sur
## l'origine, son dessous sur le sol.
func _poser_au_sol(scene: Node3D) -> void:
	var boite: AABB = MontageDeVehicule.boite(scene, scene.get_parent() as Node3D)
	scene.position = Vector3(-boite.get_center().x, -boite.position.y, -boite.get_center().z)


## L'onglet Équipement du véhicule, d'après la dernière réponse de `vehicule` : ses pièces, celles que la réponse monte à
## ses `places` ; « Postes », une rangée par place, à son libellé, sa liste de clé `poste/<bord>/<rang>` offrant « Aucun »
## puis chaque fiche de `pieces` par le libellé de son élément, sur la pièce de la place ; « Améliorations », une case
## par Amélioration que le véhicule peut monter (`montables`, de clé
## `amelioration/<id>`), cochée si le véhicule la porte ; « Emblème », si son élément porte une surface `blason`, la liste
## de clé `vehicule/embleme` : « Aucun », puis chaque emblème.
func _poser_le_panneau_du_vehicule() -> void:
	Controles.vider(_panneau_des_emplacements)
	_sections.clear()
	var offre := _offre_du_vehicule
	var choix: Array = [{id = VIDE, texte = AUCUN}]
	for definition in offre.pieces:
		choix.append({id = definition, texte = MontageDeComposition.modeles.libelles[MontageDeComposition.modeles.vehicules[definition]]})
	_postes_du_vehicule = []
	for place in offre.places:
		var liste := _liste_deroulante("poste/%s/%d" % [place.bord, place.rang], choix, _choisir_la_piece.bind(place.bord, int(place.rang)))
		_rangee(place.label, _section("poste")).add_child(liste)
		_selectionner(liste, VIDE if place.piece == null else place.piece)
		if place.piece != null:
			_postes_du_vehicule.append({definition = place.piece, bord = place.bord})
	for amelioration in offre.montables:
		var case := CheckButton.new()
		case.text = MontageDeComposition.modeles.libelles[MontageDeComposition.modeles.ameliorations[amelioration]]
		case.set_meta("cle", "amelioration/%s" % amelioration)
		case.set_pressed_no_signal(amelioration in offre.ameliorations)
		case.toggled.connect(_basculer_l_amelioration.bind(amelioration))
		_section("amelioration").add_child(case)
	if MontageDeComposition.porte_un_blason(offre.vehicule.element):
		var emblemes: Array = [{id = VIDE, texte = AUCUN}]
		for offert in MontageDeComposition.modeles.emblemes:
			emblemes.append({id = offert.id, texte = offert.label})
		var liste := _liste_deroulante("%s/embleme" % PAVILLON, emblemes, func(choisi: String) -> void:
			_surcharges_des_emblemes[PAVILLON] = null if choisi == VIDE else {id = choisi}
			_demander_le_vehicule())
		_rangee("Voiles et pavillon", _section("pavillon")).add_child(liste)
		_selectionner(liste, offre.vehicule.get("embleme", {}).get("id", VIDE))


## La pièce de fiche `definition` (« vide » : aucune) à la place de rang `rang` du bord `bord`, puis le véhicule recomposé
## sur la pièce de chaque place qui en a une, dans l'ordre des `places` de la dernière réponse : le noyau les monte
## (`postesMontes`), et sa réponse dit où.
func _choisir_la_piece(definition: String, bord: String, rang: int) -> void:
	var postes := []
	for place in _offre_du_vehicule.places:
		var piece: Variant = place.piece
		if place.bord == bord and place.rang == rang:
			piece = null if definition == VIDE else definition
		if piece != null:
			postes.append({definition = piece, bord = place.bord})
	_postes_du_vehicule = postes
	await _demander_le_vehicule()


## L'Amélioration `amelioration` installée (`installee`) ou retirée, puis le véhicule recomposé.
func _basculer_l_amelioration(installee: bool, amelioration: String) -> void:
	var installees := []
	for offerte in MontageDeComposition.modeles.ameliorations:
		if (installee and offerte == amelioration) or (offerte != amelioration and offerte in _ameliorations_du_vehicule):
			installees.append(offerte)
	_ameliorations_du_vehicule = installees
	await _demander_le_vehicule()


## Ce que l'écran montre du véhicule demandé, `null` sans lui : sa fiche, ce que son montage a posé (l'élément, l'emblème,
## les éléments de ses pièces et de ses Améliorations, les couleurs de ses surfaces), les noms des nœuds cachés sous sa
## scène, pièces comprises, chacun une fois, la taille de sa boîte, et l'entrée demandée (pièces et Améliorations).
func _vehicule_publie() -> Variant:
	if _definition_du_vehicule == null:
		return null
	var caches := {}
	var taille: Variant = null
	if _vehicule.scene != null:
		for noeud in _vehicule.scene.find_children("*", "Node3D", true, false):
			if not (noeud as Node3D).visible:
				caches[String(noeud.name)] = true
		taille = _en_liste((MontageDeVehicule.boite(_vehicule.scene, _vehicule) as AABB).size)
	var noms := caches.keys()
	noms.sort()
	return {
		definition = _definition_du_vehicule,
		element = _vehicule.element,
		embleme = _vehicule.embleme,
		postes = _vehicule.postes,
		ameliorations = _vehicule.ameliorations,
		couleurs = _vehicule.couleurs_posees(),
		caches = noms,
		taille = taille,
		demande = {postes = _postes_du_vehicule, ameliorations = _ameliorations_du_vehicule},
	}


## @contrat Atelier 3D
## « Équipement » range les emplacements qui offrent au moins un élément en quatre sections titrées, dans cet ordre :
## « Tête et coiffure » (les sélecteurs `tete` et `coiffure`), « Vêtements et armures » (les lignes `piece`), «
## Accessoires » (les lignes `emplacement` et les points `emplacement`) et « Objets tenus » (les points `prise`) ;
## dans chaque section, les emplacements suivent l'ordre des points puis des lignes. Un point, une ligne `emplacement`
## ou un sélecteur est une rangée : son `label` en tête, puis une liste déroulante (`cle` l'id de l'emplacement : l'id
## du point, `ligne/<sorte>` d'un sélecteur, `ligne/emplacement/<id>`) qui offre « Aucun », puis chaque élément par le
## libellé de sa chose (`libelles`), ou, pour un sélecteur, chaque choix dont `elements` n'est pas vide, par son
## `label`, qui monte son élément ; « Aucun » démonte. Une ligne `piece` d'un seul élément est une case à bascule (son
## `label`, `cle` `ligne/piece/<id>`) qui monte cet élément ou le démonte s'il l'est ; avec ses variantes (#3446),
## elle est une rangée comme une ligne `emplacement`, de liste `ligne/piece/<id>`. L'élément d'un choix de sélecteur
## est unique, la clé (base, clé) étant unique à l'index. Ce qu'aucun élément ne porte n'a pas de rangée : un bouton
## replié « À produire (N) » ouvre la liste de ses N libellés, une ligne chacun
## (`<label du sélecteur> : <label du choix>`, ou le `label` d'une pièce ou d'un emplacement d'accessoire), et
## disparaît si N vaut 0. « Animation » porte la liste des clips (`cle` `clip`) du modèle posé, ceux de la base ou
## ceux du véhicule, le lecteur, l'instant, les vitesses, et « Actions », montré quand le véhicule posé a sa fiche
## dans `attaques` de la vitrine : « Attaquer », qui joue son coup et, une fois, le clip de son rôle `tir`, à
## défaut `melee`, puis son repos ; « Outils » porte « Recharger les modèles », chaque aide dont le modèle posé porte
## un repère et le `rapport` de `modeles` s'il n'est pas vide. « Effets » montre la vitrine (`vitrine`, section «
## Effets », #3777) : « Armes » et « Sorts », une rangée par entrée, à son `label`, qui porte un bouton par variante
## (`cle` `effet/<id>/<variante>`) ; « Zones et souffles », un bouton par manœuvre de zone et par Type de Souffle
## (`cle` `manoeuvre/<id>`, `souffle/<id>`) ; « Lumières », un bouton par ton (`cle` `lumiere/<id>`), qui pose son
## `Foyer` sur la cible à sa hauteur, à la place du précédent ; « Sons », un bouton par son (`cle` `son/<id>`) ;
## « Flottants », un bouton par flottant (`cle` `flottant/<id>`) ; « Musiques », un bouton à bascule par musique (`cle`
## `musique/<id>`), qui la joue par le nœud `Musique` de l'atelier à la place de la précédente, relâché le silence. Chaque
## bouton rejoue son effet par le nœud `Effets` de l'atelier, de l'auteur posé à l'origine vers la cible (le nœud
## `Cible`, montré sur cet onglet seul, posé à `distanceM` mètres, `MiseEnPage.lieu_de_la_cible`), un mètre du modèle
## valant un mètre, l'orbite cadrant l'un, l'autre et le véhicule posé.

## L'emplacement de montage `id`, de clé publiée `cle` dans `publie` (`montes` ou `lignes`), qui offre `elements` : son
## bloc posé dans la section `section` de l'onglet Équipement, sans contrôle encore.
func _emplacement(id: String, cle: String, publie: String, section: String, elements: Array) -> Dictionary:
	var bloc := VBoxContainer.new()
	_section(section).add_child(bloc)
	var emplacement := {id = id, cle = cle, publie = publie, bloc = bloc, elements = elements, controle = null}
	_emplacements[id] = emplacement
	return emplacement


## La colonne de la section `id` de l'onglet Équipement, montrée sous son titre. À la première rangée, chaque section
## de `SECTIONS` est posée dans son ordre, cachée jusqu'à sa première rangée.
func _section(id: String) -> VBoxContainer:
	if _sections.is_empty():
		for section in SECTIONS:
			var colonne := VBoxContainer.new()
			colonne.visible = false
			var titre := Label.new()
			titre.text = section.titre
			titre.theme_type_variation = &"HeaderSmall"
			colonne.add_child(titre)
			_panneau_des_emplacements.add_child(colonne)
			_sections[section.id] = colonne
	var montree: VBoxContainer = _sections[id]
	montree.visible = true
	return montree


## L'emplacement d'un point qui offre au moins un élément : son libellé, puis la liste de ses éléments (`_liste`), rangé
## aux accessoires (emplacement) ou aux objets tenus (prise). Un point sans élément n'a pas de rangée.
func _emplacement_du_point(point: Dictionary) -> void:
	if point.elements.is_empty():
		return
	var section := "prise" if point.genre == "prise" else "emplacement"
	var emplacement := _emplacement(point.id, point.id, "montes", section, point.elements)
	_liste(emplacement, point.label, _choix_des_elements(point.elements))


## L'emplacement d'une ligne de pièce (#3086, D3) qui offre au moins un élément, d'id `ligne/<ligne>`, sa clé publiée
## `<ligne>` valant la `sorte` d'un sélecteur, `<sorte>/<id>` sinon : le sélecteur d'un axe (`tete`, `coiffure`), la
## case d'une `piece`, la liste d'un `emplacement`. Ce qui n'a aucun élément va à la liste « À produire ».
func _emplacement_de_la_ligne(ligne: Dictionary) -> void:
	match ligne.sorte:
		"piece":
			if not ligne.elements.is_empty():
				_case_de_piece(ligne)
		"emplacement":
			if not ligne.elements.is_empty():
				var cle := "emplacement/%s" % ligne.id
				_liste(_emplacement("ligne/%s" % cle, cle, "lignes", "emplacement", ligne.elements), ligne.label, _choix_des_elements(ligne.elements))
		_:
			_selecteur(ligne)


## Les choix d'une liste d'éléments : chacun son id, au libellé de la chose qu'il porte (`libelles` de `modeles`).
func _choix_des_elements(elements: Array) -> Array:
	var choix := []
	for element in elements:
		choix.append({id = element, texte = MontageDeComposition.modeles.libelles[element]})
	return choix


## Dans le bloc d'`emplacement`, la rangée `titre` puis la liste déroulante de clé `<emplacement>` : « Aucun » (vide), puis
## `choix`, chacun monté à son choix.
func _liste(emplacement: Dictionary, titre: String, choix: Array) -> void:
	var rangee := _rangee(titre, emplacement.bloc)
	var tous := [{id = VIDE, texte = AUCUN}]
	tous.append_array(choix)
	var liste := _liste_deroulante(emplacement.id, tous, func(element: String) -> void: _choisir_manuellement(emplacement, element))
	rangee.add_child(liste)
	emplacement.controle = liste


## Le sélecteur d'un axe (`tete`, `coiffure`) : son `label`, puis la liste de ses choix pourvus (leur `label`), qui monte
## l'élément du choix, unique par (base, clé). Sans aucun choix pourvu, aucune rangée.
func _selecteur(ligne: Dictionary) -> void:
	var elements := []
	var choix := []
	for offert in ligne.choix:
		if not offert.elements.is_empty():
			elements.append(offert.elements[0])
			choix.append({id = offert.elements[0], texte = offert.label})
	if elements.is_empty():
		return
	_liste(_emplacement("ligne/%s" % ligne.sorte, ligne.sorte, "lignes", "tete", elements), ligne.label, choix)


## La ligne d'une pièce, de clé `ligne/piece/<id>` : la case de son `label`, qui monte son seul élément ou le démonte s'il
## l'est ; si la vue lui déclare des `variantes` (#3446), la liste de ses éléments (`_liste`).
func _case_de_piece(ligne: Dictionary) -> void:
	var cle := "piece/%s" % ligne.id
	var emplacement := _emplacement("ligne/%s" % cle, cle, "lignes", "piece", ligne.elements)
	if ligne.variantes:
		_liste(emplacement, ligne.label, _choix_des_elements(ligne.elements))
		return
	var element: String = ligne.elements[0]
	var case := CheckButton.new()
	case.text = ligne.label
	case.set_meta("cle", emplacement.id)
	case.pressed.connect(func() -> void: _choisir_manuellement(emplacement, VIDE if _montage.montes.get(emplacement.id) == element else element))
	emplacement.bloc.add_child(case)
	emplacement.controle = case


## « À produire (N) » : ce que la garde-robe nomme et qu'aucun élément de la base ne porte, une ligne chacun (le choix d'un
## sélecteur, une pièce, un emplacement d'accessoire), sous le bouton qui la replie.
func _montrer_ce_qu_il_reste_a_produire() -> void:
	var manquants: Array[String] = []
	for ligne in _montage.base.get("lignes", []):
		if ligne.has("choix"):
			for offert in ligne.choix:
				if offert.elements.is_empty():
					manquants.append("%s : %s" % [ligne.label, offert.label])
		elif ligne.elements.is_empty():
			manquants.append(ligne.label)
	%AProduire.text = "À produire (%d)" % manquants.size()
	%AProduire.visible = not manquants.is_empty()
	%ListeAProduire.text = "\n".join(PackedStringArray(manquants))


## Une rangée posée dans `parent` : `titre` en tête, à largeur fixe, puis ce qu'on y ajoute.
func _rangee(titre: String, parent: Node) -> HBoxContainer:
	var rangee := HBoxContainer.new()
	var etiquette := Label.new()
	etiquette.text = titre
	etiquette.custom_minimum_size.x = LARGEUR_DU_LIBELLE
	etiquette.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rangee.add_child(etiquette)
	parent.add_child(rangee)
	return rangee


## Une liste déroulante de clé `cle` : un article par choix (`{ id, texte, icone? }`), son id en métadonnée, qui joue
## `geste` sur l'id choisi.
func _liste_deroulante(cle: String, choix: Array, geste: Callable) -> OptionButton:
	var liste := OptionButton.new()
	liste.set_meta("cle", cle)
	liste.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	liste.fit_to_longest_item = false
	liste.clip_text = true
	for offert in choix:
		var rang := liste.item_count
		if offert.has("icone"):
			liste.add_icon_item(offert.icone, offert.texte)
		else:
			liste.add_item(offert.texte)
		liste.set_item_metadata(rang, offert.id)
	liste.item_selected.connect(func(rang: int) -> void: geste.call(liste.get_item_metadata(rang)))
	return liste


## L'article d'id `id` choisi dans `liste`, sans signal ; aucun si elle ne l'offre pas.
func _selectionner(liste: OptionButton, id: Variant) -> void:
	for rang in liste.item_count:
		if liste.get_item_metadata(rang) == id:
			liste.select(rang)
			return
	liste.select(-1)


## Le contrôle d'`emplacement` montre `element` monté (`VIDE` : rien).
func _montrer_le_monte(emplacement: Dictionary, element: String) -> void:
	var controle: Control = emplacement.controle
	if controle is OptionButton:
		_selectionner(controle, element)
	else:
		(controle as BaseButton).set_pressed_no_signal(element != VIDE)


## Le choix manuel d'un élément à l'emplacement, son défaut d'emblème résolu après retrait de sa surcharge.
func _choisir_manuellement(emplacement: Dictionary, element: String) -> void:
	if element == VIDE or _montage.montes.get(emplacement.id, VIDE) != element:
		_surcharges_des_emblemes.erase(emplacement.id)
	_choisir(emplacement, element, _embleme_de_l_emplacement(emplacement.id))


## L'élément monté à `emplacement` démonté avec son emblème et sa rangée d'emblèmes, puis `element` monté par le montage
## (`MontageDeComposition.monter`) s'il n'est pas « vide », ses erreurs au recueil du geste qui le demande : monté, il
## offre ses emblèmes s'il porte une surface `blason`, et s'habille de l'emblème `embleme` (`_choisir_l_embleme`) ; puis le
## clip engagé passe à celui de son rôle sous la nouvelle tenue (`_rejouer`), et l'état et les onglets suivent ce qui est
## monté (`_montrer_l_etat`).
func _choisir(emplacement: Dictionary, element: String, embleme: String = VIDE) -> void:
	var id: String = emplacement.id
	var recueil := _recueil
	if _lignes_des_emblemes.has(id):
		var rangee: Node = _lignes_des_emblemes[id]
		rangee.get_parent().remove_child(rangee)
		rangee.queue_free()
		_lignes_des_emblemes.erase(id)
		_boutons_des_emblemes.erase(id)
	_montrer_le_monte(emplacement, VIDE)
	if element == VIDE:
		_montage.demonter(id)
	elif await _montage.monter(id, element, recueil):
		_montrer_le_monte(emplacement, element)
		_ligne_des_emblemes(emplacement, element)
		_choisir_l_embleme(id, embleme)
	_rejouer()
	_montrer_l_etat()


## Les lignes `<point>#<rang>` de `cibles` (`composerSurLaBase`), qu'aucune rangée du panneau ne porte : chacune monte
## son élément sous l'emblème de son entrée, ou se rhabille de cet emblème si l'élément y est déjà monté ; tout autre
## élément monté hors panneau est démonté.
func _monter_hors_panneau(cibles: Dictionary) -> void:
	for id in _montage.montes.keys():
		if not _emplacements.has(id) and not cibles.has(id):
			_montage.demonter(id)
	for id in cibles:
		if _emplacements.has(id):
			continue
		var embleme: String = cibles[id].get("embleme", {}).get("id", VIDE)
		if _montage.montes.get(id) == cibles[id].element or await _montage.monter(id, cibles[id].element, _recueil):
			_choisir_l_embleme(id, embleme)
	_rejouer()


## @contrat Atelier 3D
## Un élément monté dont une surface porte `blason: true` (`surfaces`) offre, sous la rangée de son emplacement, une
## rangée « Emblème » : une liste déroulante (`cle` `"<emplacement>/embleme"`, `<emplacement>` valant l'id du point ou
## `ligne/<ligne>`) qui offre « Aucun », puis chaque entrée d'`emblemes` (son `label`).
##
## Démonter un emplacement (ou y monter un autre élément) efface son emblème, sa rangée et sa surcharge. Un remontage
## manuel applique le défaut de la composition. Appliquer un preset efface toutes les surcharges. « Recharger les
## modèles » remonte les éléments montés, rigides et skinnés, que leurs emplacements offrent encore sous l'emblème
## qu'ils portaient, s'il est toujours offert (« Aucun » sinon) ; changer de base n'en garde aucun.

## Sous la rangée d'`emplacement`, si `element` qui y est monté porte une surface `blason` (`surfaces` de la réponse de
## `modeles`) : la rangée « Emblème », la liste de clé `<emplacement>/embleme` (« Aucun », puis chaque emblème).
func _ligne_des_emblemes(emplacement: Dictionary, element: String) -> void:
	if not MontageDeComposition.porte_un_blason(element):
		return
	var id: String = emplacement.id
	var choix: Array = [{id = VIDE, texte = AUCUN}]
	for offert in MontageDeComposition.modeles.emblemes:
		choix.append({id = offert.id, texte = offert.label})
	var rangee := _rangee("Emblème", emplacement.bloc)
	var liste := _liste_deroulante("%s/embleme" % id, choix, func(choisi: String) -> void: _surcharger_l_embleme(id, choisi))
	rangee.add_child(liste)
	_lignes_des_emblemes[id] = rangee
	_boutons_des_emblemes[id] = liste


## L'emblème de l'emplacement : sa surcharge explicite, sinon le défaut de la composition.
func _embleme_de_l_emplacement(id: String) -> String:
	var reference: Variant = _surcharges_des_emblemes.get(id, _composition.get("embleme"))
	return VIDE if reference == null else str(reference.id)


## @contrat Atelier 3D
## Les boutons d’emblème tiennent leurs surcharges explicites séparément des emblèmes effectivement posés et les
## transmettent à `composer`. Un changement d’emblème seul appelle `MontageDeComposition.choisir_l_embleme` sur les
## meshes déjà montés. Une composition qui change l’élément d’un emplacement efface sa surcharge et le monte sous le
## défaut de la composition ; sur un emplacement inchangé, elle pose l’emblème de son entrée de `montes` s’il diffère
## du dernier demandé, posé ou non : un emblème qui ne se pose pas n’est pas redemandé, et son erreur n’est pas
## répétée. Changer de base efface les surcharges.

## Le choix manuel de l'emblème `embleme` à l'emplacement `id` : sa surcharge, transmise à chaque `composer`, puis sa pose.
func _surcharger_l_embleme(id: String, embleme: String) -> void:
	_surcharges_des_emblemes[id] = null if embleme == VIDE else {id = embleme}
	_choisir_l_embleme(id, embleme)


## L'emblème `embleme` demandé à l'emplacement `id`, qu'un élément monte, posé par le montage
## (`MontageDeComposition.choisir_l_embleme`) : sa liste montre l'emblème posé.
func _choisir_l_embleme(id: String, embleme: String) -> void:
	var pose := _montage.choisir_l_embleme(id, embleme)
	if _boutons_des_emblemes.has(id):
		_selectionner(_boutons_des_emblemes[id], pose)
	_montrer_l_etat()


func _poser_l_aide_du_point(point: Dictionary) -> void:
	if _montage.squelette == null:
		return
	var aide: String = AIDE_DU_GENRE[point.genre]
	var support := MontageDeComposition.attacher(_montage.squelette, point.attache, "Aide_%s" % point.id)
	if support == null:
		return
	support.add_child(_repere(COULEUR_DES_AIDES[aide], RAYON_DU_REPERE_DE_POINT))
	var etiquette := Label3D.new()
	etiquette.text = point.id
	etiquette.pixel_size = TAILLE_DE_L_ETIQUETTE
	etiquette.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	etiquette.no_depth_test = true
	etiquette.modulate = COULEUR_DES_AIDES[aide]
	support.add_child(etiquette)
	_reperes[aide].append(support)


func _repere(couleur: Color, rayon: float) -> MeshInstance3D:
	var matiere := StandardMaterial3D.new()
	matiere.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	matiere.albedo_color = couleur
	matiere.no_depth_test = true
	var boule := SphereMesh.new()
	boule.radius = rayon
	boule.height = MiseEnPage.diametre(rayon)
	boule.material = matiere
	var repere := MeshInstance3D.new()
	repere.mesh = boule
	return repere


func _montrer_l_aide(montre: bool, aide: String) -> void:
	_aides[aide] = montre
	_cases_des_aides[aide].set_pressed_no_signal(montre)
	for repere in _reperes[aide]:
		repere.visible = montre
	_publier()


## Un bouton par clip du modèle posé, base ou véhicule, chacun mis en boucle (`MontageDeComposition.boucler`) ; le clip
## de la reprise rejoué à son instant, en lecture ou en pause, sinon le clip de repos (`_jouer_le_repos`).
func _poser_les_clips() -> void:
	_clips.clear()
	if _lecteur() == null:
		return
	MontageDeComposition.boucler(_lecteur(), Array(_lecteur().get_animation_list()))
	for nom in _lecteur().get_animation_list():
		var rang := _clips.item_count
		_clips.add_item(nom)
		_clips.set_item_metadata(rang, nom)
	_lecteur().speed_scale = _vitesse
	_clips.select(-1)
	if not _lecteur().has_animation(_reprise.get("clip", "")):
		_jouer_le_repos()
		return
	_jouer_le_clip(_reprise.clip)
	_lecteur().seek(_reprise.instant, true)
	if not _reprise.lecture:
		_lecteur().pause()


func _jouer_le_clip(nom: String) -> void:
	_lecteur().play(nom)
	var animation := _lecteur().get_animation(nom)
	_pas = 0.0
	for piste in animation.get_track_count():
		_pas = MiseEnPage.pas_d_image(_pas, animation.length, animation.track_get_key_count(piste))
	_selectionner(_clips, nom)
	_publier()


## Le clip du rôle `repos` de la composition montée (`MontageDeComposition.clip`, à deux mains quand la main libre tient
## une seconde prise) joué, s'il est au lecteur ; sans lui, le squelette reste à sa pose de repos.
func _jouer_le_repos() -> void:
	if _montage.lecteur != null and _montage.lecteur.has_animation(_montage.clip("repos")):
		_jouer_le_clip(_montage.clip("repos"))
	else:
		_publier()


## Le clip engagé rejoué au clip que son rôle a maintenant, en lecture ou en pause comme lui, si la tenue l'a changé
## (`MontageDeComposition.role_a_rejouer`).
func _rejouer() -> void:
	var role := _montage.role_a_rejouer()
	if role == "":
		return
	var lecture := _montage.lecteur.is_playing()
	_jouer_le_clip(_montage.clip(role))
	if not lecture:
		_montage.lecteur.pause()


## Le lecteur des clips du modèle posé : celui du véhicule, sinon celui de la base.
func _lecteur() -> AnimationPlayer:
	return _vehicule.lecteur if _vehicule.scene != null else _montage.lecteur


## Si un clip est engagé au lecteur, joué ou en pause.
func _a_un_clip() -> bool:
	return _lecteur() != null and _lecteur().assigned_animation != ""


func _lire() -> void:
	if _a_un_clip():
		_lecteur().play()
	_publier()


func _mettre_en_pause() -> void:
	if _a_un_clip():
		_lecteur().pause()
	_publier()


func _aller_a_l_image(sens: float) -> void:
	if _a_un_clip():
		_lecteur().pause()
		_lecteur().seek(MiseEnPage.image_voisine(_lecteur().current_animation_position, _pas, sens, _lecteur().current_animation_length), true)
	_publier()


func _regler_la_vitesse(vitesse: float) -> void:
	_vitesse = vitesse
	if _lecteur() != null:
		_lecteur().speed_scale = vitesse
	_publier()


func _signaler(message: String) -> void:
	_recueil.append(message)
	_montrer_l_etat()


## Les erreurs publiées : celles de `_erreurs`, puis celles du dernier geste de composition, puis celles du gabarit posé.
func _toutes_les_erreurs() -> Array[String]:
	var toutes: Array[String] = _erreurs.duplicate()
	toutes.append_array(_erreurs_de_composition)
	toutes.append_array(_erreurs_du_gabarit)
	return toutes


## Le pied du panneau : la base posée et son empreinte, puis chaque erreur, le pied en rouge s'il y en a ; les onglets
## adaptés au modèle posé (`_adapter_les_onglets`).
func _montrer_l_etat() -> void:
	var lignes: Array[String] = []
	if not _montage.base.is_empty():
		lignes.append("%s · %s" % [_montage.base.id, str(_montage.base.empreinte).left(DEBUT_D_EMPREINTE)])
	if _vehicule.element != null:
		lignes.append(str(_vehicule.element))
	_adapter_les_onglets()
	var erreurs := _toutes_les_erreurs()
	lignes.append_array(erreurs)
	_etat.text = "\n".join(PackedStringArray(lignes))
	_etat.theme_type_variation = &"" if erreurs.is_empty() else &"echec"
	_publier()


## L'onglet `onglet` du panneau montré, les autres cachés : chacun son défilement, aucun imbriqué.
func _montrer_l_onglet(onglet: String) -> void:
	_onglet = onglet
	for autre in _onglets:
		_onglets[autre].visible = autre == onglet
	_cible.visible = onglet == "effets"
	_publier()


## Les onglets que le modèle posé offre, dans l'ordre du panneau (`.claude/rules/hote-godot.md`) : « Personnage », la
## composition d'une base posée ; « Équipement », si une de ses sections porte une rangée ou s'il reste à produire ;
## « Couleurs », si une surface posée prend une couleur de palette (`_palette_posee`) ; « Animation », si le lecteur du
## modèle posé a un clip ou si l'engin posé attaque ; « Effets » et « Outils », toujours.
func _onglets_offerts() -> Array[String]:
	var offerts := {
		personnage = not _montage.base.is_empty(),
		equipement = %AProduire.visible or _sections.values().any(func(section: Control) -> bool: return section.visible),
		couleurs = not _palette_posee().is_empty(),
		animation = _attaque_de_l_engin() != null or (_lecteur() != null and not _lecteur().get_animation_list().is_empty()),
		effets = true,
		outils = true,
	}
	var dans_l_ordre: Array[String] = []
	for onglet in _onglets:
		if offerts[onglet]:
			dans_l_ordre.append(String(onglet))
	return dans_l_ordre


## Chaque bascule d'onglet montrée si le modèle posé offre son onglet (`_onglets_offerts`), l'onglet montré remplacé par
## le premier offert s'il ne l'est plus ; à l'onglet Couleurs, la rangée de chaque emplacement de la palette posée ; à
## l'onglet Animation, « Attaquer » si l'engin posé attaque, « Parcourir un chemin » si la base posée marche
## (`_parcourt`), et « Actions » s'il porte l'un d'eux ; à l'onglet Outils, chaque aide dont le modèle porte un repère.
func _adapter_les_onglets() -> void:
	var offerts := _onglets_offerts()
	for onglet in _onglets:
		_boutons_des_onglets[onglet].visible = onglet in offerts
	if not _onglet in offerts:
		_boutons_des_onglets[offerts[0]].button_pressed = true
		_montrer_l_onglet(offerts[0])
	var palette := _palette_posee()
	for slot in _listes_des_couleurs:
		_listes_des_couleurs[slot].get_parent().visible = palette.has(slot)
	%Attaquer.visible = _attaque_de_l_engin() != null
	%Parcourir.visible = _parcourt()
	%Actions.visible = %Attaquer.visible or %Parcourir.visible
	for aide in _cases_des_aides:
		_cases_des_aides[aide].visible = not _reperes[aide].is_empty()
	%TitreAides.visible = _reperes.values().any(func(reperes: Array) -> bool: return not reperes.is_empty())


## Les emplacements de palette que prennent les surfaces posées (`surfaces` de `modeles`) : celles du véhicule posé, de ses
## pièces et de ses Améliorations, sinon celles de la base posée et de chaque élément monté.
func _palette_posee() -> Dictionary:
	var poses: Array = []
	if _vehicule.element != null:
		poses.append(_vehicule.element)
		poses.append_array(_vehicule.postes)
		poses.append_array(_vehicule.ameliorations)
	elif not _montage.base.is_empty():
		poses.append(_montage.base.id)
		poses.append_array(_montage.montes.values())
	var palette := {}
	for id in poses:
		for surface in MontageDeComposition.modeles.surfaces.get(id, []):
			palette[surface.palette] = true
	return palette


## La vitrine des effets (`vitrine`) : la cible posée à sa distance, puis, par rendu d'arme et par sort, une rangée à son
## `label` qui porte un bouton par variante, un bouton par manœuvre de zone et par Type de Souffle (#3783), un bouton par
## son et par flottant, un bouton par ton de lumière, qui pose son foyer sur la cible, un bouton à bascule par musique
## (#3825), par zone qui dure, qui la pose autour de la cible, et par État, qui pose sa marque sur la cible (#3834).
func _poser_la_vitrine() -> void:
	var reponse := _pont.appeler("vitrine")
	if reponse.get("ok") != true:
		return
	_vitrine = reponse
	_cible.position = MiseEnPage.lieu_de_la_cible(_vitrine.distanceM)
	for famille in [[_vitrine.armes, %VitrineArmes], [_vitrine.sorts, %VitrineSorts]]:
		for entree in famille[0]:
			var rangee := _rangee(entree.label, famille[1])
			for variante in entree.variantes:
				var bouton := Button.new()
				bouton.text = VARIANTES[variante.variante]
				bouton.set_meta("cle", "effet/%s/%s" % [entree.id, variante.variante])
				bouton.pressed.connect(_jouer_l_effet.bind(variante.effet))
				rangee.add_child(bouton)
	for famille in [["manoeuvre", _vitrine.manoeuvres, %VitrineZones], ["souffle", _vitrine.souffles, %VitrineZones], ["son", _vitrine.sons, %VitrineSons], ["flottant", _vitrine.flottants, %VitrineFlottants]]:
		for entree in famille[1]:
			var bouton := Button.new()
			bouton.text = entree.label
			bouton.set_meta("cle", "%s/%s" % [famille[0], entree.id])
			bouton.pressed.connect(_jouer_l_effet.bind(entree.effet))
			famille[2].add_child(bouton)
	for lumiere in _vitrine.lumieres:
		var bouton := Button.new()
		bouton.text = lumiere.label
		bouton.set_meta("cle", "lumiere/%s" % lumiere.id)
		bouton.pressed.connect(_poser_le_foyer.bind(lumiere.source))
		%VitrineLumieres.add_child(bouton)
	for musique in _vitrine.musiques:
		var bouton := Button.new()
		bouton.text = musique.label
		bouton.toggle_mode = true
		bouton.set_meta("cle", "musique/%s" % musique.id)
		bouton.toggled.connect(_ecouter.bind(musique.musique, bouton))
		%VitrineMusiques.add_child(bouton)
	for zone in _vitrine.zonesQuiDurent:
		var bouton := Button.new()
		bouton.text = zone.label
		bouton.toggle_mode = true
		bouton.set_meta("cle", "zone-qui-dure/%s" % zone.id)
		bouton.toggled.connect(_faire_durer.bind(zone.zone, bouton))
		%VitrineZonesQuiDurent.add_child(bouton)
	for marque in _vitrine.marques:
		var bouton := Button.new()
		bouton.text = marque.label
		bouton.toggle_mode = true
		bouton.set_meta("cle", "marque/%s" % marque.id)
		bouton.set_meta("marque", marque.marque)
		bouton.toggled.connect(_marquer.unbind(1))
		%VitrineMarques.add_child(bouton)


## La zone qui dure `zone` de la vitrine posée autour de la cible quand son bouton `bouton` s'enfonce (`allume`), les
## autres relâchés ; retirée quand il se relâche.
func _faire_durer(allume: bool, zone: Dictionary, bouton: Button) -> void:
	for autre: Button in %VitrineZonesQuiDurent.get_children():
		if autre != bouton:
			autre.set_pressed_no_signal(false)
	var lieu := func(case: Dictionary) -> Vector3: return MiseEnPage.lieu_de_la_case_de_vitrine(case.x, case.y, _vitrine.metresParCase)
	_zones.poser([zone] if allume else [], lieu, METRES_PAR_UNITE)


## Les marques des États dont le bouton est enfoncé, posées sur la cible dans leur ordre.
func _marquer() -> void:
	var marques: Array = []
	for bouton: Button in %VitrineMarques.get_children():
		if bouton.button_pressed:
			marques.append(bouton.get_meta("marque"))
	_marques.montrer(marques, METRES_PAR_UNITE)


## La musique `musique` de la vitrine jouée quand son bouton `bouton` s'enfonce (`allume`), les autres relâchés ; le
## silence quand il se relâche.
func _ecouter(allume: bool, musique: Dictionary, bouton: Button) -> void:
	if not allume:
		_musique.jouer(null)
		return
	for autre: Button in %VitrineMusiques.get_children():
		if autre != bouton:
			autre.set_pressed_no_signal(false)
	_musique.jouer(musique)


## L'effet `effet` de la vitrine rejoué de l'auteur, à l'origine, vers la cible, l'orbite cadrant l'un et l'autre et le
## véhicule ou l'échantillon posé.
func _jouer_l_effet(effet: Dictionary) -> void:
	var boite := AABB(MiseEnPage.coin_de_la_vitrine(_vitrine.distanceM), MiseEnPage.etendue_de_la_vitrine(_vitrine.distanceM))
	var posee: Variant = MontageDeVehicule.boite(_vehicule.scene, _vehicule) if _vehicule.scene != null else MontageDeVehicule.boite(_echantillon, _echantillon)
	if posee != null:
		boite = boite.merge(posee)
	_marche.cadrer_la_boite(boite)
	var lieux := {_vitrine.de: Vector3.ZERO, _vitrine.vers: _cible.position}
	for case: Dictionary in Effets.cases_de(effet):
		lieux[Effets.cle_de_case(case)] = MiseEnPage.lieu_de_la_case_de_vitrine(case.x, case.y, _vitrine.metresParCase)
	_effets.jouer([effet], lieux, METRES_PAR_UNITE)


## Le foyer de la source `source` (un ton de lumière de la vitrine) posé sur la cible à sa hauteur, à la place du
## précédent.
func _poser_le_foyer(source: Dictionary) -> void:
	for ancien in _cible.get_children().filter(func(n: Node) -> bool: return n is Foyer):
		ancien.free()
	var foyer := Foyer.new()
	foyer.position = MiseEnPage.foyer_de_la_vitrine(source.hM, METRES_PAR_UNITE)
	_cible.add_child(foyer)
	foyer.poser(source, METRES_PAR_UNITE)


## Le coup de l'engin posé (`attaques` de la vitrine, par sa fiche), `null` sans engin posé ou sans vitrine.
func _attaque_de_l_engin() -> Variant:
	if _vehicule.scene == null or _vitrine.is_empty():
		return null
	return _vitrine.attaques.get(_definition_du_vehicule)


## Si la base posée parcourt le chemin de la vitrine (`deplacement`) : la vitrine servie, et le clip de marche de la
## composition montée au lecteur.
func _parcourt() -> bool:
	return not _vitrine.is_empty() and _montage.lecteur != null and _montage.lecteur.has_animation(_montage.clip(Combattant.MARCHE))


## Le modèle posé parcourt `lieux`, le chemin de la vitrine (`deplacement`), depuis sa première case, comme un combattant
## du plateau (`Combattant.parcourir_les_lieux`) : au clip de marche de la composition montée, chaque pas de `metres` (au
## même rang) à sa vitesse au sol (`MontageDeComposition.duree_du_pas`) ; puis son repos. Un parcours neuf remplace celui
## en cours.
func _parcourir(_qui: String, lieux: Array, metres: Array) -> void:
	if _parcours != null:
		_parcours.kill()
	var racine := _montage.modele
	racine.position = lieux[0]
	_jouer_le_clip(_montage.clip(Combattant.MARCHE))
	_parcours = create_tween()
	Combattant.parcourir_les_lieux(_parcours, racine, racine, lieux, metres.map(_montage.duree_du_pas))
	_parcours.tween_callback(_jouer_le_repos)


## L'engin posé attaque, comme au combat : son coup, et le clip de son rôle de tir s'il en porte un, d'attaque sinon, joué
## une fois, puis son repos.
func _attaquer() -> void:
	_jouer_l_effet(_attaque_de_l_engin())
	var clip: String = _vehicule.clips.get(Combattant.TIR, _vehicule.clips.get(Combattant.ATTAQUE, ""))
	if clip == "":
		return
	_jouer_le_clip(clip)
	await get_tree().create_timer(_lecteur().get_animation(clip).length).timeout
	var repos: String = _vehicule.clips.get(Combattant.REPOS, "")
	if _lecteur() != null and _lecteur().has_animation(repos):
		_jouer_le_clip(repos)


## @contrat Atelier 3D
## « Personnage » porte la composition courante (section « Composition d'un personnage »), que Godot tient, vide à
## l'ouverture : un bouton par preset de `catalogues` (son `label`), qui la remplace par sa `composition` ; puis une
## rangée par entrée de `catalogues().axes`, dans leur ordre, son `label` en tête. Un axe `ref` ou `valeur` est une
## liste déroulante (`cle` `"axe/<champ>"`) : « Aucun », puis les choix de sa `liste` de `catalogues`, chacun par son
## `label` ; il pose l'id choisi dans son `champ` (`{ id }` pour `ref`, l'id nu pour `valeur`) ou retire le champ sous
## « Aucun ». Un axe `plage` est une glissière bornée par `min` et `max`, au pas de 0,05, suivie d'un bouton « neutre
## » (`cle` `"axe/<champ>/neutre"`) ; elle pose sa valeur dans son `champ`, « neutre » retire le champ, et sans champ
## elle montre `neutre`. Godot ne nomme aucun axe ni aucune liste. Chaque liste et chaque glissière montre le champ de
## la composition courante. « Couleurs » porte une rangée par emplacement de palette (`couleurs` de `catalogues`),
## montrée si une surface posée le prend (`surfaces` de `modeles` : celles du véhicule posé, de ses pièces et de ses
## Améliorations, sinon celles de la base et de ses éléments montés), son `label` en tête, puis une liste déroulante
## (`cle` `"couleur/<emplacement>"`) : « Par défaut », puis chaque couleur du `nuancier`, son `label` précédé d'une
## pastille de sa `couleur` ; une couleur choisie se pose dans `couleurs` de la composition courante (`{ id }`), « Par
## défaut » la retire, et un `couleurs` vide se retire. Chaque liste montre le champ de la composition courante. Un
## preset appliqué, un axe changé ou une couleur changée appelle `composer` sur la base posée : chaque emplacement
## monte l'élément que `montes` lui donne (le premier non nul quand plusieurs entrées visent le même emplacement),
## chaque ligne `<point>#<rang>`, sans rangée au panneau, monte le sien, et les autres se démontent, au montage décrit
## ci-dessous ; `gabarit` et `morphes` se posent (section « Gabarit d'une base
## »), le squelette remis à sa pose de repos puis le clip engagé reposé à son instant. Une composition que `composer`
## refuse, `{}` compris (erreur `validation`, section « Composition d'un personnage »), ne compose rien : chaque
## emplacement est démonté, ni gabarit ni morphe ne reste, et « composition refusée : » suivi du message de l'erreur,
## qui porte le chemin de chaque faute, prend la place des manquants ; le message va aussi aux `erreurs`. Un os de
## `gabarit` que la base n'a pas donne `os-absent : <os>` aux `erreurs` du gabarit posé, que chaque pose du gabarit
## remplace : à chaque composition, à chaque « Recharger les modèles » et à chaque changement de base. Un preset
## appliqué, un axe changé, une couleur changée et « Copier la composition » sont des gestes de composition : les
## `erreurs` de chacun (refus, montage qu'il demande) remplacent celles du précédent, et chaque composition efface le
## texte de la copie. Les `morphes` se reposent à chaque élément monté et à chaque « Recharger les modèles », qui
## garde la composition composée ; changer de base l'efface. Sous les axes, « À produire pour ce personnage : » puis
## une ligne par entrée de `manquants`, son `label` suivi de `par.label`, entre parenthèses, le libellé de ce qui
## l'apporte, ou « Rien ne manque à ce personnage. » ; puis le `rapport` de `composer` s'il n'est pas vide. « Copier
## la composition » rend par `presetDeComposition` la composition courante, avec `preset`, l'id du dernier preset
## appliqué, s'il y en a un ; il affiche son verdict (« verdict : valide », ou une ligne `chemin : message` par faute)
## puis l'entrée, et copie l'entrée au presse-papiers (`DisplayServer.clipboard_set`) ; refusé (erreur `validation`),
## il affiche « composition refusée : » suivi du message à la place du verdict, sans entrée ni copie. Godot n'écrit
## aucun champ de l'enveloppe.

## Les familles d'échantillons de `echantillons` (#3802), dont chaque liste de tête se pose avec les modèles
## (`_poser_les_listes_des_modeles`).
func _lire_les_echantillons() -> void:
	var reponse := _pont.appeler("echantillons")
	if reponse.get("ok") == true:
		_familles_d_echantillons = reponse.familles


## Les presets et les axes de `catalogues` (#3086, D2 et D3) : un bouton par preset (son `label`), puis chaque axe de
## `axes`, dans leur ordre, son `label` en tête : la liste de ses choix (leur `label`, l'id stocké), « aucun » en tête,
## pour un axe `ref` ou `valeur` ; pour un axe `plage`, une glissière bornée par `min` et `max` au pas `PAS_DE_PLAGE`,
## puis « neutre ».
func _poser_les_catalogues() -> void:
	var reponse := _pont.appeler("catalogues")
	if reponse.get("ok") != true:
		return
	_catalogues = reponse
	_axes = reponse.axes
	for preset in reponse.presets:
		var bouton := Button.new()
		bouton.text = preset.label
		bouton.pressed.connect(_appliquer_le_preset.bind(preset))
		%Presets.add_child(bouton)
	for axe in _axes:
		var rangee := _rangee(axe.label, %Axes)
		var selecteur: Control = _glissiere(axe, rangee) if axe.forme == "plage" else _liste_d_axe(axe, rangee)
		selecteur.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_selecteurs_d_axe[axe.champ] = selecteur
	_poser_les_couleurs()
	_montrer_la_composition()


## Le panneau Couleurs : par emplacement de palette (`couleurs` de `catalogues`), son libellé en tête puis la liste de clé
## `couleur/<emplacement>` : « Par défaut », la matière du modèle, puis chaque couleur du `nuancier`, sa pastille en
## icône.
func _poser_les_couleurs() -> void:
	var choix: Array = [{id = VIDE, texte = PAR_DEFAUT}]
	for couleur in _catalogues.nuancier:
		var image := Image.create(COTE_DE_LA_PASTILLE, COTE_DE_LA_PASTILLE, false, Image.FORMAT_RGB8)
		image.fill(Color(couleur.couleur))
		choix.append({id = couleur.id, texte = couleur.label, icone = ImageTexture.create_from_image(image)})
	for emplacement in _catalogues.couleurs:
		var slot: String = emplacement.id
		var liste := _liste_deroulante("couleur/%s" % slot, choix, func(id: String) -> void: _changer_la_couleur(slot, id))
		_rangee(emplacement.label, %Couleurs).add_child(liste)
		_listes_des_couleurs[slot] = liste


## La couleur `id` du nuancier posée à l'emplacement de palette `slot` de la composition courante (« vide » l'en retire,
## et un champ `couleurs` vide se retire), puis la composition recomposée.
func _changer_la_couleur(slot: String, id: String) -> void:
	var couleurs: Dictionary = _composition.get("couleurs", {})
	if id == VIDE:
		couleurs.erase(slot)
	else:
		couleurs[slot] = {id = id}
	if couleurs.is_empty():
		_composition.erase("couleurs")
	else:
		_composition.couleurs = couleurs
	_composer()


## La liste de l'axe `axe` posée dans `rangee`, de clé `axe/<champ>` : « aucun », puis chaque choix de sa liste de
## `catalogues`.
func _liste_d_axe(axe: Dictionary, rangee: HBoxContainer) -> OptionButton:
	var choix: Array = [{id = null, texte = AUCUN}]
	for offert in _catalogues[axe.liste]:
		choix.append({id = offert.id, texte = offert.label})
	var selecteur := _liste_deroulante("axe/%s" % axe.champ, choix, func(id: Variant) -> void: _changer_l_axe(axe, id))
	rangee.add_child(selecteur)
	return selecteur


## La glissière de l'axe `plage` `axe` posée dans `rangee`, puis son bouton « neutre », de clé `axe/<champ>/neutre`.
func _glissiere(axe: Dictionary, rangee: HBoxContainer) -> HSlider:
	var glissiere := HSlider.new()
	glissiere.min_value = float(axe.min)
	glissiere.max_value = float(axe.max)
	glissiere.step = PAS_DE_PLAGE
	glissiere.value = float(axe.neutre)
	glissiere.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	glissiere.value_changed.connect(func(valeur: float) -> void: _changer_l_axe(axe, valeur))
	rangee.add_child(glissiere)
	var neutre := Button.new()
	neutre.text = NEUTRE
	neutre.set_meta("cle", "axe/%s/%s" % [axe.champ, NEUTRE])
	neutre.pressed.connect(_changer_l_axe.bind(axe, null))
	rangee.add_child(neutre)
	return glissiere


## Le preset `preset` appliqué : sa composition remplace la courante, puis se compose.
func _appliquer_le_preset(preset: Dictionary) -> void:
	_preset = preset.id
	_composition = preset.composition.duplicate(true)
	_surcharges_des_emblemes.clear()
	_composer()


## La valeur `valeur` de l'axe `axe` posée dans la composition courante, puis la composition recomposée : `null` retire
## son champ, un id se pose en `{ id }` (`ref`) ou nu (`valeur`), un nombre (`plage`) tel quel.
func _changer_l_axe(axe: Dictionary, valeur: Variant) -> void:
	if valeur == null:
		_composition.erase(axe.champ)
	else:
		_composition[axe.champ] = {id = valeur} if axe.forme == "ref" else valeur
	_composer()


## Un geste de composition : `geste` joué, ses erreurs (`_signaler` compris) remplaçant celles du précédent.
func _geste_de_composition(geste: Callable) -> void:
	_erreurs_de_composition = []
	_recueil = _erreurs_de_composition
	geste.call()
	_recueil = _erreurs
	_montrer_l_etat()


## Le texte affiché du refus `reponse` (erreur `validation`) de `composer` ou de `presetDeComposition`.
func _texte_du_refus(reponse: Dictionary) -> String:
	return "composition refusée : %s" % reponse.erreur.message


## La composition courante composée, en geste de composition (`_composer_la_courante`).
func _composer() -> void:
	_geste_de_composition(_composer_la_courante)


## La composition courante composée par `composer` sur la base posée, avec les surcharges d'emblème : chaque emplacement
## monte l'élément que `montes` lui donne et démonte les autres. Un emplacement dont l'élément change perd sa surcharge et
## monte sous le défaut de la composition (`_embleme_de_l_emplacement`) ; un élément monté inchangé se rhabille de la
## palette de la réponse et de l'emblème de son entrée de `montes`, et la base de cette palette. Puis le gabarit et
## les morphes de la réponse se posent. Refusée (erreur `validation`), rien n'est composé : chaque emplacement est
## démonté, ni gabarit ni morphe, et le texte du refus est gardé. Le texte de « Copier » est effacé.
func _composer_la_courante() -> void:
	_montage.composee = {}
	_refus_de_composition = ""
	%Verdict.text = ""
	%Entree.text = ""
	if _montage.base.is_empty():
		_montrer_la_composition()
		if _definition_du_vehicule != null:
			_demander_le_vehicule()
		return
	var reponse := _pont.appeler("composer", {base = _montage.base.id, composition = _composition, emblemes = _surcharges_des_emblemes})
	if reponse.get("ok") == true:
		_montage.composee = reponse
	elif reponse.get("ok") == false:
		_refus_de_composition = _texte_du_refus(reponse)
	var cibles := _montage.cibles()
	for id in _emplacements:
		var monte: Dictionary = cibles.get(id, {})
		var cible: String = monte.get("element", VIDE)
		var embleme: String = monte.get("embleme", {}).get("id", VIDE)
		if _montage.montes.get(id, VIDE) != cible:
			_surcharges_des_emblemes.erase(id)
			_choisir(_emplacements[id], cible, _embleme_de_l_emplacement(id))
		elif _montage.montes.has(id):
			_choisir_l_embleme(id, embleme)
	_monter_hors_panneau(cibles)
	_montage.habiller_la_base()
	_poser_le_gabarit()
	_montage.poser_les_morphes()
	_montrer_la_composition()


## Le gabarit de la composition composée posé par le montage (`MontageDeComposition.poser_le_gabarit`) : chaque os
## qu'il nomme et que la base n'a pas donne `os-absent : <os>` aux erreurs du gabarit, qui remplacent celles de la pose
## précédente ; l'orbite cadre le corps neutre jusqu'à la mesure du gabarit au repos. La marche prend l'échelle de vitesse
## du gabarit (`echelleDeVitesse`), neutre sans gabarit.
func _poser_le_gabarit() -> void:
	_erreurs_du_gabarit = []
	var gabarit: Dictionary = _montage.composee.get("gabarit", {})
	_marche.poser_l_echelle_de_vitesse(float(gabarit.get("echelleDeVitesse", MarcheDeLAtelier.VITESSE_NEUTRE)))
	if _montage.gabarit == null:
		_marche.cadrer(MarcheDeLAtelier.CADRE_NEUTRE)
		return
	for os in _montage.poser_le_gabarit():
		_erreurs_du_gabarit.append("os-absent : %s" % os)
	_cadrer()


## L'orbite cadre le corps au gabarit mesuré au repos (`MiseEnPage.echelle_de_cadrage`, le sommet de ses os rapporté à
## celui du corps neutre), le corps neutre sans mesure.
func _cadrer() -> void:
	var mesures := _montage.gabarit.mesures()
	_marche.cadrer(MarcheDeLAtelier.CADRE_NEUTRE if mesures.is_empty() else MiseEnPage.echelle_de_cadrage(mesures.repos.sommet, mesures.neutre.sommet))
	_publier()


## Les sélecteurs d'axe et les listes de couleurs sur la composition courante (la glissière d'un axe `plage` sans valeur à
## son `neutre`, une couleur absente à « Par défaut »), les manquants de la composition composée (leur libellé, et
## celui de ce qui les apporte, `par.label`) et son rapport, ou le
## refus de la composition courante.
func _montrer_la_composition() -> void:
	for axe in _axes:
		var valeur: Variant = _composition.get(axe.champ)
		if axe.forme == "plage":
			(_selecteurs_d_axe[axe.champ] as HSlider).set_value_no_signal(float(axe.neutre) if valeur == null else float(valeur))
			continue
		_selectionner(_selecteurs_d_axe[axe.champ], valeur.id if valeur is Dictionary else valeur)
	var couleurs: Dictionary = _composition.get("couleurs", {})
	for slot in _listes_des_couleurs:
		_selectionner(_listes_des_couleurs[slot], couleurs.get(slot, {}).get("id", VIDE))
	var lignes: Array[String] = []
	if not _refus_de_composition.is_empty():
		lignes.append(_refus_de_composition)
	if not _montage.composee.is_empty():
		lignes.append("Rien ne manque à ce personnage." if _montage.composee.manquants.is_empty() else "À produire pour ce personnage :")
		for manquant in _montage.composee.manquants:
			var apport: Variant = manquant.get("par")
			lignes.append("· %s" % manquant.label if apport == null else "· %s (%s)" % [manquant.label, apport.label])
	%Manquants.text = "\n".join(PackedStringArray(lignes))
	var rapport: Array = _montage.composee.get("rapport", [])
	%RapportDeComposition.text = "\n".join(PackedStringArray(rapport))
	%RapportDeComposition.visible = not rapport.is_empty()
	_publier()


## La composition courante rendue par `presetDeComposition`, en geste de composition (`_copier_la_courante`).
func _copier() -> void:
	_geste_de_composition(_copier_la_courante)


## La composition courante rendue par `presetDeComposition`, sous l'enveloppe du dernier preset appliqué s'il y en a un
## (`preset`) : l'entrée et son verdict affichés, l'entrée copiée au presse-papiers. Refusée (erreur `validation`), le
## texte du refus remplace le verdict, sans entrée ni copie.
func _copier_la_courante() -> void:
	var entree := {composition = _composition}
	if _preset != null:
		entree.preset = _preset
	var reponse := _pont.appeler("presetDeComposition", entree)
	if reponse.get("ok") == false:
		%Verdict.text = _texte_du_refus(reponse)
		%Entree.text = ""
		_publier()
	if reponse.get("ok") != true:
		return
	var fautes: Array[String] = []
	for faute in reponse.verdict:
		fautes.append("%s : %s" % [".".join(PackedStringArray(faute.chemin.map(func(pas: Variant) -> String: return str(pas)))), faute.message])
	%Verdict.text = "verdict : valide" if fautes.is_empty() else "verdict :\n%s" % "\n".join(PackedStringArray(fautes))
	%Entree.text = reponse.entree
	DisplayServer.clipboard_set(reponse.entree)
	_publier()


## L'écran publié après un geste ou un changement d'état, `peaux` à remesurer. Chaque image d'un clip en lecture le
## republie sans les remesurer (`_process`) : la mesure lit au processeur chaque mesh skinné rendu
## (`RenderingServer.mesh_get_surface`), une lecture synchrone du tampon sous WebGL.
func _publier() -> void:
	_peaux_a_mesurer = true
	_publier_l_ecran.call_deferred()


## L'écran publié à la recette (`PontDuNoyau.publier_l_ecran`, `_ecran_publie`), une fois mis en page.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	_pont.publier_l_ecran(_ecran_publie)


## Ce que l'écran porte : ses boutons, et l'état de l'atelier, l'élément monté à chaque point
## (`montes`) et à chaque ligne de pièce (`lignes`) sous sa clé publiée, les erreurs (`_toutes_les_erreurs`), l'onglet
## montré, les onglets offerts (`_onglets_offerts`) et le défilement de son panneau (`defilement`), le cadre de la
## glissière de chaque axe `plage` à l'écran
## (`plages`, avec sa valeur), la composition courante avec ce que `composer` en a monté, ce qui y manque, le texte de
## son refus et celui de « Copier », les mesures du gabarit posé (`GabaritDuSquelette.mesures`), l'échelle de l'orbite
## (`cadre`), la position des os de la base (`_positions_des_os`), la boîte des meshes skinnés montés (`_peaux`), que
## la publication attend tant que le skin d'un mesh skinné monté n'a pas ses os au serveur de rendu, le bilan de la
## pile des couches que porte la fusion (`MontageDeComposition.pile_posee`), le véhicule posé (`_vehicule_publie`) et
## l'échantillon posé (`_echantillon_publie`) ; `null` tant que ces boîtes restent à mesurer.
func _ecran_publie() -> Variant:
	if _peaux_a_mesurer:
		var mesurees: Variant = _peaux()
		if mesurees == null:
			return null
		_peaux_mesurees = mesurees
		_peaux_a_mesurer = false
	var clip: Variant = _lecteur().assigned_animation if _a_un_clip() else null
	var publies := {montes = {}, lignes = {}}
	for id in _montage.montes:
		if _emplacements.has(id):
			publies[_emplacements[id].publie][_emplacements[id].cle] = _montage.montes[id]
		else:
			publies.montes[id] = _montage.montes[id]
	var plages := {}
	for champ in _selecteurs_d_axe:
		var glissiere := _selecteurs_d_axe[champ] as HSlider
		if glissiere == null or not glissiere.is_visible_in_tree():
			continue
		var cadre := glissiere.get_global_rect()
		if PontDuNoyau.a_l_ecran(glissiere, cadre.get_center()):
			plages[champ] = PontDuNoyau.glissiere_publiee(glissiere)
	return {
		boutons = PontDuNoyau.boutons_a_l_ecran([_interface]),
		atelier = {
			base = _montage.base.get("id"),
			empreinte = _montage.base.get("empreinte"),
			clip = clip,
			instant = _lecteur().current_animation_position if clip != null else null,
			duree = _lecteur().current_animation_length if clip != null else null,
			lecture = _lecteur().is_playing() if clip != null else false,
			vitesse = _vitesse,
			montes = publies.montes,
			lignes = publies.lignes,
			emblemes = _montage.emblemes,
			aides = _aides,
			erreurs = _toutes_les_erreurs(),
			onglet = _onglet,
			onglets = _onglets.keys().filter(func(onglet: StringName) -> bool: return _boutons_des_onglets[onglet].visible).map(func(onglet: StringName) -> String: return String(onglet)),
			defilement = _onglets[_onglet].scroll_vertical,
			plages = plages,
			composition = {
				courante = _composition,
				preset = _preset,
				montes = _montage.composee.get("montes", []),
				manquants = _montage.composee.get("manquants", []),
				morphes = _montage.composee.get("morphes", {}),
				palette = _montage.composee.get("palette", {}),
				refus = null if _refus_de_composition.is_empty() else _refus_de_composition,
				copie = %Entree.text,
			},
			gabarit = {} if _montage.gabarit == null else _montage.gabarit.mesures(),
			cadre = _marche.echelle(),
			os = _positions_des_os(),
			peaux = _peaux_mesurees,
			morphes = _morphes_des_meshes(),
			couleurs = _montage.couleurs_posees(),
			pile = _montage.pile_posee(),
			vehicule = _vehicule_publie(),
			echantillon = _echantillon_publie(),
		},
	}


## Ce que l'écran montre de l'échantillon demandé, `null` sans lui : sa famille, son id, et ce que sa scène a posé
## (`VolumeDeScene.ce_qui_est_pose`).
func _echantillon_publie() -> Variant:
	if _echantillon_demande == null:
		return null
	return _scene_de_l_echantillon.ce_qui_est_pose().merged(_echantillon_demande)


## Godot 4.7, Skeleton3D::_notification, NOTIFICATION_UPDATE_SKELETON, skeleton_updated.
func _memoriser_la_pose() -> void:
	var pose := {}
	for os in _montage.squelette.get_bone_count():
		pose[_montage.squelette.get_bone_name(os)] = _montage.squelette.get_bone_global_pose(os).origin
	_pose_des_os = pose


## CONTRAT.md, « Écran publié ».
func _positions_des_os() -> Dictionary:
	var positions := {}
	if _montage.squelette == null:
		return positions
	for os in _pose_des_os:
		positions[os] = _en_liste(_montage.squelette.to_global(_pose_des_os[os]))
	return positions


## Par id d'emplacement monté qui porte un mesh skinné, la boîte de ses meshes skinnés posés par le moteur sur la pose
## courante (`MeshInstance3D.bake_mesh_from_current_skeleton_pose`) : son centre monde (`centre`) et sa taille dans le
## repère du squelette (`taille`) ; `null` tant que le skin d'un mesh monté n'a pas d'os au serveur de rendu
## (`MeshInstance3D.get_skin_reference`, que le squelette pourvoit à sa prochaine mise à jour).
func _peaux() -> Variant:
	var peaux := {}
	for id in _montage.pieces:
		var boite: Variant = null
		var porteuse: MeshInstance3D = null
		for piece: MeshInstance3D in _montage.pieces[id]:
			if not is_instance_valid(piece) or piece.skin == null:
				continue
			var reference := piece.get_skin_reference()
			if reference == null or RenderingServer.skeleton_get_bone_count(reference.get_skeleton()) == 0:
				return null
			var posee := piece.bake_mesh_from_current_skeleton_pose().get_aabb()
			boite = posee if boite == null else (boite as AABB).merge(posee)
			porteuse = piece
		if porteuse != null:
			peaux[id] = {centre = _en_liste(porteuse.to_global((boite as AABB).get_center())), taille = _en_liste((boite as AABB).size)}
	return peaux


## CONTRAT.md, « Écran publié ».
func _morphes_des_meshes() -> Dictionary:
	var morphes := {corps = {}, montes = {}}
	if _montage.modele == null:
		return morphes
	var emplacements: Dictionary = {}
	for id in _montage.pieces:
		morphes.montes[id] = {}
		for piece: MeshInstance3D in _montage.pieces[id]:
			emplacements[piece] = id
	for noeud in _montage.modele.find_children("*", "MeshInstance3D", true, false):
		var mesh := noeud as MeshInstance3D
		if not mesh.has_meta(MontageDeComposition.POIDS):
			continue
		var poids: Dictionary = mesh.get_meta(MontageDeComposition.POIDS)
		var chemin := String(_montage.modele.get_path_to(mesh))
		if emplacements.has(mesh):
			morphes.montes[emplacements[mesh]][chemin] = poids
		else:
			morphes.corps[chemin] = poids
	return morphes


func _en_liste(vecteur: Vector3) -> Array[float]:
	return [vecteur.x, vecteur.y, vecteur.z]
