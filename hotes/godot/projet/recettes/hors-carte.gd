extends SceneTree

## Le hors-carte sous chacun des deux rendus (#4392, `hotes/godot/pont/CONTRAT.md`, section « Lumière ») : `Lumiere.eclairer`
## pose le sol du pourtour d'un plateau de `LARGEUR` cases sur `RANGEES`, que voit d'en haut une caméra orthogonale, lu
## aux pixels de l'image rendue, sans case posée. Il ne se dessine pas sous le plateau, dont une case absente montre le
## fond ; avec un fondu, le sol se voit au bord du plateau et se perd dans la pénombre, le fond, au-delà de son fondu ; sans fondu (l'immersion), il se voit encore au loin ; sans sol (un intérieur), le bord du
## plateau montre le fond.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const LARGEUR := 4
const RANGEES := 4
const FONDU_CASES := 6.0
## Le lieu lu au milieu du plateau, celui lu au bord, à une demi-case dehors, et celui lu loin, au-delà du fondu.
const AU_MILIEU := Vector3(LARGEUR / 2.0, 0.0, RANGEES / 2.0)
const AU_BORD := Vector3(LARGEUR + 0.5, 0.0, RANGEES / 2.0)
const AU_LOIN := Vector3(LARGEUR + FONDU_CASES + 2.0, 0.0, RANGEES / 2.0)
const PENOMBRE := "#0f1013"
## L'écart (sur 255, par canal) le plus grand entre un pixel et la pénombre qu'il montre, et le plus petit entre un pixel
## du sol éclairé et elle.
const MEME_COULEUR := 6
const SOL_VU := 30
const PLATEAU := {w = LARGEUR, h = RANGEES, metresParCase = 1.0}
const LUMIERE := {
	soleil = {vers = {x = 0.0, y = 1.0, z = 0.0}, couleur = "#ffffff", energie = 1.0},
	ambiante = {couleur = "#ffffff", energie = 0.5}, blanc = 1.0,
	ciel = null,
	brume = {couleur = PENOMBRE, debutCases = 1000.0, finCases = 2000.0, courbe = 1.0, depuisLOeil = false},
	horsCarte = {sol = {matiere = "terrain--herbe", couleur = "#3d6630"}, fonduCases = FONDU_CASES},
	sources = [],
}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[hors-carte] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var scene := Node3D.new()
	root.add_child(scene)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 2.0 * (LARGEUR + FONDU_CASES + 4.0)
	camera.look_at_from_position(Vector3(LARGEUR / 2.0, 30.0, RANGEES / 2.0), Vector3(LARGEUR / 2.0, 0.0, RANGEES / 2.0), Vector3.FORWARD)
	camera.current = true
	var lumiere: Lumiere = load("res://scenes/Lumiere.tscn").instantiate()
	scene.add_child(lumiere)
	var penombre := Color(PENOMBRE)
	lumiere.eclairer(LUMIERE, PLATEAU)
	var image: Image = await PIXELS.image(self)
	_verifier(_ecart(image, camera, AU_BORD, penombre) > SOL_VU, "avec un fondu, le sol ne se voit pas au bord du plateau")
	_verifier(_ecart(image, camera, AU_LOIN, penombre) <= MEME_COULEUR, "avec un fondu, le sol ne se perd pas dans la pénombre au-delà de lui")
	_verifier(_ecart(image, camera, AU_MILIEU, penombre) <= MEME_COULEUR, "sous le plateau sans case, le sol ne laisse pas voir le fond")
	lumiere.eclairer(LUMIERE.merged({horsCarte = LUMIERE.horsCarte.merged({fonduCases = null}, true)}, true), PLATEAU)
	image = await PIXELS.image(self)
	_verifier(_ecart(image, camera, AU_LOIN, penombre) > SOL_VU, "sans fondu, le sol ne se voit pas au loin")
	lumiere.eclairer(LUMIERE.merged({horsCarte = LUMIERE.horsCarte.merged({sol = null}, true)}, true), PLATEAU)
	image = await PIXELS.image(self)
	_verifier(_ecart(image, camera, AU_BORD, penombre) <= MEME_COULEUR, "sans sol, le bord du plateau ne montre pas le fond")
	for faute in _fautes:
		push_error("[hors-carte] " + faute)
	print("[hors-carte] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _verifier(condition: bool, faute: String) -> void:
	if not condition:
		_fautes.append(faute)


## L'écart (sur 255) du canal le plus éloigné entre le pixel de l'image `image` où la caméra `camera` montre le lieu
## `lieu` et la couleur `couleur`.
func _ecart(image: Image, camera: Camera3D, lieu: Vector3, couleur: Color) -> int:
	var pixel := image.get_pixelv(Vector2i(camera.unproject_position(lieu) * Vector2(image.get_size()) / root.get_visible_rect().size))
	return roundi(255.0 * maxf(absf(pixel.r - couleur.r), maxf(absf(pixel.g - couleur.g), absf(pixel.b - couleur.b))))
