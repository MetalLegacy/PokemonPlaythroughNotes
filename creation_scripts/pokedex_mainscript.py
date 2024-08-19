import requests
import os
import sys
import re
import time
from pprint import pp
import row_subscript

# use this to parse the html, don't even have to write it to a file, just save the text to a string
from bs4 import BeautifulSoup

# sets the working directory to the directory of the current file
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# used to stop execution of processGeneration() at a specific mon, used for testing, MAKE None TO DOWNLOAD ALL
stopAtMon = None

# used to start execution of processGeneration() at a specific mon, MAKE None TO DOWNLOAD ALL
startAtMon = None

# used to stop execution of createPokedexElements() after the first gen, MAKE false TO PROCESS ALL GENS
onlyGenOne = False

# used to control whether or not the images of the mons and their forms are saved locally
saveImages = True

# the template HTML file this script reads from and adds to
inputFileLocation = "index_template.html"

# the HTML file this script outputs to ALL CONTENT WITHIN THIS FILE WILL GET OVERWRITTEN
outputFileLocation = "..\\index.html"

# images folder
normalPath = os.path.abspath("../images/pokemon/normal")
shinyPath = os.path.abspath("../images/pokemon/shiny")

# pokemondb's url
db = "https://pokemondb.net"

# current index of mon array, used for the name of the downloaded .png files
i = 0

# used to change a mon's gen if it is a regional form
regionalFormGens = {
    "alolan" : 7,
    "galarian" : 8,
    "hisuian" : 8,
    "paldean" : 9
}

# template string for parent container div
containerDiv = '<div id="{}" class="mon-container{}">'

# template string for image div
imageDiv = '<img src="images/pokemon/normal/{file}" class="pokedex-img" alt="{alt}" title="{alt}" data-species="{species}" data-type-a="{typeA}" data-type-b="{typeB}" data-gen="{gen}" >'

# holds all the text that will be written to the html file
output = [containerDiv.format("all-mons", "")]

# holds all the text for the forms that will be written to the html file
outputForms = []

# holds the names of mons that have multiple forms but not a "main" form, need to check which is the default
noMainForm = []


def createPokedexElements():
    spritesURL = db + "/sprites"
    spritesHTML = retrieveHtmlFromPage(spritesURL)
    soup = BeautifulSoup(spritesHTML, "html.parser")

    download = True if startAtMon == None else False

    gens = soup.findAll("h2")
    genNum = 1
    for gen in gens:
        download = processGeneration(gen, genNum, download)
        if onlyGenOne:
            break
        genNum += 1


def retrieveHtmlFromPage(url):
    response = requests.get(url)
    if response.status_code == 200:
        return response.text
    else:
        print("Failed to retrieve the HTML content. Status code:", response.status_code)
        sys.exit()


def processGeneration(gen, genNum, download):
    global i
    mons = gen.findNext("div")
    for mon in mons.find_all("a", class_="infocard"):
        i = i + 1
        if not download and startAtMon in mon["href"]:
            download = True
        if download:
            processPokemon(mon["href"], genNum)
            if stopAtMon != None and stopAtMon in mon["href"]:
                break
    
    return download


def processPokemon(subdirectory, genNum):
    global i

    monURL = db + subdirectory
    monHTML = retrieveHtmlFromPage(monURL)
    soup = BeautifulSoup(monHTML, "html.parser")

    monName = soup.title.string
    if "(" in monName:
        monName = monName[: monName.index(" (")]
    else:
        monName = monName[: monName.index(" sprites")]

    imageURLs = getImageURLs(soup)
    forms = getForms(imageURLs)

    formattedForms = formatFormNames(forms)
    imageLocations = [str(i) + form + ".png" for form in forms]

    typings = getTypes(formattedForms, soup, monName)

    forms = {}
    for x in range(len(formattedForms)):
        formGen = genNum
        form = formattedForms[x]
        for key in regionalFormGens.keys():
            if key in form:
                formGen = regionalFormGens[key]
                break

        typing = typings[x]
        forms[formattedForms[x]] = {
            "img": imageLocations[x],
            "typeA": typing[0].lower(),
            "typeB": typing[1].lower() if len(typing) == 2 else None,
            "gen": formGen
        }

    global output

    forms = formatFormsForAltText(forms)

    main = None
    if "main" in forms:
        main = forms["main"]
    else:
        # if a "main" form doesn't exist, just use the first one in the dict
        main = forms[next(iter(forms))]
        global noMainForm
        noMainForm.append(monName)

    output.append(imageDiv.format(file = main["img"], alt = monName, species = monName, typeA = main["typeA"], typeB = main["typeB"], gen = main["gen"]))

    if len(forms) > 1:
        global outputForms

        formDivs = [containerDiv.format(monName, " hide")]
        formDivs.append(imageDiv.format(file = main["img"], alt = main["alt"], species = monName, typeA = main["typeA"], typeB = main["typeB"], gen = main["gen"]))

        for formName in forms:
            form = forms[formName]
            if form == main:
                continue
            formDivs.append(imageDiv.format(file = form["img"], alt = form["alt"], species = monName, typeA = form["typeA"], typeB = form["typeB"], gen = form["gen"]))
        
        outputForms.append("\n".join(formDivs))


