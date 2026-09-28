/**
 * LE PONT des sorts du livre fan `frenchy-bzh` (#1897) : chaque cellule de sort d'un profil de créature
 * (`cellulesDeSortsFan`, `scripts/data/lib/cellulesDeSortsFan.ts`) se résout en UN id de `spells.json`
 * par sa CLÉ imprimée — section de table, colonne VO, sigle de livre VO. La VF n'y entre jamais : c'est
 * une « traduction personnelle » (`docs/sources-vf.md`, frenchy.bzh), et elle trompe (fan « Secousse »
 * = *Drop* = LDB « Chute »). Le NI imprimé n'y entre pas non plus : le livre fan y cuit le bonus de bâton
 * (#1900), un même sort s'imprime à plusieurs NI.
 *
 * `statut` dit ce qu'est le sort imprimé : `officiel` (le sort d'un livre VF, résolu à SON entrée),
 * `variante` (un sort officiel que le livre fan réécrit, résolu à l'entrée fan, #1897), `fan` (propre au
 * livre fan). Consommé par la migration
 * `scripts/migrations/2026-09-23-1897-sorts-fan-par-le-pont.mjs` (listes `spells` des créatures fan
 * DÉRIVÉES) et par la garde `src/data/sorts-du-livre-fan.test.ts`.
 */
import { normCellule, type CelluleDeSort, type Section } from './cellulesDeSortsFan.ts';

export type StatutDeCle = 'officiel' | 'variante' | 'fan';
export interface LigneDuPont { readonly section: Section; readonly vo: string; readonly sigle?: string; readonly id: string; readonly statut: StatutDeCle }

