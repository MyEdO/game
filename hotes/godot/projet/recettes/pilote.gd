extends SceneTree

## @contrat Écran publié
## Hors d'une page, une recette pilote le jeu par `projet/recettes/pilote.gd`, la boucle principale du lancement
## (`--script`, #3945) : il porte la fenêtre à 1280 × 720, ouvre le menu d'entrée et le lieu du noyau, puis relève à
## chaque image les commandes du parcours par la méthode `commandes` du processus du pont, que seul le lanceur d'une
## recette sert (`hotes/godot/pilotage/natif.mjs`). Son entrée est `{ rendus }`, ce que chaque commande jouée depuis la
## relève d'avant a rendu, `[id, valeur]` ; sa réponse `{ ok: true, commandes }`, chacune portant son `id` et l'une de :
## - `souris` (`deplacer`, `presser`, `relacher` ou `cran`), `x`, `y` et `bouton` (l'index de Godot, absent d'un
##   déplacement) : l'événement de souris passé à `Input.parse_input_event`, un cran de molette pressé puis relâché ;
## - `touche` (`{ key, code }`, comme la page les nomme) et `appuyee` : l'événement de clavier, son caractère porté
##   à l'appui d'une touche d'un seul caractère ;
## - `rappel` et `entree` : le rappel exposé sous ce nom (`Transport.exposer`) appelé, sa réponse rendue ;
## - `capture` : l'image de la fenêtre écrite en PNG à ce chemin, `false` sans rendu (`--headless`) ;
## - `fichier` : le chemin que rend le choix de fichier ouvert (`TransportDuProcessus._choisir_un_chemin`), attendu,
##   ou, sous ce dossier, le nom que le choix propose ; rend ce chemin, le fichier lu ou écrit ;
## - `quitter` : le code de sortie, après la ligne `[pilote] fin`.
## Une commande rend `true`, la réponse de son rappel, ou `{ erreur }`.

const TAILLE := Vector2i(1280, 720)
## Le code Godot de chaque touche que la page nomme autrement que par son caractère ou `Key<lettre>`.
const TOUCHES := {
	"Enter": KEY_ENTER, "Escape": KEY_ESCAPE, "Backspace": KEY_BACKSPACE, "Home": KEY_HOME, "End": KEY_END,
	"ArrowUp": KEY_UP, "ArrowDown": KEY_DOWN, "Space": KEY_SPACE,
}
const DEPLACER := "deplacer"
const CRAN := "cran"

var _pont: PontDuNoyau
var _transport: TransportDuProcessus
## Le masque des boutons de la souris tenus.
var _tenus := 0
var _pointeur := Vector2.ZERO
## Ce que chaque commande jouée a rendu, `[id, valeur]`, depuis la dernière relève.
var _rendus := []
var _fini := false


func _initialize() -> void:
	_piloter.call_deferred()


func _piloter() -> void:
	root.size = TAILLE
	_pont = root.get_node("Pont")
	for enfant in _pont.get_children():
		if enfant is TransportDuProcessus:
			_transport = enfant
	change_scene_to_file(ProjectSettings.get_setting("application/run/main_scene"))
	if not await _pont.rejoindre(func(_message: String) -> void: pass, func(message: String) -> void: _echouer(message)):
		_finir(1)
	while not _fini:
		var releve := _pont.appeler("commandes", {rendus = _rendus})
		_rendus = []
		for commande: Dictionary in releve.get("commandes", []):
			_jouer(commande)
		await process_frame


## La panne du lieu `message` écrite en erreur, puis la sortie en échec.
func _echouer(message: String) -> void:
	push_error(message)
	_finir(1)


func _finir(code: int) -> void:
	if not _fini:
		_fini = true
		print("[pilote] fin")
		quit(code)


func _jouer(commande: Dictionary) -> void:
	var id: Variant = commande.id
	if commande.has("souris"):
		_rendus.append([id, _souris(commande)])
	elif commande.has("touche"):
		_rendus.append([id, _touche(commande.touche, commande.appuyee)])
	elif commande.has("rappel"):
		var rappel: Variant = _transport.exposes.get(commande.rappel)
		if rappel is Callable:
			rappel.call(str(commande.entree), func(reponse: String) -> void: _rendus.append([id, reponse]))
		else:
			_rendus.append([id, {erreur = "aucun rappel exposé sous %s" % commande.rappel}])
	elif commande.has("capture"):
		_capturer(id, commande.capture)
	elif commande.has("fichier"):
		_choisir(id, commande.fichier)
	elif commande.has("quitter"):
		_finir(int(commande.quitter))
	else:
		_rendus.append([id, {erreur = "commande inconnue : %s" % JSON.stringify(commande)}])


