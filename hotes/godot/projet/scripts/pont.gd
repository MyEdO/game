## Le seul point de contact avec la page : `globalThis.wfrpPont` par JavaScriptBridge (`hotes/godot/pont/CONTRAT.md`), dont
## l'image que l'auteur choisit sur son disque (`choisir_une_image`), et les requêtes au serveur qui la sert (`requeter`).
## Un appel envoie le nom d'une méthode et une chaîne JSON, et rend la réponse décodée ; une réponse `ok: false` est un
## refus, que `refus` porte ; une réponse illisible ou une erreur de la page (`erreursGlobales`) est une panne.
## Chargé en autoload `Pont` (`project.godot`).
class_name PontDuNoyau
extends Node

signal pret
signal refus(message: String)
signal panne(message: String)

const INTERFACE := "wfrpPont"
const ATTENTE_S := 10.0
## Le plus long silence du réseau qu'un téléchargement tolère, compté par un `Timer` en temps de l'arbre : le délai
## repart à chaque bloc reçu, car la durée d'un téléchargement suit la fréquence d'image (#3470).
const SILENCE_S := 10.0
## Le plus grand bloc que HTTPRequest lit par image. Sur le Web, une image lit au plus un bloc du flux de la page
## (`platform/web/js/libs/library_godot_fetch.js`, `godot_js_fetch_read_chunk`, Godot 4.7-stable), jusqu'à 2 Mio
## mesurés : un GLB de base de 42 Mo s'y reçoit en une vingtaine d'images (#3470), pas en plus de 600 par 64 Kio.
const BLOC_DE_TELECHARGEMENT := 16777216

var est_web := OS.has_feature("web")
## Si la partie à démarrer est la scène que l'éditeur a mise à l'essai (`demarrer { essai }`), plutôt que le scénario de
## l'adresse de la page.
var essai := false
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


## Le pont rejoint par un écran : chaque refus rendu à `au_refus` (son message), chaque panne à `a_la_panne`, chacun abonné
## une fois et désabonné à la libération de son objet ; `true` une fois le pont prêt, `false` (la panne signalée) hors
## d'une page.
func rejoindre(au_refus: Callable, a_la_panne: Callable) -> bool:
	if not refus.is_connected(au_refus):
		refus.connect(au_refus)
	if not panne.is_connected(a_la_panne):
		panne.connect(a_la_panne)
	if not est_web:
		_signaler("Cet hôte joue dans une page : son pont est `wfrp-pont.js` (export Web).")
		return false
	if not est_pret():
		await pret
	return true


## La réponse de `methode` sur `entree` (un objet, ou `null` sans entrée) : décodée, `ok` vrai ou faux ; `{}` en panne.
func appeler(methode: String, entree: Variant = null) -> Dictionary:
	var reponse := _decoder(methode, _pont.call("appeler", methode, null if entree == null else JSON.stringify(entree)))
	if reponse.get("ok") == false:
		refus.emit(str(reponse.erreur.message))
	var releve := _decoder("erreursGlobales", _pont.call("appeler", "erreursGlobales"))
	for e in releve.get("erreurs", []):
		_signaler("%s (%s)" % [e.message, e.source])
	return reponse


## Publie à la page ce que l'écran porte (`globalThis.wfrpEcran`), pour qui le pilote sans voir dans le canevas.
func publier_l_ecran(ecran: Dictionary) -> void:
	JavaScriptBridge.eval("globalThis.wfrpEcran = %s" % JSON.stringify(ecran), true)


## Les boutons à l'écran sous `racines` : chaque `BaseButton` actif et visible qu'aucun défilement ne cache, son texte,
## son centre, sa méta `cle` s'il la porte, et l'élément que dessine le composant qui le porte (`Zone.META` :
## `<type>/<id>`) s'il en porte un ; une liste déroulante, aussi le texte de chaque article (`choix`) et le rang de
## l'article choisi (`retenu`, -1 sans choix) ; puis chaque onglet montré d'un `TabContainer` visible, son titre et le
## centre de son onglet (`onglet`).
static func boutons_a_l_ecran(racines: Array) -> Array:
	var boutons := []
	for racine in racines:
		for pages in racine.find_children("*", "TabContainer", true, false):
			var barre := (pages as TabContainer).get_tab_bar()
			if not barre.is_visible_in_tree():
				continue
			for rang in barre.tab_count:
				var milieu: Vector2 = barre.get_global_transform().translated_local(barre.get_tab_rect(rang).get_center()).get_origin()
				if not barre.is_tab_hidden(rang) and a_l_ecran(barre, milieu):
					boutons.append({texte = barre.get_tab_title(rang), x = milieu.x, y = milieu.y, onglet = true})
		for bouton in racine.find_children("*", "BaseButton", true, false):
			var centre: Vector2 = bouton.get_global_rect().get_center()
			if bouton.is_visible_in_tree() and not bouton.disabled and a_l_ecran(bouton, centre):
				var publie := {texte = bouton.text, x = centre.x, y = centre.y}
				if bouton.has_meta("cle"):
					publie.cle = bouton.get_meta("cle")
				if bouton.owner != null and bouton.owner.has_meta(Zone.META):
					publie.element = bouton.owner.get_meta(Zone.META)
				if bouton is OptionButton:
					var liste := bouton as OptionButton
					publie.choix = range(liste.item_count).map(func(rang: int) -> String: return liste.get_item_text(rang))
					publie.retenu = liste.selected
				boutons.append(publie)
	return boutons


