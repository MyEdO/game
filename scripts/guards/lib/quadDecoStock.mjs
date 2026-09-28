// STOCKS CLIQUETÉS des dettes d'ART quadrupède (#1082) — consommés par les gardes
// `src/gameIso/rig/quadruped/quad-anchor-contract.test.ts` et `quad-vues-ratchet.test.ts`. Patron
// whitelist-en-lib du dépôt (`paletteLiteralStock.mjs`, `jambesGabaritStock.mjs`).
//
// La MESURE vit dans `scripts/guards/lib/quadDecoAudit.ts`, partagée avec sa régénération,
// `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/quadDecoAudit.ts` (politique `DECROISSANT`,
// refus SITE PAR SITE).
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : `fichier` = la def de créature à ouvrir,
// résolue PAR IDENTITÉ dans l'index généré (`fichierDeDef`, jamais un chemin fabriqué) ; `ref` = le
// couple `<espèce> <vue> <os|clé#vue>`, la clé historique de ces stocks. C'est le `fichier` que la
// porte de plage (`croissanceDesStocks`) voit : une clé nue (`'basilic profile tete'`) lui est
// INVISIBLE, et un append n'y coûte rien. Aucun PLAFOND : ce qu'une dette ne peut pas faire, c'est
// croître SANS SE DÉCLARER, et c'est l'entrée nommée qui le dit — les gardes comparent par
// `ecartDuVolet`. Toute prose posée ENTRE les entrées est mangée à la régénération.
//
// TROIS collections GÉNÉRÉES, une seule primitive :
//   — `REPERES_ART_PROPRES_RATCHET` : l'art d'une part s'enveloppe d'un transform que `quadAnchor`
//     ne reproduit pas. Les 18 entrées sont des ROTATIONS (port de tête de profil, cuit dans l'art
//     faute d'axe de squelette qui le porte) : mouvement RIGIDE, l'unité de la part reste celle de
//     l'os. Le patron de solde est `boeuf profile tete` puis `cheval profile tete`
//     (2026-08-06) : réécrire les coordonnées de l'art dans le repère de l'OS, port de tête compris.
//   — `DECOS_MORTS_RATCHET` : clé `deco` visant un os que la vue n'émet pas. Les 4 relèvent de l'ART
//     à créer (fanon du grand cerf, crête de soies du sanglier : art authoré dans les coordonnées et
//     la silhouette du profil — reporté de bout, il peindrait une vue de côté sur une vue de face).
//     La loi invoquée pour retirer un couple d'ici est COMMITTÉE, plus une mesure d'atelier :
//     `quad-vues-ratchet.test.ts`, describe « canal `deco` : un décor ne vit que sur un os que la
//     vue ÉMET », pose un témoin sur le chemin de rendu RÉEL dans les DEUX sens (contrôle négatif
//     ~80 couples, contrôle positif sur la même population) — un solde est donc rejouable.
//   — `DECOS_SANS_PLAN_RATCHET` : fragment de décor sans `plan` déclaré (calque apposé par-dessus
//     l'art de l'os, transition N2). Un couple hors stock DOIT déclarer son plan.
//
// PAS ICI — `ANCRES_OEIL_ABSENTES_GELEES` reste dans `src/gameIso/rig/quadruped/deco-stock.fixture.ts` :
// son unique entrée `boeuf profile` n'a PAS de fichier fautif dérivable. La mesure lit
// `quad.viewArt.profile.tete`, mais l'art qui manque l'ancre `data-eye` est CUIT dans
// `src/gameIso/rig/quadruped/boeufCompile.ts` (module d'art compilé de l'espèce, keyé par vue, qui n'existe que
// pour boeuf/cheval) — aucun index ne relie un `viewArt` à son module source, et écrire `defs/Boeuf.ts`
// nommerait un fichier où le défaut n'est pas. Un chemin inventé vaut moins qu'une clé nue : il ferait
// mentir la porte de plage. Le jour où le canal `viewArt` dira son module, l'entrée rejoint ce fichier.

export const REPERES_ART_PROPRES_RATCHET = [
  { fichier: 'src/gameIso/rig/creatures/defs/Basilic.ts', ref: 'basilic profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Blaireau.ts', ref: 'blaireau profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/ChatSauvage.ts', ref: 'chat-sauvage profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Chien.ts', ref: 'chien profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Crapaud.ts', ref: 'crapaud profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Hippogriffe.ts', ref: 'hippogriffe profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/LionDeGuerreDeChrace.ts', ref: 'lion-de-guerre-de-chrace profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Loup.ts', ref: 'loup profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Manticore.ts', ref: 'manticore profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Ours.ts', ref: 'ours profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Pegase.ts', ref: 'pegase profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Rat-geant.ts', ref: 'rat-geant profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/RatLoup.ts', ref: 'rat-loup profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Stegadon.ts', ref: 'stegadon profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf profile tete', occurrence: 1 },
];

export const DECOS_MORTS_RATCHET = [
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf back encolure', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf front encolure', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier back encolure', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier front encolure', occurrence: 1 },
];

export const DECOS_SANS_PLAN_RATCHET = [
  { fichier: 'src/gameIso/rig/creatures/defs/Blaireau.ts', ref: 'blaireau back tete#back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Blaireau.ts', ref: 'blaireau front tete#front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Blaireau.ts', ref: 'blaireau front tronc#front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Blaireau.ts', ref: 'blaireau profile tete#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Blaireau.ts', ref: 'blaireau profile tronc#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf back tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf front tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf profile encolure', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/GrandCerf.ts', ref: 'grand-cerf profile tete#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon back basAvD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon back basAvG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon back hautArD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon back hautArG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon back hautAvD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon back hautAvG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon front basAvD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon front basAvG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon front hautArD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon front hautArG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon front hautAvD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon front hautAvG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile basAvD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile basAvG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile hautArD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile hautArG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile hautAvD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Griffon.ts', ref: 'griffon profile hautAvG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/LionDeGuerreDeChrace.ts', ref: 'lion-de-guerre-de-chrace profile piedAvD#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Manticore.ts', ref: 'manticore back tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Manticore.ts', ref: 'manticore front tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Manticore.ts', ref: 'manticore profile queue#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Manticore.ts', ref: 'manticore profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Preyton.ts', ref: 'preyton back tronc', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Preyton.ts', ref: 'preyton front tronc', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Preyton.ts', ref: 'preyton profile tronc', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Rat-geant.ts', ref: 'rat-geant back tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Rat-geant.ts', ref: 'rat-geant front tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Rat-geant.ts', ref: 'rat-geant profile tete', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier back tete#back', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier front tete#front', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier profile encolure', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier profile tete#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Sanglier.ts', ref: 'sanglier profile tronc#profile', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf back aileD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf back aileG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf front aileD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf front aileG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf profile aileD', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf profile aileG', occurrence: 1 },
  { fichier: 'src/gameIso/rig/creatures/defs/Varghulf.ts', ref: 'varghulf profile tronc#profile', occurrence: 1 },
];
