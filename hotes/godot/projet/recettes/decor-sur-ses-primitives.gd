extends SceneTree

## Le modèle d'un décor posé sur les primitives qu'il remplace (#4335, `hotes/godot/pont/CONTRAT.md`, section « Corps
## d'un combattant », `decors`) : sur un pont figé (`PontFige`, `hotes/godot/recettes/decor.ts`, `figerLeDecor`, `caps`),
## l'échantillon d'un décor asymétrique à chaque cap figé, son volume posé par une `VolumeDeScene` et ses décors servis
## par des `MontageDesModeles`. À chaque cap : la scène peint d'abord tous les triangles du volume ; dès les décors
## servis, ni sa vue ni son ombre ne peignent ceux du décor (`VolumeDeScene.peindre_sans`) ; le modèle posé a l'emprise
## des triangles du décor (à `TOLERANCE_M` près sur chaque borne de chaque axe : le modèle reproduit la forme de sa
## recette, pas ses facettes), et celle du cap tourné n'est pas celle du cap `S` ; chaque mesh du modèle est sur la couche
## du monde et aucun n'émet ; les décors plus servis, le modèle retiré et le volume peint entier. Puis le décor posé sur
## un bloc plein (`coiffe`), sous le retrait que le noyau rend sous sa couche (`retraitDuMonde`, plan `pose` retiré,
## plan `sol` montré) : aucun de ses meshes ne se voit et chacun porte son ombre, montré de nouveau sans masque. Enfin un
## décor qui éclaire (`luminaire`), chacune de ses poses portant `luminaire` : chaque mesh de son modèle est sur la
## couche des luminaires (`VolumeDeScene.COUCHE_DES_LUMINAIRES`), chaque mesh de son nœud qui luit
## (`MontageDesModeles.emissives`) émet, et aucun autre ; reposé sans `luminaire`, le même modèle, sans remontage, est sur
## la couche du monde et aucun de ses meshes n'émet.

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
	if not decor is Dictionary or not decor.has("caps") or not decor.has("coiffe") or not decor.has("luminaire"):
		push_error("[decor-sur-ses-primitives] %s : aucun décor figé à ses caps, sur son bloc ni qui éclaire" % FIGE)
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
	await _retirer_sur_le_bloc(decor.coiffe)
	await _eclairer(decor.luminaire)
	for faute in _fautes:
		push_error("[decor-sur-ses-primitives] " + faute)
	print("[decor-sur-ses-primitives] %d caps posés, erreurs=%d" % [emprises.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## Une scène neuve sous la racine, le volume `monde` posé par sa `VolumeDeScene` et ses `MontageDesModeles`.
func _scene_neuve(monde: Dictionary) -> Node3D:
	var scene := Node3D.new()
	root.add_child(scene)
	var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
	volume.name = "Volume"
	scene.add_child(volume)
	var modeles := MontageDesModeles.new()
	modeles.name = "Modeles"
	modeles.volume = volume
	var chargeur := MontageDeComposition.new()
	modeles.add_child(chargeur)
	modeles.chargeur = chargeur
	scene.add_child(modeles)
	volume.poser({monde = monde, toits = [], couronnes = []}, {volume = monde.morceaux, toits = [], couronnes = []})
	return scene


## Le modèle de la seule pose de `modeles` attendu au plus `IMAGES_DU_MODELE` images : son montage, `null` faute de
## modèle posé (`quoi` nomme l'épreuve dans la faute).
func _modele_pose(modeles: MontageDesModeles, quoi: String) -> MontageDeVehicule:
	for image in IMAGES_DU_MODELE:
		if not modeles.poses().is_empty():
			break
		await process_frame
	if not _verifier(modeles.poses().size() == 1, "%s : %d modèles posés, attendu 1" % [quoi, modeles.poses().size()]):
		return null
	return modeles.get("_montes")[modeles.poses()[0]]


## L'échantillon `figee` (`{ monde, decors }`) au cap `cap`, éprouvé dans une scène neuve, retirée ensuite : l'emprise
## du modèle posé, `null` s'il ne se pose pas.
func _poser_au_cap(cap: String, figee: Dictionary) -> Variant:
	var monde: Dictionary = figee.monde
	var scene := _scene_neuve(monde)
	var volume: VolumeDeScene = scene.get_node("Volume")
	var modeles: MontageDesModeles = scene.get_node("Modeles")
	var prop: String = figee.decors.keys()[0]
	var tous := _triangles(monde, func(_surface: Dictionary) -> bool: return true)
	var du_decor := _triangles(monde, func(surface: Dictionary) -> bool: return surface.get("decor") == prop)
	_verifier(du_decor > 0 and volume.ce_qui_est_pose().triangles == tous, "cap %s : %d triangles peints sans décor servi, attendu les %d du volume (%d du décor)" % [cap, volume.ce_qui_est_pose().triangles, tous, du_decor])
	var primitives := _emprise_des_primitives(volume, monde, prop)
	modeles.poser({}, figee.decors, {}, monde.metresParCase)
	_verifier(volume.ce_qui_est_pose().triangles == tous - du_decor, "cap %s : %d triangles peints, le décor servi, attendu %d" % [cap, volume.ce_qui_est_pose().triangles, tous - du_decor])
	_verifier(_triangles_d_ombre(volume) == tous - du_decor, "cap %s : %d triangles en ombre, le décor servi, attendu %d" % [cap, _triangles_d_ombre(volume), tous - du_decor])
	var emprise: Variant = null
	var montage: MontageDeVehicule = await _modele_pose(modeles, "cap %s" % cap)
	if montage != null:
		emprise = MontageDeVehicule.boite(montage.scene, scene)
		print("[decor-sur-ses-primitives] cap %s, %s m par case : modèle %s, primitives %s" % [cap, monde.metresParCase, emprise, primitives])
		_verifier(_proches(emprise, primitives, monde.metresParCase), "cap %s : le modèle a l'emprise %s, les primitives %s" % [cap, emprise, primitives])
		_verifier_l_eclairage(montage, "cap %s" % cap, false)
	modeles.poser({}, {}, {}, monde.metresParCase)
	_verifier(modeles.poses().is_empty() and volume.ce_qui_est_pose().triangles == tous, "cap %s : décor plus servi, %d modèles posés et %d triangles peints, attendu 0 et %d" % [cap, modeles.poses().size(), volume.ce_qui_est_pose().triangles, tous])
	scene.queue_free()
	await process_frame
	return emprise


## L'échantillon `figee` (`{ monde, decors, retrait }`) posé sur un bloc plein, dans une scène neuve retirée ensuite :
## sous `retrait`, le retrait que rend le noyau, aucun mesh de son modèle ne se voit, chacun portant son ombre ; sans
## masque, chacun se voit.
func _retirer_sur_le_bloc(figee: Dictionary) -> void:
	var monde: Dictionary = figee.monde
	var scene := _scene_neuve(monde)
	var volume: VolumeDeScene = scene.get_node("Volume")
	var modeles: MontageDesModeles = scene.get_node("Modeles")
	modeles.poser({}, figee.decors, {}, monde.metresParCase)
	var montage: MontageDeVehicule = await _modele_pose(modeles, "sur le bloc")
	if montage != null:
		volume.retirer(figee.retrait)
		var pieces := montage.scene.find_children("*", "MeshInstance3D", true, false)
		_verifier(not pieces.is_empty() and pieces.all(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY), "sur le bloc : sa case retirée par le noyau, le modèle se voit encore")
		volume.retirer(null)
		_verifier(pieces.all(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_ON), "sur le bloc : sans masque, le modèle ne se voit pas")
	scene.queue_free()
	await process_frame


## L'échantillon `figee` (`{ monde, decors }`) d'un décor qui éclaire, chacune de ses poses portant `luminaire`, dans
## une scène neuve retirée ensuite : son modèle posé luit (`_verifier_l_eclairage`) ; reposé avec ses poses sans
## `luminaire`, le même corps, son modèle n'est pas remonté et s'éteint.
func _eclairer(figee: Dictionary) -> void:
	var monde: Dictionary = figee.monde
	var prop: String = figee.decors.keys()[0]
	_verifier(figee.decors[prop].poses.all(func(p: Dictionary) -> bool: return p.has("luminaire")), "%s : une pose figée ne porte pas `luminaire`" % prop)
	var scene := _scene_neuve(monde)
	var modeles: MontageDesModeles = scene.get_node("Modeles")
	modeles.poser({}, figee.decors, {}, monde.metresParCase)
	var montage: MontageDeVehicule = await _modele_pose(modeles, prop)
	if montage != null:
		_verifier_l_eclairage(montage, prop, true)
		var eteints: Dictionary = figee.decors.duplicate(true)
		for p: Dictionary in eteints[prop].poses:
			p.erase("luminaire")
		var scene_posee := montage.scene
		modeles.poser({}, eteints, {}, monde.metresParCase)
		await process_frame
		var meme: bool = modeles.poses().size() == 1 and modeles.get("_montes")[modeles.poses()[0]] == montage and montage.scene == scene_posee
		if _verifier(meme, "%s éteint : le modèle a été remonté" % prop):
			_verifier_l_eclairage(montage, "%s éteint" % prop, false)
	scene.queue_free()
	await process_frame


## Le modèle posé de `montage` (`quoi` nomme l'épreuve dans la faute) : chaque mesh sur la couche des luminaires si
## `eclaire`, sur celle du monde sinon ; si `eclaire`, chaque mesh qui luit (`MontageDesModeles.emissives`, un au moins)
## émet ; aucun autre n'émet.
func _verifier_l_eclairage(montage: MontageDeVehicule, quoi: String, eclaire: bool) -> void:
	var couche := VolumeDeScene.COUCHE_DES_LUMINAIRES if eclaire else VolumeDeScene.COUCHE_DU_MONDE
	var luisent := MontageDesModeles.emissives(montage.scene)
	_verifier(not eclaire or not luisent.is_empty(), "%s : aucun mesh sous `%s`" % [quoi, MontageDesModeles.NOEUD_EMISSIF])
	for piece: MeshInstance3D in montage.scene.find_children("*", "MeshInstance3D", true, false):
		_verifier(piece.layers == couche, "%s : %s sur la couche %d, attendu %d" % [quoi, piece.name, piece.layers, couche])
		var attendu: bool = eclaire and piece in luisent
		_verifier(_emet(piece) == attendu, "%s : %s %s" % [quoi, piece.name, "n'émet pas" if attendu else "émet"])
	print("[decor-sur-ses-primitives] %s : %d meshes sur la couche %d, %d qui luisent%s" % [quoi, montage.scene.find_children("*", "MeshInstance3D", true, false).size(), couche, luisent.size(), "" if eclaire else " éteints"])


## Si une surface de `piece` émet.
static func _emet(piece: MeshInstance3D) -> bool:
	return range(piece.mesh.get_surface_count()).any(func(rang: int) -> bool:
		var matiere := piece.get_active_material(rang) as BaseMaterial3D
		return matiere != null and matiere.emission_enabled)


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
