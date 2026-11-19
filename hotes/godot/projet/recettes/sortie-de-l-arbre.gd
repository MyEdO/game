extends SceneTree

## Un combattant sorti de l'arbre pendant qu'une lecture de modèle attend le pont (#4195) : sur le pont figé de l'atelier
## (`PontFige`, `hotes/godot/recettes/atelier.ts`, `figerLeRepos`) dont chaque requête attend qu'on la relâche, un vrai
## `Combattant`, dans la scène courante, vêtu de la base humanoïde portant une hallebarde, la scène changée
## (`SceneTree.change_scene_to_node`, qui la sort aussitôt de l'arbre) avant la réponse, une fois quand la base est en
## lecture, une fois quand l'élément l'est ; un combattant sans corps sur un véhicule (`Combattant.montrer`,
## `MontageDeVehicule`) quand l'élément du véhicule l'est ; des modèles posés (`MontageDesModeles`) dont le navire posé
## change de corps et de centre, quand la pièce de son poste l'est ; des modèles posés dont les poses d'un même décor
## attendent la seule lecture de son modèle ; le volume de modèles posés dont une arête attend la lecture du modèle
## d'arête de sa famille (`VolumeDeScene.poser_les_aretes`) ; l'éditeur ouvert (`scripts/editeur.gd`, sur le figé de
## `recettes/editeur-navire.gd`) quand un dépôt s'écrit au pont ; le Compendium ouvert (`scripts/panneau_du_compendium.gd`)
## quand ses données s'écrivent au dépôt. Relâchée, la requête ne poursuit rien sur eux : aucune
## requête ni aucun appel de plus au pont, aucun `habille`, `pose` ni `aretes_posees`, aucune erreur du moteur
## (comptée par `hotes/godot/construire.mjs`, `erreursDe`).

