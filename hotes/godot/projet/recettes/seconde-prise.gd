extends SceneTree

## Un objet tenu des deux mains (#3319, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : monté à la prise `main`
## avec une seconde prise (`secondesPrises` de `modeles`), il pose la main de la prise `secondaire` sur elle
## (`scripts/seconde_prise.gd`). Sur un bras à trois os, le repère de prise de la main libre rejoint la seconde prise,
## ses doigts prennent la pose de ceux de la main qui tient, et l'épaule et le coude gardent leurs longueurs ; une cible
## hors de portée tend le bras vers elle. La prise `secondaire` occupée, ou un objet sans seconde prise, ne ploie rien. La pose
## se relève au signal `skeleton_updated`, après les modificateurs et avant que le squelette ne restaure la pose du clip
## (`Skeleton3D::_notification`, Godot 4.7). Tant que la main libre tient la seconde prise, un rôle joue le clip de
## `clipsDeuxMains` de la base sous le maniement de l'objet tenu, `clips` sinon ou pour un maniement sans table
## (`MontageDeComposition.clip`), et chaque clip retrouve son rôle. Au lancement d'un clip (#3806,
## `MontageDeComposition.poser_le_clip`), la main libre ne tient la seconde prise que sous un clip à deux mains ; l'objet
## tenu passe à son emplacement de rangement sous un clip qui occupe sa prise (`prisesOccupees`), l'objet tenu des deux
## mains sous tout clip qui n'est pas dérivé à deux mains, même sur un emplacement qui porte déjà un objet.

