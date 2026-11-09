extends SceneTree

## L'occupant d'une case que le modèle d'un navire rogne se tient à sa station (#3767, `hotes/godot/pont/CONTRAT.md`,
## section « Vue », `navires[id].stations`) : le monde (`scripts/monde.gd`, `lieu`) le pose au point de sa station, sur
## le sol de sa case, et au centre de toute autre case ; une nouvelle pose des stations (`poser_les_stations`) remplace
## les précédentes.

const RECETTE_AUTONOME := true
const EPSILON := 0.001
const SOL := 0.975
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[stations-du-navire] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde._sols = {0: [[0.0, 0.0], [0.0, 0.0]], 2: [[SOL, SOL], [SOL, SOL]]}
	monde.poser_les_stations({caraque = {stations = [{x = 1.0, y = 0.0, z = 2.0, point = {x = 1.3125, y = -0.25}}]}})
	_verifier("case rognée", monde.lieu(Vector2i(1, 0), 2), MiseEnPage.point_de_la_carte(1.3125, -0.25, SOL))
	_verifier("case entière", monde.lieu(Vector2i(0, 1), 2), MiseEnPage.centre_de_case(Vector2i(0, 1), SOL))
	_verifier("même case, autre couche", monde.lieu(Vector2i(1, 0), 0), MiseEnPage.centre_de_case(Vector2i(1, 0), 0.0))
	monde.poser_les_stations({})
	_verifier("stations remplacées", monde.lieu(Vector2i(1, 0), 2), MiseEnPage.centre_de_case(Vector2i(1, 0), SOL))
	for faute in _fautes:
		push_error("[stations-du-navire] " + faute)
	print("[stations-du-navire] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le lieu `lieu` à `attendu`.
func _verifier(nom: String, lieu: Vector3, attendu: Vector3) -> void:
	if not lieu.is_equal_approx(attendu) and lieu.distance_to(attendu) > EPSILON:
		_fautes.append("%s : %s, attendu %s" % [nom, lieu, attendu])
