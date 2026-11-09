extends SceneTree

## Le regard ne change que ce que voit la caméra, jamais l'éclairage (#3758, `hotes/godot/pont/CONTRAT.md`, sections
## « Vue », `plateau`, et « Monde », `ombre`) : sur un plateau de 2 m par case, un sol au rez, un étage à 3 m que le
## regard a retiré du volume (`ombre`), une nappe de toit à 5 m, deux arêtes, une boîte et une pièce du kit, chacune sous
## sa couronne, et la couronne d'un mur abattu. Le toit levé, les arêtes dégagées sous tout cran : la caméra ne voit
## ni le toit, ni l'étage, ni les arêtes, ni leurs couronnes, qui projettent toutes leur ombre ; de chaque case du sol,
## le rayon vers le soleil touche le toit et l'étage ; la couronne du mur abattu ne projette rien. Le toit et les arêtes
## rendus, chacun se montre et projette.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const NORMALES := [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0]
const COULEURS := [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
const ARETE := {milieu = {x = 1.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = 0.0, hauteurM = 3.0, piece = "mur"}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[ombres-du-regard] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde.poser({metresParCase = METRES_PAR_CASE, positions = _carre(0.0), normales = NORMALES, couleurs = COULEURS,
		cases = [[0, 0, 0], [0, 0, 0]], surfaces = [{debut = 0, fin = 6, matiere = "terrain--terre"}],
		hauteurs = [{z = 0, rangees = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]}],
		ombre = _nappe("etage", 3.0)})
	monde.poser_les_nappes([_nappe("maison", 5.0)], [_nappe("boite", 3.0), _nappe("kit", 3.0), _nappe("abattue", 3.0)])
	monde.poser_les_aretes([ARETE.merged({cle = "boite", famille = null}), ARETE.merged({cle = "kit", famille = "colombage"})])
	var degagees := ["boite", "kit"].map(func(cle: String) -> Dictionary: return {cle = cle, abattueSous = [0, 1, 2, 3]})
	monde.cacher_le_bati(["maison"], ["abattue"], degagees)
	var toit: Node3D = monde.get_node("Volume/Toits").get_child(0)
	var etage: Node3D = monde.get_node("Volume/Ombre")
	var retires := {toit = toit, etage = etage}
	for arete: Node3D in monde.get_node("Aretes").get_children():
		retires["arête " + arete.get_meta("cle")] = arete
	var couronnes := {}
	for couronne: Node3D in monde.get_node("Volume/Couronnes").get_children():
		couronnes[couronne.get_meta("cle")] = couronne
	retires["couronne boite"] = couronnes.boite
	retires["couronne kit"] = couronnes.kit
	for nom: String in retires:
		for maillage in _maillages(retires[nom]):
			if not maillage.is_visible_in_tree() or maillage.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY:
				_fautes.append("retiré : %s (%s) n'est pas en ombre seule (visible %s, ombre %d)" % [nom, maillage.name, maillage.is_visible_in_tree(), maillage.cast_shadow])
	if not _maillages(couronnes.abattue).all(func(m: GeometryInstance3D) -> bool: return not m.is_visible_in_tree()):
		_fautes.append("la couronne du mur abattu projette encore son ombre")
	var soleil := (monde.get_node("Lumiere/Soleil") as Node3D).global_basis.z
	var sous_le_toit := 0
	for y in 3:
		for x in 3:
			var sol := monde.lieu(Vector2i(x, y))
			for nom in ["toit", "etage"]:
				if _touche(sol, soleil, retires[nom]):
					sous_le_toit += 1
				else:
					_fautes.append("le sol de la case %d,%d est au soleil sous %s retiré" % [x, y, "le toit" if nom == "toit" else "l'étage"])
	print("[ombres-du-regard] %d rayons sur 18 du sol vers le soleil arrêtés par le toit et l'étage retirés" % sous_le_toit)
	monde.cacher_le_bati([], ["abattue"], [])
	for nom: String in retires:
		if nom == "etage":
			continue
		for maillage in _maillages(retires[nom]):
			if not maillage.is_visible_in_tree() or maillage.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_ON:
				_fautes.append("rendu : %s (%s) ne se montre pas ou ne projette pas" % [nom, maillage.name])
	for faute in _fautes:
		push_error("[ombres-du-regard] " + faute)
	print("[ombres-du-regard] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Deux triangles horizontaux à la hauteur `hauteur` (m), de -10 à 14 m sur X et Z, dans le sens trigonométrique vu d'en
## haut, comme le volume les oriente.
func _carre(hauteur: float) -> Array:
	return [-10.0, hauteur, -10.0, -10.0, hauteur, 14.0, 14.0, hauteur, 14.0, -10.0, hauteur, -10.0, 14.0, hauteur, 14.0, 14.0, hauteur, -10.0]


## Une géométrie du monde de clé `cle`, le carré à la hauteur `hauteur` (`_carre`), d'une matière.
func _nappe(cle: String, hauteur: float) -> Dictionary:
	return {cle = cle, positions = _carre(hauteur), normales = NORMALES, couleurs = COULEURS, cases = [[0, 0, 1], [0, 0, 1]], surfaces = [{debut = 0, fin = 6, matiere = "terrain--terre"}]}


## Les maillages de `noeud` et de ses descendants.
func _maillages(noeud: Node) -> Array:
	return ([noeud] + noeud.find_children("*", "GeometryInstance3D", true, false)).filter(func(n: Node) -> bool: return n is GeometryInstance3D)


## Si le rayon de `point` dans le sens `sens` touche un triangle d'un maillage de `noeud` qui projette son ombre.
func _touche(point: Vector3, sens: Vector3, noeud: Node) -> bool:
	for maillage: MeshInstance3D in _maillages(noeud):
		if not maillage.is_visible_in_tree() or maillage.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
			continue
		for rang in maillage.mesh.get_surface_count():
			var sommets: PackedVector3Array = maillage.mesh.surface_get_arrays(rang)[Mesh.ARRAY_VERTEX]
			for t in sommets.size() / 3:
				var a := maillage.to_global(sommets[t * 3])
				var b := maillage.to_global(sommets[t * 3 + 1])
				var c := maillage.to_global(sommets[t * 3 + 2])
				if Geometry3D.ray_intersects_triangle(point, sens, a, b, c) != null:
					return true
	return false
