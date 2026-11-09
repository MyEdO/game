## Les effets d'un appel (`suite.effets`, `pont/CONTRAT.md`, section « Effets ») rendus au plateau, tels que le noyau les
## résout : chaque coup part de l'attaquant (sa phase de départ), son projectile vole jusqu'à la cible le temps et sur la
## cloche de son `trajet`, puis sa phase d'arrivée joue sur la cible ; chaque incantation joue son départ au lanceur,
## puis, réussie, son arrivée sur sa cible ; chaque son de scène joue tel quel. Une phase dessine son visuel, un éclat de
## particules à textures procédurales et son éclair, et joue son son, une de ses variantes au hasard
## (`AudioStreamRandomizer`), à son point. Les effets d'un même appel se suivent, `ECART_S` secondes l'un après l'autre.
class_name Effets
extends Node3D

## Un coup ou une incantation part de son auteur (`de`, `vers`, l'id de chacun).
signal depart(de: String, vers: String)
## La phase d'arrivée d'un coup ou d'une incantation joue sur `vers` ; `touche` : un coup qui touche.
signal arrivee(vers: String, touche: bool)

## Secondes entre deux effets d'un même appel.
const ECART_S := 0.35
## Secondes entre le départ et l'arrivée d'un coup sans projectile, d'une incantation.
const ELAN_S := 0.3
## La dispersion d'un son 3D : sa taille d'unité, en cases, au-delà de laquelle il décroît.
const PORTEE_DU_SON := 30.0

## Par visuel, ses gerbes, son éclair (`null` : aucun) et la durée (s) au bout de laquelle l'éclat s'éteint. Une gerbe :
## nombre de particules, durée de vie (s), vitesse (m/s, bornes), pesanteur (m/s²), taille (m, bornes), couleur
## (`teinte` : celle de l'effet), opacité, dispersion (degrés autour du haut), anneau d'émission (rayons extérieur et
## intérieur, m ; `null` : un point), lumineuse (fondue par addition : un éclat, une flamme, une lueur) ou non (fondue par
## mélange : une fumée, une poussière). Un éclair : son énergie et sa durée (s).
const GERBES := {
	"eclair-de-bouche": {vie = 1.8, eclair = {energie = 3.0, duree = 0.15}, gerbes = [
		{nombre = 14, duree = 0.15, vitesse = [3.0, 6.0], pesanteur = Vector3.ZERO, taille = [0.25, 0.45], couleur = "#ffd27a", opacite = 1.0, dispersion = 60.0, anneau = null, lumineuse = true},
		{nombre = 18, duree = 1.6, vitesse = [0.4, 1.0], pesanteur = Vector3(0.0, 0.6, 0.0), taille = [0.55, 1.05], couleur = "#8a8a8a", opacite = 0.55, dispersion = 45.0, anneau = null, lumineuse = false},
	]},
	"canalisation": {vie = 0.9, eclair = {energie = 1.0, duree = 0.4}, gerbes = [
		{nombre = 24, duree = 0.7, vitesse = [0.5, 1.2], pesanteur = Vector3(0.0, 1.5, 0.0), taille = [0.1, 0.2], couleur = "teinte", opacite = 1.0, dispersion = 10.0, anneau = [0.5, 0.4], lumineuse = true},
	]},
	"etincelles": {vie = 0.55, eclair = {energie = 0.8, duree = 0.2}, gerbes = [
		{nombre = 20, duree = 0.35, vitesse = [2.0, 4.0], pesanteur = Vector3(0.0, -9.8, 0.0), taille = [0.04, 0.08], couleur = "#ffe9a0", opacite = 1.0, dispersion = 180.0, anneau = null, lumineuse = true},
	]},
	"poussiere": {vie = 1.1, eclair = null, gerbes = [
		{nombre = 16, duree = 0.9, vitesse = [0.5, 1.5], pesanteur = Vector3(0.0, -1.0, 0.0), taille = [0.3, 0.6], couleur = "#9a8a70", opacite = 0.6, dispersion = 70.0, anneau = null, lumineuse = false},
	]},
	"explosion": {vie = 2.4, eclair = {energie = 6.0, duree = 0.4}, gerbes = [
		{nombre = 30, duree = 0.5, vitesse = [2.0, 5.0], pesanteur = Vector3.ZERO, taille = [0.55, 1.05], couleur = "#ffa040", opacite = 1.0, dispersion = 180.0, anneau = null, lumineuse = true},
		{nombre = 24, duree = 2.2, vitesse = [0.5, 1.5], pesanteur = Vector3(0.0, 0.5, 0.0), taille = [1.0, 1.8], couleur = "#5a5550", opacite = 0.6, dispersion = 90.0, anneau = null, lumineuse = false},
	]},
	"eclat-magique": {vie = 0.65, eclair = {energie = 2.0, duree = 0.4}, gerbes = [
		{nombre = 28, duree = 0.45, vitesse = [1.5, 3.5], pesanteur = Vector3.ZERO, taille = [0.14, 0.26], couleur = "teinte", opacite = 1.0, dispersion = 180.0, anneau = null, lumineuse = true},
	]},
	"halo": {vie = 1.2, eclair = {energie = 1.5, duree = 0.4}, gerbes = [
		{nombre = 30, duree = 1.0, vitesse = [0.3, 0.6], pesanteur = Vector3(0.0, 0.8, 0.0), taille = [0.14, 0.26], couleur = "teinte", opacite = 1.0, dispersion = 5.0, anneau = [0.6, 0.5], lumineuse = true},
	]},
	"gerbe-de-flammes": {vie = 1.6, eclair = {energie = 3.0, duree = 0.4}, gerbes = [
		{nombre = 30, duree = 0.8, vitesse = [1.0, 2.5], pesanteur = Vector3(0.0, 2.0, 0.0), taille = [0.35, 0.65], couleur = "#ff7a2a", opacite = 1.0, dispersion = 35.0, anneau = null, lumineuse = true},
		{nombre = 10, duree = 1.4, vitesse = [0.4, 0.8], pesanteur = Vector3(0.0, 0.8, 0.0), taille = [0.5, 0.9], couleur = "#6a5a50", opacite = 0.5, dispersion = 30.0, anneau = null, lumineuse = false},
	]},
}

