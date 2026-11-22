# Warhammer Fantasy — RPG tactique au tour par tour

Jeu de rôle vidéoludique en français, web d’abord, basé sur Warhammer Fantasy Roleplay.
Un groupe de quatre aventuriers traverse la campagne impériale *L’Ennemi Intérieur*.
Godot porte le jeu en export Web et au bureau, avec la création de personnages,
les sauvegardes, la coop en ligne, l’éditeur de campagne et le Compendium.

Les règles sont vérifiées dans les livres autorisés sous `Source/`. Le Compendium Godot
édite la base de jeu dans `src/data/`. [Sources VF](docs/sources-vf.md)

## Démarrage

```bash
npm ci
npm run godot:ouvrir
```

`npm test` joue la suite de tests. `npm run typecheck` vérifie les types.
`npm run docs:build` produit les références générées et `npm run docs:check` les vérifie.

Sous Linux, les commandes supervisées de push et de publication s’appuient sur `python3`
et sa bibliothèque standard. Sous Windows, elles utilisent Windows PowerShell.

## Architecture

| Chemin | Rôle |
|---|---|
| `hotes/godot/` | Jeu Godot et pont JSON du noyau |
| `src/engine/` | Règles WFRP pures |
| `src/noyau/` | Orchestration du jeu, modèle du monde et édition de campagne |
| `src/hote/` | Projections et services communs, dont sauvegardes et coop |
| `src/data/` et `src/scenes/` | Données du jeu et documents de campagne |
| `server/` | Relais WebSocket de la coop |

[Architecture du dépôt](docs/architecture.md)
