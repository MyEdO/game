extends SceneTree

## Le véhicule dans l'atelier (#2987, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : l'atelier ouvert sur un pont
## figé (`PontFige`, le véhicule figé par la sonde, `hotes/godot/recettes/vehicule.ts`), qui sert le listage et les GLB du
## projet et répond à chaque entrée de `vehicule` que la sonde a figée. La caraque choisie à côté des bases se pose au sol,
## cadrée à sa taille ; un canon choisi à une place de tribord, le Sabord installé, la Figure de proue installée, le Sabord
## retiré, une couleur et un emblème posés : à chaque geste, l'atelier envoie l'entrée attendue, et son montage
## (`MontageDeVehicule`) porte le corps que le pont a rendu : chaque pièce de poste à sa position, tournée vers son bord,
## chaque pièce d'Amélioration à la sienne, celle d'un poste montrant son nœud `montre` et cachant son nœud `cache`, les
## nœuds de `caches` cachés et chaque autre nœud `avec-`/`sans-` visible, chaque place de la réponse offerte à l'onglet
## Équipement sur la pièce qui y est montée, la palette et l'emblème sur ses surfaces. La caraque n'attaque pas ; l'onglet
## Effets offre un bouton par variante, par zone, par lumière et par son de la vitrine (#3777, #3783, `vitrine`), chacun
## d'un visuel, d'un projectile et de fichiers sonores que Godot connaît ; le coup d'un canon y part de l'auteur, le
## souffle de feu pose sa nappe sur chaque case, la flamme son foyer sur la cible ; le trébuchet choisi attaque : son
## clip de tir joue et sa pierre vole.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/vehicule.json"
## La plus petite échelle d'orbite qui cadre une coque d'une trentaine de mètres, la caméra de la scène cadrant un corps.
const CADRE_D_UNE_COQUE := 5.0
## Les secondes au bout desquelles les éclats des effets joués sont éteints et retirés, le clip de tir rendu au repos.
const ECLATS_ETEINTS_S := 4.0
var _fautes: Array[String] = []


