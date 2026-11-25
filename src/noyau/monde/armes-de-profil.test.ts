import { describe, expect, it } from 'vitest';

import { armesChoisissables, findCreatureById } from '../../data';
import { attackModifiers, combatBaseValue } from '../../engine/combat';
import { meleeReachRank, reachTiles } from '../../engine/engagement';
import { loadoutSetActive, recomputeLoadout } from '../../engine/items';
import { ligneDe } from '../../engine/modLine.testkit';
import { rapideParryMod, resolveQualities } from '../../engine/qualities/dispatch';
import { refDeRegle } from '../../engine/reglesChiffrees';
import { testValue } from '../../engine/skills';
import { emplacementsDeDotation, porteurDuProfil, valeursDeLEmplacement } from '../../engine/trappingChoices';
import type { Combatant, ReachValue, Weapon } from '../../engine/types';
import { effectiveWeaponRange } from '../../engine/weaponDamage';
import { spawnEnemy } from './spawn';

const porteur = (ref: string): Combatant => spawnEnemy({ ref }, ref, undefined);

const armesSansDegatsDeCatalogue = [
  ['gobelin-des-forets', 'lance-de-fortune', 6],
  ['chamane-gobelin-des-forets', 'baton-de-la-deesse-araignee', 8],
  ['troll-des-rivieres', 'merlin-grossier', 9],
  ['sorciere-troll-des-rivieres', 'baton-en-bois-mort', 10],
  ['elementaire-incarne-du-feu', 'enorme-epieu', 10],
] as const;

const modDeTaille = (c: Combatant, arme: Weapon): number | undefined =>
  ligneDe(attackModifiers(c, null, arme, { kind: 'melee' }), refDeRegle('possession-pas-a-sa-taille'))?.value;

function armeDuCatalogue(c: Combatant, id: string): Weapon {
  const active = c.weapons.find((arme) => arme.trappingId === id);
  if (active) return active;

  const objet = c.items?.find((item) => item.trappingId === id);
  if (!objet) throw new Error(`${c.id} : arme ${id} absente`);

  const panoplie = c.loadouts?.find(({ main, secondaire }) => main === objet.uid || secondaire === objet.uid);
  if (!panoplie) throw new Error(`${c.id} : arme ${id} absente des panoplies`);

  loadoutSetActive(c, panoplie.id);
  recomputeLoadout(c);
  const sortie = c.weapons.find((arme) => arme.uid === objet.uid);
  if (!sortie) throw new Error(`${c.id} : arme ${id} impossible à équiper`);
  return sortie;
}

function verifierProfil(arme: Weapon, indice: number, qualites: readonly string[], allonge?: ReachValue): void {
  expect(arme.damage).toMatchObject({ plusBF: false, flat: indice });
  expect(resolveQualities(arme).map(({ id }) => id).sort()).toEqual([...qualites].sort());
  if (allonge) expect(arme.reach).toBe(allonge);
}

