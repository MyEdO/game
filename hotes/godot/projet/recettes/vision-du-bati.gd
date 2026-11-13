extends SceneTree

## La vision du groupe sur le bâti (#3950), lue aux données du volume, sans rendu : sur un monde de deux couches (le sol
## de chacune, une nappe de toit à la couche d'indice 1, une couronne à la couche 0) et ses arêtes, chacune avec les
## cases qu'elle sépare, la vision posée (`VolumeDeScene.voir`) se lie à la matière de chaque nappe, qui ne lie jamais le
## masque du retrait, et chaque sommet de la nappe porte en `UV2` le texel de sa case au plan `sol` de sa couche ; chaque
## instance vue d'une arête a, à son rang (les montrées puis les cachées, `cacher`), la teinte de la meilleure de ses
## cases (méta `couleurs` de son groupe), encore après `cacher`, blanche sans vision. Puis le monde, la vision et les
## arêtes d'une autre scène, plus petite et d'une couche, dans l'ordre du combat (`combat.gd`, `_suivre`) : aucune erreur,
## et les arêtes neuves teintes par la vision neuve. Les arêtes se teignent juste avant qu'une image se dessine
## (`frame_pre_draw`), que le rendu sans écran (`--headless`) n'émet pas : la recette l'émet ; le rendu réel du voile :
## `recettes/voile-du-bati.gd`.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
## Les teintes de `src/data/ambiance.json` (`fogTint`).
const TEINTES := {visible = 1.0, explored = 0.42, unknown = 0.15}
const VUE := 255
const EXPLOREE := 128
const INCONNUE := 0
## La première scène : 6 × 4 cases, deux couches ; la seconde : 3 × 3, une couche.
const LARGEUR := 6
const HAUTEUR := 4
const PETITE := 3
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[vision-du-bati] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var volume := monde.volume
	volume.set_process(false)
	var toits := [_dalles("maison", LARGEUR, Rect2i(1, 1, 2, 2), 1, 6.0)]
	var couronnes := [_dalles("rempart", LARGEUR, Rect2i(4, 0, 2, 1), 0, 2.5)]
	var sols := [_dalles("sol/0/0/0", LARGEUR, Rect2i(0, 0, LARGEUR, HAUTEUR), 0, 0.0).merged({rangee = 0}), _dalles("sol/1/0/0", LARGEUR, Rect2i(0, 0, LARGEUR, HAUTEUR), 1, 4.0).merged({rangee = 2 * HAUTEUR})]
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [_plat(0, LARGEUR, HAUTEUR), _plat(1, LARGEUR, HAUTEUR)], morceaux = sols}, toits = toits, couronnes = couronnes},
		{volume = sols, toits = toits, couronnes = couronnes})
	## Un groupe de trois murs : `a` sépare une case inconnue de sa voisine vue, `b` est à l'étage, explorée, `c`
	## inconnue ; et la boîte d'une porte, seule dans son groupe, explorée.
	var aretes := [
		_arete("a", "mur", Vector2(1.0, 1.5), [Vector3i(1, 2, 0), Vector3i(1, 1, 0)]),
		_arete("b", "mur", Vector2(2.0, 1.5), [Vector3i(2, 2, 1), Vector3i(2, 1, 1)]),
		_arete("c", "mur", Vector2(3.0, 3.5), [Vector3i(3, 3, 0)]),
		_arete("p", "porte-fermee", Vector2(4.0, 1.5), [Vector3i(4, 2, 0), Vector3i(4, 1, 0)]),
	]
	var etats := {Vector3i(1, 1, 0): VUE, Vector3i(2, 2, 1): EXPLOREE, Vector3i(2, 1, 1): INCONNUE, Vector3i(4, 1, 0): EXPLOREE, Vector3i(4, 2, 0): INCONNUE}
	volume.poser_les_aretes(aretes)
	volume.voir(_vision(LARGEUR, HAUTEUR, 2, etats))
	RenderingServer.frame_pre_draw.emit()
	_nappes(monde)
	for etape: Array in [["posées", []], ["cachées", ["a", "b"]], ["rendues", []]]:
		volume.cacher(etape[1], [], [])
		RenderingServer.frame_pre_draw.emit()
		_teintes(monde, etape[0], etape[1], etats)
	volume.voir(null)
	RenderingServer.frame_pre_draw.emit()
	_teintes(monde, "sans vision", [], {})
	## La scène change pendant un fondu : une vision de même taille, aux états différents ailleurs que sous les arêtes,
	## se fond depuis la précédente quand le monde neuf, sans la couche de `b`, se pose.
	volume.voir(_vision(LARGEUR, HAUTEUR, 2, etats))
	volume.voir(_vision(LARGEUR, HAUTEUR, 2, etats.merged({Vector3i(0, 0, 0): VUE})))
	if volume.part_du_fondu() == 1.0:
		_fautes.append("aucun fondu en cours au changement de scène")
	var petite := [_dalles("sol/0/0/0", PETITE, Rect2i(0, 0, PETITE, PETITE), 0, 0.0).merged({rangee = 0, empreinte = "petite"})]
	monde.poser({monde = {metresParCase = METRES_PAR_CASE, hauteurs = [_plat(0, PETITE, PETITE)], morceaux = petite}, toits = [], couronnes = []},
		{volume = petite, toits = [], couronnes = []})
	var etats_neufs := {Vector3i(0, 1, 0): EXPLOREE}
	volume.voir(null)
	volume.voir(_vision(PETITE, PETITE, 1, etats_neufs))
	volume.poser_les_aretes([_arete("n", "mur", Vector2(0.0, 0.5), [Vector3i(0, 1, 0), Vector3i(0, 0, 0)])])
	RenderingServer.frame_pre_draw.emit()
	_teintes(monde, "autre scène", [], etats_neufs)
	for faute in _fautes:
		push_error("[vision-du-bati] " + faute)
	print("[vision-du-bati] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Chaque matière de l'instance vue de chaque nappe porte la vision posée, comme celles des morceaux, et jamais le masque
## du retrait ; chaque sommet de la nappe du toit, à la couche d'indice 1, porte en `UV2` le texel de sa case au plan
## `sol` de sa couche (rangée `2 · HAUTEUR + y`).
func _nappes(monde: Monde) -> void:
	var sol: ShaderMaterial = (monde.get_node("VolumeDeScene/Volume/Morceaux").get_child(0).get_node("Vu") as MeshInstance3D).mesh.surface_get_material(0)
	for parent in ["Toits", "Couronnes"]:
		var vu: MeshInstance3D = monde.get_node("VolumeDeScene/Volume/%s" % parent).get_child(0).get_node("Vu")
		var matiere := vu.mesh.surface_get_material(0) as ShaderMaterial
		if matiere == null:
			_fautes.append("%s : la nappe n'est pas dans le shader de monde" % parent)
			continue
		for parametre in ["vision", "vision_avant", "vision_fondu", "vision_teintes", "vision_rangees_par_plan", "vision_cases_par_metre"]:
			if matiere.get_shader_parameter(parametre) != sol.get_shader_parameter(parametre):
				_fautes.append("%s : %s de la nappe n'est pas celui des morceaux" % [parent, parametre])
		if matiere.get_shader_parameter("retrait") != null:
			_fautes.append("%s : la nappe lie le masque du retrait" % parent)
	var toit: MeshInstance3D = monde.get_node("VolumeDeScene/Volume/Toits").get_child(0).get_node("Vu")
	var lus := {}
	for texel: Vector2 in toit.mesh.surface_get_arrays(0)[Mesh.ARRAY_TEX_UV2]:
		lus[Vector2i(texel)] = true
	var attendus := {}
	for y in range(1, 3):
		for x in range(1, 3):
			attendus[Vector2i(x, 2 * HAUTEUR + y)] = true
	if lus.keys().size() != attendus.size() or not lus.keys().all(func(texel: Vector2i) -> bool: return attendus.has(texel)):
		_fautes.append("toit à la couche 1 : texels %s, attendu le plan sol de sa couche %s" % [lus.keys(), attendus.keys()])


## Chaque instance vue de chaque groupe d'arêtes de `monde`, à son rang (les montrées puis les cachées `cachees`), de la
## teinte de la meilleure de ses cases sous les états `etats` (absente : inconnue), blanche sans état.
func _teintes(monde: Monde, etape: String, cachees: Array, etats: Dictionary) -> void:
	for groupe: Node3D in monde.get_node("VolumeDeScene/Aretes").get_children():
		var aretes: Array = groupe.get_meta("aretes")
		var ordre := aretes.filter(func(a: Dictionary) -> bool: return not cachees.has(a.cle))
		ordre.append_array(aretes.filter(func(a: Dictionary) -> bool: return cachees.has(a.cle)))
		var couleurs: Array = groupe.get_meta("couleurs")
		for rang in ordre.size():
			var attendue := _teinte_attendue(ordre[rang], etats)
			if not (couleurs[rang] is Color) or not (couleurs[rang] as Color).is_equal_approx(attendue):
				_fautes.append("%s, %s rang %d : teinte %s, attendu %s" % [etape, ordre[rang].cle, rang, couleurs[rang], attendue])


## La teinte, en sRGB, de la meilleure des cases de l'arête `a` sous les états `etats` (absente : inconnue) ; blanche
## sans état.
func _teinte_attendue(a: Dictionary, etats: Dictionary) -> Color:
	if etats.is_empty():
		return Color.WHITE
	var meilleur := INCONNUE
	for c: Dictionary in a.cases:
		meilleur = maxi(meilleur, etats.get(Vector3i(c.x, c.y, c.z), INCONNUE))
	var teinte: float = {INCONNUE: TEINTES.unknown, EXPLOREE: TEINTES.explored, VUE: TEINTES.visible}[meilleur]
	return Color(teinte, teinte, teinte).linear_to_srgb()


func _arete(cle: String, piece: String, milieu: Vector2, cases: Array) -> Dictionary:
	return {cle = cle, bloc = "0/0/0", famille = null, piece = piece, sens = {x = 1.0, y = 0.0}, hauteurM = 3.0, pied = 0.0, milieu = {x = milieu.x, y = milieu.y},
		cases = cases.map(func(c: Vector3i) -> Dictionary: return {x = c.x, y = c.y, z = c.z})}


## Les hauteurs, toutes nulles, de la couche `z` d'une scène de `largeur` × `hauteur` cases.
func _plat(z: int, largeur: int, hauteur: int) -> Dictionary:
	var rangees := []
	for y in hauteur:
		var rangee := []
		rangee.resize(largeur)
		rangee.fill(0.0)
		rangees.append(rangee)
	return {z = z, rangees = rangees}


## La vision (`VisionDuMonde`) d'une scène de `largeur` × `hauteur` cases et de `couches` couches, chaque case à l'état
## que `etats` lui donne (par `Vector3i(x, y, indice de couche)`), inconnue sinon.
func _vision(largeur: int, hauteur: int, couches: int, etats: Dictionary) -> Dictionary:
	var octets := PackedByteArray()
	for z in couches:
		for y in hauteur:
			for x in largeur:
				octets.append(etats.get(Vector3i(x, y, z), INCONNUE))
	return {masque = Marshalls.raw_to_base64(octets), largeur = largeur, rangees = hauteur * couches, rangeesParPlan = hauteur, teintes = TEINTES}


## La géométrie du monde `cle` : les dalles des cases `cases` à `hauteur` mètres, chaque triangle à sa case de la couche
## `z`, ses tableaux à plat (`CONTRAT.md`, section « Monde »).
func _dalles(cle: String, _largeur: int, cases: Rect2i, z: int, hauteur: float) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	var de_chaque := []
	for y in range(cases.position.y, cases.end.y):
		for x in range(cases.position.x, cases.end.x):
			for coin: Array in [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [0.5, -0.5]]:
				positions.append_array([(x + coin[0]) * METRES_PAR_CASE, hauteur, (y + coin[1]) * METRES_PAR_CASE])
				normales.append_array([0.0, 1.0, 0.0])
				couleurs.append_array([0.5, 0.5, 0.5, 1.0])
			de_chaque.append_array([x, y, z, x, y, z])
	return {cle = cle, empreinte = cle, positions = positions, normales = normales, couleurs = couleurs, cases = de_chaque,
		surfaces = [{debut = 0, fin = positions.size() / 3, matiere = "terrain--sol-d-essai"}]}
