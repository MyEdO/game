extends SceneTree

## La coupe d'un navire et sa mer (#3686, `hotes/godot/pont/CONTRAT.md`, sections « Vue », `plateau.coupesDesNavires`,
## et « Monde », surfaces `flottaison`) : le modèle de la caraque, son GLB au projet, posé à l'échelle du plateau d'une
## scène de 2 m par case. Coupé sous le pont principal (sol à 0 m, regard sur la cale) puis sous le pont supérieur (sol
## à 1,95 m), chaque matière de ses meshes écarte ce qui est au-dessus de la coupe (`MontageDeVehicule.couper`) : chaque
## sommet au-dessus a une opacité sous le seuil, chaque sommet dessous au-dessus ; sans coupe, rien n'est écarté. Son
## ombre reste celle du navire entier, pièce montée comprise (une Amélioration, le nid-de-pie, au mât) : aucun mesh coupé
## ne projette d'ombre, chacun a son double d'ombre, son mesh d'avant la coupe à son repère, en matières opaques, et le
## pont principal, sous le pont supérieur coupé, reste dans l'ombre de ce qui est au-dessus de la coupe. Sur le
## monde, la mer de sa flottaison, le rectangle de ses ponts à la hauteur 0, n'est peinte que hors de ce que sa coque
## plonge sous l'eau (`MontageDeVehicule.contour_sous`, `VolumeDeScene.border_la_mer`) : de l'eau de part et d'autre de la coque,
## aucune dedans, toute l'aire du rectangle hors d'elle, et le rayon du pointeur ne la touche pas.

const RECETTE_AUTONOME := true
const GLB := "res://modeles/vehicule--caraque.glb"
## Une Amélioration montée sous la scène du navire, au-dessus de toute coupe, et sa place dans le repère du modèle.
const PIECE := "res://modeles/amelioration--nid-de-pie.glb"
const PLACE_DE_LA_PIECE := Vector3(0.0, 20.0, 0.0)
const METRES_PAR_CASE := 2.0
## L'origine du modèle au plateau, et la même en mètres dans le repère du volume (décalé d'une demi-case).
const ORIGINE := Vector3(10.5, 0.0, 4.5)
const ORIGINE_DU_VOLUME := Vector3(20.0, 0.0, 8.0)
## Le rectangle des ponts de la caraque (18 × 5 cases de 2 m), sa proue au +Z du modèle : 10 m de large, 36 m de long.
const DEMI_LARGEUR := 5.0
const DEMI_LONGUEUR := 18.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[coupe-du-navire] version=", Engine.get_version_info().string)
	var scene := _scene_du_glb(GLB)
	var amelioration := _scene_du_glb(PIECE)
	if scene == null or amelioration == null:
		_finir()
		return
	var montage := MontageDeVehicule.new()
	root.add_child(montage)
	montage.add_child(scene)
	montage.scene = scene
	scene.add_child(amelioration)
	amelioration.position = PLACE_DE_LA_PIECE
	var echelle := MiseEnPage.echelle_metrique(METRES_PAR_CASE)
	scene.transform = Transform3D(Basis.from_scale(Vector3(echelle, echelle, echelle)), ORIGINE)
	for sol in [0.0, 1.95]:
		_coupe(montage, sol)
	_ombre(montage, amelioration)
	montage.couper(null)
	for piece: MeshInstance3D in _pieces(montage):
		for rang in piece.mesh.get_surface_count():
			if not is_zero_approx((piece.get_surface_override_material(rang) as BaseMaterial3D).alpha_scissor_threshold):
				_fautes.append("sans coupe : %s, surface %d écarte encore des fragments" % [piece.name, rang])
	await _mer(montage)
	_finir()


