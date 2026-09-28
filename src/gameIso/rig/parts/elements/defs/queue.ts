import type { AppearanceElement } from '../types';
export const element: AppearanceElement = {
  key: 'queue', label: 'Queue', category: 'trait',
  // queue ORIENTÉE du registre (id) — résolue par vue via viewOrFront, comme partout.
  overlays: [{ bone: 'bassin', appendage: 'queue-generique', svg: '', scale: 'bone', layer: -2 }],
};
