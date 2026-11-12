extends SceneTree

## Le regard ne change que ce que voit la caméra, jamais l'éclairage (#3758, #3948, `hotes/godot/pont/CONTRAT.md`,
## sections « Vue », `plateau`, et « Monde », `RetraitDuMonde`) : sur un plateau de 2 m par case, un morceau du sol au
## rez, un morceau d'étage à 3 m que le masque du regard retire (`VolumeDeScene.retirer`), une nappe de toit à 5 m, deux
## arêtes, une boîte et une pièce du kit, chacune sous sa couronne, et la couronne d'un mur abattu. Le toit levé, les
## arêtes dégagées sous tout cran : la caméra ne voit ni le toit, ni les arêtes, ni leurs couronnes, qui projettent
## toutes leur ombre ; chaque sommet vu de l'étage tombe sur une case que le masque lié à sa matière retire, ceux du rez
## sur une case qu'il garde, chaque sommet du rez, dont les deux triangles sont sur deux cases, porte en `UV2` le texel
## au masque de la case de son triangle (`MiseEnPage.texel_du_masque`), et l'instance en ombre seule de l'étage, entière
## et jamais masquée, projette ; tout ce qui projette (l'ombre de l'étage, l'instance en ombre seule du toit et de chaque
## couronne, les arêtes) est dans une matière standard, dont Godot dessine l'ombre comme pour toute matière qui ne
## déplace pas ses sommets, et l'instance vue d'une nappe retirée est cachée ; une arête cachée sort du compte visible
## des instances vues de son groupe, ses instances en ombre seule entières ; de chaque case du sol, le rayon vers le
## soleil touche le toit et l'étage ; la couronne du mur abattu ne projette rien. Le toit et les arêtes rendus, chacun
## se montre et projette.

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
const ARETE := {milieu = {x = 1.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = 0.0, hauteurM = 3.0, piece = "mur", bloc = "0/0/0"}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[ombres-du-regard] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var rez := _nappe("sol/0/0/0", 0.0).merged({rangee = 0, cases = [0, 0, 0, 1, 0, 0]}, true)
	var etage := _nappe("sol/1/0/0", 3.0).merged({rangee = ETAGE_AU_MASQUE, cases = [0, 0, 1, 0, 0, 1]}, true)
	var toits := [_nappe("maison", 5.0)]
	var nappes_des_murs := [_nappe("boite", 3.0), _nappe("kit", 3.0), _nappe("abattue", 3.0)]
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = SOLS}, {z = 1, rangees = SOLS}], morceaux = [rez, etage]},
		toits = toits, couronnes = nappes_des_murs}, {volume = [rez, etage], toits = toits, couronnes = nappes_des_murs})
	var masque := PackedByteArray()
	masque.resize(LARGEUR * RANGEES)
	masque[ETAGE_AU_MASQUE * LARGEUR] = 255
	monde.volume.retirer({masque = Marshalls.raw_to_base64(masque), largeur = LARGEUR, rangees = RANGEES})
	monde.volume.poser_les_aretes([ARETE.merged({cle = "boite", famille = null}), ARETE.merged({cle = "kit", famille = "colombage"})])
	var degagees: Array = JSON.parse_string(JSON.stringify(["boite", "kit"].map(func(cle: String) -> Dictionary: return {cle = cle, abattueSous = [0, 1, 2, 3]})))
	monde.cacher_le_bati(["maison"], ["abattue"], degagees)
	var toit: Node3D = monde.get_node("VolumeDeScene/Volume/Toits").get_child(0)
	var morceaux := monde.get_node("VolumeDeScene/Volume/Morceaux")
	_masque(morceaux.get_node("sol_1_0_0"), true, "l'étage retiré")
	_masque(morceaux.get_node("sol_0_0_0"), false, "le rez")
	_texels_des_triangles(morceaux.get_node("sol_0_0_0"), rez)
	var ombre_de_l_etage: MeshInstance3D = morceaux.get_node("sol_1_0_0/Ombre")
	if not ombre_de_l_etage.is_visible_in_tree() or ombre_de_l_etage.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY or ombre_de_l_etage.mesh != (morceaux.get_node("sol_1_0_0/Vu") as MeshInstance3D).mesh or ombre_de_l_etage.material_override != monde.volume.couleur_des_sommets:
		_fautes.append("l'étage retiré : son instance en ombre seule n'est pas entière, dans la matière d'ombre standard, du même maillage")
	var groupes := monde.get_node("VolumeDeScene/Aretes").get_children()
	if groupes.size() != 2:
		_fautes.append("%d groupes d'arêtes posés, attendu la boîte et la pièce du kit" % groupes.size())
	_aretes_montrees(groupes, 0, "retirées")
	var retires := {toit = toit}
	var couronnes := {}
	for couronne: Node3D in monde.get_node("VolumeDeScene/Volume/Couronnes").get_children():
		couronnes[couronne.get_meta("cle")] = couronne
	retires["couronne boite"] = couronnes.boite
	retires["couronne kit"] = couronnes.kit
	retires["ombre de l'étage"] = ombre_de_l_etage
	for nom: String in retires:
		if not _vus(retires[nom]).is_empty() or _projetants(retires[nom]).is_empty():
			_fautes.append("retiré : %s n'est pas en ombre seule (vus %s, projetants %s)" % [nom, _vus(retires[nom]), _projetants(retires[nom])])
		for maillage: GeometryInstance3D in _projetants(retires[nom]):
			if not _matieres(maillage).all(func(matiere: Material) -> bool: return matiere is BaseMaterial3D):
				_fautes.append("%s (%s) projette par une matière qui n'est pas standard : %s" % [nom, maillage.name, _matieres(maillage)])
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
	retires.erase("ombre de l'étage")
	monde.cacher_le_bati([], ["abattue"], [])
	_aretes_montrees(groupes, 1, "rendues")
	for nom: String in retires:
		if _vus(retires[nom]).is_empty() or _projetants(retires[nom]).is_empty():
			_fautes.append("rendu : %s ne se montre pas ou ne projette pas (vus %s, projetants %s)" % [nom, _vus(retires[nom]), _projetants(retires[nom])])
	for faute in _fautes:
		push_error("[ombres-du-regard] " + faute)
	print("[ombres-du-regard] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Dans chaque groupe d'arêtes de `groupes`, `montrees` instances vues au compte visible de chaque maillage vu, sans
## ombre portée, et chaque instance en ombre seule (`SHADOWS_ONLY`) entière, dans une matière standard.
func _aretes_montrees(groupes: Array, montrees: int, moment: String) -> void:
	for groupe: Node3D in groupes:
		var vus := groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)
		var ombres := groupe.find_children("Ombre_*", "MultiMeshInstance3D", true, false)
		if vus.is_empty() or ombres.size() != vus.size():
			_fautes.append("arêtes %s : le groupe %s n'a pas une instance vue et une en ombre seule par maillage" % [moment, groupe.name])
		for vu: MultiMeshInstance3D in vus:
			if not vu.is_visible_in_tree() or vu.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF or vu.multimesh.visible_instance_count != montrees:
				_fautes.append("arêtes %s : %s/%s montre %d instances (ombre %d), attendu %d sans ombre" % [moment, groupe.name, vu.name, vu.multimesh.visible_instance_count, vu.cast_shadow, montrees])
		for ombre: MultiMeshInstance3D in ombres:
			if not ombre.is_visible_in_tree() or ombre.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY or ombre.multimesh.visible_instance_count != -1 or ombre.multimesh.instance_count != 1:
				_fautes.append("arêtes %s : %s/%s n'est pas en ombre seule entière" % [moment, groupe.name, ombre.name])
			var matieres := range(ombre.multimesh.mesh.get_surface_count()).map(func(rang: int) -> Material: return ombre.multimesh.mesh.surface_get_material(rang))
			if ombre.material_override != null or not matieres.all(func(matiere: Material) -> bool: return matiere is BaseMaterial3D):
				_fautes.append("arêtes %s : %s/%s projette par une matière qui n'est pas standard : %s" % [moment, groupe.name, ombre.name, matieres])


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


