## Le monde 3D d'une scène, que le plateau du jeu et l'éditeur de carte instancient tous deux : le volume de la scène
## (`VolumeDeScene`, `volume`), touché des deux côtés, sa lumière, et ses caméras (`regarder`) : celle des regards
## `tactique` et `plateau`, aux touches d'un jeu de rôle tactique (A/E d'un quart de tour, bouton du milieu tenu
## librement, molette pour zoomer, ZQSD pour la faire glisser, Origine pour revenir au lieu suivi), centrée sur lui puis
## sur le lieu qu'elle suit (`suivre`) ou qu'on lui pose (`cadrer`), de biais en tactique, à la verticale et sans
## perspective au plateau ; et l'œil
## du regard `immersion`, posé par qui l'instancie (`poser_l_oeil`), qui marche sur le sol touché sous lui (`sol_sous`).
## Le clavier ne mène rien pendant une saisie (`clavier_libre`), ni d'une touche qu'une fenêtre incrustée a prise
## (`forces_du_clavier`). Il rend la caméra posée (`camera`), la case du
## triangle que le rayon du pointeur
## touche et le point de la carte touché, et le point de l'écran d'un lieu ; il pose les plaques de surbrillance et les
## noms que lui passe qui l'instancie, l'arête choisie, les nappes de toit du volume, chacune levée quand le groupe est
## dessous, ses couronnes crénelées, chacune cachée quand son mur tombe, ses arêtes dégagées, abattues sous le cran de
## la caméra (`cacher_le_bati`), la météo (`poser_la_meteo`) et le calque de référence de l'éditeur ; tout autre chose
## posée sur le monde appartient à qui l'instancie.
class_name Monde
extends Node3D

## La caméra a pivoté ou zoomé : ce qui est sous le pointeur a pu changer.
signal cadrage_change

const DUREE_QUART_S := 0.25
## Le tangage de la caméra au regard `tactique`, plongeante de biais.
const TANGAGE_TACTIQUE := -0.9
## Une hauteur sous tout monde, où finit le rayon qui cherche le sol sous un lieu.
const SOUS_LE_MONDE := -1000.0
## La vitesse (m/s) de la caméra qui glisse au clavier.
const VITESSE_DE_GLISSE_M_S := 16.0
## La distance (cases) en deçà de laquelle une particule de météo s'efface devant la caméra, et celle où elle est
## pleine : une goutte qui frôle l'œil de l'immersion n'est pas un pan de mur.
const PRES_DE_L_OEIL := 0.5
const LOIN_DE_L_OEIL := 1.5
const DISTANCE_MIN := 6.0
const DISTANCE_MAX := 40.0
## La hauteur (m) au-dessus du lieu que regarde la caméra d'où se cherche le sol sous lui (`camera`).
const AU_DESSUS_DU_LIEU_M := 1.0
## Les items de `surbrillances`.
const ITEM_ATTEIGNABLE := 0
const ITEM_CIBLE := 1
const ITEM_SURVOL := 2
## Les actions du clavier qui mènent la caméra et l'œil, dans l'ordre des forces (`forces_du_clavier`).
const ACTIONS_DE_MARCHE: Array[StringName] = [&"gauche", &"droite", &"avant", &"arriere"]

## Les plaques des surbrillances, par item (`ITEM_*`), chacune posée sans ombre.
@export var surbrillances: MeshLibrary
## La gaine de l'arête choisie.
@export var mesh_arete_choisie: BoxMesh
## La matière du calque de référence, sans ombrage, transparente, vue des deux côtés.
@export var matiere_du_calque: StandardMaterial3D

## Le volume de la scène, que qui instancie le monde pose (`VolumeDeScene`).
@onready var volume: VolumeDeScene = $VolumeDeScene
@onready var _forme: CollisionShape3D = $VolumeDeScene/Volume/Corps/Forme
@onready var _meteo: Node3D = $VolumeDeScene/Volume/Meteo
@onready var _pivot: Node3D = $Pivot
@onready var _inclinaison: Node3D = $Pivot/Inclinaison
@onready var _camera: Camera3D = $Pivot/Inclinaison/Camera
@onready var _oeil: Camera3D = $Oeil
@onready var _surbrillance: Node3D = $Surbrillance
@onready var _etiquettes: Node3D = $Etiquettes
@onready var _arete_choisie: MeshInstance3D = $AreteChoisie
@onready var _calque: MeshInstance3D = $Calque

