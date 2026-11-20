## La scène de démarrage (`run/main_scene`) prépare le catalogue des textures de matière, puis ouvre l'accueil.
## Dans la page, elle monte d'abord chaque paquet nommé par `paquets.json` (`PAQUETS_DU_WEB`, #4402). Les fichiers du
## paquet remplacent ceux de même chemin, dont `.godot/uid_cache.bin` qui porte ses UID. Une panne s'affiche à l'écran.
extends CenterContainer

const LISTE := "paquets.json"
const ACCUEIL := "res://scenes/Accueil.tscn"

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _etat: Label = $Etat


func _ready() -> void:
	var recueil: Array[String] = []
	if OS.has_feature("web"):
		await _monter_les_paquets(recueil)
	if recueil.is_empty():
		var textures := get_node("/root/Textures") as TexturesDeMatiere
		await textures.preparer(recueil)
	if not recueil.is_empty():
		push_error("[demarrage] ", "\n".join(recueil))
		_etat.text = "\n".join(recueil)
		return
	get_tree().change_scene_to_file(ACCUEIL)


func _monter_les_paquets(recueil: Array[String]) -> void:
	var lu := await _pont.requeter(LISTE, recueil)
	var noms: Variant = null if lu.is_empty() else JSON.parse_string(lu.get_string_from_utf8())
	if noms is Array:
		for nom: Variant in noms:
			if not await _charger(str(nom), recueil):
				break
	elif recueil.is_empty():
		recueil.append("paquets-illisibles : %s" % LISTE)


## Le paquet `nom` lu, écrit et chargé ; `false`, et une erreur à `recueil`, s'il ne l'est pas.
func _charger(nom: String, recueil: Array[String]) -> bool:
	var octets := await _pont.requeter("%s.pck" % nom, recueil)
	if octets.is_empty():
		return false
	var fichier := FileAccess.create_temp(FileAccess.WRITE, nom, "pck", true)
	if fichier == null:
		recueil.append("paquet-inecrit : %s (%s)" % [nom, error_string(FileAccess.get_open_error())])
		return false
	var chemin := fichier.get_path_absolute()
	fichier.store_buffer(octets)
	fichier.close()
	if not ProjectSettings.load_resource_pack(chemin):
		recueil.append("paquet-illisible : %s (%s)" % [nom, chemin])
		return false
	return true
