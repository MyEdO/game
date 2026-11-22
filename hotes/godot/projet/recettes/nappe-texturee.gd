extends SceneTree

## La nappe de toit texturée et le sol neutre (#4471) : sur le monde (`Monde`) d'un volume de deux couches, sous un soleil
## de biais (`LUMIERE`), un terrain texturé (un sol et une rampe) et, à la seconde couche, des nappes de toit
## d'ardoise (`roof--toit-ardoise`) : un pan tourné vers +Z, son soffite et sa planche de rive, et un pan tourné vers +X,
## chacune sa nappe (`VolumeDeScene._matiere`, `art/monde.gdshader`, `nappe`), et un pignon vertical tourné vers +Z, au
## bardage de son mur (`structure--mur-a-ossature-en-bois`), lus aux pixels de l'image rendue. Chaque pan, vu de face,
## l'égout à l'horizontale, montre ses rangs le long de l'égout, et le pignon ses planches le long de sa base : les
## moyennes de leurs lignes de pixels sont périodiques d'au moins `RANGS_LE_LONG_DE_L_EGOUT` de plus que celles de leurs
## colonnes. Chaque face, rendue
## texturée puis de la couleur de ses sommets seule (une matière sans texture), garde son ton : sa texture neutre la
## multiplie de la même part sur chaque canal, à `MEME_TON` près. Un terrain à neutre (`terrain--herbe`) la teint de la
## couleur de ses sommets (`teinte_des_sommets`) et garde son ton de même ; un terrain sans neutre (`terrain--sable`)
## rend les mêmes pixels quelle que soit la couleur de ses sommets. L'empreinte des nappes seules s'imprime, à comparer
## d'un shader à l'autre.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const LARGEUR := 10
const HAUTEUR := 8
const METRES_PAR_CASE := 2.0
const ARDOISE := "roof--toit-ardoise"
const SANS_TEXTURE := "roof--sans-texture"
const HERBE := "terrain--herbe"
const SABLE := "terrain--sable"
const SOL_SANS_TEXTURE := "terrain--sans-texture"
const BARDAGE := "structure--mur-a-ossature-en-bois"
## Les couleurs de sommets, loin du gris, d'un pan, de son soffite et de sa planche de rive.
const TONS := {pan = Color(0.7, 0.35, 0.2), soffite = Color(0.25, 0.6, 0.3), rive = Color(0.25, 0.35, 0.75)}
## La couleur de sommets, loin du gris, du sol neutre.
const TON_DU_SOL := Color(0.7, 0.3, 0.45)
const RANGS_LE_LONG_DE_L_EGOUT := 0.05
## La demi-largeur, en lignes ou colonnes lues, de la tendance retirée d'un profil (`_periodicite`).
const LISSAGE := 8
## L'écart relatif le plus grand entre les parts des trois canaux d'une face texturée rapportée à sa couleur seule.
const MEME_TON := 0.5
## La distance, en cases, de l'œil au milieu d'un pan, le long de sa normale.
const RECUL := 2.5
## Un soleil blanc de biais et une ambiante blanche (`Lumiere.eclairer`), sans brume ni hors-carte ; le brouillard
## volumétrique qu'`eclairer` allume sous Forward+ s'éteint ensuite, comme dans `voile-du-decor.gd` : son reprojeté
## temporel change l'image d'une image rendue à l'autre, et le terrain se compare à l'octet.
const LUMIERE := {
	soleil = {vers = {x = 0.3, y = 1.0, z = 0.6}, couleur = "#ffffff", energie = 1.0},
	ambiante = {couleur = "#ffffff", energie = 0.6}, blanc = 1.0,
	ciel = null,
	brume = {couleur = "#000000", debutCases = 1000.0, finCases = 2000.0, courbe = 1.0, depuisLOeil = false},
	horsCarte = {sol = null, fonduCases = null},
	sources = [],
}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[nappe-texturee] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde.volume.set_process(false)
	(monde.get_node("Lumiere") as Lumiere).eclairer(LUMIERE, {w = LARGEUR, h = HAUTEUR, metresParCase = METRES_PAR_CASE})
	var environnement := (monde.get_node("Lumiere/Environnement") as WorldEnvironment).environment
	environnement.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	environnement.volumetric_fog_enabled = false
	await _poser(monde, ARDOISE, Color(0.5, 0.5, 0.5), HERBE)
	var nappes := _nappes(monde)
	for nom in ["pan", "pan-x", "pignon"]:
		var matiere := (nappes[nom].mesh as ArrayMesh).surface_get_material(0) as ShaderMaterial
		if matiere.get_shader_parameter("albedo_texture") == null or matiere.get_shader_parameter("nappe") != 1.0:
			_fautes.append("%s : la matière de la nappe n'est pas texturée en nappe" % nom)
	var terrain := _matiere_du_terrain(monde)
	if terrain.get_shader_parameter("albedo_texture") == null or terrain.get_shader_parameter("nappe") != 0.0:
		_fautes.append("le terrain n'est pas texturé hors nappe")
	if terrain.get_shader_parameter("teinte_des_sommets") != 1.0:
		_fautes.append("le terrain à neutre n'est pas teint par la couleur de ses sommets")
	monde.regarder("immersion")
	await _rangs(monde, nappes.pan, Vector3(0.0, 1.0, 1.0), 0.0, -PI / 4.0)
	await _rangs(monde, nappes["pan-x"], Vector3(1.0, 1.0, 0.0), PI / 2.0, -PI / 4.0)
	await _rangs(monde, nappes.pignon, Vector3(0.0, 0.0, 1.0), 0.0, 0.0)
	await _tons(monde)
	await _empreinte_des_nappes(monde)
	await _sol_neutre(monde)
	await _terrain(monde)
	for faute in _fautes:
		push_error("[nappe-texturee] " + faute)
	print("[nappe-texturee] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le volume posé : le terrain de la matière `sol` et de la couleur `couleur`, les nappes de la matière `matiere`, chacune
## sa clé et son empreinte.
func _poser(monde: Monde, matiere: String, couleur: Color, sol: String) -> void:
	var a := 3.0
	var pan := [Vector3(2, 6, 5), Vector3(6, 6, 5), Vector3(6, 3, 8), Vector3(2, 3, 8)]
	var soffite := [Vector3(2, 3, 8), Vector3(6, 3, 8), Vector3(6, 2.4, 8.6), Vector3(2, 2.4, 8.6)]
	var rive := [Vector3(2, 2.4, 8.6), Vector3(6, 2.4, 8.6), Vector3(6, 1.6, 8.6), Vector3(2, 1.6, 8.6)]
	var pan_x := [Vector3(9, 6, 14), Vector3(9, 6, 10), Vector3(9 + a, 3, 10), Vector3(9 + a, 3, 14)]
	var pignon := [Vector3(2, 1, 12), Vector3(6, 1, 12), Vector3(6, 4, 12), Vector3(2, 4, 12)]
	var toits := [
		_nappe("pan", [[pan, TONS.pan]], matiere),
		_nappe("soffite", [[soffite, TONS.soffite]], matiere),
		_nappe("rive", [[rive, TONS.rive]], matiere),
		_nappe("pan-x", [[pan_x, TONS.pan]], matiere),
		_nappe("pignon", [[pignon, TONS.pan]], BARDAGE),
	]
	var plan := [Vector3(-1, 0, -1), Vector3(15, 0, -1), Vector3(15, 0, 15), Vector3(-1, 0, 15)]
	var rampe := [Vector3(15, 0, 2), Vector3(19, 2, 2), Vector3(19, 2, 6), Vector3(15, 0, 6)]
	var terrain := _nappe("terrain", [[plan, couleur], [rampe, couleur]], sol).merged({rangee = 0})
	for toit: Dictionary in toits:
		toit.empreinte = "%s/%s" % [toit.cle, matiere]
	terrain.empreinte = "terrain/%s/%s" % [sol, couleur.to_html()]
	var plat := []
	for y in HAUTEUR:
		var rangee := []
		rangee.resize(LARGEUR)
		rangee.fill(0.0)
		plat.append(rangee)
	var recus := {volume = [terrain], toits = toits, couronnes = []}
	var _textures_gardees := await TexturesDeMatiere.preparer(monde, VolumeDeScene.matieres_des_morceaux(recus))
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [{z = 0, rangees = plat}, {z = 1, rangees = plat}], morceaux = [terrain]}, toits = toits, couronnes = []}, recus)


