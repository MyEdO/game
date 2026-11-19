extends SceneTree

## Deux demandes de la même scène produisent un seul écran après sa mise en page. La scène courante est
## ensuite déchargée pendant une nouvelle attente : le pont garde le dernier écran, sans erreur du moteur
## (comptée par `hotes/godot/construire.mjs`, `erreursDe`).
const RECETTE_AUTONOME := true
const IMAGES_APRES := 3

var _fautes: Array[String] = []


class ScenePubliee extends Control:
	var publication: PublicationDeLEcran
	var publications := 0

	func _ready() -> void:
		var conteneur := VBoxContainer.new()
		conteneur.add_child(Button.new())
		add_child(conteneur)
		publication = PublicationDeLEcran.new(get_node("/root/Pont"), self, self, _ecran_publie)

	func _ecran_publie() -> Dictionary:
		publications += 1
		return {numero = publications}


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var pont := PontFige.poser(self, {})
	var scene := ScenePubliee.new()
	root.add_child(scene)
	current_scene = scene
	scene.publication.demander()
	scene.publication.demander()
	_verifier(pont.ecran.is_empty(), "l'écran a été publié dès la demande")
	for i in IMAGES_APRES:
		await process_frame
	_verifier(pont.ecran == {numero = 1}, "les deux demandes n'ont pas produit une seule publication")

	var publication: WeakRef = weakref(scene.publication)
	# Le signal a déjà pris la liste de ses abonnés quand le déchargement libère la scène.
	process_frame.connect(unload_current_scene, CONNECT_ONE_SHOT)
	scene.publication.demander()
	for i in IMAGES_APRES:
		await process_frame
	_verifier(publication.get_ref() == null, "la publication est encore en vie après le déchargement")
	_verifier(pont.ecran == {numero = 1}, "l'écran a changé après le déchargement")

	for faute in _fautes:
		push_error("[publication-de-l-ecran] " + faute)
	print("[publication-de-l-ecran] écran publié : %s, %d faute(s)" % [pont.ecran, _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


func _verifier(tenu: bool, message: String) -> void:
	if not tenu:
		_fautes.append(message)
