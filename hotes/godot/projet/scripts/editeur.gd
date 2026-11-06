## L'éditeur de carte (#3508), hôte de la méthode `editer` du pont (`hotes/godot/pont/CONTRAT.md`, section « Éditeur ») :
## il ouvre la campagne du jeu de l'adresse de la page (`?campagne=<id>`, sinon `CAMPAGNE`), telle que le dépôt la sert
## (`GET depot/<id>`) s'il la sert, sinon telle que le jeu l'embarque, et applique chaque réponse. Le texte qu'une
## réponse donne à enregistrer s'écrit au dépôt (`PUT depot/<id>`), et l'issue de l'écriture revient au pont.
## Le monde rendu va au monde (`Monde.poser`), sur la couche éditée, avec les arêtes de la couche
## (`Monde.poser_les_aretes`) ; la surcouche : chaque repère d'une entité ou d'une entrée de la couche, en plaque sur le
## sol de sa case, celle du repère sélectionné en survol, et nommé au-dessus d'elle (`Monde.etiqueter`), puis le geste en
## cours, en plaques sur le sol de ses cases (`Monde.peindre`), et l'arête sélectionnée, gainée (`Monde.choisir_l_arete`) ; le calque de référence de la couche sous sa planche
## (`Monde.poser_le_calque`) ; chaque zone de l'écran (`Zone.racines`) reçoit les éléments de sa source (`vue.zones`). Les
## calques de la campagne se gardent dans `user://calques/<id>.json`, relus à l'ouverture et réécrits à chaque `memoire`,
## chaque planche dans `user://<image>.png` : une planche demandée (`planche`) se choisit sur le disque de l'auteur
## (`PontDuNoyau.choisir_une_image`), s'écrit là, et sa taille, ou rien, revient au pont. Chaque geste part au pont : celui de l'élément pressé (`Zone.geste`, `{ edition }`), ou le pointeur sur
## le monde, appuyé, glissé d'une case à l'autre et relâché, chacun au point de la carte que le monde touche
## (`Monde.touche_sous`). Un refus se dit. Chaque réponse montrée, et chaque défilement du panneau, qui change ses
## boutons à l'écran, il publie à la page ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit.
extends Node

## La campagne qui s'ouvre sans `campagne` à l'adresse : celle de la Diligence, la carte que l'éditeur bâtit (#3508).
const CAMPAGNE := "la-diligence"
## Le dossier des calques gardés, et de leurs planches.
const CALQUES := "user://calques"

@onready var _monde: Monde = $Monde
@onready var _interface: CanvasLayer = $Interface
@onready var _refus: Label = $Interface/Avis/Refus
@onready var _panne: Label = $Interface/Avis/Panne
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _zones: Array[Zone] = []
## La dernière réponse montrée : sa vue et sa surcouche.
var _vue: Dictionary = {}
var _surcouche: Dictionary = {cases = [], arete = null, reperes = []}
## Le calque de la dernière réponse, `null` sans lui.
var _calque: Variant = null
## Le dernier point de la carte que le pointeur tenu a touché, `null` bouton relâché.
var _tenu: Variant = null
## La campagne ouverte.
var _campagne := ""
## Par chemin de planche, sa texture lue.
var _planches := {}


func _ready() -> void:
	_zones = Zone.racines(_interface)
	for zone in _zones:
		zone.geste.connect(_jouer)
	for defilement in _interface.find_children("*", "ScrollContainer", true, false):
		(defilement as ScrollContainer).get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publier_l_ecran())
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	var campagne := _pont.parametre("campagne")
	_campagne = campagne if campagne != "" else CAMPAGNE
	var ouvrir := {ouvrir = _campagne}
	if FileAccess.file_exists(_fichier_des_calques()):
		ouvrir.calques = FileAccess.get_file_as_string(_fichier_des_calques())
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


