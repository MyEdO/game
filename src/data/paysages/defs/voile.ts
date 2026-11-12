import type { FamilleDeCouches } from '../types';

/* Le voile que le moment du jour pose sur le relief, sous l'équipage et ses lanternes. */
export const couches: FamilleDeCouches = [
  {
    id: 'voile-aube',
    label: 'Voile de l’aube',
    svg: `<rect x="0" y="84" width="960" height="276" fill="var(--ciel-aube-bas)" opacity="0.1"/>` },
  {
    id: 'voile-soir',
    label: 'Voile du soir',
    svg: `<rect x="0" y="84" width="960" height="276" fill="var(--ciel-soir-haut)" opacity="0.28"/>` },
  {
    id: 'voile-nuit',
    label: 'Voile de la nuit',
    svg: `<rect x="0" y="84" width="960" height="276" fill="var(--ciel-nuit-haut)" opacity="0.55"/>` },
];
