/*jshint esversion: 8 */
window.addEventListener("load", pageSetup);

// stores opened dropdowns and related elements to undo them later
let openDropdown = null;
let selectedGame = null;
let selectedMember = null;
let invisibleTriangle = null;

// stores the order mon-containers were opened in the Pokedex to be able to go back
let monContainerStack = [];

// stores inputted data between sessions
let db = new Dexie("SaveData");

const timer = new Worker("workers/autosave_timer.js");

// used to bypass dropdown ancestor check in closeOpenDropdown()
const forceClose = { target: { closest: function () { return null; } } };

async function pageSetup() {
    await loadSaveData();
    addEventListeners();
    doneLoading();
}

function doneLoading() {
    let body = document.querySelector("body");
    body.classList.remove("no-scroll");
    body.querySelector("#loading-screen").classList.add("invisible");
}

function addEventListeners() {
    windowEvents();

    document.querySelectorAll(".game").forEach(game => {
        game.addEventListener("click", openGameSelect);
    });

    document.querySelectorAll(".game-select").forEach(gameSelect => {
        gameSelect.addEventListener("click", handleGameSelectClick);
    });

    document.querySelectorAll(".member").forEach(buttons => {
        buttons.addEventListener("click", handleMemberClick);
    });

    document.querySelectorAll('[contenteditable=""]').forEach(div => {
        if (div.matches(".one-liner")) {
            div.addEventListener("keydown", preventNewLine);
        }

        if (div.matches(".time")) {
            div.addEventListener("keydown", timeKeyManagement);
            div.addEventListener("keyup", validateTime);
        } else {
            div.addEventListener("keyup", saveTextAfterTimer);
            div.addEventListener("blur", saveTextNow);
        }

        div.addEventListener("focus", selectAllText);
    });

    document.querySelectorAll(".nickname, .notes").forEach(div => {
        div.addEventListener("keyup", saveTextAfterTimer);
        div.addEventListener("blur", saveTextNow);
        div.addEventListener("focus", selectAllText);
    });

    let pokedex = document.querySelector("#pokedex");
    pokedex.addEventListener("click", handlePokedexClick);

    pokedex.querySelector("#pokedex-search").addEventListener("input", processSearchboxInput);

    let gameHeader = document.getElementById("game-header");
    gameHeader.addEventListener("click", openHeaderDropdown);
    gameHeader.querySelector("#visibility-toggles").addEventListener("click", handleVisibilityClick);

    document.getElementById("team-header").addEventListener("click", openHeaderDropdown);
}

function windowEvents() {
    // true ensures this triggers before all other events
    window.addEventListener("click", closeDropdown, true);

    resizeListeners();

    dragAndDropRows();
}

function resizeListeners() {
    window.addEventListener("resize", resizeGameSelects);
    window.addEventListener("resize", resizeDraggerCircles);
    window.addEventListener("resize", resizePokedex);
    resizeGameSelects();
    resizeDraggerCircles();
    resizePokedex();
}

function closeDropdown(event) {
    // If the clicked element is a descendent of a .dropdown, leave it open
    if (event.target.closest(".dropdown") != null) {
        return;
    }

    if (selectedGame != null) {
        selectedGame.classList.remove("selected-game");
        selectedGame = null;
    }
    if (selectedMember != null) {
        selectedMember.classList.remove("selected-member");
        selectedMember = null;
    }
    if (invisibleTriangle != null) {
        invisibleTriangle.classList.remove("invisible");
        invisibleTriangle = null;
    }
    if (openDropdown != null) {
        openDropdown.classList.add("hide");
        openDropdown = null;
    }
}

function selectAllText(event) {
    const range = document.createRange();
    const selection = window.getSelection();

    selection.removeAllRanges();

    range.selectNodeContents(event.target);
    selection.addRange(range);
}

function resizeGameSelects() {
    let width = document.querySelector(".game>img").width;
    document.querySelectorAll(".game-select").forEach(gameSelect => {
        positionGameSelect(gameSelect);

        gameSelect.querySelectorAll("img").forEach(selectImg => {
            selectImg.width = width;
        });
    });
}

