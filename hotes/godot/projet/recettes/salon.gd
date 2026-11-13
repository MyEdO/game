extends SceneTree

## Le panneau du salon (#3009, `PanneauDuSalon`, `hotes/godot/pont/CONTRAT.md`, section « L'écran de Godot ») sur le
## noyau vivant, le relay posé avant l'ouverture du transport sur un port local fermé (`VITE_RELAY_URL`) : aucun relay
## n'est joint. Le pont de la recette délègue tout au pont vivant, sauf les réponses qu'on lui dicte, chacune une fois.
## « Jouer en ligne » de l'accueil montre le panneau sans partie, « Héberger » refusé avec sa raison, « Rejoindre » et
## « Fermer » offerts ; « Fermer » rend l'accueil (G1). Un code mal formé : sa raison se lit au panneau, les formulaires
## de nouveau offerts, la minuterie arrêtée ; un code bien formé : « Connexion au salon… », « Quitter le salon » seul,
## la minuterie tourne et relève ; « Quitter le salon » rend les formulaires et « Fermer », la minuterie arrêtée ;
## « Fermer », puis « Jouer » ouvre une partie (G2). Dans la partie, « Jouer en ligne » ouvre le panneau, « Héberger »
## finit sur le texte de son échec sans autre geste, la minuterie arrêtée ; « Fermer » cache le panneau sur la partie
## (G3). Une session finie pendant la partie (« Quitter le salon » dicté à `salon`, puis `{ quittee }` à `nouvelles`,
## la partie vivante quittée d'abord) recharge le combat sur le panneau sans partie, la ligne dictée et les zones
## vivantes montrées, la minuterie arrêtée ; « Fermer » rend l'accueil, où « Jouer » ouvre une partie (G4). Hors salon,
## aucun `nouvelles` en une seconde, et ni panne ni refus de bout en bout (G5). « Quitter le salon » dicté une fois à
## `salon`, une `Suite` de jeu le fait lire et la minuterie tourne, panneau fermé ; la `Suite` suivante relit le salon
## vivant et l'arrête ; rouvert, le panneau montre les formulaires (G6). Le code de sortie dit le verdict : 0 tenu, 1
## une faute.

const RECETTE_AUTONOME := true
const ACCUEIL := "res://scenes/Accueil.tscn"
const COMBAT := "res://scenes/Combat.tscn"
## L'attente la plus longue d'un état : le lancement du processus du noyau compris.
const ATTENTE_S := 120.0
## La ligne qu'une session finie dicte (`quittee`).
const LIGNE := {type = "ligne", id = "fin-du-salon", ton = "alerte", texte = "Session finie (recette).", detail = null}
var _fautes: Array[String] = []
## Chaque panne et chaque refus signalés par le pont.
var _signales: Array[String] = []
var _pont: PontDeRecette
## L'écran publié au dernier clic : un écran republié depuis porte ce que le clic a changé (`_frais`).
var _ecran_du_clic: Dictionary = {}


