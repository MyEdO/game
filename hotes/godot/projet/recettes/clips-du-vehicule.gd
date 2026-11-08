extends SceneTree

## Les clips d'un véhicule posé (#2987, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant », `vehicules`) :
## le combattant joue ceux de son élément par rôle (`clips` de son corps, `MontageDeVehicule.lecteur`), comme un corps
## ceux de sa base : `idle` et `walk` en boucle, `walk` à son déplacement, et, vers une cible, le clip de son rôle
## d'attaque, `ranged` si sa table en porte un, `melee` sinon, suivi du repos.

const RECETTE_AUTONOME := true
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[clips-du-vehicule] version=", Engine.get_version_info().string)
	_verifier("pièce de tir", {idle = "repos", walk = "marche", ranged = "tir"}, "tir")
	_verifier("bélier", {idle = "repos", walk = "marche", melee = "coup"}, "coup")
	for faute in _fautes:
		push_error("[clips-du-vehicule] " + faute)
	print("[clips-du-vehicule] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un combattant dont le véhicule posé porte la table `clips` et un lecteur de ces clips : son attaque joue `attaque`,
## puis le repos ; son déplacement, la marche ; repos et marche bouclent.
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
		clip.length = 1.0
		bibliotheque.add_animation(nom, clip)
	lecteur.add_animation_library("", bibliotheque)
	vehicule.add_child(scene)
	vehicule.scene = scene
	vehicule.lecteur = lecteur
	vehicule.clips = clips
	combattant._boucler()
	for role in ["idle", "walk"]:
		if lecteur.get_animation(clips[role]).loop_mode != Animation.LOOP_LINEAR:
			_fautes.append("%s : %s ne boucle pas" % [cas, clips[role]])
	combattant.agir_vers(Vector3(3.0, 0.0, 0.0))
	var file := lecteur.get_queue()
	if lecteur.current_animation != attaque or file.size() != 1 or String(file[0]) != "repos":
		_fautes.append("%s : attaque %s puis %s, attendu %s puis repos" % [cas, lecteur.current_animation, lecteur.get_queue(), attaque])
	combattant._aller(Vector3(2.0, 0.0, 0.0))
	if lecteur.current_animation != "marche":
		_fautes.append("%s : déplacement %s, attendu marche" % [cas, lecteur.current_animation])
	combattant.queue_free()
