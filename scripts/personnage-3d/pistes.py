"""Pistes d'animation d'une action Blender : ses sacs de F-curves et la pose de la scène à un instant."""
import math


def sacs(action):
    """Les sacs de F-curves d'une action en couches (Blender 5)."""
    return [sac for couche in action.layers for bande in couche.strips for slot in action.slots
            if (sac := bande.channelbag(slot))]


def aller_a(scene, image):
    """Pose `scene` à l'image `image`, sous-image comprise."""
    scene.frame_set(math.floor(image), subframe=image - math.floor(image))
