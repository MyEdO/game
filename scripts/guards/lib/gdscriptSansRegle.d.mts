/** Le script est-il le module de mise en page de l'hôte Godot, reconnu par sa structure. Contrat : en-tête de
 *  `gdscriptSansRegle.mjs`. */
export function estMiseEnPage(src: string): boolean;

/** Les calculs de règle d'un script GDScript (`hasard`, `chemin`, `calcul`, `ordre`, `mesure`), chacun avec sa ligne et
 *  son extrait. Familles et formes : en-tête de `gdscriptSansRegle.mjs`. */
export function calculsDeRegle(src: string): { famille: 'hasard' | 'chemin' | 'calcul' | 'ordre' | 'mesure'; ligne: number; extrait: string }[];
