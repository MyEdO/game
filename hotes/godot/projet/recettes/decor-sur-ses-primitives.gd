extends SceneTree

## Le modèle d'un décor posé sur les primitives qu'il remplace (#4335, `hotes/godot/pont/CONTRAT.md`, section « Corps
## d'un combattant », `decors`) : sur un pont figé (`PontFige`, `hotes/godot/recettes/decor.ts`, `figerLeDecor`, `caps`),
## l'échantillon d'un décor asymétrique à chaque cap figé, son volume posé par une `VolumeDeScene` et ses décors servis
## par des `MontageDesModeles`. À chaque cap : la scène peint d'abord tous les triangles du volume ; dès les décors
## servis, ni sa vue ni son ombre ne peignent ceux du décor (`VolumeDeScene.peindre_sans`) ; le modèle posé a l'emprise
## des triangles du décor (à `TOLERANCE_M` près sur chaque borne de chaque axe : le modèle reproduit la forme de sa
## recette, pas ses facettes), et celle du cap tourné n'est pas celle du cap `S` ;
## sa case retirée par le masque au plan `pose` de sa couche, aucun de ses meshes ne se voit et chacun porte son ombre,
## montré de nouveau sans masque ; les décors plus servis, le modèle retiré et le volume peint entier.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/decor.json"
## L'écart toléré entre une borne de l'emprise du modèle et celle des triangles du décor, en mètres.
const TOLERANCE_M := 0.1
## Les images au plus qu'attend le modèle posé.
const IMAGES_DU_MODELE := 600
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[decor-sur-ses-primitives] version=", Engine.get_version_info().string)
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not decor is Dictionary or not decor.has("caps"):
		push_error("[decor-sur-ses-primitives] %s : aucun décor figé à ses caps" % FIGE)
		quit(2)
		return
	PontFige.poser(self, decor)
	MontageDeComposition.retenir_les_modeles(decor.modeles, decor.listage)
	var emprises := {}
	for cap: String in decor.caps:
		emprises[cap] = await _poser_au_cap(cap, decor.caps[cap])
	var tournees := emprises.keys().filter(func(cap: String) -> bool: return cap != "S")
	_verifier(emprises.has("S") and not tournees.is_empty(), "les caps figés %s : S et un cap tourné attendus" % [emprises.keys()])
	for cap: String in tournees:
		if emprises.S != null and emprises[cap] != null:
			_verifier(not _proches(emprises.S, emprises[cap], decor.caps[cap].monde.metresParCase), "cap %s : l'emprise %s est celle du cap S %s, le décor n'éprouve pas la rotation" % [cap, emprises[cap], emprises.S])
	for faute in _fautes:
		push_error("[decor-sur-ses-primitives] " + faute)
	print("[decor-sur-ses-primitives] %d caps posés, erreurs=%d" % [emprises.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## L'échantillon `figee` (`{ monde, decors }`) au cap `cap`, éprouvé dans une scène neuve, retirée ensuite : l'emprise
## du modèle posé, `null` s'il ne se pose pas.
func _poser_au_cap(cap: String, figee: Dictionary) -> Variant:
	var scene := Node3D.new()
	root.add_child(scene)
	var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
	scene.add_child(volume)
	var modeles := MontageDesModeles.new()
	modeles.volume = volume
	var chargeur := MontageDeComposition.new()
	modeles.add_child(chargeur)
	modeles.chargeur = chargeur
	scene.add_child(modeles)
	var monde: Dictionary = figee.monde
	volume.poser({monde = monde, toits = [], couronnes = []}, {volume = monde.morceaux, toits = [], couronnes = []})
	var prop: String = figee.decors.keys()[0]
	var pose: Dictionary = figee.decors[prop].poses[0]
	var tous := _triangles(monde, func(_surface: Dictionary) -> bool: return true)
	var du_decor := _triangles(monde, func(surface: Dictionary) -> bool: return surface.get("decor") == prop)
	_verifier(du_decor > 0 and volume.ce_qui_est_pose().triangles == tous, "cap %s : %d triangles peints sans décor servi, attendu les %d du volume (%d du décor)" % [cap, volume.ce_qui_est_pose().triangles, tous, du_decor])
	var primitives := _emprise_des_primitives(volume, monde, prop)
	modeles.poser({}, figee.decors, {}, monde.metresParCase)
	_verifier(volume.ce_qui_est_pose().triangles == tous - du_decor, "cap %s : %d triangles peints, le décor servi, attendu %d" % [cap, volume.ce_qui_est_pose().triangles, tous - du_decor])
	_verifier(_triangles_d_ombre(volume) == tous - du_decor, "cap %s : %d triangles en ombre, le décor servi, attendu %d" % [cap, _triangles_d_ombre(volume), tous - du_decor])
	for image in IMAGES_DU_MODELE:
		if not modeles.poses().is_empty():
			break
		await process_frame
	var emprise: Variant = null
	if _verifier(modeles.poses().size() == 1, "cap %s : %d modèles posés, attendu 1" % [cap, modeles.poses().size()]):
		var montage: MontageDeVehicule = modeles.get("_montes")[modeles.poses()[0]]
		emprise = MontageDeVehicule.boite(montage.scene, scene)
		print("[decor-sur-ses-primitives] cap %s, %s m par case : modèle %s, primitives %s" % [cap, monde.metresParCase, emprise, primitives])
		_verifier(_proches(emprise, primitives, monde.metresParCase), "cap %s : le modèle a l'emprise %s, les primitives %s" % [cap, emprise, primitives])
		_retirer_la_case(cap, volume, monde, pose, montage)
	modeles.poser({}, {}, {}, monde.metresParCase)
	_verifier(modeles.poses().is_empty() and volume.ce_qui_est_pose().triangles == tous, "cap %s : décor plus servi, %d modèles posés et %d triangles peints, attendu 0 et %d" % [cap, modeles.poses().size(), volume.ce_qui_est_pose().triangles, tous])
	scene.queue_free()
	await process_frame
	return emprise


## Le masque qui retire la seule case de `pose` au plan `pose` de sa couche (`MiseEnPage.rangee_de_pose`) posé au
## volume : aucun mesh du modèle de `montage` ne se voit, chacun portant son ombre ; sans masque, chacun se voit.
func _retirer_la_case(cap: String, volume: VolumeDeScene, monde: Dictionary, pose: Dictionary, montage: MontageDeVehicule) -> void:
	var hauteurs: Array = monde.hauteurs
	var largeur: int = hauteurs[0].rangees[0].size()
	var rangees: int = hauteurs[0].rangees.size()
	var couche := hauteurs.map(func(h: Dictionary) -> int: return int(h.z)).find(int(pose.case.z))
	var octets := PackedByteArray()
	octets.resize(largeur * 2 * hauteurs.size() * rangees)
	octets[int(pose.case.x) + largeur * (int(pose.case.y) + int(MiseEnPage.rangee_de_pose(couche, rangees)))] = 255
	volume.retirer({masque = Marshalls.raw_to_base64(octets), largeur = largeur, rangees = 2 * hauteurs.size() * rangees})
	var pieces := montage.scene.find_children("*", "MeshInstance3D", true, false)
	_verifier(not pieces.is_empty() and pieces.all(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY), "cap %s : sa case retirée, le modèle se voit encore" % cap)
	volume.retirer(null)
	_verifier(pieces.all(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_ON), "cap %s : sans masque, le modèle ne se voit pas" % cap)


## Le nombre de triangles des surfaces du volume `monde` que `retenue` retient.
static func _triangles(monde: Dictionary, retenue: Callable) -> int:
	var triangles := 0
	for morceau: Dictionary in monde.morceaux:
		for surface: Dictionary in morceau.surfaces:
			if retenue.call(surface):
				triangles += (int(surface.fin) - int(surface.debut)) / 3
	return triangles


## Le nombre de triangles de l'instance en ombre seule de chaque morceau posé de `volume`.
static func _triangles_d_ombre(volume: VolumeDeScene) -> int:
	var triangles := 0
	for morceau: Node3D in volume.get_node("Volume/Morceaux").get_children():
		triangles += (morceau.get_node("Ombre") as MeshInstance3D).mesh.get_faces().size() / 3
	return triangles


## L'emprise, dans le repère global, des sommets des surfaces du décor `prop` du volume `monde`, posé par `volume`.
static func _emprise_des_primitives(volume: VolumeDeScene, monde: Dictionary, prop: String) -> AABB:
	var repere: Node3D = volume.get_node("Volume")
	var emprise: Variant = null
	for morceau: Dictionary in monde.morceaux:
		var sommets := PackedFloat32Array(morceau.positions).to_byte_array().to_vector3_array()
		for surface: Dictionary in morceau.surfaces:
			if surface.get("decor") == prop:
				for sommet in sommets.slice(int(surface.debut), int(surface.fin)):
					var point := repere.to_global(sommet)
					emprise = AABB(point, Vector3.ZERO) if emprise == null else (emprise as AABB).expand(point)
	return emprise


## Si les bornes de `a` et de `b` s'écartent au plus de `TOLERANCE_M` sur chaque axe, sur un plateau de
## `metres_par_case`.
static func _proches(a: AABB, b: AABB, metres_par_case: float) -> bool:
	var bas := (a.position - b.position).abs()
	var haut := (a.end - b.end).abs()
	var tolerance := MiseEnPage.hauteur_au_plateau(TOLERANCE_M, metres_par_case)
	return bas[bas.max_axis_index()] <= tolerance and haut[haut.max_axis_index()] <= tolerance


func _verifier(tenu: bool, faute: String) -> bool:
	if not tenu:
		_fautes.append(faute)
	return tenu