## Le pont de l'atelier figé : `catalogues` et `modeles` rendent leur réponse figée, `vehicule` celle de son entrée,
## `modeles/` le listage figé et `modeles/<fichier>` le fichier du projet ; il garde les entrées de `vehicule` reçues et
## le dernier écran publié.
class PontFige extends PontDuNoyau:
	var fige: Dictionary
	var entrees: Array[String] = []
	var ecran: Dictionary = {}

	func _init(lu: Dictionary) -> void:
		fige = lu

	func rejoindre(_au_refus: Callable, _a_la_panne: Callable) -> bool:
		return true

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		if methode in ["catalogues", "modeles", "vitrine"]:
			return fige[methode]
		var cle := JSON.stringify(entree)
		entrees.append(cle)
		return fige.vehicule.get(cle, {ok = false, erreur = {categorie = "validation", message = "entrée non figée : %s" % cle}})

	func requeter(relative: String, recueil: Array[String], _methode := HTTPClient.METHOD_GET, _corps := "") -> PackedByteArray:
		if relative == "modeles/listage.json":
			return JSON.stringify(fige.listage).to_utf8_buffer()
		var octets := FileAccess.get_file_as_bytes("res://%s" % relative)
		if octets.is_empty():
			recueil.append("fichier absent : %s" % relative)
		return octets

	func publier_l_ecran(publie: Dictionary) -> void:
		ecran = publie


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[atelier-du-vehicule] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[atelier-du-vehicule] %s : aucun véhicule figé" % FIGE)
		quit(2)
		return
	var ancien := root.get_node_or_null("Pont")
	if ancien != null:
		root.remove_child(ancien)
		ancien.free()
	var pont := PontFige.new(lu)
	pont.name = "Pont"
	root.add_child(pont)
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
	await _vitrine(atelier, pont, cles, lu)
	atelier.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[atelier-du-vehicule] " + faute)
	print("[atelier-du-vehicule] %d entrées de `vehicule`, erreurs=%d" % [pont.entrees.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## L'onglet Effets sur la vitrine figée `lu.vitrine` : la caraque sans attaque, chaque effet et chaque lumière connus de
## Godot et offerts par leur bouton, le coup d'un canon joué, le souffle de feu qui pose sa nappe sur chaque case de sa
## zone, la flamme qui pose un seul foyer sur la cible, puis le trébuchet choisi qui attaque.
func _vitrine(atelier: Node, pont: PontFige, cles: Array, lu: Dictionary) -> void:
	var vitrine: Dictionary = lu.vitrine
	var attaquer := _controle_par_nom(atelier, "Attaquer") as Button
	_verifier(attaquer.disabled, "la caraque n'attaque pas, « Attaquer » doit être grisé")
	var effets: Array = vitrine.attaques.values()
	var cles_des_boutons: Array[String] = []
	for famille in [vitrine.armes, vitrine.sorts]:
		for entree in famille:
			for variante in entree.variantes:
				effets.append(variante.effet)
				cles_des_boutons.append("effet/%s/%s" % [entree.id, variante.variante])
	for famille in [["manoeuvre", vitrine.manoeuvres], ["souffle", vitrine.souffles], ["son", vitrine.sons]]:
		for entree in famille[1]:
			effets.append(entree.effet)
			cles_des_boutons.append("%s/%s" % [famille[0], entree.id])
	for effet in effets:
		_connu(effet)
	for lumiere in vitrine.lumieres:
		cles_des_boutons.append("lumiere/%s" % lumiere.id)
		var source: Dictionary = lumiere.source
		_verifier(source.visuel == null or Foyer.FLAMMES.has(source.visuel), "visuel de lumière inconnu de Godot : %s" % source.visuel)
		if source.son != null:
			_connu({quoi = "son", son = source.son})
	for cle in cles_des_boutons:
		_controle(atelier, cle)
	(_controle_par_nom(atelier, "OngletEffets") as Button).pressed.emit()
	(_controle(atelier, "effet/canon/touche") as Button).pressed.emit()
	var noeud_des_effets := atelier.get_node("Effets")
	_verifier(noeud_des_effets.get_node_or_null("eclair-de-bouche") != null and noeud_des_effets.get_node_or_null("boulet") != null, "le canon de la vitrine : ni éclair de bouche ni boulet (%s)" % [noeud_des_effets.get_children().map(func(n: Node) -> String: return n.name)])
	await _images(2)
	_verifier((atelier.get_node("Cible") as Node3D).visible, "la cible de la vitrine cachée sur l'onglet Effets")
	var souffle: Dictionary = vitrine.souffles.filter(func(s: Dictionary) -> bool: return s.id == "feu")[0].effet
	(_controle(atelier, "souffle/feu") as Button).pressed.emit()
	await create_timer(souffle.trajet.dureeS + 0.2).timeout
	var nappes := noeud_des_effets.get_children().filter(func(n: Node) -> bool: return n.name.begins_with("nappe-de-flammes"))
	_verifier(nappes.size() == souffle.cases.size(), "le souffle de feu de la vitrine : %d nappes de flammes, une par case attendue" % nappes.size())
	(_controle(atelier, "lumiere/flamme") as Button).pressed.emit()
	(_controle(atelier, "lumiere/flamme") as Button).pressed.emit()
	var foyers := atelier.get_node("Cible").get_children().filter(func(n: Node) -> bool: return n is Foyer)
	_verifier(foyers.size() == 1 and foyers[0].get_node_or_null("feu") != null and foyers[0].get_node_or_null("son-crepitement") != null, "la flamme de la vitrine : un seul foyer, son feu et son crépitement attendus sur la cible")
	var trebuchet := _bouton(atelier, lu.modeles.libelles[lu.modeles.vehicules["trebuchet-ade2"]])
	_verifier(trebuchet != null, "le trébuchet a sa bascule à côté des bases")
	if trebuchet == null:
		return
	trebuchet.pressed.emit()
	await _etape(atelier, pont, cles, 7, "trébuchet choisi")
	_verifier(not attaquer.disabled, "le trébuchet posé attaque, « Attaquer » doit être actif")
	attaquer.pressed.emit()
	await _images(2)
	var montage := atelier.get_node("Vehicule") as MontageDeVehicule
	_verifier(montage.lecteur != null and montage.lecteur.current_animation == montage.clips.get("ranged"), "le trébuchet ne joue pas son clip de tir")
	_verifier(noeud_des_effets.get_node_or_null("pierre") != null, "la pierre du trébuchet ne vole pas")
	await create_timer(ECLATS_ETEINTS_S).timeout


## Chaque phase de l'effet `effet` d'un visuel que `Effets.GERBES` dessine, son trajet d'un projectile que
## `Effets.PROJECTILES` forme, et chaque son de fichiers posés sous `res://sons/`.
func _connu(effet: Dictionary) -> void:
	var sons: Array = []
	if effet.quoi == "son":
		sons.append(effet.son)
	for cle in ["depart", "arrivee", "nappe"]:
		var phase: Variant = effet.get(cle)
		if phase == null:
			continue
		_verifier(phase.visuel == null or Effets.GERBES.has(phase.visuel), "visuel inconnu de Godot : %s" % phase.visuel)
		if phase.son != null:
			sons.append(phase.son)
	var trajet: Variant = effet.get("trajet")
	_verifier(trajet == null or Effets.PROJECTILES.has(trajet.projectile), "projectile inconnu de Godot : %s" % [null if trajet == null else trajet.projectile])
	for son in sons:
		for fichier in son.fichiers:
			_verifier(FileAccess.file_exists("res://sons/%s" % fichier), "son %s : res://sons/%s absent" % [son.id, fichier])


## Le contrôle nommé `nom` sous `atelier`.
func _controle_par_nom(atelier: Node, nom: String) -> Control:
	return atelier.get_node("Interface").find_child(nom, true, false) as Control


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
