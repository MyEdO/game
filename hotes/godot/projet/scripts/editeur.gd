## L'éditeur de carte (#3508), hôte de la méthode `editer` du pont (`hotes/godot/pont/CONTRAT.md`, section « Éditeur ») :
## il ouvre la campagne du jeu du paramètre `campagne` (`PontDuNoyau.parametre`, sinon `CAMPAGNE`), telle que le dépôt la sert
## (`GET depot/<id>`) s'il la sert, sinon telle que le jeu l'embarque, avec l'index des chapitres du `Source/` qu'il sert
## (`GET source/manifest.json`), et applique chaque réponse ; un chapitre demandé (`chapitre`) se charge
## (`GET source/<book>/<ch>.md`) et revient au pont. Le texte qu'une
## réponse donne à enregistrer s'écrit au dépôt (`PUT depot/<id>`), et l'issue de l'écriture revient au pont.
## Avant d'ouvrir, il indexe les modèles du serveur (`MontageDeComposition.indexer_les_modeles`), que le pont lit pour
## servir le corps de chaque navire. Le monde rendu va au monde (`Monde.poser`) : son manifeste, et la géométrie de ses
## seuls morceaux dont l'empreinte a bougé (`morceaux`, source `edition`), masqué au-dessus de la couche éditée
## (`retrait`, `VolumeDeScene.retirer`), avec les arêtes de la couche (`VolumeDeScene.poser_les_aretes`) et les navires de la scène, chacun sous le modèle de son corps
## (`MontageDesNavires`) ; la surcouche : chaque zone de la couche nommée au-dessus de sa première case, les cases de
## la zone sélectionnée en plaques, la poignée de la sélection en survol, puis chaque repère d'une entité ou d'une entrée
## de la couche, en plaque sur le sol de sa case, celle du repère sélectionné en survol, et nommé au-dessus d'elle
## (`Monde.etiqueter`), puis le geste en cours, en plaques sur le sol de ses cases (`Monde.peindre`), et l'arête
## sélectionnée, gainée (`Monde.choisir_l_arete`) ; le calque de référence de la couche sous sa planche
## (`Monde.poser_le_calque`) ; chaque zone de l'écran (`Zone.racines`) reçoit les éléments de sa source (`vue.zones`). Les
## calques de la campagne se gardent dans `user://calques/<id>.json`, relus à l'ouverture et réécrits à chaque `memoire`,
## chaque planche dans `user://<image>.png` : une planche demandée (`planche`) se choisit sur le disque de l'auteur
## (`PontDuNoyau.choisir_un_fichier`), s'écrit là, et sa taille, ou rien, revient au pont. Chaque geste part au pont :
## celui de l'élément pressé (`Zone.geste`, `{ edition }`), ou le pointeur sur
## le monde, appuyé, glissé d'une case à l'autre et relâché, chacun au point de la carte que le monde touche
## (`Monde.touche_sous`). Un refus se dit. Chaque réponse montrée, et chaque défilement du panneau ou onglet choisi, qui
## change ses boutons à l'écran, il publie ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la
## recette lit.
extends Node

