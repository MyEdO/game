extends SceneTree

## Les regards du monde (#3476, `hotes/godot/pont/CONTRAT.md`, section « Vue », `plateau.regard`) : au plateau, la caméra
## à la verticale et sans perspective ; en immersion, l'œil, qui ne projette rien derrière lui ; en tactique, la caméra
## de biais en perspective. Sous l'œil, le sol touché à la verticale d'un lieu est celui de la couche sous lui : sur un
## volume d'un sol au rez et d'un plancher d'étage à 4 m, au-dessus de la même case, le rez sous l'œil d'en bas,
## l'étage sous l'œil d'en haut. La plaque de surbrillance du rez, sous le plancher, se montre au plateau et en
## tactique, aucune en immersion (#3774), peinte avant l'œil ou sous lui. Repeinte, la plaque d'une case garde son nœud,
## à l'item qu'on lui donne ; celle d'une case qui n'est plus peinte le quitte (#3947).

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
	var rez := {cle = "sol/0/0/0", empreinte = "rez", rangee = 0, positions = TRIANGLE, normales = NORMALES, couleurs = COULEURS,
		cases = [0, 0, 0], surfaces = [{debut = 0, fin = 3, matiere = "terrain--terre"}]}
	var etage := {cle = "sol/1/0/0", empreinte = "etage", rangee = 2, positions = PLANCHER, normales = NORMALES, couleurs = COULEURS,
		cases = [0, 0, 1], surfaces = [{debut = 0, fin = 3, matiere = "terrain--terre"}]}
	monde.poser({monde = {metresParCase = 2.0, hauteurs = [{z = 0, rangees = [[0.0]]}, {z = 1, rangees = [[4.0]]}], morceaux = [rez, etage]},
		toits = [], couronnes = []}, {volume = [rez, etage], toits = [], couronnes = []})
	await physics_frame
	_sol(monde, Vector3(0.6, 1.0, 0.6), Vector3i(0, 0, 0), 0.0)
	_sol(monde, Vector3(0.6, 3.0, 0.6), Vector3i(0, 0, 1), 2.0)
	monde.peindre({Vector3i(0, 0, 0): Monde.ITEM_SURVOL})
	var camera: Camera3D = monde.get_node("Pivot/Inclinaison/Camera")
	monde.regarder("plateau")
	if camera.projection != Camera3D.PROJECTION_ORTHOGONAL or not is_equal_approx((monde.get_node("Pivot/Inclinaison") as Node3D).rotation.x, MiseEnPage.TANGAGE_DU_PLATEAU):
		_fautes.append("plateau : la caméra n'est ni à la verticale ni sans perspective")
	_plaques(monde, "plateau", 1)
	monde.regarder("immersion")
	_plaques(monde, "immersion", 0)
	monde.peindre({Vector3i(0, 0, 0): Monde.ITEM_SURVOL})
	_plaques(monde, "immersion, plaque peinte sous l'œil", 0)
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
	_plaques(monde, "tactique", 1)
	var surbrillance := monde.get_node("Surbrillance")
	var du_rez := surbrillance.get_child(0).get_instance_id()
	monde.peindre({Vector3i(0, 0, 0): Monde.ITEM_CIBLE, Vector3i(0, 0, 1): Monde.ITEM_SURVOL})
	var repeintes := surbrillance.get_children()
	if repeintes.size() != 2 or repeintes[0].get_instance_id() != du_rez or repeintes[0].mesh != monde.surbrillances.get_item_mesh(Monde.ITEM_CIBLE):
		_fautes.append("repeinte en cible, la plaque du rez ne garde pas son nœud à l'item de la cible")
	var de_l_etage := repeintes[1].get_instance_id()
	monde.peindre({Vector3i(0, 0, 1): Monde.ITEM_SURVOL})
	var restees := surbrillance.get_children()
	var sur_l_etage := monde.surbrillances.get_item_mesh_transform(Monde.ITEM_SURVOL).translated(monde.lieu(Vector2i(0, 0), 1)).origin
	if restees.size() != 1 or restees[0].get_instance_id() != de_l_etage or not restees[0].position.is_equal_approx(sur_l_etage):
		_fautes.append("la case du rez n'est plus peinte : sa plaque reste, ou celle de l'étage ne garde pas son nœud sur son sol")
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


## Sous le regard `regard`, `attendues` plaques de surbrillance montrées.
func _plaques(monde: Monde, regard: String, attendues: int) -> void:
	var montrees := monde.get_node("Surbrillance").get_children().filter(func(plaque: MeshInstance3D) -> bool: return plaque.is_visible_in_tree()).size()
	if montrees != attendues:
		_fautes.append("%s : %d plaques de surbrillance montrées, attendu %d" % [regard, montrees, attendues])
