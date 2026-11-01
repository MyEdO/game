import { weaponGroups, type GroupeDArmure, type GroupeDArmureId, type WeaponGroupData } from './index';
import { setDataset } from './overrides';

const armureDeFixture = (id: string, nom: string, material: GroupeDArmure['material'], couche: number, palierPA: number): GroupeDArmure => ({
  id: id as GroupeDArmureId, type: 'weaponGroups', label: `Armure de fixture (${nom})`, kind: 'armour', material, couche, palierPA,
});

/** Groupes d'armure de FIXTURE, un par matière, aux paliers de PA 0, 2 et 4 (#2948). */
export const PALIERS_DE_FIXTURE = [
  armureDeFixture('cuir-de-fixture', 'cuir', 'leather', 100, 0),
  armureDeFixture('maille-de-fixture', 'maille', 'metal', 101, 2),
  armureDeFixture('plaque-de-fixture', 'plaque', 'metal', 102, 4),
] as const satisfies readonly GroupeDArmure[];

let groupesInitiaux: WeaponGroupData[] | undefined;

/** Pose `paliers` comme SEULS Groupes d'armure à palier de PA : ceux de la donnée gardent matière, couche
 *  et art, sans palier. Restauration : `restaurerPaliersDArmure`. */
export function poserPaliersDArmure(paliers: readonly GroupeDArmure[] = PALIERS_DE_FIXTURE): void {
  groupesInitiaux ??= weaponGroups.slice();
  setDataset('weaponGroups', [...groupesInitiaux.map((g) => (g.kind === 'armour' ? { ...g, palierPA: null } : g)), ...paliers]);
}

export function restaurerPaliersDArmure(): void {
  if (!groupesInitiaux) return;
  setDataset('weaponGroups', groupesInitiaux);
  groupesInitiaux = undefined;
}
