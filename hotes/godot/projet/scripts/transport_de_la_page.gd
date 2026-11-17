## Le noyau dans la page de l'export Web : `globalThis.wfrpPont` par JavaScriptBridge, attendu `ATTENTE_S` au plus ; chaque
## appel par `wfrpPont.appelerEnOctets`, les octets de sa réponse par `wfrpPont.octets` ; chaque valeur publiée en
## `globalThis.<nom>`, chaque rappel exposé en `globalThis.<nom>`, l'adresse et les paramètres lus à celle de la page
## (`?<cle>=<valeur>`), le fichier choisi par `wfrpPont.choisirUnFichier` (`hotes/godot/pont/fichier.ts`), celui remis
## au joueur téléchargé, la pile des couches résolue par `wfrpPont.resoudreLaPile` (`hotes/godot/pont/pileEnFond.ts`),
## chaque requête au serveur du jeu par `wfrpPont.telecharger` (`hotes/godot/pont/telechargement.ts`), son corps remis
## entier, car HTTPRequest n'y lit qu'un bloc du flux par image (`platform/web/js/libs/library_godot_fetch.js`,
## `godot_js_fetch_read_chunk`, Godot 4.7-stable ; #4402).
class_name TransportDeLaPage
extends PontDuNoyau.Transport

signal _pret

const INTERFACE := "wfrpPont"
const ATTENTE_S := 10.0
## Le verbe HTTP de chaque `HTTPClient.Method`, à son rang.
const VERBES: PackedStringArray = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "TRACE", "CONNECT", "PATCH"]

var _pont: JavaScriptObject = null
## Les rappels que Godot expose à la page (`exposer`), par nom, retenus tant que la page peut les appeler.
var _exposes := {}


func _ready() -> void:
	get_tree().create_timer(ATTENTE_S).timeout.connect(_expirer)


func _process(_delta: float) -> void:
	_pont = JavaScriptBridge.get_interface(INTERFACE)
	if _pont != null:
		set_process(false)
		_pret.emit()


func _expirer() -> void:
	if _pont == null:
		set_process(false)
		panne.emit("globalThis.%s reste absent après %s s : wfrp-pont.js n'est pas chargé." % [INTERFACE, ATTENTE_S])


func ouvrir() -> bool:
	if _pont == null:
		await _pret
	return true


func est_ouvert() -> bool:
	return _pont != null


func appeler(methode: String, json: Variant) -> Variant:
	return _pont.call("appelerEnOctets", methode, json)


func octets() -> PackedByteArray:
	return JavaScriptBridge.js_buffer_to_packed_byte_array(_pont.call("octets"))


func resoudre_la_pile(demande: String) -> Variant:
	var rendue := []
	var rappel := JavaScriptBridge.create_callback(func(args: Array) -> void: rendue.append_array(args))
	_pont.call("resoudreLaPile", demande, rappel)
	while rendue.is_empty():
		await get_tree().process_frame
	return rendue[0]


func publier(nom: String, valeur: Variant) -> void:
	JavaScriptBridge.eval("globalThis.%s = %s" % [nom, JSON.stringify(valeur)], true)


func exposer(nom: String, rappel: Callable) -> void:
	_exposes[nom] = JavaScriptBridge.create_callback(func(args: Array) -> void:
		rappel.call(str(args[0]), func(reponse: String) -> void: (args[1] as JavaScriptObject).call("call", null, reponse)))
	JavaScriptBridge.get_interface("window").set(nom, _exposes[nom])


func adresse(relative: String) -> String:
	return str(JavaScriptBridge.eval("new URL(%s, location.href).href" % JSON.stringify(relative), true))


func requeter(relative: String, recueil: Array[String], methode: HTTPClient.Method, corps: String, entetes: PackedStringArray) -> PackedByteArray:
	await ouvrir()
	var rendue := []
	var rappel := JavaScriptBridge.create_callback(func(args: Array) -> void: rendue.append_array(args))
	_pont.call("telecharger", adresse(relative), VERBES[methode], corps, JSON.stringify(entetes), PontDuNoyau.SILENCE_S, rappel)
	while rendue.is_empty():
		await get_tree().process_frame
	var recu := JavaScriptBridge.js_buffer_to_packed_byte_array(rendue[2])
	match str(rendue[0]):
		"silence":
			recueil.append("requete-silencieuse : %s (aucun octet en %s s, %s reçus)" % [relative, PontDuNoyau.SILENCE_S, recu.size()])
			return PackedByteArray()
		"echec":
			recueil.append("requete-echouee : %s (%s)" % [relative, rendue[3]])
			return PackedByteArray()
	if int(rendue[1]) != 200:
		var raison := recu.get_string_from_utf8()
		recueil.append("requete-echouee : %s (HTTP %s)%s" % [relative, int(rendue[1]), " : " + raison if raison != "" else ""])
		return PackedByteArray()
	return recu


func choisir_un_fichier(genre: Dictionary) -> Dictionary:
	var rendue := []
	var rappel := JavaScriptBridge.create_callback(func(args: Array) -> void: rendue.append_array(args))
	_pont.call("choisirUnFichier", genre.accepte, rappel)
	while rendue.is_empty():
		await get_tree().process_frame
	return {} if str(rendue[0]) == "" else {octets = Marshalls.base64_to_raw(str(rendue[0])), type = str(rendue[1])}


func enregistrer_un_fichier(genre: Dictionary, nom: String, texte: String) -> void:
	JavaScriptBridge.download_buffer(texte.to_utf8_buffer(), nom, genre.type)


func parametre(cle: String) -> String:
	return str(JavaScriptBridge.eval("new URLSearchParams(location.search).get(%s) ?? ''" % JSON.stringify(cle), true))
