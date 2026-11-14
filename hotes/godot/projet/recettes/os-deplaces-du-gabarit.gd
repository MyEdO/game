extends SceneTree

## Les os déplacés du gabarit (#4002, `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ») : sous un gabarit qui ne
## pose que des `deplacementsDesOs`, chaque os est à son repos plus son déplacement, et chaque liaison d'une pièce
## skinnée, fondue ou dessinée seule, est compensée : au repos, `pose(os) · liaison′ = repos(os) · liaison`, la peau
## vaut bind et clés quels que soient ses poids ; une pièce rigide suit son os. Le skin du GLB n'est jamais écrit. Deux
## poses de suite ne cumulent rien, et sans gabarit les liaisons sont celles de l'auteur. Sur un clip planté, chaque
## pied finit à sa visée translatée du déplacement de son pied, jambes pliées ou non. La pose se relève au signal
## `skeleton_updated`, après les modificateurs et avant que le squelette ne restaure la pose non modifiée
## (`Skeleton3D::_notification`, Godot 4.7).

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const MARCHE := "Marche"
const SL := 1.1
const PIEDS := ["pied_g", "pied_d"]
const JAMBES := ["cuisse_g", "mollet_g", "cuisse_d", "mollet_d"]
const DEPLACEMENTS := {cuisse_g = [0.07, 0.0, 0.0], cuisse_d = [-0.07, 0.0, 0.0], bras_g = [0.15, 0.02, 0.0]}
## Un repère du mesh qui n'est pas celui du squelette : les liaisons ne sont pas les inverses des repos.
const DECALAGE_DU_MESH := Transform3D(Basis(Vector3.UP, 0.4), Vector3(0.02, 0.0, 0.03))
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[os-deplaces-du-gabarit] version=", Engine.get_version_info().string)
	await _au_repos()
	for legs in [1.0, 0.62]:
		await _sur_le_clip_plante(legs)
	for faute in _fautes:
		push_error("[os-deplaces-du-gabarit] " + faute)
	print("[os-deplaces-du-gabarit] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une racine, un bassin tourné, deux jambes à trois os dont l'axe +Y local suit l'os (convention des os glTF exportés
## de Blender), et une colonne qui porte une clavicule et un bras, chaque os à son repos.
func _squelette() -> Skeleton3D:
	var squelette := Skeleton3D.new()
	var bas := Basis(Vector3.BACK, PI)
	for os in [{nom = "racine", parent = "", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.95, 0.0))},
			{nom = "bassin", parent = "racine", repos = Transform3D(Basis(Vector3.UP, 0.3), Vector3(0.0, 0.05, 0.0))},
			{nom = "cuisse_g", parent = "bassin", repos = Transform3D(bas, Vector3(0.1, 0.0, 0.0))},
			{nom = "mollet_g", parent = "cuisse_g", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.45, 0.0))},
			{nom = "pied_g", parent = "mollet_g", repos = Transform3D(Basis.from_euler(Vector3(-1.2, 0.0, 0.0)), Vector3(0.0, 0.42, 0.0))},
			{nom = "cuisse_d", parent = "bassin", repos = Transform3D(bas, Vector3(-0.1, 0.0, 0.0))},
			{nom = "mollet_d", parent = "cuisse_d", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.45, 0.0))},
			{nom = "pied_d", parent = "mollet_d", repos = Transform3D(Basis.from_euler(Vector3(-1.2, 0.0, 0.0)), Vector3(0.0, 0.42, 0.0))},
			{nom = "colonne", parent = "bassin", repos = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.1, 0.0))},
			{nom = "clavicule_g", parent = "colonne", repos = Transform3D(Basis(Vector3.BACK, -1.2), Vector3(0.05, 0.4, 0.0))},
			{nom = "bras_g", parent = "clavicule_g", repos = Transform3D(Basis(Vector3.BACK, -0.3), Vector3(0.0, 0.15, 0.0))}]:
		var indice := squelette.add_bone(os.nom)
		if os.parent != "":
			squelette.set_bone_parent(indice, squelette.find_bone(os.parent))
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	return squelette


