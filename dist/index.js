import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import { classes } from "./classes.js";
import { analyzeGlobalClassesData, analyzePickBanOrder } from "./analyze_results.js";
let matchSheetLinks = JSON.parse(fs.readFileSync("data/match_sheet_links.json", "utf8"));
Promise.all(matchSheetLinks.map((link) => fetchMatchSheet(link))).then(() => {
    analyzeGlobalClassesData();
    analyzePickBanOrder();
});
async function fetchMatchSheet(url) {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const draft_link = $(".draft_link a").attr("href");
    if (!draft_link)
        return;
    let deadClassesA = 0;
    let deadClassesB = 0;
    $(".compo.active").each((i, element) => {
        let deadClasses = $(element).find(".class.dead").length;
        if (i == 0)
            deadClassesA = deadClasses;
        else
            deadClassesB = deadClasses;
    });
    let winner = deadClassesA < deadClassesB ? "A" : deadClassesA > deadClassesB ? "B" : "DRAW";
    await fetchDraft(draft_link, winner);
}
async function fetchDraft(url, winner) {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const app = $("#app");
    const dataPage = app.attr("data-page");
    if (!dataPage)
        return;
    const dataPageJson = JSON.parse(dataPage);
    let draftId = String(dataPageJson.props.draft.id); // this is not the link id!
    let teamNameA = dataPageJson.props.draft.draft_match.auth1.name;
    let teamNameB = dataPageJson.props.draft.draft_match.auth2.name;
    let draftString = dataPageJson.props.draft.data.split(":");
    writeData(draftId, teamNameA, teamNameB, draftString, winner);
}
function writeData(draftId, teamNameA, teamNameB, draftString, winner) {
    if (!fs.existsSync("data/result.json"))
        fs.writeFileSync("data/result.json", "{}");
    let jsonFile = JSON.parse(fs.readFileSync("data/result.json", "utf8"));
    if (Object.keys(jsonFile).length === 0)
        jsonFile = {};
    if (jsonFile[draftId])
        return;
    // example draftString: ['A03', 'B06', 'A04', 'B015', 'A111', 'B131', 'B010', 'A017', 'B01', 'A08', 'B114', 'A112', 'A02', 'B07', 'A15', 'B19']
    // A or B is the team
    // the first number is pick or ban (0 is ban, 1 is pick)
    // the second (or second and third if there is a third) number is the class id
    let bansA = [];
    let bansB = [];
    let picksA = [];
    let picksB = [];
    draftString.forEach((element) => {
        let sideLetter = element[0];
        let action = element[1];
        let classId = element.slice(2);
        if (action === "0") {
            if (sideLetter == "A")
                bansA.push(classes[classId]);
            else
                bansB.push(classes[classId]);
        }
        else {
            if (sideLetter == "A")
                picksA.push(classes[classId]);
            else
                picksB.push(classes[classId]);
        }
    });
    jsonFile[draftId] = {
        winner: winner,
        A: { teamName: teamNameA, bans: bansA, picks: picksA },
        B: { teamName: teamNameB, bans: bansB, picks: picksB },
    };
    fs.writeFileSync("data/result.json", JSON.stringify(jsonFile, null, 2));
    console.log(`Wrote draft ${draftId} to reesult.json`);
}
