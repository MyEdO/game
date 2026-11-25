extends SceneTree

## Une vitre laisse voir ce qui est derrière elle (#4471, `opacity` d'une matière de `src/data/materials.json`, que le
## GLB porte en alpha de sa couleur, `scripts/personnage-3d/habillage.py`), devant un témoin rouge sans éclairage. Trois
## images par sujet : le sujet devant le témoin, le sujet seul, le témoin seul. Les pixels de la vitre sont ceux que le
## témoin change derrière le sujet et que le sujet change devant le témoin : il y en a `PIXELS_DE_VITRE` au moins, le
## témoin y ajoute `ROUGE_AJOUTE` de rouge, et la vitre lui en retire `ROUGE_RETIRE`.
## Les sujets : la fenêtre de chaque modèle d'arête servi dont une surface s'habille de `VERRE` (figé des échantillons
## de l'atelier, `hotes/godot/recettes/decor.ts`), posée comme le jeu la pose (`VolumeDeScene.poser_les_aretes` : peinte
## de la palette des arêtes servies, `MontageDeComposition.peindre`, en instances groupées teintes,
## `VolumeDeScene._maillage_teint`), sous une vision où sa case est explorée ; et le véhicule `VEHICULE`, son GLB lu
## (`MontageDeComposition.scene_lue`), peint aux surfaces de son manifeste, sa vitre de `TEINTE_DE_VITRE`
## (`MontageDeVehicule.peindre_l_element`), vu de flanc. Sous une vision tout explorée, son voile posé
## (`MontageDeVehicule.voiler`, `art/voile.gdshader`), les pixels de sa vitre gardent la part de lumière de l'exploré, à
## `TOLERANCE` près : la vitre se voile avec ce qu'elle montre.
##
## Rendu réel, sous chacun des deux rendus : `node hotes/godot/construire.mjs --rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const ARETE := preload("res://recettes/arete-au-pied.gd")
const VERRE := "prop--verre"
const VEHICULE := "vehicule--diligence"
const TEINTE_DE_VITRE := "#7d95a1"
## Le côté du plateau du véhicule, en cases d'un mètre, et l'écart toléré entre la part lue de sa vitre voilée et celle
## de l'exploré : celui du rendu de compatibilité (`PIXELS.borne_du_pilote`).
const PLATEAU := 9
const TOLERANCE := 0.08
const FENETRE := Vector2i(640, 640)
const HAUTEUR_DU_MUR := 3.0
## Le côté du témoin, son recul derrière le sujet, et celui de la caméra devant lui.
const COTE_DU_TEMOIN := 6.0
const RECUL_DU_TEMOIN := 2.0
const RECUL_DE_LA_CAMERA := 30.0
const TEINTES := {visible = 1.0, explored = 0.42, unknown = 0.15}
const EXPLOREE := 128
## Le moins de pixels de vitre lus (un sur deux de chaque sens, loin de leur bord).
const PIXELS_DE_VITRE := 100
## Ce que le témoin ajoute au moins de rouge (médiane, sur 1) aux pixels de la vitre, et ce que la vitre lui en retire
## au moins.
const ROUGE_AJOUTE := 0.2
const ROUGE_RETIRE := 0.05
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[vitre-transparente] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	root.size = FENETRE
	var decor := ARETE.servir_le_fige(self, "vitre-transparente")
	if decor.is_empty():
		return
	var scene := Node3D.new()
	root.add_child(scene)
	var monde := WorldEnvironment.new()
	monde.environment = Environment.new()
	monde.environment.background_mode = Environment.BG_COLOR
	monde.environment.background_color = Color(0.0, 0.0, 0.2)
	monde.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	monde.environment.ambient_light_color = Color.WHITE
	monde.environment.ambient_light_energy = 1.0
	scene.add_child(monde)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.current = true
	var temoin := MeshInstance3D.new()
	var cube := BoxMesh.new()
	cube.size = Vector3.ONE * COTE_DU_TEMOIN
	var rouge := StandardMaterial3D.new()
	rouge.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rouge.albedo_color = Color.RED
	cube.material = rouge
	temoin.mesh = cube
	scene.add_child(temoin)
	var vitrees := 0
	for famille: String in decor.modeles.aretes:
		var surfaces: Array = decor.modeles.surfaces[decor.modeles.aretes[famille]]
		if not surfaces.any(func(s: Dictionary) -> bool: return s.get("matiere", "") == VERRE):
			continue
		vitrees += 1
		await _de_la_famille(scene, camera, temoin, famille, decor.paletteDesAretes)
	if vitrees == 0:
		_fautes.append("aucun modèle d'arête servi ne porte de surface %s" % VERRE)
	await _du_vehicule(scene, camera, temoin)
	for faute in _fautes:
		push_error("[vitre-transparente] " + faute)
	print("[vitre-transparente] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La caméra `camera` devant `lieu`, qu'elle regarde le long de `-vers`, sur `champ` mètres, et `temoin` derrière lui.
func _viser(camera: Camera3D, temoin: MeshInstance3D, lieu: Vector3, vers: Vector3, champ: float) -> void:
	camera.size = champ
	camera.look_at_from_position(lieu + vers * RECUL_DE_LA_CAMERA, lieu)
	temoin.position = lieu - vers * (RECUL_DU_TEMOIN + COTE_DU_TEMOIN / 2.0)


## Les pixels de la vitre de `sujet`, nommé `nom`, devant `temoin` : ceux que le témoin change derrière lui et qu'il
## change devant le témoin, loin de leur bord ; leur nombre et leur rouge jugés.
func _vitre_de(nom: String, sujet: Node3D, temoin: MeshInstance3D) -> Array[Vector2i]:
	var devant := await PIXELS.image(self)
	temoin.visible = false
	var seul := await PIXELS.image(self)
	temoin.visible = true
	sujet.visible = false
	var nu := await PIXELS.image(self)
	sujet.visible = true
	var derriere := {}
	for pixel in PIXELS.masque(devant, seul):
		derriere[pixel] = true
	var vitre := PIXELS.interieur(PIXELS.masque(devant, nu).filter(func(pixel: Vector2i) -> bool: return derriere.has(pixel)))
	var ajoute := _rouge(devant, vitre) - _rouge(seul, vitre)
	var retire := _rouge(nu, vitre) - _rouge(devant, vitre)
	print("[vitre-transparente] %s : %d pixels de vitre ; rouge devant le témoin %.3f, seul %.3f, témoin nu %.3f" % [nom, vitre.size(), _rouge(devant, vitre), _rouge(seul, vitre), _rouge(nu, vitre)])
	if vitre.size() < PIXELS_DE_VITRE:
		_fautes.append("%s : %d pixels de vitre, %d attendus au moins" % [nom, vitre.size(), PIXELS_DE_VITRE])
	elif ajoute < ROUGE_AJOUTE or retire < ROUGE_RETIRE:
		_fautes.append("%s : le témoin ajoute %.3f de rouge derrière la vitre (%s au moins), la vitre lui en retire %.3f (%s au moins)" % [nom, ajoute, ROUGE_AJOUTE, retire, ROUGE_RETIRE])
	return vitre


## Un volume neuf sous `scene`, un plateau carré de `cote` cases d'un mètre à la hauteur 0.
func _volume(scene: Node3D, cote: int) -> VolumeDeScene:
	var volume := ARETE.volume_neuf(scene, 1.0)
	var rangees := []
	for y in cote:
		var rangee := []
		rangee.resize(cote)
		rangee.fill(0.0)
		rangees.append(rangee)
	volume.poser({monde = {metresParCase = 1.0, hauteurs = [{z = 0, rangees = rangees}], morceaux = []}, toits = [], couronnes = []}, {volume = [], toits = [], couronnes = []})
	return volume


## La vision d'un plateau carré de `cote` cases, chacune explorée.
func _exploree(cote: int) -> Dictionary:
	var octets := PackedByteArray()
	octets.resize(2 * cote * cote)
	octets.fill(EXPLOREE)
	return {masque = Marshalls.raw_to_base64(octets), largeur = cote, rangees = 2 * cote, rangeesParPlan = cote, teintes = TEINTES}


## La fenêtre de la famille `famille`, peinte de `palette`, sa case explorée, devant `temoin`.
func _de_la_famille(scene: Node3D, camera: Camera3D, temoin: MeshInstance3D, famille: String, palette: Dictionary) -> void:
	var volume := _volume(scene, 1)
	volume.poser_les_aretes([{cle = "fenetre", bloc = "0/0/0", famille = famille, piece = Noyau.Piece.FENETRE,
		position = Noyau.Position.SEULE, sens = {x = 1.0, y = 0.0}, hauteurM = HAUTEUR_DU_MUR, pied = 0.0,
		milieu = {x = 0.0, y = -0.5}, palette = palette, cases = [{x = 0, y = 0, z = 0}]}], [], [])
	await volume.attendre_les_aretes()
	volume.voir(_exploree(1))
	var centre := MiseEnPage.centre_d_arete(Vector2(0, -0.5), 0.0, 1.0, 0.0)
	_viser(camera, temoin, Vector3(centre.x, HAUTEUR_DU_MUR / 2.0, centre.z), Vector3.BACK, HAUTEUR_DU_MUR * 1.2)
	await _vitre_de(famille, volume, temoin)
	volume.free()


## Le véhicule `VEHICULE` peint, vu de flanc devant `temoin`, puis voilé sous une vision tout explorée.
func _du_vehicule(scene: Node3D, camera: Camera3D, temoin: MeshInstance3D) -> void:
	var recueil: Array[String] = []
	var modele := MontageDeComposition.scene_lue(VEHICULE, FileAccess.get_file_as_bytes("res://modeles/%s.glb" % VEHICULE), recueil)
	var manifeste: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://modeles/%s.manifeste.json" % VEHICULE))
	if modele == null or not manifeste is Dictionary:
		_fautes.append("%s : modèle ou manifeste illisible %s" % [VEHICULE, recueil])
		return
	var volume := _volume(scene, PLATEAU)
	var montage := MontageDeVehicule.new()
	scene.add_child(montage)
	montage.add_child(modele)
	montage.scene = modele
	modele.position = Vector3(PLATEAU / 2.0, 0.0, PLATEAU / 2.0)
	MontageDeComposition.modeles.surfaces[VEHICULE] = manifeste.surfaces
	var locaux := {}
	MontageDeVehicule.peindre_l_element(modele, VEHICULE, {vitre = TEINTE_DE_VITRE}, null, locaux)
	var vitres: Array = manifeste.surfaces.filter(func(s: Dictionary) -> bool: return s.get("matiere", "") == VERRE).map(func(s: Dictionary) -> String: return s.nom)
	var sommets := PackedVector3Array()
	for piece: MeshInstance3D in modele.find_children("*", "MeshInstance3D", true, false):
		for rang in piece.mesh.get_surface_count():
			if vitres.has(piece.mesh.surface_get_material(rang).resource_name):
				for sommet: Vector3 in piece.mesh.surface_get_arrays(rang)[Mesh.ARRAY_VERTEX]:
					sommets.append(piece.to_global(sommet))
	if sommets.is_empty():
		_fautes.append("%s : aucune surface %s" % [VEHICULE, VERRE])
		return
	var vitrage := AABB(sommets[0], Vector3.ZERO)
	for sommet in sommets:
		vitrage = vitrage.expand(sommet)
	var flanc := Vector3.RIGHT if vitrage.size.x < vitrage.size.z else Vector3.BACK
	_viser(camera, temoin, vitrage.get_center(), flanc, maxf(vitrage.size.x, vitrage.size.z) * 2.0)
	var vitre := await _vitre_de(VEHICULE, montage, temoin)
	if not vitre.is_empty():
		var vue := await PIXELS.image(self)
		volume.voir(_exploree(PLATEAU))
		montage.voiler(volume.voile(VEHICULE))
		var part := PIXELS.part(vue, await PIXELS.image(self), vitre)
		print("[vitre-transparente] %s : part de la vitre voilée %.3f, exploré %.3f" % [VEHICULE, part, TEINTES.explored])
		if absf(part - TEINTES.explored) > TOLERANCE:
			_fautes.append("%s : la vitre voilée garde %.3f de sa lumière, %.3f attendu à %s près" % [VEHICULE, part, TEINTES.explored, TOLERANCE])
	montage.free()
	volume.free()


## La médiane du rouge de `image` aux pixels `pixels` ; 0 sans pixel.
func _rouge(image: Image, pixels: Array[Vector2i]) -> float:
	var rouges := PackedFloat32Array()
	for pixel in pixels:
		rouges.append(image.get_pixelv(pixel).r)
	rouges.sort()
	return rouges[rouges.size() / 2] if not rouges.is_empty() else 0.0
