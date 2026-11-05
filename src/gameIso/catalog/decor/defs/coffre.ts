import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "coffre", render: ()=>`<g><ellipse cx="60" cy="148" rx="32" ry="8" fill="${P.ombre}" opacity="0.22"/><rect x="30" y="118" width="60" height="30" rx="3" fill="${P.boisFonce7}"/><path d="M30 118 Q60 96 90 118 Z" fill="${P.boisFonce4}"/><path d="M30 118 Q60 100 90 118" fill="none" stroke="${P.boisSombre7}" stroke-width="2"/><path d="M44 102 L44 148 M76 102 L76 148" stroke="${P.terreMoyen2}" stroke-width="4"/><path d="M30 118 h60" stroke="${P.terreFonce}" stroke-width="3"/><rect x="54" y="124" width="12" height="12" rx="2" fill="${P.orMoyen}"/><circle cx="60" cy="130" r="2.4" fill="${P.boisSombre22}"/></g>` };