## L'instance vue de chaque nappe, par sa clé.
static func _nappes(monde: Monde) -> Dictionary:
	var vues := {}
	for nappe: Node3D in monde.get_node("VolumeDeScene/Volume/Toits").get_children():
		vues[nappe.get_meta("cle")] = nappe.get_node("Vu")
	return vues


## Sous l'œil posé à `RECUL` cases du milieu du pan `vu` le long de sa normale `normale` (en mètres), au lacet `lacet` et
## au tangage `tangage`, de face, l'égout à l'horizontale : les moyennes des lignes de ses pixels sont périodiques d'au moins
## `RANGS_LE_LONG_DE_L_EGOUT` de plus que celles de ses colonnes (`_periodicite`).
func _rangs(monde: Monde, vu: MeshInstance3D, normale: Vector3, lacet: float, tangage: float) -> void:
	var milieu := vu.to_global(vu.mesh.get_aabb().get_center())
	monde.poser_l_oeil(milieu + normale.normalized() * RECUL, lacet, tangage)
	var avec := await PIXELS.image(self)
	vu.visible = false
	var sans := await PIXELS.image(self)
	vu.visible = true
	var pixels := PIXELS.interieur(PIXELS.masque(avec, sans))
	var lignes := {}
	var colonnes := {}
	for pixel in pixels:
		var l := PIXELS.luminance(avec.get_pixelv(pixel))
		lignes[pixel.y] = lignes.get(pixel.y, []) + [l]
		colonnes[pixel.x] = colonnes.get(pixel.x, []) + [l]
	var des_lignes := _periodicite(lignes)
	var des_colonnes := _periodicite(colonnes)
	print("[nappe-texturee] %s : %d pixels, périodicité des lignes %.3f, des colonnes %.3f" % [vu.get_parent().name, pixels.size(), des_lignes, des_colonnes])
	if pixels.size() < 1000 or des_lignes < des_colonnes + RANGS_LE_LONG_DE_L_EGOUT:
		_fautes.append("%s : rangs hors de l'égout (lignes %.4f, colonnes %.4f, %d pixels)" % [vu.get_parent().name, des_lignes, des_colonnes, pixels.size()])


