import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import { classes } from "./classes.js";
import {
	analizeSideWinrate,
	analyzeGlobalClassesData,
	analyzePickBanOrder,
	analyzeTeamStats,
	getWinratesVsClass,
} from "./analyze_results.js";

let matchSheetLinks: string[] = JSON.parse(fs.readFileSync("data/match_sheet_links.json", "utf8"));

fetchDataAndAnalyze();

async function fetchDataAndAnalyze() {
	for (let i = 0; i < matchSheetLinks.length; i++) {
		const link = matchSheetLinks[i];
		console.log(`Fetching data for link ${i + 1}/${matchSheetLinks.length}`);
		await fetchMatchSheet(link);
	}
	console.log("All fetch operations completed. Proceeding with analysis.");
	analizeSideWinrate();
	analyzeGlobalClassesData();
	analyzePickBanOrder();

	// analyzeTeamStats("HOF YIN");
	
	// getWinratesVsClass("eliotrope");
}

async function fetchMatchSheet(url: string) {
	if (!fs.existsSync("data/result.json")) fs.writeFileSync("data/result.json", "{}");
	let jsonFile = JSON.parse(fs.readFileSync("data/result.json", "utf8"));
	if (Object.keys(jsonFile).length === 0) jsonFile = {};

	if (jsonFile[url]) return;

	const response = await axios.get(url);
	const html = response.data;
	const $ = cheerio.load(html);

	// @ts-ignore
	let matchNumber: "1" | "2" | "3" = url.split("/").pop();
	if (matchNumber !== "1" && matchNumber !== "2" && matchNumber !== "3") return;

	const draft_link = $(".draft_link a")
		.eq(parseInt(matchNumber) - 1)
		.attr("href");
	if (!draft_link) return;
	let deadClassesA = 0;
	let deadClassesB = 0;
	$(".compo.active").each((i, element) => {
		let deadClasses = $(element).find(".class.dead").length;
		if (i == 0) deadClassesA = deadClasses;
		else deadClassesB = deadClasses;
	});
	let winner: "A" | "B" | "DRAW" = deadClassesA < deadClassesB ? "A" : deadClassesA > deadClassesB ? "B" : "DRAW";

	await fetchDraft(draft_link, winner, url);
}

async function fetchDraft(url: string, winner: "A" | "B" | "DRAW", matchSheetUrl: string) {
	const response = await axios.get(url);
	const html = response.data;
	const $ = cheerio.load(html);
	const app = $("#app");
	const dataPage = app.attr("data-page");
	if (!dataPage) return;
	const dataPageJson = JSON.parse(dataPage);

	let authNameA = dataPageJson.props.draft.draft_match.auth1.name;
	let authNameB = dataPageJson.props.draft.draft_match.auth2.name;
	let teamNameA = dataPageJson.props.draft.authA.name;
	let teamNameB = dataPageJson.props.draft.authB.name;

	if (authNameA === teamNameB && authNameB === teamNameA) {
		if (winner === "A") winner = "B";
		else if (winner === "B") winner = "A";
	}

	let draftString = dataPageJson.props.draft.data.split(":");
	writeData(matchSheetUrl, teamNameA, teamNameB, draftString, winner);
}

function writeData(
	matchSheetUrl: string,
	teamNameA: string,
	teamNameB: string,
	draftString: string[],
	winner: "A" | "B" | "DRAW"
) {
	if (!fs.existsSync("data/result.json")) fs.writeFileSync("data/result.json", "{}");
	let jsonFile = JSON.parse(fs.readFileSync("data/result.json", "utf8"));
	if (Object.keys(jsonFile).length === 0) jsonFile = {};

	if (jsonFile[matchSheetUrl]) return;

	// example draftString: ['A03', 'B06', 'A04', 'B015', 'A111', 'B131', 'B010', 'A017', 'B01', 'A08', 'B114', 'A112', 'A02', 'B07', 'A15', 'B19']
	// A or B is the team
	// the first number is pick or ban (0 is ban, 1 is pick)
	// the second (or second and third if there is a third) number is the class id
	let bansA: string[] = [];
	let bansB: string[] = [];
	let picksA: string[] = [];
	let picksB: string[] = [];

	draftString.forEach((element) => {
		let sideLetter = element[0];
		let action = element[1];
		let classId = element.slice(2);
		if (action === "0") {
			if (sideLetter == "A") bansA.push(classes[classId]);
			else bansB.push(classes[classId]);
		} else {
			if (sideLetter == "A") picksA.push(classes[classId]);
			else picksB.push(classes[classId]);
		}
	});

	jsonFile[matchSheetUrl] = {
		winner: winner,
		A: { teamName: teamNameA, bans: bansA, picks: picksA },
		B: { teamName: teamNameB, bans: bansB, picks: picksB },
	};
	fs.writeFileSync("data/result.json", JSON.stringify(jsonFile, null, 2));
	console.log(`Wrote draft ${matchSheetUrl} to reesult.json`);
}
