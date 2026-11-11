/** LE FIL DE FOND DE LA PILE DES COUCHES (#3842) : chaque demande reçue (`PileDemandee`, en JSON) rend sa réponse. */
import { resoudreLaPileDUneTenue } from './pile';

addEventListener('message', (message: MessageEvent<string>) => postMessage(resoudreLaPileDUneTenue(message.data)));