## La case `[x, y, z]` de chaque triangle du maillage du monde, sa couche comprise, dans son ordre.
var _cases_des_triangles: Array = []
## Le son de la météo qui joue en boucle, `null` sans son (`poser_la_meteo`).
var _son_de_la_meteo: AudioStreamPlayer = null
## Par couche `z`, le sol de chaque case, `[y][x]`.
var _sols: Dictionary = {}
var _lacet := 0.0
## Les clés des nappes de toit levées, et les crans de caméra sous lesquels tombe chaque arête dégagée, par clé
## (`cacher_le_bati`).
var _toits_leves: Array = []
var _aretes_degagees: Dictionary = {}
## Les noms posés (`etiqueter`), par case `x,y,z`.
var _noms := {}
var _pivotement: Tween
var _suivi: Tween
## Le dernier lieu que la caméra suit (`suivre`), `null` avant le premier.
var _suivi_lieu: Variant = null
## Le regard posé (`regarder`).
var _regard := "tactique"
## Les actions de marche dont l'appui a atteint `_input`, tant qu'elles restent tenues.
var _prises: Dictionary = {}
## Par case (`Vector3i`, sa couche comprise) que le modèle d'un navire rogne, le point de la carte où s'y tient son
## occupant (`poser_les_stations`).
var _stations := {}


func _ready() -> void:
	_lacet = _pivot.rotation.y


## Le volume du monde de la scène (`monde`) posé par le volume (`VolumeDeScene.poser`), avec l'ombre de ce que le
## regard en retire, en forme hors des mers des navires, que le rayon du pointeur touche des deux côtés, le sol de chaque
## case de chaque couche, et la caméra centrée sur lui. Chaque tableau du volume retourné en entier
## (`VolumeDeScene._maillage_de`) retourne l'ordre des triangles, que suivent leurs cases.
func poser(monde: Dictionary) -> void:
	volume.poser(monde)
	var tous := PackedFloat32Array(monde.positions).to_byte_array().to_vector3_array()
	var sommets := PackedVector3Array()
	_cases_des_triangles = []
	for surface: Dictionary in monde.surfaces:
		if surface.has("flottaison"):
			continue
		sommets.append_array(tous.slice(int(surface.debut), int(surface.fin)))
		_cases_des_triangles.append_array(monde.cases.slice(int(MiseEnPage.triangles(int(surface.debut))), int(MiseEnPage.triangles(int(surface.fin)))))
	sommets.reverse()
	_cases_des_triangles.reverse()
	var forme := ConcavePolygonShape3D.new()
	forme.set_faces(sommets)
	forme.backface_collision = true
	_forme.shape = forme
	_sols.clear()
	for couche in monde.hauteurs:
		_sols[int(couche.z)] = couche.rangees.map(func(rangee: Array) -> Array: return rangee.map(func(hauteur: float) -> float: return MiseEnPage.hauteur_au_plateau(hauteur, monde.metresParCase)))
	_pivot.position = MiseEnPage.centre_du_plateau(taille())


## La météo du regard (`meteo`, `CONTRAT.md`, section « Monde ») dans le volume, à la place de la précédente : une
## averse de particules par boîte de `pluie.averses`, étirées dans le sens de leur chute et effacées près de la caméra,
## et chaque nappe de brume, plate et translucide, et son son en boucle (#3834), que le même son laisse jouer ; rien
## sans météo.
func poser_la_meteo(meteo: Variant) -> void:
	for posee in _meteo.get_children():
		_meteo.remove_child(posee)
		posee.free()
	_entendre_la_meteo(null if meteo == null else meteo.son)
	if meteo == null:
		return
	if meteo.pluie != null:
		for averse in meteo.pluie.averses:
			_meteo.add_child(_averse(meteo.pluie, averse))
	for nappe in meteo.nappes:
		_meteo.add_child(_nappe_de_brume(nappe))


