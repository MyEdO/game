## Les textures importées que préparent et tiennent les porteurs de matière, un lot par besoin.
class_name TexturesDeMatiere
extends Node


class Lecture extends RefCounted:
	var terminee := false
	var texture: Texture2D


var _en_vol: Dictionary[String, Lecture] = {}


func _ready() -> void:
	set_process(false)


## La texture déjà tenue à ce chemin. Le cache de Godot la connaît tant qu'un porteur la référence.
static func retenue(chemin: String) -> Texture2D:
	return ResourceLoader.get_cached_ref(chemin) as Texture2D


## Les chemins d'une matière, y compris sa variante neutre si une palette peut la teinter.
static func chemins_de(matiere: String, neutre: bool) -> PackedStringArray:
	var chemins := PackedStringArray([VolumeDeScene.texture_de(matiere), VolumeDeScene.relief_de(matiere)])
	if neutre:
		chemins.append(VolumeDeScene.texture_neutre_de(matiere))
	return chemins


## Par chemin, les textures présentes des matières demandées (chaque nom à vrai si sa variante neutre sert).
## Le lot rendu tient les textures jusqu'à leur pose ou tant que le porteur les utilise.
static func preparer(hote: Node, matieres: Dictionary) -> Dictionary:
	if matieres.is_empty():
		return {}
	var chargeur := hote.get_node("/root/Textures") as TexturesDeMatiere
	return await chargeur._preparer(matieres)


func _preparer(matieres: Dictionary) -> Dictionary:
	var textures := {}
	var attendues: Dictionary[String, Lecture] = {}
	for matiere: String in matieres:
		var chemins := chemins_de(matiere, matieres[matiere])
		if not ResourceLoader.exists(chemins[0], "Texture2D"):
			continue
		for chemin: String in chemins:
			if not ResourceLoader.exists(chemin, "Texture2D"):
				continue
			if _en_vol.has(chemin):
				attendues[chemin] = _en_vol[chemin]
				continue
			var texture := retenue(chemin)
			if texture == null:
				attendues[chemin] = _demander(chemin)
			else:
				textures[chemin] = texture
	var arbre := get_tree()
	while not attendues.is_empty():
		await arbre.process_frame
		for chemin: String in attendues.keys():
			var lecture := attendues[chemin]
			if lecture.terminee:
				if lecture.texture != null:
					textures[chemin] = lecture.texture
				attendues.erase(chemin)
	return textures


func _demander(chemin: String) -> Lecture:
	var lecture := Lecture.new()
	if not OS.has_feature("web") and ResourceLoader.load_threaded_request(chemin, "Texture2D") != OK:
		lecture.terminee = true
		push_warning("[textures] texture-illisible : %s" % chemin)
		return lecture
	_en_vol[chemin] = lecture
	set_process(true)
	return lecture


func _process(_delta: float) -> void:
	if OS.has_feature("web"):
		var chemin: String = _en_vol.keys().front()
		_terminer(chemin, ResourceLoader.load(chemin, "Texture2D"))
	else:
		for chemin: String in _en_vol.keys():
			var statut := ResourceLoader.load_threaded_get_status(chemin)
			if statut != ResourceLoader.THREAD_LOAD_IN_PROGRESS:
				var ressource: Resource = null
				if statut in [ResourceLoader.THREAD_LOAD_LOADED, ResourceLoader.THREAD_LOAD_FAILED]:
					ressource = ResourceLoader.load_threaded_get(chemin)
				_terminer(chemin, ressource)
	if _en_vol.is_empty():
		set_process(false)


func _terminer(chemin: String, ressource: Resource) -> void:
	var lecture := _en_vol[chemin]
	lecture.texture = ressource as Texture2D
	lecture.terminee = true
	_en_vol.erase(chemin)
	if lecture.texture == null:
		push_warning("[textures] texture-illisible : %s" % chemin)
