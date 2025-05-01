import axios from "axios";
import * as cheerio from "cheerio";
import { classes } from "./classes.js";
import { Match } from "./types.js"; // Assuming types.ts exists

interface ProcessedMatchData {
	winner: "A" | "B" | "DRAW";
	A: { teamName: string; bans: (string | null)[]; picks: (string | null)[] };
	B: { teamName: string; bans: (string | null)[]; picks: (string | null)[] };
}

/**
 * Fetches the main match page to find the draft link.
 */
async function fetchMatchSheet(
	url: string
): Promise<{ draftLink: string | null; matchNumber: "1" | "2" | "3" | null }> {
	try {
		const response = await axios.get(url, { timeout: 15000 }); // Add timeout
		const html = response.data;
		const $ = cheerio.load(html);

		const urlParts = url.split("/");
		const potentialMatchNumber = urlParts[urlParts.length - 1];
		const potentialMatchId = urlParts[urlParts.length - 2];

		let matchNumber: "1" | "2" | "3" | null = null;
		if (["1", "2", "3"].includes(potentialMatchNumber)) {
			matchNumber = potentialMatchNumber as "1" | "2" | "3";
		} else {
			// If last part isn't 1, 2, or 3, assume it's match 1 and the last part is the ID
			// This handles URLs like /match/62567
			matchNumber = "1";
			console.warn(`URL ${url} doesn't end with /1, /2, or /3. Assuming match 1.`);
			// Basic check if the supposed ID part is numeric
			if (isNaN(parseInt(potentialMatchId))) {
				console.error(`Cannot determine match ID or number reliably from URL: ${url}`);
				return { draftLink: null, matchNumber: null };
			}
		}

		// Find the draft link corresponding to the determined match number
		const draftLinkElement = $(".draft_link a").eq(parseInt(matchNumber) - 1);
		const draft_link = draftLinkElement.attr("href");

		if (!draft_link) {
			console.warn(`Draft link not found for match ${matchNumber} in ${url}`);
			// Check if the element exists but href is missing
			if (draftLinkElement.length === 0) {
				console.warn(
					` -> Reason: Draft link container/anchor element missing for match index ${
						parseInt(matchNumber) - 1
					}.`
				);
			} else {
				console.warn(` -> Reason: Draft link anchor element found, but 'href' attribute is missing or empty.`);
			}
			return { draftLink: null, matchNumber };
		}

		console.log(`Found draft link for ${url} (Match ${matchNumber}): ${draft_link}`);
		return { draftLink: draft_link, matchNumber };
	} catch (error: any) {
		if (axios.isAxiosError(error)) {
			console.error(
				`Axios error fetching match sheet ${url}: ${error.message} (Status: ${error.response?.status})`
			);
		} else {
			console.error(`Error fetching match sheet ${url}: ${error.message}`);
		}
		return { draftLink: null, matchNumber: null };
	}
}

/**
 * Fetches the draft page, extracts draft data, and determines the winner.
 */
