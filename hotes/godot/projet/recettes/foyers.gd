extends SceneTree

## Les foyers des sources de lumière (#3783, `hotes/godot/pont/CONTRAT.md`, section « Lumière ») : une source de ton
## flamme pose sa lampe, qui vacille, son feu et sa fumée, gerbes continues nées d'avance, et son crépitement en boucle
## tiré de `res://sons/` ; une source magique pose sa lueur, sans son ; un nouvel éclairage remplace les foyers du
## précédent.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const CREPITEMENT := {id = "crepitement", fichiers = ["crepitement.ogg"], volume = 0.6}
const FLAMME := {x = 2, y = 3, z = 0, hM = 0.6, rayonCases = 5, couleur = "#ff8c3a", energie = 2.5, scintillement = {amplitude = 0.35, hz = 2.4}, visuel = "feu", son = CREPITEMENT}
const LUEUR := {x = 6, y = 3, z = 0, hM = 1.0, rayonCases = 4, couleur = "#8fc8ff", energie = 2.1, scintillement = null, visuel = "lueur", son = null}
const LUMIERE := {soleil = null, ambiante = {couleur = "#203040", energie = 0.2}, ciel = null,
	brume = {couleur = "#101820", debutCases = 10.0, finCases = 40.0, depuisLOeil = true}, sources = [FLAMME, LUEUR]}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[foyers] version=", Engine.get_version_info().string)
	var lumiere: Lumiere = load("res://scenes/Lumiere.tscn").instantiate()
	root.add_child(lumiere)
	lumiere.eclairer(LUMIERE, METRES_PAR_CASE)
	var foyers := lumiere.get_node("Sources").get_children()
	if foyers.size() != 2:
		_fautes.append("%d foyers posés, attendu 2" % foyers.size())
	else:
		_verifier(foyers[0], "feu", 2, "son-crepitement")
		_verifier(foyers[1], "lueur", 1, "")
		var lampe: OmniLight3D = foyers[0].get_children().filter(func(n: Node) -> bool: return n is OmniLight3D)[0]
		var energies := [lampe.light_energy]
		await create_timer(0.13).timeout
		energies.append(lampe.light_energy)
		if is_equal_approx(energies[0], energies[1]):
			_fautes.append("la lampe du feu ne vacille pas : %s" % [energies])
	lumiere.eclairer(LUMIERE, METRES_PAR_CASE)
	await process_frame
	if lumiere.get_node("Sources").get_child_count() != 2:
		_fautes.append("un nouvel éclairage garde les foyers du précédent")
	lumiere.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[foyers] " + faute)
	print("[foyers] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le foyer `foyer` montre `visuel`, `gerbes` gerbes continues qui émettent, nées d'avance, et joue le son `son` en
## boucle (`""` : aucun son).
func _verifier(foyer: Node, visuel: String, gerbes: int, son: String) -> void:
	var flamme := foyer.get_node_or_null(visuel)
	if flamme == null:
		_fautes.append("%s : aucun visuel" % visuel)
		return
	var emises := flamme.get_children().filter(func(n: Node) -> bool:
		var p := n as CPUParticles3D
		return p != null and p.emitting and not p.one_shot and not is_zero_approx(p.preprocess))
	if emises.size() != gerbes:
		_fautes.append("%s : %d gerbes continues nées d'avance, attendu %d" % [visuel, emises.size(), gerbes])
	var lecteurs := foyer.get_children().filter(func(n: Node) -> bool: return n is AudioStreamPlayer3D)
	if son == "":
		if not lecteurs.is_empty():
			_fautes.append("%s : un son joue sans son de ton" % visuel)
		return
	var lecteur := foyer.get_node_or_null(son) as AudioStreamPlayer3D
	if lecteur == null or not lecteur.autoplay:
		_fautes.append("%s : %s ne joue pas" % [visuel, son])
		return
	var variantes := lecteur.stream as AudioStreamRandomizer
	if variantes == null or variantes.streams_count == 0 or not (variantes.get_stream(0) as AudioStreamOggVorbis).loop:
		_fautes.append("%s : %s ne boucle pas" % [visuel, son])
