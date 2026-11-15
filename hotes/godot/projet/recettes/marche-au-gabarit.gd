extends SceneTree

## La marche couplée au gabarit (#3314, `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ») : sur une pose de marche
## engagée au lecteur, `GabaritDuSquelette` plie les jambes d'un gabarit à `legs` autre que 1 pour que chaque pied garde
## la pose du corps neutre à l'échelle `sl` de la racine, translation au sol près ; à `legs` 1, ou sur un clip non
## planté, il ne plie rien. La pose se relève au signal `skeleton_updated`, après les modificateurs et avant que le
## squelette ne restaure la pose non modifiée (`Skeleton3D::_notification`, Godot 4.7).

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const MARCHE := "Marche"
const ROULADE := "Roulade"
const SL := 1.1
const PIEDS := ["pied_g", "pied_d"]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[marche-au-gabarit] version=", Engine.get_version_info().string)
	for legs in [0.62, 1.12]:
		await _verifier("legs %s, marche" % legs, legs, MARCHE, true)
		await _verifier("legs %s, clip non planté" % legs, legs, ROULADE, false)
	await _verifier("legs 1, marche", 1.0, MARCHE, true)
	for faute in _fautes:
		push_error("[marche-au-gabarit] " + faute)
	print("[marche-au-gabarit] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une racine au bassin, deux jambes à trois os dont l'axe +Y local suit l'os (convention des os glTF exportés de
## Blender), sur une pose de marche : la jambe gauche en avant, genou fléchi, la droite en arrière.
func _squelette() -> Skeleton3D:
	var squelette := Skeleton3D.new()
	root.add_child(squelette)
	var bas := Basis(Vector3.BACK, PI)
	for os in [{nom = "racine", parent = "", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.95, 0.0))},
			{nom = "cuisse_g", parent = "racine", repos = Transform3D(bas, Vector3(0.1, 0.0, 0.0))},
			{nom = "mollet_g", parent = "cuisse_g", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.45, 0.0))},
			{nom = "pied_g", parent = "mollet_g", repos = Transform3D(Basis.from_euler(Vector3(-1.2, 0.0, 0.0)), Vector3(0.0, 0.42, 0.0))},
			{nom = "cuisse_d", parent = "racine", repos = Transform3D(bas, Vector3(-0.1, 0.0, 0.0))},
			{nom = "mollet_d", parent = "cuisse_d", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.45, 0.0))},
			{nom = "pied_d", parent = "mollet_d", repos = Transform3D(Basis.from_euler(Vector3(-1.2, 0.0, 0.0)), Vector3(0.0, 0.42, 0.0))}]:
		var indice := squelette.add_bone(os.nom)
		if os.parent != "":
			squelette.set_bone_parent(indice, squelette.find_bone(os.parent))
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	for pose in [{os = "racine", angle = Vector3(0.0, 0.1, 0.0)}, {os = "cuisse_g", angle = Vector3(-0.45, 0.0, 0.05)},
			{os = "mollet_g", angle = Vector3(0.6, 0.0, 0.0)}, {os = "pied_g", angle = Vector3(-1.4, 0.0, 0.0)},
			{os = "cuisse_d", angle = Vector3(0.35, 0.0, -0.03)}, {os = "mollet_d", angle = Vector3(0.25, 0.0, 0.0)}]:
		var indice := squelette.find_bone(pose.os)
		squelette.set_bone_pose_rotation(indice, squelette.get_bone_rest(indice).basis.get_rotation_quaternion() * Quaternion.from_euler(pose.angle))
	return squelette


func _lecteur(clip: String) -> AnimationPlayer:
	var lecteur := AnimationPlayer.new()
	var bibliotheque := AnimationLibrary.new()
	for nom in [MARCHE, ROULADE]:
		bibliotheque.add_animation(nom, Animation.new())
	lecteur.add_animation_library("", bibliotheque)
	root.add_child(lecteur)
	lecteur.assigned_animation = clip
	return lecteur


func _verifier(cas: String, legs: float, clip: String, plie: bool) -> void:
	var squelette := _squelette()
	var neutre := _pose(squelette)
	var lecteur := _lecteur(clip)
	var gabarit := GabaritDuSquelette.new()
	gabarit.lecteur = lecteur
	squelette.add_child(gabarit)
	var absents := gabarit.poser({racine = {os = "racine", echelle = SL},
			enfantsDe = {cuisse_g = legs, mollet_g = legs, cuisse_d = legs, mollet_d = legs}, pieds = PIEDS,
			jambes = ["cuisse_g", "mollet_g", "cuisse_d", "mollet_d"], clipsPlantes = [MARCHE], deplacementsDesOs = {}})
	var releve := {}
	squelette.skeleton_updated.connect(func() -> void: releve.merge(_pose(squelette), true))
	await process_frame
	await process_frame
	var ecart := 0.0
	var plus_bas := INF
	for pied in PIEDS:
		var attendu: Transform3D = neutre.racine * Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * SL), Vector3.ZERO) * neutre.racine.affine_inverse() * neutre[pied]
		var obtenu: Transform3D = releve[pied]
		ecart = maxf(ecart, Vector2(obtenu.origin.x - attendu.origin.x, obtenu.origin.z - attendu.origin.z).length())
		for axe in 3:
			ecart = maxf(ecart, obtenu.basis[axe].normalized().distance_to(attendu.basis[axe].normalized()))
		plus_bas = minf(plus_bas, obtenu.origin.y)
	var sol := minf(neutre.pied_g.origin.y, neutre.pied_d.origin.y)
	var juste := absents.is_empty() and absf(plus_bas - sol) < EPSILON and ((ecart < EPSILON) == (plie or legs == 1.0))
	if not juste:
		_fautes.append("%s : écart des pieds %s, pied le plus bas %s pour %s, os absents %s" % [cas, ecart, plus_bas, sol, absents])
	print("[marche-au-gabarit] %s : écart des pieds %.6f, %s" % [cas, ecart, "OK" if juste else "KO"])
	squelette.queue_free()
	lecteur.queue_free()
	await process_frame


## La pose de chaque os de `squelette`, par nom, dans le repère du squelette.
func _pose(squelette: Skeleton3D) -> Dictionary:
	var pose := {}
	for os in squelette.get_bone_count():
		pose[squelette.get_bone_name(os)] = squelette.get_bone_global_pose(os)
	return pose