## Le son `son` de la météo (`null` : aucun) joué partout en boucle, à la place du précédent s'il en diffère.
func _entendre_la_meteo(son: Variant) -> void:
	var voulu: String = "" if son == null else son.id
	var joue: String = "" if _son_de_la_meteo == null else _son_de_la_meteo.get_meta("son")
	if voulu == joue:
		return
	if _son_de_la_meteo != null:
		_son_de_la_meteo.queue_free()
		_son_de_la_meteo = null
	if son == null:
		return
	_son_de_la_meteo = AudioStreamPlayer.new()
	_son_de_la_meteo.name = "son-%s" % son.id
	_son_de_la_meteo.set_meta("son", son.id)
	_son_de_la_meteo.stream = Effets.variante_du_son(son, true)
	_son_de_la_meteo.volume_db = linear_to_db(son.volume)
	_son_de_la_meteo.autoplay = true
	add_child(_son_de_la_meteo, true)


## Le son de la météo qui joue, `null` sans son.
func son_de_la_meteo() -> AudioStreamPlayer:
	return _son_de_la_meteo


func _averse(pluie: Dictionary, averse: Dictionary) -> CPUParticles3D:
	var particules := CPUParticles3D.new()
	particules.position = Vector3(averse.centre[0], averse.centre[1], averse.centre[2])
	particules.amount = int(averse.nombre)
	particules.lifetime = pluie.dureeS
	particules.preprocess = pluie.dureeS
	particules.local_coords = true
	particules.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	particules.emission_box_extents = Vector3(averse.demiEtendue[0], averse.demiEtendue[1], averse.demiEtendue[2])
	particules.direction = Vector3(pluie.sens.x, pluie.sens.y, pluie.sens.z)
	particules.spread = 0.0
	particules.gravity = Vector3.ZERO
	particules.initial_velocity_min = pluie.vitesseMs
	particules.initial_velocity_max = pluie.vitesseMs
	particules.particle_flag_align_y = true
	particules.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var goutte := BoxMesh.new()
	goutte.size = Vector3(pluie.largeurM, pluie.traineeM, pluie.largeurM)
	var matiere := _translucide(pluie.couleur, pluie.opacite)
	matiere.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_ALPHA
	matiere.distance_fade_min_distance = PRES_DE_L_OEIL
	matiere.distance_fade_max_distance = LOIN_DE_L_OEIL
	goutte.material = matiere
	particules.mesh = goutte
	return particules


func _nappe_de_brume(nappe: Dictionary) -> MeshInstance3D:
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedFloat32Array(nappe.positions).to_byte_array().to_vector3_array()
	var maillage := ArrayMesh.new()
	maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	var instance := MeshInstance3D.new()
	instance.mesh = maillage
	instance.material_override = _translucide(nappe.couleur, nappe.alpha)
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return instance


## Une matière sans éclairage ni brume de profondeur, vue des deux côtés, de teinte `couleur` à l'opacité `opacite`.
func _translucide(couleur: String, opacite: float) -> StandardMaterial3D:
	var matiere := StandardMaterial3D.new()
	matiere.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	matiere.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	matiere.cull_mode = BaseMaterial3D.CULL_DISABLED
	matiere.disable_fog = true
	matiere.albedo_color = Color(couleur, opacite)
	return matiere


## Chaque nappe de toit que `toits_leves` nomme (`plateau.toitsLeves`) cachée à la caméra (`VolumeDeScene.cacher`),
## chaque couronne que `couronnes_abattues` nomme (`plateau.couronnesAbattues`) retirée
## (`VolumeDeScene.retirer_les_couronnes`), et chaque arête que le groupe dégage
## (`aretes_degagees`, `plateau.aretesDegagees`) abattue avec sa couronne sous le regard de la caméra
## (`_abattre_les_aretes`) ; montrées sinon.
func cacher_le_bati(toits_leves: Array, couronnes_abattues: Array, aretes_degagees: Array) -> void:
	_toits_leves = toits_leves
	volume.retirer_les_couronnes(couronnes_abattues)
	_aretes_degagees.clear()
	for a in aretes_degagees:
		_aretes_degagees[a.cle] = a.abattueSous
	_abattre_les_aretes()