## Par projectile, sa forme : un trait (`longueur`, `rayon`, m) ou une boule (`rayon`), sa couleur (`teinte` : celle de
## l'effet), et la taille (m) de la traînée lumineuse qui le suit avec un éclair (`null` : aucune).
const PROJECTILES := {
	"fleche": {forme = "trait", longueur = 0.75, rayon = 0.012, couleur = "#6b4a2a", trainee = null},
	"carreau": {forme = "trait", longueur = 0.4, rayon = 0.015, couleur = "#5a3e22", trainee = null},
	"balle": {forme = "boule", longueur = 0.0, rayon = 0.03, couleur = "#303030", trainee = null},
	"boulet": {forme = "boule", longueur = 0.0, rayon = 0.1, couleur = "#1e1e1e", trainee = null},
	"pierre": {forme = "boule", longueur = 0.0, rayon = 0.25, couleur = "#7a6e60", trainee = null},
	"objet-lance": {forme = "boule", longueur = 0.0, rayon = 0.08, couleur = "#8a7a60", trainee = null},
	"trait-magique": {forme = "boule", longueur = 0.0, rayon = 0.12, couleur = "teinte", trainee = 0.2},
	"jet-de-flammes": {forme = "boule", longueur = 0.0, rayon = 0.25, couleur = "#ff7a2a", trainee = 0.4},
}
## La traînée d'un projectile lumineux : une gerbe continue, sans vitesse propre.
const TRAINEE := {nombre = 40, duree = 0.35, vitesse = [0.0, 0.2], pesanteur = Vector3.ZERO, couleur = "teinte", opacite = 0.8, dispersion = 180.0, anneau = null, lumineuse = true}

## La tache ronde d'une particule, dégradée du centre au bord.
static var _tache: GradientTexture2D = null

var _metres_par_case := 1.0


## Joue `effets` (`suite.effets`) sur un plateau de `metres_par_case` mètres par case, chaque combattant au point au sol
## que `lieux` donne par son id.
func jouer(effets: Array, lieux: Dictionary, metres_par_case: float) -> void:
	_metres_par_case = metres_par_case
	var premier := true
	for effet: Dictionary in effets:
		if not premier:
			await get_tree().create_timer(ECART_S).timeout
		premier = false
		match effet.quoi:
			"coup":
				_coup(effet, _point(lieux[effet.de]), _point(lieux[effet.vers]))
			"incantation":
				_incantation(effet, _point(lieux[effet.de]), _point(lieux[effet.vers]))
			"son":
				_jouer_le_son(effet.son, null)


func _point(sol: Vector3) -> Vector3:
	return MiseEnPage.point_du_coup(sol, _metres_par_case)


func _coup(effet: Dictionary, de: Vector3, vers: Vector3) -> void:
	depart.emit(effet.de, effet.vers)
	var teinte := Color(effet.couleur)
	_phase(effet.depart, de, teinte)
	if effet.trajet != null:
		await _voler(effet.trajet, de, vers, teinte)
	else:
		await get_tree().create_timer(ELAN_S).timeout
	_phase(effet.arrivee, vers, teinte)
	arrivee.emit(effet.vers, effet.issue == "touche" or effet.issue == "critique")