## @contrat Éditeur
## Le routeur `projet/scripts/editeur.gd` (scène `projet/scenes/Editeur.tscn`, ouverte par le bouton « Éditeur » du
## menu) ouvre la campagne du paramètre `campagne` (la Diligence sans lui), avec le `projet` que sert
## `GET depot/<id>` s'il répond (`PontDuNoyau.requeter`), une fois les modèles du serveur indexés
## (`MontageDeComposition.indexer_les_modeles`), pose le monde rendu (`Monde.poser`, son manifeste et les morceaux dont
## l'empreinte a bougé, `morceaux` de source `edition`), masqué au-dessus de la couche éditée (`retrait`), ses arêtes
## (`VolumeDeScene.poser_les_aretes`) et ses navires, chacun sous le modèle de son corps comme au plateau
## (`MontageDesNavires`), la surcouche en plaques sur le sol de ses cases (`Monde.peindre`) : chaque zone nommée
## au-dessus de sa première case, les cases de la zone sélectionnée, la poignée de la sélection en survol, chaque
## repère, celui de la sélection en survol, nommé au-dessus de sa case (`Monde.etiqueter`), puis le geste en cours,
## l'arête sélectionnée gainée (`Monde.choisir_l_arete`) et le calque de la couche sous sa planche
## (`Monde.poser_le_calque` : un quadrilatère sur ses quatre coins, juste au-dessus de son plan et sans test de
## profondeur s'il passe dessus, sinon juste dessous), et les zones dans son panneau d'outils, à gauche. Il garde les
## calques de la campagne dans `user://calques/<id>.json`, qu'il passe à `{ ouvrir }` et réécrit à chaque `memoire`,
## dont il efface les planches à oublier et déplace les planches à déplacer ; chaque planche dans `user://<image>.png`.
## Une réponse qui porte `planche` ouvre le choix d'un fichier (`PontDuNoyau.choisir_un_fichier`) : dans la page, par
## `wfrpPont.choisirUnFichier` (`hotes/godot/pont/fichier.ts` : un `<input type=file>` marqué `data-fichier`, posé au
## document le temps du choix) ; hors d'une page, par le dialogue de fichier natif (section « Transport ») ; l'image
## lue, PNG, JPEG ou WebP, s'écrit au chemin de la planche, et sa taille revient
## au pont, ou `null` si l'auteur renonce ou si elle ne se lit pas. Il envoie le geste de l'élément pressé, et le
## pointeur sur le monde : l'appui au point touché (`Monde.touche_sous`), un glissé à chaque case nouvelle sous le
## bouton tenu, le relâché au point touché, le dernier si le pointeur a quitté le monde. Une réponse qui porte `depot`
## part en `PUT depot/<id>`, et son issue revient au pont ; une écriture refusée dit sa raison. Il passe à `{ ouvrir }`
## l'index des chapitres du `Source/` (`manifeste`) que sert `GET source/manifest.json` s'il répond ; une réponse qui
## porte `chapitre` le charge par `GET source/<book>/<ch>.md` et rend au pont `{ geste: 'chapitre', book, ch, texte }`,
## `texte` nul s'il ne répond pas. Une réponse qui porte `essai` ouvre le combat (`projet/scenes/Combat.tscn`), qui démarre l'essai (`PontDuNoyau.essai`).

## La campagne qui s'ouvre sans `campagne` à l'adresse : celle de la Diligence, la carte que l'éditeur bâtit (#3508).
const CAMPAGNE := "la-diligence"
## Le dossier des calques gardés, et de leurs planches.
const CALQUES := "user://calques"

@onready var _monde: Monde = $Monde
@onready var _navires: MontageDesNavires = $Navires
@onready var _interface: CanvasLayer = $Interface
@onready var _defilement: ScrollContainer = $Interface/Ossature/Outils/Defilement
@onready var _refus: Label = $Interface/Avis/Refus
@onready var _panne: Label = $Interface/Avis/Panne
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _zones: Array[Zone] = []
## La dernière réponse montrée : sa vue et sa surcouche.
var _vue: Dictionary = {}
var _surcouche: Dictionary = {cases = [], arete = null, reperes = [], zones = [], poignee = null}
## Le calque de la dernière réponse, `null` sans lui.
var _calque: Variant = null
## Le dernier point de la carte que le pointeur tenu a touché, `null` bouton relâché.
var _tenu: Variant = null
## La campagne ouverte.
var _campagne := ""
## Par chemin de planche, sa texture lue.
var _planches := {}
## Si une publication de l'écran attend que l'interface soit mise en page (`_publier_l_ecran`).
var _a_publier := false
## Si un conteneur de l'interface a placé ses enfants (`Container.sort_children`), ou si une publication a été demandée,
## depuis la dernière image.
var _remis_en_page := false


func _ready() -> void:
	_zones = Zone.racines(_interface)
	for zone in _zones:
		zone.geste.connect(_jouer)
	_defilement.get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publier_l_ecran())
	for pages in _interface.find_children("*", "TabContainer", true, false):
		(pages as TabContainer).tab_clicked.connect(func(_onglet: int) -> void: _publier_l_ecran())
	for conteneur in _interface.find_children("*", "Container", true, false):
		(conteneur as Container).sort_children.connect(_suivre_la_mise_en_page)
	get_tree().node_added.connect(func(noeud: Node) -> void:
		if noeud is Container and _interface.is_ancestor_of(noeud):
			(noeud as Container).sort_children.connect(_suivre_la_mise_en_page)
		if noeud is LineEdit and _interface.is_ancestor_of(noeud):
			(noeud as LineEdit).text_changed.connect(func(_texte: String) -> void: _publier_l_ecran())
		elif noeud is TextEdit and _interface.is_ancestor_of(noeud):
			(noeud as TextEdit).text_changed.connect(_publier_l_ecran))
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	var recueil: Array[String] = await MontageDeComposition.indexer_les_modeles(self)
	if not recueil.is_empty():
		_panne.text = "\n".join(PackedStringArray(recueil))
	var campagne := _pont.parametre("campagne")
	_campagne = campagne if campagne != "" else CAMPAGNE
	var ouvrir := {ouvrir = _campagne}
	if FileAccess.file_exists(_fichier_des_calques()):
		ouvrir.calques = FileAccess.get_file_as_string(_fichier_des_calques())
	var hors_du_depot: Array[String] = []
	var servi := await _pont.requeter("depot/%s" % ouvrir.ouvrir, hors_du_depot)
	if not servi.is_empty():
		ouvrir.projet = servi.get_string_from_utf8()
	var manifeste := await _pont.requeter("source/manifest.json", hors_du_depot)
	if not manifeste.is_empty():
		ouvrir.manifeste = manifeste.get_string_from_utf8()
	_suivre(_pont.appeler("editer", ouvrir))


