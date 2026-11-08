extends SceneTree

## Les pièces montées aux postes d'un véhicule, tourné vers son cap (#2987, `hotes/godot/pont/CONTRAT.md`, section
## « Corps d'un combattant », `vehicules`) : posé sur son empreinte (`Combattant.poser_sur_l_empreinte`), chaque pièce
## montée à sa position dans le repère du véhicule, dont elle prend l'échelle, tournée vers son bord
## (`Combattant.monter_au_poste`), puis le tout tourné autour du milieu de son empreinte, sa proue vers son cap
## (`Combattant.tourner_au_cap`). Le véhicule reste centré sur son empreinte, quel que soit son cap ; une pièce de tribord
## regarde la droite de la proue.

const RECETTE_AUTONOME := true
const EMPREINTE := 4
## La coque : 30 m de long sur l'axe Z, sa proue vers +Z, et une pièce de 3 m de long, sa bouche vers +Z.
const COQUE := Vector3(6.0, 8.0, 30.0)
const PIECE := Vector3(1.0, 1.0, 3.0)
## Le sens au sol (x, z) de chaque cap : le nord vers -Z, l'est vers +X.
const SENS_DES_CAPS := {N = Vector2(0, -1), NE = Vector2(1, -1), E = Vector2(1, 0), SE = Vector2(1, 1), S = Vector2(0, 1), SO = Vector2(-1, 1), O = Vector2(-1, 0), NO = Vector2(-1, -1)}
## Le cran horaire de chaque bord depuis la proue, sur les huit caps.
const CRANS_DES_BORDS := {proue = 0, tribord = 2, poupe = 4, babord = 6}
const CAPS := ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[postes-du-vehicule] version=", Engine.get_version_info().string)
	for cap in CAPS:
		for bord in CRANS_DES_BORDS:
			_verifier(cap, bord)
	for faute in _fautes:
		push_error("[postes-du-vehicule] " + faute)
	print("[postes-du-vehicule] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une boîte de taille `taille`, posée au sol, dont l'avant, un repère au pied de sa face +Z, se lit par son nom `Avant`.
func _boite(taille: Vector3) -> Node3D:
	var scene := Node3D.new()
	var corps := MeshInstance3D.new()
	var boite := BoxMesh.new()
	boite.size = taille
	corps.mesh = boite
	corps.position = Vector3(0.0, taille.y / 2.0, 0.0)
	scene.add_child(corps)
	var avant := Node3D.new()
	avant.name = "Avant"
	avant.position = Vector3(0.0, 0.0, taille.z / 2.0)
	scene.add_child(avant)
	return scene


## Le sens au sol, monde, de `noeud` vers son repère `Avant`.
func _sens(noeud: Node3D) -> Vector2:
	var depuis := noeud.global_position
	var vers := (noeud.get_node("Avant") as Node3D).global_position
	return Vector2(vers.x - depuis.x, vers.z - depuis.z).normalized()


func _verifier(cap: String, bord: String) -> void:
	var case := Node3D.new()
	case.position = Vector3(5.5, 0.0, 7.5)
	root.add_child(case)
	var coque := _boite(COQUE)
	case.add_child(coque)
	Combattant.poser_sur_l_empreinte(coque, EMPREINTE, null)
	var piece := _boite(PIECE)
	Combattant.monter_au_poste(coque, piece, {position = [2.0, 1.95, -4.0], bord = bord})
	Combattant.tourner_au_cap(coque, cap, EMPREINTE)
	var cas := "cap %s, bord %s" % [cap, bord]
	var milieu := case.to_global(Vector3((EMPREINTE - 1) * 0.5, 0.0, (EMPREINTE - 1) * 0.5))
	var centre := coque.to_global(Vector3(0.0, 0.0, 0.0))
	if not Vector2(centre.x, centre.z).is_equal_approx(Vector2(milieu.x, milieu.z)):
		_fautes.append("%s : coque centrée en %s, attendu au milieu de l'empreinte %s" % [cas, centre, milieu])
	var proue: Vector2 = SENS_DES_CAPS[cap].normalized()
	if not _sens(coque).is_equal_approx(proue):
		_fautes.append("%s : proue vers %s, attendu %s" % [cas, _sens(coque), proue])
	var attendu: Vector2 = SENS_DES_CAPS[CAPS[(CAPS.find(cap) + CRANS_DES_BORDS[bord]) % CAPS.size()]].normalized()
	if not _sens(piece).is_equal_approx(attendu):
		_fautes.append("%s : pièce vers %s, attendu %s" % [cas, _sens(piece), attendu])
	var echelle := EMPREINTE / COQUE.z
	var longueur := piece.global_position.distance_to((piece.get_node("Avant") as Node3D).global_position)
	if not is_equal_approx(longueur, PIECE.z / 2.0 * echelle):
		_fautes.append("%s : demi-longueur de la pièce %s, attendu %s à l'échelle de la coque" % [cas, longueur, PIECE.z / 2.0 * echelle])
	case.queue_free()
