extends SceneTree

## Les clips d'un véhicule posé (#2987, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant », `vehicules`) :
## l'arbre d'états du combattant (`Combattant`, `animation/corps.tres`, #3949), branché sur le lecteur de son élément
## (`MontageDeVehicule.lecteur`), joue ceux de son élément par rôle (`clips` de son corps), comme un corps ceux de sa
## base : les alias de `repos` et `marche` bouclent, l'état de marche à son déplacement, et, vers une cible, l'état de
## son rôle d'attaque, `tir` si sa table en porte un, `melee` sinon, puis le repos en fin de clip ; le clip de l'état
## courant marqué au lecteur.

const RECETTE_AUTONOME := true
## La durée (s) de chaque clip du lecteur de la recette.
const DUREE_S := 1.0
## L'attente (s) qui couvre la fin d'un clip et le fondu du retour au repos.
const FIN_S := 1.5
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[clips-du-vehicule] version=", Engine.get_version_info().string)
	await _verifier("pièce de tir", {repos = "repos", marche = "marche", tir = "tir"}, "tir")
	await _verifier("bélier", {repos = "repos", marche = "marche", melee = "coup"}, "melee")
	for faute in _fautes:
		push_error("[clips-du-vehicule] " + faute)
	print("[clips-du-vehicule] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un combattant dont le véhicule posé porte la table `clips` et un lecteur de ces clips : son attaque gagne l'état
## `attaque`, puis le repos en fin de clip ; son déplacement, la marche ; les alias de repos et marche bouclent.
func _verifier(cas: String, clips: Dictionary, attaque: String) -> void:
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	root.add_child(combattant)
	var vehicule: MontageDeVehicule = combattant.get_node("Vehicule")
	var scene := Node3D.new()
	var lecteur := AnimationPlayer.new()
	scene.add_child(lecteur)
	var bibliotheque := AnimationLibrary.new()
	for nom in clips.values():
		var clip := Animation.new()
		clip.length = DUREE_S
		bibliotheque.add_animation(nom, clip)
	lecteur.add_animation_library("", bibliotheque)
	vehicule.add_child(scene)
	vehicule.scene = scene
	vehicule.lecteur = lecteur
	vehicule.clips = clips
	combattant._brancher()
	var arbre: AnimationTree = combattant.get_node("Etats")
	var etats: AnimationNodeStateMachinePlayback = arbre.get("parameters/playback")
	for role in ["repos", "marche"]:
		if lecteur.get_animation("role/" + role).loop_mode != Animation.LOOP_LINEAR:
			_fautes.append("%s : l'alias de %s ne boucle pas" % [cas, role])
		if bibliotheque.get_animation(clips[role]).loop_mode != Animation.LOOP_NONE:
			_fautes.append("%s : le clip %s du lecteur boucle, l'alias devait être une copie" % [cas, clips[role]])
	await process_frame
	await process_frame
	combattant.agir_vers(Vector3(3.0, 0.0, 0.0))
	await process_frame
	await process_frame
	if etats.get_current_node() != attaque or lecteur.assigned_animation != clips[attaque]:
		_fautes.append("%s : attaque à l'état %s (clip marqué %s), attendu %s (%s)" % [cas, etats.get_current_node(), lecteur.assigned_animation, attaque, clips[attaque]])
	await create_timer(FIN_S).timeout
	if etats.get_current_node() != "repos" or lecteur.assigned_animation != clips.repos:
		_fautes.append("%s : après l'attaque, état %s (clip marqué %s), attendu repos" % [cas, etats.get_current_node(), lecteur.assigned_animation])
	combattant._aller(Vector3(2.0, 0.0, 0.0))
	await process_frame
	await process_frame
	if etats.get_current_node() != "marche":
		_fautes.append("%s : déplacement à l'état %s, attendu marche" % [cas, etats.get_current_node()])
	combattant.queue_free()
	await process_frame