## Le volume cache à la caméra (`VolumeDeScene.cacher`) les nappes de toit levées et les arêtes dégagées qui tombent
## sous le cran de la caméra (`MiseEnPage.rotation_iso`) avec leur couronne ; le reste montré.
func _abattre_les_aretes() -> void:
	var cran := int(MiseEnPage.rotation_iso(_camera.global_basis.z))
	var abattues := _aretes_degagees.keys().filter(func(cle: String) -> bool: return _aretes_degagees[cle].has(cran))
	volume.cacher(abattues, _toits_leves, abattues)


## Les couches du dernier monde posé.
func couches() -> Array:
	return _sols.keys()


## La taille de la carte, en cases.
func taille() -> Vector2i:
	return Vector2i(_sols[0][0].size(), _sols[0].size())


## Le sol de la case `case` de la couche `z`.
func sol(case: Vector2i, z := 0) -> float:
	return _sols[z][case.y][case.x]


## Où se tient l'occupant de la case `case` de la couche `z`, sur son sol : à sa station si le modèle d'un navire la
## rogne (`poser_les_stations`), en son centre sinon.
func lieu(case: Vector2i, z := 0) -> Vector3:
	var station: Variant = _stations.get(Vector3i(case.x, case.y, z))
	if station == null:
		return MiseEnPage.centre_de_case(case, sol(case, z))
	return MiseEnPage.point_de_la_carte(station.x, station.y, sol(case, z))


## Les stations des navires servis (`navires`, `vue.corps.navires`, chacun ses `stations`), à la place des précédentes.
func poser_les_stations(navires: Dictionary) -> void:
	_stations = {}
	for id: String in navires:
		for s: Dictionary in navires[id].stations:
			_stations[Vector3i(int(s.x), int(s.y), int(s.z))] = Vector2(s.point.x, s.point.y)


## Le point de l'écran du centre du sol de chaque case de la couche `z` devant la caméra, par sa clé `x,y`.
func points(z := 0) -> Dictionary:
	var points := {}
	var t := taille()
	for y in t.y:
		for x in t.x:
			var point: Variant = a_l_ecran(lieu(Vector2i(x, y), z))
			if point != null:
				points["%d,%d" % [x, y]] = [point.x, point.y]
	return points


## Les plaques `plaques` (par case `Vector3i(x, y, z)`, l'item de `surbrillances`), chacune sur le sol de sa case, à la
## place des précédentes, montrées hors du regard `immersion` (`regarder`).
func peindre(plaques: Dictionary) -> void:
	for plaque in _surbrillance.get_children():
		_surbrillance.remove_child(plaque)
		plaque.free()
	for c: Vector3i in plaques:
		var item: int = plaques[c]
		var plaque := MeshInstance3D.new()
		plaque.mesh = surbrillances.get_item_mesh(item)
		plaque.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		plaque.transform = surbrillances.get_item_mesh_transform(item).translated(lieu(Vector2i(c.x, c.y), c.z))
		_surbrillance.add_child(plaque)


## Les noms `noms` (par case `Vector3i(x, y, z)`, le texte), chacun au-dessus du sol de sa case, devant la scène hors de
## l'immersion, où les murs les cachent, à la place des précédents.
func etiqueter(noms: Dictionary) -> void:
	for etiquette in _etiquettes.get_children():
		_etiquettes.remove_child(etiquette)
		etiquette.free()
	_noms.clear()
	for c: Vector3i in noms:
		var nom := Label3D.new()
		nom.text = noms[c]
		nom.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		nom.no_depth_test = _regard != "immersion"
		nom.position = MiseEnPage.au_dessus_de_la_case(Vector2i(c.x, c.y), sol(Vector2i(c.x, c.y), c.z))
		_etiquettes.add_child(nom)
		_noms["%d,%d,%d" % [c.x, c.y, c.z]] = noms[c]