## Le gabarit qui ne pose que `deplacements`, à l'échelle de racine `echelle`, les jambes à `legs`.
static func _gabarit(deplacements: Dictionary, echelle: float, legs: float) -> Dictionary:
	var enfants_de := {} if legs == 1.0 else {cuisse_g = legs, mollet_g = legs, cuisse_d = legs, mollet_d = legs}
	return {racine = {os = "racine", echelle = echelle}, enfantsDe = enfants_de, pieds = PIEDS, jambes = JAMBES,
		clipsPlantes = [MARCHE], deplacementsDesOs = deplacements}


## Au repos, sur un montage : une pièce skinnée fondue, une pièce skinnée dessinée seule (son mesh hors du repère du
## squelette) et une pièce rigide sous le `BoneAttachment3D` du bras.
func _au_repos() -> void:
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	var modele := Node3D.new()
	montage.add_child(modele)
	var squelette := _squelette()
	modele.add_child(squelette)
	montage.modele = modele
	montage.squelette = squelette
	montage.gabarit = GabaritDuSquelette.new()
	squelette.add_child(montage.gabarit)
	var cuir := StandardMaterial3D.new()
	var corps := _skinnee("Corps", squelette, cuir, [{bassin = 0.5, cuisse_g = 0.5}, {cuisse_g = 0.3, mollet_g = 0.7},
		{clavicule_g = 0.4, bras_g = 0.6}, {cuisse_d = 0.5, bassin = 0.5}, {mollet_d = 1.0}, {colonne = 0.2, bras_g = 0.8}])
	var manche := _skinnee("Manche", squelette, cuir, [{clavicule_g = 0.5, bras_g = 0.5}, {bras_g = 1.0}, {colonne = 0.3, clavicule_g = 0.7}])
	manche.transform = Transform3D(Basis.IDENTITY, Vector3(0.0, 0.0, 0.01))
	var epaulette := _rigide("Epaulette", squelette, "bras_g", cuir)
	var origines := {corps = _poses_des_liaisons(corps.skin), manche = _poses_des_liaisons(manche.skin)}
	var auteur := manche.skin
	var releve := {}
	var relever := func() -> void:
		releve.merge(_pose(squelette), true)
		releve.epaulette = squelette.global_transform.affine_inverse() * epaulette.global_transform
	squelette.skeleton_updated.connect(relever)

	for passe in ["première pose", "deuxième pose"]:
		montage.composee = {gabarit = _gabarit(DEPLACEMENTS, 1.0, 1.0)}
		var absents := montage.poser_le_gabarit()
		if not absents.is_empty():
			_fautes.append("%s : os absents %s" % [passe, absents])
		await _images()
		_verifier_le_repos(passe, montage, squelette, releve, DEPLACEMENTS, corps, manche, epaulette, origines, auteur)
	montage.composee = {}
	montage.poser_le_gabarit()
	await _images()
	_verifier_le_repos("sans gabarit", montage, squelette, releve, {}, corps, manche, epaulette, origines, auteur)
	montage.queue_free()
	await process_frame


