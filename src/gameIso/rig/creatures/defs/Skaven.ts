import type { CreatureDef } from '../types';

// Le skaven GÉNÉRIQUE (guerrier des clans). Les variantes ont leur def dédié testé AVANT
// (priorité < 18) : Rat ogre (brute), Vermine de choc.
export const creature: CreatureDef = {
  label: "Skaven",
  id: "skaven",
  plan: 'biped',
};