func _incantation(effet: Dictionary, de: Vector3, vers: Vector3) -> void:
	depart.emit(effet.de, effet.vers)
	var teinte := Color(effet.couleur)
	_phase(effet.depart, de, teinte)
	await get_tree().create_timer(ELAN_S).timeout
	_phase(effet.arrivee, vers, teinte)
	arrivee.emit(effet.vers, false)


## La phase `phase` (`null` : aucune) jouée au point `point` : son visuel, puis son son.
func _phase(phase: Variant, point: Vector3, teinte: Color) -> void:
	if phase == null:
		return
	if phase.visuel != null:
		eclater(phase.visuel, point, teinte)
	if phase.son != null:
		_jouer_le_son(phase.son, point)


## L'éclat du visuel `visuel` (`GERBES`) au point `point`, teint de `teinte` : chacune de ses gerbes et son éclair, en
## mètres à l'échelle du plateau, retirés une fois éteints.
func eclater(visuel: String, point: Vector3, teinte: Color) -> Node3D:
	var recette: Dictionary = GERBES[visuel]
	var eclat := Node3D.new()
	eclat.name = visuel
	eclat.position = point
	eclat.scale = MiseEnPage.echelle_au_plateau(_metres_par_case)
	add_child(eclat)
	for gerbe: Dictionary in recette.gerbes:
		eclat.add_child(_gerbe(gerbe, gerbe.taille, teinte))
	if recette.eclair != null:
		var premiere: Dictionary = recette.gerbes[0]
		_eclairer(eclat, _couleur(premiere.couleur, teinte), recette.eclair.energie, 4.0, recette.eclair.duree)
	get_tree().create_timer(recette.vie).timeout.connect(eclat.queue_free)
	return eclat


func _couleur(couleur: String, teinte: Color) -> Color:
	return teinte if couleur == "teinte" else Color(couleur)


## La gerbe `gerbe` de particules de taille `taille` (bornes), teinte de `teinte` si elle prend celle de l'effet. Ses
## particules naissent ensemble : sous le rendu de compatibilité, une particule à naître se peint en noir, que seule
## la fonte par addition d'une gerbe continue lumineuse (`TRAINEE`) efface.
func _gerbe(gerbe: Dictionary, taille: Array, teinte: Color) -> CPUParticles3D:
	var particules := CPUParticles3D.new()
	particules.amount = int(gerbe.nombre)
	particules.lifetime = gerbe.duree
	particules.one_shot = true
	particules.explosiveness = 1.0
	particules.local_coords = true
	particules.direction = Vector3.UP
	particules.spread = gerbe.dispersion
	particules.initial_velocity_min = gerbe.vitesse[0]
	particules.initial_velocity_max = gerbe.vitesse[1]
	particules.gravity = gerbe.pesanteur
	particules.scale_amount_min = taille[0]
	particules.scale_amount_max = taille[1]
	if gerbe.anneau != null:
		particules.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
		particules.emission_ring_axis = Vector3.UP
		particules.emission_ring_radius = gerbe.anneau[0]
		particules.emission_ring_inner_radius = gerbe.anneau[1]
		particules.emission_ring_height = 0.0
	var couleur := _couleur(gerbe.couleur, teinte)
	var fondu := Gradient.new()
	fondu.set_color(0, Color(couleur, gerbe.opacite))
	fondu.set_color(1, Color(couleur, 0.0))
	particules.color_ramp = fondu
	particules.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	particules.mesh = _quad_de_particule(gerbe.lumineuse)
	particules.emitting = true
	return particules


func _quad_de_particule(lumineuse: bool) -> QuadMesh:
	var quad := QuadMesh.new()
	var matiere := StandardMaterial3D.new()
	matiere.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	matiere.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	matiere.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	matiere.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if lumineuse else BaseMaterial3D.BLEND_MODE_MIX
	matiere.vertex_color_use_as_albedo = true
	matiere.albedo_texture = _tache_ronde()
	quad.material = matiere
	return quad


static func _tache_ronde() -> GradientTexture2D:
	if _tache == null:
		var degrade := Gradient.new()
		degrade.set_color(0, Color.WHITE)
		degrade.set_color(1, Color(1.0, 1.0, 1.0, 0.0))
		_tache = GradientTexture2D.new()
		_tache.gradient = degrade
		_tache.fill = GradientTexture2D.FILL_RADIAL
		_tache.fill_from = Vector2(0.5, 0.5)
		_tache.fill_to = Vector2(0.5, 0.0)
		_tache.width = 64
		_tache.height = 64
	return _tache


