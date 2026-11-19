/**
 * La fiche du héros (#4411), ouverte sur ses possessions (`../../heros.md`, section `fiche-possessions`), au gabarit de
 * la fiche jugée (`../../../maquettes/fiche-du-heros.jpg`) : les sets d'armes et la ligne pressée, dont les gestes sont
 * ceux de `src/noyau/gestesDeLObjet.ts` ; sets `src/noyau/partyFlow.ts:264-309` (LDB 14 l.138), composant
 * `partyFlow.ts:580-647` (LDB 46 l.107-113), prothèse `partyFlow.ts:718-745` (LDB 73 l.19, l.23), Faveur
 * `src/noyau/favorFlow.ts` (LDB 23 l.141-151).
 */
import type { Carac, Ecran, FicheDuHeros, HerosDuGroupe, IdentiteDuHeros, ObjetDuHeros, ObjetOuvert } from './maquette.ts';

const CARACS: Carac[] = ['M', 'CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc', 'B'];
const profil = (valeurs: number[]) => valeurs.map((valeur, k) => ({ carac: CARACS[k], valeur }));
const reserves = (destin: number, chance: number, resilience: number, determination: number) => [
  { nom: 'Destin', valeur: destin }, { nom: 'Chance', valeur: chance }, { nom: 'Résilience', valeur: resilience }, { nom: 'Détermination', valeur: determination }];