## Les noms posés sur le monde, par case `x,y,z`.
func noms() -> Dictionary:
	return _noms


## La gaine de l'arête choisie sur l'arête `arete`, aucune si `arete` est `null`.
func choisir_l_arete(arete: Variant) -> void:
	_arete_choisie.visible = arete != null
	if arete != null:
		volume.poser_sur_l_arete(_arete_choisie, mesh_arete_choisie, arete)


## Le calque de référence `calque` (`CONTRAT.md`, section « Éditeur ») sous la texture `planche`, ses quatre coins sur
## son plan : juste au-dessus du sol et par-dessus toute la scène s'il passe dessus, sinon juste dessous, à son opacité ;
## aucun si `calque` est `null` ou sa planche absente.
func poser_le_calque(calque: Variant, planche: Texture2D) -> void:
	_calque.visible = calque != null and planche != null
	if not _calque.visible:
		return
	var hauteur := MiseEnPage.hauteur_du_calque(calque.plan, volume.metres_par_case, MiseEnPage.DECALAGE_DU_CALQUE if calque.dessus else -MiseEnPage.DECALAGE_DU_CALQUE)
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedVector3Array(calque.coins.map(func(c: Dictionary) -> Vector3: return MiseEnPage.point_de_la_carte(c.x, c.y, hauteur)))
	tableaux[Mesh.ARRAY_TEX_UV] = PackedVector2Array([Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)])
	tableaux[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2, 0, 2, 3])
	var maillage := ArrayMesh.new()
	maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	_calque.mesh = maillage
	var matiere := matiere_du_calque.duplicate() as StandardMaterial3D
	matiere.albedo_texture = planche
	matiere.albedo_color = Color(1, 1, 1, calque.opacite)
	matiere.no_depth_test = calque.dessus
	_calque.material_override = matiere


## Si le calque de référence est posé sur le monde.
func calque_pose() -> bool:
	return _calque.visible


## Le point de l'écran du lieu `lieu` du monde, sous la caméra du regard ; `null` derrière elle.
func a_l_ecran(lieu: Vector3) -> Variant:
	var camera := get_viewport().get_camera_3d()
	return null if camera.is_position_behind(lieu) else camera.unproject_position(lieu)


## Ce que le rayon de la caméra du regard par `point` touche le premier (`_toucher`), `null` hors du monde.
func touche_sous(point: Vector2) -> Variant:
	var camera := get_viewport().get_camera_3d()
	return _toucher(camera.project_ray_origin(point), camera.project_position(point, camera.far))


## Le sol que touche le premier un rayon tombé à la verticale de `lieu` (`_toucher`), `null` hors du monde.
func sol_sous(lieu: Vector3) -> Variant:
	return _toucher(lieu, Vector3(lieu.x, SOUS_LE_MONDE, lieu.z))


## Ce que le rayon de `origine` à `fin` touche le premier : `{ case, f, lieu }`, la case de son triangle et sa couche
## (`Vector3i(x, y, z)`), le point de la carte touché (`MiseEnPage.point_de_carte_du_lieu`) et le lieu touché, `null`
## hors du monde.
func _toucher(origine: Vector3, fin: Vector3) -> Variant:
	var touche := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(origine, fin))
	if touche.is_empty():
		return null
	var case: Array = _cases_des_triangles[touche.face_index]
	return {case = Vector3i(int(case[0]), int(case[1]), int(case[2])), f = MiseEnPage.point_de_carte_du_lieu(to_local(touche.position)), lieu = touche.position}


## La case du triangle du monde et sa couche (`Vector3i(x, y, z)`) que le rayon de la caméra par `point` touche le premier,
## `null` hors du monde.
func case_sous(point: Vector2) -> Variant:
	var touche: Variant = touche_sous(point)
	return null if touche == null else touche.case


