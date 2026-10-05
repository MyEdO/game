import type { ShieldDef } from '../types';

// Rondache : bois cerclé de fer, umbo central acier. Le bouclier « de base » + REPLI par défaut
// (`fallback`).
export const shield: ShieldDef = {
  slug: 'rond',
  label: 'Bouclier',
  target: 'rondache de bois cerclée de fer, umbo central',
  fallback: true,
  art: `<circle cx="0" cy="6" r="13" fill="#6a4a2a" stroke="#3a2818" stroke-width="1.6"/><g stroke="#3a2818" stroke-width="0.5" opacity="0.45"><line x1="-12.5" y1="6" x2="12.5" y2="6"/><line x1="0" y1="-6.6" x2="0" y2="18.6"/></g><circle cx="0" cy="6" r="13" fill="none" stroke="#8a96a8" stroke-width="1.5"/><circle cx="0" cy="6" r="3.6" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/><g fill="#cfd8e6"><circle cx="0" cy="-5" r="0.9"/><circle cx="0" cy="17" r="0.9"/><circle cx="-11" cy="6" r="0.9"/><circle cx="11" cy="6" r="0.9"/></g>`,
};
