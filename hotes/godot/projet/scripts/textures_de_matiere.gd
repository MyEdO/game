## Le catalogue des textures de matière que `Demarrage` prépare et que les poses consultent pendant toute la partie.
class_name TexturesDeMatiere
extends Node

const DOSSIER := "res://textures"
static var _textures: Dictionary[String, Texture2D] = {}


## Les recettes lancées directement instancient les scènes depuis leur propre boucle principale.
func _ready() -> void:
	var boucle := get_tree().get_script() as Script
	if boucle != null and boucle.resource_path.begins_with("res://recettes/"):
		var recueil: Array[String] = []
		await preparer(recueil, true)
		for erreur in recueil:
			push_error(erreur)


## La texture retenue à ce chemin, ou `null` si le catalogue ne la porte pas.
static func retenue(chemin: String) -> Texture2D:
	return _textures.get(chemin)


## Remplit le catalogue après montage des paquets. Le gabarit Web sans threads répartit les lectures entre les images.
func preparer(recueil: Array[String], synchrone := false) -> void:
	if not _textures.is_empty():
		return
	var chemins := PackedStringArray()
	for fichier: String in ResourceLoader.list_directory(DOSSIER):
		if fichier.ends_with(".jpg"):
			chemins.append(DOSSIER.path_join(fichier))
	if chemins.is_empty():
		recueil.append("catalogue-de-textures-vide : %s" % DOSSIER)
		return
	chemins.sort()
	var lues: Dictionary[String, Texture2D] = {}
	if synchrone or OS.has_feature("web"):
		for chemin: String in chemins:
			if not synchrone:
				await get_tree().process_frame
			_retenir(chemin, ResourceLoader.load(chemin, "Texture2D"), lues, recueil)
	else:
		await _preparer_en_fond(chemins, lues, recueil)
	if recueil.is_empty():
		_textures = lues


func _preparer_en_fond(chemins: PackedStringArray, lues: Dictionary[String, Texture2D], recueil: Array[String]) -> void:
	var demandes := {}
	for chemin: String in chemins:
		var code := ResourceLoader.load_threaded_request(chemin, "Texture2D")
		if code == OK:
			demandes[chemin] = true
		else:
			recueil.append("texture-illisible : %s (%s)" % [chemin, error_string(code)])
	while not demandes.is_empty():
		await get_tree().process_frame
		for chemin: String in demandes.keys():
			var statut := ResourceLoader.load_threaded_get_status(chemin)
			if statut == ResourceLoader.THREAD_LOAD_IN_PROGRESS:
				continue
			demandes.erase(chemin)
			var texture: Resource = null
			if statut in [ResourceLoader.THREAD_LOAD_LOADED, ResourceLoader.THREAD_LOAD_FAILED]:
				texture = ResourceLoader.load_threaded_get(chemin)
			_retenir(chemin, texture, lues, recueil)


static func _retenir(chemin: String, ressource: Resource, lues: Dictionary[String, Texture2D], recueil: Array[String]) -> void:
	var texture := ressource as Texture2D
	if texture == null:
		recueil.append("texture-illisible : %s" % chemin)
	else:
		lues[chemin] = texture
