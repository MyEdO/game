extends SceneTree

## Les pièces des Améliorations d'un véhicule (#2987, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `vehicules`, `ameliorations`) : montée à un ancrage, une pièce se pose à sa position dans le repère du véhicule, tournée
## comme lui ; montée à un poste, elle se tourne vers son bord, montre son nœud `montre` et cache son nœud `cache`
## (`Combattant.monter_l_amelioration`).

const RECETTE_AUTONOME := true
const OUVERT := "ouvert"
const FERME := "ferme"
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[ameliorations-du-vehicule] version=", Engine.get_version_info().string)
	_a_l_ancrage()
	for montre in [OUVERT, FERME]:
		_au_poste(montre, FERME if montre == OUVERT else OUVERT)
	for faute in _fautes:
		push_error("[ameliorations-du-vehicule] " + faute)
	print("[ameliorations-du-vehicule] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une scène dont l'avant se lit par son nœud `Avant`, à 1 m sur son +Z, et qui porte un nœud par nom de `noms`.
func _scene(noms: Array) -> Node3D:
	var scene := Node3D.new()
	var avant := Node3D.new()
	avant.name = "Avant"
	avant.position = Vector3(0.0, 0.0, 1.0)
	scene.add_child(avant)
	for nom: String in noms:
		var noeud := MeshInstance3D.new()
		noeud.name = nom
		scene.add_child(noeud)
	return scene


## Le sens, dans le repère de `scene`, de `noeud` vers son nœud `Avant`.
func _sens(scene: Node3D, noeud: Node3D) -> Vector3:
	return (scene.to_local((noeud.get_node("Avant") as Node3D).global_position) - scene.to_local(noeud.global_position)).normalized()


func _a_l_ancrage() -> void:
	var coque := _scene([])
	root.add_child(coque)
	var piece := _scene([])
	Combattant.monter_l_amelioration(coque, piece, {element = "figure-de-proue", position = [0.0, 4.0, 15.0]})
	if not piece.position.is_equal_approx(Vector3(0.0, 4.0, 15.0)):
		_fautes.append("ancrage : pièce en %s, attendu (0, 4, 15)" % piece.position)
	if not _sens(coque, piece).is_equal_approx(Vector3.BACK):
		_fautes.append("ancrage : pièce vers %s, attendu la proue %s" % [_sens(coque, piece), Vector3.BACK])
	coque.queue_free()


func _au_poste(montre: String, cache: String) -> void:
	var coque := _scene([])
	root.add_child(coque)
	var piece := _scene([OUVERT, FERME])
	Combattant.monter_l_amelioration(coque, piece, {element = "sabord", position = [-3.0, 2.0, 4.0], poste = {bord = "tribord", montre = montre, cache = cache}})
	var cas := "poste, %s montré" % montre
	var attendu := Basis(Vector3.UP, MiseEnPage.LACETS_DES_BORDS["tribord"]) * Vector3.BACK
	if not _sens(coque, piece).is_equal_approx(attendu):
		_fautes.append("%s : pièce vers %s, attendu tribord %s" % [cas, _sens(coque, piece), attendu])
	if not ((piece.get_node(montre) as Node3D).visible and not (piece.get_node(cache) as Node3D).visible):
		_fautes.append("%s : %s visible %s, %s visible %s" % [cas, montre, (piece.get_node(montre) as Node3D).visible, cache, (piece.get_node(cache) as Node3D).visible])
	coque.queue_free()