## Le monde d'une réponse de `editer` (`reponse.monde`, le manifeste du volume) posé au monde (`Monde.poser`), sans
## nappe de toit ni couronne, la géométrie des seuls morceaux dont l'empreinte posée diffère demandée à `morceaux`
## (`VolumeDeScene.manquants`), puis son masque (`reponse.retrait`, `VolumeDeScene.retirer`).
func _poser_le_monde(reponse: Dictionary) -> void:
	var monde := {monde = reponse.monde, toits = [], couronnes = []}
	var manquants := _monde.volume.manquants(monde)
	var recus := {volume = [], toits = [], couronnes = []}
	if not manquants.volume.is_empty():
		recus = _pont.appeler("morceaux", manquants.merged({source = "edition"}))
		if recus.get("ok") != true:
			return
	_monde.poser(monde, recus)
	_monde.volume.retirer(reponse.retrait)


func _jouer(jeu: Dictionary) -> void:
	_suivre(_pont.appeler("editer", jeu))


## Le geste du pointeur `geste` au point touché `touche` (`Monde.touche_sous`).
func _pointer(geste: String, touche: Dictionary) -> void:
	_jouer({edition = {geste = geste, point = {case = {x = touche.case.x, y = touche.case.y}, f = {x = touche.f.x, y = touche.f.y}}}})


## Une réponse de `editer` : le monde, ses arêtes et ses navires posés s'il y en a un, la surcouche peinte, le calque posé, les zones
## montrées, le texte à enregistrer écrit au dépôt, les calques gardés, la planche demandée choisie, et le chapitre
## demandé chargé ; la scène mise à l'essai se joue au combat.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_refus.text = ""
	if reponse.has("monde"):
		_poser_le_monde(reponse)
		_monde.volume.poser_les_aretes(reponse.aretes)
		_navires.poser(reponse.navires, {}, reponse.monde.metresParCase)
	_vue = reponse.vue
	_surcouche = reponse.surcouche
	_monde.choisir_l_arete(_surcouche.arete)
	var plaques := {}
	var noms := {}
	for zone in _surcouche.zones:
		if zone.choisi:
			for c in zone.cases:
				plaques[Vector3i(int(c.x), int(c.y), int(c.z))] = Monde.ITEM_CIBLE
		if not zone.cases.is_empty():
			noms[Vector3i(int(zone.cases[0].x), int(zone.cases[0].y), int(zone.cases[0].z))] = zone.nom
	if _surcouche.poignee != null:
		plaques[Vector3i(int(_surcouche.poignee.x), int(_surcouche.poignee.y), int(_surcouche.poignee.z))] = Monde.ITEM_SURVOL
	# Plusieurs repères tiennent dans une case (deux décors, une lettre sur la table) : la plaque de la sélection y
	# l'emporte, et leurs noms s'y joignent.
	var plaques_des_reperes := {}
	var noms_des_reperes := {}
	for r in _surcouche.reperes:
		var case := Vector3i(int(r.x), int(r.y), int(r.z))
		if r.choisi or not plaques_des_reperes.has(case):
			plaques_des_reperes[case] = Monde.ITEM_SURVOL if r.choisi else Monde.ITEM_CIBLE
		noms_des_reperes[case] = "%s, %s" % [noms_des_reperes[case], r.nom] if noms_des_reperes.has(case) else r.nom
	plaques.merge(plaques_des_reperes, true)
	noms.merge(noms_des_reperes, true)
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
	if reponse.has("chapitre"):
		_charger_le_chapitre(reponse.chapitre)
	if reponse.has("essai"):
		_pont.essai = true
		get_tree().change_scene_to_file.call_deferred("res://scenes/Combat.tscn")


## Le fichier des calques gardés de la campagne ouverte.
func _fichier_des_calques() -> String:
	return "%s/%s.json" % [CALQUES, _campagne]


