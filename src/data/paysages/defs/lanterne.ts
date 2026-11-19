import type { FamilleDeCouches } from '../types';
import { auCadreDeLEau } from '../formes';
import { lueur } from '../lueur';

/** La lanterne d'un équipage à terre : sa lueur de rayon `r` autour de sa flamme en `(x, y)`, son corps et son chapeau. */
const lanterne = (nom: string, x: number, y: number, r: number) => `${lueur(nom, x, y, r, 0.62)}
    <rect x="${x - 5}" y="${y - 7}" width="10" height="13" rx="2" fill="var(--astre)"/>
    <path d="M${x - 7} ${y - 8}h14l-3 -5h-8zM${x - 7} ${y + 7}h14" stroke="var(--bg)" stroke-width="2" fill="var(--bg)"/>`;

/** La lanterne d'un bateau, du cadre d'avant : sa lueur de rayon `r` autour de sa flamme en `(x, y)`. */
const lanterneDAvant = (nom: string, x: number, y: number, r: number, force: number) => auCadreDeLEau(`<g transform="translate(0 -40)">${lueur(nom, x, y, r, force)}
    <circle cx="${x}" cy="${y}" r="3" fill="var(--gold2)"/></g>`);

/* La lanterne de chaque équipage (`equipage-…`), allumée quand le jour baisse : seule lumière de la scène. */
export const couches: FamilleDeCouches = [
  {
    id: 'lanterne-pied',
    label: 'Lanterne des marcheurs',
    svg: lanterne('lanterne-pied-lueur', 920, 530, 130) },
  {
    id: 'lanterne-monture',
    label: 'Lanterne des cavaliers',
    svg: lanterne('lanterne-monture-lueur', 836, 548, 130) },
  {
    id: 'lanterne-attelage',
    label: 'Lanterne de la diligence',
    svg: lanterne('lanterne-attelage-lueur', 907, 494, 170) },
  {
    id: 'lanterne-barge',
    label: 'Lanterne de la barge',
    svg: lanterneDAvant('lanterne-barge-lueur', 392, 262, 80, 0.5) },
  {
    id: 'lanterne-navire',
    label: 'Lanterne du navire',
    svg: lanterneDAvant('lanterne-navire-lueur', 452, 226, 70, 0.4) },
];
