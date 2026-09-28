// STOCK CLIQUETÉ des VUES de part hors slots de corps (#1082) — familles `parts/monster/defs/`
// (parts monstrueuses du bipède : têtes, bras, jambes) et `parts/elements/defs/` (catalogue
// d'apparence : cornes, ailes, oreilles, écailles…). Consommé par
// `src/gameIso/rig/parts/monster/rig-part-views.test.ts`. Frère de `rigPartViewStock.mjs`, qui
// couvre les slots de CORPS (tenues + armures) ; même patron whitelist-en-lib du dépôt.
//
// POURQUOI ces deux familles : elles ne passent pas par `resolveParts`. Leur repli est SILENCIEUX —
// `viewOrFront` (`parts/types.ts`) sert le front tel quel côté monstre ; côté éléments, le filtre
// `if (ov.view && ov.view !== view) continue` (`composeRig.tsx`) émet un overlay SANS `view` à
// l'identique dans les trois vues. Aucun cliquet ne les mesurait.
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : le `fichier` est le def de la part ou de
// l'élément (résolu par identité d'objet sur l'index généré, `registreDeDefs.ts`), la `ref` est la
// clé de vue ci-dessous. C'est le `fichier` que la porte de plage (`croissanceDesStocks`) voit : une
// clé nue lui est INVISIBLE, un append ne coûte alors rien.
//
// TROIS dimensions, réf `<famille>:<clé>:<vue>` (`monstre:<slot>:<clé>:<vue>` / `element:<clé>:<vue>`) :
//   - RIG_VIEW_FORMAT_RATCHET    : la vue n'est DÉCLARÉE nulle part (repli sur le front) ;
//   - RIG_VIEW_ALIAS_RATCHET     : vue déclarée, géométrie IDENTIQUE au front (`geometry`, pas la
//     chaîne : un espace, un commentaire, un `<g>` inerte ou un simple recolorage ne s'en échappent pas) ;
//   - RIG_VIEW_TRANSFORM_RATCHET : vue déclarée, géométrie différente, mais contenu du front réutilisé
//     sous une enveloppe `<g transform=…>` (ou inclus en sous-chaîne) — la silhouette est tournée,
//     l'occlusion n'est pas redessinée.
//
// La MESURE vit dans `scripts/guards/lib/partViewAudit.ts` (`auditRigPartViews`), partagée avec la
// garde et la régénération (`regenerations`) — deux lectures du pipeline divergeraient.
//
// CLIQUET, pas absolution : la garde échoue (a) sur toute violation ABSENTE de ces listes ; (b) sur
// toute entrée qui ne viole PLUS. Aucun PLAFOND : une entrée se solde en DESSINANT la vue, jamais en
// allongeant la liste — et l'allonger se voit à la porte de plage, parce que l'entrée nomme son def.
// La dimension TRANSFORM est un stock VIDE servi par la MÊME primitive : un cliquet tenu à zéro est
// un cliquet (`stock.mjs`), il rend ses `neuves` sans assertion d'absence particulière.
// Corps des trois listes GÉNÉRÉ par
// `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/partViewAudit.ts` : toute prose posée
// ENTRE les entrées est mangée à la régénération, l'explication vit dans cet en-tête.
//
// Ampleur à la pose (2026-08-04) : MONSTRE — 24 defs (20 têtes, 2 bras, 2 jambes), 8 vues non
// déclarées portées par 4 defs front-only (chèvre, fauve, griffe, tentacule = la totalité des slots
// bras+jambe ; les 20 têtes déclarent leurs 3 vues). ÉLÉMENTS — 70 defs dont 65 porteurs d'overlays,
// 115 vues non déclarées sur 130 possibles, + 4 vues déclarées aliasées (cornes de démon, cornes de
// taureau, queue de rat, queue : le `back` du registre APPENDAGES retombe sur le front, cf.
// `parts/appendages/index.ts`). Dimension TRANSFORM : 0 sur les deux familles.