## Le pont de la recette : il délègue chaque appel au pont vivant (`PontDuNoyau`), sauf la réponse dictée à sa méthode
## (`dictees`), rendue une fois ; il garde chaque méthode appelée et la dernière réponse vivante de chacune.
class PontDeRecette extends PontDuNoyau:
	var appels: Array[String] = []
	var dictees := {}
	var derniers := {}

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		appels.append(methode)
		if dictees.has(methode):
			var dictee: Callable = dictees[methode]
			dictees.erase(methode)
			return dictee.call()
		var reponse := super(methode, entree)
		derniers[methode] = reponse
		return reponse

	## L'appel `methode` au pont vivant, hors des dictées et des appels gardés.
	func deleguer(methode: String, entree: Variant = null) -> Dictionary:
		return super.appeler(methode, entree)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var debut := Time.get_ticks_msec()
	print("[salon] version=", Engine.get_version_info().string)
	var serveur := TCPServer.new()
	serveur.listen(0, "127.0.0.1")
	var relay := "http://127.0.0.1:%d" % serveur.get_local_port()
	serveur.stop()
	OS.set_environment("VITE_RELAY_URL", relay)
	print("[salon] relay posé sur un port fermé : ", relay)
	_pont = PontDeRecette.new()
	_pont.en_recette = true
	PontDuNoyau.remplacer(self, _pont)
	_pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	_pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	change_scene_to_file(ACCUEIL)
	var quitte: Dictionary = {}
	if await _g1():
		quitte = await _g2()
	if not quitte.is_empty() and await _g3() and await _g4(quitte) and await _g5():
		await _g6(quitte)
	_fautes.append_array(_signales)
	if current_scene != null:
		current_scene.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[salon] " + faute)
	print("[salon] durée %d ms" % (Time.get_ticks_msec() - debut))
	print("[salon] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## G1 : « Jouer en ligne » de l'accueil, le panneau sans partie ; « Fermer » rend l'accueil.
func _g1() -> bool:
	if not await _attendre(func() -> bool: return _au_menu() and _bouton("bouton/salon", "Jouer en ligne") != null, "« Jouer en ligne » à l'accueil"):
		return false
	_cliquer(_bouton("bouton/salon", "Jouer en ligne"))
	if not await _attendre(func() -> bool: return _au_combat() and _bouton("formulaire/rejoindre", "Rejoindre") != null and _bouton("bouton/fermer", "Fermer") != null, "le panneau sans partie, « Rejoindre » et « Fermer » offerts"):
		return false
	var heberger := _formulaire("heberger")
	_verifier(heberger != null and heberger.disabled and heberger.tooltip_text != "", "G1 : « Héberger » sans partie n'est pas refusé avec sa raison")
	_verifier(current_scene.get("_vue").is_empty(), "G1 : le panneau s'ouvre sur une partie")
	print("[salon] G1 : panneau sans partie, « Héberger » refusé : %s" % (heberger.tooltip_text if heberger != null else "?"))
	_cliquer(_bouton("bouton/fermer", "Fermer"))
	if not await _attendre(func() -> bool: return _au_menu(), "l'accueil après « Fermer »"):
		return false
	print("[salon] G1 : « Fermer » rend l'accueil")
	return true


## G2 : rejoindre sur un code mal formé, puis sur un code bien formé, le relay injoignable, quitté ; une partie
## s'ouvre ensuite. Rend les zones vivantes de `salon` qui offrent « Quitter le salon », `{}` sur une faute.
func _g2() -> Dictionary:
	_cliquer(_bouton("bouton/salon", "Jouer en ligne"))
	if not await _attendre(func() -> bool: return _au_combat() and _bouton("formulaire/rejoindre", "Rejoindre") != null, "le panneau sans partie"):
		return {}
	_rejoindre("abc")
	_verifier(_textes("Journal").any(func(t: String) -> bool: return t != ""), "G2 (a) : la raison du code mal formé ne se lit pas au panneau")
	_verifier(not _releve(), "G2 (a) : la minuterie tourne après la jonction ratée")
	_verifier(_formulaire("rejoindre") != null and not _formulaire("rejoindre").disabled, "G2 (a) : « Rejoindre » n'est pas de nouveau offert")
	print("[salon] G2 (a) : %s ; minuterie %s" % [_textes("Journal"), "en marche" if _releve() else "arrêtée"])
	if not await _frais():
		return {}
	_rejoindre("ABCDEF")
	var quitte: Dictionary = _pont.derniers.get("salon", {}).duplicate(true)
	_verifier(_textes("Etat").has("Connexion au salon…"), "G2 (b) : « Connexion au salon… » ne se lit pas : %s" % [_textes("Etat")])
	_verifier(_releve(), "G2 (b) : la minuterie ne tourne pas pendant la jonction")
	if not await _attendre(func() -> bool: return _bouton("bouton/quitter", "Quitter le salon") != null and _bouton("formulaire/rejoindre", "Rejoindre") == null and _bouton("bouton/fermer", "Fermer") == null, "« Quitter le salon » seul pendant la jonction"):
		return {}
	var releves := _pont.appels.count("nouvelles")
	await create_timer(1.0).timeout
	releves = _pont.appels.count("nouvelles") - releves
	_verifier(releves >= 2, "G2 (b) : %d relève en une seconde de jonction" % releves)
	_verifier(_textes("Etat").has("Connexion au salon…"), "G2 (b) : la jonction ne tient plus après une seconde : %s" % [_textes("Etat")])
	print("[salon] G2 (b) : %s, « Quitter le salon » seul, %d relèves en une seconde" % [_textes("Etat"), releves])
	_cliquer(_bouton("bouton/quitter", "Quitter le salon"))
	_verifier(not _releve(), "G2 (b) : la minuterie tourne après « Quitter le salon »")
	if not await _attendre(func() -> bool: return _bouton("formulaire/rejoindre", "Rejoindre") != null and _bouton("bouton/fermer", "Fermer") != null, "les formulaires et « Fermer » après « Quitter le salon »"):
		return {}
	_cliquer(_bouton("bouton/fermer", "Fermer"))
	if not await _attendre(func() -> bool: return _au_menu() and _bouton("bouton/jouer", "Jouer") != null, "l'accueil après « Fermer »"):
		return {}
	_cliquer(_bouton("bouton/jouer", "Jouer"))
	if not await _attendre(func() -> bool: return _en_partie(), "une partie ouverte par « Jouer »"):
		return {}
	print("[salon] G2 : quitté, « Jouer » ouvre une partie")
	return quitte if await _lancer_l_arene() else {}


## G3 : dans la partie, « Jouer en ligne » ouvre le panneau ; « Héberger » finit sur le texte de l'échec de la room ;
## « Fermer » cache le panneau sur la partie.
func _g3() -> bool:
	var combat := current_scene
	_cliquer(_bouton("bouton/salon", "Jouer en ligne"))
	if not await _attendre(func() -> bool: return _formulaire("heberger") != null and not _formulaire("heberger").disabled and _bouton("formulaire/heberger", "Héberger") != null, "« Héberger » offert dans la partie"):
		return false
	_saisir("heberger/nom", "Hote")
	var clic := Time.get_ticks_msec()
	_cliquer(_bouton("formulaire/heberger", "Héberger"))
	if not await _attendre(func() -> bool: return not _releve() and _textes("Etat").size() == 1 and _textes("Etat")[0] not in ["", "Ouverture du salon…"], "le texte de l'échec de la room dans `salon.etat`, la minuterie arrêtée"):
		return false
	print("[salon] G3 : échec de la room en %d ms : %s ; minuterie arrêtée" % [Time.get_ticks_msec() - clic, _textes("Etat")])
	if not await _attendre(func() -> bool: return _bouton("bouton/fermer", "Fermer") != null, "« Fermer » après l'échec"):
		return false
	if not await _frais():
		return false
	_cliquer(_bouton("bouton/fermer", "Fermer"))
	_verifier(not _panneau().racine().visible, "G3 : « Fermer » ne cache pas le panneau")
	_verifier(current_scene == combat and _en_partie(), "G3 : la partie n'est plus montrée après « Fermer »")
	print("[salon] G3 : « Fermer » cache le panneau, la partie montrée")
	return true


## G4 : une session finie pendant la partie recharge le combat sur le panneau sans partie, qui dit la ligne dictée.
func _g4(quitte: Dictionary) -> bool:
	var avant := current_scene.get_instance_id()
	_pont.dictees.salon = func() -> Dictionary: return quitte.duplicate(true)
	_cliquer(_bouton("bouton/salon", "Jouer en ligne"))
	_verifier(_releve(), "G4 : la minuterie ne tourne pas sur « Quitter le salon » dicté")
	if not await _attendre(func() -> bool: return _publies("bouton/quitter").size() == 2, "« Quitter la partie » et « Quitter le salon » publiés"):
		return false
	var premier: Variant = _publie("bouton/quitter")
	print("[salon] G4 : bouton/quitter publiés dans l'ordre %s ; `_publie(\"bouton/quitter\")` de campagne.gd rend « %s »" % [_publies("bouton/quitter").map(func(b: Dictionary) -> String: return b.texte), premier.texte])
	var ligne := LIGNE.duplicate()
	_pont.dictees.nouvelles = func() -> Dictionary:
		_pont.deleguer("quitter")
		return {ok = true, quittee = {lignes = [ligne]}}
	if not await _attendre(func() -> bool: return _au_combat() and current_scene.get_instance_id() != avant and _panneau().racine().visible and _textes("Journal").has(LIGNE.texte) and _bouton("formulaire/rejoindre", "Rejoindre") != null, "le combat rechargé sur le panneau, la ligne dictée"):
		return false
	_verifier(current_scene.get("_vue").is_empty(), "G4 : le combat rechargé montre une partie")
	_verifier(_formulaire("heberger") != null and _formulaire("heberger").disabled, "G4 : « Héberger » n'est pas refusé sans partie")
	_verifier(not _releve(), "G4 : la minuterie tourne au panneau rechargé")
	_verifier(_pont.dictees.is_empty(), "G4 : des dictées restent : %s" % [_pont.dictees.keys()])
	print("[salon] G4 : combat rechargé, %s, minuterie arrêtée" % [_textes("Journal")])
	if not await _frais():
		return false
	_cliquer(_bouton("bouton/fermer", "Fermer"))
	if not await _attendre(func() -> bool: return _au_menu() and _bouton("bouton/jouer", "Jouer") != null, "l'accueil après « Fermer »"):
		return false
	_cliquer(_bouton("bouton/jouer", "Jouer"))
	if not await _attendre(func() -> bool: return _en_partie(), "une partie ouverte par « Jouer » après la session finie"):
		return false
	print("[salon] G4 : « Fermer » rend l'accueil, « Jouer » ouvre une partie")
	return true


## G5 : une partie locale laissée une seconde sans geste n'appelle pas `nouvelles` ; l'avis de panne reste vide.
func _g5() -> bool:
	var avant := _pont.appels.count("nouvelles")
	await create_timer(1.0).timeout
	var releves := _pont.appels.count("nouvelles") - avant
	_verifier(releves == 0, "G5 : %d `nouvelles` en une seconde hors salon" % releves)
	var avis: String = current_scene.get_node("Ecran/Interface/Avis/Panne").text
	_verifier(avis == "", "G5 : avis de panne du combat : %s" % avis.left(300))
	print("[salon] G5 : %d `nouvelles` hors salon en une seconde, %d signalés" % [releves, _signales.size()])
	return true


## G6 : toute `Suite` fait relire le salon, panneau fermé.
func _g6(quitte: Dictionary) -> void:
	if not await _lancer_l_arene():
		return
	_pont.dictees.salon = func() -> Dictionary: return quitte.duplicate(true)
	_regarder()
	_verifier(_releve(), "G6 : la minuterie ne tourne pas après la `Suite` qui lit « Quitter le salon »")
	_verifier(not _panneau().racine().visible, "G6 : le panneau s'est ouvert")
	print("[salon] G6 : une `Suite` lit « Quitter le salon », minuterie %s" % ("en marche" if _releve() else "arrêtée"))
	_pont.dictees.nouvelles = func() -> Dictionary: return {ok = true, rien = true}
	if not await _attendre(func() -> bool: return not _pont.dictees.has("nouvelles"), "`{ rien }` dicté à la relève"):
		return
	_regarder()
	_verifier(not _releve(), "G6 : la minuterie tourne après la `Suite` suivante, le salon vivant relu")
	print("[salon] G6 : la `Suite` suivante relit le salon vivant, minuterie %s" % ("en marche" if _releve() else "arrêtée"))
	if not await _frais():
		return
	_cliquer(_bouton("bouton/salon", "Jouer en ligne"))
	_verifier(_formulaire("heberger") != null and not _formulaire("heberger").disabled, "G6 : rouvert, le panneau ne montre pas « Héberger »")
	print("[salon] G6 : rouvert, les formulaires")


## Un pré-tiré recruté à son bouton, puis l'Arène lancée : si sa scène se pose, « Jouer en ligne » publié.
func _lancer_l_arene() -> bool:
	if not await _attendre(func() -> bool: return _recrue() != null, "un pré-tiré à recruter"):
		return false
	_cliquer(_recrue())
	if not await _attendre(func() -> bool: return _renvois() == 1 and _publie("bouton/lancer/arene") != null, "le pré-tiré recruté, « Lancer » de l'Arène"):
		return false
	_cliquer(_publie("bouton/lancer/arene"))
	if not await _attendre(func() -> bool: return _en_partie() and current_scene.get("_vue").projection.scene != null and _renvois() == 0, "la scène de l'Arène, « Jouer en ligne » publié"):
		return false
	print("[salon] Arène lancée : scène %s" % current_scene.get("_vue").projection.scene.id)
	return true


## La touche du regard (`changer_de_regard`) pressée, comme un joueur : un geste de jeu (`regarder`).
func _regarder() -> void:
	var touche := InputEventAction.new()
	touche.action = &"changer_de_regard"
	touche.pressed = true
	root.push_input(touche)


## Le code `code` saisi au formulaire « Rejoindre », sous le nom « Invite », et le formulaire pressé.
func _rejoindre(code: String) -> void:
	_saisir("rejoindre/code", code)
	_saisir("rejoindre/nom", "Invite")
	_cliquer(_bouton("formulaire/rejoindre", "Rejoindre"))


## Le panneau du salon du combat.
func _panneau() -> PanneauDuSalon:
	return current_scene.get_node("Salon")


## Si la minuterie du panneau relève.
func _releve() -> bool:
	return not (_panneau().get("_minuterie") as Timer).is_stopped()


## Le texte de chaque ligne de la pile `pile` du panneau (`Etat`, `Journal`).
func _textes(pile: String) -> Array:
	return _panneau().racine().get_node("Pile/" + pile).find_children("*", "Label", true, false).map(func(l: Label) -> String: return l.text)


## Le bouton du formulaire `verbe` au panneau, offert ou refusé ; `null` sans lui.
func _formulaire(verbe: String) -> Button:
	for bouton: Button in _panneau().racine().find_children("*", "Button", true, false):
		if bouton.is_visible_in_tree() and bouton.owner != null and bouton.owner.get_meta(Zone.META, "") == "formulaire/" + verbe:
			return bouton
	return null


## Le champ `id` d'un formulaire du panneau rempli de `texte`.
func _saisir(id: String, texte: String) -> void:
	for champ: LineEdit in _panneau().racine().find_children("*", "LineEdit", true, false):
		if champ.owner != null and champ.owner.get_meta(Zone.META, "") == "saisieTexte/" + id:
			champ.text = texte
			return
	_fautes.append("champ %s absent du panneau" % id)


## Si le combat est la scène courante, une partie montrée.
func _en_partie() -> bool:
	return _au_combat() and not current_scene.get("_vue").is_empty() and _bouton("bouton/salon", "Jouer en ligne") != null


func _au_combat() -> bool:
	return current_scene != null and current_scene.scene_file_path == COMBAT


func _au_menu() -> bool:
	return current_scene != null and current_scene.scene_file_path == ACCUEIL and _bouton("bouton/jouer", "Jouer") != null


## Le premier bouton publié d'un pré-tiré à recruter, `null` sans lui.
func _recrue() -> Variant:
	for bouton: Dictionary in _pont.ecran.get("boutons", []):
		if str(bouton.get("element", "")).begins_with("bouton/recruter/"):
			return bouton
	return null


## Le nombre de boutons publiés qui renvoient un héros du groupe.
func _renvois() -> int:
	return _pont.ecran.get("boutons", []).filter(func(b: Dictionary) -> bool: return str(b.get("element", "")).begins_with("bouton/renvoyer/")).size()


## Le bouton publié qui dessine l'élément `element` sous le texte `texte`, `null` hors de l'écran.
func _bouton(element: String, texte: String) -> Variant:
	for bouton: Dictionary in _pont.ecran.get("boutons", []):
		if bouton.get("element") == element and bouton.get("texte") == texte:
			return bouton
	return null


## Le premier bouton publié qui dessine l'élément `element`, comme `_publie` de `recettes/campagne.gd`.
func _publie(element: String) -> Variant:
	var publies := _publies(element)
	return null if publies.is_empty() else publies[0]


## Les boutons publiés qui dessinent l'élément `element`, dans l'ordre de la publication.
func _publies(element: String) -> Array:
	return _pont.ecran.get("boutons", []).filter(func(b: Dictionary) -> bool: return b.get("element") == element)


## Si l'écran se republie après le dernier clic, ses boutons à leur place d'après lui.
func _frais() -> bool:
	return await _attendre(func() -> bool: return not is_same(_pont.ecran, _ecran_du_clic), "l'écran republié après le dernier clic")


## Un clic gauche au centre du bouton publié `bouton`, comme un joueur.
func _cliquer(bouton: Dictionary) -> void:
	_ecran_du_clic = _pont.ecran
	for appuye in [true, false]:
		var clic := InputEventMouseButton.new()
		clic.button_index = MOUSE_BUTTON_LEFT
		clic.pressed = appuye
		clic.position = Vector2(bouton.x, bouton.y)
		clic.global_position = clic.position
		root.push_input(clic, true)


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)


## Si `tenu` se tient avant `ATTENTE_S` et avant toute panne ou tout refus signalé.
func _attendre(tenu: Callable, quoi: String) -> bool:
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _signales.is_empty():
		if tenu.call():
			return true
		await process_frame
	_fautes.append("attente échue : %s" % quoi)
	return false