const RECETTE_AUTONOME := true
const EPSILON := 0.001
const MAIN := {id = "main", genre = "prise", attache = {os = "main_d", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const OFF := {id = "secondaire", genre = "prise", attache = {os = "main_g", position = [0.02, 0.09, 0.003], rotation = [1.32, 3.1, 0.03]}}
const A_PORTEE := {position = [0.0, -0.05, 0.12], rotation = [0.0, 3.14159, 0.0]}
const HORS_DE_PORTEE := {position = [0.0, 0.0, 2.0], rotation = [0.0, 0.0, 0.0]}
const CLIPS := {repos = "Repos", coup = "Coup"}
const CLIPS_DEUX_MAINS := {lourde2m = {repos = "Repos_DeuxMains"}, hampe = {repos = "Repos_Hampe"}}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[seconde-prise] version=", Engine.get_version_info().string)
	await _verifier("à portée", A_PORTEE, {main = "hache"}, true)
	await _verifier("hors de portée", HORS_DE_PORTEE, {main = "hache"}, true)
	await _verifier("prise secondaire occupée", A_PORTEE, {main = "hache", secondaire = "dague"}, false)
	await _verifier("sans seconde prise", A_PORTEE, {main = "epee"}, false)
	await _verifier_le_clip("à deux mains", {main = "hache"}, {Repos_DeuxMains = [true, false], Coffre = [false, true], Saut = [false, true], Lanterne = [false, true]})
	await _verifier_le_clip("emplacement monté", {main = "hache", dos = "carquois"}, {Coffre = [false, true], Repos_DeuxMains = [true, false]})
	await _verifier_le_clip("à une main", {main = "epee"}, {Coffre = [false, false], Lanterne = [false, true]})
	for faute in _fautes:
		push_error("[seconde-prise] " + faute)
	print("[seconde-prise] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le squelette d'un bras gauche à trois os, coude fléchi, et d'une main droite devant le torse, chaque main à un doigt
## de même repos, celui de la main droite fléchi, posé dans l'arbre.
func _squelette() -> Skeleton3D:
	var squelette := Skeleton3D.new()
	root.add_child(squelette)
	for os in [{nom = "epaule_g", parent = "", repos = Transform3D(Basis.from_euler(Vector3(0.0, 0.0, -1.2)), Vector3(0.2, 1.4, 0.0))},
			{nom = "coude_g", parent = "epaule_g", repos = Transform3D(Basis.from_euler(Vector3(0.0, 0.4, 0.3)), Vector3(0.0, 0.3, 0.0))},
			{nom = "main_g", parent = "coude_g", repos = Transform3D(Basis.from_euler(Vector3(0.2, 0.0, 0.1)), Vector3(0.0, 0.25, 0.0))},
			{nom = "doigt_g", parent = "main_g", repos = Transform3D(Basis.from_euler(Vector3(1.1, 0.0, 0.2)), Vector3(0.0, 0.08, 0.0))},
			{nom = "main_d", parent = "", repos = Transform3D(Basis.from_euler(Vector3(0.3, -0.8, 0.1)), Vector3(0.05, 1.15, 0.3))},
			{nom = "doigt_d", parent = "main_d", repos = Transform3D(Basis.from_euler(Vector3(1.1, 0.0, 0.2)), Vector3(0.0, 0.08, 0.0))}]:
		var indice := squelette.add_bone(os.nom)
		if os.parent != "":
			squelette.set_bone_parent(indice, squelette.find_bone(os.parent))
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	squelette.set_bone_pose_rotation(squelette.find_bone("doigt_d"), Quaternion.from_euler(Vector3(1.5, 0.1, 0.2)))
	return squelette


func _verifier(cas: String, seconde: Dictionary, montes: Dictionary, ploie: bool) -> void:
	var squelette := _squelette()
	var montage := MontageDeComposition.new()
	MontageDeComposition.modeles = {secondesPrises = {hache = {repere = seconde, maniement = "lourde2m"}}}
	montage.base = {points = [MAIN, OFF], clips = CLIPS, clipsDeuxMains = CLIPS_DEUX_MAINS}
	montage.squelette = squelette
	montage.montes = montes
	var longueurs := _longueurs(squelette)
	var repos := squelette.get_bone_global_pose(squelette.find_bone("main_g"))
	var releve := {}
	squelette.skeleton_updated.connect(func() -> void: releve.merge(_pose(squelette), true))
	montage.poser_la_seconde_prise()
	await process_frame
	await process_frame
	if releve.is_empty():
		releve = _pose(squelette)
	var juste: bool
	var main: Transform3D = releve.main_g
	var tenue: Transform3D = releve.main_d * MontageDeComposition.repere(MAIN.attache)
	var visee := tenue * MontageDeComposition.repere(seconde)
	var prise := main * MontageDeComposition.repere(OFF.attache)
	if not ploie:
		juste = montage.seconde_prise.is_empty() and main.origin.distance_to(repos.origin) < EPSILON
	elif seconde == HORS_DE_PORTEE:
		var epaule: Vector3 = releve.epaule_g.origin
		var tendu := (main.origin - epaule).length()
		juste = absf(tendu - longueurs.x - longueurs.y) < 0.01 and (main.origin - epaule).normalized().dot((visee.origin - epaule).normalized()) > 0.999
	else:
		juste = prise.origin.distance_to(visee.origin) < EPSILON and prise.basis.x.distance_to(visee.basis.x) < EPSILON \
				and prise.basis.y.distance_to(visee.basis.y) < EPSILON and prise.basis.z.distance_to(visee.basis.z) < EPSILON
	if juste and ploie:
		var doigts := squelette.get_bone_pose_rotation(squelette.find_bone("doigt_d"))
		juste = (releve.main_g.basis.inverse() * releve.doigt_g.basis).is_equal_approx(Basis(doigts))
		var apres := Vector2(releve.coude_g.origin.distance_to(releve.epaule_g.origin), releve.main_g.origin.distance_to(releve.coude_g.origin))
		juste = juste and absf(apres.x - longueurs.x) < EPSILON and absf(apres.y - longueurs.y) < EPSILON
	var repos_joue: String = CLIPS_DEUX_MAINS.lourde2m.repos if ploie else CLIPS.repos
	juste = juste and montage.clip("repos") == repos_joue and montage.clip("coup") == CLIPS.coup and montage.role_du_clip(repos_joue) == "repos"
	if ploie:
		var tenue_par: Dictionary = MontageDeComposition.modeles.secondesPrises.hache
		tenue_par.maniement = "hampe"
		juste = juste and montage.clip("repos") == CLIPS_DEUX_MAINS.hampe.repos and montage.role_du_clip(CLIPS_DEUX_MAINS.hampe.repos) == "repos"
		tenue_par.maniement = null
		juste = juste and montage.clip("repos") == CLIPS.repos
	if not juste:
		_fautes.append("%s : prise de la main libre %s, seconde prise %s, montage %s" % [cas, prise, visee, montage.seconde_prise])
	print("[seconde-prise] %s : %s" % [cas, "OK" if juste else "KO"])
	MontageDeComposition.modeles = {}
	montage.free()
	squelette.queue_free()
	await process_frame


## Sous chaque clip de `attendus`, joué au lecteur du montage de la tenue `montes`, la seconde prise active et l'objet
## tenu à la prise `main` rangé, comme `attendus` les donne.
func _verifier_le_clip(cas: String, montes: Dictionary, attendus: Dictionary) -> void:
	var squelette := _squelette()
	var lecteur := AnimationPlayer.new()
	var bibliotheque := AnimationLibrary.new()
	for nom in [CLIPS.repos, CLIPS.coup, CLIPS_DEUX_MAINS.lourde2m.repos, "Coffre", "Saut", "Lanterne"]:
		bibliotheque.add_animation(nom, Animation.new())
	lecteur.add_animation_library("", bibliotheque)
	root.add_child(lecteur)
	var montage := MontageDeComposition.new()
	MontageDeComposition.modeles = {secondesPrises = {hache = {repere = A_PORTEE, maniement = "lourde2m"}}}
	montage.base = {points = [MAIN, OFF, {id = "dos", genre = "emplacement", attache = MAIN.attache, elements = ["hache", "epee"]}],
		clips = CLIPS, clipsDeuxMains = CLIPS_DEUX_MAINS, prisesOccupees = {Coffre = ["secondaire"], Lanterne = ["main"]}}
	montage.squelette = squelette
	montage.modele = Node3D.new()
	montage.add_child(montage.modele)
	montage.lecteur = lecteur
	montage.montes = montes
	var tenu := Node3D.new()
	var range_ := Node3D.new()
	montage.add_child(tenu)
	montage.add_child(range_)
	montage._tenus_ranges = {main = {tenus = [tenu], ranges = [range_], rangement = "dos#main"}}
	montage.poser_la_seconde_prise()
	var juste := true
	for clip: String in attendus:
		lecteur.play(clip)
		await process_frame
		var active: bool = not montage.seconde_prise.is_empty() and montage.seconde_prise.all(func(m: SkeletonModifier3D) -> bool: return m.active)
		var rangee := range_.visible and not tenu.visible
		if active != attendus[clip][0] or rangee != attendus[clip][1] or tenu.visible == range_.visible:
			juste = false
			_fautes.append("%s, %s : seconde prise %s, rangé %s, attendus %s" % [cas, clip, active, rangee, attendus[clip]])
	print("[seconde-prise] clip %s : %s" % [cas, "OK" if juste else "KO"])
	MontageDeComposition.modeles = {}
	montage.free()
	lecteur.queue_free()
	squelette.queue_free()
	await process_frame


## La pose de chaque os de `squelette`, par nom, dans le repère du squelette.
func _pose(squelette: Skeleton3D) -> Dictionary:
	var pose := {}
	for os in squelette.get_bone_count():
		pose[squelette.get_bone_name(os)] = squelette.get_bone_global_pose(os)
	return pose


## La longueur du bras (épaule → coude) et de l'avant-bras (coude → main) sur la pose de `squelette`.
func _longueurs(squelette: Skeleton3D) -> Vector2:
	var epaule := squelette.get_bone_global_pose(squelette.find_bone("epaule_g")).origin
	var coude := squelette.get_bone_global_pose(squelette.find_bone("coude_g")).origin
	var main := squelette.get_bone_global_pose(squelette.find_bone("main_g")).origin
	return Vector2(coude.distance_to(epaule), main.distance_to(coude))