describe('Armes de catalogue des statblocs (#4382)', () => {
  // Guide de Frenchy, chap. 26, lignes 153, 163, 186, 195, 882, 887, 907, 912
  it.each([
    ['batelier', 'arme-simple', 40],
    ['nautonier', 'arme-simple', 50],
    ['moine-novice-de-taal', 'lance', 35],
    ['moine-de-taal', 'lance', 40],
  ] as const)('%s garde son score avec la spécialisation imprimée', (id, trapping, score) => {
    const c = porteur(id);
    expect(combatBaseValue(c, 'melee', armeDuCatalogue(c, trapping))).toBe(score);
  });

  // Guide de Frenchy, chap. 26, lignes 827, 832 ; Guide de Frenchy, chap. 51, lignes 350, 354
  it.each([
    ['grande-pretresse-de-rhya', 35],
    ['seigneur-du-changement-exalte-de-tzeentch', 130],
  ] as const)('%s garde son score de Mêlée pour chaque spécialisation tirée', (id, score) => {
    const specialisations = new Set<string | undefined>();
    for (const suffixe of [0, 1, 2, 3]) {
      const c = spawnEnemy({ ref: id }, `${id}-${suffixe}`, undefined);
      const arme = armeDuCatalogue(c, 'arme-simple');
      specialisations.add(c.skills.find((s) => s.id === 'corps-a-corps')?.spec);
      expect(arme.subType).toBe('base');
      expect(combatBaseValue(c, 'melee', arme)).toBe(score);
    }
    expect(specialisations.size).toBeGreaterThan(1);
  });

  // Guide de Frenchy, chap. 26, lignes 295, 322, 353, 400, 632, 674, 759, 787, 827 ; LDB 08 l.3602 ; LDB 67 l.5
  it.each([
    'herboriste', 'maistre-herboriste', 'rebouteux', 'maitre-des-taillis',
    'druide-de-la-foi-antique', 'haut-druide-de-la-foi-antique',
    'religieuse-de-rhya', 'pretresse-de-rhya', 'grande-pretresse-de-rhya',
  ])('Faucille : %s', (id) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'arme-simple'), 7, [], 'Moyenne');
  });

  // Guide de Frenchy, chap. 22, lignes 297, 324 ; Guide de Frenchy, chap. 26, lignes 94, 122 ; AA 08 l.255
  it.each([
    'marchand-habitants-des-villes', 'maistre-marchand-habitants-des-villes',
    'marchand-habitants-des-champs', 'maistre-marchand-habitants-des-champs',
  ])('Nerf de bœuf : %s', (id) => {
    const c = porteur(id);
    const arme = armeDuCatalogue(c, 'matraque-2');
    expect(c.items?.some((objet) => objet.uid === arme.uid)).toBe(true);
    verifierProfil(arme, 5, [], 'Courte');
  });

  // Guide de Frenchy, chap. 26, lignes 153, 186
  it.each([
    ['batelier', 8],
    ['nautonier', 9],
  ] as const)('Crochet / Grappin : %s', (id, indice) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'arme-simple'), indice, ['inoffensive'], 'Courte');
  });

  // MDG 16 l.362,364,405,407 ; LDB 73 l.19
  it.each([
    ['jaego-roth', 6],
    ['long-drong-silver', 8],
  ] as const)('Crochet de prothèse : %s', (id, indice) => {
    const c = porteur(id);
    const prothese = c.items?.find((objet) => objet.trappingId === 'crochet');
    expect(prothese).toBeDefined();
    const crochet = c.weapons.find((arme) => arme.derivedFromItem === prothese?.uid);
    expect(crochet).toBeDefined();
    verifierProfil(crochet!, indice, [], 'Très courte');
  });

  // Guide de Frenchy, chap. 65, lignes 27, 70 ; Guide de Frenchy, chap. 66, ligne 41 ; Guide de Frenchy, chap. 67, ligne 25 ; LDB 62 l.89
  it.each([
    ['jeune-gobelin', 2, 6],
    ['gobelin-hcvm', 3, 9],
    ['snotling-hcvm', 2, 4],
    ['jeune-orc', 3, 9],
  ] as const)('Projectile improvisé : %s', (id, indice, portee) => {
    const arme = armeDuCatalogue(porteur(id), 'rocher');
    verifierProfil(arme, indice, ['inoffensive']);
    expect(effectiveWeaponRange(arme, undefined, 0)).toBe(portee);
  });

  // Guide de Frenchy, chap. 26, lignes 219, 221, 223, 253, 255, 257 ; LDB 62 l.25,88
  it.each([
    ['riverain', []],
    ['riverain-respecte', ['empaleuse']],
  ] as const)('Lance : %s', (id, qualitesDeMelee) => {
    const c = porteur(id);
    verifierProfil(armeDuCatalogue(c, 'lance'), 7, qualitesDeMelee, 'Longue');
    const lancer = armeDuCatalogue(c, 'javelot');
    verifierProfil(lancer, 6, ['empaleuse']);
    expect(effectiveWeaponRange(lancer, undefined, 0)).toBe(9);
  });

  // Guide de Frenchy, chap. 26, lignes 882, 907 ; LDB 62 l.25
  it.each(['moine-novice-de-taal', 'moine-de-taal'])('Épieu : %s', (id) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'lance'), 7, ['empaleuse'], 'Moyenne');
  });

  // Guide de Frenchy, chap. 67, lignes 193, 253
  it.each([
    ['chef-de-clan-orc', 11],
    ['chef-de-guerre-orc', 12],
  ] as const)('Tranchoir : %s', (id, indice) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'arme-simple'), indice, ['devastatrice', 'taille'], 'Longue');
  });

  // Guide de Frenchy, chap. 45, lignes 36, 77, 127
  it.each([
    ['guerrier-du-chaos-hcvm', 11, ['devastatrice', 'taille']],
    ['guerrier-du-chaos-chef-de-bande', 15, ['devastatrice', 'magique', 'taille']],
    ['guerrier-du-chaos-chef-de-guerre', 16, ['devastatrice', 'magique', 'taille']],
  ] as const)('Grand tranchoir : %s', (id, indice, qualites) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'grande-hache'), indice, qualites, 'Longue');
  });

  // Guide de Frenchy, chap. 75, lignes 138, 266
  it.each([
    ['spectre', 9],
    ['ombre-vengeresse', 13],
  ] as const)('Faux : %s', (id, indice) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'hallebarde'), indice, ['defensive', 'taille'], 'Longue');
  });

  // Guide de Frenchy, chap. 51, lignes 272, 350 ; LDB 62 l.163-164
  it.each([
    ['seigneur-du-changement-de-tzeentch', 10, 'Longue', 1],
    ['seigneur-du-changement-exalte-de-tzeentch', 12, 'Très longue', 2],
  ] as const)('Sceptre ailé : %s', (id, indice, allonge, cases) => {
    const arme = armeDuCatalogue(porteur(id), 'arme-simple');
    verifierProfil(arme, indice, [], allonge);
    expect(reachTiles(arme, 2)).toBe(cases);
  });

  it('les trois armes de Moritz ont une panoplie (MCLB 02 l.698 ; LDB 62 l.39-40 ; AA 08 l.188,209)', () => {
    const c = porteur('moritz-valgeir');
    verifierProfil(armeDuCatalogue(c, 'arme-simple'), 8, [], 'Moyenne');
    verifierProfil(armeDuCatalogue(c, 'marteau-a-bec-de-corbin'), 9, ['assommante'], 'Longue');
    verifierProfil(armeDuCatalogue(c, 'lance-de-cavalerie'), 10, ['empaleuse', 'percutante'], 'Très longue');
  });

  it('Grosse chope : arme simple (ZI 04 l.46,48)', () => {
    const arme = armeDuCatalogue(porteur('l-abominable-halagrundsor'), 'grosse-chope');
    verifierProfil(arme, 10, [], 'Moyenne');
    expect(arme.sizeFor).toBe('enorme');
  });

  // ZI 01 l.153,167 ; ZI 05 l.122,138 ; VDM 13 l.24,26
  it.each(armesSansDegatsDeCatalogue)('L’arme de profil %s garde l’Indice imprimé et son Allonge indéterminée', (id, trapping, indice) => {
    const arme = armeDuCatalogue(porteur(id), trapping);
    verifierProfil(arme, indice, []);
    expect(meleeReachRank(arme)).toBeNull();
  });

  // ZI 04 l.46,48 ; ZI 05 l.122,138 ; VDM 13 l.24,26 ; Guide de Frenchy, chap. 51, lignes 272, 350 ; ADE II 02 l.651,757
  it.each([
    ['troll-des-rivieres', 'merlin-grossier'],
    ['sorciere-troll-des-rivieres', 'baton-en-bois-mort'],
    ['seigneur-du-changement-de-tzeentch', 'arme-simple'],
    ['seigneur-du-changement-exalte-de-tzeentch', 'arme-simple'],
    ['l-abominable-halagrundsor', 'grosse-chope'],
    ['elementaire-incarne-du-feu', 'enorme-epieu'],
  ] as const)('%s utilise son arme de profil sans malus de Taille', (id, trapping) => {
    const c = porteur(id);
    expect(modDeTaille(c, armeDuCatalogue(c, trapping))).toBeUndefined();
  });

  it('une dague de taille ordinaire inflige encore le malus à un grand porteur (ADE II 02 l.757)', () => {
    const c = spawnEnemy({ ref: 'troll-des-rivieres' }, 'troll-dague', undefined, { inventaire: { dague: true } });
    expect(modDeTaille(c, armeDuCatalogue(c, 'dague'))).toBe(-20);
  });

  // ZI 02 l.163 ; ZI 04 l.174-176 ; LDB 62 l.39,127
  it.each([
    ['gobelin-de-la-nuit', 7],
    ['chef-de-meute-du-clan-moulder', 8],
  ] as const)('Lames de base : %s', (id, indice) => {
    verifierProfil(armeDuCatalogue(porteur(id), 'arme-simple'), indice, [], 'Moyenne');
  });

  it('Plume employée comme arme improvisée (VDM 15 l.155 ; LDB 62 l.31 ; LDB 67 l.5)', () => {
    verifierProfil(armeDuCatalogue(porteur('p-tarix-celui-qui-ecrit'), 'arme-improvisee'), 9, ['inoffensive'], 'Variable');
  });

  it('Lame spectrale du revenant : l’Atout Empaleuse est propre à l’attaque du profil (ZI 13 l.174-176)', () => {
    const lame = armeDuCatalogue(porteur('chevalier-mort-vivant-revenant'), 'arme-simple');
    verifierProfil(lame, 9, ['empaleuse'], 'Moyenne');
    verifierProfil(armeDuCatalogue(porteur('gobelin-de-la-nuit'), 'arme-simple'), 7, [], 'Moyenne');
  });

  // The Horned Rat Companion 04 l.40,43,73-77 ; Guide de Frenchy, chap. 57, lignes 42, 53, 92, 122, 193, 229, 307, 343
  it.each([
    ['coureur-nocturne', 50],
    ['coureur-d-egouts', 80],
    ['assassin', 100],
    ['maitre-assassin', 120],
  ] as const)('Griffes de Poing : %s', (id, bagarre) => {
    const c = porteur(id);
    const arme = armeDuCatalogue(c, 'griffes-de-poing');
    verifierProfil(arme, 6, ['defensive', 'rapide'], 'Très courte');
    expect(arme.natural).toBeUndefined();
    expect(combatBaseValue(c, 'melee', arme)).toBe(bagarre);
    expect(rapideParryMod(arme, armeDuCatalogue(porteur('skaven'), 'arme-simple'))).toBe(-10);
  });

  it('la possession des Griffes de Poing ajoute +10 aux Tests d’Escalade (The Horned Rat Companion 04 l.43)', () => {
    const sans = porteur('coureur-nocturne');
    const avec = spawnEnemy({ ref: 'coureur-nocturne' }, 'porteur-griffes', undefined, {
      inventaire: { 'griffes-de-poing': true },
    });
    const escalade = { skill: { id: 'escalade' } };
    expect(avec.weapons.some((arme) => arme.trappingId === 'griffes-de-poing')).toBe(true);
    expect(testValue(avec, escalade) - testValue(sans, escalade)).toBe(10);
  });

  it('le joker exclut les armes sans Dégâts de catalogue et réserve les Griffes au clan Eshin (The Horned Rat Companion 04 l.40,77)', () => {
    const armes = armesChoisissables();
    expect(armes.find(({ id }) => id === 'griffes-de-poing')).toMatchObject({ reserveeA: 'clan-eshin' });
    expect(armesSansDegatsDeCatalogue.some(([, id]) => armes.some((arme) => arme.id === id))).toBe(false);

    const [joker] = emplacementsDeDotation([{ wildcard: 'arme' }]);
    const eshin = porteurDuProfil(findCreatureById('coureur-nocturne')!);
    const skaven = porteurDuProfil(findCreatureById('skaven')!);
    expect(valeursDeLEmplacement(joker, eshin)).toContain('griffes-de-poing');
    expect(valeursDeLEmplacement(joker, skaven)).not.toContain('griffes-de-poing');
  });

  it('Griffes & Crocs restent une attaque naturelle qui coexiste avec l’arme tenue', () => {
    const c = porteur('skaven');
    expect(c.weapons).toContainEqual(expect.objectContaining({ label: 'Griffes & Crocs', natural: true, damage: { plusBF: false, flat: 5, bfInclus: true } }));
    expect(c.weapons.some((arme) => arme.trappingId === 'arme-simple')).toBe(true);
  });
});
