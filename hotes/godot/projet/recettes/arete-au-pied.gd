extends SceneTree

## Une arête se pose debout à son pied (#3476, `hotes/godot/pont/CONTRAT.md`, méthode `aretes`) :
## `pied` et `hauteurM` sont en mètres, le volume de la scène (`scripts/volume_de_scene.gd`, `poser_les_aretes`) les
## porte à l'échelle de son plateau, en groupes d'instances (#3948).
## Sur un plateau de 2 m par case, le mur d'étage du kit, pied à 4 m et haut de 4 m, va de 2 à 4 unités, centré sur le
## côté de sa case, et la boîte d'une arête sans pièce au kit part de 2 unités, chacun lu à l'instance de son arête
## (`VolumeDeScene.translation_d_instance`, l'instance d'un groupe ne se lit pas sans rendu). Posées à nouveau (#3947),
## le groupe inchangé reste, le groupe dont une arête change est refait, celui de l'arête changée naît, le groupe parti
## quitte l'arbre.

const RECETTE_AUTONOME := true
const EPSILON := 0.001
const METRES_PAR_CASE := 2.0
const PIED_M := 4.0
const HAUTEUR_M := 4.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arete-au-pied] version=", Engine.get_version_info().string)
	var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
	root.add_child(volume)
	volume.metres_par_case = METRES_PAR_CASE
	var arete := {milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = PIED_M, hauteurM = HAUTEUR_M, piece = "mur", bloc = "0/0/0"}
	var du_kit := arete.merged({cle = "kit", famille = "colombage"})
	var boite := arete.merged({cle = "boite", famille = null})
	var voisine := arete.merged({cle = "voisine", famille = null, milieu = {x = 1.0, y = -0.5}}, true)
	var partie := arete.merged({cle = "partie", famille = null, bloc = "0/1/0"}, true)
	volume.poser_les_aretes([du_kit, boite, voisine, partie])
	var aretes := volume.get_node("Aretes")
	var groupes := _groupes(aretes)
	if groupes.keys() != [["kit"], ["boite", "voisine"], ["partie"]]:
		_fautes.append("posées, les groupes sont %s, attendu le kit, les deux boîtes du bloc, la boîte de l'autre bloc" % [groupes.keys()])
	else:
		var mur := _boite_de(volume, groupes[["kit"]], du_kit)
		_verifier("pièce du kit", mur, PIED_M / METRES_PAR_CASE, (PIED_M + HAUTEUR_M) / METRES_PAR_CASE)
		var centre := mur.get_center()
		if absf(centre.x - (arete.milieu.x + MiseEnPage.DEMI_CASE)) > EPSILON or absf(centre.z - (arete.milieu.y + MiseEnPage.DEMI_CASE)) > EPSILON:
			_fautes.append("pièce du kit : centrée en %s, hors du côté de sa case" % centre)
		_verifier("boîte sans pièce", _boite_de(volume, groupes[["boite", "voisine"]], boite), PIED_M / METRES_PAR_CASE, NAN)
		_verifier("boîte voisine", _boite_de(volume, groupes[["boite", "voisine"]], voisine), PIED_M / METRES_PAR_CASE, NAN)
		if absf(_boite_de(volume, groupes[["boite", "voisine"]], voisine).get_center().x - _boite_de(volume, groupes[["boite", "voisine"]], boite).get_center().x - 1.0) > EPSILON:
			_fautes.append("les deux boîtes du groupe ne sont pas à une case l'une de l'autre")
	if volume.ce_qui_est_pose().aretes != 4:
		_fautes.append("posées, %d arêtes comptées, attendu 4" % volume.ce_qui_est_pose().aretes)
	volume.poser_les_aretes([du_kit.duplicate(true), boite.duplicate(true), voisine.merged({piece = "porte-ouverte"}, true)])
	var reposes := _groupes(aretes)
	if reposes.keys() != [["kit"], ["boite"], ["voisine"]]:
		_fautes.append("posées à nouveau, les groupes sont %s, attendu le kit, la boîte, le seuil" % [reposes.keys()])
	elif groupes.size() == 3:
		if reposes[["kit"]] != groupes[["kit"]]:
			_fautes.append("posé à nouveau, le groupe inchangé n'est pas gardé")
		if reposes.values().has(groupes[["boite", "voisine"]]) or reposes.values().has(groupes[["partie"]]):
			_fautes.append("posés à nouveau, le groupe changé ou le groupe parti est gardé")
		if not is_instance_valid(groupes[["kit"]]) or is_instance_valid(groupes[["boite", "voisine"]]) or is_instance_valid(groupes[["partie"]]):
			_fautes.append("posés à nouveau, le groupe changé ou le groupe parti n'a pas quitté l'arbre")
	if volume.ce_qui_est_pose().aretes != 3:
		_fautes.append("posées à nouveau, %d arêtes comptées, attendu 3" % volume.ce_qui_est_pose().aretes)
	for faute in _fautes:
		push_error("[arete-au-pied] " + faute)
	print("[arete-au-pied] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Chaque groupe posé sous `aretes`, par les clés de ses arêtes, et le nombre de ses instances au nombre de ses arêtes.
func _groupes(aretes: Node) -> Dictionary:
	var groupes := {}
	for groupe: Node3D in aretes.get_children():
		var cles: Array = groupe.get_meta("aretes").map(func(a: Dictionary) -> String: return a.cle)
		groupes[cles] = groupe
		for instances: MultiMeshInstance3D in groupe.find_children("*", "MultiMeshInstance3D", true, false):
			if instances.multimesh.instance_count != cles.size():
				_fautes.append("groupe %s : %s porte %d instances" % [cles, instances.name, instances.multimesh.instance_count])
	return groupes


## La boîte, dans le monde, de l'instance de l'arête `a` de chaque maillage vu du groupe `groupe`.
func _boite_de(volume: VolumeDeScene, groupe: Node3D, a: Dictionary) -> AABB:
	var boite := AABB()
	var premiere := true
	for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
		var b := vu.global_transform * Transform3D(Basis.IDENTITY, volume.translation_d_instance(vu, a)) * vu.multimesh.mesh.get_aabb()
		boite = b if premiere else boite.merge(b)
		premiere = false
	if premiere:
		_fautes.append("%s : aucun maillage" % groupe.name)
	return boite


## Le bas de `boite` à `bas`, et son haut à `haut` si `haut` n'est pas `NAN`.
func _verifier(nom: String, boite: AABB, bas: float, haut: float) -> void:
	if absf(boite.position.y - bas) > EPSILON:
		_fautes.append("%s : bas à %.3f, attendu %.3f" % [nom, boite.position.y, bas])
	if not is_nan(haut) and absf(boite.end.y - haut) > EPSILON:
		_fautes.append("%s : haut à %.3f, attendu %.3f" % [nom, boite.end.y, haut])