## Chaque sommet vu de `morceau`, posé d'une seule surface depuis la géométrie `geometrie`, porte en `UV2` le texel au
## masque de la case de son triangle ; les tableaux du maillage sont retournés en entier (`VolumeDeScene._retournes`).
func _texels_des_triangles(morceau: Node, geometrie: Dictionary) -> void:
	var texels: PackedVector2Array = (morceau.get_node("Vu") as MeshInstance3D).mesh.surface_get_arrays(0)[Mesh.ARRAY_TEX_UV2]
	texels.reverse()
	var cases: Array = geometrie.cases
	if texels.size() != cases.size():
		_fautes.append("%s : %d texels pour %d sommets" % [geometrie.cle, texels.size(), cases.size()])
		return
	for triangle in cases.size() / 3:
		var attendu := Vector2(MiseEnPage.texel_du_masque(Vector2i(int(cases[triangle * 3]), int(cases[triangle * 3 + 1])), int(geometrie.rangee)))
		for sommet in 3:
			if texels[triangle * 3 + sommet] != attendu:
				_fautes.append("%s : le sommet %d du triangle %d porte le texel %s, attendu %s, celui de sa case" % [geometrie.cle, sommet, triangle, texels[triangle * 3 + sommet], attendu])


## Une géométrie du monde de clé `cle`, le carré à la hauteur `hauteur` (`_carre`), d'une matière.
func _nappe(cle: String, hauteur: float) -> Dictionary:
	return {cle = cle, empreinte = cle, positions = _carre(hauteur), normales = NORMALES, couleurs = COULEURS, cases = [0, 0, 1, 0, 0, 1], surfaces = [{debut = 0, fin = 6, matiere = "terrain--terre"}]}


## Les matières de rendu de `maillage` : la sienne, sinon celle de chaque surface.
func _matieres(maillage: GeometryInstance3D) -> Array:
	if maillage.material_override != null:
		return [maillage.material_override]
	var instance := maillage as MeshInstance3D
	return range(instance.mesh.get_surface_count()).map(func(rang: int) -> Material: return instance.get_active_material(rang))


## Les maillages de `noeud` et de ses descendants que la caméra voit.
func _vus(noeud: Node) -> Array:
	return _maillages(noeud).filter(func(m: GeometryInstance3D) -> bool: return m.is_visible_in_tree() and m.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY)


## Les maillages de `noeud` et de ses descendants qui projettent leur ombre.
func _projetants(noeud: Node) -> Array:
	return _maillages(noeud).filter(func(m: GeometryInstance3D) -> bool: return m.is_visible_in_tree() and m.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF)


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