const ILYANWE: IdentiteDuHeros = { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', espece: 'Hauts elfes', carriere: 'Sorcière', blessures: { n: 17, sur: 17 }, reserves: reserves(4, 4, 3, 3) };
const BERTA: IdentiteDuHeros = { id: 'berta', nom: 'Berta', espece: 'Humains (Reiklander)', carriere: 'Soldate', blessures: { n: 12, sur: 12 }, reserves: reserves(2, 2, 2, 2) };
/** Les deux héros du groupe, celui dont la fiche est lue choisi. */
const groupe = (lu: string): HerosDuGroupe[] => [
  { id: 'ilyanwe', nom: 'Ilyanwe la Voilée', carriere: 'Sorcière', blessures: 17, max: 17, ...(lu === 'ilyanwe' ? { choisi: true } : {}) },
  { id: 'berta', nom: 'Berta', carriere: 'Soldate', blessures: 12, max: 12, ...(lu === 'berta' ? { choisi: true } : {}) },
];
const RANGER = { libelle: 'Ranger dans', vers: 'Sac à dos' };
const POSER = { libelle: 'Poser au sol' };

/** La fiche d'Ilyanwe, la ligne `pressee` de son vrac ouverte. */
const ilyanwe = (nom: string, pressee: 'dague' | 'composant', ouvert: ObjetOuvert): FicheDuHeros => ({
  nom, gabarit: 'fiche', identite: ILYANWE, profil: profil([5, 33, 30, 26, 45, 62, 58, 52, 80, 70, 29, 17]),
  sections: ['Attaques', 'Compétences', 'Talents', 'Sorts', 'Possessions'], ouverte: 'Possessions',
  sets: [{ principale: { id: 'baton', nom: 'Bâton de combat' }, secondaire: null, enMain: true, deuxMains: true }, { principale: { id: 'dague', nom: 'Dague' }, secondaire: null }],
  porte: [{ id: 'baton', nom: 'Bâton de combat', ou: 'En main' }, { id: 'habit', nom: 'Robe', ou: 'Portée' }, { id: 'sac', nom: 'Sac à dos', ou: 'Porté' }],
  vrac: ([
    { id: 'dague', nom: 'Dague', ou: 'Second set' }, { id: 'livre', nom: 'Grimoire', ou: 'Dans : Sac à dos' }, { id: 'parchemin', nom: 'Licence magique', ou: 'Dans : Sac à dos' },
    { id: 'fiole', nom: 'Composant d\'incantation', ou: 'Mur de feu' }, { id: 'fiole', nom: 'Composant d\'incantation', ou: 'À lier' },
  ] as ObjetDuHeros[]).map((o, k) => ((pressee === 'dague' ? k === 0 : k === 4) ? { ...o, pressee: true } : o)),
  ouvert, groupe: groupe('ilyanwe'),
});

/** La fiche de Berta, sa `pressee` ouverte. */
const berta = (nom: string, pressee: 'prothese' | 'faveur', ouvert: ObjetOuvert): FicheDuHeros => ({
  nom, gabarit: 'fiche', identite: BERTA, profil: profil([4, 41, 33, 38, 36, 31, 30, 28, 27, 34, 29, 12]),
  sections: ['Attaques', 'Compétences', 'Talents', 'Possessions'], ouverte: 'Possessions',
  sets: [{ principale: { id: 'epee', nom: 'Arme simple' }, secondaire: { id: 'bouclier', nom: 'Bouclier' }, enMain: true, refus: 'Dernier set d\'armes — un héros en garde toujours un.', ...(pressee === 'prothese' ? { survol: true } : {}) }],
  porte: [
    { id: 'epee', nom: 'Arme simple', ou: 'En main' }, { id: 'bouclier', nom: 'Bouclier', ou: 'En main' }, { id: 'habit', nom: 'Veste de cuir', ou: 'Portée' },
    { id: 'jambe', nom: 'Fausse jambe', ou: 'Portée', ...(pressee === 'prothese' ? { pressee: true } : {}) }, { id: 'sac', nom: 'Sac à dos', ou: 'Porté' }],
  vrac: [{ id: 'dague', nom: 'Dague', ou: 'Dans : Sac à dos' }, { id: 'vivres', nom: 'Vivres, 1 jour', nombre: 3 }],
  faveurs: [{ creancier: 'Capitaine Blucher', niveau: 'Majeure', solde: { n: 1, sur: 2 }, ...(pressee === 'faveur' ? { pressee: true } : {}) }],
  ouvert, groupe: groupe('berta'),
});

export default {
  etats: [
    ilyanwe('fiche-possessions', 'dague', {
      icone: 'dague', nom: 'Dague', sous: 'Arme de mêlée · Base',
      faits: [{ rubrique: 'Dégâts', valeur: '+BF+2' }, { rubrique: 'Allonge', valeur: 'Très courte' }, { rubrique: 'Enc.', valeur: '0' }],
      gestes: [{ libelle: 'Main principale' }, { libelle: 'Main secondaire', refus: 'Arme à deux mains — pas de seconde main.', survol: true }, RANGER, { libelle: 'Donner à', vers: 'Berta' }, POSER],
    }),
    ilyanwe('fiche-possessions-composant', 'composant', {
      icone: 'fiole', nom: 'Composant d\'incantation', sous: 'À lier',
      lier: [{ nom: 'Carreau', ni: 4, choisi: true }, { nom: 'Cautériser', ni: 4 }, { nom: 'Dôme', ni: 7 }, { nom: 'Mur de feu', ni: 6 }],
      gestes: [{ libelle: 'Lier à Carreau', principal: true }, RANGER, { libelle: 'Donner à', vers: 'Berta' }, POSER],
    }),
    berta('fiche-possessions-prothese', 'prothese', {
      icone: 'jambe', nom: 'Fausse jambe', sous: 'Prothèse · portée',
      entrainement: { px: 240, paliers: [{ texte: 'récupérer le dernier Point de Mouvement perdu', px: 100, acquis: true }, { texte: 'réapprendre à utiliser Esquive', px: 200 }] },
      gestes: [{ libelle: 'Porter' }, { libelle: 'Donner à', vers: 'Ilyanwe' }, POSER],
    }),
    berta('fiche-possessions-faveur', 'faveur', {
      icone: 'parchemin', nom: 'Faveur Majeure', sous: 'Due au capitaine Blucher',
      faveur: { nature: 'Escorter son chariot de solde jusqu’à Weissbruck.', solde: { n: 1, sur: 2 }, rompre: 'Niveau de carrière réduit de 1' },
      gestes: [{ libelle: 'Rompre la Faveur' }],
    }),
  ],
} satisfies Ecran;