func _verifier_le_repos(cas: String, montage: MontageDeComposition, squelette: Skeleton3D, pose: Dictionary, deplacements: Dictionary,
		corps: MeshInstance3D, manche: MeshInstance3D, epaulette: MeshInstance3D, origines: Dictionary, auteur: Skin) -> void:
	var fautes := _fautes.size()
	var attendue := _pose_deplacee(squelette, deplacements)
	for nom: String in attendue:
		if not (pose[nom] as Transform3D).is_equal_approx(attendue[nom]):
			_fautes.append("%s : l'os %s est à %s, attendu son repos déplacé %s" % [cas, nom, pose[nom], attendue[nom]])
	if manche.layers != MontageDeComposition.CALQUE or corps.layers != 0 or epaulette.layers != 0:
		_fautes.append("%s : calques Corps %d, Manche %d, Epaulette %d, attendu 0, %d, 0" % [cas, corps.layers, manche.layers, epaulette.layers, MontageDeComposition.CALQUE])
	if manche.skin == auteur or not _poses_des_liaisons(auteur) == origines.manche:
		_fautes.append("%s : la pièce dessinée seule écrit le skin de son auteur" % cas)
	_comparer_les_liaisons(cas, "Manche", squelette, pose, manche.skin, origines.manche, auteur)
	var fusion := montage.fusion
	if fusion == null:
		_fautes.append("%s : aucune fusion" % cas)
		return
	_comparer_les_liaisons_fondues(cas, squelette, pose, fusion.skin, corps.skin, origines.corps)
	var fondus := _skinner(fusion.mesh, fusion.skin, pose)
	var attendus := _skinner(corps.mesh, corps.skin, _repos(squelette))
	var portage := epaulette.get_parent() as Node3D
	var place: Transform3D = pose.bras_g * portage.transform * epaulette.transform
	if not (pose.epaulette as Transform3D).is_equal_approx(place):
		_fautes.append("%s : la pièce rigide est à %s, attendu sur son os à %s" % [cas, pose.epaulette, place])
	for sommet in epaulette.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]:
		attendus.append(place * sommet)
	for attendu in attendus:
		if not Array(fondus).any(func(fondu: Vector3) -> bool: return fondu.distance_to(attendu) < EPSILON):
			_fautes.append("%s : la fusion n'a aucun sommet à %s m de %s" % [cas, EPSILON, attendu])
	if fondus.size() != attendus.size():
		_fautes.append("%s : %d sommets fondus, attendu %d" % [cas, fondus.size(), attendus.size()])
	print("[os-deplaces-du-gabarit] repos, %s : %s" % [cas, "OK" if _fautes.size() == fautes else "KO"])


## Chaque liaison `skin` de la pièce `piece` : `pose(os) · liaison′ = repos(os) · liaison d'origine` (`origines`), son os
## et son ordre ceux de `auteur`.
func _comparer_les_liaisons(cas: String, piece: String, squelette: Skeleton3D, pose: Dictionary, skin: Skin, origines: Array, auteur: Skin) -> void:
	for liaison in skin.get_bind_count():
		var nom := String(skin.get_bind_name(liaison))
		var rendue: Transform3D = pose[nom] * skin.get_bind_pose(liaison)
		var attendue: Transform3D = squelette.get_bone_global_rest(squelette.find_bone(nom)) * origines[liaison]
		if nom != String(auteur.get_bind_name(liaison)) or not rendue.is_equal_approx(attendue):
			_fautes.append("%s : %s, liaison %s rendue à %s, attendu %s" % [cas, piece, nom, rendue, attendue])


## Chaque liaison d'origine de la pièce fondue (`skin`, `origines`) a dans le skin de la fusion une liaison du même os
## qui la rend à son repos.
func _comparer_les_liaisons_fondues(cas: String, squelette: Skeleton3D, pose: Dictionary, fondu: Skin, skin: Skin, origines: Array) -> void:
	for liaison in skin.get_bind_count():
		var nom := skin.get_bind_name(liaison)
		var attendue: Transform3D = squelette.get_bone_global_rest(squelette.find_bone(nom)) * origines[liaison]
		var trouvee := false
		for rang in fondu.get_bind_count():
			trouvee = trouvee or (fondu.get_bind_name(rang) == nom and (pose[String(nom)] * fondu.get_bind_pose(rang)).is_equal_approx(attendue))
		if not trouvee:
			_fautes.append("%s : la fusion ne rend la liaison %s de Corps à aucun %s" % [cas, nom, attendue])


