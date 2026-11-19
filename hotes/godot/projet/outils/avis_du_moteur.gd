extends SceneTree

## Les avis de licence du moteur (#4063) : l'export (`hotes/godot/construire.mjs`, `avisDeGodot` de
## `hotes/godot/avis.mjs`) les lance par l'éditeur épinglé et écrit dans le fichier de son argument ce que le moteur
## rend de lui-même : `Engine.get_license_text()`, `Engine.get_copyright_info()` et `Engine.get_license_info()`.
##
##   godot --headless --path <projet> --script res://outils/avis_du_moteur.gd -- <avis.json>

func _initialize() -> void:
	var fichier := FileAccess.open("".join(OS.get_cmdline_user_args()), FileAccess.WRITE)
	if fichier == null:
		push_error("[avis] fichier illisible : %s" % " ".join(OS.get_cmdline_user_args()))
		quit(2)
		return
	fichier.store_string(JSON.stringify({
		"texte": Engine.get_license_text(),
		"composants": Engine.get_copyright_info(),
		"licences": Engine.get_license_info(),
	}))
	fichier.close()
	quit(0)
