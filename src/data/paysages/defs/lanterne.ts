import type { FamilleDeCouches } from '../types';
import { lueur } from '../lueur';

/** La lanterne d'un équipage : sa lueur de rayon `r` autour de sa flamme en `(x, y)`. */
const lanterne = (nom: string, x: number, y: number, r: number, force: number) => `<g transform="translate(0 -40)">${lueur(nom, x, y, r, force)}
    <circle cx="${x}" cy="${y}" r="3" fill="var(--gold2)"/></g>`;

/* La lanterne de chaque équipage (`equipage-…`), allumée quand le jour baisse. */
export const couches: FamilleDeCouches = [
  {
    id: 'lanterne-pied',
    label: 'Lanterne des marcheurs',
    svg: lanterne('lanterne-pied-lueur', 386, 280, 64, 0.42) },
  {
    id: 'lanterne-monture',
    label: 'Lanterne des cavaliers',
    svg: lanterne('lanterne-monture-lueur', 432, 262, 64, 0.4) },
  {
    id: 'lanterne-attelage',
    label: 'Lanterne de l’attelage',
    svg: lanterne('lanterne-attelage-lueur', 412, 266, 104, 0.5) },
  {
    id: 'lanterne-barge',
    label: 'Lanterne de la barge',
    svg: lanterne('lanterne-barge-lueur', 392, 262, 80, 0.5) },
  {
    id: 'lanterne-navire',
    label: 'Lanterne du navire',
    svg: lanterne('lanterne-navire-lueur', 452, 226, 70, 0.4) },
];