## Le regard `regard` (`plateau.regard`, `CONTRAT.md`, section « Vue ») : en tactique, la caméra de biais et en
## perspective ; au plateau, à la verticale, sans perspective, les bords du plateau droits à l'écran ; en immersion,
## l'œil, les noms cachés par les murs et aucune plaque de surbrillance : sans ombrage, une plaque au sol sous l'œil
## se lit en lumière sur un plancher couvert (#3774), et le point de mire désigne la case visée. Les arêtes dégagées
## suivent le cran de la caméra.
func regarder(regard: String) -> void:
	if regard == _regard:
		return
	_regard = regard
	_oeil.current = regard == "immersion"
	_camera.current = regard != "immersion"
	var plateau := regard == "plateau"
	_inclinaison.rotation.x = MiseEnPage.TANGAGE_DU_PLATEAU if plateau else TANGAGE_TACTIQUE
	_camera.projection = Camera3D.PROJECTION_ORTHOGONAL if plateau else Camera3D.PROJECTION_PERSPECTIVE
	_camera.size = _camera.position.z
	_orienter()
	for nom: Label3D in _etiquettes.get_children():
		nom.no_depth_test = regard != "immersion"
	_surbrillance.visible = regard != "immersion"
	_abattre_les_aretes()
	cadrage_change.emit()


## La caméra des regards `tactique` et `plateau` glisse jusqu'au lieu `lieu`, qu'elle suit, dès qu'il change : une caméra
## qu'on a fait glisser reste où elle est tant qu'il ne bouge pas.
func suivre(lieu: Vector3) -> void:
	if _suivi_lieu != null and lieu.is_equal_approx(_suivi_lieu):
		return
	_suivi_lieu = lieu
	_rejoindre(lieu)


func _rejoindre(lieu: Vector3) -> void:
	if _suivi != null:
		_suivi.kill()
	_suivi = create_tween()
	_suivi.tween_property(_pivot, "position", lieu, DUREE_QUART_S)
	_suivi.tween_callback(cadrage_change.emit)


## L'œil du regard `immersion` au lieu `lieu`, tourné du lacet `lacet` et du tangage `tangage`.
func poser_l_oeil(lieu: Vector3, lacet: float, tangage: float) -> void:
	_oeil.global_position = lieu
	_oeil.rotation = Vector3(tangage, lacet, 0.0)
	cadrage_change.emit()


## Le regard posé (`regarder`).
func regard() -> String:
	return _regard


## La caméra des regards `tactique` et `plateau` posée sans glisser sur le lieu `lieu`, qu'elle regarde au lacet `lacet`
## sous tout regard (au plateau, `MiseEnPage.lacet_sous_le_plateau`), à la distance `distance` ; elle y reste tant que
## le lieu suivi ne bouge pas (`suivre`). Rend si `distance` tient dans le zoom (`DISTANCE_MIN`, `DISTANCE_MAX`), sans
## rien poser sinon.
func cadrer(lieu: Vector3, lacet: float, distance: float) -> bool:
	if MiseEnPage.distance_zoomee(distance, 0.0, DISTANCE_MIN, DISTANCE_MAX) != distance:
		return false
	for tween: Tween in [_suivi, _pivotement]:
		if tween != null:
			tween.kill()
	_pivot.position = lieu
	_lacet = MiseEnPage.lacet_sous_le_plateau(lacet) if _regard == "plateau" else lacet
	_orienter()
	_camera.position.z = distance
	_camera.size = distance
	_abattre_les_aretes()
	cadrage_change.emit()
	return true


## La caméra du regard telle qu'elle est posée (`CONTRAT.md`, section « Écran publié », `wfrpCadrer`) : le regard, la
## case et la couche (`[x, y, z]`) du sol touché sous l'œil, ou sous le lieu que regarde la caméra des regards
## `tactique` et `plateau` (`null` hors du monde), l'azimut où elle regarde et son tangage, en degrés
## (`MiseEnPage.azimut_du_lacet`), et sa distance, `null` en immersion.
func camera() -> Dictionary:
	var immersion := _regard == "immersion"
	var sol: Variant = sol_sous(_oeil.global_position if immersion else MiseEnPage.oeil_sur(_pivot.position, AU_DESSUS_DU_LIEU_M, volume.metres_par_case))
	return {
		regard = _regard,
		case = null if sol == null else [sol.case.x, sol.case.y, sol.case.z],
		lacet = MiseEnPage.azimut_du_lacet(_oeil.rotation.y if immersion else _pivot.rotation.y),
		tangage = rad_to_deg(_oeil.rotation.x if immersion else _inclinaison.rotation.x),
		zoom = null if immersion else _camera.position.z,
	}


