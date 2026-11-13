extends SceneTree

## Aucun corps sans modèles retenus (#3935, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D ») : le combat
## (`scenes/Combat.tscn`, `scripts/combat.gd`) ouvert sur un pont figé dont l'index des modèles est refusé ne retient
## rien (les modèles retenus avant lui restent), dit le refus dans son avis de panne et n'entre pas en partie : il ne
## demande jamais `demarrer`. Un listage qui ne s'est pas lu (`MontageDeComposition.lister` le rend vide) n'est jamais
## indexé : `indexer` le rend en panne (`{}`) sans appeler le pont.

const RECETTE_AUTONOME := true
const COMBAT := "res://scenes/Combat.tscn"
## Les images laissées au combat pour entrer en partie s'il le faisait.
const IMAGES_D_ATTENTE := 30
const REFUS := "index refusé"
## Les modèles retenus avant le combat, et la forme de leur listage.
const RETENUS := {ok = true, fichiers = {humanoide = {glb = "humanoide.glb"}}}
const FORME := "glb"
var _fautes: Array[String] = []


## Le pont figé du combat : un listage lisible, un index refusé, la partie de l'adresse figée ; il garde chaque méthode
## appelée et n'expose rien à une page qu'il n'a pas.
class PontDeLIndexRefuse extends PontFige:
	var appels: Array[String] = []

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		appels.append(methode)
		return super(methode, entree)

	func exposer(_nom: String, _rappel: Callable) -> void:
		pass


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[modeles-non-retenus] version=", Engine.get_version_info().string)
	MontageDeComposition.retenir_les_modeles(RETENUS, {forme = FORME})
	var pont := PontDeLIndexRefuse.new({
		listage = {manifestes = {}, osDesRigides = {}, erreurs = [], forme = FORME},
		modeles = {ok = false, erreur = {categorie = "validation", message = REFUS}},
		parametres = {scenario = "dome"},
	})
	PontDuNoyau.remplacer(self, pont)
	var combat: Node = (load(COMBAT) as PackedScene).instantiate()
	root.add_child(combat)
	for image in IMAGES_D_ATTENTE:
		await process_frame
	_verifier(pont.appels.count("modeles") == 1, "`modeles` appelé %d fois, attendu une : %s" % [pont.appels.count("modeles"), pont.appels])
	_verifier(not pont.appels.has("demarrer"), "le combat entre en partie sans modèles retenus : %s" % [pont.appels])
	_verifier(MontageDeComposition.modeles == RETENUS and MontageDeComposition.forme == FORME, "l'index refusé a été retenu : %s, forme %s" % [MontageDeComposition.modeles, MontageDeComposition.forme])
	_verifier((combat.get("_panne") as Label).text == REFUS, "l'avis de panne dit « %s », attendu « %s »" % [(combat.get("_panne") as Label).text, REFUS])
	_verifier(MontageDeComposition.indexer(pont, {}).is_empty(), "un listage vide est indexé")
	_verifier(pont.appels.count("modeles") == 1, "un listage vide fait appeler `modeles` au pont : %s" % [pont.appels])
	combat.queue_free()
	await process_frame
	for faute in _fautes:
		push_error("[modeles-non-retenus] " + faute)
	print("[modeles-non-retenus] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _verifier(vrai: bool, faute: String) -> void:
	if not vrai:
		_fautes.append(faute)
