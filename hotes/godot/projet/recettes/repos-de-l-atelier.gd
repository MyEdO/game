extends SceneTree

## Le repos de l'atelier (#3787, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D », seconde prise) : l'atelier
## ouvert sur un pont figé (`PontFige`, `pont_fige.gd`, sur l'atelier figé par la sonde,
## `hotes/godot/recettes/atelier.ts`, `figerLeRepos`) qui sert la base humanoïde et un élément à seconde prise. À
## l'ouverture, il joue le clip `repos` de la base ; l'élément monté à la prise `main`, le clip `repos` de son maniement
## (`clipsDeuxMains`) ; la marche tenue (son action pressée, l'appui de sa touche remis à la marche, qu'une sonde sans
## fenêtre ne reçoit pas), le clip `marche` de ce maniement, puis à son arrêt de nouveau son `repos` ; mis en pause, puis
## l'élément démonté, le clip `repos` de la base, toujours en pause. L'écran publié porte chaque fois ce clip et sa
## lecture.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/repos.json"
## Les images laissées à un chargement ou à un montage, lus et posés en quelques images.
const IMAGES_D_ATTENTE := 600
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[repos-de-l-atelier] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[repos-de-l-atelier] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.poser(self, lu)
	var atelier: Node = load("res://scenes/Atelier.tscn").instantiate()
	root.add_child(atelier)
	var montage: MontageDeComposition = atelier.get("_montage")
	var base: Dictionary = lu.modeles.bases.filter(func(b: Dictionary) -> bool: return b.id == "humanoide")[0]
	var deux_mains: Dictionary = base.clipsDeuxMains[lu.modeles.secondesPrises[lu.element].maniement]
	await _attendre(func() -> bool: return montage.lecteur != null and montage.lecteur.assigned_animation != "")
	await _constater(montage, pont, base.clips.repos, true, "à l'ouverture")
	_choisir(atelier, "main", lu.element)
	await _attendre(func() -> bool: return montage.montes.get("main") == lu.element)
	await _constater(montage, pont, deux_mains.repos, true, "l'élément à seconde prise monté")
	var appui: InputEvent = InputMap.action_get_events(&"avant")[0].duplicate()
	appui.pressed = true
	Input.action_press(&"avant")
	atelier.get_node("Marche")._input(appui)
	await _constater(montage, pont, deux_mains.marche, true, "la marche tenue")
	Input.action_release(&"avant")
	await _constater(montage, pont, deux_mains.repos, true, "la marche relâchée")
	_bouton(atelier, "Pause").pressed.emit()
	_choisir(atelier, "main", MontageDeComposition.VIDE)
	await _attendre(func() -> bool: return not montage.montes.has("main"))
	await _constater(montage, pont, base.clips.repos, false, "en pause, l'élément démonté")
	for faute in _fautes:
		push_error("[repos-de-l-atelier] " + faute)
	print("[repos-de-l-atelier] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Les images passées jusqu'à ce que `tenu` le soit, au plus `IMAGES_D_ATTENTE`.
func _attendre(tenu: Callable) -> void:
	for i in IMAGES_D_ATTENTE:
		if tenu.call():
			return
		await process_frame
	_fautes.append("attente échue")


## Après quelques images, le clip `clip` engagé au lecteur, en lecture si `lecture`, et l'écran publié qui le porte.
func _constater(montage: MontageDeComposition, pont: PontFige, clip: String, lecture: bool, moment: String) -> void:
	for i in 4:
		await process_frame
	var lecteur := montage.lecteur
	_verifier(lecteur.assigned_animation == clip and lecteur.is_playing() == lecture,
			"%s : %s %s, attendu %s %s" % [moment, lecteur.assigned_animation, lecteur.is_playing(), clip, lecture])
	var publie: Dictionary = pont.ecran.get("atelier", {})
	_verifier(publie.get("clip") == clip and publie.get("lecture") == lecture,
			"%s : écran publié %s %s, attendu %s %s" % [moment, publie.get("clip"), publie.get("lecture"), clip, lecture])
	print("[repos-de-l-atelier] %s : %s, lecture %s" % [moment, lecteur.assigned_animation, lecteur.is_playing()])


## La bascule de texte `texte` sous `atelier`.
func _bouton(atelier: Node, texte: String) -> Button:
	for bouton in atelier.find_children("*", "Button", true, false):
		if (bouton as Button).text == texte:
			return bouton
	_fautes.append("bouton %s absent" % texte)
	return Button.new()


## L'article d'id `id` choisi dans la liste de clé `cle`, son signal émis comme au clic.
func _choisir(atelier: Node, cle: String, id: String) -> void:
	for liste in atelier.find_children("*", "OptionButton", true, false):
		if liste.get_meta("cle", "") != cle:
			continue
		for rang in (liste as OptionButton).item_count:
			if liste.get_item_metadata(rang) == id:
				liste.select(rang)
				liste.item_selected.emit(rang)
				return
		_fautes.append("%s n'offre pas %s" % [cle, id])
		return
	_fautes.append("liste %s absente" % cle)


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