function resizeDraggerCircles() {
    let width = Math.floor(document.querySelector(".dragger").clientWidth * 0.4);
    document.querySelectorAll(".circle-wrapper").forEach(wrapper => {
        wrapper.style.height = (width * 7 + 10) + "px";
    });
    document.querySelectorAll(".drag-circle").forEach(circle => {
        circle.style.width = width + "px";
        circle.style.height = width + "px";
    });
}

function resizePokedex() {
    let teamWidth = document.getElementById("team-header").clientWidth;

    let pokedex = document.getElementById("pokedex");
    positionPokedex(pokedex);
    pokedex.style.maxWidth = teamWidth + "px";

    let memberSize = document.querySelector(".member").clientWidth;

    pokedex.querySelectorAll(".mon-container").forEach(container => {
        container.style.maxHeight = (memberSize * 4) + "px";
    });
}

function dragAndDropRows() {
    // most of this code is "borrowed" from https://www.geeksforgeeks.org/create-a-drag-and-drop-sortable-list-using-html-css-javascript/
    let table =
        document.getElementById("rows");
    let draggedItem = null;

    table.addEventListener("dragstart", (e) => {
        closeDropdown(forceClose);
        draggedItem = e.target;
    });

    table.addEventListener("dragend", (e) => {
        e.target.style.opacity = "1";
        e.target.setAttribute("draggable", "false");
        draggedItem = null;

        saveRowOrder();
    });

    table.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement =
            getDragAfterElement(
                table,
                e.clientY);
        if (afterElement == null) {
            table.appendChild(
                draggedItem
            );
        }
        else {
            table.insertBefore(
                draggedItem,
                afterElement
            );
        }
    });

    const getDragAfterElement = (container, y) => {
        const draggableElements = [
            ...container.querySelectorAll(
                "li:not(.dragging)"
            ),];

        return draggableElements.reduce(
            (closest, child) => {
                const box =
                    child.getBoundingClientRect();
                const offset =
                    y - box.top - box.height / 2;
                if (
                    offset < 0 &&
                    offset > closest.offset) {
                    return {
                        offset: offset,
                        element: child,
                    };
                }
                else {
                    return closest;
                }
            },
            {
                offset: Number.NEGATIVE_INFINITY,
            }
        ).element;
    };

    // These control the styling and dragability of each row
    document.querySelectorAll(".dragger").forEach(dragger => {
        dragger.addEventListener("mousedown", beginDraggingRow);
        dragger.addEventListener("mouseup", endDraggingRow);
    });

    function beginDraggingRow(event) {
        let row = event.currentTarget.parentElement;
        row.setAttribute("draggable", "true");
        row.style.opacity = "0.5";
    }

    function endDraggingRow(event) {
        let row = event.currentTarget.parentElement;
        row.setAttribute("draggable", "false");
        row.style.opacity = "1";
    }
}

async function saveRowOrder() {
    const rows = document.querySelectorAll("li");

    for (let i = 0; i < rows.length; i++) {
        let id = rows[i].id;
        await db.saveData.update(id, { index: i });
    }
}

function openGameSelect(event) {
    selectedGame = event.currentTarget;
    selectedGame.classList.add("selected-game");

    let gameSelect = selectedGame.parentElement.querySelector(".game-select");
    positionGameSelect(gameSelect);
    gameSelect.classList.remove("hide");
    openDropdown = gameSelect;
}

function positionGameSelect(gameSelect) {
    try {
        let gameImg = selectedGame.querySelector("img");
        gameSelect.style.top = (gameImg.offsetTop + gameImg.offsetHeight + 1) + "px";
        gameSelect.style.left = selectedGame.offsetLeft + "px";
    } catch (err) { }
}

async function handleGameSelectClick(event) {
    let target = event.target;
    if (target.tagName !== "IMG") {
        return;
    }

    let src = target.src;
    changeGameArt(selectedGame, src);

    let rowId = target.closest("li").id;
    let savedData = await db.saveData.get(rowId);
    savedData["game"] = src;
    await db.saveData.update(rowId, savedData);

    closeDropdown(forceClose);
}

