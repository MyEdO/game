extends SceneTree

## Le cadrage d'une recette (#3686, `hotes/godot/pont/CONTRAT.md`, section « Écran publié », `wfrpCadrer`,
## `Plateau.cadrer`) : sur un volume de deux cases au rez et d'un plancher d'étage à 4 m au-dessus d'elles, l'œil de
## l'immersion posé sur la seconde case de l'étage, à l'azimut 90 et au tangage -20, se tient à hauteur d'homme au-dessus
## de son sol, regarde à l'est, la souris libérée et le point de mire caché, et aucune case ne se joue ; un cadrage d'un autre regard, d'une clé hors contrat ou
## manquante, d'une case hors du plateau ou d'une couche absente, d'une case non entière, d'un tangage hors bornes ou d'un
## azimut qui n'est pas un nombre se refuse sans rien poser, comme l'œil hors d'exploration. La caméra de la tactique se
## pose sur une case du rez, à un azimut et une distance ; celle du plateau regarde à l'azimut demandé ; un zoom hors
## bornes se refuse.

const RECETTE_AUTONOME := true
## Le sol de chaque case, en mètres, dans le repère du volume : la case (0, 0) centrée sur l'origine.
const REZ := [-1.0, 0.0, -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, 1.0,
	1.0, 0.0, -1.0, 3.0, 0.0, -1.0, 1.0, 0.0, 1.0, 3.0, 0.0, -1.0, 3.0, 0.0, 1.0, 1.0, 0.0, 1.0]
const ETAGE := [-1.0, 4.0, -1.0, 1.0, 4.0, -1.0, -1.0, 4.0, 1.0, 1.0, 4.0, -1.0, 1.0, 4.0, 1.0, -1.0, 4.0, 1.0,
	1.0, 4.0, -1.0, 3.0, 4.0, -1.0, 1.0, 4.0, 1.0, 3.0, 4.0, -1.0, 3.0, 4.0, 1.0, 1.0, 4.0, 1.0]
