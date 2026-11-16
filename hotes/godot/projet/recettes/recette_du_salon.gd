class_name RecetteDuSalon
extends SceneTree

## Ce que partagent les recettes du panneau du salon (`recettes/salon.gd`, `recettes/coop-hote.gd`,
## `recettes/coop-invite.gd`) : le pont de l'arbre remplacé par un `PontEspion`, les gestes d'un joueur (un clic au
## centre d'un bouton publié, une saisie dans un champ du panneau), les attentes bornées et le verdict, rendu en code
## de sortie : 0 tenu, 1 une faute.

const ACCUEIL := "res://scenes/Accueil.tscn"
const COMBAT := "res://scenes/Combat.tscn"
## L'attente la plus longue d'un état : le lancement du processus du noyau compris.
const ATTENTE_S := 120.0
var _fautes: Array[String] = []
## Chaque panne et chaque refus signalés par le pont.
var _signales: Array[String] = []
var _pont: PontEspion
## L'écran publié au dernier clic : un écran republié depuis porte ce que le clic a changé (`_frais`).
var _ecran_du_clic: Dictionary = {}
## Le préfixe des lignes que la recette écrit.
var _nom := ""
var _debut := 0


## La recette `nom` commencée : le pont espion à la place du pont de l'arbre, ses pannes et ses refus retenus, l'accueil
## à l'écran.
func _commencer(nom: String) -> void:
	_nom = nom
	_debut = Time.get_ticks_msec()
	print("[%s] version=%s" % [_nom, Engine.get_version_info().string])
	_pont = PontEspion.new()
	_pont.en_recette = true
	PontDuNoyau.remplacer(self, _pont)
	_pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	_pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	change_scene_to_file(ACCUEIL)


## La recette finie : la scène libérée, chaque faute et chaque signalement dits, le code de sortie posé.
func _conclure() -> void:
	_fautes.append_array(_signales)
	if current_scene != null:
		current_scene.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[%s] %s" % [_nom, faute])
	print("[%s] durée %d ms" % [_nom, Time.get_ticks_msec() - _debut])
	print("[%s] erreurs=%d" % [_nom, _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## Un pré-tiré recruté à son bouton, puis l'Arène lancée : si sa scène se pose, la pastille du menu de la partie publiée.
func _lancer_l_arene() -> bool:
	if not await _attendre(func() -> bool: return _recrue() != null, "un pré-tiré à recruter"):
		return false
	_cliquer(_recrue())
	if not await _attendre(func() -> bool: return _renvois() == 1 and _publie("bouton/lancer/arene") != null, "le pré-tiré recruté, « Lancer » de l'Arène"):
		return false
	_cliquer(_publie("bouton/lancer/arene"))
	if not await _attendre(func() -> bool: return _en_partie() and current_scene.get("_vue").projection.scene != null and _renvois() == 0, "la scène de l'Arène, le menu de la partie offert"):
		return false
	print("[%s] Arène lancée : scène %s" % [_nom, current_scene.get("_vue").projection.scene.id])
	return true


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


## Si le combat est la scène courante, une partie montrée, la pastille du menu de la partie publiée.
func _en_partie() -> bool:
	return _au_combat() and not current_scene.get("_vue").is_empty() and _publie("entite/menu") != null


## Le geste `geste` de la partie pressé dans son menu, ouvert à sa pastille : si le menu l'a offert.
func _presser_au_menu(geste: String) -> bool:
	_cliquer(_publie("entite/menu"))
	if not await _attendre(func() -> bool: return _publie("bouton/" + geste) != null, "« %s » au menu de la partie ouvert" % geste):
		return false
	_cliquer(_publie("bouton/" + geste))
	return true


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


## Le premier bouton publié qui dessine l'élément `element`, `null` sans lui.
func _publie(element: String) -> Variant:
	for bouton: Dictionary in _pont.ecran.get("boutons", []):
		if bouton.get("element") == element:
			return bouton
	return null


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