function changeGameArt(selectedGame, src) {
    selectedGame.style.backgroundImage = "url('" + src + "')";
    selectedGame.querySelector("img").src = src;
}

function handleMemberClick(event) {
    if (event.target.matches(".shiny")) {
        toggleShiny(event);
    } else if (event.target.matches(".repel")) {
        removeTeamMember(event);
    } else {
        openPokedex(event);
    }
}

async function toggleShiny(event) {
    let shiny = event.target;
    let member = shiny.parentElement.parentElement;
    let memberSlot = member.parentElement;
    let rowId = member.closest("li").id;

    if (shiny.matches(".make-shiny")) {
        member.style.backgroundImage = member.style.backgroundImage.replace("/normal/", "/shiny/");
        shiny.classList.remove("make-shiny");
        shiny.classList.add("remove-shiny");

        let dataToSave = await db.saveData.get(rowId);
        dataToSave[memberSlot.classList[0]]["shiny"] = true;
        await db.saveData.update(rowId, dataToSave);
    } else if (shiny.matches(".remove-shiny")) {
        member.style.backgroundImage = member.style.backgroundImage.replace("/shiny/", "/normal/");
        shiny.classList.remove("remove-shiny");
        shiny.classList.add("make-shiny");

        let dataToSave = await db.saveData.get(rowId);
        dataToSave[memberSlot.classList[0]]["shiny"] = false;
        await db.saveData.update(rowId, dataToSave);
    }

    calculateStatTotals();
}

async function removeTeamMember(event) {
    let parent = event.target.closest(".non-grid-parent");

    let nicknameCell = parent.children[0];
    nicknameCell.textContent = "";
    nicknameCell.contentEditable = "false"

    let notesCell = parent.children[2];
    notesCell.textContent = "";
    notesCell.contentEditable = "false"

    let member = parent.children[1];
    member.style.backgroundImage = "";

    for (let key in member.dataset) {
        delete member.dataset[key];
    }

    let shiny = member.querySelector(".shiny");
    shiny.classList.remove("remove-shiny");
    shiny.classList.add("make-shiny");

    parent.classList.add("egg");

    let rowId = parent.closest("li").id;
    let saveData = await db.saveData.get(rowId);
    delete saveData[parent.classList[0]];
    await db.saveData.put(saveData);

    calculateStatTotals();
}

function openPokedex(event) {
    clearMonContainerStack();

    // this will always be the img and not the wrapper because the img is later in the DOM
    selectedMember = event.target;
    selectedMember.classList.add("selected-member");

    let pokedex = document.getElementById("pokedex");
    pokedex.querySelector("#back-arrow").classList.add("invisible");

    pokedex.querySelector("#pokedex-search").value = "";

    let allMons = document.querySelector("#all-mons");
    monContainerStack.push(allMons);
    allMons.querySelectorAll("img").forEach(img => {
        img.classList.remove("hide");
    });
    allMons.classList.remove("hide");

    positionPokedex(pokedex);
    pokedex.classList.remove("hide");
    openDropdown = pokedex;
}

function positionPokedex(pokedex) {
    try {
        let team = document.getElementById("team-header");
        pokedex.style.top = (Math.floor(selectedMember.getBoundingClientRect().bottom) - 7) + "px";
        pokedex.style.left = team.offsetLeft + "px";
    } catch (err) { }
}

function clearMonContainerStack() {
    for (let i = monContainerStack.length - 1; i >= 0; i--) {
        let container = monContainerStack[i];
        container.classList.add("hide");
        monContainerStack.splice(monContainerStack.indexOf(container), 1);
    }
}

