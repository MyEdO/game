## Le seul point de contact avec la page : `globalThis.wfrpPont` par JavaScriptBridge (`hotes/godot/pont/CONTRAT.md`).
## Un appel envoie le nom d'une méthode et une chaîne JSON, et rend la réponse décodée ; une réponse `ok: false` est un
## refus, que `refus` porte ; une réponse illisible ou une erreur de la page (`erreursGlobales`) est une panne.
## Chargé en autoload `Pont` (`project.godot`).
class_name PontDuNoyau
extends Node

signal pret
signal refus(erreur: Dictionary)
signal panne(message: String)

const INTERFACE := "wfrpPont"
const ATTENTE_MS := 10000

var est_web := OS.has_feature("web")
var _pont: JavaScriptObject = null
var _debut_ms := 0


func _ready() -> void:
	_debut_ms = Time.get_ticks_msec()
	set_process(est_web)


func _process(_delta: float) -> void:
	_pont = JavaScriptBridge.get_interface(INTERFACE)
	if _pont != null:
		set_process(false)
		pret.emit()
	elif Time.get_ticks_msec() - _debut_ms > ATTENTE_MS:
		set_process(false)
		_signaler("globalThis.%s reste absent après %d ms : wfrp-pont.js n'est pas chargé." % [INTERFACE, ATTENTE_MS])


func est_pret() -> bool:
	return _pont != null


## La réponse de `methode` sur `entree` (un objet, ou `null` sans entrée) : décodée, `ok` vrai ou faux ; `{}` en panne.
func appeler(methode: String, entree: Variant = null) -> Dictionary:
	var reponse := _decoder(methode, _pont.call("appeler", methode, null if entree == null else JSON.stringify(entree)))
	if reponse.get("ok") == false:
		refus.emit(reponse.erreur)
	var releve := _decoder("erreursGlobales", _pont.call("appeler", "erreursGlobales"))
	for e in releve.get("erreurs", []):
		_signaler("%s (%s)" % [e.message, e.source])
	return reponse


## Publie à la page ce que l'écran porte (`globalThis.wfrpEcran`), pour qui le pilote sans voir dans le canevas.
func publier_l_ecran(ecran: Dictionary) -> void:
	JavaScriptBridge.eval("globalThis.wfrpEcran = %s" % JSON.stringify(ecran), true)


## Le paramètre `cle` de l'adresse de la page, `""` s'il est absent.
func parametre(cle: String) -> String:
	return str(JavaScriptBridge.eval("new URLSearchParams(location.search).get(%s) ?? ''" % JSON.stringify(cle), true))


func _decoder(methode: String, brut: Variant) -> Dictionary:
	if typeof(brut) != TYPE_STRING:
		_signaler("%s : réponse de type %s au lieu d'une chaîne JSON" % [methode, type_string(typeof(brut))])
		return {}
	var decode: Variant = JSON.parse_string(brut)
	if not decode is Dictionary or not decode.has("ok"):
		_signaler("%s : réponse illisible : %s" % [methode, brut.left(200)])
		return {}
	return decode


func _signaler(message: String) -> void:
	push_error("[pont] ", message)
	panne.emit(message)
