## La météo posée (#3625, #4081), sous le volume du monde (`Monde.poser_la_meteo`) comme dans l'atelier : une averse par
## boîte de `pluie.averses`, instance de `effets/meteo/averse.tscn`, et une nappe par nappe de brume, instance de
## `effets/meteo/nappe.tscn`, réglées dans l'éditeur ; le code n'y écrit que ce que la donnée porte. Son son joue en
## boucle sur le bus de son canal (#3834).
class_name Meteo
extends Node3D

const AVERSE := preload("res://effets/meteo/averse.tscn")
const NAPPE := preload("res://effets/meteo/nappe.tscn")

## Le son qui joue en boucle, `null` sans son.
var _son: AudioStreamPlayer = null


## La météo `meteo` (`MeteoDuRegard`, `CONTRAT.md`, section « Monde ») à la place de la précédente : ses averses, ses
## nappes et son son, que le même son laisse jouer ; rien sans météo.
func poser(meteo: Variant) -> void:
	for posee in get_children():
		if posee != _son:
			remove_child(posee)
			posee.free()
	_entendre(null if meteo == null else meteo.son)
	if meteo == null:
		return
	if meteo.pluie != null:
		for averse in meteo.pluie.averses:
			add_child(_averse(meteo.pluie, averse), true)
	for nappe in meteo.nappes:
		add_child(_nappe(nappe), true)


## Le son de la météo qui joue, `null` sans son.
func son() -> AudioStreamPlayer:
	return _son


## Le son `son` (`null` : aucun) joué partout en boucle, sur le bus de son canal (`son.canal`), à la place du précédent
## s'il en diffère.
func _entendre(son: Variant) -> void:
	var voulu: String = "" if son == null else son.id
	var joue: String = "" if _son == null else _son.get_meta("son")
	if voulu == joue:
		return
	if _son != null:
		_son.queue_free()
		_son = null
	if son == null:
		return
	_son = AudioStreamPlayer.new()
	_son.name = "son-%s" % son.id
	_son.set_meta("son", son.id)
	_son.stream = Effets.variante_du_son(son, true)
	_son.volume_db = linear_to_db(son.volume)
	_son.bus = son.canal
	_son.autoplay = true
	add_child(_son, true)


## L'averse de la boîte `averse` de la pluie `pluie` : sa boîte, son nombre, sa durée, née d'avance, son sens, sa vitesse,
## la taille de sa goutte, sa teinte et son opacité.
func _averse(pluie: Dictionary, averse: Dictionary) -> CPUParticles3D:
	var particules: CPUParticles3D = AVERSE.instantiate()
	particules.position = Vector3(averse.centre[0], averse.centre[1], averse.centre[2])
	particules.emission_box_extents = Vector3(averse.demiEtendue[0], averse.demiEtendue[1], averse.demiEtendue[2])
	particules.amount = int(averse.nombre)
	particules.lifetime = pluie.dureeS
	particules.preprocess = pluie.dureeS
	particules.direction = Vector3(pluie.sens.x, pluie.sens.y, pluie.sens.z)
	particules.initial_velocity_min = pluie.vitesseMs
	particules.initial_velocity_max = pluie.vitesseMs
	var goutte := particules.mesh as BoxMesh
	goutte.size = Vector3(pluie.largeurM, pluie.traineeM, pluie.largeurM)
	(goutte.material as StandardMaterial3D).albedo_color = Color(pluie.couleur, pluie.opacite)
	return particules


## La nappe de brume `nappe` : ses triangles, sa teinte et son opacité.
func _nappe(nappe: Dictionary) -> MeshInstance3D:
	var instance: MeshInstance3D = NAPPE.instantiate()
	var tableaux := []
	tableaux.resize(Mesh.ARRAY_MAX)
	tableaux[Mesh.ARRAY_VERTEX] = PackedFloat32Array(nappe.positions).to_byte_array().to_vector3_array()
	var maillage := ArrayMesh.new()
	maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	instance.mesh = maillage
	(instance.material_override as StandardMaterial3D).albedo_color = Color(nappe.couleur, nappe.alpha)
	return instance
