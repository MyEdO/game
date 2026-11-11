class_name TransportDuProcessus
extends PontDuNoyau.Transport

## @contrat Transport
## Hors d'une page, Godot lance `node <pont>` au premier `rejoindre` (`projet/scripts/transport_du_processus.gd`),
## `<pont>` le paramètre `--pont=<chemin>` du lancement, à défaut `hotes/godot/vivant.mjs`, par un tuyau bloquant.
## La sortie standard du processus est faite de lignes terminées par `\n` : d'abord l'annonce `{"url":"http://127.0.0.1:<port>/"}`,
## l'adresse du serveur du jeu, attendue `ATTENTE_S` au plus, puis une ligne par requête, la chaîne que rend
## `wfrpPont.appeler(methode, json)`. Son entrée standard reçoit une ligne par requête, `[methode, json|null]`. Sa sortie
## d'erreur passe à celle de Godot ; sa mort est une panne, qui dit son code de sortie. Le processus meurt quand le
## pont quitte l'arbre. Les paramètres sont ceux du lancement après `--` (`--<cle>=<valeur>`) ;
## l'image se choisit par le dialogue de fichier natif.

const ATTENTE_S := 60.0
## La pause entre deux lectures d'un tuyau vide, pendant l'attente d'une réponse.
const PAUSE_US := 200
const TYPES := {png = "image/png", jpg = "image/jpeg", jpeg = "image/jpeg", webp = "image/webp"}

signal _ouvert(pret: bool)


## Un tuyau du processus, lu par lignes sans jamais bloquer : `get_length()` puis `get_buffer(n)`, jamais `get_line`.
class Tuyau:
	var _fichier: FileAccess
	## Ce que le tuyau a livré au-delà de la dernière ligne détachée.
	var _recu := PackedByteArray()

	func _init(fichier: FileAccess) -> void:
		_fichier = fichier

	## La première ligne complète, sans son `\n`, `null` si elle n'est pas encore là.
	func ligne() -> Variant:
		var n := _fichier.get_length()
		if n != 0:
			_recu.append_array(_fichier.get_buffer(n))
		var fin := _recu.find(10)
		if fin == -1:
			return null
		var lue := _recu.slice(0, fin).get_string_from_utf8()
		_recu = _recu.slice(fin)
		_recu.remove_at(0)
		return lue


var _pid := 0
## L'entrée du processus, le même fichier que sa sortie (`stdio`).
var _entree: FileAccess = null
var _sortie: Tuyau = null
var _erreurs: Tuyau = null
var _url := ""
var _mort := false


func _exit_tree() -> void:
	if _pid != 0 and not _mort and OS.is_process_running(_pid):
		OS.kill(_pid)


func ouvrir() -> bool:
	if _url != "" or _mort:
		return _url != ""
	if _pid != 0:
		return await _ouvert
	var pont := parametre("pont")
	var lance := OS.execute_with_pipe("node", PackedStringArray([pont if pont != "" else ProjectSettings.globalize_path("res://../vivant.mjs")]), true)
	if lance.is_empty():
		_mort = true
		panne.emit("node ne se lance pas : est-il sur le PATH ?")
		return false
	_pid = lance.pid
	_entree = lance.stdio
	_sortie = Tuyau.new(_entree)
	_erreurs = Tuyau.new(lance.stderr)
	get_tree().create_timer(ATTENTE_S).timeout.connect(_expirer)
	var annonce: Variant = null
	while annonce == null and not _mort:
		await get_tree().process_frame
		annonce = _ligne()
	if annonce != null:
		var lue: Variant = JSON.parse_string(annonce)
		if lue is Dictionary and lue.get("url") is String:
			_url = lue.url
		else:
			_mourir("annonce illisible du processus du pont : %s" % str(annonce).left(200))
	_ouvert.emit(_url != "")
	return _url != ""


func appeler(methode: String, json: Variant) -> Variant:
	if _mort:
		return null
	_entree.store_line(JSON.stringify([methode, json]))
	var reponse: Variant = _ligne()
	while reponse == null and not _mort:
		OS.delay_usec(PAUSE_US)
		reponse = _ligne()
	return reponse


func publier_l_ecran(_publie: Dictionary) -> void:
	pass


func exposer(_nom: String, _rappel: Callable) -> void:
	pass


func adresse(relative: String) -> String:
	return "%s%s" % [_url, relative]


func choisir_une_image() -> Dictionary:
	var dialogue := FileDialog.new()
	dialogue.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialogue.access = FileDialog.ACCESS_FILESYSTEM
	dialogue.use_native_dialog = true
	dialogue.filters = PackedStringArray(["*.png, *.jpg, *.jpeg, *.webp ; Images PNG, JPEG ou WebP"])
	var choisi := []
	dialogue.file_selected.connect(func(chemin: String) -> void: choisi.append(chemin))
	dialogue.canceled.connect(func() -> void: choisi.append(""))
	add_child(dialogue)
	dialogue.popup_centered_ratio()
	while choisi.is_empty():
		await get_tree().process_frame
	dialogue.queue_free()
	var type: String = TYPES.get(str(choisi[0]).get_extension().to_lower(), "")
	return {} if type == "" else {octets = FileAccess.get_file_as_bytes(choisi[0]), type = type}


func parametre(cle: String) -> String:
	var prefixe := "--%s=" % cle
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with(prefixe):
			return argument.trim_prefix(prefixe)
	return ""


func _expirer() -> void:
	if _url == "" and not _mort:
		_mourir("aucune annonce du processus du pont après %s s" % ATTENTE_S)


## La prochaine ligne de la sortie, `null` si elle n'est pas encore là ou si le processus est mort ; la sortie d'erreur
## transmise ; le processus mort sans ligne à lire, sa panne signalée.
func _ligne() -> Variant:
	if _mort:
		return null
	var vivant := OS.is_process_running(_pid)
	_transmettre_les_erreurs()
	var lue: Variant = _sortie.ligne()
	if lue == null and not vivant:
		_mourir("le processus du pont s'est arrêté (code %s)" % OS.get_process_exit_code(_pid))
	return lue


## Chaque ligne complète de la sortie d'erreur, passée à celle de Godot.
func _transmettre_les_erreurs() -> void:
	var lue: Variant = _erreurs.ligne()
	while lue != null:
		printerr("[pont] ", lue)
		lue = _erreurs.ligne()


func _mourir(message: String) -> void:
	_mort = true
	if OS.is_process_running(_pid):
		OS.kill(_pid)
	panne.emit(message)
