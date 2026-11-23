class_name PontEspion
extends PontDuNoyau

## Le pont vivant des recettes du combat (`recettes/salon.gd`, `recettes/vision-du-combat.gd`) : il délègue chaque appel
## au noyau vivant, sauf la réponse dictée à sa méthode (`dictees`), rendue une fois ; il garde chaque méthode appelée,
## dans l'ordre, et la dernière réponse vivante de chacune. Son `scenario`, s'il en porte un, est le paramètre
## `scenario` du lancement.

var scenario := ""
var appels: Array[String] = []
var dictees := {}
var reponses := {}


func appeler(methode: String, entree: Variant = null) -> Dictionary:
	appels.append(methode)
	if dictees.has(methode):
		var dictee: Callable = dictees[methode]
		dictees.erase(methode)
		return dictee.call()
	var reponse := super(methode, entree)
	reponses[methode] = reponse
	return reponse


func parametre(cle: String) -> String:
	return scenario if cle == "scenario" and not scenario.is_empty() else super(cle)
