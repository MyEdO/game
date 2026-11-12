class_name TransportDuProcessus
extends PontDuNoyau.Transport

## @contrat Transport
## Hors d'une page, Godot lance le processus du pont au premier `rejoindre` (`projet/scripts/transport_du_processus.gd`,
## `_lancement`), par un tuyau bloquant : `node <pont>`, `<pont>` le paramètre `--pont=<chemin>` du lancement, à défaut
## `hotes/godot/vivant.mjs` sous l'éditeur ; dans un exécutable (#3951), `noyau/node` sur `noyau/vivant.mjs`, à côté de
## l'exécutable.
## La sortie standard du processus est faite de lignes terminées par `\n` : d'abord l'annonce `{"url":"http://127.0.0.1:<port>/"}`,
## l'adresse du serveur du jeu, attendue `ATTENTE_S` au plus, puis une ligne par requête, la chaîne que rend
## `wfrpPont.appeler(methode, json)`. Son entrée standard reçoit une ligne par requête, `[methode, json|null]`.
## La ligne `["resoudreLaPile", demande]` demande la pile des couches (`PileDemandee`, en JSON) ;
## sa réponse est la chaîne que `wfrpPont.resoudreLaPile` rend (`PileResolue`, en JSON).
## Godot l'attend image après image, sans bloquer.
## Les réponses sortent dans l'ordre des requêtes, pile comprise.
## Sa sortie d'erreur passe à celle de Godot ; sa mort est une panne, qui dit son code de sortie. Le processus meurt quand le
## pont quitte l'arbre. Les paramètres sont ceux du lancement après `--` (`--<cle>=<valeur>`) ;
## l'image se choisit par le dialogue de fichier natif.

const ATTENTE_S := 60.0
## La pause entre deux lectures d'un tuyau vide, pendant l'attente d'une réponse.
const PAUSE_US := 200
const TYPES := {png = "image/png", jpg = "image/jpeg", jpeg = "image/jpeg", webp = "image/webp"}

signal _ouvert(pret: bool)


## Un tuyau du processus, lu par lignes sans jamais bloquer : `get_length()` puis `get_buffer(n)`, jamais `get_line`.
## Chaque octet reçu n'est cherché qu'une fois.
class Tuyau:
	var _fichier: FileAccess
	## Le début de la ligne en cours, déjà cherché : il ne porte aucun `\n`.
	var _debut := PackedByteArray()
	## La suite livrée par le tuyau après `_debut`, où la fin de ligne reste à chercher.
	var _suite := PackedByteArray()

	func _init(fichier: FileAccess) -> void:
		_fichier = fichier

	## La première ligne complète, sans son `\n`, `null` tant qu'elle est incomplète.
	func ligne() -> Variant:
		var n := _fichier.get_length()
		if n != 0:
			_suite.append_array(_fichier.get_buffer(n))
		var fin := _suite.find(10)
		if fin == -1:
			_debut.append_array(_suite)
			_suite = PackedByteArray()
			return null
		_debut.append_array(_suite.slice(0, fin))
		var lue := _debut.get_string_from_utf8()
		_debut = PackedByteArray()
		_suite = _suite.slice(fin)
		_suite.remove_at(0)
		return lue


var _pid := 0
## L'entrée du processus, le même fichier que sa sortie (`stdio`).
var _entree: FileAccess = null
var _sortie: Tuyau = null
var _erreurs: Tuyau = null
var _url := ""
var _mort := false
## Les réponses attendues, dans l'ordre des requêtes écrites : chacune un tableau vide que sa ligne remplit.
var _attendues: Array[Array] = []


func _exit_tree() -> void:
	if _pid != 0 and not _mort and OS.is_process_running(_pid):
		OS.kill(_pid)


func ouvrir() -> bool:
	if _url != "" or _mort:
		return _url != ""
	if _pid != 0:
		return await _ouvert
	var lancement := _lancement()
	var lance := OS.execute_with_pipe(lancement[0], PackedStringArray([lancement[1]]), true)
	if lance.is_empty():
		_mort = true
		panne.emit("le processus du pont ne se lance pas : %s %s" % [lancement[0], lancement[1]])
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


func est_ouvert() -> bool:
	return _url != "" and not _mort


func appeler(methode: String, json: Variant) -> Variant:
	var reponse := _demander(methode, json)
	while reponse.is_empty() and _recevoir():
		OS.delay_usec(PAUSE_US)
	return null if reponse.is_empty() else reponse[0]


func resoudre_la_pile(demande: String) -> Variant:
	var reponse := _demander("resoudreLaPile", demande)
	while reponse.is_empty() and _recevoir():
		await get_tree().process_frame
	return null if reponse.is_empty() else reponse[0]


func publier(_nom: String, _valeur: Variant) -> void:
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


## Le binaire et le script du processus du pont : le `node` du PATH sur le paramètre `pont` s'il est donné, sinon, sous
## l'éditeur, sur le pont vivant du dépôt, à côté du projet ; dans un exécutable, ceux qu'il embarque à côté de lui.
func _lancement() -> PackedStringArray:
	var pont := parametre("pont")
	if pont != "":
		return PackedStringArray(["node", pont])
	if OS.has_feature("editor"):
		return PackedStringArray(["node", ProjectSettings.globalize_path("res://../vivant.mjs")])
	var noyau := OS.get_executable_path().get_base_dir().path_join("noyau")
	return PackedStringArray([noyau.path_join("node.exe" if OS.has_feature("windows") else "node"), noyau.path_join("vivant.mjs")])


func _expirer() -> void:
	if _url == "" and not _mort:
		_mourir("aucune annonce du processus du pont après %s s" % ATTENTE_S)


## La requête `methode` sur `json` écrite, sauf processus mort : le tableau que sa réponse remplira, en file des attendues.
func _demander(methode: String, json: Variant) -> Array:
	var reponse := []
	if not _mort:
		_entree.store_line(JSON.stringify([methode, json]))
		_attendues.append(reponse)
	return reponse


## Chaque ligne reçue rendue à la plus ancienne requête sans réponse ; `false` si le processus est mort.
func _recevoir() -> bool:
	var lue: Variant = _ligne()
	while lue != null:
		_attendues.pop_front().append(lue)
		lue = _ligne()
	return not _mort


## La prochaine ligne de la sortie, `null` tant qu'elle est incomplète ou si le processus est mort ; la sortie d'erreur
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
