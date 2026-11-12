class_name FabriqueDeModeles
extends SceneTree

## La fabrique des modèles (#3946, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D ») : l'export (`hotes/godot/construire.mjs`,
## `deposerLesModeles` de `hotes/godot/listage.mjs`) la lance par l'éditeur, qui seul compresse une image, sur la
## commande qu'il lui écrit : un tableau de `{ id, glb, scene }`, le GLB à lire et la scène à écrire de chaque modèle du
## listage. Un modèle qui ne se fabrique pas se dit en erreur, et le code de sortie vaut 1.
##
##   godot --headless --path <projet> --script res://outils/fabrique_de_modeles.gd -- <commande.json>

func _initialize() -> void:
	var commande: Variant = JSON.parse_string(FileAccess.get_file_as_string("".join(OS.get_cmdline_user_args())))
	if not commande is Array:
		push_error("[fabrique] commande illisible : %s" % " ".join(OS.get_cmdline_user_args()))
		quit(2)
		return
	var fautes: Array[String] = []
	for modele: Dictionary in commande:
		fabriquer(modele.id, FileAccess.get_file_as_bytes(modele.glb), modele.scene, fautes)
	for faute in fautes:
		push_error("[fabrique] " + faute)
	print("[fabrique] %d modèle(s), %d erreur(s)" % [commande.size(), fautes.size()])
	quit(0 if fautes.is_empty() else 1)


## La scène du GLB `octets` du modèle `id`, lue comme à l'exécution (`MontageDeComposition.scene_lue`), chaque texture
## de ses matériaux (`MontageDeComposition.MATERIAUX`) compressée (`compressee`), empaquetée et enregistrée sous `chemin`
## telle que Godot la charge (`MontageDeComposition._paquet_charge`) ; une erreur à `recueil` si elle ne se lit pas ou ne
## s'enregistre pas. La source de compression d'une texture (`Image.CompressSource`) est celle de l'import de textures
## de Godot (`editor/import/resource_importer_texture.cpp`, `compress/channel_pack` à son défaut, Godot 4.7-stable).
static func fabriquer(id: String, octets: PackedByteArray, chemin: String, recueil: Array[String]) -> void:
	var scene := MontageDeComposition.scene_lue(id, octets, recueil)
	if scene == null:
		return
	var compressees := {}
	for materiau: BaseMaterial3D in scene.get_meta(MontageDeComposition.MATERIAUX).values():
		for canal in BaseMaterial3D.TEXTURE_MAX:
			var texture := materiau.get_texture(canal)
			if texture != null:
				if not compressees.has(texture):
					compressees[texture] = compressee(texture, Image.COMPRESS_SOURCE_NORMAL if canal == BaseMaterial3D.TEXTURE_NORMAL else Image.COMPRESS_SOURCE_SRGB)
				materiau.set_texture(canal, compressees[texture])
	var paquet := PackedScene.new()
	var code := paquet.pack(scene)
	scene.free()
	if code == OK:
		code = ResourceSaver.save(paquet, chemin, ResourceSaver.FLAG_COMPRESS)
	if code != OK:
		recueil.append("scene-non-fabriquee : %s (%s)" % [id, error_string(code)])


## La `texture` avec ses mipmaps, compressée pour la carte graphique d'un ordinateur (S3TC, RGTC pour une normale) selon
## les canaux que sa `source` lui fait porter, sous le nom de `texture`.
static func compressee(texture: Texture2D, source: Image.CompressSource) -> ImageTexture:
	var image := texture.get_image()
	image.generate_mipmaps(source == Image.COMPRESS_SOURCE_NORMAL)
	image.compress_from_channels(Image.COMPRESS_S3TC, image.detect_used_channels(source))
	var rendue := ImageTexture.create_from_image(image)
	rendue.resource_name = texture.resource_name
	return rendue