## L'événement de souris de `commande` joué au point `(x, y)` : `true`.
func _souris(commande: Dictionary) -> bool:
	var ou := Vector2(commande.x, commande.y)
	if commande.souris == DEPLACER:
		var deplacement := InputEventMouseMotion.new()
		deplacement.relative = ou - _pointeur
		_emettre(deplacement, ou)
	elif commande.souris == CRAN:
		for appuye in [true, false]:
			_presser(int(commande.bouton), appuye, ou, false)
	else:
		_presser(int(commande.bouton), commande.souris == "presser", ou, true)
	return true


## Le bouton `bouton` pressé ou relâché au point `ou` ; `tenu` vrai, il entre au masque des boutons tenus ou en sort.
func _presser(bouton: int, appuye: bool, ou: Vector2, tenu: bool) -> void:
	var masque := 1 << (bouton - 1)
	if tenu:
		_tenus = _tenus | masque if appuye else _tenus & ~masque
	var clic := InputEventMouseButton.new()
	clic.button_index = bouton as MouseButton
	clic.pressed = appuye
	_emettre(clic, ou)


func _emettre(evenement: InputEventMouse, ou: Vector2) -> void:
	_pointeur = ou
	evenement.position = ou
	evenement.global_position = ou
	evenement.button_mask = _tenus
	_entrer(evenement)


## La touche `touche` (`{ key, code }`) pressée ou relâchée : `true`, ou `{ erreur }` hors de `TOUCHES`.
func _touche(touche: Dictionary, appuyee: bool) -> Variant:
	var codes: Array[Key] = [_code(touche.key), _code(touche.code)]
	if KEY_NONE in codes:
		return {erreur = "touche hors de celles du pilote (TOUCHES, projet/recettes/pilote.gd) : %s" % JSON.stringify(touche)}
	var frappe := InputEventKey.new()
	frappe.pressed = appuyee
	frappe.keycode = codes[0]
	frappe.key_label = codes[0]
	frappe.physical_keycode = codes[1]
	if appuyee and str(touche.key).length() == 1:
		frappe.unicode = str(touche.key).unicode_at(0)
	_entrer(frappe)
	return true


## `evenement` entré au jeu et joué sur-le-champ : sans écran, aucun serveur d'affichage ne vide le tampon des entrées
## (`Input.flush_buffered_events`), et l'événement attendrait le suivant.
func _entrer(evenement: InputEvent) -> void:
	Input.parse_input_event(evenement)
	Input.flush_buffered_events()


## Le code Godot de la touche que la page nomme `nom` : son caractère en capitale, la lettre de `Key<lettre>`, ou celui
## de `TOUCHES` ; `KEY_NONE` hors d'eux.
func _code(nom: String) -> Key:
	if nom.length() == 1:
		return nom.to_upper().unicode_at(0) as Key
	if nom.length() == 4 and nom.begins_with("Key"):
		return nom.unicode_at(3) as Key
	return TOUCHES.get(nom, KEY_NONE)


## L'image de la fenêtre, une fois dessinée, écrite en PNG à `chemin` : `true` ; `false` sans rendu.
func _capturer(id: Variant, chemin: String) -> void:
	if DisplayServer.get_name() == "headless":
		_rendus.append([id, false])
		return
	await RenderingServer.frame_post_draw
	var ecrit := root.get_texture().get_image().save_png(chemin)
	_rendus.append([id, true if ecrit == OK else {erreur = "capture %s : %s" % [chemin, error_string(ecrit)]}])


## `chemin` rendu par le choix de fichier que le transport ouvre (`TransportDuProcessus._choisir_un_chemin`), attendu ;
## si `chemin` est un dossier, le nom que le choix propose, sous lui. Le chemin choisi est rendu une fois le dialogue
## parti : qui l'attendait a lu ou écrit le fichier.
func _choisir(id: Variant, chemin: String) -> void:
	var dialogues: Array[Node] = []
	while dialogues.is_empty() and not _fini:
		await process_frame
		dialogues = _transport.find_children("*", "FileDialog", false, false)
	if _fini:
		return
	var dialogue := dialogues[0] as FileDialog
	var choisi := chemin.path_join(dialogue.current_file) if DirAccess.dir_exists_absolute(chemin) else chemin
	dialogue.file_selected.emit(choisi)
	await dialogue.tree_exited
	_rendus.append([id, choisi])