## Sur un clip planté, chaque pied à la pose du clip à l'échelle `SL` de la racine translatée du déplacement de son pied
## sous les seules translations, au plan du sol près.
func _sur_le_clip_plante(legs: float) -> void:
	var squelette := _squelette()
	root.add_child(squelette)
	_marcher(squelette)
	var temoin := _squelette()
	root.add_child(temoin)
	_marcher(temoin)
	var racine := temoin.find_bone("racine")
	temoin.set_bone_pose_scale(racine, temoin.get_bone_pose_scale(racine) * SL)
	for nom: String in DEPLACEMENTS:
		var os := temoin.find_bone(nom)
		var t: Array = DEPLACEMENTS[nom]
		temoin.set_bone_pose_position(os, temoin.get_bone_pose_position(os) + Vector3(t[0], t[1], t[2]))
	var attendue := _pose(temoin)
	temoin.queue_free()
	var lecteur := AnimationPlayer.new()
	var bibliotheque := AnimationLibrary.new()
	bibliotheque.add_animation(MARCHE, Animation.new())
	lecteur.add_animation_library("", bibliotheque)
	root.add_child(lecteur)
	lecteur.assigned_animation = MARCHE
	var gabarit := GabaritDuSquelette.new()
	gabarit.lecteur = lecteur
	squelette.add_child(gabarit)
	var absents := gabarit.poser(_gabarit(DEPLACEMENTS, SL, legs))
	var releve := {}
	squelette.skeleton_updated.connect(func() -> void: releve.merge(_pose(squelette), true))
	await _images()
	var ecart := 0.0
	for pied in PIEDS:
		var obtenu: Transform3D = releve[pied]
		var vise: Transform3D = attendue[pied]
		ecart = maxf(ecart, Vector2(obtenu.origin.x - vise.origin.x, obtenu.origin.z - vise.origin.z).length())
		for axe in 3:
			ecart = maxf(ecart, obtenu.basis[axe].normalized().distance_to(vise.basis[axe].normalized()))
	var juste := absents.is_empty() and ecart < EPSILON
	if not juste:
		_fautes.append("clip planté, legs %s : écart des pieds %s, os absents %s" % [legs, ecart, absents])
	print("[os-deplaces-du-gabarit] clip planté, legs %s : écart des pieds %.6f, %s" % [legs, ecart, "OK" if juste else "KO"])
	squelette.queue_free()
	lecteur.queue_free()
	await process_frame


## La pose de marche : la jambe gauche en avant, genou fléchi, la droite en arrière.
static func _marcher(squelette: Skeleton3D) -> void:
	for pose in [{os = "racine", angle = Vector3(0.0, 0.1, 0.0)}, {os = "cuisse_g", angle = Vector3(-0.45, 0.0, 0.05)},
			{os = "mollet_g", angle = Vector3(0.6, 0.0, 0.0)}, {os = "pied_g", angle = Vector3(-1.4, 0.0, 0.0)},
			{os = "cuisse_d", angle = Vector3(0.35, 0.0, -0.03)}, {os = "mollet_d", angle = Vector3(0.25, 0.0, 0.0)}]:
		var indice := squelette.find_bone(pose.os)
		squelette.set_bone_pose_rotation(indice, squelette.get_bone_rest(indice).basis.get_rotation_quaternion() * Quaternion.from_euler(pose.angle))


func _images() -> void:
	for _image in 3:
		await process_frame


## Un mesh skinné sous `squelette`, un sommet par entrée de `poids` (os → poids), ses triangles trois à trois ; son skin
## lié par nom à chaque os nommé, au repère inverse de son repos composé de `DECALAGE_DU_MESH`.
func _skinnee(nom: String, squelette: Skeleton3D, materiau: Material, poids: Array) -> MeshInstance3D:
	var skin := Skin.new()
	var rangs := {}
	var os := PackedInt32Array()
	var valeurs := PackedFloat32Array()
	var sommets := PackedVector3Array()
	for rang in poids.size():
		var sommet: Dictionary = poids[rang]
		var places := 0
		for nom_de_l_os: String in sommet:
			if not rangs.has(nom_de_l_os):
				rangs[nom_de_l_os] = skin.get_bind_count()
				skin.add_named_bind(nom_de_l_os, squelette.get_bone_global_rest(squelette.find_bone(nom_de_l_os)).affine_inverse() * DECALAGE_DU_MESH)
			os.append(rangs[nom_de_l_os])
			valeurs.append(sommet[nom_de_l_os])
			places += 1
		for _vide in 4 - places:
			os.append(0)
			valeurs.append(0.0)
		sommets.append(Vector3(0.1 * (rang % 3), 0.2 + 0.1 * rang, 0.03 * (rang % 2)))
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = sommets
	var normales := PackedVector3Array()
	normales.resize(sommets.size())
	normales.fill(Vector3.FORWARD)
	tableaux[Mesh.ARRAY_NORMAL] = normales
	tableaux[Mesh.ARRAY_INDEX] = PackedInt32Array(range(sommets.size()))
	tableaux[Mesh.ARRAY_BONES] = os
	tableaux[Mesh.ARRAY_WEIGHTS] = valeurs
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	mesh.surface_set_material(0, materiau)
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = mesh
	piece.skin = skin
	squelette.add_child(piece)
	piece.skeleton = piece.get_path_to(squelette)
	return piece


