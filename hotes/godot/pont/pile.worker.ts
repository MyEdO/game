/** LE FIL DE FOND DE LA PILE DES COUCHES (#3842) : chaque demande reçue (`PileDemandee`, en JSON) rend sa réponse. */
import { resoudreLaPileDUneTenue } from './pile';

const fil = globalThis as { addEventListener?: (type: 'message', ecouteur: (message: MessageEvent<string>) => void) => void };
fil.addEventListener?.('message', (message) => postMessage(resoudreLaPileDUneTenue(message.data)));