## Un éclair de `couleur` sous `parent`, d'énergie `energie` et de portée `portee` (m, dans le repère du parent), éteint en
## `duree` secondes (`0` : il dure autant que son parent).
func _eclairer(parent: Node3D, couleur: Color, energie: float, portee: float, duree: float) -> void:
	var lampe := OmniLight3D.new()
	lampe.light_color = couleur
	lampe.light_energy = energie
	lampe.omni_range = portee
	lampe.shadow_enabled = false
	parent.add_child(lampe)
	if duree != 0.0:
		create_tween().tween_property(lampe, "light_energy", 0.0, duree)


## Le projectile du trajet `trajet` en vol de `de` à `vers` en `trajet.dureeS` secondes : son nœud file droit vers la
## cible, son corps monte de `trajet.hauteurM` à mi-vol puis redescend ; retiré à l'arrivée.
func _voler(trajet: Dictionary, de: Vector3, vers: Vector3, teinte: Color) -> void:
	var projectile := projectile_de(trajet.projectile, teinte)
	add_child(projectile)
	projectile.position = de
	if not de.is_equal_approx(vers):
		projectile.look_at(vers, Vector3.UP, true)
	var vol := create_tween()
	vol.tween_property(projectile, "position", vers, trajet.dureeS)
	var corps: Node3D = projectile.get_node("Corps")
	var mi_vol := MiseEnPage.mi_vol(trajet.dureeS)
	var cloche := create_tween()
	cloche.tween_property(corps, "position:y", MiseEnPage.hauteur_au_plateau(trajet.hauteurM, _metres_par_case), mi_vol).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	cloche.tween_property(corps, "position:y", 0.0, mi_vol).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await vol.finished
	projectile.queue_free()


## Le projectile `nom` (`PROJECTILES`), teint de `teinte` s'il prend celle de l'effet : sous son nœud, son avant au +Z, son
## corps (`Corps`) à l'échelle du plateau, sa traînée et son éclair s'il est lumineux.
func projectile_de(nom: String, teinte: Color) -> Node3D:
	var forme: Dictionary = PROJECTILES[nom]
	var couleur := _couleur(forme.couleur, teinte)
	var projectile := Node3D.new()
	projectile.name = nom
	var corps := Node3D.new()
	corps.name = "Corps"
	corps.scale = MiseEnPage.echelle_au_plateau(_metres_par_case)
	projectile.add_child(corps)
	var maille := MeshInstance3D.new()
	var matiere := StandardMaterial3D.new()
	matiere.albedo_color = couleur
	if forme.trainee != null:
		matiere.emission_enabled = true
		matiere.emission = couleur
		matiere.emission_energy_multiplier = 3.0
	if forme.forme == "trait":
		var baton := CylinderMesh.new()
		baton.height = forme.longueur
		baton.top_radius = forme.rayon
		baton.bottom_radius = forme.rayon
		baton.material = matiere
		maille.mesh = baton
		maille.rotation.x = MiseEnPage.QUART_DE_TOUR
	else:
		var boule := SphereMesh.new()
		boule.radius = forme.rayon
		boule.height = MiseEnPage.diametre(forme.rayon)
		boule.material = matiere
		maille.mesh = boule
	maille.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	corps.add_child(maille)
	if forme.trainee != null:
		var taille := MiseEnPage.hauteur_au_plateau(forme.trainee, _metres_par_case)
		var trainee := _gerbe(TRAINEE, [taille, taille], couleur)
		trainee.one_shot = false
		trainee.explosiveness = 0.0
		trainee.local_coords = false
		corps.add_child(trainee)
		_eclairer(corps, couleur, 1.5, 2.0, 0.0)
	return projectile


## Le son `son` (`{ id, fichiers, volume }`), l'une de ses variantes de `res://sons/` au hasard, au point `point`, ou
## partout (`null`) ; retiré une fois joué.
func _jouer_le_son(son: Dictionary, point: Variant) -> Node:
	var variantes := AudioStreamRandomizer.new()
	for fichier: String in son.fichiers:
		variantes.add_stream(-1, load("res://sons/%s" % fichier))
	var lecteur: Node
	if point == null:
		var plat := AudioStreamPlayer.new()
		plat.stream = variantes
		plat.volume_db = linear_to_db(son.volume)
		add_child(plat)
		plat.finished.connect(plat.queue_free)
		plat.play()
		lecteur = plat
	else:
		var spatial := AudioStreamPlayer3D.new()
		spatial.stream = variantes
		spatial.volume_db = linear_to_db(son.volume)
		spatial.unit_size = PORTEE_DU_SON
		add_child(spatial)
		spatial.position = point
		spatial.finished.connect(spatial.queue_free)
		spatial.play()
		lecteur = spatial
	lecteur.name = "son-%s" % son.id
	return lecteur
