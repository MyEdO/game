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
const ATTENTE_S := 10.0

var est_web := OS.has_feature("web")
var _pont: JavaScriptObject = null


func _ready() -> void:
	set_process(est_web)
	if est_web:
		get_tree().create_timer(ATTENTE_S).timeout.connect(_expirer)


func _process(_delta: float) -> void:
	_pont = JavaScriptBridge.get_interface(INTERFACE)
	if _pont != null:
		set_process(false)
		pret.emit()


func _expirer() -> void:
	if _pont == null:
		set_process(false)
		_signaler("globalThis.%s reste absent après %s s : wfrp-pont.js n'est pas chargé." % [INTERFACE, ATTENTE_S])


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


## Les boutons à l'écran sous `racines` : chaque `BaseButton` actif et visible qu'aucun défilement ne cache, son texte,
## son centre, et sa méta `cle` s'il la porte.
static func boutons_a_l_ecran(racines: Array) -> Array:
	var boutons := []
	for racine in racines:
		for bouton in racine.find_children("*", "BaseButton", true, false):
			var centre: Vector2 = bouton.get_global_rect().get_center()
			if bouton.is_visible_in_tree() and not bouton.disabled and _a_l_ecran(bouton, centre):
				var publie := {texte = bouton.text, x = centre.x, y = centre.y}
				if bouton.has_meta("cle"):
					publie.cle = bouton.get_meta("cle")
				boutons.append(publie)
	return boutons


## Si `point` de `controle` se voit à travers chaque défilement qui le contient.
static func _a_l_ecran(controle: Control, point: Vector2) -> bool:
	var parent := controle.get_parent()
	while parent != null:
		if parent is ScrollContainer and not (parent as ScrollContainer).get_global_rect().has_point(point):
			return false
		parent = parent.get_parent()
	return true


## L'adresse absolue de `relative` contre celle de la page.
func adresse(relative: String) -> String:
	return str(JavaScriptBridge.eval("new URL(%s, location.href).href" % JSON.stringify(relative), true))


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
