extends SceneTree

## Un combattant sorti de l'arbre pendant qu'une lecture de modèle attend le pont (#4195) : sur le pont figé de l'atelier
## (`PontFige`, `hotes/godot/recettes/atelier.ts`, `figerLeRepos`) dont chaque requête attend qu'on la relâche, un vrai
## `Combattant`, dans la scène courante, vêtu de la base humanoïde portant une hallebarde, la scène changée
## (`SceneTree.change_scene_to_node`, qui la sort aussitôt de l'arbre) avant la réponse, une fois quand la base est en
## lecture, une fois quand l'élément l'est. Relâchée, la lecture ne poursuit rien sur lui : aucune requête de plus au
## pont, aucun `habille`, aucune erreur du moteur (comptée par `hotes/godot/construire.mjs`, `erreursDe`).

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/repos.json"
const BASE := "humanoide"
const HALLEBARDE := "humanoide--rigide--hallebarde"
## Les images laissées aux appels différés d'une reprise.
const IMAGES_APRES := 3
var _fautes: Array[String] = []


## Le pont figé dont chaque requête attend `relache`.
class PontRetenu extends PontFige:
	signal relache
	var retenues := 0
	## Chaque chemin requêté, à sa demande.
	var demandes: Array[String] = []

	func _init(lu: Dictionary) -> void:
		super(lu)

	func requeter(relative: String, recueil: Array[String], _methode := HTTPClient.METHOD_GET, _corps := "") -> PackedByteArray:
		demandes.append(relative)
		retenues += 1
		await relache
		retenues -= 1
		return super(relative, recueil)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[sortie-de-l-arbre] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[sortie-de-l-arbre] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	var pont := PontRetenu.new(lu)
	PontDuNoyau.remplacer(self, pont)
	await _sortir_en_lecture(pont, lu, "base")
	await _sortir_en_lecture(pont, lu, "élément")
	for faute in _fautes:
		push_error("[sortie-de-l-arbre] " + faute)
	print("[sortie-de-l-arbre] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Les modèles du figé `lu` retenus à neuf, un combattant vêtu dans une scène courante neuve, celle-ci changée pendant
## la lecture `quoi` (la base, ou l'élément, la base relâchée dans l'arbre), puis la lecture relâchée.
func _sortir_en_lecture(pont: PontRetenu, lu: Dictionary, quoi: String) -> void:
	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	var scene := Node3D.new()
	root.add_child(scene)
	current_scene = scene
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	scene.add_child(combattant)
	var habilles := [0]
	combattant.habille.connect(func() -> void: habilles[0] += 1)
	combattant.vetir({base = BASE, montes = [{ligne = "main", element = HALLEBARDE}]})
	if quoi == "élément":
		pont.relache.emit()
	if pont.retenues != 1:
		_fautes.append("%s : %d requête(s) en attente au pont, 1 attendue" % [quoi, pont.retenues])
	var requetes := pont.demandes.size()
	habilles[0] = 0
	change_scene_to_node(Node.new())
	if combattant.is_inside_tree():
		_fautes.append("%s : le combattant est encore dans l'arbre après le changement de scène" % quoi)
	pont.relache.emit()
	for i in IMAGES_APRES:
		await process_frame
	print("[sortie-de-l-arbre] %s en lecture : requêtes après la sortie %s, habille %d" % [quoi, pont.demandes.slice(requetes), habilles[0]])
	if pont.demandes.size() != requetes:
		_fautes.append("%s : le combattant sorti de l'arbre requête encore %s" % [quoi, pont.demandes.slice(requetes)])
	if habilles[0] != 0:
		_fautes.append("%s : le combattant sorti de l'arbre émet habille (%d fois)" % [quoi, habilles[0]])
