"""Collections synthétiques partagées des tests de rig."""


class Bones(dict):
    """`rig.data.bones` : ordre d'insertion, appartenance et accès par nom."""
    def __init__(self, os):
        super().__init__((b.name, b) for b in os)

    def __iter__(self):
        return iter(self.values())