## La périodicité des moyennes des groupes de `groupes` d'au moins 20 valeurs, dans l'ordre de leurs clés : le plus haut
## pic de leur autocorrélation normée, leur tendance sur `LISSAGE` groupes retirée, entre 2 et 60 groupes de décalage.
static func _periodicite(groupes: Dictionary) -> float:
	var cles := groupes.keys().filter(func(cle: int) -> bool: return groupes[cle].size() >= 20)
	cles.sort()
	var moyennes: Array[float] = []
	for cle: int in cles:
		moyennes.append(groupes[cle].reduce(func(s: float, v: float) -> float: return s + v, 0.0) / groupes[cle].size())
	var profil: Array[float] = []
	for i in range(LISSAGE, moyennes.size() - LISSAGE):
		var tendance := 0.0
		for j in range(i - LISSAGE, i + LISSAGE + 1):
			tendance += moyennes[j]
		profil.append(moyennes[i] - tendance / (2 * LISSAGE + 1))
	var auto := func(decalage: int) -> float:
		var somme := 0.0
		for i in profil.size() - decalage:
			somme += profil[i] * profil[i + decalage]
		return somme
	var origine: float = auto.call(0)
	if profil.size() < 120 or origine <= 0.0:
		return 0.0
	var pics := 0.0
	var avant: float = auto.call(1)
	var ici: float = auto.call(2)
	for decalage in range(2, 61):
		var apres: float = auto.call(decalage + 1)
		if ici > avant and ici >= apres:
			pics = maxf(pics, ici / origine)
		avant = ici
		ici = apres
	return pics