## Le clavier mène la caméra ou l'œil : aucun champ de saisie n'a le focus.
func clavier_libre() -> bool:
	var focus := get_viewport().gui_get_focus_owner()
	return not (focus is LineEdit or focus is TextEdit)


## Une touche de marche que l'interface n'a pas prise est au monde seul : les flèches ne déplacent pas le focus du
## panneau. Une liste ouverte (le `PopupMenu` d'un `OptionButton`, fenêtre incrustée qui a le focus) reçoit la touche
## avant tout `_input` de la scène, qui ne la voit pas (« Using InputEvent », « How does it work? », Godot 4.7).
func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not clavier_libre():
		return
	for action in ACTIONS_DE_MARCHE:
		if event.is_action(action):
			get_viewport().set_input_as_handled()
			if event.is_pressed():
				_prises[action] = true


## La force de chaque action de `ACTIONS_DE_MARCHE` dont l'appui a atteint `_input`, 0 pour les autres ; relâchée, une
## action n'est plus prise.
func forces_du_clavier() -> Array[float]:
	var forces: Array[float] = []
	for action in ACTIONS_DE_MARCHE:
		if not Input.is_action_pressed(action):
			_prises.erase(action)
		forces.append(Input.get_action_strength(action) if _prises.has(action) else 0.0)
	return forces


## La caméra des regards `tactique` et `plateau` glisse au clavier (ZQSD), dans le sens où elle regarde.
func _process(delta: float) -> void:
	if _regard == "immersion" or not clavier_libre():
		return
	var forces := forces_du_clavier()
	if forces.all(func(f: float) -> bool: return f == 0.0):
		return
	if _suivi != null:
		_suivi.kill()
	_pivot.position = MiseEnPage.lieu_apres_la_marche(_pivot.position, forces[0], forces[1], forces[2], forces[3], _pivot.rotation.y, MiseEnPage.metres_de_marche(VITESSE_DE_GLISSE_M_S, delta), volume.metres_par_case)
	cadrage_change.emit()


## Le lacet de la caméra posé sur le pivot : décalé d'un demi-quart de tour au plateau (`MiseEnPage.lacet_du_plateau`).
func _orienter() -> void:
	_pivot.rotation.y = MiseEnPage.lacet_du_plateau(_lacet) if _regard == "plateau" else _lacet


func _unhandled_input(event: InputEvent) -> void:
	if _regard == "immersion":
		return
	if event.is_action_pressed("pivoter_gauche"):
		_pivoter(1.0)
	elif event.is_action_pressed("pivoter_droite"):
		_pivoter(-1.0)
	elif event.is_action_pressed("recentrer") and _suivi_lieu != null:
		_rejoindre(_suivi_lieu)
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
		if _pivotement != null:
			_pivotement.kill()
		_lacet = MiseEnPage.lacet_glisse(_lacet, event.relative.x)
		_orienter()
		_abattre_les_aretes()
		cadrage_change.emit()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		_zoomer(-1.0)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		_zoomer(1.0)
	else:
		return
	get_viewport().set_input_as_handled()


func _pivoter(sens: float) -> void:
	_lacet = MiseEnPage.lacet_tourne(_lacet, sens)
	if _pivotement != null:
		_pivotement.kill()
	_pivotement = create_tween()
	_pivotement.tween_property(_pivot, "rotation:y", MiseEnPage.lacet_du_plateau(_lacet) if _regard == "plateau" else _lacet, DUREE_QUART_S)
	_pivotement.tween_callback(_abattre_les_aretes)
	_pivotement.tween_callback(cadrage_change.emit)


