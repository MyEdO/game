## Ce que les recettes rendues du voile de la vision lisent aux pixels de l'image (`voile-du-bati.gd`,
## `voile-de-la-vision.gd`, `voile-du-navire.gd`) : l'image rendue, la luminance linéaire d'un pixel, les pixels d'un
## objet, la part de lumière d'une image voilée rapportée au témoin, et l'éclairage d'un extérieur du jeu.
extends RefCounted

## La luminance (linéaire) d'un pixel du témoin sous laquelle sa part ne se lit pas.
const LUMINANCE_LISIBLE := 0.02
## L'écart de canal au-delà duquel un pixel est d'un objet : ce que l'objet change à ses pixels, au-dessus de ce que son
## absence change au brouillard et aux ombres autour.
const ECART_DE_L_OBJET := 0.03
## L'éclairage d'un extérieur du jeu (`vue.lumiere` de `zones-pieces`) : un ciel, que les faces reflètent.
const LUMIERE_DU_JEU := {
	soleil = {vers = {x = 0.652, y = 0.552, z = 0.520}, couleur = "#fff3df", energie = 1.3},
	ambiante = {couleur = "#5b83ac", energie = 0.75},
	ciel = {zenith = "#5b83ac", horizon = "#9fb2c6"},
	brume = {couleur = "#9fb2c6", debutCases = 8, finCases = 32, depuisLOeil = false},
	sources = [],
}


## L'image de la fenêtre de `arbre` après douze images rendues.
static func image(arbre: SceneTree) -> Image:
	for _image_rendue in 12:
		await arbre.process_frame
	await RenderingServer.frame_post_draw
	return arbre.root.get_texture().get_image()


## La luminance linéaire de la couleur `couleur` d'un pixel sRGB.
static func luminance(couleur: Color) -> float:
	var lineaire := couleur.srgb_to_linear()
	return 0.2126 * lineaire.r + 0.7152 * lineaire.g + 0.0722 * lineaire.b


## Les pixels (un sur deux de chaque sens) où un canal de `avec` s'écarte de `sans` de plus de `ECART_DE_L_OBJET`, d'une
## luminance lisible dans `avec`.
static func masque(avec: Image, sans: Image) -> Array[Vector2i]:
	var pixels: Array[Vector2i] = []
	for y in range(0, avec.get_height(), 2):
		for x in range(0, avec.get_width(), 2):
			var ecart := avec.get_pixel(x, y) - sans.get_pixel(x, y)
			if maxf(absf(ecart.r), maxf(absf(ecart.g), absf(ecart.b))) > ECART_DE_L_OBJET and luminance(avec.get_pixel(x, y)) > LUMINANCE_LISIBLE:
				pixels.append(Vector2i(x, y))
	return pixels


## Les pixels (un sur deux de chaque sens) d'une luminance lisible dans `image` hors de chacun de `masques`.
static func hors_des(image: Image, masques: Array) -> Array[Vector2i]:
	var pris := {}
	for un_masque: Array in masques:
		for pixel: Vector2i in un_masque:
			pris[pixel] = true
	var pixels: Array[Vector2i] = []
	for y in range(0, image.get_height(), 2):
		for x in range(0, image.get_width(), 2):
			if not pris.has(Vector2i(x, y)) and luminance(image.get_pixel(x, y)) > LUMINANCE_LISIBLE:
				pixels.append(Vector2i(x, y))
	return pixels


## La médiane, sur les pixels `pixels`, de la luminance de `voilee` rapportée à celle de `temoin` ; -1 sans pixel.
static func part(temoin: Image, voilee: Image, pixels: Array[Vector2i]) -> float:
	var parts := PackedFloat32Array()
	for pixel in pixels:
		parts.append(luminance(voilee.get_pixelv(pixel)) / luminance(temoin.get_pixelv(pixel)))
	parts.sort()
	return parts[parts.size() / 2] if not parts.is_empty() else -1.0


## Les pixels de `pixels` dont les quatre voisins à deux pixels y sont aussi : loin de son bord, que le rendu lisse avec
## ce qui l'entoure.
static func interieur(pixels: Array[Vector2i]) -> Array[Vector2i]:
	var dedans := {}
	for pixel in pixels:
		dedans[pixel] = true
	return pixels.filter(func(pixel: Vector2i) -> bool: return [Vector2i(2, 0), Vector2i(-2, 0), Vector2i(0, 2), Vector2i(0, -2)].all(func(pas: Vector2i) -> bool: return dedans.has(pixel + pas)))
