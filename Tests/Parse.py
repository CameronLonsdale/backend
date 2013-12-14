
class Parse(object):
    def __init__(self, string):
        if string[0] == "e":
            self.error = True
        elif string[0] == "s":
            self.error = False
        else:
            return
        
        self.values = string[1:].split(";")