## La texture de la planche `image`, lue de `user://<image>.png` à son premier usage ; `null` si elle n'y est pas.
func _planche(image: String) -> Texture2D:
	if not _planches.has(image):
		var chemin := "user://%s.png" % image
		_planches[image] = ImageTexture.create_from_image(Image.load_from_file(chemin)) if FileAccess.file_exists(chemin) else null
	return _planches[image]


## Les calques `memoire.calques` gardés à la place des précédents, chaque planche de `memoire.oublier` effacée, et chaque
## planche de `memoire.deplacer` déplacée.
func _garder(memoire: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(CALQUES)
	var fichier := FileAccess.open(_fichier_des_calques(), FileAccess.WRITE)
	fichier.store_string(JSON.stringify(memoire.calques))
	fichier.close()
	for image in memoire.oublier:
		DirAccess.remove_absolute("user://%s.png" % image)
		_planches.erase(image)
	for planche in memoire.deplacer:
		DirAccess.make_dir_recursive_absolute(("user://%s.png" % planche.vers).get_base_dir())
		DirAccess.rename_absolute("user://%s.png" % planche.de, "user://%s.png" % planche.vers)
		_planches.erase(planche.de)


## La planche `image` choisie sur le disque de l'auteur, écrite en `user://<image>.png`, puis sa taille rendue au pont ;
## rien s'il renonce ou si l'image ne se lit pas.
func _charger_la_planche(image: String) -> void:
	var choisie := await _pont.choisir_un_fichier(PontDuNoyau.IMAGES)
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


## Le texte du chapitre `chapitre` du `Source/` que sert le poste (`GET source/<book>/<ch>.md`), rendu au pont, ou `null`
## s'il ne se charge pas.
func _charger_le_chapitre(chapitre: Dictionary) -> void:
	var recueil: Array[String] = []
	var lu := await _pont.requeter("source/%s/%s.md" % [chapitre.book, chapitre.ch], recueil)
	_jouer({edition = {geste = "chapitre", book = chapitre.book, ch = chapitre.ch, texte = lu.get_string_from_utf8() if recueil.is_empty() else null}})


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


## Un conteneur de l'interface a replacé ses enfants : la publication attendue attend l'image suivante.
func _suivre_la_mise_en_page() -> void:
	_remis_en_page = true


## Ce que l'écran porte, une fois la vue mise en page : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), ses champs de
## texte (`PontDuNoyau.saisies_a_l_ecran`), le défilement de son panneau (`PontDuNoyau.defilement_publie`), le point de
## chaque case de la couche éditée (`Monde.points`), et l'éditeur : ses zones, sa surcouche, le nombre d'arêtes posées
## sur le monde, les noms posés sur le monde, son calque et s'il est posé, sa planche lue, et le cadre du plan montré
## (`_cadre_du_plan`). Republié quand un défilement
## du panneau bouge, qu'un onglet se choisit ou qu'un champ de texte change, une fois l'interface mise en page : à la
## première image entière où aucun de ses conteneurs n'a replacé ses enfants ni aucune demande n'est venue, la première
## attente pouvant reprendre dans l'image de la demande, avant ses appels différés (`SceneTree.process_frame`) ; une seule publication pour les demandes qui
## l'attendent ; rien si l'éditeur a quitté l'écran entre-temps (l'essai ouvre le combat).
func _publier_l_ecran() -> void:
	_remis_en_page = true
	if _a_publier:
		return
	_a_publier = true
	await get_tree().process_frame
	while _remis_en_page and is_inside_tree():
		_remis_en_page = false
		await get_tree().process_frame
	if not is_inside_tree():
		return
	_a_publier = false
	_pont.publier_l_ecran(func() -> Dictionary: return {boutons = PontDuNoyau.boutons_a_l_ecran([_interface]), saisies = PontDuNoyau.saisies_a_l_ecran([_interface]), panneau = PontDuNoyau.defilement_publie(_defilement), cases = _monde.points(int(_vue.couche)), editeur = {zones = _vue.zones, surcouche = _surcouche, aretes = _monde.volume.ce_qui_est_pose().aretes, noms = _monde.noms(), calque = _calque, calque_pose = _monde.calque_pose(), plan = _cadre_du_plan()}})


## Le cadre 0..1 du plan montré à l'écran (`Plan.cadre`), `{ x, y, largeur, hauteur }`, `null` sans plan montré.
func _cadre_du_plan() -> Variant:
	for plan in _interface.find_children("*", "Container", true, false):
		if plan is Plan and (plan as Plan).is_visible_in_tree():
			var cadre := (plan as Plan).cadre()
			return {x = cadre.position.x, y = cadre.position.y, largeur = cadre.size.x, hauteur = cadre.size.y}
	return null
