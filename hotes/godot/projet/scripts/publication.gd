## La publication de l'écran d'une scène à la recette (`PontDuNoyau.publier_l_ecran`), attendue jusqu'à ce que son
## interface soit mise en page : à la première image entière où aucun de ses conteneurs n'a replacé ses enfants
## (`Container.sort_children`) ni aucune demande n'est venue. La première attente peut reprendre dans l'image de la
## demande, avant ses appels différés (`SceneTree.process_frame`) : un défilement ou un onglet joué dans cette image
## y aurait encore ses boutons à leur place d'avant. Une seule publication pour les demandes qui l'attendent ; rien
## hors recette (`PontDuNoyau.en_recette`), ni si la scène a quitté l'arbre entre-temps.
class_name PublicationDeLEcran
extends RefCounted

var _pont: PontDuNoyau
var _scene: Node
var _publie: Callable
## Si une publication attend que l'interface soit mise en page (`demander`).
var _attendue := false
## Si un conteneur de l'interface a placé ses enfants, ou si une publication a été demandée, depuis la dernière image.
var _remise_en_page := false


## La publication de ce que rend `publie` pour la scène `scene`, dont l'interface tient sous `interface`.
func _init(pont: PontDuNoyau, scene: Node, interface: Node, publie: Callable) -> void:
	_pont = pont
	_scene = scene
	_publie = publie
	if not pont.en_recette:
		return
	var suivre := func(noeud: Node) -> void:
		if noeud is Container and interface.is_ancestor_of(noeud) and not (noeud as Container).sort_children.is_connected(_remettre_en_page):
			(noeud as Container).sort_children.connect(_remettre_en_page)
	for conteneur in interface.find_children("*", "Container", true, false):
		suivre.call(conteneur)
	var arbre := scene.get_tree()
	arbre.node_added.connect(suivre)
	scene.tree_exited.connect(func() -> void:
		arbre.node_added.disconnect(suivre)
		_cesser_d_attendre(arbre))


func _remettre_en_page() -> void:
	_remise_en_page = true


## L'écran publié une fois l'interface mise en page.
func demander() -> void:
	if not _pont.en_recette or not _scene.is_inside_tree():
		return
	_remise_en_page = true
	if _attendue:
		return
	_attendue = true
	_scene.get_tree().process_frame.connect(_a_l_image)


func _cesser_d_attendre(arbre: SceneTree) -> void:
	if _attendue:
		arbre.process_frame.disconnect(_a_l_image)
		_attendue = false


func _a_l_image() -> void:
	if not _attendue:
		return
	if _remise_en_page:
		_remise_en_page = false
		return
	_cesser_d_attendre(_scene.get_tree())
	_pont.publier_l_ecran(_publie)
