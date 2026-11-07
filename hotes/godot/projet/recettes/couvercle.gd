extends SceneTree

## Le couvercle au-dessus de la tête du groupe sort du volume du monde (#3476, `hotes/godot/pont/CONTRAT.md`, section
## « Vue », `plateau.couvercle`) : sur un volume d'un triangle de sol au rez et d'un triangle de plancher à l'étage, le
## couvercle de la case de l'étage retire le plancher, et sa surface vidée, du maillage et de la forme que le rayon du
## pointeur touche, et garde la case du sol au triangle restant ; sans couvercle, le plancher revient.

const RECETTE_AUTONOME := true
const TRIANGLE := [0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 2.0]
const NORMALES := [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0]
const COULEURS := [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[couvercle] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var plancher := TRIANGLE.map(func(v: float) -> float: return v)
	plancher[1] = 4.0
	plancher[4] = 4.0
	plancher[7] = 4.0
	monde.poser({metresParCase = 2.0, positions = TRIANGLE + plancher, normales = NORMALES + NORMALES, couleurs = COULEURS + COULEURS,
		cases = [[0, 0, 0], [0, 0, 1]], surfaces = [{debut = 0, fin = 3, matiere = "terrain--terre"}, {debut = 3, fin = 6, matiere = "terrain--plancher"}],
		hauteurs = [{z = 0, rangees = [[0.0]]}, {z = 1, rangees = [[4.0]]}]})
	_verifier(monde, "sans couvercle", 2)
	monde.cacher_le_bati(["0,0,1"], [], [], [])
	_verifier(monde, "sous le couvercle de l'étage", 1)
	if monde._cases_des_triangles != [[0, 0, 0]]:
		_fautes.append("sous le couvercle de l'étage : cases %s, attendu le sol du rez" % [monde._cases_des_triangles])
	monde.cacher_le_bati([], [], [], [])
	_verifier(monde, "le couvercle levé", 2)
	for faute in _fautes:
		push_error("[couvercle] " + faute)
	print("[couvercle] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## `triangles` triangles au maillage du volume et à sa forme.
func _verifier(monde: Monde, moment: String, triangles: int) -> void:
	var maillage := (monde.get_node("Volume/Maillage") as MeshInstance3D).mesh
	var sommets := 0
	for surface in maillage.get_surface_count():
		sommets += maillage.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX].size()
	if sommets != triangles * Monde.SOMMETS_PAR_TRIANGLE:
		_fautes.append("%s : %d sommets au maillage, attendu %d" % [moment, sommets, triangles * Monde.SOMMETS_PAR_TRIANGLE])
	var faces := ((monde.get_node("Volume/Corps/Forme") as CollisionShape3D).shape as ConcavePolygonShape3D).get_faces().size()
	if faces != triangles * Monde.SOMMETS_PAR_TRIANGLE:
		_fautes.append("%s : %d sommets à la forme, attendu %d" % [moment, faces, triangles * Monde.SOMMETS_PAR_TRIANGLE])
