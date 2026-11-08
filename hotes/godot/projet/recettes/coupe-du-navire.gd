extends SceneTree

## La coupe d'un navire et sa mer (#3686, `hotes/godot/pont/CONTRAT.md`, sections « Vue », `plateau.coupesDesNavires`,
## et « Monde », surfaces `flottaison`) : le modèle de la caraque, son GLB au projet, posé à l'échelle du plateau d'une
## scène de 2 m par case. Coupé sous le pont principal (sol à 0 m, regard sur la cale) puis sous le pont supérieur (sol
## à 1,95 m), chaque matière de ses meshes écarte ce qui est au-dessus de la coupe (`MontageDeVehicule.couper`) : chaque
## sommet au-dessus a une opacité sous le seuil, chaque sommet dessous au-dessus ; sans coupe, rien n'est écarté. Sur le
## monde, la mer de sa flottaison, le rectangle de ses ponts à la hauteur 0, n'est peinte que hors de ce que sa coque
## plonge sous l'eau (`MontageDeVehicule.contour_sous`, `Monde.border_la_mer`) : de l'eau de part et d'autre de la coque,
## aucune dedans, toute l'aire du rectangle hors d'elle, et le rayon du pointeur ne la touche pas.

const RECETTE_AUTONOME := true
const GLB := "res://modeles/vehicule--caraque.glb"
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
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	if document.append_from_buffer(FileAccess.get_file_as_bytes(GLB), "", etat) != OK:
		_fautes.append("GLB illisible : %s" % GLB)
		_finir()
		return
	var montage := MontageDeVehicule.new()
	root.add_child(montage)
	var scene := document.generate_scene(etat) as Node3D
	montage.add_child(scene)
	montage.scene = scene
	var echelle := MiseEnPage.echelle_metrique(METRES_PAR_CASE)
	scene.transform = Transform3D(Basis.from_scale(Vector3(echelle, echelle, echelle)), ORIGINE)
	for sol in [0.0, 1.95]:
		_coupe(montage, sol)
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


func _pieces(montage: MontageDeVehicule) -> Array[Node]:
	return montage.scene.find_children("*", "MeshInstance3D", true, false)


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
## d'en haut comme le volume les oriente (`CONTRAT.md`, section « Monde »), et une case de pont touchée, sur le
## monde ; bordée par la coque : de l'eau à bâbord et à tribord de la coque au maître-bau, aucune en son milieu ni dans
## son contour, l'aire du rectangle hors de la coque, chaque morceau dans le sens de son triangle (retourné pour Godot
## comme tout le volume), et la forme du pointeur sans elle.
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
				cases.append([colonne, rangee, 0])
	var mer := positions.size() / 3
	positions.append_array([20.0, 0.0, 8.0, 21.0, 0.0, 8.0, 20.0, 0.0, 9.0])
	cases.append([0, 0, 1])
	var normales: Array[float] = []
	var couleurs: Array[float] = []
	for i in positions.size() / 3:
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([0.2, 0.35, 0.55, 1.0])
	monde.poser({metresParCase = METRES_PAR_CASE, positions = positions, normales = normales, couleurs = couleurs, cases = cases,
		surfaces = [{debut = 0, fin = mer, matiere = "terrain--eau", flottaison = "caraque"}, {debut = mer, fin = mer + 3, matiere = "terrain--planches", navire = "caraque"}],
		hauteurs = [{z = 0, rangees = [[0.0]]}, {z = 1, rangees = [[0.0]]}]})
	var touches: int = (monde.get_node("Volume/Corps/Forme") as CollisionShape3D).shape.get_faces().size()
	if touches != 3:
		_fautes.append("mer : la forme du pointeur porte %d sommets, attendu les 3 du pont seul" % touches)
	monde.border_la_mer("caraque", montage.contour_sous(0.0))
	var volume := monde.get_node("Volume") as Node3D
	var coque := PackedVector2Array()
	for point in montage.contour_sous(0.0):
		var local := volume.to_local(Vector3(point.x, 0.0, point.y))
		coque.append(Vector2(local.x, local.z))
	var maillage := (monde.get_node("Volume/Maillage") as MeshInstance3D).mesh as ArrayMesh
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
