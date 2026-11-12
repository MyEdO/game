class_name PontFige
extends PontDuNoyau

## Le pont figé des recettes de l'atelier (`hotes/godot/recettes/atelier.ts`) : `catalogues`, `vitrine` et `modeles`
## rendent leur réponse figée, toute autre méthode la réponse figée sous `fige[<méthode>]` à la clé de son entrée
## (`JSON.stringify`), `modeles/listage.json` le listage figé et tout autre chemin le fichier du projet, rien s'il est
## absent (le dépôt de l'éditeur), chaque paramètre celui de `fige.parametres` ; il garde les entrées reçues hors de ces
## trois et les chemins requêtés. Il est en recette (`en_recette`) : chaque écran publié est retenu dans `ecran`.

var fige: Dictionary
var entrees: Array[String] = []
var requetes: Array[String] = []


func _init(lu: Dictionary) -> void:
	fige = lu
	en_recette = true


## Le pont figé `lu` posé à la place du pont de l'arbre (`/root/Pont`).
static func poser(arbre: SceneTree, lu: Dictionary) -> PontFige:
	var pont := PontFige.new(lu)
	PontDuNoyau.remplacer(arbre, pont)
	return pont


func rejoindre(_au_refus: Callable, _a_la_panne: Callable) -> bool:
	return true


func appeler(methode: String, entree: Variant = null) -> Dictionary:
	if methode in ["catalogues", "modeles", "vitrine"]:
		return fige[methode]
	var cle := JSON.stringify(entree)
	entrees.append(cle)
	return fige.get(methode, {}).get(cle, {ok = false, erreur = {categorie = "validation", message = "entrée non figée de %s : %s" % [methode, cle]}})


func requeter(relative: String, recueil: Array[String], _methode := HTTPClient.METHOD_GET, _corps := "") -> PackedByteArray:
	requetes.append(relative)
	if relative == "modeles/listage.json":
		return JSON.stringify(fige.listage).to_utf8_buffer()
	var chemin := "res://%s" % relative
	var octets := FileAccess.get_file_as_bytes(chemin) if FileAccess.file_exists(chemin) else PackedByteArray()
	if octets.is_empty():
		recueil.append("fichier absent : %s" % relative)
	return octets


func parametre(cle: String) -> String:
	return str(fige.get("parametres", {}).get(cle, ""))