## Une réponse de `editer` : le monde et ses arêtes posés s'il y en a un, la surcouche peinte, le calque posé, les zones
## montrées, le texte à enregistrer écrit au dépôt, les calques gardés, et la planche demandée choisie.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_refus.text = ""
	if reponse.has("monde"):
		_monde.poser(reponse.monde)
		_monde.poser_les_aretes(reponse.aretes, int(reponse.vue.couche))
	_vue = reponse.vue
	_surcouche = reponse.surcouche
	_monde.choisir_l_arete(_surcouche.arete, int(_vue.couche))
	var plaques := {}
	var noms := {}
	for r in _surcouche.reperes:
		var case := Vector3i(int(r.x), int(r.y), int(r.z))
		plaques[case] = Monde.ITEM_SURVOL if r.choisi else Monde.ITEM_CIBLE
		noms[case] = r.nom
	for c in _surcouche.cases:
		plaques[Vector3i(int(c.x), int(c.y), int(c.z))] = Monde.ITEM_SURVOL
	_monde.peindre(plaques)
	_monde.etiqueter(noms)
	_calque = reponse.calque
	_monde.poser_le_calque(_calque, null if _calque == null else _planche(_calque.image))
	Zone.montrer_toutes(_zones, _vue.zones)
	_publier_l_ecran.call_deferred()
	if reponse.has("depot"):
		_deposer(reponse.depot)
	if reponse.has("memoire"):
		_garder(reponse.memoire)
	if reponse.has("planche"):
		_charger_la_planche(reponse.planche.image)


## Le fichier des calques gardés de la campagne ouverte.
func _fichier_des_calques() -> String:
	return "%s/%s.json" % [CALQUES, _campagne]


## La texture de la planche `image`, lue de `user://<image>.png` à son premier usage ; `null` si elle n'y est pas.
func _planche(image: String) -> Texture2D:
	if not _planches.has(image):
		var chemin := "user://%s.png" % image
		_planches[image] = ImageTexture.create_from_image(Image.load_from_file(chemin)) if FileAccess.file_exists(chemin) else null
	return _planches[image]


## Les calques `memoire.calques` gardés à la place des précédents, et chaque planche de `memoire.oublier` effacée.
func _garder(memoire: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(CALQUES)
	var fichier := FileAccess.open(_fichier_des_calques(), FileAccess.WRITE)
	fichier.store_string(JSON.stringify(memoire.calques))
	fichier.close()
	for image in memoire.oublier:
		DirAccess.remove_absolute("user://%s.png" % image)
		_planches.erase(image)


## La planche `image` choisie sur le disque de l'auteur, écrite en `user://<image>.png`, puis sa taille rendue au pont ;
## rien s'il renonce ou si l'image ne se lit pas.
func _charger_la_planche(image: String) -> void:
	var choisie := await _pont.choisir_une_image()
	var lue := Image.new()
	var issue := ERR_FILE_UNRECOGNIZED
	match choisie.get("type", ""):
		"image/png":
			issue = lue.load_png_from_buffer(choisie.octets)
		"image/jpeg":
			issue = lue.load_jpg_from_buffer(choisie.octets)
		"image/webp":
			issue = lue.load_webp_from_buffer(choisie.octets)
	if issue == OK:
		var chemin := "user://%s.png" % image
		DirAccess.make_dir_recursive_absolute(chemin.get_base_dir())
		lue.save_png(chemin)
		_planches.erase(image)
	_jouer({edition = {geste = "chargement", image = {largeur = lue.get_width(), hauteur = lue.get_height()} if issue == OK else null}})


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


## Ce que l'écran porte, une fois la vue mise en page : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), ses champs de
## texte (`PontDuNoyau.saisies_a_l_ecran`), le point de
## chaque case de la couche éditée (`Monde.points`), et l'éditeur : ses zones, sa surcouche, le nombre d'arêtes posées
## sur le monde, les noms posés sur le monde, son calque et s'il est posé, sa planche lue.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	_pont.publier_l_ecran({boutons = PontDuNoyau.boutons_a_l_ecran([_interface]), saisies = PontDuNoyau.saisies_a_l_ecran([_interface]), cases = _monde.points(int(_vue.couche)), editeur = {zones = _vue.zones, surcouche = _surcouche, aretes = _monde.nombre_d_aretes(), noms = _monde.noms(), calque = _calque, calque_pose = _monde.calque_pose()}})
