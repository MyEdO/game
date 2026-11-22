## Les textures importées que préparent et tiennent les porteurs de matière, un lot par besoin.
class_name TexturesDeMatiere
extends Node

## Nombre maximal de lectures groupées consécutives sur une image Web.
const LECTURES_GROUPEES_PAR_IMAGE := 5


class Lecture extends RefCounted:
	var terminee := false
	var grouper_sur_web := false
	var texture: Texture2D


var _en_vol: Dictionary[String, Lecture] = {}


func _ready() -> void:
	set_process(false)


## La texture déjà tenue à ce chemin. Le cache de Godot la connaît tant qu'un porteur la référence.
static func retenue(chemin: String) -> Texture2D:
	return ResourceLoader.get_cached_ref(chemin) as Texture2D


## Les chemins d'une matière, y compris sa variante neutre si une palette ou la couleur de ses sommets la teint.
static func chemins_de(matiere: String, neutre: bool) -> PackedStringArray:
	var chemins := PackedStringArray([VolumeDeScene.texture_de(matiere), VolumeDeScene.relief_de(matiere)])
	if neutre:
		chemins.append(VolumeDeScene.texture_neutre_de(matiere))
	return chemins


## Par chemin, les textures présentes des matières demandées (chaque nom à vrai si sa variante neutre sert,
## `chemins_de`).
static func preparer(hote: Node, matieres: Dictionary, grouper_sur_web := false) -> Dictionary:
	var chemins := PackedStringArray()
	for matiere: String in matieres:
		chemins.append_array(chemins_de(matiere, matieres[matiere]))
	return await preparer_les_chemins(hote, chemins, grouper_sur_web)


## Par chemin, les textures présentes parmi `chemins`.
## Le lot rendu tient les textures jusqu'à leur pose ou tant que le porteur les utilise.
## Sur le Web, les lectures consécutives des lots groupés peuvent partager une image.
static func preparer_les_chemins(hote: Node, chemins: PackedStringArray, grouper_sur_web := false) -> Dictionary:
	if chemins.is_empty():
		return {}
	var chargeur := hote.get_node("/root/Textures") as TexturesDeMatiere
	return await chargeur._preparer(chemins, grouper_sur_web)


func _preparer(chemins: PackedStringArray, grouper_sur_web: bool) -> Dictionary:
	var textures := {}
	var attendues: Dictionary[String, Lecture] = {}
	for chemin: String in chemins:
		if not ResourceLoader.exists(chemin, "Texture2D"):
			continue
		var lecture: Lecture = _en_vol.get(chemin)
		if lecture == null:
			var texture := retenue(chemin)
			if texture != null:
				textures[chemin] = texture
				continue
			lecture = _demander(chemin)
		lecture.grouper_sur_web = lecture.grouper_sur_web or grouper_sur_web
		attendues[chemin] = lecture
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
		_lire_sur_web()
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


func _lire_sur_web() -> void:
	var premiere := true
	for chemin: String in _en_vol.keys().slice(0, LECTURES_GROUPEES_PAR_IMAGE):
		var groupee := _en_vol[chemin].grouper_sur_web
		if not premiere and not groupee:
			break
		_terminer(chemin, ResourceLoader.load(chemin, "Texture2D"))
		if not groupee:
			break
		premiere = false


func _terminer(chemin: String, ressource: Resource) -> void:
	var lecture := _en_vol[chemin]
	lecture.texture = ressource as Texture2D
	lecture.terminee = true
	_en_vol.erase(chemin)
	if lecture.texture == null:
		push_warning("[textures] texture-illisible : %s" % chemin)