func _zoomer(sens: float) -> void:
	_camera.position.z = MiseEnPage.distance_zoomee(_camera.position.z, sens, DISTANCE_MIN, DISTANCE_MAX)
	_camera.size = _camera.position.z
	cadrage_change.emit()


## @contrat Vue
## Le volume de la scène (`VolumeDeScene.poser_les_aretes`) dessine les arêtes du plateau (`plateau.aretes`), chacune
## debout à son pied : la pièce
## `<famille>--<piece>` du kit des arêtes (`projet/kit/kit.glb`, assemblé par `hotes/godot/kit.mjs` depuis un pack
## modulaire CC0, `asset/kit.ts`), étirée à la longueur de l'arête et à la hauteur de son mur ; sans kit au projet ou
## sans cette pièce au kit, une boîte : un mur, une porte fermée, le seuil d'une porte ouverte ou d'une brèche.

## @contrat Vue
## Les nappes retirées (`plateau.toitsLeves`), les arêtes retirées (`plateau.aretesDegagees`) et les couronnes crénelées
## tombées avec leur mur abattu (`plateau.couronnesAbattues`), `Monde.cacher_le_bati` les cache à la caméra : les
## nappes, et chaque arête retirée sous le cran de la caméra (`MiseEnPage.rotation_iso`) avec sa couronne, revue à
## chaque quart de tour, chacune en ombre seule (`SHADOWS_ONLY`, `VolumeDeScene._cacher_sous`), le regard ne changeant que ce
## que voit la caméra, jamais l'éclairage : sous un toit levé, l'intérieur reste à l'ombre (recette
## `projet/recettes/ombres-du-regard.gd`) ; une couronne abattue, tombée avec son mur, disparaît
## (`VolumeDeScene.retirer_les_couronnes`), son ombre avec elle.

## @contrat Monde
## Le volume de la scène (`projet/scenes/VolumeDeScene.tscn`, `VolumeDeScene`, #3802), que le monde
## (`projet/scenes/Monde.tscn`, que le plateau du jeu et l'éditeur de carte instancient, #3508) et l'atelier (section
## « Atelier 3D ») instancient tous deux, le pose une fois, à l'échelle `1 / metresParCase` et décalé d'une demi-case,
## dans son repère d'une unité par case, avec les arêtes, les nappes de toit et les couronnes ; le monde le tient sous
## sa lumière et sa caméra et en tire la forme que touche le rayon du pointeur ; les pions, les surbrillances et les
## noms se posent à la hauteur de leur case (`hauteurs`, en mètres), et la case cliquée est celle du triangle que le
## rayon du pointeur touche, sa couche comprise (`cases`) : un plancher d'étage désigne sa case à l'étage. Les
## tableaux plats se chargent tels quels en tableaux de vecteurs et de
## couleurs (`PackedByteArray.to_vector3_array`, `to_color_array`).
##
## Le monde rend chaque surface de sa texture, `projet/textures/<matiere>.jpg`, et de son relief,
## `<matiere>.normale.jpg`, projetés sur les trois axes du volume, un motif tous les deux mètres ; une matière sans
## texture garde la couleur de ses sommets. La provenance et la licence de chaque texture sont dans
## `projet/textures/provenance.json` ; celles du kit des arêtes, dans `projet/kit/provenance.json` (dossiers épinglés,
## `asset/epingles.ts`).
##
## Le monde pose chaque nappe de toit et chaque couronne crénelée en maillage sous le volume, que le rayon du pointeur
## traverse (`VolumeDeScene.poser_les_nappes`). Aucune géométrie ni couleur ne se réécrit en GDScript.
##
## `Monde.poser_la_meteo` pose la météo (`meteo`) dans le volume : une averse de particules par boîte, étirées dans le
## sens de leur chute, et chaque nappe translucide, sans éclairage ni brume de profondeur. Il joue aussi son son
## (`meteo.son` : la pluie, l'orage, #3834) en boucle, partout, sans lieu : la même météo garde son lecteur, une autre
## le remplace, aucune le retire (recette `projet/recettes/meteo.gd`).
