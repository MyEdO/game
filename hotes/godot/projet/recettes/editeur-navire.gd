extends SceneTree

## Le navire dans l'éditeur de carte (#3772, `hotes/godot/pont/CONTRAT.md`, section « Éditeur », `navires`) : l'éditeur
## (`scripts/editeur.gd`) ouvert sur un pont figé (`PontFige`, sur l'éditeur du navire figé par la sonde,
## `hotes/godot/recettes/editeur.ts`), qui sert le listage et les GLB du projet et répond à chaque entrée de `editer`
## et de `morceaux` que la sonde a figée. L'outil Navire pressé offre la caraque, choisie en tête de sa liste ; le cap à l'est pressé,
## l'appui sur le monde la pose : son modèle se monte (`MontageDesNavires`), son origine au point de la carte sous son
## centre servi, sa proue tournée vers l'est. Glissée à l'outil de sélection, la caraque se repose sous son centre
## déplacé, sans se recharger. Le pont du dessus choisi, sa plus haute couche, le monde touche le sol de chaque case de
## ce pont (`Monde.sol_sous`) sur cette couche : ses ponts se visent. Aucune entrée n'est hors du figé, aucun refus ni
## aucune panne ne se dit.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/editeur-navire.json"
## Le fichier des calques que l'éditeur garde pour l'Arène : une ouverture sans lui envoie l'entrée figée.
const CALQUES_DE_L_ARENE := "user://calques/arene.json"
## Les images au plus qu'attend une réponse montrée ou un modèle posé.
const IMAGES_D_ATTENTE := 600
## La hauteur d'où tombe le rayon qui cherche le sol d'une case, au-dessus de tout pont.
const AU_DESSUS := 100.0
const EPSILON := 0.001
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[editeur-navire] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[editeur-navire] %s : aucun éditeur figé" % FIGE)
		quit(2)
		return
	if FileAccess.file_exists(CALQUES_DE_L_ARENE):
		DirAccess.remove_absolute(CALQUES_DE_L_ARENE)
	var pont := PontFige.poser(self, lu)
	var editeur: Node = (load("res://scenes/Editeur.tscn") as PackedScene).instantiate()
	root.add_child(editeur)
	await _derouler(lu, editeur)
	_verifier(pont.entrees.all(func(cle: String) -> bool: return lu.editer.has(cle) or lu.morceaux.has(cle)), "entrées de `editer` ou de `morceaux` hors du figé : %s" % [pont.entrees.filter(func(cle: String) -> bool: return not (lu.editer.has(cle) or lu.morceaux.has(cle)))])
	for avis in ["Refus", "Panne"]:
		var texte := (editeur.get_node("Interface/Avis/%s" % avis) as Label).text
		_verifier(texte == "", "%s dit : %s" % [avis, texte])
	for faute in _fautes:
		push_error("[editeur-navire] " + faute)
	print("[editeur-navire] %d entrées de `editer` et de `morceaux`, %d cases du pont figées, erreurs=%d" % [pont.entrees.size(), lu.touches.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## Les gestes de la recette joués sur l'éditeur `editeur`, arrêtés à la première attente vaine.
func _derouler(lu: Dictionary, editeur: Node) -> void:
	if not await _attendre(func() -> bool: return not editeur.get("_vue").is_empty(), "l'Arène ouverte"):
		return
	_presser(editeur, "outil/navire")
	var liste := _liste(editeur, "navires")
	_verifier(liste != null and liste.item_count > 0 and liste.selected == 0 and liste.get_item_text(0) == "Caraque", "la caraque choisie en tête de la liste des navires")
	_presser(editeur, "navire/cap/E")
	var pointes: Array = lu.pointes
	_pointer(editeur, pointes[0])
	var id: String = lu.navire.id
	var navires: MontageDesNavires = editeur.get_node("Navires")
	if not await _attendre(func() -> bool: return id in navires.poses(), "le modèle de %s posé" % id):
		return
	var modele: Node3D = navires.get("_montes")[id].scene
	_verifier(modele.global_position.distance_to(_origine(lu.navire.pose)) < EPSILON, "le modèle de %s en %s, attendu sous son centre en %s" % [id, modele.global_position, _origine(lu.navire.pose)])
	var proue := Vector3.BACK.rotated(Vector3.UP, MiseEnPage.lacet_de_proue(MiseEnPage.LACETS_DES_CAPS.E))
	var cap := Vector3(modele.global_basis.z.x, 0.0, modele.global_basis.z.z).normalized()
	_verifier(cap.distance_to(proue) < EPSILON, "la proue de %s vers %s, attendue vers l'est %s" % [id, cap, proue])
	_presser(editeur, "outil/select")
	for pointe in pointes.slice(1):
		_pointer(editeur, pointe)
	var deplace := _origine(lu.navire.deplace)
	if not await _attendre(func() -> bool: return navires.get("_montes")[id].scene == modele and modele.global_position.distance_to(deplace) < EPSILON, "le modèle de %s reposé sans se recharger sous son centre déplacé" % id):
		return
	var couches: Array = editeur.get("_vue").zones["editeur.couches"].filter(func(el: Dictionary) -> bool: return el.id == "couches")[0].valeurs
	_presser(editeur, couches.back().id)
	var haute := int(couches.back().jeu.edition.z)
	if not await _attendre(func() -> bool: return int(editeur.get("_vue").couche) == haute, "le pont du dessus choisi"):
		return
	await physics_frame
	await physics_frame
	var monde: Monde = editeur.get_node("Monde")
	_verifier(not lu.touches.is_empty(), "aucune case du pont du dessus figée")
	for c in lu.touches:
		var case := Vector3i(int(c.x), int(c.y), int(c.z))
		var touche: Variant = monde.sol_sous(MiseEnPage.centre_de_case(Vector2i(case.x, case.y), AU_DESSUS))
		_verifier(touche != null and touche.case == case, "le pont de %s en %s : touché %s" % [id, case, null if touche == null else touche.case])


## Le geste du pointeur figé `pointe` joué par l'éditeur, sa case en entiers comme le monde la touche.
func _pointer(editeur: Node, pointe: Dictionary) -> void:
	editeur._pointer(pointe.geste, {case = Vector2i(int(pointe.point.case.x), int(pointe.point.case.y)), f = Vector2(pointe.point.f.x, pointe.point.f.y)})


## Le point du plateau sous le centre `centre` d'un navire servi, à la hauteur 0, sa flottaison.
func _origine(centre: Dictionary) -> Vector3:
	return MiseEnPage.point_de_la_carte(centre.x, centre.y, 0.0)


## Le bouton de l'élément d'id `id` pressé, comme au clic.
func _presser(editeur: Node, id: String) -> void:
	for bouton: BaseButton in editeur.get_node("Interface").find_children("*", "BaseButton", true, false):
		if bouton.owner != null and bouton.owner.get_meta(Zone.META, "") == "bouton/%s" % id:
			bouton.pressed.emit()
			return
	_fautes.append("bouton %s absent" % id)


## La liste déroulante de l'élément d'id `id`, `null` sans elle.
func _liste(editeur: Node, id: String) -> OptionButton:
	for liste: OptionButton in editeur.get_node("Interface").find_children("*", "OptionButton", true, false):
		if liste.owner != null and liste.owner.get_meta(Zone.META, "") == "liste/%s" % id:
			return liste
	return null


## Les images attendues jusqu'à ce que `pret` soit vrai, `false` et une faute `quoi` au bout de `IMAGES_D_ATTENTE`.
func _attendre(pret: Callable, quoi: String) -> bool:
	for image in IMAGES_D_ATTENTE:
		if pret.call():
			return true
		await process_frame
	_fautes.append("%s : rien après %d images" % [quoi, IMAGES_D_ATTENTE])
	return false


func _verifier(vrai: bool, faute: String) -> void:
	if not vrai:
		_fautes.append(faute)
