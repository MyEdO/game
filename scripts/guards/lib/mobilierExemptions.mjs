// EXEMPTIONS AU SITE de la famille `mobilier` (#1739) : les lignes où un chiffre d'onglet de chapitre
// est un MOT DU LIVRE, pas du mobilier de page. Consommées par le prédicat unique
// `scripts/raw/lib/mobilier.mjs#exempter` — la sonde, la réparation et la garde de format les
// lisent ICI. Patron `EXEMPTIONS` de `pdfHorsCouture.mjs` : `fichier` (chemin POSIX du `.md`),
// `motif` qui tient au TEXTE de la ligne (jamais son numéro), `jetons` (le NOMBRE de sites qu'elle
// couvre sur sa ligne, pas un de plus), `raison`. Une exemption qui ne couvre pas exactement ses
// `jetons` sites est rouge (`check-source-format.mjs`).
const PRONOM = 'pronom anglais « I », mot du livre'

export const EXEMPTIONS_MOBILIER = [
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/002 - Contents.md', motif: /^\| Weapon Reach and Defence300 +\| Griffon332 +\| Appendix I +\|/, jetons: 1, raison: 'entrée « Appendix I » du sommaire imprimé' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^\*Adventure is what fools call the miseries/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^The return of young Stefan from his trip to Sylvania/, jetons: 3, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Alas, I neglected to consider/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^I am no stranger to radical thought/, jetons: 2, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Owd Badger's growing augmentation of my intellect/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Halflings are a common sight as their wandering ancestors/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^They do, however, possess a rather loose appreciation/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^They are a dour and suspicious people/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Then there are the elves, though it would perhaps/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^They are secretive, furtive, and possessed of customs/, jetons: 2, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^The aloofness and, dare I say it, arrogance/, jetons: 2, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Ogres are much in demand throughout the Empire/, jetons: 3, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^There are, of course, bandits, pirates, and other scoundrels/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Great care should therefore be taken even when mildly touching/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Though the signs of these dark powers may be plain enough/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^The most dangerous of these deviants scheme to recruit/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^The indomitable spirit of commerce leads canny merchants/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^And so, to our restless young people who want to contribute/, jetons: 1, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/004 - Introduction.md', motif: /^Before you cry that I offer medicine/, jetons: 3, raison: PRONOM },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/011 - High Elves.md', motif: /After the death of Caledor II in/, jetons: 1, raison: 'nom de règne « Caledor II », mot du livre' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/120 - Appendix V.md', motif: /^\| Intuition +\| I +\| B +\| Notice lies, read people +\|$/, jetons: 1, raison: 'colonne Caractéristique de la table des Compétences : « I » = Initiative' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/120 - Appendix V.md', motif: /^\| Navigation +\| I +\| B +\| Find your way +\|$/, jetons: 1, raison: 'colonne Caractéristique de la table des Compétences : « I » = Initiative' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/120 - Appendix V.md', motif: /^\| Perception +\| I +\| B +\| Notice things +\|$/, jetons: 1, raison: 'colonne Caractéristique de la table des Compétences : « I » = Initiative' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/120 - Appendix V.md', motif: /^\| Track +\| I +\| A +\| Follow someone +\|$/, jetons: 1, raison: 'colonne Caractéristique de la table des Compétences : « I » = Initiative' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/121 - Index.md', motif: /^\| Gaining Corruption Points 187 +\| Gunner \(Talent\) 120 +\| I +\|/, jetons: 1, raison: 'lettre de section « I » de l’index imprimé' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/122 - Character Sheet.md', motif: /^\| +\| WS<br>BS +\| S +\| T +\| I +\| Ag +\|/, jetons: 1, raison: 'rangée des Caractéristiques de la feuille de personnage : « I » = Initiative' },
  { fichier: 'Source/Warhammer Fantasy Roleplay 5e Core Rulebook/122 - Character Sheet.md', motif: /^\| Athletics +\| +\| Ag +\| +\| +\| +\| +\| Intuition +\| I +\|/, jetons: 1, raison: 'colonne Caractéristique de la feuille de personnage : « I » = Initiative' },
]
