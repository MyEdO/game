extends SceneTree

## Le clavier du monde (#3760, `Monde.forces_du_clavier`) : sur un volume de deux cases au regard `tactique`, la Flèche
## bas tenue pendant qu'une liste déroulante est ouverte descend dans la liste sans faire glisser la caméra ; la liste
## refermée, la même touche tenue la fait reculer ; un champ de saisie qui a le focus garde la touche S.

const RECETTE_AUTONOME := true
## Le sol de chaque case, en mètres, dans le repère du volume : la case (0, 0) centrée sur l'origine.
const REZ := [-1.0, 0.0, -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, 1.0,
	1.0, 0.0, -1.0, 3.0, 0.0, -1.0, 1.0, 0.0, 1.0, 3.0, 0.0, -1.0, 3.0, 0.0, 1.0, 1.0, 0.0, 1.0]
const CASES := [0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]
const SOMMETS := 12
## Les images que chaque touche reste tenue.
const IMAGES_TENUES := 3
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[clavier-du-monde] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var normales := []
	var couleurs := []
	for _sommet in SOMMETS:
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([1.0, 1.0, 1.0, 1.0])
	var morceau := {cle = "sol/0/0/0", empreinte = "sol", rangee = 0, positions = REZ, normales = normales, couleurs = couleurs, cases = CASES,
		surfaces = [{debut = 0, fin = SOMMETS, matiere = "terrain--terre"}]}
	monde.poser({monde = {metresParCase = 2.0, hauteurs = [{z = 0, rangees = [[0.0, 0.0]]}], morceaux = [morceau]}, toits = [], couronnes = []},
		{volume = [morceau], toits = [], couronnes = []})
	monde.regarder("tactique")
	var panneau := VBoxContainer.new()
	root.add_child(panneau)
	var liste := OptionButton.new()
	for article in ["Humain", "Nain", "Halfling"]:
		liste.add_item(article)
	panneau.add_child(liste)
	var saisie := LineEdit.new()
	panneau.add_child(saisie)
	await process_frame
	var pivot: Node3D = monde.get_node("Pivot")
	var depart := pivot.position

	liste.show_popup()
	await process_frame
	var forces := await _tenir(KEY_DOWN, monde)
	_attendu(liste.get_popup().get_focused_item(), 1, "l'article de la liste ouverte que la Flèche bas focalise")
	_attendu(forces, [0.0, 0.0, 0.0, 0.0], "les forces du clavier, la liste ouverte")
	_attendu(pivot.position, depart, "le pivot de la caméra, la liste ouverte")

	liste.get_popup().hide()
	saisie.grab_focus()
	await process_frame
	forces = await _tenir(KEY_S, monde)
	_attendu(forces, [0.0, 0.0, 0.0, 0.0], "les forces du clavier, la saisie en focus")
	_attendu(pivot.position, depart, "le pivot de la caméra, la saisie en focus")

	saisie.release_focus()
	await process_frame
	forces = await _tenir(KEY_DOWN, monde)
	_attendu(forces, [0.0, 0.0, 0.0, 1.0], "les forces du clavier, la liste refermée")
	if pivot.position.is_equal_approx(depart):
		_fautes.append("la liste refermée, la Flèche bas tenue ne fait pas reculer la caméra : pivot en %s" % pivot.position)

	for faute in _fautes:
		push_error("[clavier-du-monde] " + faute)
	print("[clavier-du-monde] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La touche `touche` appuyée, tenue `IMAGES_TENUES` images, puis relâchée : les forces que le monde lisait tenue.
func _tenir(touche: Key, monde: Monde) -> Array[float]:
	_frapper(touche, true)
	for _image in IMAGES_TENUES:
		await process_frame
	var forces := monde.forces_du_clavier()
	_frapper(touche, false)
	await process_frame
	return forces


func _frapper(touche: Key, appuyee: bool) -> void:
	var evenement := InputEventKey.new()
	evenement.keycode = touche
	evenement.physical_keycode = touche
	evenement.pressed = appuyee
	Input.parse_input_event(evenement)


func _attendu(obtenu: Variant, attendu: Variant, quoi: String) -> void:
	if obtenu != attendu:
		_fautes.append("%s : %s, attendu %s" % [quoi, obtenu, attendu])