## Sous l'œil face au pan tourné vers +Z, le pan, son soffite et sa planche de rive, texturés puis de la couleur de leurs
## sommets seule : la part de chaque canal de l'un rapportée à l'autre est la même à `MEME_TON` près.
func _tons(monde: Monde) -> void:
	var nappes := _nappes(monde)
	var milieu: Vector3 = nappes.soffite.to_global(nappes.soffite.mesh.get_aabb().get_center())
	monde.poser_l_oeil(milieu + Vector3(0.0, 1.0, 1.0).normalized() * RECUL, 0.0, -PI / 4.0)
	var texturee := await PIXELS.image(self)
	var masques := {}
	for nom: String in TONS:
		nappes[nom].visible = false
		masques[nom] = PIXELS.interieur(PIXELS.masque(texturee, await PIXELS.image(self)))
		nappes[nom].visible = true
	await _poser(monde, SANS_TEXTURE, Color(0.5, 0.5, 0.5), HERBE)
	var seule := await PIXELS.image(self)
	await _poser(monde, ARDOISE, Color(0.5, 0.5, 0.5), HERBE)
	for nom: String in TONS:
		var parts: Array[float] = []
		for canal in 3:
			parts.append(_mediane(texturee, masques[nom], canal) / maxf(_mediane(seule, masques[nom], canal), 1e-4))
		var moyenne := (parts[0] + parts[1] + parts[2]) / 3.0
		var ecart: float = (parts.max() - parts.min()) / maxf(moyenne, 1e-4)
		print("[nappe-texturee] %s : %d pixels, parts r %.3f v %.3f b %.3f, écart %.3f" % [nom, masques[nom].size(), parts[0], parts[1], parts[2], ecart])
		if masques[nom].size() < 50 or ecart > MEME_TON:
			_fautes.append("%s : ton perdu (parts %.3f %.3f %.3f, %d pixels)" % [nom, parts[0], parts[1], parts[2], masques[nom].size()])


## La médiane, sur les pixels `pixels` de `image`, du canal `canal` en lumière linéaire.
static func _mediane(image: Image, pixels: Array[Vector2i], canal: int) -> float:
	var valeurs: Array[float] = []
	for pixel in pixels:
		valeurs.append(image.get_pixelv(pixel).srgb_to_linear()[canal])
	valeurs.sort()
	return valeurs[valeurs.size() / 2] if not valeurs.is_empty() else 0.0


## La matière de l'instance vue du terrain posé.
static func _matiere_du_terrain(monde: Monde) -> ShaderMaterial:
	return (_terrain_vu(monde).mesh as ArrayMesh).surface_get_material(0) as ShaderMaterial


## L'instance vue du terrain posé.
static func _terrain_vu(monde: Monde) -> MeshInstance3D:
	return monde.get_node("VolumeDeScene/Volume/Morceaux").get_child(0).get_node("Vu") as MeshInstance3D


## Sous l'œil face au pan tourné vers +Z, puis au pignon, le terrain caché : l'empreinte de l'image des nappes seules
## s'imprime, à comparer d'un shader à l'autre.
func _empreinte_des_nappes(monde: Monde) -> void:
	var nappes := _nappes(monde)
	_terrain_vu(monde).visible = false
	for vu: MeshInstance3D in [nappes.pan, nappes.pignon]:
		var milieu := vu.to_global(vu.mesh.get_aabb().get_center())
		monde.poser_l_oeil(milieu + Vector3(0.0, 1.0, 1.0).normalized() * RECUL * 2.0, 0.0, -PI / 4.0)
		var image := await PIXELS.image(self)
		print("[nappe-texturee] nappes seules (%s) : empreinte %s" % [vu.get_parent().name, hash(image.get_data())])
	_terrain_vu(monde).visible = true


