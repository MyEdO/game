extends SceneTree

## Les panneaux de l'écran publié (#4061, `hotes/godot/pont/CONTRAT.md`, section « Écran publié ») :
## `PontDuNoyau.panneaux_a_l_ecran` rend l'emprise du seul `PanelContainer` visible le plus extérieur. Un panneau
## visible qui en contient un autre, un panneau caché et un panneau visible sous un parent caché : la seule emprise du
## premier.

const RECETTE_AUTONOME := true
const EMPRISE := Rect2(10, 20, 100, 50)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[panneaux-a-l-ecran] version=", Engine.get_version_info().string)
	var racine := Control.new()
	root.add_child(racine)
	var exterieur := _panneau(racine)
	exterieur.position = EMPRISE.position
	exterieur.size = EMPRISE.size
	_panneau(exterieur)
	_panneau(racine).visible = false
	var parent_cache := Control.new()
	parent_cache.visible = false
	racine.add_child(parent_cache)
	_panneau(parent_cache)
	await process_frame
	var panneaux := PontDuNoyau.panneaux_a_l_ecran([racine])
	var attendu := [[EMPRISE.position.x, EMPRISE.position.y, EMPRISE.size.x, EMPRISE.size.y]]
	var fautes := 0 if panneaux == attendu else 1
	if fautes:
		push_error("[panneaux-a-l-ecran] %s attendu, %s rendu" % [attendu, panneaux])
	print("[panneaux-a-l-ecran] erreurs=", fautes)
	quit(fautes)


## Un `PanelContainer` neuf sous `parent`.
func _panneau(parent: Node) -> PanelContainer:
	var panneau := PanelContainer.new()
	parent.add_child(panneau)
	return panneau