def formatFormsForAltText(forms):
    for form in forms:
        forms[form]["alt"] = form.replace("-", " ").title()

    if "main" in forms:
        if "f" in forms:
            forms["f"]["alt"] = "Female"
            forms["main"]["alt"] = "Male"
        else:
            forms["main"]["alt"] = "Original"

    return forms

def getTypes(imageForms, spriteSoup: BeautifulSoup, monName):
    dexURL = db + spriteSoup.find("main").findNext("div").findNext("a")["href"]
    dexHTML = retrieveHtmlFromPage(dexURL)
    dexSoup = BeautifulSoup(dexHTML, "html.parser")

    tabs = (
        dexSoup.find("div", id="dex-basics")
        .findNext("div")
        .findChild("div")
        .findChildren("a")
    )
    tabDivs = [dexSoup.find("div", id=tab["href"][1:]) for tab in tabs]
    typings = [
        [a.string for a in div.find("th", string="Type").parent.find_all("a")]
        for div in tabDivs
    ]

    dexForms = [tab.string for tab in tabs]

    content = []
    for imgForm in imageForms:
        form = None
        for dexForm in dexForms:
            searchForm = dexForm.replace(" " + monName, "").lower()
            if searchForm in imgForm.replace("-", " "):
                form = dexForm
                break
        if form == None:
            form = dexForms[0]
        content.append(typings[dexForms.index(form)])

    return content


def formatFormNames(forms):
    m = "main"

    if len(forms) == 1:
        return [m]

    name = longestCommonSubstring(forms)

    formatted = [re.sub(name, "", form) for form in forms]
    formatted = [
        m if form == "" else form[1:] if form[0] == "-" else form for form in formatted
    ]

    return formatted


def longestCommonSubstring(strings):
    if not strings:
        return ""

    # Find the shortest string in the list
    shortest = min(strings, key=len)

    max_length = 0
    end_index = 0

    # Iterate over the characters of the shortest string
    for i in range(len(shortest)):
        for j in range(i + 1, len(shortest) + 1):
            substring = shortest[i:j]
            # Check if the substring is present in all other strings
            if all(substring in s for s in strings):
                length = len(substring)
                if length > max_length:
                    max_length = length
                    end_index = j

    return shortest[end_index - max_length : end_index]


def getForms(imageURLs):
    suffixes = []

    for url in imageURLs:
        suffix = "-" + re.search("(?<=normal\\/).*(?=.png)", url).group()
        imageName = str(i) + suffix

        if saveImages:
            # if there is no shiny image for the form, stop processing the form
            # only example thus far is stellar terapagos
            if saveImageFromURL(re.sub("/normal/", "/shiny/", url), shinyPath, imageName):
                saveImageFromURL(url, normalPath, imageName)
                suffixes.append(suffix)

    return suffixes

def saveImageFromURL(url, directory, filename, extension = ".png"):
    filename = filename + extension
    response = requests.get(url)
    if response.status_code == 200:
        full_path = os.path.join(directory, filename)
        with open(full_path, "wb") as f:
            f.write(response.content)
        return True
    else:
        print(f"Failed to download image {url}. Status code: {response.status_code}")
        return False

def getImageURLs(soup: BeautifulSoup):
    home = soup.find("td", string="Home ")
    forms = home.findNext("td")

    urls = [a["href"] for a in forms.findChildren("a")]

    return urls



if __name__ == "__main__":
    print("START")

    lines = row_subscript.main(inputFileLocation)

    pokedexIndex = next((i for i, line in enumerate(lines) if "<!--Pokedex-->" in line), None)
    if pokedexIndex == None:
        raise Exception("Pokedex comment nout found in inputFile")

    startTime = time.time()

    createPokedexElements()

    print("\nPokedex populated in: " + str((time.time() - startTime)) + " seconds\n")
    print("These mons had no main form:")
    print("\n".join(noMainForm))
    print()
    
    outputString = "\n".join(output) + "\n</div>\n"
    outputString += "\n</div>\n".join(outputForms) + "\n</div>\n"

    lines.insert(pokedexIndex + 1, outputString)

    outputFile = open(outputFileLocation, "w+", encoding="utf-8")
    outputFile.writelines(lines)

    outputFile.close()

    print("END")