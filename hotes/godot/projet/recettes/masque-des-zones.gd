extends SceneTree

## Un vêtement masque ce qu'il couvre (#2972, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : le montage d'une
## composition (`scripts/montage_de_composition.gd`, `masquer_les_zones_couvertes`) cache chaque mesh de zone de la base
## ou d'un élément monté dont un élément monté de couche plus extérieure couvre la zone, et le montre sinon. Le torse et
## le bras du corps se cachent sous la chemise et le pourpoint ; la chemise ne garde que son col ; un élément de même
## couche ne masque rien ; un mesh sans zone reste montré ; démonter le pourpoint rend les manches de la chemise.

const RECETTE_AUTONOME := true
const COUCHES := {
	chemise = {rang = 1, couvre = ["torse", "bras"]},
	pourpoint = {rang = 2, couvre = ["torse", "bras"]},
	ceinture = {rang = 2, couvre = ["hanches"]},
}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[masque-des-zones] version=", Engine.get_version_info().string)
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	MontageDeComposition.modeles = {couches = COUCHES}
	var corps := {torse = _piece("torse"), bras = _piece("bras"), hanches = _piece("hanches"), tete = _piece("tete"), sans = _piece(null)}
	montage._pieces_de_la_base.assign(corps.values())
	var chemise := {torse = _piece("torse"), bras = _piece("bras"), cou = _piece("cou")}
	var pourpoint := {torse = _piece("torse"), bras = _piece("bras"), hanches = _piece("hanches")}
	montage.pieces = {"ligne/chemise": chemise.values(), "ligne/pourpoint": pourpoint.values(), "ligne/ceinture": [_piece("hanches")]}
	montage.montes = {"ligne/chemise": "chemise", "ligne/pourpoint": "pourpoint", "ligne/ceinture": "ceinture"}
	montage.masquer_les_zones_couvertes()
	_attendre("corps sous la chemise et le pourpoint", corps, {torse = false, bras = false, hanches = false, tete = true, sans = true})
	_attendre("chemise sous le pourpoint", chemise, {torse = false, bras = false, cou = true})
	_attendre("pourpoint et ceinture de même couche", pourpoint, {torse = true, bras = true, hanches = true})
	montage.pieces.erase("ligne/pourpoint")
	montage.montes.erase("ligne/pourpoint")
	montage.masquer_les_zones_couvertes()
	_attendre("chemise sans pourpoint", chemise, {torse = true, bras = true, cou = true})
	_attendre("corps sous la seule chemise", corps, {torse = false, bras = false, hanches = false, tete = true, sans = true})
	for faute in _fautes:
		push_error("[masque-des-zones] " + faute)
	print("[masque-des-zones] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un mesh de la zone `zone`, comme Godot importe `extras.zone` d'un nœud glTF ; sans zone si `zone` est nul.
func _piece(zone: Variant) -> MeshInstance3D:
	var piece := MeshInstance3D.new()
	if zone != null:
		piece.set_meta("extras", {zone = zone})
	root.add_child(piece)
	return piece


func _attendre(cas: String, pieces: Dictionary, visibles: Dictionary) -> void:
	for zone in visibles:
		if (pieces[zone] as MeshInstance3D).visible != visibles[zone]:
			_fautes.append("%s : %s %s" % [cas, zone, "caché" if visibles[zone] else "montré"])
