class_name PontEspion
extends PontDuNoyau

## Le pont vivant des recettes du combat (`recettes/salon.gd`, `recettes/vision-du-combat.gd`) : il délègue chaque appel
## au noyau vivant, sauf la réponse dictée à sa méthode (`dictees`), rendue une fois ; il garde chaque méthode appelée,
## dans l'ordre, et la dernière réponse vivante de chacune.

var appels: Array[Noyau.Methode] = []
var dictees := {}
var reponses := {}


func appeler(methode: Noyau.Methode, entree: Variant = null) -> Dictionary:
	appels.append(methode)
	if dictees.has(methode):
		var dictee: Callable = dictees[methode]
		dictees.erase(methode)
		return dictee.call()
	var reponse := super(methode, entree)
	reponses[methode] = reponse
	return reponse