func _finir() -> void:
	for faute in _fautes:
		push_error("[coupe-du-navire] " + faute)
	print("[coupe-du-navire] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La scène neuve du GLB `glb`, `null` (une faute) s'il est illisible.
func _scene_du_glb(glb: String) -> Node3D:
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	if document.append_from_buffer(FileAccess.get_file_as_bytes(glb), "", etat) != OK:
		_fautes.append("GLB illisible : %s" % glb)
		return null
	return document.generate_scene(etat) as Node3D


## Les meshes que montre la scène du montage, hors de leurs doubles d'ombre.
func _pieces(montage: MontageDeVehicule) -> Array:
	return montage.scene.find_children("*", "MeshInstance3D", true, false).filter(func(piece: MeshInstance3D) -> bool: return piece.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY)


## Ce que la passe d'ombre projette de la scène du montage : chaque mesh visible qui projette, en matières opaques. Une
## matière à ciseau d'alpha de sommet n'y projette rien, ou tout, selon son seuil (sonde au rendu GL Compatibility).
func _projetants(montage: MontageDeVehicule) -> Array:
	return montage.scene.find_children("*", "MeshInstance3D", true, false).filter(func(piece: MeshInstance3D) -> bool:
		return piece.is_visible_in_tree() and piece.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF and range(piece.mesh.get_surface_count()).all(func(rang: int) -> bool: return (piece.get_active_material(rang) as BaseMaterial3D).transparency == BaseMaterial3D.TRANSPARENCY_DISABLED))


## L'ombre du modèle coupé sous le pont supérieur : aucun mesh coupé ne projette, chacun (la pièce montée `piece`
## comprise) a un double d'ombre seule à son repère, de ses sommets, en matières opaques ; de chaque point du pont
## principal sous le pont supérieur, le rayon vers le haut touche ce qui projette au-dessus de la coupe.
func _ombre(montage: MontageDeVehicule, piece: Node3D) -> void:
	if piece.find_children("*", "MeshInstance3D", true, false).is_empty():
		_fautes.append("ombre : la pièce montée n'a aucun mesh")
	for coupee: MeshInstance3D in _pieces(montage):
		if coupee.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
			_fautes.append("ombre : %s, coupé, projette encore son ombre" % coupee.name)
		var doubles := coupee.get_children().filter(func(enfant: Node) -> bool: return enfant is MeshInstance3D and enfant.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY)
		if doubles.size() != 1:
			_fautes.append("ombre : %s a %d doubles d'ombre, attendu 1" % [coupee.name, doubles.size()])
			continue
		var double: MeshInstance3D = doubles[0]
		if not double.global_transform.is_equal_approx(coupee.global_transform) or double.mesh.get_surface_count() != coupee.mesh.get_surface_count():
			_fautes.append("ombre : le double de %s n'est pas à son repère ou n'a pas ses surfaces" % coupee.name)
			continue
		for rang in coupee.mesh.get_surface_count():
			if double.mesh.surface_get_arrays(rang)[Mesh.ARRAY_VERTEX] != coupee.mesh.surface_get_arrays(rang)[Mesh.ARRAY_VERTEX]:
				_fautes.append("ombre : le double de %s, surface %d, n'a pas ses sommets" % [coupee.name, rang])
	var coupe := MiseEnPage.hauteur_de_coupe(1.95, METRES_PAR_CASE)
	var pont := MiseEnPage.hauteur_au_plateau(0.05, METRES_PAR_CASE)
	var triangles: Array[PackedVector3Array] = []
	for projetant: MeshInstance3D in _projetants(montage):
		for rang in projetant.mesh.get_surface_count():
			var tableaux := projetant.mesh.surface_get_arrays(rang)
			var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
			var ordre: Variant = range(sommets.size()) if tableaux[Mesh.ARRAY_INDEX] == null else tableaux[Mesh.ARRAY_INDEX]
			for triangle: Array in VolumeDeScene.rangs_des_triangles(ordre.size()):
				triangles.append(PackedVector3Array(triangle.map(func(rang_du_sommet: int) -> Vector3: return projetant.to_global(sommets[ordre[rang_du_sommet]]))))
	var a_l_ombre := 0
	for dz in [-4.0, 0.0, 3.0]:
		for dx in [-1.0, 0.0, 1.0]:
			var point := Vector3(ORIGINE.x + dx, pont, ORIGINE.z + dz)
			if triangles.any(func(t: PackedVector3Array) -> bool:
				var touche: Variant = Geometry3D.ray_intersects_triangle(point, Vector3.UP, t[0], t[1], t[2])
				return touche != null and touche.y > coupe):
				a_l_ombre += 1
			else:
				_fautes.append("ombre : le pont principal en %s est au soleil sous le pont supérieur coupé" % point)
	print("[coupe-du-navire] ombre : %d points du pont principal sur 9 sous l'ombre du pont supérieur coupé, %d triangles projetés" % [a_l_ombre, triangles.size()])


## Le modèle coupé sous le sol `sol` (m) : chaque surface écarte, par son seuil d'opacité, chaque sommet au-dessus de la
## hauteur de coupe et garde chaque sommet dessous, hors de ceux que la précision d'une opacité (un 255e de la hauteur
## du modèle) ne sépare pas de la coupe ; la coupe ôte et garde quelque chose.
func _coupe(montage: MontageDeVehicule, sol: float) -> void:
	var hauteur := MiseEnPage.hauteur_de_coupe(sol, METRES_PAR_CASE)
	montage.couper(hauteur)
	var boite: AABB = MontageDeVehicule.boite(montage.scene, montage)
	var precision := boite.size.y / 255.0
	var dessus := 0
	var dessous := 0
	for piece: MeshInstance3D in _pieces(montage):
		for rang in piece.mesh.get_surface_count():
			var matiere := piece.get_surface_override_material(rang) as BaseMaterial3D
			if matiere.transparency != BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR or not matiere.vertex_color_use_as_albedo:
				_fautes.append("sol %.2f : %s, surface %d n'écarte rien par l'opacité de ses sommets" % [sol, piece.name, rang])
				continue
			var tableaux := piece.mesh.surface_get_arrays(rang)
			var couleurs: PackedColorArray = tableaux[Mesh.ARRAY_COLOR]
			var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
			for i in sommets.size():
				var y := montage.to_local(piece.to_global(sommets[i])).y
				var ecarte := couleurs[i].a < matiere.alpha_scissor_threshold
				if absf(y - hauteur) < precision:
					continue
				if (y > hauteur) != ecarte:
					_fautes.append("sol %.2f : %s, sommet à %.3f %s (coupe à %.3f)" % [sol, piece.name, y, "écarté" if ecarte else "gardé", hauteur])
					return
				if ecarte:
					dessus += 1
				else:
					dessous += 1
	if dessus == 0 or dessous == 0:
		_fautes.append("sol %.2f : la coupe ôte %d sommets et en garde %d" % [sol, dessus, dessous])
	print("[coupe-du-navire] sol %.2f : %d sommets écartés, %d gardés" % [sol, dessus, dessous])


## La mer du rectangle des ponts, deux triangles par case de 2 m à la hauteur 0, chacun dans le sens trigonométrique vu
## d'en haut comme le volume les oriente (`CONTRAT.md`, section « Monde »), et une case de pont touchée, sur le monde
## plat de deux couches de ses cases ; bordée par la coque : de l'eau à bâbord et à tribord de la coque au maître-bau,
## aucune en son milieu ni dans son contour, l'aire du rectangle hors de la coque, chaque morceau dans le sens de son
## triangle (retourné pour Godot comme tout le volume), et la forme du pointeur sans elle.
func _mer(montage: MontageDeVehicule) -> void:
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var positions: Array[float] = []
	var cases := []
	var x0 := ORIGINE_DU_VOLUME.x - DEMI_LARGEUR
	var z0 := ORIGINE_DU_VOLUME.z - DEMI_LONGUEUR
	for colonne in int(2.0 * DEMI_LARGEUR / METRES_PAR_CASE):
		for rangee in int(2.0 * DEMI_LONGUEUR / METRES_PAR_CASE):
			var a := Vector3(x0 + colonne * METRES_PAR_CASE, 0.0, z0 + rangee * METRES_PAR_CASE)
			for triangle in [[a, a + Vector3(0.0, 0.0, METRES_PAR_CASE), a + Vector3(METRES_PAR_CASE, 0.0, METRES_PAR_CASE)], [a, a + Vector3(METRES_PAR_CASE, 0.0, METRES_PAR_CASE), a + Vector3(METRES_PAR_CASE, 0.0, 0.0)]]:
				for p: Vector3 in triangle:
					positions.append_array([p.x, p.y, p.z])
				cases.append_array([colonne, rangee, 0])
	var mer := positions.size() / 3
	positions.append_array([20.0, 0.0, 8.0, 21.0, 0.0, 8.0, 20.0, 0.0, 9.0])
	cases.append_array([0, 0, 1])
	var normales: Array[float] = []
	var couleurs: Array[float] = []
	for i in positions.size() / 3:
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([0.2, 0.35, 0.55, 1.0])
	var mer_et_pont := {cle = "sol/0/0/0", empreinte = "mer", rangee = 0, positions = positions, normales = normales, couleurs = couleurs, cases = cases,
		surfaces = [{debut = 0, fin = mer, matiere = "terrain--eau", flottaison = "caraque"}, {debut = mer, fin = mer + 3, matiere = "terrain--planches", navire = "caraque"}]}
	var rangees := []
	for rangee in int(2.0 * DEMI_LONGUEUR / METRES_PAR_CASE):
		var plate := []
		plate.resize(int(2.0 * DEMI_LARGEUR / METRES_PAR_CASE))
		plate.fill(0.0)
		rangees.append(plate)
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = rangees}, {z = 1, rangees = rangees}], morceaux = [mer_et_pont]},
		toits = [], couronnes = []}, {volume = [mer_et_pont], toits = [], couronnes = []})
	var formes := monde.get_node("VolumeDeScene/Volume/Corps").get_children()
	var touches: int = -1 if formes.size() != 1 else (formes[0] as CollisionShape3D).shape.get_faces().size()
	if touches != 3:
		_fautes.append("mer : la forme du pointeur porte %d sommets (%d formes), attendu les 3 du pont seul" % [touches, formes.size()])
	monde.volume.border_la_mer("caraque", montage.contour_sous(0.0))
	var volume := monde.get_node("VolumeDeScene/Volume") as Node3D
	var coque := PackedVector2Array()
	for point in montage.contour_sous(0.0):
		var local := volume.to_local(Vector3(point.x, 0.0, point.y))
		coque.append(Vector2(local.x, local.z))
	var maillage := (monde.get_node("VolumeDeScene/Volume/Morceaux").get_child(0).get_node("Vu") as MeshInstance3D).mesh as ArrayMesh
	if maillage.get_surface_count() != 1:
		_fautes.append("mer : %d surfaces peintes, attendu la mer seule" % maillage.get_surface_count())
		return
	var sommets: PackedVector3Array = maillage.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var triangles := []
	var aire := 0.0
	for t in sommets.size() / 3:
		var a := Vector2(sommets[3 * t].x, sommets[3 * t].z)
		var b := Vector2(sommets[3 * t + 1].x, sommets[3 * t + 1].z)
		var c := Vector2(sommets[3 * t + 2].x, sommets[3 * t + 2].z)
		triangles.append([a, b, c])
		aire += absf((b - a).cross(c - a)) / 2.0
		if (b - a).cross(c - a) < 0.0:
			_fautes.append("mer : un triangle retourné autour de %s, sa normale peinte vers le bas" % ((a + b + c) / 3.0))
			return
		if not is_zero_approx(sommets[3 * t].y):
			_fautes.append("mer : un triangle à la hauteur %.3f, attendu 0" % sommets[3 * t].y)
		if Geometry2D.is_point_in_polygon((a + b + c) / 3.0, coque):
			_fautes.append("mer : un triangle dans la coque, autour de %s" % ((a + b + c) / 3.0))
			return
	var rectangle := PackedVector2Array([Vector2(x0, z0), Vector2(x0 + 2.0 * DEMI_LARGEUR, z0), Vector2(x0 + 2.0 * DEMI_LARGEUR, z0 + 2.0 * DEMI_LONGUEUR), Vector2(x0, z0 + 2.0 * DEMI_LONGUEUR)])
	var dans_la_coque := 0.0
	for morceau in Geometry2D.intersect_polygons(rectangle, coque):
		dans_la_coque += _aire(morceau)
	var attendue := _aire(rectangle) - dans_la_coque
	print("[coupe-du-navire] mer : %.2f m² peints, attendu %.2f (rectangle %.2f, coque %.2f)" % [aire, attendue, _aire(rectangle), dans_la_coque])
	if dans_la_coque < 100.0 or absf(aire - attendue) > 0.01 * attendue:
		_fautes.append("mer : %.2f m² peints, attendu %.2f hors de la coque (%.2f m² dedans)" % [aire, attendue, dans_la_coque])
	var bau := 0.0
	for point in coque:
		bau = maxf(bau, absf(point.x - ORIGINE_DU_VOLUME.x))
	for cote in [-1.0, 1.0]:
		var bord := Vector2(ORIGINE_DU_VOLUME.x + cote * (bau + 0.05), ORIGINE_DU_VOLUME.z + 0.3)
		if not triangles.any(func(t: Array) -> bool: return Geometry2D.point_is_inside_triangle(bord, t[0], t[1], t[2])):
			_fautes.append("mer : aucune eau contre la coque en %s" % bord)
	var milieu := Vector2(ORIGINE_DU_VOLUME.x + 0.3, ORIGINE_DU_VOLUME.z + 0.3)
	if triangles.any(func(t: Array) -> bool: return Geometry2D.point_is_inside_triangle(milieu, t[0], t[1], t[2])):
		_fautes.append("mer : de l'eau au milieu de la coque")
	await process_frame


func _aire(polygone: PackedVector2Array) -> float:
	var somme := 0.0
	for i in polygone.size():
		somme += polygone[i].cross(polygone[(i + 1) % polygone.size()])
	return absf(somme) / 2.0