const RECETTE_AUTONOME := true
## La recette des arêtes au pied : les modèles posés d'un volume (`modeles_poses`).
const ARETE := preload("res://recettes/arete-au-pied.gd")
const FIGE := "res://recettes/vues/repos.json"
const FIGE_DE_L_EDITEUR := "res://recettes/vues/editeur-navire.json"
## Le fichier des calques que l'éditeur garde pour l'Arène : une ouverture sans lui envoie l'entrée figée.
const CALQUES_DE_L_ARENE := "user://calques/arene.json"
## Les zones vides du Compendium (`ZonesDuCompendium`), que sa réponse figée montre.
const ZONES_DU_COMPENDIUM := {"compendium.familles": [], "compendium.categories": [], "compendium.recherche": [], "compendium.liste": [], "compendium.fiche": [], "compendium.atelier": [], "compendium.etat": []}
## Les images au plus qu'attend l'éditeur ouvert.
const IMAGES_D_OUVERTURE := 600
const BASE := "humanoide"
const HALLEBARDE := "humanoide--rigide--hallebarde"
## Un véhicule dont l'élément est la base du figé, que `MontageDeVehicule` tire comme tout modèle.
const VEHICULE := {element = BASE, postes = [], ameliorations = [], palette = {}, clips = {}, caches = [], empreinte = 1, taille = "", cap = "N"}
## Les images laissées aux appels différés d'une reprise.
const IMAGES_APRES := 3
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[sortie-de-l-arbre] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[sortie-de-l-arbre] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.new(lu)
	pont.retient = true
	PontDuNoyau.remplacer(self, pont)
	await _sortir_en_lecture(pont, lu, "base")
	await _sortir_en_lecture(pont, lu, "élément")
	await _sortir_le_vehicule_en_lecture(pont, lu)
	await _sortir_les_navires_en_lecture(pont, lu)
	await _sortir_les_decors_en_lecture(pont, lu)
	await _sortir_les_aretes_en_lecture(pont, lu)
	await _sortir_l_editeur_en_ecriture()
	await _sortir_le_compendium_en_ecriture()
	for faute in _fautes:
		push_error("[sortie-de-l-arbre] " + faute)
	print("[sortie-de-l-arbre] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Les modèles du figé `lu` retenus à neuf, une scène courante neuve.
func _scene_neuve(lu: Dictionary) -> Node3D:
	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	var scene := Node3D.new()
	root.add_child(scene)
	current_scene = scene
	return scene


## Un combattant vêtu dans une scène neuve, celle-ci changée pendant la lecture `quoi` (la base, ou l'élément, la base
## relâchée dans l'arbre), puis la lecture relâchée.
func _sortir_en_lecture(pont: PontFige, lu: Dictionary, quoi: String) -> void:
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	_scene_neuve(lu).add_child(combattant)
	var habilles := [0]
	combattant.habille.connect(func() -> void: habilles[0] += 1)
	combattant.vetir({base = BASE, montes = [{ligne = "main", element = HALLEBARDE}]})
	if quoi == "élément":
		pont.relache.emit()
	await _sortir(pont, quoi, combattant, habilles)


## Un combattant sans corps montré sur `VEHICULE` dans une scène neuve, celle-ci changée pendant la lecture de son
## élément, puis la lecture relâchée.
func _sortir_le_vehicule_en_lecture(pont: PontFige, lu: Dictionary) -> void:
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	_scene_neuve(lu).add_child(combattant)
	var habilles := [0]
	combattant.habille.connect(func() -> void: habilles[0] += 1)
	combattant.montrer({id = "vehicule", nom = "vehicule", pb = [1, 1], horsCombat = false}, Vector3.ZERO, false, null, VEHICULE, 1.0)
	await _sortir(pont, "véhicule", combattant, habilles)


## Des modèles posés (`MontageDesModeles`, sur le volume d'un `Monde`) dans une scène neuve : un navire de corps
## `VEHICULE` posé au centre (0, 0), puis servi sous un corps qui porte la hallebarde à un poste et au centre (2, 0), la
## scène changée pendant la lecture de la hallebarde, puis la lecture relâchée.
func _sortir_les_navires_en_lecture(pont: PontFige, lu: Dictionary) -> void:
	var modeles := _modeles_poses(_scene_neuve(lu))
	var poses := [0]
	modeles.pose.connect(func() -> void: poses[0] += 1)
	modeles.poser({navire = {corps = VEHICULE, centre = {x = 0, y = 0}}}, {}, {}, 1.0)
	pont.relache.emit()
	if modeles.poses() != ["navire"]:
		_fautes.append("navires : le navire n'est pas posé dans l'arbre (%s)" % [modeles.poses()])
	modeles.poser({navire = {corps = VEHICULE.merged({postes = [{element = HALLEBARDE}]}, true), centre = {x = 2, y = 0}}}, {}, {}, 1.0)
	await _sortir(pont, "navires", modeles, poses)


## Des modèles posés dans une scène neuve : trois poses d'un décor dont l'élément est la base du figé, la scène changée
## pendant la lecture de son modèle, la seule requête de ses trois montages (`_sortir`), puis la lecture relâchée.
func _sortir_les_decors_en_lecture(pont: PontFige, lu: Dictionary) -> void:
	var modeles := _modeles_poses(_scene_neuve(lu))
	var poses := [0]
	modeles.pose.connect(func() -> void: poses[0] += 1)
	var foret := range(3).map(func(x: int) -> Dictionary: return {cle = "terrain/%d,0,0" % x, prop = "arbre", ancre = {x = x, y = 0}, cap = "S", piedM = 0.0, case = {x = x, y = 0, z = 0}})
	modeles.poser({}, {arbre = {element = BASE, palette = {}, caches = [], poses = foret}}, {}, 1.0)
	await _sortir(pont, "décors", modeles, poses)


## Des modèles posés dans une scène neuve, les modèles retenus servant la base du figé pour modèle d'arête d'une
## famille : leur volume pose une arête de cette famille, qui n'est pas posée pendant la lecture de ce modèle, la scène
## changée pendant cette lecture, puis la lecture relâchée ; qui attendait les arêtes (`attendre_les_aretes`) est rendu
## à la sortie, sans que `aretes_posees` soit émis à ceux qui l'écoutent (l'atelier, le combat, l'éditeur), ni à la
## sortie ni après.
func _sortir_les_aretes_en_lecture(pont: PontFige, lu: Dictionary) -> void:
	var volume := _modeles_poses(_scene_neuve(lu)).volume
	MontageDeComposition.modeles = lu.modeles.merged({aretes = {colombage = BASE}}, true)
	var posees := [0]
	volume.aretes_posees.connect(func() -> void: posees[0] += 1)
	var rendue := [false]
	var attendre := func() -> void:
		await volume.attendre_les_aretes()
		rendue[0] = true
	volume.poser_les_aretes([{cle = "mur", famille = "colombage", palette = {}, piece = Noyau.Piece.MUR,
		position = Noyau.Position.SEULE, bloc = "0/0/0",
		pied = 0.0, hauteurM = 4.0, milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, cases = []}])
	if not volume.aretes_en_lecture() or volume.ce_qui_est_pose().aretes != 0:
		_fautes.append("arêtes : modèle en lecture %s, %d arêtes posées, attendu en lecture et aucune posée"
			% [volume.aretes_en_lecture(), volume.ce_qui_est_pose().aretes])
	attendre.call()
	await _sortir(pont, "arêtes", volume, posees)
	if not rendue[0]:
		_fautes.append("arêtes : qui attendait les arêtes attend encore après la sortie de l'arbre")


## Des modèles posés (`MontageDesModeles`) sur le volume d'un `Monde`, sous `scene`, avec leur chargeur
## (`ARETE.modeles_poses`).
func _modeles_poses(scene: Node3D) -> MontageDesModeles:
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	scene.add_child(monde)
	return ARETE.modeles_poses(monde.volume, scene)


## L'éditeur ouvert sur le figé de `FIGE_DE_L_EDITEUR` sous un pont retenu qui ne retient rien, son écran publié
## (`IMAGES_APRES`), puis le dépôt d'une réponse de `editer` (`depot`, `_deposer`) écrit au pont, la scène changée pendant l'écriture, puis l'écriture relâchée.
func _sortir_l_editeur_en_ecriture() -> void:
	if FileAccess.file_exists(CALQUES_DE_L_ARENE):
		DirAccess.remove_absolute(CALQUES_DE_L_ARENE)
	var pont := PontFige.new(JSON.parse_string(FileAccess.get_file_as_string(FIGE_DE_L_EDITEUR)))
	PontDuNoyau.remplacer(self, pont)
	var editeur: Node = (load("res://scenes/Editeur.tscn") as PackedScene).instantiate()
	root.add_child(editeur)
	current_scene = editeur
	for i in IMAGES_D_OUVERTURE:
		if not editeur.get("_vue").is_empty():
			break
		await process_frame
	if editeur.get("_vue").is_empty():
		_fautes.append("éditeur : l'Arène n'est pas ouverte")
		return
	for i in IMAGES_APRES:
		await process_frame
	pont.retient = true
	editeur._deposer({id = "arene", texte = "{}"})
	await _sortir(pont, "éditeur", editeur, [0])


## Le Compendium ouvert sur un pont figé qui ne sert que son ouverture, puis des données à écrire au dépôt.
func _sortir_le_compendium_en_ecriture() -> void:
	var pont := PontFige.new({compendium = {JSON.stringify({ouvrir = true}): {ok = true, zones = ZONES_DU_COMPENDIUM}}})
	PontDuNoyau.remplacer(self, pont)
	var compendium: Node = (load("res://scenes/Compendium.tscn") as PackedScene).instantiate()
	root.add_child(compendium)
	current_scene = compendium
	var panneau: PanneauDuCompendium = compendium.get_node("Panneau")
	for i in IMAGES_D_OUVERTURE:
		if not panneau.vues().is_empty():
			break
		await process_frame
	if panneau.vues().is_empty():
		_fautes.append("compendium : il ne s'est pas ouvert")
		return
	pont.retient = true
	panneau._suivre({ok = true, zones = ZONES_DU_COMPENDIUM, donnees = {fichier = "talents.json", texte = "{}", avant = 1}})
	await _sortir(pont, "compendium", compendium, [0])


## La scène courante changée pendant la seule requête en attente au pont, `porteur` sorti de l'arbre, puis la requête
## relâchée : `porteur` ne requête plus rien, n'appelle plus le pont et ne signale plus rien (`signales`, compté depuis le changement).
func _sortir(pont: PontFige, quoi: String, porteur: Node, signales: Array) -> void:
	if pont.retenues != 1:
		_fautes.append("%s : %d requête(s) en attente au pont, 1 attendue" % [quoi, pont.retenues])
	var requetes := pont.demandes.size()
	var appels := pont.entrees.size()
	signales[0] = 0
	change_scene_to_node(Node.new())
	if porteur.is_inside_tree():
		_fautes.append("%s : le porteur est encore dans l'arbre après le changement de scène" % quoi)
	pont.relache.emit()
	for i in IMAGES_APRES:
		await process_frame
	print("[sortie-de-l-arbre] %s : requêtes après la sortie %s, appels %s, signalé %d" % [quoi, pont.demandes.slice(requetes), pont.entrees.slice(appels), signales[0]])
	if pont.demandes.size() != requetes:
		_fautes.append("%s : le porteur sorti de l'arbre requête encore %s" % [quoi, pont.demandes.slice(requetes)])
	if pont.entrees.size() != appels:
		_fautes.append("%s : le porteur sorti de l'arbre appelle encore le pont %s" % [quoi, pont.entrees.slice(appels)])
	if signales[0] != 0:
		_fautes.append("%s : le porteur sorti de l'arbre signale encore (%d fois)" % [quoi, signales[0]])
