extends SceneTree

## Le véhicule dans l'atelier (#2987, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : l'atelier ouvert sur un
## pont figé (`PontFige`, `pont_fige.gd`, sur le véhicule figé par la sonde, `hotes/godot/recettes/vehicule.ts`), qui
## sert le listage et les GLB du projet et répond à chaque entrée de `vehicule` que la sonde a figée. La caraque choisie
## à côté des bases se pose au sol, cadrée à sa taille ; un canon choisi à une place de tribord, le Sabord installé, la
## Figure de proue installée, le Sabord retiré, une couleur et un emblème posés : à chaque geste, l'atelier envoie
## l'entrée attendue, et son montage (`MontageDeVehicule`) porte le corps que le pont a rendu : chaque pièce de poste à
## sa position, tournée vers son bord, chaque pièce d'Amélioration à la sienne, celle d'un poste montrant son nœud
## `montre` et cachant son nœud `cache`, les nœuds de `caches` cachés et chaque autre nœud `avec-`/`sans-` visible,
## chaque place de la réponse offerte à l'onglet Équipement sur la pièce qui y est montée, la palette et l'emblème sur
## ses surfaces.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/vehicule.json"
## La plus petite échelle d'orbite qui cadre une coque d'une trentaine de mètres, la caméra de la scène cadrant un corps.
const CADRE_D_UNE_COQUE := 5.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[atelier-du-vehicule] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[atelier-du-vehicule] %s : aucun véhicule figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.poser(self, lu)
	var atelier: Node = load("res://scenes/Atelier.tscn").instantiate()
	root.add_child(atelier)
	await _images(2)
	var cles: Array = lu.vehicule.keys()
	var bouton := _bouton(atelier, lu.modeles.libelles[lu.modeles.vehicules.caraque])
	_verifier(bouton != null, "la caraque a sa bascule à côté des bases")
	if bouton != null:
		bouton.pressed.emit()
	await _etape(atelier, pont, cles, 0, "caraque choisie")
	var cadre: float = (atelier.get_node("Marche") as MarcheDeLAtelier).echelle()
	_verifier(cadre > CADRE_D_UNE_COQUE, "la caraque cadrée à sa taille : échelle d'orbite %.2f" % cadre)
	_choisir(atelier, "poste/tribord/0", "canon-moyen")
	await _etape(atelier, pont, cles, 1, "canon à tribord 1")
	_cocher(atelier, "amelioration/sabord", true)
	await _etape(atelier, pont, cles, 2, "Sabord installé")
	_cocher(atelier, "amelioration/figure-de-proue", true)
	await _etape(atelier, pont, cles, 3, "Figure de proue installée")
	_cocher(atelier, "amelioration/sabord", false)
	await _etape(atelier, pont, cles, 4, "Sabord retiré")
	atelier._changer_la_couleur("vet1", "peau-brune")
	await _etape(atelier, pont, cles, 5, "couleur posée")
	_choisir(atelier, "vehicule/embleme", "taureau-rouge")
	await _etape(atelier, pont, cles, 6, "emblème posé")
	for faute in _fautes:
		push_error("[atelier-du-vehicule] " + faute)
	print("[atelier-du-vehicule] %d entrées de `vehicule`, erreurs=%d" % [pont.entrees.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


func _images(n: int) -> void:
	for i in n:
		await process_frame


## Après le geste `geste`, l'entrée `cles[rang]` envoyée en dernier, et le véhicule de l'atelier conforme à sa réponse.
func _etape(atelier: Node, pont: PontFige, cles: Array, rang: int, geste: String) -> void:
	await _images(2)
	var cle: String = cles[rang]
	if pont.entrees.is_empty() or pont.entrees.back() != cle:
		_fautes.append("%s : entrée %s, attendu %s" % [geste, "aucune" if pont.entrees.is_empty() else pont.entrees.back(), cle])
		return
	_conforme(atelier, pont.fige.vehicule[cle], geste)
	print("[atelier-du-vehicule] %s : %s" % [geste, JSON.stringify(pont.ecran.get("atelier", {}).get("vehicule"))])


## Le montage du véhicule de `atelier` porte la réponse `reponse` de `vehicule`.
func _conforme(atelier: Node, reponse: Dictionary, geste: String) -> void:
	var corps: Dictionary = reponse.vehicule
	var montage := atelier.get_node("Vehicule") as MontageDeVehicule
	var scene := montage.scene
	if scene == null:
		_fautes.append("%s : aucune scène posée" % geste)
		return
	_verifier(montage.element == corps.element, "%s : élément %s, attendu %s" % [geste, montage.element, corps.element])
	var postes: Array = corps.postes.map(func(p: Dictionary) -> String: return p.element)
	var montees: Array = corps.ameliorations.map(func(a: Dictionary) -> String: return a.element)
	_verifier(Array(montage.postes) == postes and Array(montage.ameliorations) == montees, "%s : pièces %s / %s, attendu %s / %s" % [geste, montage.postes, montage.ameliorations, postes, montees])
	var enfants := scene.get_children()
	var pieces := enfants.slice(enfants.size() - postes.size() - montees.size())
	for i in corps.postes.size():
		var poste: Dictionary = corps.postes[i]
		var piece := pieces[i] as Node3D
		_verifier(piece.position.is_equal_approx(_vecteur(poste.position)), "%s : pièce %d en %s, attendu %s" % [geste, i, piece.position, poste.position])
		_verifier(piece.basis.is_equal_approx(Basis(Vector3.UP, MiseEnPage.LACETS_DES_BORDS[poste.bord])), "%s : pièce %d non tournée vers %s" % [geste, i, poste.bord])
	for i in corps.ameliorations.size():
		var montee: Dictionary = corps.ameliorations[i]
		var piece := pieces[corps.postes.size() + i] as Node3D
		_verifier(piece.position.is_equal_approx(_vecteur(montee.position)), "%s : pièce de « %s » en %s, attendu %s" % [geste, montee.element, piece.position, montee.position])
		if montee.has("poste"):
			_verifier(piece.find_child(montee.poste.montre, true, false).visible and not piece.find_child(montee.poste.cache, true, false).visible, "%s : « %s » en %s ne montre pas %s seul" % [geste, montee.element, montee.position, montee.poste.montre])
	for noeud in scene.find_children("*", "Node3D", true, false):
		var nom := String(noeud.name)
		if nom in corps.caches:
			_verifier(not (noeud as Node3D).visible, "%s : %s visible, attendu caché" % [geste, nom])
		elif nom.begins_with("avec-") or nom.begins_with("sans-"):
			_verifier((noeud as Node3D).visible, "%s : %s caché, attendu visible" % [geste, nom])
	var listes := atelier.find_children("*", "OptionButton", true, false).filter(func(o: Node) -> bool: return String(o.get_meta("cle", "")).begins_with("poste/"))
	_verifier(listes.size() == reponse.places.size(), "%s : %d places de poste à l'écran, attendu %d" % [geste, listes.size(), reponse.places.size()])
	for place in reponse.places:
		var liste := _controle(atelier, "poste/%s/%d" % [place.bord, place.rang]) as OptionButton
		var attendue: String = MontageDeComposition.VIDE if place.piece == null else place.piece
		_verifier(liste != null and liste.get_item_metadata(liste.selected) == attendue, "%s : %s sur %s, attendu %s" % [geste, place.label, null if liste == null else liste.get_item_metadata(liste.selected), attendue])
	for amelioration in atelier.find_children("*", "CheckButton", true, false).filter(func(c: Node) -> bool: return String(c.get_meta("cle", "")).begins_with("amelioration/")):
		var id := String(amelioration.get_meta("cle")).trim_prefix("amelioration/")
		_verifier((amelioration as CheckButton).button_pressed == (id in reponse.ameliorations), "%s : case %s %s" % [geste, id, (amelioration as CheckButton).button_pressed])
	var couleurs := montage.couleurs_posees()
	for surface in MontageDeComposition.modeles.surfaces[corps.element]:
		if corps.palette.has(surface.palette):
			_verifier(String(couleurs.get(surface.nom, "")).to_lower() == String(corps.palette[surface.palette]).to_lower(), "%s : %s en %s, attendu %s" % [geste, surface.nom, couleurs.get(surface.nom), corps.palette[surface.palette]])
	var embleme: Variant = corps.get("embleme", {}).get("id")
	_verifier(montage.embleme == embleme, "%s : emblème %s, attendu %s" % [geste, montage.embleme, embleme])


func _vecteur(lieu: Array) -> Vector3:
	return Vector3(lieu[0], lieu[1], lieu[2])


## La bascule de texte `texte` sous `atelier`.
func _bouton(atelier: Node, texte: String) -> Button:
	for bouton in atelier.find_children("*", "Button", true, false):
		if (bouton as Button).text == texte:
			return bouton
	return null


## Le contrôle de clé `cle` sous `atelier`.
func _controle(atelier: Node, cle: String) -> Control:
	for controle in atelier.find_children("*", "Control", true, false):
		if controle.get_meta("cle", "") == cle:
			return controle
	_fautes.append("contrôle %s absent" % cle)
	return null


## L'article d'id `id` choisi dans la liste de clé `cle`, son signal émis comme au clic.
func _choisir(atelier: Node, cle: String, id: String) -> void:
	var liste := _controle(atelier, cle) as OptionButton
	if liste == null:
		return
	for rang in liste.item_count:
		if liste.get_item_metadata(rang) == id:
			liste.select(rang)
			liste.item_selected.emit(rang)
			return
	_fautes.append("%s n'offre pas %s" % [cle, id])


## La case de clé `cle` cochée (`coche`) ou décochée, son signal émis comme au clic.
func _cocher(atelier: Node, cle: String, coche: bool) -> void:
	var case := _controle(atelier, cle) as CheckButton
	if case != null:
		case.button_pressed = coche


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
