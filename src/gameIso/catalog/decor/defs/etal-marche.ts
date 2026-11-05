import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "etal-marche", render: ()=>`<g><rect x="30" y="118" width="60" height="26" fill="${P.boisFonce24}"/><rect x="30" y="112" width="60" height="8" fill="${P.boisFonce36}"/><rect x="34" y="118" width="6" height="26" fill="${P.boisSombre2}"/><rect x="80" y="118" width="6" height="26" fill="${P.boisSombre2}"/><path d="M26 88 L94 88 L88 108 L32 108 Z" fill="${P.sangMoyen4}"/><path d="M26 88 L94 88" stroke="${P.sangFonce16}" stroke-width="2"/><circle cx="48" cy="114" r="4" fill="${P.sangMoyen5}"/><circle cx="60" cy="114" r="4" fill="${P.orMoyen4}"/><circle cx="72" cy="114" r="4" fill="${P.feuillageFonce24}"/></g>` };