async function fetchDraft(
	draftLink: string,
	matchSheetUrl: string,
	matchNumber: "1" | "2" | "3"
): Promise<ProcessedMatchData | null> {
	try {
		const draftResponse = await axios.get(draftLink, { timeout: 15000 }); // Add timeout
		const draftHtml = draftResponse.data;
		const $draft = cheerio.load(draftHtml);
		const app = $draft("#app");
		const dataPage = app.attr("data-page");
		if (!dataPage) {
			console.warn(`Could not find data-page attribute on draft page: ${draftLink}`);
			return null;
		}
		const dataPageJson = JSON.parse(dataPage);

		// Extract team names from draft data
		const teamNameA = dataPageJson.props.draft.authA?.name ?? "Team A";
		const teamNameB = dataPageJson.props.draft.authB?.name ?? "Team B";

		// --- Winner Determination (Using .compo.active similar to old code) ---
		let winner: "A" | "B" | "DRAW" = "DRAW"; // Default to DRAW
		try {
			const matchSheetResponse = await axios.get(matchSheetUrl, { timeout: 15000 });
			const matchSheetHtml = matchSheetResponse.data;
			const $matchSheet = cheerio.load(matchSheetHtml);

			let deadClassesA = -1; // Use -1 to indicate not found
			let deadClassesB = -1;

			// Find ALL active compo blocks on the page
			const activeCompoBlocks = $matchSheet(".compo.active");

			// Determine the starting index based on the match number
			// Match 1: index 0, 1
			// Match 2: index 2, 3
			// Match 3: index 4, 5
			const startIndex = (parseInt(matchNumber) - 1) * 2;

			if (activeCompoBlocks.length > startIndex + 1) {
				// Get the two relevant blocks for the current match number
				const compoAElement = activeCompoBlocks.eq(startIndex);
				const compoBElement = activeCompoBlocks.eq(startIndex + 1);

				deadClassesA = compoAElement.find(".class.dead").length;
				deadClassesB = compoBElement.find(".class.dead").length;

				if (deadClassesA !== -1 && deadClassesB !== -1) {
					winner = deadClassesA < deadClassesB ? "A" : deadClassesA > deadClassesB ? "B" : "DRAW";
					console.log(
						`Winner determined for ${matchSheetUrl} (Match ${matchNumber}): ${winner} (A:${deadClassesA} vs B:${deadClassesB} dead)`
					);
				} else {
					// This case should be less likely now, but keep as fallback
					console.warn(
						`Could not find dead class counts reliably using .compo.active for ${matchSheetUrl} (Match ${matchNumber}). Defaulting winner to DRAW.`
					);
				}
			} else {
				console.warn(
					`Could not find enough '.compo.active' blocks for match ${matchNumber} on ${matchSheetUrl}. Found ${
						activeCompoBlocks.length
					}, expected at least ${startIndex + 2}. Defaulting winner to DRAW.`
				);
			}
		} catch (error: any) {
			console.error(
				`Error re-fetching match sheet ${matchSheetUrl} for winner determination: ${error.message}. Defaulting winner to DRAW.`
			);
		}
		// --- End Winner Determination ---

		// Process draft string
		const draftString = dataPageJson.props.draft.data?.split(":") ?? [];
		let bansA: (string | null)[] = [];
		let bansB: (string | null)[] = [];
		let picksA: (string | null)[] = [];
		let picksB: (string | null)[] = [];

		draftString.forEach((element: string) => {
			if (element.length < 3) return; // Basic validation
			let sideLetter = element[0];
			let action = element[1]; // 0 for ban, 1 for pick
			let classId = element.slice(2);
			let className = classes[classId] || null; // Get class name from ID

			if (!className) {
				console.warn(`Unknown class ID '${classId}' found in draft for ${matchSheetUrl}`);
			}

			if (action === "0") {
				// Ban
				if (sideLetter === "A") bansA.push(className);
				else if (sideLetter === "B") bansB.push(className);
			} else if (action === "1") {
				// Pick
				if (sideLetter === "A") picksA.push(className);
				else if (sideLetter === "B") picksB.push(className);
			}
		});

		// Pad arrays to ensure consistent length (5 bans, 3 picks)
		while (bansA.length < 5) bansA.push(null);
		while (bansB.length < 5) bansB.push(null);
		while (picksA.length < 3) picksA.push(null);
		while (picksB.length < 3) picksB.push(null);

		console.log(`Successfully processed draft for ${matchSheetUrl} (Match ${matchNumber})`);
		return {
			winner: winner,
			A: { teamName: teamNameA, bans: bansA.slice(0, 5), picks: picksA.slice(0, 3) }, // Ensure correct length
			B: { teamName: teamNameB, bans: bansB.slice(0, 5), picks: picksB.slice(0, 3) },
		};
	} catch (error: any) {
		if (axios.isAxiosError(error)) {
			console.error(
				`Axios error fetching draft ${draftLink} for ${matchSheetUrl}: ${error.message} (Status: ${error.response?.status})`
			);
		} else {
			console.error(`Error fetching draft ${draftLink} for ${matchSheetUrl}: ${error.message}`);
		}
		return null;
	}
}

/**
 * Orchestrates fetching and processing for a single match URL.
 */
export async function processMatchUrl(
	matchSheetUrl: string
): Promise<{ url: string; data: ProcessedMatchData | null }> {
	console.log(`Processing: ${matchSheetUrl}`);
	const { draftLink, matchNumber } = await fetchMatchSheet(matchSheetUrl);

	if (draftLink && matchNumber) {
		const processedData = await fetchDraft(draftLink, matchSheetUrl, matchNumber);
		return { url: matchSheetUrl, data: processedData };
	} else {
		console.warn(`Skipping processing for ${matchSheetUrl} due to missing draft link or match number.`);
		return { url: matchSheetUrl, data: null }; // Indicate failure to process this URL
	}
}
