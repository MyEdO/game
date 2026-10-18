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
