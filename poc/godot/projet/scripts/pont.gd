## Seul point de contact avec JavaScriptBridge : contrat `wfrpPont` du prototype #2793.
extends Node

signal pret
signal erreur_pont(erreur: Dictionary)
signal refus(erreur: Dictionary)

const INTERFACE := "wfrpPont"
const DELAI_ATTENTE_MS := 10000

var est_web := OS.has_feature("web")
var _pont: JavaScriptObject = null
var _debut_attente_ms := 0


func _ready() -> void:
	_debut_attente_ms = Time.get_ticks_msec()
	set_process(est_web)


func _process(_delta: float) -> void:
	_pont = JavaScriptBridge.get_interface(INTERFACE)
	if _pont != null:
		set_process(false)
		pret.emit()
	elif Time.get_ticks_msec() - _debut_attente_ms > DELAI_ATTENTE_MS:
		set_process(false)
		_signaler(_erreur_transport("get_interface", INTERFACE, "globalThis.%s reste absent après %d ms : wfrp-pont.js n'est pas chargé." % [INTERFACE, DELAI_ATTENTE_MS], null))


func est_pret() -> bool:
	return _pont != null


## Évalue une expression JS dans la page (lecture seule : `location.search`, `performance.now()`).
func evaluer(expression: String) -> Variant:
	return JavaScriptBridge.eval(expression, true)


## Appel et décodage seuls, sans contrôle ni relevé des erreurs globales : la mesure du pont.
func appeler_brut(methode: String, entree: Variant = null) -> Variant:
	var brut: Variant = _invoquer(methode, entree)
	return JSON.parse_string(brut) if typeof(brut) == TYPE_STRING else null


## Appel contrôlé : rend la réponse décodée (`ok` vrai ou faux), ou `{}` si le transport a échoué.
func appeler(methode: String, entree: Variant = null) -> Dictionary:
	var reponse := _verifier(methode, entree, _invoquer(methode, entree))
	relever_erreurs_globales(methode, entree)
	return reponse


## `erreursGlobales()` : `window.onerror` et `unhandledrejection` capturés depuis le dernier appel.
func relever_erreurs_globales(methode: String, entree: Variant = null) -> void:
	var reponse := _verifier("erreursGlobales", null, _invoquer("erreursGlobales", null))
	if not reponse.get("ok", false):
		return
	for e in reponse.get("erreurs", []):
		var message: String = str(e.get("message", "")) if e is Dictionary else str(e)
		var source: Variant = e.get("source") if e is Dictionary else null
		_signaler({nature = "globale", action = {methode = methode, entree = entree}, message = message, partiels = source})


## `sondeExceptionNue()` sans aucune enveloppe : ce que GDScript reçoit quand le JS lève.
func sonder_exception_nue() -> Variant:
	return _pont.call("sondeExceptionNue")


func _invoquer(methode: String, entree: Variant) -> Variant:
	if entree == null:
		return _pont.call(methode)
	return _pont.call(methode, JSON.stringify(entree))


func _verifier(methode: String, entree: Variant, brut: Variant) -> Dictionary:
	if brut == null:
		_signaler(_erreur_transport(methode, entree, "Réponse null.", null))
		return {}
	if typeof(brut) != TYPE_STRING:
		_signaler(_erreur_transport(methode, entree, "Réponse de type %s au lieu d'une chaîne JSON." % type_string(typeof(brut)), str(brut)))
		return {}
	var json := JSON.new()
	if json.parse(brut) != OK or not json.data is Dictionary:
		_signaler(_erreur_transport(methode, entree, "Réponse non décodable en objet JSON (%s)." % (json.get_error_message() if json.get_error_message() != "" else "pas un objet"), brut))
		return {}
	var decode: Dictionary = json.data
	if not decode.has("ok"):
		_signaler(_erreur_transport(methode, entree, "Réponse sans champ ok.", decode))
		return {}
	if decode.ok == true:
		return decode
	var erreur: Variant = decode.get("erreur")
	if not erreur is Dictionary:
		_signaler(_erreur_transport(methode, entree, "Réponse ok:false sans objet erreur.", decode))
	elif erreur.get("nature") == "refus":
		refus.emit(erreur)
	else:
		_signaler(erreur)
	return decode


func _erreur_transport(methode: String, entree: Variant, message: String, partiels: Variant) -> Dictionary:
	return {nature = "transport", action = {methode = methode, entree = entree}, message = message, partiels = partiels}


func _signaler(erreur: Dictionary) -> void:
	push_error("[pont] ", JSON.stringify(erreur))
	erreur_pont.emit(erreur)
