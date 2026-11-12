class_name TransportDuProcessus
extends PontDuNoyau.Transport

## @contrat Transport
## Hors d'une page, Godot lance `node <pont>` au premier `rejoindre` (`projet/scripts/transport_du_processus.gd`),
## `<pont>` le paramètre `--pont=<chemin>` du lancement, à défaut `hotes/godot/vivant.mjs`, par un tuyau bloquant.
## Il lui passe `--stockage=<fichier>`, le fichier où vivent les sauvegardes : le paramètre `--stockage=<fichier>` du
## lancement, à défaut `stockage.json` sous le dossier des données de l'utilisateur (`user://`).
## Une ligne se termine par `\n`. Son entrée standard reçoit une ligne par requête, `[methode, json|null]`.
## Sa sortie standard porte d'abord la ligne d'annonce `{"url":"http://127.0.0.1:<port>/"}`,
## l'adresse du serveur du jeu, attendue `ATTENTE_S` au plus, puis une réponse par requête.
## Une réponse est la chaîne que rend `wfrpPont.appelerEnOctets(methode, json)`, sur sa ligne.
## Si `wfrpPont.octets()` en porte, elle vient en trois temps : la ligne `octets <n>`,
## la ligne JSON, puis les `n` octets bruts, sans fin de ligne.
## Godot lit ces `n` octets avant de rendre la réponse à sa requête.
## La ligne `["resoudreLaPile", demande]` demande la pile des couches (`PileDemandee`, en JSON) ;
## sa réponse est la chaîne que `wfrpPont.resoudreLaPile` rend (`PileResolue`, en JSON).
## Godot l'attend image après image, sans bloquer.
## Les réponses sortent dans l'ordre des requêtes, pile comprise.
## Godot n'écrit aucune requête tant qu'un appel attend :
## les octets d'une réponse sont la fin de la sortie jusqu'à la requête suivante.
## Sa sortie d'erreur passe à celle de Godot.
## Sa mort, octets attendus compris, est une panne, qui dit son code de sortie.
## Le processus meurt quand le pont quitte l'arbre.
## Les paramètres sont ceux du lancement après `--` (`--<cle>=<valeur>`) ;
## l'image se choisit par le dialogue de fichier natif.

const ATTENTE_S := 60.0
## La pause entre deux lectures d'un tuyau vide, pendant l'attente d'une réponse.
const PAUSE_US := 200
## La ligne qui annonce les octets d'une réponse, suivie de leur nombre.
const ANNONCE_DES_OCTETS := "octets "
const TYPES := {png = "image/png", jpg = "image/jpeg", jpeg = "image/jpeg", webp = "image/webp"}

signal _ouvert(pret: bool)


## Un tuyau du processus, lu par lignes ou par octets sans jamais bloquer : `get_length()` puis `get_buffer(n)`, jamais
## `get_line`. Chaque octet reçu n'est cherché qu'une fois.
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
		_lire()
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

	## Les `n` octets qui suivent la dernière ligne, la fin du reçu ; `null` tant qu'ils ne sont pas tous arrivés.
	func octets(n: int) -> Variant:
		_lire()
		if _suite.size() != n:
			return null
		var lus := _suite
		_suite = PackedByteArray()
		return lus

	## Ce que le tuyau tient, ajouté à `_suite`.
	func _lire() -> void:
		var n := _fichier.get_length()
		if n != 0:
			_suite.append_array(_fichier.get_buffer(n))


var _pid := 0
## L'entrée du processus, le même fichier que sa sortie (`stdio`).
var _entree: FileAccess = null
var _sortie: Tuyau = null
var _erreurs: Tuyau = null
var _url := ""
var _mort := false
## Les réponses attendues, dans l'ordre des requêtes écrites : chacune un tableau vide que sa réponse remplit.
var _attendues: Array[Array] = []
## Le nombre d'octets qu'annonce la réponse en cours (`ANNONCE_DES_OCTETS`), `-1` hors d'une telle réponse.
var _taille := -1
## La ligne JSON de la réponse en cours dont les octets restent à lire.
var _entete: Variant = null
## Les octets de la dernière réponse qui en porte.
var _octets := PackedByteArray()


func _exit_tree() -> void:
	if _pid != 0 and not _mort and OS.is_process_running(_pid):
		OS.kill(_pid)


func ouvrir() -> bool:
	if _url != "" or _mort:
		return _url != ""
	if _pid != 0:
		return await _ouvert
	var pont := parametre("pont")
	var stockage := parametre("stockage")
	var lance := OS.execute_with_pipe("node", PackedStringArray([
		pont if pont != "" else ProjectSettings.globalize_path("res://../vivant.mjs"),
		"--stockage=" + (stockage if stockage != "" else ProjectSettings.globalize_path("user://stockage.json")),
	]), true)
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
		annonce = _lire(_sortie.ligne)
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


func octets() -> PackedByteArray:
	return _octets


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


## Chaque réponse reçue rendue à la plus ancienne requête sans réponse ; `false` si le processus est mort.
func _recevoir() -> bool:
	var lue: Variant = _reponse()
	while lue != null:
		_attendues.pop_front().append(lue)
		lue = _reponse()
	return not _mort


## La prochaine réponse de la sortie : sa ligne, ou, après `ANNONCE_DES_OCTETS`, la ligne JSON une fois ses octets lus
## dans `_octets` ; `null` tant qu'elle est incomplète ou si le processus est mort.
func _reponse() -> Variant:
	if _taille == -1:
		var lue: Variant = _lire(_sortie.ligne)
		if lue == null or not lue.begins_with(ANNONCE_DES_OCTETS):
			return lue
		_taille = lue.trim_prefix(ANNONCE_DES_OCTETS).to_int()
	if _entete == null:
		_entete = _lire(_sortie.ligne)
		if _entete == null:
			return null
	var lus: Variant = _lire(_sortie.octets.bind(_taille))
	if lus == null:
		return null
	_octets = lus
	var entete: Variant = _entete
	_taille = -1
	_entete = null
	return entete


## Ce que `lecture` tire de la sortie, `null` tant que c'est incomplet ou si le processus est mort ; la sortie d'erreur
## transmise ; le processus mort sans rien à lire, sa panne signalée.
func _lire(lecture: Callable) -> Variant:
	if _mort:
		return null
	var vivant := OS.is_process_running(_pid)
	_transmettre_les_erreurs()
	var lu: Variant = lecture.call()
	if lu == null and not vivant:
		_mourir("le processus du pont s'est arrêté (code %s)" % OS.get_process_exit_code(_pid))
	return lu


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