function handlePokedexClick(event) {
    let pokedex = document.querySelector("#pokedex");
    let target = event.target;

    if (target.tagName === "IMG") {
        document.querySelector("#pokedex-search").value = "";

        // Attempts to open form container for the mon
        let formattedTitle = target.alt.replace(/\s+/g, "");
        let formContainer = pokedex.querySelector("#" + formattedTitle);
        if (formContainer !== null) {
            monContainerStack[monContainerStack.length - 1].classList.add("hide");
            monContainerStack.push(formContainer);
            pokedex.querySelector("#clear-search").classList.add("invisible");
            pokedex.querySelector("#back-arrow").classList.remove("invisible");
            formContainer.classList.remove("hide");
        }
        // If there is no form container, then select the mon
        else {
            addTeamMember(selectedMember, target);

            saveSelectedMon(selectedMember.parentElement, target);

            closeDropdown(forceClose);

            calculateStatTotals();
        }
    } else if (target.closest("#back-arrow") !== null) {
        pokedex.querySelector("#pokedex-search").value = "";

        let currentContainer = monContainerStack.pop();
        currentContainer.classList.add("hide");

        let nextContainer = monContainerStack[monContainerStack.length - 1];
        nextContainer.querySelectorAll("img").forEach(img => {
            img.classList.remove("hide");
        });
        nextContainer.classList.remove("hide");

        if (monContainerStack.length === 1) {
            document.getElementById("back-arrow").classList.add("invisible");
        }
    } else if (target.closest("#clear-search") !== null) {
        let searchBox = pokedex.querySelector("#pokedex-search");
        searchBox.value = "";
        processSearchboxInput({ target: searchBox });
    }
}

function addTeamMember(selectedMember, target) {
    selectedMember.style.backgroundImage = "url('" + target.src + "')";
    selectedMember.dataset.gen = target.dataset.gen;
    selectedMember.dataset.typeA = target.dataset.typeA;
    selectedMember.dataset.typeB = target.dataset.typeB;
    selectedMember.dataset.species = target.dataset.species;

    let nicknameCell = selectedMember.previousElementSibling;
    nicknameCell.textContent = target.dataset.species;
    nicknameCell.contentEditable = "true";

    selectedMember.nextElementSibling.contentEditable = "true";

    selectedMember.parentElement.classList.remove("egg");
}

function processSearchboxInput(event) {
    let filter = event.target.value.toLowerCase();

    let clearButton = event.target.nextElementSibling;
    if (filter === "") {
        clearButton.classList.add("invisible");
    } else {
        clearButton.classList.remove("invisible");
    }

    let imgsParent = document.getElementById("pokedex").querySelector(".mon-container:not(.hide)");

    imgsParent.querySelectorAll("img").forEach(img => {
        let monName = img.alt.toLowerCase();
        if (!monName.includes(filter)) {
            img.classList.add("hide");
        } else {
            img.classList.remove("hide");
        }
    });
}

function openHeaderDropdown(event) {
    // if (event.target !== event.currentTarget) {
    //     return;
    // }

    let dropdown = event.currentTarget.querySelector(".dropdown");

    let triangle = dropdown.previousElementSibling;
    invisibleTriangle = triangle;
    triangle.classList.add("invisible");

    openDropdown = dropdown;
    dropdown.classList.remove("hide");
}

function preventNewLine(event) {
    if (event.key === "Enter") {
        event.preventDefault();
    }
}

function timeKeyManagement(event) {
    // if Ctrl is being held, leave to allow keyboard shortcuts
    if (event.ctrlKey) {
        return;
    }

    // stores the key presses that are valid for the time cells
    let valid = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ":", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

    // if the text already contains ":", do not add any more
    let text = event.currentTarget.textContent;
    if (text.includes(":")) {
        valid.delete(":");
    }

    // if the key press is not allowed, do not add it to the cell
    if (!valid.has(event.key)) {
        event.preventDefault();
    }
}

function validateTime(event) {
    let target = event.currentTarget;
    if (target.textContent.match(/^$|^[1-9]*\d:[0-5]\d$/)) {
        target.classList.remove("typo");
        calculateTotalTime();
        saveTextNow(event);
    } else {
        target.classList.add("typo");
    }
}