## Sous l'œil au-dessus du sol, nappes cachées, le terrain à neutre de la couleur `TON_DU_SOL`, texturé puis sans
## texture : la part de chaque canal de l'un rapportée à l'autre est la même à `MEME_TON` près, et le ton n'est pas le
## gris de la neutre.
func _sol_neutre(monde: Monde) -> void:
	monde.poser_l_oeil(Vector3(7.0, 6.0, 9.0), PI / 4.0, -PI / 3.0)
	var images := {}
	for sol: String in [HERBE, SOL_SANS_TEXTURE]:
		await _poser(monde, ARDOISE, TON_DU_SOL, sol)
		for vu: Node3D in _nappes(monde).values():
			vu.visible = false
		images[sol] = await PIXELS.image(self)
	_terrain_vu(monde).visible = false
	var pixels := PIXELS.interieur(PIXELS.masque(images[HERBE], await PIXELS.image(self)))
	var parts: Array[float] = []
	for canal in 3:
		parts.append(_mediane(images[HERBE], pixels, canal) / maxf(_mediane(images[SOL_SANS_TEXTURE], pixels, canal), 1e-4))
	var moyenne := (parts[0] + parts[1] + parts[2]) / 3.0
	var ecart: float = (parts.max() - parts.min()) / maxf(moyenne, 1e-4)
	print("[nappe-texturee] sol neutre : %d pixels, parts r %.3f v %.3f b %.3f, écart %.3f" % [pixels.size(), parts[0], parts[1], parts[2], ecart])
	if pixels.size() < 1000 or ecart > MEME_TON:
		_fautes.append("sol neutre : ton perdu (parts %.3f %.3f %.3f, %d pixels)" % [parts[0], parts[1], parts[2], pixels.size()])


## Sous l'œil au-dessus de la rampe, nappes cachées, le terrain sans neutre rendu du gris 0,5 puis 0,9 : les mêmes
## pixels.
func _terrain(monde: Monde) -> void:
	monde.poser_l_oeil(Vector3(7.0, 4.0, 9.0), PI / 4.0, -PI / 5.0)
	var images := []
	for gris in [0.5, 0.9]:
		await _poser(monde, ARDOISE, Color(gris, gris, gris), SABLE)
		for vu: Node3D in _nappes(monde).values():
			vu.visible = false
		images.append(await PIXELS.image(self))
	if _matiere_du_terrain(monde).get_shader_parameter("teinte_des_sommets") == 1.0:
		_fautes.append("le terrain sans neutre est teint par la couleur de ses sommets")
	if images[0].get_data() != images[1].get_data():
		_fautes.append("le terrain sans neutre change avec la couleur de ses sommets")


## La géométrie `cle` des faces `faces` (chacune ses quatre coins en mètres, dans le sens trigonométrique vu de sa
## normale, et sa couleur), de la matière `matiere`, chaque triangle à la case sous son milieu, à la couche 1.
static func _nappe(cle: String, faces: Array, matiere: String) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	var cases := []
	for face: Array in faces:
		var coins: Array = face[0]
		var couleur: Color = face[1]
		var normale: Vector3 = (coins[1] - coins[0]).cross(coins[3] - coins[0]).normalized()
		if normale.y < 0.0 or (is_zero_approx(normale.y) and normale.z < 0.0):
			normale = -normale
		for triangle: Array in [[0, 1, 2], [0, 2, 3]]:
			var centre := Vector3.ZERO
			for rang: int in triangle:
				var coin: Vector3 = coins[rang]
				positions.append_array([coin.x, coin.y, coin.z])
				normales.append_array([normale.x, normale.y, normale.z])
				couleurs.append_array([couleur.r, couleur.g, couleur.b, 1.0])
				centre += coin / 3.0
			cases.append_array([clampi(roundi(centre.x / METRES_PAR_CASE), 0, LARGEUR - 1), clampi(roundi(centre.z / METRES_PAR_CASE), 0, HAUTEUR - 1), 0 if matiere.begins_with("terrain--") else 1])
	return {cle = cle, empreinte = cle, positions = positions, normales = normales, couleurs = couleurs, cases = cases,
		surfaces = [{debut = 0, fin = positions.size() / 3, matiere = matiere}]}
