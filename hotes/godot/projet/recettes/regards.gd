extends SceneTree

## Les regards du monde (#3476, `hotes/godot/pont/CONTRAT.md`, section « Vue », `plateau.regard`) : au plateau, la caméra
## à la verticale et sans perspective ; en immersion, l'œil, qui ne projette rien derrière lui ; en tactique, la caméra
## de biais en perspective. Sous l'œil, le sol touché à la verticale d'un lieu est celui de la couche sous lui : sur un
## volume d'un sol au rez et d'un plancher d'étage à 4 m, au-dessus de la même case, le rez sous l'œil d'en bas,
## l'étage sous l'œil d'en haut.

const RECETTE_AUTONOME := true
const TRIANGLE := [0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 2.0]
const PLANCHER := [0.0, 4.0, 0.0, 2.0, 4.0, 0.0, 0.0, 4.0, 2.0]
const NORMALES := [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0]
const COULEURS := [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[regards] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde.poser({metresParCase = 2.0, positions = TRIANGLE + PLANCHER, normales = NORMALES + NORMALES, couleurs = COULEURS + COULEURS,
		cases = [[0, 0, 0], [0, 0, 1]], surfaces = [{debut = 0, fin = 6, matiere = "terrain--terre"}],
		hauteurs = [{z = 0, rangees = [[0.0]]}, {z = 1, rangees = [[4.0]]}]})
	await physics_frame
	_sol(monde, Vector3(0.6, 1.0, 0.6), Vector3i(0, 0, 0), 0.0)
	_sol(monde, Vector3(0.6, 3.0, 0.6), Vector3i(0, 0, 1), 2.0)
	var camera: Camera3D = monde.get_node("Pivot/Inclinaison/Camera")
	monde.regarder("plateau")
	if camera.projection != Camera3D.PROJECTION_ORTHOGONAL or not is_equal_approx((monde.get_node("Pivot/Inclinaison") as Node3D).rotation.x, MiseEnPage.TANGAGE_DU_PLATEAU):
		_fautes.append("plateau : la caméra n'est ni à la verticale ni sans perspective")
	monde.regarder("immersion")
	if root.get_viewport().get_camera_3d() != monde.get_node("Oeil"):
		_fautes.append("immersion : la caméra du regard n'est pas l'œil")
	monde.poser_l_oeil(Vector3(0.6, 0.85, 0.6), 0.0, 0.0)
	if monde.a_l_ecran(Vector3(0.6, 0.85, 5.0)) != null:
		_fautes.append("immersion : un lieu derrière l'œil a un point à l'écran")
	if monde.a_l_ecran(Vector3(0.6, 0.85, -5.0)) == null:
		_fautes.append("immersion : un lieu devant l'œil n'a pas de point à l'écran")
	monde.regarder("tactique")
	if root.get_viewport().get_camera_3d() != camera or camera.projection != Camera3D.PROJECTION_PERSPECTIVE:
		_fautes.append("tactique : la caméra du regard n'est pas celle de biais, en perspective")
	for faute in _fautes:
		push_error("[regards] " + faute)
	print("[regards] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le sol touché à la verticale de `lieu` : sur la case `case`, à la hauteur `hauteur`.
func _sol(monde: Monde, lieu: Vector3, case: Vector3i, hauteur: float) -> void:
	var sol: Variant = monde.sol_sous(lieu)
	if sol == null:
		_fautes.append("sous %s : aucun sol" % lieu)
	elif sol.case != case or not is_equal_approx(sol.lieu.y, hauteur):
		_fautes.append("sous %s : %s à %.2f, attendu %s à %.2f" % [lieu, sol.case, sol.lieu.y, case, hauteur])