/** Sigle de livre VO en fin de colonne VO (« Beast Tongue DotR Comp »). */
const SIGLE = /\s*\(?\s*(Dev Diary #\d+|DotR Comp(?:anion)?|DotR p\.\d+|EiS Comp|EiR Companion|THR Comp|PbtT Comp(?:anion)?(?:, p\.\d+)?|WoM, p\.\d+|B&B|DSLF|DSFL|UA II|AotE III)\s*\)?\s*$/;

/** Clé d'une cellule imprimée : `section|vo|sigle`, la VO sans son sigle, normalisée. */
export function cleImprimee(section: Section, vo: string): string {
  const sigle = vo.match(SIGLE)?.[1] ?? '';
  const nue = normCellule(vo.replace(SIGLE, '')).replace(/\s*!\s*$/, '');
  return `${section}|${nue}|${sigle}`;
}
const cleDeLigne = (l: LigneDuPont) => cleImprimee(l.section, l.sigle ? `${l.vo} ${l.sigle}` : l.vo);

export const PONT: readonly LigneDuPont[] = [
  { section: 'miracle', vo: 'Rhya’s Abundance', sigle: 'AotE III', id: 'abondance-de-rhya', statut: 'fan' },
  { section: 'miracle', vo: 'Rhya’s Shelter', id: 'abri-de-rhya', statut: 'officiel' },
  { section: 'sort', vo: 'Disrupt Magic', sigle: 'WoM, p.26', id: 'agression-aethyrique', statut: 'variante' },
  { section: 'mineure', vo: 'Warning', id: 'alerte', statut: 'officiel' },
  { section: 'sort', vo: 'Tangleweed', sigle: 'Dev Diary #10', id: 'algues-cruelles', statut: 'fan' },
  { section: 'sort', vo: 'Bless With Filth', sigle: 'THR Comp', id: 'arme-souillee', statut: 'fan' },
  { section: 'sort', vo: 'AEthyric Armour', id: 'armure-d-aethyr', statut: 'variante' },
  { section: 'sort', vo: 'Armour of Darkness', id: 'armure-d-obscurite', statut: 'fan' },
  { section: 'miracle', vo: 'Poor Man’s Face', sigle: 'DSLF', id: 'aux-innocents-les-mains-pleines', statut: 'fan' },
  { section: 'sort', vo: 'Aspect of the Horned Rat', sigle: 'Dev Diary #18', id: 'avatar-du-rat-cornu', statut: 'fan' },
  { section: 'miracle', vo: 'Talk your Way out', sigle: 'DSLF', id: 'baratin', statut: 'fan' },
  { section: 'miracle', vo: 'Balm to a Wounded Mind', id: 'baume-pour-un-esprit-blesse', statut: 'officiel' },
  { section: 'miracle', vo: 'Nature’s Repast', sigle: 'DSLF', id: 'benedicite-de-taal', statut: 'fan' },
  { section: 'benediction', vo: 'Battle', id: 'benediction-de-bataille', statut: 'officiel' },
  { section: 'benediction', vo: 'Fortune', id: 'benediction-de-chance', statut: 'officiel' },
  { section: 'benediction', vo: 'Charisma', id: 'benediction-de-charisme', statut: 'officiel' },
  { section: 'benediction', vo: 'Recuperation', id: 'benediction-de-convalescence', statut: 'officiel' },
  { section: 'benediction', vo: 'Courage', id: 'benediction-de-courage', statut: 'officiel' },
  { section: 'benediction', vo: 'Righteousness', id: 'benediction-de-droiture', statut: 'officiel' },
  { section: 'benediction', vo: 'Finesse', id: 'benediction-de-finesse', statut: 'officiel' },
  { section: 'benediction', vo: 'Grace', id: 'benediction-de-grace', statut: 'officiel' },
  { section: 'benediction', vo: 'Healing', id: 'benediction-de-guerison', statut: 'officiel' },
  { section: 'benediction', vo: 'Hunt', id: 'benediction-de-la-chasse', statut: 'officiel' },
  { section: 'benediction', vo: 'Protection', id: 'benediction-de-protection', statut: 'officiel' },
  { section: 'benediction', vo: 'Might', id: 'benediction-de-puissance', statut: 'officiel' },
  { section: 'benediction', vo: 'Wisdom', id: 'benediction-de-sagesse', statut: 'officiel' },
  { section: 'benediction', vo: 'Savagery', id: 'benediction-de-sauvagerie', statut: 'officiel' },
  { section: 'benediction', vo: 'Breath', id: 'benediction-de-souffle', statut: 'officiel' },
  { section: 'benediction', vo: 'Tenacity', id: 'benediction-de-tenacite', statut: 'officiel' },
  { section: 'benediction', vo: 'Hardiness', id: 'benediction-de-vigueur', statut: 'officiel' },
  { section: 'benediction', vo: 'Wit', id: 'benediction-de-vivacite', statut: 'officiel' },
  { section: 'sort', vo: 'Soporific Lull', sigle: 'UA II', id: 'berceuse-soporifique-ua-ii', statut: 'fan' },
  { section: 'miracle', vo: 'Hoarfrost’s Chill', id: 'blizzard', statut: 'variante' },
  { section: 'miracle', vo: 'Lose the Loot', sigle: 'DSLF', id: 'bon-debarras', statut: 'fan' },
  { section: 'sort', vo: 'Skitterleap', id: 'bond-furtif', statut: 'fan' },
  { section: 'miracle', vo: 'Leaping Stag', id: 'bondissant-comme-un-cerf', statut: 'officiel' },
  { section: 'sort', vo: 'Goodwill', id: 'bonne-volonte', statut: 'officiel' },
  { section: 'sort', vo: 'Arrow Shield', id: 'bouclier-anti-fleches', statut: 'officiel' },
  { section: 'sort', vo: 'Warp Shield', id: 'bouclier-ruine', statut: 'fan' },
  { section: 'sort', vo: 'Trankraft', sigle: 'B&B', id: 'bouillon-revigorant', statut: 'fan' },
  { section: 'mineure', vo: 'Sounds', id: 'bruits', statut: 'officiel' },
  { section: 'sort', vo: 'Sounds', id: 'bruits', statut: 'officiel' },
  { section: 'sort', vo: 'Toxic Rain', id: 'brume-acide', statut: 'fan' },
  { section: 'mineure', vo: 'Mystic Mist', sigle: 'Dev Diary #10', id: 'brume-mystique', statut: 'fan' },
  { section: 'sort', vo: 'Cacophonic Caress', sigle: 'PbtT Comp', id: 'cacophonie-scabreuse', statut: 'fan' },
  { section: 'miracle', vo: 'Rhya’s Touch', id: 'caresse-de-rhya', statut: 'officiel' },
  { section: 'sort', vo: 'Bolt', id: 'carreau', statut: 'officiel' },
  { section: 'miracle', vo: 'Bitter Catharsis', id: 'catharsis', statut: 'variante' },
  { section: 'mineure', vo: 'Shock', id: 'choc', statut: 'officiel' },
  { section: 'sort', vo: 'Shock', id: 'choc', statut: 'officiel' },
  { section: 'sort', vo: 'Drop', id: 'chute', statut: 'officiel' },
  { section: 'sort', vo: 'Bash’Em Lads !', id: 'cogne-fort', statut: 'fan' },
  { section: 'sort', vo: 'Acquiescence', id: 'consentement', statut: 'officiel' },
  { section: 'mineure', vo: 'Conserve', id: 'conservation', statut: 'officiel' },
  { section: 'sort', vo: 'Conserve', id: 'conservation', statut: 'officiel' },
  { section: 'sort', vo: 'Mantle of Contagion', id: 'contamination', statut: 'fan' },
  { section: 'sort', vo: 'Eadbutt !', id: 'coup-d-boule', statut: 'fan' },
  { section: 'mineure', vo: 'Gust', id: 'coup-de-vent', statut: 'officiel' },
  { section: 'miracle', vo: 'Heart of the Wolf', sigle: 'PbtT Comp', id: 'courage-du-loup', statut: 'fan' },
  { section: 'sort', vo: 'Crackling Doom', id: 'crepitement-funeste', statut: 'fan' },
  { section: 'mineure', vo: 'Vindictive Glare', id: 'crepitements-vengeurs', statut: 'fan' },
  { section: 'sort', vo: 'Crack’s Call', id: 'crevasse', statut: 'fan' },
  { section: 'sort', vo: 'Swell River', sigle: 'Dev Diary #10', id: 'crue-mortelle', statut: 'fan' },
  { section: 'benediction', vo: 'Conscience', id: 'culpabilite', statut: 'variante' },
  { section: 'sort', vo: 'Cursed Caress', sigle: 'PbtT Comp', id: 'decharge-cerebrale', statut: 'fan' },
  { section: 'sort', vo: 'Bolt of Corruption', sigle: 'EiS Comp', id: 'decharge-de-corruption', statut: 'officiel' },
  { section: 'sort', vo: 'Blight', id: 'degradation', statut: 'officiel' },
  { section: 'mineure', vo: 'Itchy Nuisance', id: 'demangeaison-agacante', statut: 'fan' },
  { section: 'sort', vo: 'Flensing Ruin', id: 'depecage', statut: 'fan' },
  { section: 'sort', vo: 'Move Object', id: 'deplacement-d-objet', statut: 'officiel' },
  { section: 'sort', vo: 'Aura of Acquiescence', sigle: 'PbtT Comp', id: 'desarroi', statut: 'fan' },
  { section: 'sort', vo: 'Traceless demise', id: 'disparition', statut: 'fan' },
  { section: 'mineure', vo: 'Cunnin’ Words', id: 'douces-paroles', statut: 'fan' },
  { section: 'mineure', vo: 'Drain', id: 'drain', statut: 'officiel' },
  { section: 'sort', vo: 'Drain', id: 'drain', statut: 'officiel' },
  { section: 'miracle', vo: 'Rhya’s Taming', sigle: 'AotE III', id: 'dressage-de-rhya', statut: 'fan' },
  { section: 'sort', vo: 'Treason of Tzeentch', id: 'duplicite-de-tzeentch', statut: 'variante' },
  { section: 'mineure', vo: 'Dazzle', id: 'eclat', statut: 'variante' },
  { section: 'sort', vo: 'Curse of Crippling Pain', id: 'effigie-maudite', statut: 'variante' },
  { section: 'sort', vo: 'Fearsome', id: 'effrayant', statut: 'officiel' },
  { section: 'mineure', vo: 'Entangle', id: 'enchevetrement', statut: 'officiel' },
  { section: 'sort', vo: 'Entangle', id: 'enchevetrement', statut: 'officiel' },
  { section: 'miracle', vo: 'Anchorite’s Endurance', id: 'endurance-de-l-anachorete', statut: 'officiel' },
  { section: 'miracle', vo: 'Shackles of Truth', id: 'entraves-a-la-verite', statut: 'officiel' },
  { section: 'miracle', vo: 'Sword of Justice', id: 'epee-de-justice', statut: 'officiel' },
  { section: 'sort', vo: 'Blast', id: 'explosion', statut: 'officiel' },
  { section: 'sort', vo: 'Blast of Corruption', sigle: 'EiS Comp', id: 'explosion-de-corruption', statut: 'officiel' },
  { section: 'sort', vo: 'Mundane Aura', id: 'faux-semblant', statut: 'variante' },
  { section: 'mineure', vo: 'Favour of the Horned Rat', id: 'faveur-du-rat-cornu', statut: 'fan' },
  { section: 'sort', vo: 'Power of Chaos', sigle: 'EiS Comp', id: 'felure-aethyrique', statut: 'variante' },
  { section: 'sort', vo: 'Fertilise', sigle: 'B&B', id: 'fertilisation', statut: 'fan' },
  { section: 'sort', vo: 'Blue Fire of Tzeentch', sigle: 'EiS Comp', id: 'feu-bleu-de-tzeentch', statut: 'officiel' },
  { section: 'sort', vo: 'Pink Fire of Tzeentch', sigle: 'EiS Comp', id: 'feu-rose-de-tzeentch', statut: 'officiel' },
  { section: 'sort', vo: 'Mindfire', sigle: 'EiS Comp', id: 'feu-spirituel', statut: 'officiel' },
  { section: 'mineure', vo: 'Marsh Lights', id: 'feux-follets', statut: 'officiel' },
  { section: 'sort', vo: 'Marsh Lights', id: 'feux-follets', statut: 'officiel' },
  { section: 'miracle', vo: 'Beacon of Righteous Virtue', id: 'flambeau-de-vertu', statut: 'officiel' },
  { section: 'mineure', vo: 'Magic Flame', id: 'flamme-magique', statut: 'officiel' },
  { section: 'mineure', vo: 'Ghostly Flame', id: 'flamme-verdatre', statut: 'fan' },
  { section: 'sort', vo: 'Ghostly Flame', id: 'flamme-verdatre', statut: 'fan' },
  { section: 'mineure', vo: 'Dart', id: 'flechette', statut: 'officiel' },
  { section: 'sort', vo: 'Dart', id: 'flechette', statut: 'officiel' },
  { section: 'sort', vo: 'Spirit Walk', sigle: 'EiR Companion', id: 'forme-spectrale', statut: 'fan' },
  { section: 'sort', vo: 'Belligerence of the Bloodmarsh', sigle: 'WoM, p.26', id: 'frenesie-artificielle', statut: 'variante' },
  { section: 'miracle', vo: 'Ulric’s Fury', id: 'fureur-d-ulric', statut: 'officiel' },
  { section: 'sort', vo: 'Poisonous Pustule', sigle: 'THR Comp', id: 'furoncle-infecte', statut: 'fan' },
  { section: 'sort', vo: 'Poisonous Pustule', id: 'furoncle-infecte', statut: 'fan' },
  { section: 'miracle', vo: 'Ranald’s Grace', id: 'grace-de-ranald', statut: 'officiel' },
  { section: 'miracle', vo: 'Crush the Weak', sigle: 'PbtT Comp', id: 'haine-du-faible', statut: 'fan' },
  { section: 'sort', vo: 'Pestilent Breath', sigle: 'THR Comp', id: 'haleine-fetide', statut: 'fan' },
  { section: 'mineure', vo: 'Wrack', id: 'hebetement', statut: 'fan' },
  { section: 'sort', vo: 'Wrack', id: 'hebetement', statut: 'fan' },
  { section: 'mineure', vo: 'Vector', id: 'immuno-deficience', statut: 'fan' },
  { section: 'sort', vo: 'Vector', id: 'immuno-deficience', statut: 'fan' },
  { section: 'miracle', vo: 'Unblemished Innocence', id: 'innocence-immaculee', statut: 'officiel' },
  { section: 'miracle', vo: 'Animal Instincts', id: 'instincts-animaux', statut: 'officiel' },
  { section: 'miracle', vo: 'An Invitation', id: 'invitation', statut: 'officiel' },
  { section: 'sort', vo: 'Vanhel’s Invitation to the Danse Macabre', sigle: 'UA II', id: 'invitation-a-la-danse-macabre-de-vanhel', statut: 'fan' },
  { section: 'sort', vo: 'Create Construct', id: 'invocation-d-un-colosses-necrofex', statut: 'fan' },
  { section: 'miracle', vo: 'Blind Justice', id: 'justice-aveugle', statut: 'officiel' },
  { section: 'sort', vo: 'Vanhel’s Call', id: 'l-appel-de-vanhel', statut: 'officiel' },
  { section: 'miracle', vo: 'Truth Will Out', id: 'la-verite-eclatera', statut: 'officiel' },
  { section: 'sort', vo: 'Cutting Wit', sigle: 'PbtT Comp', id: 'langue-aceree', statut: 'fan' },
  { section: 'mineure', vo: 'Beast Tongue', sigle: 'DotR Companion', id: 'langue-des-gors', statut: 'variante' },
  { section: 'mineure', vo: 'Beast Tongue', sigle: 'DotR Comp', id: 'langue-des-gors', statut: 'variante' },
  { section: 'miracle', vo: 'Shallya’s Tears', id: 'larmes-de-shallya', statut: 'officiel' },
  { section: 'miracle', vo: 'Wilderness Way', sigle: 'DSLF', id: 'les-voies-de-la-nature', statut: 'fan' },
  { section: 'mineure', vo: 'Light', id: 'lumiere', statut: 'officiel' },
  { section: 'mineure', vo: 'Curse of da Bad Moon', id: 'lune-de-malheur', statut: 'fan' },
  { section: 'sort', vo: 'Master of Fortune', sigle: 'EiS Comp', id: 'maitrise-du-destin', statut: 'variante' },
  { section: 'sort', vo: 'Curse of Tzeentch', sigle: 'EiS Comp', id: 'malediction-de-tzeentch', statut: 'officiel' },
  { section: 'mineure', vo: 'The Great Green Spite', id: 'malveillance-absolue', statut: 'fan' },
  { section: 'mineure', vo: 'Mark of the Horned Rat', id: 'marque-du-rat-cornu', statut: 'fan' },
  { section: 'miracle', vo: 'Sigmar’s Fiery Hammer', id: 'marteau-ardent-de-sigmar', statut: 'officiel' },
  { section: 'sort', vo: 'Evil Eye', id: 'mauvais-oeil', statut: 'officiel' },
  { section: 'sort', vo: 'Creeping Menace', id: 'menace-rampante', statut: 'officiel' },
  { section: 'miracle', vo: 'Winter’s Bite', id: 'morsure-de-l-hiver', statut: 'officiel' },
  { section: 'sort', vo: 'Snitch', sigle: 'PbtT Companion, p.110', id: 'mouchard', statut: 'fan' },
  { section: 'mineure', vo: 'Murmured Whisper', id: 'murmures', statut: 'officiel' },
  { section: 'sort', vo: 'Murmured Whisper', id: 'murmures', statut: 'officiel' },
  { section: 'miracle', vo: 'Heed not the Witch', id: 'n-ecoutez-point-la-sorciere', statut: 'officiel' },
  { section: 'sort', vo: 'Nostrum', id: 'nostrum', statut: 'variante' },
  { section: 'sort', vo: 'Veil of Flies', sigle: 'THR Comp', id: 'nuee-de-mouches', statut: 'fan' },
  { section: 'sort', vo: 'Veil of Flies', id: 'nuee-de-mouches', statut: 'fan' },
  { section: 'mineure', vo: 'Open Lock', id: 'ouverture', statut: 'variante' },
  { section: 'mineure', vo: 'Careful Step', id: 'pas-leger', statut: 'officiel' },
  { section: 'sort', vo: 'Careful Step', id: 'pas-leger', statut: 'officiel' },
  { section: 'sort', vo: 'Sticky Paws', id: 'pattes-gluantes', statut: 'fan' },
  { section: 'miracle', vo: 'Pelt of the Winter Wolf', id: 'peau-de-loup-d-hiver', statut: 'officiel' },
  { section: 'sort', vo: 'Sense the Skein', sigle: 'EiS Comp', id: 'percevoir-l-echeveau', statut: 'officiel' },
  { section: 'sort', vo: 'Bonesnap per', sigle: 'B&B', id: 'pierre-de-souffrance', statut: 'fan' },
  { section: 'sort', vo: 'Bonesnapper', sigle: 'B&B', id: 'pierre-de-souffrance', statut: 'fan' },
  { section: 'miracle', vo: 'The Heat is Off', sigle: 'DSLF', id: 'piste-froide', statut: 'fan' },
  { section: 'sort', vo: 'Buoyant Passage', id: 'poids-plume', statut: 'fan' },
  { section: 'sort', vo: 'Swift Scamper', id: 'poudre-d-escampette', statut: 'fan' },
  { section: 'sort', vo: 'Push', id: 'poussee', statut: 'officiel' },
  { section: 'sort', vo: 'Brainbursta', id: 'prise-de-tete', statut: 'fan' },
  { section: 'mineure', vo: 'Purify Water', id: 'purification-de-l-eau', statut: 'officiel' },
  { section: 'sort', vo: 'Purify Water', id: 'purification-de-l-eau', statut: 'officiel' },
  { section: 'mineure', vo: 'Rot', id: 'putrefaction', statut: 'officiel' },
  { section: 'sort', vo: 'Rot', id: 'putrefaction', statut: 'officiel' },
  { section: 'sort', vo: 'Putrefy', sigle: 'THR Comp', id: 'putrefaction-2', statut: 'fan' },
  { section: 'sort', vo: 'Howling Warpgale', id: 'rafale-hurlante', statut: 'fan' },
  { section: 'sort', vo: 'Death Frenzy', id: 'rage-meurtriere', statut: 'fan' },
  { section: 'sort', vo: 'Bonesetter', sigle: 'B&B', id: 'ramanchage', statut: 'fan' },
  { section: 'mineure', vo: 'Rat Thrall', id: 'rat-esclave', statut: 'fan' },
  { section: 'sort', vo: 'Rat Thrall', id: 'rat-esclave', statut: 'fan' },
  { section: 'sort', vo: 'Reanimate', id: 'reanimation', statut: 'officiel' },
  { section: 'miracle', vo: 'Rhya’s Harvest', id: 'recolte-de-rhya', statut: 'officiel' },
  { section: 'mineure', vo: 'Leer', sigle: 'PbtT Comp', id: 'regard-lubrique', statut: 'fan' },
  { section: 'sort', vo: 'Chaos Spawn', sigle: 'PbtT Comp', id: 'rejeton-de-slaanesh', statut: 'fan' },
  { section: 'sort', vo: 'Raise Dead', id: 'relever-les-morts', statut: 'officiel' },
  { section: 'mineure', vo: 'Bearings', id: 'reperes', statut: 'officiel' },
  { section: 'sort', vo: 'Bearings', id: 'reperes', statut: 'officiel' },
  { section: 'miracle', vo: 'Wisdom of the Owl', id: 'sagesse-de-la-chouette', statut: 'officiel' },
  { section: 'miracle', vo: 'Zone of Sanctuary', sigle: 'DotR p.78', id: 'sanctuaire', statut: 'variante' },
  { section: 'mineure', vo: 'Twitch', id: 'secousse', statut: 'officiel' },
  { section: 'sort', vo: 'Tremor', sigle: 'DotR Comp', id: 'secousse-tellurique', statut: 'variante' },
  { section: 'miracle', vo: 'Lord of the Hunt', id: 'seigneur-de-la-chasse', statut: 'officiel' },
  { section: 'sort', vo: 'Warp Star Infusion', id: 'shurikens-enchantes', statut: 'fan' },
  { section: 'sort', vo: 'The Evil Sun', id: 'soleil-noir', statut: 'fan' },
  { section: 'mineure', vo: 'Sleep', id: 'sommeil', statut: 'officiel' },
  { section: 'mineure', vo: 'Spring', id: 'source', statut: 'officiel' },
  { section: 'sort', vo: 'Spring', id: 'source', statut: 'officiel' },
  { section: 'sort', vo: 'Teleport', id: 'teleportation', statut: 'officiel' },
  { section: 'mineure', vo: 'Eavesdrop', id: 'tendre-l-oreille', statut: 'officiel' },
  { section: 'sort', vo: 'Eavesdrop', id: 'tendre-l-oreille', statut: 'officiel' },
  { section: 'sort', vo: 'Haunting Horror', id: 'terreur-nocturne', statut: 'variante' },
  { section: 'sort', vo: 'Terrifying', id: 'terrifiant', statut: 'officiel' },
  { section: 'miracle', vo: 'Pax of Taal', sigle: 'DSLF', id: 'treve-de-taal-dsfl', statut: 'fan' },
  { section: 'sort', vo: 'Distracting', id: 'trouble', statut: 'variante' },
  { section: 'miracle', vo: 'Rhya’s Union', id: 'union-de-rhya', statut: 'officiel' },
  { section: 'sort', vo: 'Angry Wave', sigle: 'Dev Diary #10', id: 'vague-scelerate', statut: 'fan' },
  { section: 'miracle', vo: 'Vanquish the Unrighteous', id: 'vaincre-les-impies', statut: 'officiel' },
  { section: 'miracle', vo: 'As Verena is my Witness', id: 'verena-est-mon-temoin', statut: 'officiel' },
  { section: 'sort', vo: 'Dark Vision', id: 'vision-dans-l-obscurite', statut: 'officiel' },
  { section: 'mineure', vo: 'Flight', id: 'vol', statut: 'variante' },
  { section: 'sort', vo: 'WAAAGH !', id: 'waaagh', statut: 'fan' },
  { section: 'miracle', vo: 'Cat’s Eyes', id: 'yeux-de-chat', statut: 'officiel' },
  { section: 'sort', vo: 'Gaze of Mork', id: 'z-oeils-de-mork', statut: 'fan' },
];

const PAR_CLE = new Map(PONT.map((l) => [cleDeLigne(l), l]));

/** La ligne du pont d'une cellule, ou `undefined` (cellule que le pont ne résout pas). */
export const ligneDeCellule = (c: Pick<CelluleDeSort, 'section' | 'vo'>): LigneDuPont | undefined => PAR_CLE.get(cleImprimee(c.section, c.vo));

/** Clés du pont en DOUBLE : une même clé ne se résout qu'une fois. */
export const clesEnDouble = (): string[] => {
  const vues = new Set<string>(); const doubles: string[] = [];
  for (const l of PONT) { const k = cleDeLigne(l); if (vues.has(k)) doubles.push(k); vues.add(k); }
  return doubles;
};

export interface ListeDerivee { readonly spells: string[]; readonly doublons: string[] }

/**
 * Liste `spells` DÉRIVÉE de chaque créature fan jointe : les ids de ses cellules, dans l'ordre imprimé,
 * chacun une fois. Un id répété n'est absorbé que si chacune de ses cellules imprime la MÊME rangée (VF,
 * VO, NI) — table recopiée dans le profil (`frenchy.bzh 56` l.145 et l.150) ; toute autre répétition est
 * un DOUBLON non déclaré, rendu nommé. Une cellule que le pont ne résout pas est rendue à part.
 */
export function listesDerivees(cellules: readonly CelluleDeSort[]): { parCreature: Map<string, ListeDerivee>; nonResolues: CelluleDeSort[] } {
  const parCreature = new Map<string, { spells: string[]; doublons: string[]; rangee: Map<string, string> }>();
  const nonResolues: CelluleDeSort[] = [];
  for (const c of cellules) {
    const l = ligneDeCellule(c);
    if (!l) { nonResolues.push(c); continue; }
    if (!c.creature) continue;
    const e = parCreature.get(c.creature) ?? parCreature.set(c.creature, { spells: [], doublons: [], rangee: new Map() }).get(c.creature)!;
    const rangee = `${c.vf}|${c.vo}|${c.ni ?? ''}`;
    const deja = e.rangee.get(l.id);
    if (deja === undefined) { e.spells.push(l.id); e.rangee.set(l.id, rangee); }
    else if (deja !== rangee) e.doublons.push(`${c.creature} : ${l.id} imprimé par « ${deja} » puis « ${rangee} » (${c.fichier} l.${c.ligne})`);
  }
  return { parCreature: new Map([...parCreature].map(([k, v]) => [k, { spells: v.spells, doublons: v.doublons }])), nonResolues };
}
