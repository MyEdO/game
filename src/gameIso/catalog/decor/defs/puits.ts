import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "puits", render: ()=>`<g><ellipse cx="60" cy="142" rx="30" ry="14" fill="${P.terreFonce}"/><ellipse cx="60" cy="138" rx="23" ry="10" fill="${P.terreSombre}"/><rect x="33" y="58" width="6" height="84" fill="${P.boisSombre2}"/><rect x="81" y="58" width="6" height="84" fill="${P.boisSombre2}"/><path d="M26 60 L60 38 L94 60 Z" fill="${P.sangFonce17}"/><rect x="50" y="64" width="20" height="8" rx="2" fill="${P.boisSombre16}"/></g>` };
