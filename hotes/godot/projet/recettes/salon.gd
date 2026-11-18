extends RecetteDuSalon

## Le panneau du salon (#3009, `PanneauDuSalon`, `hotes/godot/pont/CONTRAT.md`, section « L'écran de Godot ») sur le
## noyau vivant, le relay posé avant l'ouverture du transport sur un port local fermé (`VITE_RELAY_URL`) : aucun relay
## n'est joint. Le pont de la recette (`PontEspion`) délègue tout au pont vivant, sauf les réponses qu'on lui dicte.
## « Jouer en ligne » de l'accueil montre le panneau sans partie, « Héberger » refusé avec sa raison, « Rejoindre » et
## « Fermer » offerts ; « Fermer » rend l'accueil (G1). Un code mal formé : sa raison se lit au panneau, les formulaires
## de nouveau offerts, la minuterie arrêtée ; un code bien formé : « Connexion au salon… », « Quitter le salon » seul,
## la minuterie tourne et relève ; « Quitter le salon » rend les formulaires et « Fermer », la minuterie arrêtée ;
## « Fermer », puis « Jouer » ouvre une partie (G2). Dans la partie, « Jouer en ligne » du menu de la partie ouvre le
## panneau, « Héberger » finit sur le texte de son échec sans autre geste, la minuterie arrêtée ; « Fermer » cache le
## panneau sur la partie (G3). Une session finie pendant la partie (« Quitter le salon » dicté à `salon`, puis `{ quittee }` à `nouvelles`,
## la partie vivante quittée d'abord) recharge le combat sur le panneau sans partie, la ligne dictée et les zones
## vivantes montrées, la minuterie arrêtée ; « Fermer » rend l'accueil, où « Jouer » ouvre une partie (G4). Hors salon,
## aucun `nouvelles` en une seconde, et ni panne ni refus de bout en bout (G5). « Quitter le salon » dicté une fois à
## `salon`, une `Suite` de jeu le fait lire et la minuterie tourne, panneau fermé ; la `Suite` suivante relit le salon
## vivant et l'arrête ; rouvert, le panneau montre les formulaires (G6). Une session finie pendant la lecture de `salon`
## qui suit une `Suite` (la partie quittée, `{ quittee }` dicté à `nouvelles`, les zones vivantes) : la dernière relève
## de la minuterie qui s'arrête la lit, et le combat se recharge sur le panneau qui dit la ligne dictée (G7). Le code de
## sortie dit le verdict : 0 tenu, 1 une faute.

const RECETTE_AUTONOME := true
## La ligne qu'une session finie dicte (`quittee`).
const LIGNE := {type = "ligne", id = "fin-du-salon", ton = "alerte", texte = "Session finie (recette).", detail = null}


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var serveur := TCPServer.new()
	serveur.listen(0, "127.0.0.1")
	var relay := "http://127.0.0.1:%d" % serveur.get_local_port()
	serveur.stop()
	OS.set_environment("VITE_RELAY_URL", relay)
	_commencer("salon")
	print("[salon] relay posé sur un port fermé : ", relay)
	var quitte: Dictionary = {}
	if await _g1():
		quitte = await _g2()
	if not quitte.is_empty() and await _g3() and await _g4(quitte) and await _g5() and await _g6(quitte):
		await _g7(quitte)
	await _conclure()


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
	var quitte: Dictionary = _pont.reponses.get(Noyau.Methode.SALON, {}).duplicate(true)
	_verifier(_textes("Etat").has("Connexion au salon…"), "G2 (b) : « Connexion au salon… » ne se lit pas : %s" % [_textes("Etat")])
	_verifier(_releve(), "G2 (b) : la minuterie ne tourne pas pendant la jonction")
	if not await _attendre(func() -> bool: return _bouton("bouton/quitter", "Quitter le salon") != null and _bouton("formulaire/rejoindre", "Rejoindre") == null and _bouton("bouton/fermer", "Fermer") == null, "« Quitter le salon » seul pendant la jonction"):
		return {}
	var releves := _pont.appels.count(Noyau.Methode.NOUVELLES)
	await create_timer(1.0).timeout
	releves = _pont.appels.count(Noyau.Methode.NOUVELLES) - releves
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
	return quitte


