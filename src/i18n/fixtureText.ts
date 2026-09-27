/**
 * TEXTE DE FIXTURE — L'OUTIL DES HARNAIS DE TEST (#1318 E7).
 *
 * AVEU TYPOLOGIQUE, énoncé d'abord parce que c'est le seul gain : ce module donne la MARQUE de type.
 * Il permet à une fixture de test de satisfaire les champs `PlayerText` (`CascadeStep.label`,
 * `ChoiceSpec.options[].label`, `SequenceRound.title`, les specs des 7 portes de `rollSeam`) sans
 * écrire un cast au call-site. Il ne LIBÈRE RIEN d'autre : le texte qu'un test pose ici reste du
 * français écrit en dur, hors catalogue, invisible à `setLocale` — la 2ᵉ langue des harnais n'est pas
 * ouverte par ce module et ne le sera pas par lui. Un texte qui doit VIVRE à l'écran passe par un
 * minteur (`t()`, `dataLabel`, `composeRollLabel`), jamais par ici.
 *
 * RÈGLE D'IMPORT — fichiers de TEST uniquement (`*.test.ts(x)`, `*.test-d.ts`). Un fichier de
 * production qui l'importe, ou qui l'appelle, est ROUGE NOMINATIF, sans gel ni tolérance : les deux
 * cliquets sont posés dans `state/player-text-ratchet.test.ts` (T4 : le chemin d'import, extension
 * comprise ; T5 : l'appel, sous TOUS ses bindings locaux — un alias n'est pas une porte).
 *
 * CE QUI SE PERD À CE PASSAGE, et qui se dit : le stock de fixtures FR des harnais N'EST PLUS BORNÉ.
 * Le fossile le tenait par un gel décroissant (138 appels, cible 0) ; ici, les tests sont libres de leur
 * outil. C'est le PRIX ASSUMÉ de l'extinction du fossile — les serrures T4/T5 gardent la FRONTIÈRE
 * prod/test, pas le VOLUME. Ce module distingue donc du fossile la nature du verrou, pas sa force :
 * le fossile gelait un stock de PRODUCTION en décroissance, celui-ci est muré par chemin d'import.
 *
 * Pourquoi un module distinct plutôt que le fossile prolongé : `rawText` portait une mort planifiée à 0
 * (registre des fossiles du #1318), et un stock de test qui ne descend pas l'aurait rendue fausse.
 * Séparer l'outil des harnais du fossile de production a rendu les deux comptes vrais — `src/i18n/rawText.ts`
 * est SUPPRIMÉ (#1318 E7-FINAL), et `fixtureText` reste, borné aux tests.
 */
import type { PlayerText } from './playerText';

/** Marque un libellé de FIXTURE (cf. JSDoc — tests uniquement, cliquets dans `player-text-ratchet.test.ts`). */
// eslint-disable-next-line murs/marques -- #1318 E7 : l'unique cast de ce module, réservé aux harnais et gardé par chemin d'import.
export const fixtureText = (s: string): PlayerText => s as PlayerText;
