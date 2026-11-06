## L'éditeur de carte (#3508), hôte de la méthode `editer` du pont (`hotes/godot/pont/CONTRAT.md`, section « Éditeur ») :
## il ouvre la campagne du jeu de l'adresse de la page (`?campagne=<id>`, sinon `CAMPAGNE`), telle que le dépôt la sert
## (`GET depot/<id>`) s'il la sert, sinon telle que le jeu l'embarque, et applique chaque réponse. Le texte qu'une
## réponse donne à enregistrer s'écrit au dépôt (`PUT depot/<id>`), et l'issue de l'écriture revient au pont.
## Le monde rendu va au monde (`Monde.poser`), sur la couche éditée ; la surcouche du geste en cours, en plaques sur le
## sol de ses cases (`Monde.peindre`) ; chaque zone de l'écran (`Zone.racines`) reçoit les éléments de sa source
## (`vue.zones`). Chaque geste part au pont : celui de l'élément pressé (`Zone.geste`, `{ edition }`), ou le pointeur sur
## le monde, appuyé, glissé d'une case à l'autre et relâché, chacun au point de la carte que le monde touche
## (`Monde.touche_sous`). Un refus se dit. Chaque réponse montrée, il publie à la page ce que l'écran porte
## (`PontDuNoyau.publier_l_ecran`), que la recette lit.
extends Node

## La campagne qui s'ouvre sans `campagne` à l'adresse : celle de la Diligence, la carte que l'éditeur bâtit (#3508).
const CAMPAGNE := "la-diligence"

@onready var _monde: Monde = $Monde
@onready var _interface: CanvasLayer = $Interface
@onready var _refus: Label = $Interface/Avis/Refus
@onready var _panne: Label = $Interface/Avis/Panne
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _zones: Array[Zone] = []
## La dernière réponse montrée : sa vue et sa surcouche.
var _vue: Dictionary = {}
var _surcouche: Dictionary = {cases = []}
## Le dernier point de la carte que le pointeur tenu a touché, `null` bouton relâché.
var _tenu: Variant = null


func _ready() -> void:
	_zones = Zone.racines(_interface)
	for zone in _zones:
		zone.geste.connect(_jouer)
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	var campagne := _pont.parametre("campagne")
	var ouvrir := {ouvrir = campagne if campagne != "" else CAMPAGNE}
	var hors_du_depot: Array[String] = []
	var servi := await _pont.requeter("depot/%s" % ouvrir.ouvrir, hors_du_depot)
	if not servi.is_empty():
		ouvrir.projet = servi.get_string_from_utf8()
	_suivre(_pont.appeler("editer", ouvrir))


func _jouer(jeu: Dictionary) -> void:
	_suivre(_pont.appeler("editer", jeu))


## Le geste du pointeur `geste` au point touché `touche` (`Monde.touche_sous`).
func _pointer(geste: String, touche: Dictionary) -> void:
	_jouer({edition = {geste = geste, point = {case = {x = touche.case.x, y = touche.case.y}, f = {x = touche.f.x, y = touche.f.y}}}})


## Une réponse de `editer` : le monde posé s'il y en a un, la surcouche peinte, les zones montrées, et le texte à
## enregistrer écrit au dépôt.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_refus.text = ""
	if reponse.has("monde"):
		_monde.poser(reponse.monde)
	_vue = reponse.vue
	_surcouche = reponse.surcouche
	var plaques := {}
	for c in _surcouche.cases:
		plaques[Vector3i(int(c.x), int(c.y), int(c.z))] = Monde.ITEM_SURVOL
	_monde.peindre(plaques)
	Zone.montrer_toutes(_zones, _vue.zones)
	_publier_l_ecran.call_deferred()
	if reponse.has("depot"):
		_deposer(reponse.depot)


## Le texte `depot.texte` écrit au dépôt à la place du projet `depot.id`, puis l'issue de l'écriture rendue au pont ; une
## écriture qui échoue dit pourquoi.
func _deposer(depot: Dictionary) -> void:
	var recueil: Array[String] = []
	await _pont.requeter("depot/%s" % depot.id, recueil, HTTPClient.METHOD_PUT, depot.texte)
	_jouer({edition = {geste = "enregistrement", reussi = recueil.is_empty()}})
	if not recueil.is_empty():
		_refus.text = "\n".join(recueil)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		var touche: Variant = _monde.touche_sous(event.position)
		if event.pressed and touche != null:
			_tenu = touche
			_pointer("appui", touche)
		elif not event.pressed and _tenu != null:
			var relache: Dictionary = touche if touche != null else _tenu
			_tenu = null
			_pointer("relache", relache)
		else:
			return
	elif event is InputEventMouseMotion and _tenu != null:
		var touche: Variant = _monde.touche_sous(event.position)
		if touche == null or touche.case == _tenu.case:
			return
		_tenu = touche
		_pointer("glisse", touche)
	else:
		return
	get_viewport().set_input_as_handled()


## Ce que l'écran porte, une fois la vue mise en page : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), le point de
## chaque case de la couche éditée (`Monde.points`), et l'éditeur : ses zones et sa surcouche.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	_pont.publier_l_ecran({boutons = PontDuNoyau.boutons_a_l_ecran([_interface]), cases = _monde.points(int(_vue.couche)), editeur = {zones = _vue.zones, surcouche = _surcouche}})