## G3 : dans la partie, « Jouer en ligne » du menu de la partie ouvre le panneau ; « Héberger » finit sur le texte de l'échec de la room ;
## « Fermer » cache le panneau sur la partie.
func _g3() -> bool:
	var combat := current_scene
	if not await _frais():
		return false
	if not await _presser_au_menu("salon"):
		return false
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
	if not await _frais():
		return false
	var avant := current_scene.get_instance_id()
	_pont.dictees[Noyau.Methode.SALON] = func() -> Dictionary: return quitte.duplicate(true)
	if not await _presser_au_menu("salon"):
		return false
	_verifier(_releve(), "G4 : la minuterie ne tourne pas sur « Quitter le salon » dicté")
	if not await _attendre(func() -> bool: return _bouton("bouton/quitter", "Quitter le salon") != null, "« Quitter le salon » publié"):
		return false
	var ligne := LIGNE.duplicate()
	_pont.dictees[Noyau.Methode.NOUVELLES] = func() -> Dictionary:
		_pont.appeler(Noyau.Methode.QUITTER)
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
	var avant := _pont.appels.count(Noyau.Methode.NOUVELLES)
	await create_timer(1.0).timeout
	var releves := _pont.appels.count(Noyau.Methode.NOUVELLES) - avant
	_verifier(releves == 0, "G5 : %d `nouvelles` en une seconde hors salon" % releves)
	var avis: String = current_scene.get_node("Ecran/Interface/Avis/Panne").text
	_verifier(avis == "", "G5 : avis de panne du combat : %s" % avis.left(300))
	print("[salon] G5 : %d `nouvelles` hors salon en une seconde, %d signalés" % [releves, _signales.size()])
	return true


## G6 : toute `Suite` fait relire le salon, panneau fermé.
func _g6(quitte: Dictionary) -> bool:
	if not await _lancer_l_arene():
		return false
	_pont.dictees[Noyau.Methode.SALON] = func() -> Dictionary: return quitte.duplicate(true)
	_regarder()
	_verifier(_releve(), "G6 : la minuterie ne tourne pas après la `Suite` qui lit « Quitter le salon »")
	_verifier(not _panneau().racine().visible, "G6 : le panneau s'est ouvert")
	print("[salon] G6 : une `Suite` lit « Quitter le salon », minuterie %s" % ("en marche" if _releve() else "arrêtée"))
	_pont.dictees[Noyau.Methode.NOUVELLES] = func() -> Dictionary: return {ok = true, rien = true}
	if not await _attendre(func() -> bool: return not _pont.dictees.has(Noyau.Methode.NOUVELLES), "`{ rien }` dicté à la relève"):
		return false
	_regarder()
	_verifier(not _releve(), "G6 : la minuterie tourne après la `Suite` suivante, le salon vivant relu")
	print("[salon] G6 : la `Suite` suivante relit le salon vivant, minuterie %s" % ("en marche" if _releve() else "arrêtée"))
	if not await _frais():
		return false
	if not await _presser_au_menu("salon"):
		return false
	_verifier(_formulaire("heberger") != null and not _formulaire("heberger").disabled, "G6 : rouvert, le panneau ne montre pas « Héberger »")
	print("[salon] G6 : rouvert, les formulaires")
	return true


## G7 : la session finie pendant la lecture de `salon` qui suit une `Suite` (la partie quittée, la `quittee` déposée,
## les zones vivantes sans « Quitter le salon ») : la minuterie s'arrête sur une dernière relève, qui lit la `quittee`
## et recharge le combat sur le panneau qui en dit la ligne.
func _g7(quitte: Dictionary) -> void:
	if not await _frais():
		return
	_cliquer(_bouton("bouton/fermer", "Fermer"))
	var avant := current_scene.get_instance_id()
	_pont.dictees[Noyau.Methode.SALON] = func() -> Dictionary: return quitte.duplicate(true)
	_regarder()
	_verifier(_releve(), "G7 : la minuterie ne tourne pas après la `Suite` qui lit « Quitter le salon »")
	var ligne := LIGNE.duplicate()
	_pont.dictees[Noyau.Methode.SALON] = func() -> Dictionary:
		_pont.appeler(Noyau.Methode.QUITTER)
		_pont.dictees[Noyau.Methode.NOUVELLES] = func() -> Dictionary: return {ok = true, quittee = {lignes = [ligne]}}
		return _pont.appeler(Noyau.Methode.SALON)
	_regarder()
	if _pont.dictees.has(Noyau.Methode.NOUVELLES):
		_fautes.append("G7 : la `quittee` déposée pendant la lecture de `salon` n'est pas relevée, la minuterie arrêtée")
		return
	if not await _attendre(func() -> bool: return _au_combat() and current_scene.get_instance_id() != avant and _panneau().racine().visible and _textes("Journal").has(LIGNE.texte), "le combat rechargé sur le panneau, la ligne de la `quittee`"):
		return
	_verifier(current_scene.get("_vue").is_empty(), "G7 : le combat rechargé montre une partie")
	_verifier(not _releve(), "G7 : la minuterie tourne au panneau rechargé")
	print("[salon] G7 : la `quittee` déposée pendant `salon` relevée : %s, minuterie %s" % [_textes("Journal"), "en marche" if _releve() else "arrêtée"])


## La touche du regard (`changer_de_regard`) pressée, comme un joueur : un geste de jeu (`regarder`).
func _regarder() -> void:
	var touche := InputEventAction.new()
	touche.action = &"changer_de_regard"
	touche.pressed = true
	root.push_input(touche)
