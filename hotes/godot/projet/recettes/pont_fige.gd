class_name PontFige
extends PontDuNoyau

## Le pont figé des recettes de l'atelier (`hotes/godot/recettes/atelier.ts`) : `catalogues` et `modeles` rendent leur
## réponse figée, toute autre méthode la réponse figée sous `fige[<méthode>]` à la clé de son entrée (`JSON.stringify`),
## `modeles/` le listage figé et `modeles/<fichier>` le fichier du projet ; il garde les entrées reçues hors de
## `catalogues` et `modeles`, et le dernier écran publié.

var fige: Dictionary
var entrees: Array[String] = []
var ecran: Dictionary = {}


func _init(lu: Dictionary) -> void:
	fige = lu


## Le pont figé `lu` posé à la place du pont de l'arbre (`/root/Pont`).
static func poser(arbre: SceneTree, lu: Dictionary) -> PontFige:
	var ancien := arbre.root.get_node_or_null("Pont")
	if ancien != null:
		arbre.root.remove_child(ancien)
		ancien.free()
	var pont := PontFige.new(lu)
	pont.name = "Pont"
	arbre.root.add_child(pont)
	return pont


func rejoindre(_au_refus: Callable, _a_la_panne: Callable) -> bool:
	return true


func appeler(methode: String, entree: Variant = null) -> Dictionary:
	if methode in ["catalogues", "modeles"]:
		return fige[methode]
	var cle := JSON.stringify(entree)
	entrees.append(cle)
	return fige.get(methode, {}).get(cle, {ok = false, erreur = {categorie = "validation", message = "entrée non figée de %s : %s" % [methode, cle]}})


func requeter(relative: String, recueil: Array[String], _methode := HTTPClient.METHOD_GET, _corps := "") -> PackedByteArray:
	if relative == "modeles/":
		return JSON.stringify(fige.listage).to_utf8_buffer()
	var octets := FileAccess.get_file_as_bytes("res://%s" % relative)
	if octets.is_empty():
		recueil.append("fichier absent : %s" % relative)
	return octets


func publier_l_ecran(publie: Dictionary) -> void:
	ecran = publie
