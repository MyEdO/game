# Contrat du pont `wfrpPont` (prototype #2793, branche `poc/godot`)

Fixé par l'orchestrateur le 2026-10-18. Les deux lots (pont TypeScript, projet Godot) le respectent à la lettre ; un écart se rapporte, il ne s'improvise pas.

## Transport

- `globalThis.wfrpPont` est un objet dont CHAQUE méthode prend au plus UN argument, une CHAÎNE JSON, et rend TOUJOURS une CHAÎNE JSON. Aucun objet JS vivant ne traverse le pont ; GDScript appelle `pont.methode(JSON.stringify(entree))` et décode par `JSON.parse_string`.
- Toute réponse a la forme `{ "ok": true, ... }` ou `{ "ok": false, "erreur": Erreur }`.
- Une méthode du pont NE LÈVE JAMAIS (enveloppe `try/catch` unique, une seule fonction d'enveloppe pour toutes les méthodes). Seule exception : `sondeExceptionNue`, qui existe pour mesurer ce que GDScript reçoit quand le JS lève.

```ts
type Erreur = {
  nature: 'refus' | 'entree' | 'etat' | 'exception'; // refus = la règle interdit le geste ; entree = JSON ou id invalide ; etat = partie non démarrée / combattant hors de combat ; exception = levée inattendue
  action: { methode: string; entree: unknown };      // ce qui était tenté
  message: string;
  pile?: string;                                     // stack JS si exception
  partiels?: unknown;                                // ce qui avait été calculé avant l'échec (ex. l'AttackResult avant application)
};
```

## Vue (rendue par toute méthode qui touche la partie)

```ts
type Vue = {
  pont: 1;
  round: number;
  actif: string | null;        // id du combattant dont c'est le tour
  ordre: string[];             // ordre d'initiative (initiativeOrder), ids
  combattants: {
    id: string; libelle: string; camp: 'heros' | 'adversaires';
    blessures: number; blessuresMax: number;
    avantage: number;
    etats: { id: string; valeur: number }[];
    mouvement: number;         // cases autorisées pour un déplacement (effectiveMovement)
    aDeplace: boolean; aAttaque: boolean;
    horsDeCombat: boolean;
  }[];
  journal: string[];           // 20 dernières lignes
  issue: null | 'victoire' | 'defaite';
};
```

## Méthodes

| Méthode | Entrée | Réponse `ok: true` |
|---|---|---|
| `version()` | — | `{ ok, pont: 1 }` |
| `demarrer(e)` | `{ graine: number }` | `{ ok, vue }` — 4 héros = les 4 premiers de `makePregens()`, 2 adversaires `brigand` |
| `vue()` | — | `{ ok, vue }` |
| `deplacer(e)` | `{ id: string, cases: number }` | `{ ok, vue }` ; refus si pas son tour, déjà déplacé, `cases > mouvement` |
| `attaquer(e)` | `{ attaquant: string, cible: string }` | `{ ok, vue, resultat }` ; refus si pas son tour, déjà attaqué, cible hors de combat ou du même camp. L'ADJACENCE est de la géométrie : Godot ne propose l'attaque qu'au contact. |
| `finDeTour()` | — | `{ ok, vue }` — passe au suivant non hors de combat, nouveau round au bouclage |
| `simulerAttaque(e)` | `{ attaquant, cible, graine: number }` | `{ ok, resultat }` — résolution sur des COPIES, n'altère pas la partie (mesure du pont) |
| `erreursGlobales()` | — | `{ ok, erreurs: { message, source? }[] }` — `window.onerror` et `unhandledrejection` capturés depuis le dernier appel, puis vidés |
| `sondeExceptionNue()` | — | LÈVE `new Error('sonde-exception-nue')` sans enveloppe |

```ts
type Resultat = {
  touche: boolean;
  jetAttaque: number; cibleAttaque?: number; drAttaque?: number;
  jetDefense?: number; cibleDefense?: number; drDefense?: number;
  drNet: number; localisation?: string; degats?: number; blessuresPerdues?: number; critique: boolean;
  critiques: { libelle: string; localisation: string; mortel: boolean }[]; // Blessures critiques subies par la cible, dans l'ordre
  mortSubite: boolean;          // Mort subite appliquée à la cible
  journal: string;              // AttackResult.log
};
```

`attaquer` et `simulerAttaque` encaissent le coup par la chaîne des Blessures critiques du jeu (`src/state/combatFlow.ts:2721-2879`) : Blessures du coup, Mort subite, puis chaque Blessure critique jusqu'à la première mortelle. Les lignes de l'encaissement suivent `journal` dans le journal de la partie.

## Natures produites côté Godot (`projet/scripts/pont.gd`)

Le pont TypeScript ne produit que les quatre natures du type `Erreur`. `pont.gd` en ajoute deux, de même forme (`nature`, `action`, `message`, `partiels`), qu'il émet par le signal `erreur_pont` après un `push_error("[pont] …")` (`pont.gd:106-108`) ; `combat.gd:40` les branche sur le panneau « Erreur du pont » (`interface.gd:99`). Une erreur `refus` reçue du JS part par le signal `refus` (`pont.gd:95-96`) ; toute autre nature JS est relayée telle quelle par `erreur_pont` (`pont.gd:97-98`).

| Nature | Construite à | Déclencheur | `action` | `partiels` |
|---|---|---|---|---|
| `transport` | `pont.gd:102-103` | `globalThis.wfrpPont` toujours absent `DELAI_ATTENTE_MS` (10 s) après le lancement : `wfrp-pont.js` non chargé (`pont.gd:21-28`) | `{ methode: 'get_interface', entree: 'wfrpPont' }` | `null` |
| `transport` | `pont.gd:102-103` | réponse `null` d'une méthode (`pont.gd:76-77`) | méthode et entrée de l'appel | `null` |
| `transport` | `pont.gd:102-103` | réponse d'un autre type qu'une chaîne (`pont.gd:79-80`) | idem | la réponse convertie en texte |
| `transport` | `pont.gd:102-103` | chaîne non décodable en objet JSON (`pont.gd:82-84`) | idem | la chaîne reçue |
| `transport` | `pont.gd:102-103` | objet décodé sans champ `ok` (`pont.gd:87-88`) | idem | l'objet décodé |
| `transport` | `pont.gd:102-103` | `ok: false` sans objet `erreur` (`pont.gd:93-94`) | idem | l'objet décodé |
| `globale` | `pont.gd:54-61` | une entrée de `erreursGlobales()` (`window` `error` ou `unhandledrejection`, `pont.ts:518-525`) relevée après chaque `appeler` (`pont.gd:47-49`) et après les sondes de `mesures.gd:20` et `mesures.gd:68` ; une erreur par entrée | méthode et entrée de l'appel qui précède le relevé | `source` de l'entrée : `'unhandledrejection'`, `'<fichier>:<ligne>'` de l'`error` (`pont.ts:521`), ou `null` si l'`error` n'a pas de fichier |

Le relevé lui-même passe par `_verifier` (`pont.gd:55`) : une réponse défaillante de `erreursGlobales()` produit un `transport` de méthode `erreursGlobales`. `appeler_brut` (`pont.gd:41-43`) et `sonder_exception_nue` (`pont.gd:65-66`) ne produisent aucune de ces natures : ils servent la mesure et la sonde.

## Contrat de la modale d'attaque (#2870, fixé par l'orchestrateur le 2026-10-19)

Mêmes règles de transport que le reste du pont : une chaîne JSON en entrée au plus, une chaîne JSON `{ ok, ... }` en sortie, jamais de levée.

Le pont tient AU PLUS UNE attaque en cours, `enCours`. L'attaquant doit être le combattant actif, héros, n'ayant pas encore attaqué ce tour ; sinon `refus` (mêmes refus que `attaquer`).

```ts
type Mod = { libelle: string; valeur: number };          // un modificateur affiché en chip, valeur signée
type LigneAvant = {
  competence: string;                                    // libellé de la compétence de combat, ex. « Corps à corps (Base) »
  base: number;                                          // valeur de la compétence avant modificateurs
  cible: number;                                         // valeur cible finale, bornée 0-100
  difficulte: string;                                    // libellé de la Difficulté, ex. « Intermédiaire (+0) »
  mods: Mod[];
};
type Apercu = {
  titre: string;                                         // « Attaque »
  sousTitre: string;                                     // « <Héros> — Attaque (<Compétence>) »
  attaquant: { id: string; libelle: string; blessures: number; blessuresMax: number };
  cible:     { id: string; libelle: string; blessures: number; blessuresMax: number };
  arme: string;                                          // libellé de l'arme, ou « Mains nues »
  degats: number;                                        // dégâts affichés « Dégâts +N »
  localisations: { id: string | null; libelle: string }[]; // « Au hasard » (id null) puis les 6 localisations, libellé « Tête (−20) »
  localisation: string | null;                           // celle retenue
  attaque: LigneAvant;
  defense: { competence: string; mods: Mod[] } | null;   // défense probable, SANS valeur cible ; null si la cible ne se défend pas
};
type LigneApres = { competence: string; jet: number; cible: number; reussite: boolean; dr: number; mods: Mod[] };
type Jet = {
  attaque: LigneApres;
  defense: LigneApres | null;
  gagnant: 'attaquant' | 'defenseur';
  drNet: number;
  phrase: string;                                        // la phrase de touche ou d'échec, telle que le jeu l'écrit
  critique: boolean;
  influences: {
    relancer:  { possible: boolean; restants: number };  // Point de Chance pour relancer
    plusUnDR:  { possible: boolean; restants: number };  // Point de Chance pour +1 DR
  };
};
```

| Méthode | Entrée | Sortie `ok:true` | Effet |
|---|---|---|---|
| `apercuAttaque` | `{ attaquant, cible, localisation?: string \| null }` | `{ apercu: Apercu }` | Ouvre ou met à jour `enCours` (aucun jet). Rappelée quand la Localisation change. |
| `lancerAttaque` | aucune | `{ jet: Jet }` | Résout l'attaque de `enCours`, SANS l'appliquer. |
| `relancerAttaque` | aucune | `{ jet: Jet }` | Dépense 1 Point de Chance, relance le jet de l'attaquant, re-résout. |
| `chancePlusUnDR` | aucune | `{ jet: Jet }` | Dépense 1 Point de Chance, +1 DR à l'attaquant, re-résout. |
| `appliquerAttaque` | aucune | `{ resultat: Resultat, vue: Vue }` | Applique le jet de `enCours` (même effet que `attaquer`), vide `enCours`. |
| `annulerAttaque` | aucune | `{ vue: Vue }` | Vide `enCours` sans rien dépenser. Refusée après `lancerAttaque`. |

`attaquer` (chemin de l'IA) reste et passe par la même résolution et la même application, sans duplication.
