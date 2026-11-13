## L'arbre d'états d'un corps (#3949, #4081) : la machine `animation/corps.tres`, dont chaque état joue, sous le nom de
## son rôle, le clip que le modèle branché donne à ce rôle, et passe d'un état à l'autre par un fondu réglé dans
## l'éditeur. Le combattant du plateau (`Combattant`) et l'atelier (« Parcourir un chemin », « Attaquer ») le branchent
## sur le lecteur de leur modèle (`brancher`) ; chaque image où l'état courant change, retour automatique au repos
## compris, la pose le suit (`suivre`), puis `suivi` laisse l'hôte poser ce qui lui est propre.
class_name EtatsDuCorps
extends AnimationTree

## La pose a suivi l'état joué (`suivre`) : état neuf ou tenue neuve.
signal suivi

## Les rôles d'animation (`ROLES_D_ANIMATION`, `src/noyau/animation.ts`) que ses états jouent.
const REPOS := "repos"
const MARCHE := "marche"
const ATTAQUE := "melee"
const TIR := "tir"
const COUP := "coup"
const MORT := "mort"
const ROLES := [REPOS, MARCHE, ATTAQUE, TIR, COUP, MORT]
## La bibliothèque du lecteur branché qui porte, sous le nom de chaque rôle, le clip que l'état de ce rôle joue.
const BIBLIOTHEQUE := "role"
## Par rôle, la boucle de son alias : le repos et la marche bouclent, l'attaque, le tir et le coup jouent une fois puis
## reviennent au repos, quelle que soit la boucle de leur clip au lecteur (#4081) ; la mort garde celle de son clip.
const BOUCLES := {REPOS: Animation.LOOP_LINEAR, MARCHE: Animation.LOOP_LINEAR, ATTAQUE: Animation.LOOP_NONE, TIR: Animation.LOOP_NONE, COUP: Animation.LOOP_NONE}

## Le lecteur branché (`null` : aucun) et, pour un rôle, le clip que ce lecteur lui donne (`""` : aucun).
var _lecteur: AnimationPlayer = null
var _clip_du_role := Callable()
## Par rôle, le clip dont la bibliothèque `BIBLIOTHEQUE` du lecteur branché porte l'alias (`""` : aucun).
var _alias := {}
## L'état que la pose suit (`suivre`).
var _etat_suivi := &""


func _process(_delta: float) -> void:
	if active and lecture().get_current_node() != _etat_suivi:
		suivre()


## La lecture de sa machine : l'état courant, l'état quitté pendant un fondu.
func lecture() -> AnimationNodeStateMachinePlayback:
	return get("parameters/playback")


## Branché sur `lecteur`, les pistes résolues depuis la racine de ce lecteur, sa bibliothèque `BIBLIOTHEQUE` propre à ce
## lecteur (les corps d'un même modèle partagent leurs clips, `MontageDeComposition.scene_du_modele`) reposée en entier
## depuis `clip_du_role` (`suivre`), puis l'état du rôle `role` gagné ; `lecteur` `null`, inactif et débranché.
func brancher(lecteur: AnimationPlayer, clip_du_role := Callable(), role := REPOS) -> void:
	active = false
	_alias.clear()
	_lecteur = lecteur
	_clip_du_role = clip_du_role
	if lecteur == null:
		anim_player = NodePath()
		return
	if not lecteur.has_animation_library(BIBLIOTHEQUE):
		lecteur.add_animation_library(BIBLIOTHEQUE, AnimationLibrary.new())
	root_node = get_path_to(lecteur.get_node(lecteur.root_node))
	anim_player = get_path_to(lecteur)
	suivre()
	jouer(role)


## La pose suit l'état joué : actif sur le lecteur branché, chaque alias de `BIBLIOTHEQUE` reposé depuis le clip de son
## rôle, à la boucle de son rôle (`BOUCLES`, une copie quand le clip du lecteur n'y est pas), aucun pour un rôle sans
## clip ; le clip de l'état courant marqué au lecteur (`assigned_animation`, sans lecture), puis `suivi`. Remplacer
## l'alias de l'état courant le rejoue sous la nouvelle tenue.
func suivre() -> void:
	if _lecteur == null:
		return
	active = true
	var roles := _lecteur.get_animation_library(BIBLIOTHEQUE)
	for role: String in ROLES:
		var nom: String = _clip_du_role.call(role)
		if _alias.has(role) and _alias[role] == nom:
			continue
		_alias[role] = nom
		if roles.has_animation(role):
			roles.remove_animation(role)
		if not _lecteur.has_animation(nom):
			continue
		var clip := _lecteur.get_animation(nom)
		var boucle: int = BOUCLES.get(role, clip.loop_mode)
		if clip.loop_mode != boucle:
			clip = clip.duplicate() as Animation
			clip.loop_mode = boucle
		roles.add_animation(role, clip)
	_etat_suivi = lecture().get_current_node()
	var engage: String = _clip_du_role.call(_etat_suivi)
	if _lecteur.has_animation(engage):
		_lecteur.assigned_animation = engage
	suivi.emit()


## L'état du rôle `role` gagné (`travel`), si le lecteur branché porte son alias.
func jouer(role: String) -> void:
	if active and _lecteur.has_animation(BIBLIOTHEQUE + "/" + role):
		lecture().travel(role)
