extends SceneTree

## Les foyers des sources de lumière (#3783, `hotes/godot/pont/CONTRAT.md`, section « Lumière ») : une source de ton
## flamme pose sa lampe, qui vacille, son feu et sa fumée, gerbes continues nées d'avance, et son crépitement en boucle
## tiré de `res://sons/` ; une source magique pose sa lueur, sans son ; un nouvel éclairage garde le foyer de chaque
## source qu'il nomme encore par sa clé (#3947), le même nœud, sa flamme et son son compris, au point où il la pose, et
## retire celui d'une source partie ; une source dont le ton change reçoit sa flamme neuve. Aucune particule ne se peint plus large que sa taille au plateau (#3832 : sans la garder, le rendu de
## compatibilité peignait chacune à la taille de son quad, un disque blanc de deux mètres autour d'une lanterne).

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
const CREPITEMENT := {id = "crepitement", fichiers = ["crepitement.ogg"], volume = 0.6, canal = "ambiance"}
const FLAMME := {cle = "posee/brasero", x = 2, y = 3, z = 0, hM = 0.6, rayonCases = 5, couleur = "#ff8c3a", energie = 2.5, scintillement = {amplitude = 0.35, hz = 2.4}, visuel = "feu", son = CREPITEMENT}
const LUEUR := {cle = "portee/mage", x = 6, y = 3, z = 0, hM = 1.0, rayonCases = 4, couleur = "#8fc8ff", energie = 2.1, scintillement = null, visuel = "lueur", son = null}
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
	var avant := _noeuds(lumiere)
	lumiere.eclairer(LUMIERE.merged({sources = [FLAMME, LUEUR.merged({x = 7}, true)]}, true), METRES_PAR_CASE)
	await process_frame
	var apres := _noeuds(lumiere)
	if apres != avant:
		_fautes.append("un nouvel éclairage des mêmes sources ne garde pas leurs nœuds : %s, puis %s" % [avant, apres])
	var lueur: Foyer = lumiere.get_node("Sources").get_child(1)
	if not lueur.position.is_equal_approx(MiseEnPage.point_de_la_carte(7, LUEUR.y, MiseEnPage.hauteur_au_plateau(LUEUR.hM, METRES_PAR_CASE))):
		_fautes.append("la lueur déplacée reste à %s" % lueur.position)
	lumiere.eclairer(LUMIERE.merged({sources = [FLAMME.merged({visuel = "flammeche", son = null}, true)]}, true), METRES_PAR_CASE)
	await process_frame
	var restes := lumiere.get_node("Sources").get_children()
	if restes.size() != 1 or restes[0].get_instance_id() != avant[0]:
		_fautes.append("la lueur partie, le foyer du brasero ne reste pas seul : %s" % [restes])
	else:
		_verifier(restes[0], "flammeche", 1, "")
		if restes[0].get_node_or_null("feu") != null:
			_fautes.append("le brasero devenu flammèche garde son feu")
	lumiere.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[foyers] " + faute)
	print("[foyers] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## L'identité de chaque foyer de `lumiere`, puis de sa flamme et de chaque lecteur de son, dans l'ordre.
func _noeuds(lumiere: Lumiere) -> Array:
	var noeuds := []
	for foyer in lumiere.get_node("Sources").get_children():
		noeuds.append(foyer.get_instance_id())
		for porte in foyer.get_children().filter(func(n: Node) -> bool: return not n is OmniLight3D):
			noeuds.append(porte.get_instance_id())
	return noeuds


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
	for rang in emises.size():
		var largeur := _largeur_peinte(emises[rang])
		var taille: float = (emises[rang] as CPUParticles3D).scale_amount_max * MiseEnPage.echelle_au_plateau(METRES_PAR_CASE).x
		if largeur > taille + 0.0001:
			_fautes.append("%s : une particule se peint large de %.2f, sa taille au plateau est %.2f" % [visuel, largeur, taille])
	var lecteurs := foyer.get_children().filter(func(n: Node) -> bool: return n is AudioStreamPlayer3D)
	if son == "":
		if not lecteurs.is_empty():
			_fautes.append("%s : un son joue sans son de ton" % visuel)
		return
	var lecteur := foyer.get_node_or_null(son) as AudioStreamPlayer3D
	if lecteur == null or not lecteur.autoplay:
		_fautes.append("%s : %s ne joue pas" % [visuel, son])
		return
	var variante := lecteur.stream as AudioStreamOggVorbis
	if variante == null or not variante.loop:
		_fautes.append("%s : %s ne boucle pas" % [visuel, son])


## La largeur au plateau où se peint la plus grosse particule de la gerbe `gerbe` : un quad face à la caméra, à
## l'échelle de la particule et de ses parents seulement si son matériau la garde (`billboard_keep_scale`).
func _largeur_peinte(gerbe: CPUParticles3D) -> float:
	var quad := gerbe.mesh as QuadMesh
	var matiere := quad.material as StandardMaterial3D
	var echelle := gerbe.global_transform.basis.get_scale().x * gerbe.scale_amount_max if matiere.billboard_keep_scale else 1.0
	return quad.size.x * echelle
