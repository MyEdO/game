import type { FamilleDeCouches } from '../types';

/** Une brume à la teinte du moment `m`, de `haut` à `bas`, nulle en haut, d'opacité `force` dès `plein` de sa hauteur. */
const brume = (nom: string, m: string, haut: number, bas: number, plein: number, force: number) => `
    <defs><linearGradient id="${nom}-fondu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brume-${m})" stop-opacity="0"/><stop offset="${plein}" stop-color="var(--brume-${m})" stop-opacity="${force}"/><stop offset="1" stop-color="var(--brume-${m})" stop-opacity="${force}"/></linearGradient></defs>
    <rect x="0" y="${haut}" width="1600" height="${bas - haut}" fill="url(#${nom}-fondu)"/>`;

/** La brume haute, entre les montagnes et les collines. */
const haute = (nom: string, m: string, force: number) => brume(nom, m, 390, 580, 1, force);
/** La brume basse, sous la lisière, qui couvre aussi l'eau jusqu'au bas du cadre. */
const basse = (nom: string, m: string, force: number) => brume(nom, m, 480, 900, 0.3, force);

/* La brume entre deux plans du paysage, à la teinte du moment du jour (`TEINTE_DU_MOMENT`, `src/hote/ecran.ts`) : c'est
   elle qui porte l'heure. */
export const couches: FamilleDeCouches = [
  {
    id: 'brume-haute-aube', label: 'Brume haute d’aube', svg: haute('brume-haute-aube', 'aube', 0.55) },
  {
    id: 'brume-basse-aube', label: 'Brume basse d’aube', svg: basse('brume-basse-aube', 'aube', 0.45) },
  {
    id: 'brume-haute-jour', label: 'Brume haute de jour', svg: haute('brume-haute-jour', 'jour', 0.45) },
  {
    id: 'brume-basse-jour', label: 'Brume basse de jour', svg: basse('brume-basse-jour', 'jour', 0.14) },
  {
    id: 'brume-haute-soir', label: 'Brume haute du soir', svg: haute('brume-haute-soir', 'soir', 0.5) },
  {
    id: 'brume-basse-soir', label: 'Brume basse du soir', svg: basse('brume-basse-soir', 'soir', 0.42) },
  {
    id: 'brume-haute-nuit', label: 'Brume haute de nuit', svg: haute('brume-haute-nuit', 'nuit', 0.55) },
  {
    id: 'brume-basse-nuit', label: 'Brume basse de nuit', svg: basse('brume-basse-nuit', 'nuit', 0.6) },
];
