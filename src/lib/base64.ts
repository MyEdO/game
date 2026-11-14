/**
 * Le base64 des octets (RFC 4648, section 4), dans les deux sens (#3948) : SOURCE UNIQUE de `btoa` et `atob`, que le
 * mur `murs/base64` d'`oxlint.config.mjs` refuse ailleurs. Module PUR.
 */

/** Les octets passés à `String.fromCharCode` par appel : sous la borne d'arguments d'un appel. */
const OCTETS_PAR_BLOC = 0x8000;

/** Les octets `octets` en base64. */
export function enBase64(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += OCTETS_PAR_BLOC) binaire += String.fromCharCode(...octets.subarray(i, i + OCTETS_PAR_BLOC));
  return btoa(binaire);
}

/** Les octets du texte base64 `base64` ; lève un texte qui n'est pas du base64 (`atob`). */
export function depuisBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}
