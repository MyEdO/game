extends SceneTree

## Le regard ne change que ce que voit la caméra, jamais l'éclairage (#3758, #3948, `hotes/godot/pont/CONTRAT.md`,
## sections « Vue », `plateau`, et « Monde », `RetraitDuMonde`) : sur un plateau de 2 m par case, un morceau du sol au
## rez, un morceau d'étage à 3 m que le masque du regard retire (`VolumeDeScene.retirer`), une nappe de toit à 5 m, deux
## arêtes, une boîte et une pièce du kit, chacune sous sa couronne, et la couronne d'un mur abattu. Le toit levé, les
## arêtes dégagées sous tout cran : la caméra ne voit ni le toit, ni les arêtes, ni leurs couronnes, qui projettent
## toutes leur ombre ; chaque sommet vu de l'étage tombe sur une case que le masque lié à sa matière retire, ceux du rez
## sur une case qu'il garde, et l'instance en ombre seule de l'étage, entière et jamais masquée, projette ; de chaque
## case du sol, le rayon vers le soleil touche le toit et l'étage ; la couronne du mur abattu ne projette rien. Le toit et
## les arêtes rendus, chacun se montre et projette.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const NORMALES := [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0]
const COULEURS := [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
## Les sols des 3 × 3 cases de chaque couche, le masque du retrait (3 octets par rangée, deux plans de 3 rangées par
## couche) et la première rangée du plan du sol de l'étage.
const SOLS := [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
const LARGEUR := 3
const RANGEES := 12
const ETAGE_AU_MASQUE := 6
const ARETE := {milieu = {x = 1.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = 0.0, hauteurM = 3.0, piece = "mur"}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[ombres-du-regard] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var rez := _nappe("sol/0/0/0", 0.0).merged({rangee = 0, cases = [[0, 0, 0], [0, 0, 0]]}, true)
	var etage := _nappe("sol/1/0/0", 3.0).merged({rangee = ETAGE_AU_MASQUE, cases = [[0, 0, 1], [0, 0, 1]]}, true)
	var toits := [_nappe("maison", 5.0)]
	var nappes_des_murs := [_nappe("boite", 3.0), _nappe("kit", 3.0), _nappe("abattue", 3.0)]
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = SOLS}, {z = 1, rangees = SOLS}], morceaux = [rez, etage]},
		toits = toits, couronnes = nappes_des_murs}, {volume = [rez, etage], toits = toits, couronnes = nappes_des_murs})
	var masque := PackedByteArray()
	masque.resize(LARGEUR * RANGEES)
	masque[ETAGE_AU_MASQUE * LARGEUR] = 255
	monde.volume.retirer({masque = Marshalls.raw_to_base64(masque), largeur = LARGEUR, rangees = RANGEES})
	monde.volume.poser_les_aretes([ARETE.merged({cle = "boite", famille = null}), ARETE.merged({cle = "kit", famille = "colombage"})])
	var degagees := ["boite", "kit"].map(func(cle: String) -> Dictionary: return {cle = cle, abattueSous = [0, 1, 2, 3]})
	monde.cacher_le_bati(["maison"], ["abattue"], degagees)
	var toit: Node3D = monde.get_node("VolumeDeScene/Volume/Toits").get_child(0)
	var morceaux := monde.get_node("VolumeDeScene/Volume/Morceaux")
	_masque(morceaux.get_node("sol_1_0_0"), true, "l'étage retiré")
	_masque(morceaux.get_node("sol_0_0_0"), false, "le rez")
	var ombre_de_l_etage: MeshInstance3D = morceaux.get_node("sol_1_0_0/Ombre")
	if not ombre_de_l_etage.is_visible_in_tree() or ombre_de_l_etage.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY or ombre_de_l_etage.mesh != (morceaux.get_node("sol_1_0_0/Vu") as MeshInstance3D).mesh or ombre_de_l_etage.material_override.get_shader_parameter("retrait") != null:
		_fautes.append("l'étage retiré : son instance en ombre seule n'est pas entière, non masquée, du même maillage")
	var retires := {toit = toit}
	for arete: Node3D in monde.get_node("VolumeDeScene/Aretes").get_children():
		retires["arête " + arete.get_meta("cle")] = arete
	var couronnes := {}
	for couronne: Node3D in monde.get_node("VolumeDeScene/Volume/Couronnes").get_children():
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
				if _touche(sol, soleil, ombre_de_l_etage if nom == "etage" else retires[nom]):
					sous_le_toit += 1
				else:
					_fautes.append("le sol de la case %d,%d est au soleil sous %s retiré" % [x, y, "le toit" if nom == "toit" else "l'étage"])
	print("[ombres-du-regard] %d rayons sur 18 du sol vers le soleil arrêtés par le toit et l'étage retirés" % sous_le_toit)
	monde.cacher_le_bati([], ["abattue"], [])
	for nom: String in retires:
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


## Chaque sommet vu du morceau `morceau` sur une case que le masque lié à sa matière retire si `retire`, qu'il garde
## sinon.
func _masque(morceau: Node, retire: bool, nom: String) -> void:
	var vu: MeshInstance3D = morceau.get_node("Vu")
	for rang in vu.mesh.get_surface_count():
		var retrait: Texture2D = vu.mesh.surface_get_material(rang).get_shader_parameter("retrait")
		for texel: Vector2 in vu.mesh.surface_get_arrays(rang)[Mesh.ARRAY_TEX_UV2]:
			if (retrait.get_image().get_pixelv(Vector2i(texel)).r8 == 255) != retire:
				_fautes.append("%s : un sommet vu en %s, sur une case %s" % [nom, texel, "gardée" if retire else "retirée"])
				return


## Une géométrie du monde de clé `cle`, le carré à la hauteur `hauteur` (`_carre`), d'une matière.
func _nappe(cle: String, hauteur: float) -> Dictionary:
	return {cle = cle, empreinte = cle, positions = _carre(hauteur), normales = NORMALES, couleurs = COULEURS, cases = [[0, 0, 1], [0, 0, 1]], surfaces = [{debut = 0, fin = 6, matiere = "terrain--terre"}]}


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