## Les champs de texte à l'écran sous `racines` : chaque `LineEdit` ou `TextEdit` éditable et visible qu'aucun
## défilement ne cache, son texte, son centre, et l'élément que dessine le composant qui le porte (`Zone.META`) s'il en
## porte un.
static func saisies_a_l_ecran(racines: Array) -> Array:
	var saisies := []
	for racine in racines:
		for champ in racine.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is LineEdit or n is TextEdit):
			var centre: Vector2 = champ.get_global_rect().get_center()
			if champ.is_visible_in_tree() and champ.editable and a_l_ecran(champ, centre):
				var publie := {texte = champ.text, x = centre.x, y = centre.y}
				if champ.owner != null and champ.owner.has_meta(Zone.META):
					publie.element = champ.owner.get_meta(Zone.META)
				saisies.append(publie)
	return saisies


## Si `point` de `controle` se voit à travers chaque défilement qui le contient.
static func a_l_ecran(controle: Control, point: Vector2) -> bool:
	var parent := controle.get_parent()
	while parent != null:
		if parent is ScrollContainer and not (parent as ScrollContainer).get_global_rect().has_point(point):
			return false
		parent = parent.get_parent()
	return true


## L'adresse absolue de `relative` contre celle de la page.
func adresse(relative: String) -> String:
	return str(JavaScriptBridge.eval("new URL(%s, location.href).href" % JSON.stringify(relative), true))


## Le corps de la réponse à `methode` sur `relative`, adresse relative à la page, `corps` envoyé ; vide, et une erreur à
## `recueil`, si la requête échoue, si la réponse n'est pas un 200 (son corps dit alors pourquoi), ou si `SILENCE_S` passe
## sans qu'un octet arrive : le minuteur `silence` repart à chaque image où HTTPRequest a lu un bloc.
func requeter(relative: String, recueil: Array[String], methode := HTTPClient.METHOD_GET, corps := "") -> PackedByteArray:
	var requete := HTTPRequest.new()
	requete.download_chunk_size = BLOC_DE_TELECHARGEMENT
	add_child(requete)
	var code := requete.request(adresse(relative), PackedStringArray(), methode, corps)
	if code != OK:
		requete.queue_free()
		recueil.append("requete-refusee : %s (%s)" % [relative, error_string(code)])
		return PackedByteArray()
	var resultat := []
	requete.request_completed.connect(func(issue: int, statut: int, entetes: PackedStringArray, recu: PackedByteArray) -> void:
		resultat.append_array([issue, statut, entetes, recu]), CONNECT_ONE_SHOT)
	var silence := Timer.new()
	silence.one_shot = true
	requete.add_child(silence)
	silence.start(SILENCE_S)
	var recus := 0
	while resultat.is_empty() and not silence.is_stopped():
		await get_tree().process_frame
		if requete.get_downloaded_bytes() != recus:
			recus = requete.get_downloaded_bytes()
			silence.start(SILENCE_S)
	if resultat.is_empty():
		requete.cancel_request()
		requete.queue_free()
		recueil.append("requete-silencieuse : %s (aucun octet en %s s, %s reçus)" % [relative, SILENCE_S, recus])
		return PackedByteArray()
	requete.queue_free()
	if resultat[0] != HTTPRequest.RESULT_SUCCESS or resultat[1] != 200:
		var raison: String = resultat[3].get_string_from_utf8()
		recueil.append("requete-echouee : %s (resultat %s, HTTP %s)%s" % [relative, resultat[0], resultat[1], " : " + raison if raison != "" else ""])
		return PackedByteArray()
	return resultat[3]


## L'image que l'auteur choisit sur son disque (`wfrpPont.choisirUneImage`) : `{ octets, type }`, son contenu et son type
## MIME ; `{}` s'il renonce.
func choisir_une_image() -> Dictionary:
	var rendue := []
	var rappel := JavaScriptBridge.create_callback(func(args: Array) -> void: rendue.append_array(args))
	_pont.call("choisirUneImage", rappel)
	while rendue.is_empty():
		await get_tree().process_frame
	return {} if str(rendue[0]) == "" else {octets = Marshalls.base64_to_raw(str(rendue[0])), type = str(rendue[1])}


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