export const RIG_VIEW_FORMAT_RATCHET = [
  { fichier: 'src/gameIso/rig/parts/elements/defs/articulation-supplementaire-aux-jambes.ts', ref: 'element:articulation-supplementaire-aux-jambes:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/articulation-supplementaire-aux-jambes.ts', ref: 'element:articulation-supplementaire-aux-jambes:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/barbe-naine.ts', ref: 'element:barbe-naine:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/beaute-surnaturelle.ts', ref: 'element:beaute-surnaturelle:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/beaute-surnaturelle.ts', ref: 'element:beaute-surnaturelle:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bec.ts', ref: 'element:bec:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bec.ts', ref: 'element:bec:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bicephale.ts', ref: 'element:bicephale:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bicephale.ts', ref: 'element:bicephale:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bouche-supplementaire.ts', ref: 'element:bouche-supplementaire:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bouche-supplementaire.ts', ref: 'element:bouche-supplementaire:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/branchies.ts', ref: 'element:branchies:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/branchies.ts', ref: 'element:branchies:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bras-elastiques.ts', ref: 'element:bras-elastiques:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bras-elastiques.ts', ref: 'element:bras-elastiques:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bras-multiples.ts', ref: 'element:bras-multiples:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/bras-multiples.ts', ref: 'element:bras-multiples:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/cornes-asymetriques.ts', ref: 'element:cornes-asymetriques:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/cornes-asymetriques.ts', ref: 'element:cornes-asymetriques:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/crane-pointu.ts', ref: 'element:crane-pointu:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/crane-pointu.ts', ref: 'element:crane-pointu:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/crete-sur-la-tete.ts', ref: 'element:crete-sur-la-tete:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/crete-sur-la-tete.ts', ref: 'element:crete-sur-la-tete:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/crocs.ts', ref: 'element:crocs:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/crocs.ts', ref: 'element:crocs:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/doigts-distendus.ts', ref: 'element:doigts-distendus:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/doigts-distendus.ts', ref: 'element:doigts-distendus:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/ecailles-epineuses.ts', ref: 'element:ecailles-epineuses:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/ecailles-epineuses.ts', ref: 'element:ecailles-epineuses:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/ecailles.ts', ref: 'element:ecailles:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/ecailles.ts', ref: 'element:ecailles:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/exophtalmie.ts', ref: 'element:exophtalmie:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/exophtalmie.ts', ref: 'element:exophtalmie:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/extremites-armees.ts', ref: 'element:extremites-armees:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/extremites-armees.ts', ref: 'element:extremites-armees:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/griffes.ts', ref: 'element:griffes:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/griffes.ts', ref: 'element:griffes:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/groin-poilu.ts', ref: 'element:groin-poilu:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/groin-poilu.ts', ref: 'element:groin-poilu:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/jambes-multiples.ts', ref: 'element:jambes-multiples:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/jambes-multiples.ts', ref: 'element:jambes-multiples:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/langue-pendante.ts', ref: 'element:langue-pendante:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/langue-pendante.ts', ref: 'element:langue-pendante:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/long-cou.ts', ref: 'element:long-cou:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/long-cou.ts', ref: 'element:long-cou:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/longs-bras.ts', ref: 'element:longs-bras:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/longs-bras.ts', ref: 'element:longs-bras:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/mains-et-pieds-a-ventouses.ts', ref: 'element:mains-et-pieds-a-ventouses:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/mains-et-pieds-a-ventouses.ts', ref: 'element:mains-et-pieds-a-ventouses:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/mauvais-oeil.ts', ref: 'element:mauvais-oeil:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/mauvais-oeil.ts', ref: 'element:mauvais-oeil:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/membres-rouges.ts', ref: 'element:membres-rouges:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/membres-rouges.ts', ref: 'element:membres-rouges:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/muscles-torse.ts', ref: 'element:muscles-torse:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/muscles-torse.ts', ref: 'element:muscles-torse:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/museau-chien.ts', ref: 'element:museau-chien:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/museau-chien.ts', ref: 'element:museau-chien:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/nuage-de-mouches.ts', ref: 'element:nuage-de-mouches:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/nuage-de-mouches.ts', ref: 'element:nuage-de-mouches:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/oeil-pedoncule.ts', ref: 'element:oeil-pedoncule:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/oeil-pedoncule.ts', ref: 'element:oeil-pedoncule:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/oeil-unique.ts', ref: 'element:oeil-unique:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/oeil-unique.ts', ref: 'element:oeil-unique:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pattes-d-oiseau.ts', ref: 'element:pattes-d-oiseau:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pattes-d-oiseau.ts', ref: 'element:pattes-d-oiseau:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pattes-danimaux.ts', ref: 'element:pattes-danimaux:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pattes-danimaux.ts', ref: 'element:pattes-danimaux:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/peau-ardente.ts', ref: 'element:peau-ardente:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/peau-ardente.ts', ref: 'element:peau-ardente:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/peau-brillante.ts', ref: 'element:peau-brillante:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/peau-brillante.ts', ref: 'element:peau-brillante:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/peau-herissee-de-pointes.ts', ref: 'element:peau-herissee-de-pointes:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/peau-herissee-de-pointes.ts', ref: 'element:peau-herissee-de-pointes:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pelage-massif.ts', ref: 'element:pelage-massif:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pelage-massif.ts', ref: 'element:pelage-massif:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pelage.ts', ref: 'element:pelage:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pelage.ts', ref: 'element:pelage:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pieds-palmes.ts', ref: 'element:pieds-palmes:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/pieds-palmes.ts', ref: 'element:pieds-palmes:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/plaie.ts', ref: 'element:plaie:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/plaie.ts', ref: 'element:plaie:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/plumage.ts', ref: 'element:plumage:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/plumage.ts', ref: 'element:plumage:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/plumes-eparses.ts', ref: 'element:plumes-eparses:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/plumes-eparses.ts', ref: 'element:plumes-eparses:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/sans-tete.ts', ref: 'element:sans-tete:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/sans-tete.ts', ref: 'element:sans-tete:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/suintement-de-pus.ts', ref: 'element:suintement-de-pus:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/suintement-de-pus.ts', ref: 'element:suintement-de-pus:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tentacule-epais.ts', ref: 'element:tentacule-epais:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tentacule-epais.ts', ref: 'element:tentacule-epais:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-aigle.ts', ref: 'element:tete-bestiale-aigle:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-aigle.ts', ref: 'element:tete-bestiale-aigle:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-araignee-geante.ts', ref: 'element:tete-bestiale-araignee-geante:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-araignee-geante.ts', ref: 'element:tete-bestiale-araignee-geante:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-chevre.ts', ref: 'element:tete-bestiale-chevre:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-chevre.ts', ref: 'element:tete-bestiale-chevre:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-ours.ts', ref: 'element:tete-bestiale-ours:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-ours.ts', ref: 'element:tete-bestiale-ours:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-rat.ts', ref: 'element:tete-bestiale-rat:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-rat.ts', ref: 'element:tete-bestiale-rat:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-sanglier.ts', ref: 'element:tete-bestiale-sanglier:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-sanglier.ts', ref: 'element:tete-bestiale-sanglier:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-serpent.ts', ref: 'element:tete-bestiale-serpent:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-bestiale-serpent.ts', ref: 'element:tete-bestiale-serpent:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-de-mort.ts', ref: 'element:tete-de-mort:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/tete-de-mort.ts', ref: 'element:tete-de-mort:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/trois-yeux.ts', ref: 'element:trois-yeux:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/trois-yeux.ts', ref: 'element:trois-yeux:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/verrues.ts', ref: 'element:verrues:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/verrues.ts', ref: 'element:verrues:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/visage-difforme.ts', ref: 'element:visage-difforme:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/visage-difforme.ts', ref: 'element:visage-difforme:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/visage-sans-traits.ts', ref: 'element:visage-sans-traits:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/visage-sans-traits.ts', ref: 'element:visage-sans-traits:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/chevre.ts', ref: 'monstre:jambe:chevre:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/chevre.ts', ref: 'monstre:jambe:chevre:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/fauve.ts', ref: 'monstre:jambe:fauve:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/fauve.ts', ref: 'monstre:jambe:fauve:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/griffe.ts', ref: 'monstre:bras:griffe:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/griffe.ts', ref: 'monstre:bras:griffe:profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/tentacule.ts', ref: 'monstre:bras:tentacule:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/monster/defs/tentacule.ts', ref: 'monstre:bras:tentacule:profile', occurrence: 1 },
]

export const RIG_VIEW_ALIAS_RATCHET = [
  { fichier: 'src/gameIso/rig/parts/elements/defs/cornes-demon.ts', ref: 'element:cornes-demon:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/cornes-taureau.ts', ref: 'element:cornes-taureau:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/queue-rat.ts', ref: 'element:queue-rat:back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/parts/elements/defs/queue.ts', ref: 'element:queue:back', occurrence: 1 },
]

export const RIG_VIEW_TRANSFORM_RATCHET = []