const CASES := [0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]
## Les sommets des huit triangles.
const SOMMETS := 24
const OEIL_M := 1.7
const METRES_PAR_CASE := 2.0
## L'œil posé sur la case (1, 0) de l'étage : au centre de la case, 4 m puis 1,7 m au-dessus du rez, en unités du plateau.
const OEIL_ATTENDU := Vector3(1.5, 2.85, 0.5)
const DEVANT := Vector3(6.0, 2.85, 0.5)
const DERRIERE := Vector3(-4.0, 2.85, 0.5)
const CADRAGE := {regard = "immersion", case = {x = 1.0, y = 0.0}, etage = 1.0, lacet = 90.0, tangage = -20.0}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[cadrage] version=", Engine.get_version_info().string)
	var plateau: Plateau = (load("res://scenes/Plateau.tscn") as PackedScene).instantiate()
	root.add_child(plateau)
	var monde: Monde = plateau.get_node("Monde")
	var normales := []
	var couleurs := []
	for _sommet in SOMMETS:
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([1.0, 1.0, 1.0, 1.0])
	var positions := REZ.duplicate()
	positions.append_array(ETAGE)
	var morceau := {cle = "sol/0/0/0", empreinte = "sol", rangee = 0, positions = positions, normales = normales, couleurs = couleurs, cases = CASES,
		surfaces = [{debut = 0, fin = SOMMETS, matiere = "terrain--terre"}]}
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = [[0.0, 0.0]]}, {z = 1, rangees = [[4.0, 4.0]]}],
		morceaux = [morceau]}, toits = [], couronnes = []}, {volume = [morceau], toits = [], couronnes = []})
	await physics_frame
	monde.regarder("immersion")
	var immersion: Immersion = plateau.get_node("Immersion")
	var jouees: Array = []
	immersion.case_jouee.connect(func(case: Vector3i) -> void: jouees.append(case))
	_refus(plateau, CADRAGE, "exploration")
	immersion.montrer({projection = {exploration = {groupe = [0, 0], etage = null, cap = "N"}}, champ = {},
		plateau = {regard = "immersion", oeilM = OEIL_M, oeilsSousPlafond = {}, metresParCase = METRES_PAR_CASE}})
	var mire: CanvasItem = immersion.get_node("Viseur/Mire")
	_attendu(mire.visible, true, "le point de mire de l'œil mené")
	_attendu(plateau.cadrer(CADRAGE), "", "le cadrage de l'immersion")
	_attendu(mire.visible, false, "le point de mire de l'œil posé")
	await physics_frame
	var oeil: Camera3D = monde.get_node("Oeil")
	_oeil(oeil, "posé")
	_camera(plateau, [1, 0, 1], 90.0, -20.0, null)
	if monde.a_l_ecran(DEVANT) == null or monde.a_l_ecran(DERRIERE) != null:
		_fautes.append("immersion : l'œil ne regarde pas à l'est")
	_attendu(jouees, [], "les cases jouées")
	for refuse: Array in [
		[{regard = "tactique", case = {x = 1, y = 0}, etage = 1, lacet = 90, zoom = 12}, "sous le regard immersion"],
		[CADRAGE.merged({zoom = 12}), "hors contrat : zoom"],
		[{regard = "immersion", case = {x = 1, y = 0}, etage = 1, lacet = 90}, "manquante : tangage"],
		[CADRAGE.merged({case = {x = 2, y = 0}}, true), "hors du plateau"],
		[CADRAGE.merged({etage = 2}, true), "hors du plateau"],
		[CADRAGE.merged({case = {x = 0.5, y = 0}}, true), "entiers attendus"],
		[CADRAGE.merged({tangage = 85}, true), "tangage 85"],
		[CADRAGE.merged({lacet = "est"}, true), "lacet : un nombre attendu"],
	]:
		_refus(plateau, refuse[0], refuse[1])
	await physics_frame
	_oeil(oeil, "après les refus")
	monde.regarder("tactique")
	_attendu(plateau.cadrer({regard = "tactique", case = {x = 0, y = 0}, lacet = 180, zoom = 12}), "", "le cadrage de la tactique")
	await physics_frame
	var pivot: Node3D = monde.get_node("Pivot")
	if not pivot.position.is_equal_approx(monde.lieu(Vector2i(0, 0), 0)):
		_fautes.append("tactique : le pivot en %s, attendu sur le sol de la case (0, 0) du rez" % pivot.position)
	_camera(plateau, [0, 0, 0], 180.0, rad_to_deg(Monde.TANGAGE_TACTIQUE), 12.0)
	_refus(plateau, {regard = "tactique", case = {x = 0, y = 0}, lacet = 180, zoom = 50}, "zoom 50")
	monde.regarder("plateau")
	_attendu(plateau.cadrer({regard = "plateau", case = {x = 1, y = 0}, etage = 1, lacet = 90, zoom = 10}), "", "le cadrage du plateau")
	await physics_frame
	_camera(plateau, [1, 0, 1], 90.0, rad_to_deg(MiseEnPage.TANGAGE_DU_PLATEAU), 10.0)
	for faute in _fautes:
		push_error("[cadrage] " + faute)
	print("[cadrage] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## L'œil `oeil` à la place et au regard du cadrage de l'immersion.
func _oeil(oeil: Camera3D, quand: String) -> void:
	if not oeil.global_position.is_equal_approx(OEIL_ATTENDU) or not oeil.rotation.is_equal_approx(Vector3(deg_to_rad(-20.0), MiseEnPage.lacet_de_l_azimut(90.0), 0.0)):
		_fautes.append("immersion (%s) : l'œil en %s tourné de %s, attendu en %s" % [quand, oeil.global_position, oeil.rotation, OEIL_ATTENDU])


## La caméra que rend le plateau : sur la case `case`, à l'azimut `lacet`, au tangage `tangage`, à la distance `zoom`.
func _camera(plateau: Plateau, case: Array, lacet: float, tangage: float, zoom: Variant) -> void:
	var camera := plateau.camera()
	var juste: bool = camera.case == case and is_equal_approx(camera.lacet, lacet) and is_equal_approx(camera.tangage, tangage)
	if not juste or (zoom == null) != (camera.zoom == null) or (zoom != null and not is_equal_approx(camera.zoom, zoom)):
		_fautes.append("%s : caméra %s, attendue sur %s à l'azimut %s, au tangage %s, au zoom %s" % [camera.regard, camera, case, lacet, tangage, zoom])


## Le cadrage `cadrage` refusé d'un message qui contient `motif`.
func _refus(plateau: Plateau, cadrage: Dictionary, motif: String) -> void:
	var refus := plateau.cadrer(cadrage)
	if not refus.contains(motif):
		_fautes.append("%s : refus « %s », attendu « …%s… »" % [JSON.stringify(cadrage), refus, motif])


func _attendu(obtenu: Variant, attendu: Variant, quoi: String) -> void:
	if obtenu != attendu:
		_fautes.append("%s : %s, attendu %s" % [quoi, obtenu, attendu])