## Un mesh rigide d'un triangle sous un `BoneAttachment3D` de l'os `os`, dans un portage intermédiaire.
func _rigide(nom: String, squelette: Skeleton3D, os: String, materiau: Material) -> MeshInstance3D:
	var attache := BoneAttachment3D.new()
	attache.bone_name = os
	squelette.add_child(attache)
	var portage := Node3D.new()
	portage.transform = Transform3D(Basis(), Vector3(0.0, 0.05, 0.0))
	attache.add_child(portage)
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0.0, 0.0, 0.0), Vector3(0.05, 0.1, 0.0), Vector3(-0.05, 0.1, 0.02)])
	tableaux[Mesh.ARRAY_NORMAL] = PackedVector3Array([Vector3.FORWARD, Vector3.FORWARD, Vector3.FORWARD])
	tableaux[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2])
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	mesh.surface_set_material(0, materiau)
	var piece := MeshInstance3D.new()
	piece.name = nom
	piece.mesh = mesh
	piece.transform = Transform3D(Basis.from_euler(Vector3(0.3, 0.0, 1.2)), Vector3(0.0, 0.1, 0.02))
	portage.add_child(piece)
	return piece


## La pose de chaque liaison de `skin`, dans son ordre.
static func _poses_des_liaisons(skin: Skin) -> Array:
	var poses := []
	for liaison in skin.get_bind_count():
		poses.append(skin.get_bind_pose(liaison))
	return poses


## Par nom d'os de `squelette`, son repos global avec la position locale de chaque os de `deplacements` translatée,
## calculé de la racine vers les feuilles.
static func _pose_deplacee(squelette: Skeleton3D, deplacements: Dictionary) -> Dictionary:
	var globales := {}
	for os in squelette.get_bone_count():
		var repos := squelette.get_bone_rest(os)
		var t: Array = deplacements.get(squelette.get_bone_name(os), [0.0, 0.0, 0.0])
		var locale := Transform3D(repos.basis, repos.origin + Vector3(t[0], t[1], t[2]))
		var parent := squelette.get_bone_parent(os)
		globales[os] = locale if parent == -1 else globales[parent] * locale
	var par_nom := {}
	for os in globales:
		par_nom[squelette.get_bone_name(os)] = globales[os]
	return par_nom


## Par nom d'os de `squelette`, son repos global.
static func _repos(squelette: Skeleton3D) -> Dictionary:
	var repos := {}
	for os in squelette.get_bone_count():
		repos[squelette.get_bone_name(os)] = squelette.get_bone_global_rest(os)
	return repos


## La pose de chaque os de `squelette`, par nom, dans le repère du squelette.
static func _pose(squelette: Skeleton3D) -> Dictionary:
	var pose := {}
	for os in squelette.get_bone_count():
		pose[squelette.get_bone_name(os)] = squelette.get_bone_global_pose(os)
	return pose


## La place, dans le repère du squelette, de chaque sommet de `mesh` skinné par `skin` sur les poses `poses` (par nom).
static func _skinner(mesh: Mesh, skin: Skin, poses: Dictionary) -> PackedVector3Array:
	var places := PackedVector3Array()
	for surface in mesh.get_surface_count():
		var tableaux := mesh.surface_get_arrays(surface)
		var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
		var os: PackedInt32Array = tableaux[Mesh.ARRAY_BONES]
		var poids: PackedFloat32Array = tableaux[Mesh.ARRAY_WEIGHTS]
		for rang in sommets.size():
			var place := Vector3.ZERO
			for k in 4:
				var liaison := os[rang * 4 + k]
				var pose: Transform3D = poses[String(skin.get_bind_name(liaison))]
				place += poids[rang * 4 + k] * (pose * skin.get_bind_pose(liaison) * sommets[rang])
			places.append(place)
	return places
