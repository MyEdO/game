## La scène de démarrage de la page (`run/main_scene.web`, #4402) : chaque paquet que nomme `paquets.json`
## (`PAQUETS_DU_WEB`, `hotes/godot/construire.mjs`) lu au serveur du jeu (`PontDuNoyau.requeter`), écrit dans un fichier
## temporaire hors de `user://` (`FileAccess.create_temp`) et chargé (`ProjectSettings.load_resource_pack`), ses
## fichiers à la place de ceux de même chemin, dont `.godot/uid_cache.bin`, qui porte les UID du paquet, puis
## l'accueil. Une panne montre les erreurs de son recueil et s'arrête là.
extends CenterContainer

const LISTE := "paquets.json"
const ACCUEIL := "res://scenes/Accueil.tscn"

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _etat: Label = $Etat


func _ready() -> void:
	var recueil: Array[String] = []
	var lu := await _pont.requeter(LISTE, recueil)
	var noms: Variant = null if lu.is_empty() else JSON.parse_string(lu.get_string_from_utf8())
	if noms is Array:
		for nom: Variant in noms:
			if not await _charger(str(nom), recueil):
				break
	elif recueil.is_empty():
		recueil.append("paquets-illisibles : %s" % LISTE)
	if not recueil.is_empty():
		push_error("[demarrage] ", "\n".join(recueil))
		_etat.text = "\n".join(recueil)
		return
	get_tree().change_scene_to_file(ACCUEIL)


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
