/**
 * Forme du corps d'une ESPÈCE → Tableau de Localisation (LDB 76 l.15-29). SOURCE DE VÉRITÉ RÈGLES,
 * neutre (aucune dépendance au rendu). `noyau/monde/spawn` (`bodyShapeOf`) en dérive la
 * `BodyShape` d'un Combattant sans importer `gameIso` (#187 : découplage taxonomie de forme ↔ rendu).
 *
 * Seules les espèces NON humanoïdes sont listées (défaut = humanoïde, table par défaut LDB 76 l.17 —
 * les gabarits sans Localisation Alternative canon, céphalopode/amorphe/squig/spectral/jabberslythe,
 * retombent dessus, pas d'invention). Clé = id d'espèce STABLE (`appearance.species` du record).
 */
import type { BodyShape } from './types';

export const SPECIES_BODY_SHAPE: Record<string, BodyShape> = {
  // Quadrupèdes (LDB 76 l.17 : bras = pattes avant, jambes = pattes arrière) — mécaniquement le tableau
  // humanoïde réétiqueté.
  basilic: 'quadrupede', blaireau: 'quadrupede', boeuf: 'quadrupede', carnosaure: 'quadrupede', 'chat-sauvage': 'quadrupede',
  cheval: 'quadrupede',
  chien: 'quadrupede', cornu: 'quadrupede', crapaud: 'quadrupede', 'le-dechiqueteur-de-cadavres': 'quadrupede',
  'grand-cerf': 'quadrupede', hydre: 'quadrupede', 'lion-de-guerre-de-chrace': 'quadrupede', loup: 'quadrupede',
  ours: 'quadrupede', 'rat-geant': 'quadrupede', 'rat-loup': 'quadrupede', sanglier: 'quadrupede',
  stegadon: 'quadrupede',
  // Ailés / oiseaux (LDB 76 l.17 : ailes = bras) — même mécanique que le quadrupède.
  chimere: 'oiseau', cockatrice: 'oiseau', dragon: 'oiseau', 'faucon-des-montagnes-grises': 'oiseau',
  'grand-aigle': 'oiseau', griffon: 'oiseau', 'happeur-carnivore': 'oiseau', 'heomreth-hibou-geant': 'oiseau',
  hyppogriffe: 'oiseau', 'macareux-a-bec-tranchant': 'oiseau', manticore: 'oiseau', pegase: 'oiseau', pigeon: 'oiseau',
  poulet: 'oiseau', preyton: 'oiseau', 'chauve-souris-vampire-varghulf': 'oiseau',
  // Serpentins (LDB 76 l.25-29 : Tête / Corps) et arachnides (Tête / Pattes / Abdomen) — Localisations Alternatives.
  sangsue: 'serpent', serpent: 'serpent', vers: 'serpent',
  araignee: 'araignee',
};

/** Forme du corps d'une espèce (LDB 76 l.15-29) — défaut humanoïde. `undefined`/inconnue ⇒ humanoïde. */
export function bodyShapeForSpecies(species: string | undefined): BodyShape {
  return (species && SPECIES_BODY_SHAPE[species]) || 'humanoide';
}