function calculateTotalTime() {
    let totalHours = 0;
    let totalMinutes = 0;

    document.querySelectorAll(".time").forEach(cell => {
        if (cell.matches(".typo") || cell.textContent === "") {
            return;
        }

        let time = cell.textContent.split(":");
        totalHours += Number(time[0]);
        totalMinutes += Number(time[1]);
    });

    let header = document.querySelector("#time-header");
    header.childNodes[2].textContent = (totalHours + Math.trunc(totalMinutes / 60)) + ":" + String((totalMinutes % 60)).padStart(2, "0");
}

function calculateStatTotals() {
    let gens = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
        "7": 0,
        "8": 0,
        "9": 0
    }, types = {
        "normal": 0,
        "fire": 0,
        "water": 0,
        "grass": 0,
        "electric": 0,
        "ice": 0,
        "fighting": 0,
        "poison": 0,
        "ground": 0,
        "flying": 0,
        "psychic": 0,
        "bug": 0,
        "rock": 0,
        "ghost": 0,
        "dragon": 0,
        "dark": 0,
        "steel": 0,
        "fairy": 0,
    }, shinies = 0;

    document.querySelectorAll(".row").forEach(row => {
        if (!row.matches(".hide")) {
            row.querySelectorAll(".member").forEach(member => {
                let gen = member.dataset.gen,
                    typeA = member.dataset.typeA,
                    typeB = member.dataset.typeB;

                if (gen in gens) {
                    gens[gen]++;
                }
                if (typeA in types) {
                    types[typeA]++;
                }
                if (typeB in types) {
                    types[typeB]++;
                }
                if (member.querySelector(".remove-shiny") != null) {
                    shinies++;
                }
            });
        }
    });

    for (let gen in gens) {
        document.getElementById("gen-" + gen).childNodes[2].textContent = gens[gen];
    }
    for (let type in types) {
        document.getElementById(type).childNodes[2].textContent = types[type];
    }
    document.getElementById("shinies").childNodes[2].textContent = shinies;
}

function resetNickname(target) {
    if (target.textContent === "") {
        let member = target.parentElement.querySelector(".member");
        target.textContent = member.dataset.species;
    }
}

async function handleVisibilityClick(event) {
    let toggle = event.target.closest(".visibility-toggle");

    if (toggle === null) {
        return;
    }

    let rowId = toggle.classList[1];
    let savedData = await db.saveData.get(rowId);

    let row = document.querySelector("#" + rowId);
    let img = toggle.children[0];

    if (row.matches(".hide")) {
        row.classList.remove("hide");

        img.src = img.src.replace("Eye", "EyeClosed");

        savedData["hidden"] = false;
        await db.saveData.update(rowId, savedData);
    } else {
        row.classList.add("hide");

        img.src = img.src.replace("Closed", "");

        savedData["hidden"] = true;
        await db.saveData.update(rowId, savedData);
    }

    calculateStatTotals();
}

/*
async function saveTextOLD(event) {
    let target = event.currentTarget
    let row = target.closest("li").id;
    let object = {};
    let column = target.classList[1];
    let text = target.textContent;

    // If the value is empty, delete the key
    // NEEDS TO BE UPDATED TO ACCOMODATE A TEAM MEMBER AND THE TIME CELL
    if (text === "") {
        let obj = await db.rows.get(row);
        delete obj[column];
        await db.rows.put(obj);
        console.log(await db.rows.get(row));
        return;
    }

    // validates the text inputted into the time cell.  If invalid, do not save the new time
    // NEEDS TO BE UPDATED TO REMOVE THE NEW TIME AND STILL HAPPEN WHEN text === ""
    if (target.matches(".time")) {
        if (!validateTime(target)) {
            return;
        }
    }

    // creates the team member data
    if (target.closest(".team-members") !== null) {
        if (target.matches(".nickname")) {
            resetNickname(target);
        }

        let member = {};
        member[column] = text;
        object[target.parentElement.classList[0]] = member
        // otherwise creates a basic key : value pair
    } else {
        object[column] = text;
    }

    // updates the table with the new value
    await db.rows.update(row, object);

    let retrieved = await db.rows.get(row);

    console.log(retrieved);
}

function loadSaveDataOLD() {
    db.version(1).stores({
        rows: `row`,
        order: `order`
    });

    document.querySelectorAll("li").forEach(row => {
        db.rows.add({ row: row.id });
    });

    // db.delete();
}
*/

