import type { WeaponDef } from '../types';

/** Épée générique (forme par défaut du Groupe « Base » + défaut final de `weaponPart`).
 *  ART ORIENTÉ : front / dos (lame grise mate) / profil (fine), garde dorée. */
export const weapon: WeaponDef = {
  slug: "epee",
  label: "Épée",
  type: "melee",
  group: "Base",
  target: "épée à une main, lame droite, garde dorée",
  art: {
    front: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
    back: `<rect x="-1.5" y="-2" width="3" height="6" fill="#4a3320"/><rect x="-1" y="-30" width="2" height="28" fill="#6a7384"/>`,
    profile: `<rect x="-1.2" y="-2" width="2.4" height="6" fill="#5a3f24"/><rect x="-0.8" y="-30" width="1.6" height="28" fill="url(#g_steel)"/>`,
  },
};
