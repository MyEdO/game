extends SceneTree

## Les corps partagés (#3946, `MontageDeComposition.scene_du_modele`) : sur le pont figé de l'atelier (`PontFige`, l'atelier
## figé par la sonde, `hotes/godot/recettes/atelier.ts`, `figerLeRepos`), la base humanoïde demandée par plusieurs
## montages n'est téléchargée et lue qu'une fois : chaque corps est une instance de la même scène empaquetée, qui
## partage ses meshes, et aucun nœud ne reste hors de l'arbre. Un clip bouclé pour un corps
## (`MontageDeComposition.boucler`) ne boucle pas dans un autre ; un corps libéré laisse les autres entiers. Les modèles
## retenus de nouveau, la base se relit.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/repos.json"
const BASE := "humanoide"
## Les corps tirés de la même base.
const CORPS := 4
## Les images laissées à la lecture de la base.
const IMAGES_D_ATTENTE := 600
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[corps-partages] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[corps-partages] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.poser(self, lu)
	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	var base: Dictionary = lu.modeles.bases.filter(func(b: Dictionary) -> bool: return b.id == BASE)[0]
	var orphelins := Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT)
	var montages: Array[MontageDeComposition] = []
	var scenes: Array[Node3D] = []
	for i in CORPS:
		var montage := MontageDeComposition.new()
		root.add_child(montage)
		montages.append(montage)
		scenes.append(null)
		_tirer(montage, scenes, i)
	await _attendre(func() -> bool: return not null in scenes)
	_verifier(pont.requetes.count("modeles/%s" % lu.modeles.fichiers[BASE].glb) == 1, "la base téléchargée %d fois pour %d demandes" % [pont.requetes.count("modeles/%s" % lu.modeles.fichiers[BASE].glb), CORPS])
	for i in CORPS:
		montages[i].poser_le_modele(base, scenes[i])
		_verifier(montages[i].squelette != null and montages[i].lecteur != null, "corps %d sans squelette ou sans lecteur : %s" % [i, montages[i].erreurs])
	_verifier(Performance.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT) == orphelins, "des nœuds restent hors de l'arbre après la lecture")

	var premier := montages[0]
	var meshes := _meshes(premier)
	_verifier(not meshes.is_empty(), "base sans mesh")
	for montage in montages.slice(1):
		_verifier(montage.modele != premier.modele, "deux corps sur le même nœud")
		_verifier(_meshes(montage) == meshes, "un corps ne partage pas les meshes du premier : la base est relue")

	var clip := ""
	for nom in premier.lecteur.get_animation_list():
		if premier.lecteur.get_animation(nom).loop_mode == Animation.LOOP_NONE:
			clip = nom
			break
	_verifier(clip != "", "aucun clip sans boucle dans la base")
	var partage := montages[1].lecteur.get_animation(clip)
	MontageDeComposition.boucler(premier.lecteur, [clip])
	_verifier(premier.lecteur.get_animation(clip).loop_mode == Animation.LOOP_LINEAR, "le clip %s ne boucle pas dans le corps bouclé" % clip)
	_verifier(partage.loop_mode == Animation.LOOP_NONE and montages[1].lecteur.get_animation(clip) == partage, "le clip %s bouclé pour un corps boucle dans un autre" % clip)
	var autre := premier.lecteur.get_animation_list()[0] if premier.lecteur.get_animation_list()[0] != clip else premier.lecteur.get_animation_list()[1]
	_verifier(premier.lecteur.get_animation(autre) == montages[1].lecteur.get_animation(autre), "le clip %s, non bouclé, n'est plus partagé" % autre)

	premier.queue_free()
	await process_frame
	var second := montages[1]
	_verifier(_meshes(second) == meshes, "un corps libéré emporte les meshes d'un autre")
	second.lecteur.play(clip)
	second.lecteur.advance(0.3)
	_verifier(second.lecteur.assigned_animation == clip, "un corps ne joue plus son clip après la libération d'un autre")

	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	var relu := MontageDeComposition.new()
	root.add_child(relu)
	relu.poser_le_modele(base, await relu.scene_du_modele(BASE, relu.erreurs))
	_verifier(relu.modele != null and _meshes(relu) != meshes, "les modèles retenus de nouveau, la base n'est pas relue")
	_verifier(_meshes(second) == meshes, "les modèles retenus de nouveau, un corps posé perd ses meshes")
	for faute in _fautes:
		push_error("[corps-partages] " + faute)
	print("[corps-partages] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La scène de la base tirée par `montage` au rang `rang` de `scenes`.
func _tirer(montage: MontageDeComposition, scenes: Array[Node3D], rang: int) -> void:
	scenes[rang] = await montage.scene_du_modele(BASE, montage.erreurs)


## Les images passées jusqu'à ce que `tenu` le soit, au plus `IMAGES_D_ATTENTE`.
func _attendre(tenu: Callable) -> void:
	for i in IMAGES_D_ATTENTE:
		if tenu.call():
			return
		await process_frame
	_fautes.append("attente échue")


## Les meshes des pièces du modèle de `montage`, dans l'ordre de l'arbre, hors de leur fusion (`refondre`).
func _meshes(montage: MontageDeComposition) -> Array[Mesh]:
	var meshes: Array[Mesh] = []
	for piece in montage.modele.find_children("*", "MeshInstance3D", true, false):
		if piece != montage.fusion:
			meshes.append((piece as MeshInstance3D).mesh)
	return meshes


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