async function loadSaveData() {
    // defines the scheme of the data storage
    db.version(1).stores({
        saveData: "row, index, game, hidden"
    });

    const rowOrder = [];
    let rows = document.querySelectorAll("li");

    for (let i = 0; i < rows.length; i++) {
        let row = rows[i];
        let id = row.id;
        // inserts all rows that aren't currently in the table
        await db.saveData.add({
            row: id,
            index: i,
            game: row.querySelector("img").src,
            hidden: false
        }).catch("ConstraintError", err => {
            // this error type should mean that the data already exists within the table, which is fine to ignore
            // this add() should only add new rows to the table and this error means the row already exists
            void err;
        });
        const storedRow = await db.saveData.get(id);
        rowOrder[storedRow.index] = id;

        for (const column in storedRow) {
            let cell = row.querySelector("." + column)
            let savedData = storedRow[column];
            if (column === "game") {
                changeGameArt(row.querySelector(".game"), savedData);
            } else if (column === "hidden" && savedData === true) {
                row.classList.add("hide");
                let img = document.querySelector("." + id).childNodes[1];
                img.src = img.src.replace("Closed", "");
            } else if (column.startsWith("member-")) {
                addTeamMember(cell.children[1], savedData);

                let nickname = savedData["nickname"];
                if (nickname !== "") {
                    cell.children[0].textContent = nickname;
                }

                cell.children[2].textContent = savedData["notes"];

                if (savedData["shiny"]) {
                    toggleShiny({ target: cell.querySelector(".shiny") });
                }
            } else {
                try {
                    cell.textContent = savedData;
                } catch { }
            }
        }
    }

    reorderRows(rowOrder);

    calculateStatTotals();
    calculateTotalTime();
}

function reorderRows(rowOrder) {
    let table = document.querySelector("#rows");

    for (let i = 0; i < rowOrder.length; i++) {
        let row = table.querySelector("#" + rowOrder[i]);
        table.insertBefore(row, table.children[i]);
    }
}

// starts the timer worker and saves the text after the timer finishes
function saveTextAfterTimer(event) {
    timer.postMessage(true);

    let element = event.currentTarget;
    timer.onmessage = () => {
        saveText(element);
    };
}

// cancels the timer and saves the text immediately
function saveTextNow(event) {
    timer.postMessage(false);

    saveText(event.currentTarget);
}

// actually saves the text
async function saveText(element) {
    let column = element.classList[0];
    let text = element.textContent.trim();

    let row = element.closest("li");
    let member = element.closest("[class^='member-'");

    if (member) {
        if (column === "nickname" && text === "") {
            resetNickname(element);
        }

        let dataToSave = await db.saveData.get(row.id);
        dataToSave[member.classList[0]][column] = text;
        await db.saveData.update(row.id, dataToSave);
    } else {
        if (text === "") {
            let retrievedData = await db.saveData.get(row.id);
            delete retrievedData[column];
            await db.saveData.put(retrievedData);
        } else {
            let dataToSave = {};
            dataToSave[column] = text;
            await db.saveData.update(row.id, dataToSave);
        }
    }
}

async function saveSelectedMon(memberSlot, mon) {
    let monData = {
        dataset: Object.assign({}, mon.dataset),
        src: mon.src,
        shiny: false,
        nickname: "",
        notes: ""
    };

    let dataToSave = {};
    dataToSave[memberSlot.classList[0]] = monData;

    await db.saveData.update(memberSlot.closest("li").id, dataToSave);

    // addTeamMember(document.querySelector("#rse").querySelector(".member-a").querySelector(".member"), monData);
}