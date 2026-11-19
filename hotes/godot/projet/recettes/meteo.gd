extends SceneTree

## La météo posée dans le monde (#3625, #4081, `hotes/godot/pont/CONTRAT.md`, section « Monde », `meteo`) par son nœud
## `Meteo` : une averse par boîte de la pluie, instance de `effets/meteo/averse.tscn`, à la boîte, au nombre, à la durée,
## dans le sens, à la vitesse, à la goutte, à la teinte et à l'opacité de la donnée, sa goutte et sa matière propres à
## elle, et une nappe par nappe de brume, instance de `effets/meteo/nappe.tscn`, à ses triangles, sa teinte et son
## opacité ; et son son en boucle (#3834), qui joue encore, le même, quand la météo se repose ; une météo absente retire
## ce qui était posé, son son compris.

const RECETTE_AUTONOME := true
const METEO := {
	pluie = {
		averses = [{centre = [2.0, 9.0, 0.0], demiEtendue = [3.0, 0.0, 1.0], nombre = 12}, {centre = [4.0, 9.0, 2.0], demiEtendue = [1.0, 0.0, 1.0], nombre = 4}],
		sens = {x = 0.0, y = -1.0, z = 0.0}, vitesseMs = 9.0, largeurM = 0.03, traineeM = 0.45, dureeS = 1.0,
		couleur = "#aebfd0", opacite = 0.45,
	},
	nappes = [{positions = [0.0, 0.6, 0.0, 2.0, 0.6, 0.0, 2.0, 0.6, 2.0], couleur = "#aab4bd", alpha = 0.3}],
	son = {id = "pluie", fichiers = ["pluie.ogg"], volume = 0.5, canal = "ambiance"},
}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[meteo] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var posee: Node3D = monde.get_node("VolumeDeScene/Volume/Meteo")
	monde.poser_la_meteo(METEO)
	var averses := posee.get_children().filter(func(n: Node) -> bool: return n.scene_file_path == Meteo.AVERSE.resource_path)
	var nappes := posee.get_children().filter(func(n: Node) -> bool: return n.scene_file_path == Meteo.NAPPE.resource_path)
	if averses.map(func(a: CPUParticles3D) -> int: return a.amount) != [12, 4]:
		_fautes.append("averses : %s particules, attendu [12, 4]" % [averses.map(func(a: CPUParticles3D) -> int: return a.amount)])
	else:
		var averse: CPUParticles3D = averses[0]
		var goutte := averse.mesh as BoxMesh
		if not averse.position.is_equal_approx(Vector3(2.0, 9.0, 0.0)) or not averse.emission_box_extents.is_equal_approx(Vector3(3.0, 0.0, 1.0)):
			_fautes.append("averse : boîte %s ± %s" % [averse.position, averse.emission_box_extents])
		if not averse.direction.is_equal_approx(Vector3.DOWN) or not is_equal_approx(averse.initial_velocity_min, 9.0) or not is_equal_approx(averse.initial_velocity_max, 9.0) or not averse.particle_flag_align_y:
			_fautes.append("averse : ne tombe pas dans le sens de la donnée, étirée")
		if not is_equal_approx(averse.lifetime, 1.0) or not is_equal_approx(averse.preprocess, 1.0) or not averse.local_coords:
			_fautes.append("averse : durée %s, née d'avance %s, repère local %s" % [averse.lifetime, averse.preprocess, averse.local_coords])
		if not goutte.size.is_equal_approx(Vector3(0.03, 0.45, 0.03)) or not goutte.material.albedo_color.is_equal_approx(Color("#aebfd0", 0.45)):
			_fautes.append("averse : goutte %s, teinte %s" % [goutte.size, goutte.material.albedo_color])
		if goutte == averses[1].mesh or goutte.material == averses[1].mesh.material:
			_fautes.append("averse : deux averses partagent leur goutte ou sa matière")
	if nappes.size() != 1 or not (nappes[0] as MeshInstance3D).material_override.albedo_color.is_equal_approx(Color("#aab4bd", 0.3)) or (nappes[0] as MeshInstance3D).mesh.get_faces().size() != 3:
		_fautes.append("nappes : %d posées, attendu une, d'un triangle, à la teinte #aab4bd et l'opacité 0.3" % nappes.size())
	var son := monde.son_de_la_meteo()
	if son == null or not son.playing or (son.stream as AudioStreamOggVorbis) == null or not (son.stream as AudioStreamOggVorbis).loop:
		_fautes.append("la pluie ne s'entend pas en boucle")
	monde.poser_la_meteo(METEO)
	if monde.son_de_la_meteo() != son:
		_fautes.append("la même météo reposée relance son son")
	monde.poser_la_meteo(null)
	await process_frame
	if posee.get_child_count() != 0 or monde.son_de_la_meteo() != null:
		_fautes.append("sans météo : %d nœuds restent posés, son %s" % [posee.get_child_count(), monde.son_de_la_meteo()])
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[meteo] " + faute)
	print("[meteo] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)
