import os
import time

# sets the working directory to the directory of the current file
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# the template HTML file this script reads from and adds to
templateFileLocation = "index_template.html"

# game image location, structure and order of files in this folder determines order or and within rows
gameImagLocation = "../images/games"

toggleTemplate = '''<div class="visibility-toggle {}">
    {}
    <img src="images/buttons/EyeClosed.png" draggable="false" alt="eyeball visibility toggle" loading="lazy">
</div>'''

# template string to fill in with row data
rowTemplate = '''<li id="{id}" class="row">
    <div class="cell interactable dragger">
        <div class="circle-wrapper">
            <div class="drag-circle"></div>
            <div class="drag-circle"></div>
            <div class="drag-circle"></div>
        </div>
    </div>
    <div class="cell game" style="background-image: url('images/games/{firstImage}');">
        <div class="game-filter"></div>
        <img src="images/games/{firstImage}" draggable="false" alt="selected game">
    </div>
    <div contenteditable class="gameplay cell"></div>
    <div contenteditable class="story cell"></div>
    <div contenteditable class="region cell"></div>
    <div contenteditable class="visuals cell"></div>
    <div contenteditable class="music cell"></div>
    <div class="proscons">
        <div contenteditable class="pros cell"></div>
        <div contenteditable class="cons cell"></div>
    </div>
    <div class="general non-grid-parent">
        <div contenteditable class="score cell one-liner"></div>
        <div contenteditable class="overall cell"></div>
    </div>
    <div class="team-members">
        <div class="member-a non-grid-parent egg">
            <div class="nickname cell one-liner"></div>
            <div class="member">
                <div class="member-buttons">
                    <div class="member-button interactable shiny make-shiny"></div>
                    <div class="member-button interactable repel"></div>
                </div>
            </div>
            <div class="notes cell"></div>
        </div>
        <div class="member-b non-grid-parent egg">
            <div class="nickname cell one-liner"></div>
            <div class="member">
                <div class="member-buttons">
                    <div class="member-button interactable shiny make-shiny"></div>
                    <div class="member-button interactable repel"></div>
                </div>
            </div>
            <div class="notes cell"></div>
        </div>
        <div class="member-c non-grid-parent egg">
            <div class="nickname cell one-liner"></div>
            <div class="member">
                <div class="member-buttons">
                    <div class="member-button interactable shiny make-shiny"></div>
                    <div class="member-button interactable repel"></div>
                </div>
            </div>
            <div class="notes cell"></div>
        </div>
        <div class="member-d non-grid-parent egg">
            <div class="nickname cell one-liner"></div>
            <div class="member">
                <div class="member-buttons">
                    <div class="member-button interactable shiny make-shiny"></div>
                    <div class="member-button interactable repel"></div>
                </div>
            </div>
            <div class="notes cell"></div>
        </div>
        <div class="member-e non-grid-parent egg">
            <div class="nickname cell one-liner"></div>
            <div class="member">
                <div class="member-buttons">
                    <div class="member-button interactable shiny make-shiny"></div>
                    <div class="member-button interactable repel"></div>
                </div>
            </div>
            <div class="notes cell"></div>
        </div>
        <div class="member-f non-grid-parent egg">
            <div class="nickname cell one-liner"></div>
            <div class="member">
                <div class="member-buttons">
                    <div class="member-button interactable shiny make-shiny"></div>
                    <div class="member-button interactable repel"></div>
                </div>
            </div>
            <div class="notes cell"></div>
        </div>
    </div>
    <div contenteditable class="time cell"></div>
    <div class="dropdown game-select interactable hide">
        {gameArts}
    </div>
</li>'''

# template string for the box arts
gameArtTemplate = '<img src="images/games/{}" draggable="false" alt="unselected game" loading="lazy">'



def createRowsAndToggles(gameImagLocation, rowTemplate, gameArtTemplate):
    rows = []
    toggles = []

    for folder in os.listdir(gameImagLocation):
        id = folder[folder.index("_") + 1:]
        first = None
        gameArts = []
        
        for game in os.listdir(os.path.join(gameImagLocation, folder)):
            image = os.path.join(folder, game).replace("\\","/")
            
            if(first == None):
                first = image

            gameArts.append(gameArtTemplate.format(image))

        rows.append(rowTemplate.format(id = id, firstImage = first, gameArts = "\n".join(gameArts)))
        toggles.append(toggleTemplate.format(id.lower(), id.upper()))

    return [rows, toggles]

def main(templateFileLocation):
    templateFile = open(templateFileLocation, "r")
    lines = templateFile.readlines()
    rowsIndex = next((i for i, line in enumerate(lines) if "<!--Rows-->" in line), None)
    if rowsIndex == None:
        templateFile.close()
        raise Exception("Rows comment nout found in inputFile")
    togglesIndex = next((i for i, line in enumerate(lines) if "<!--Toggles-->" in line), None)
    if rowsIndex == None:
        templateFile.close()
        raise Exception("Toggles comment nout found in inputFile")
    templateFile.close()

    filledInTemplates = createRowsAndToggles(gameImagLocation, rowTemplate, gameArtTemplate)
    lines.insert(rowsIndex + 1, "\n".join(filledInTemplates[0]))
    lines.insert(togglesIndex + 1, "\n".join(filledInTemplates[1]))

    return lines