## Le noyau dans la page de l'export Web : `globalThis.wfrpPont` par JavaScriptBridge, attendu `ATTENTE_S` au plus ; l'écran
## publié en `globalThis.wfrpEcran`, chaque rappel exposé en `globalThis.<nom>`, l'adresse et les paramètres lus à celle de
## la page (`?<cle>=<valeur>`), l'image choisie par `wfrpPont.choisirUneImage` (`hotes/godot/pont/fichier.ts`).
class_name TransportDeLaPage
extends PontDuNoyau.Transport

signal _pret

const INTERFACE := "wfrpPont"
const ATTENTE_S := 10.0

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


func appeler(methode: String, json: Variant) -> Variant:
	return _pont.call("appeler", methode, json)


func publier_l_ecran(publie: Dictionary) -> void:
	JavaScriptBridge.eval("globalThis.wfrpEcran = %s" % JSON.stringify(publie), true)


func exposer(nom: String, rappel: Callable) -> void:
	_exposes[nom] = JavaScriptBridge.create_callback(rappel)
	JavaScriptBridge.get_interface("window").set(nom, _exposes[nom])


func adresse(relative: String) -> String:
	return str(JavaScriptBridge.eval("new URL(%s, location.href).href" % JSON.stringify(relative), true))


func choisir_une_image() -> Dictionary:
	var rendue := []
	var rappel := JavaScriptBridge.create_callback(func(args: Array) -> void: rendue.append_array(args))
	_pont.call("choisirUneImage", rappel)
	while rendue.is_empty():
		await get_tree().process_frame
	return {} if str(rendue[0]) == "" else {octets = Marshalls.base64_to_raw(str(rendue[0])), type = str(rendue[1])}


func parametre(cle: String) -> String:
	return str(JavaScriptBridge.eval("new URLSearchParams(location.search).get(%s) ?? ''" % JSON.stringify(cle), true))
