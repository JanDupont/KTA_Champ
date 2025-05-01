import fs from "fs";
import { Table } from "console-table-printer"; // Keep for potential future use or separate CLI script
import { classes } from "./classes.js";
import { Classes, Match, Team } from "./types.js"; // Assuming you have a types definition

// --- Configuration Flags (Keep or manage elsewhere if needed) ---
const TOP_32_TEAMS_ONLY = false;
const NO_DRAWS = false; // Set to true for playoffs analysis where draws might be excluded

const top32teams: string[] = [
	// ... (keep existing list or manage externally)
	// "DRIP",
];

// Helper function to filter matches (can be reused)
function filterMatches(inputMatches: Record<string, Match>): Record<string, Match> {
	let matches = JSON.parse(JSON.stringify(inputMatches)); // Deep clone to avoid modifying original data

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		if (
			(matches[matchId].A.picks.length > 0 && matches[matchId].A.picks.every((p: string | null) => p === null)) ||
			(matches[matchId].B.picks.length > 0 && matches[matchId].B.picks.every((p: string | null) => p === null))
		) {
			// Check if picks array exists and all elements are null
			delete matches[matchId];
		}
	});

	// PLAYOFFS: remove draw matches
	if (NO_DRAWS) {
		Object.keys(matches).forEach((matchId) => {
			if (matches[matchId].winner === "DRAW") {
				delete matches[matchId];
			}
		});
	}

	// only include matches of top 32 teams vs top 32 teams
	if (TOP_32_TEAMS_ONLY) {
		Object.keys(matches).forEach((matchId) => {
			if (
				!top32teams.includes(matches[matchId].A.teamName) ||
				!top32teams.includes(matches[matchId].B.teamName)
			) {
				delete matches[matchId];
			}
		});
	}
	return matches;
}

// --- Refactored Analysis Functions ---

export function calculateSideWinrate(inputMatches: Record<string, Match>) {
	const matches = filterMatches(inputMatches);
	const totalMatches = Object.keys(matches).length;
	if (totalMatches === 0) return []; // Return empty array if no matches

	let sideWinrates = {
		A: { wins: 0, losses: 0, draws: 0 },
		B: { wins: 0, losses: 0, draws: 0 },
	};

	Object.values(matches).forEach((match) => {
		if (match.winner === "A") {
			sideWinrates.A.wins++;
			sideWinrates.B.losses++;
		} else if (match.winner === "B") {
			sideWinrates.B.wins++;
			sideWinrates.A.losses++;
		} else if (match.winner === "DRAW") {
			sideWinrates.A.draws++;
			sideWinrates.B.draws++;
		}
	});

	// prepare data structure for return
	let tableData = Object.keys(sideWinrates).map((side) => {
		// @ts-ignore
		let sideData = sideWinrates[side];
		let totalGames = sideData.wins + sideData.losses + sideData.draws;
		let winrate = totalGames === 0 ? 0 : (sideData.wins / totalGames) * 100;
		return {
			Side: side,
			Winrate: winrate.toFixed(1) + "%",
			Wins: sideData.wins,
			Losses: sideData.losses,
			Draws: sideData.draws,
			Total: totalGames,
		};
	});

	return tableData; // Return the calculated data
}

export function calculateGlobalClassesData(inputMatches: Record<string, Match>) {
	const matches = filterMatches(inputMatches);
	const totalMatchesAllClasses = Object.keys(matches).length;
	if (totalMatchesAllClasses === 0) return [];

	let classesData: Record<
		string,
		{
			totalPicks: number;
			totalBans: number;
			totalWins: number;
			totalLosses: number;
			totalDraws: number;
			totalPresence: number;
			AWins: number;
			ALosses: number;
			ADraws: number;
			BWins: number;
			BLosses: number;
			BDraws: number;
		}
	> = {};

	// Initialize classesData
	Object.values(classes).forEach((className) => {
		classesData[className] = {
			totalPicks: 0,
			totalBans: 0,
			totalWins: 0,
			totalLosses: 0,
			totalDraws: 0,
			totalPresence: 0,
			AWins: 0,
			ALosses: 0,
			ADraws: 0,
			BWins: 0,
			BLosses: 0,
			BDraws: 0,
		};
	});

	// Populate classesData
	Object.values(matches).forEach((match) => {
		match.A.picks.forEach((pick) => {
			if (pick && classesData[pick]) {
				classesData[pick].totalPicks++;
				classesData[pick].totalPresence++;
				if (match.winner === "A") classesData[pick].AWins++;
				else if (match.winner === "B") classesData[pick].ALosses++;
				else if (match.winner === "DRAW") classesData[pick].ADraws++;
			}
		});
		match.B.picks.forEach((pick) => {
			if (pick && classesData[pick]) {
				classesData[pick].totalPicks++;
				classesData[pick].totalPresence++;
				if (match.winner === "B") classesData[pick].BWins++;
				else if (match.winner === "A") classesData[pick].BLosses++;
				else if (match.winner === "DRAW") classesData[pick].BDraws++;
			}
		});
		match.A.bans.forEach((ban) => {
			if (ban && classesData[ban]) {
				classesData[ban].totalBans++;
				classesData[ban].totalPresence++;
			}
		});
		match.B.bans.forEach((ban) => {
			if (ban && classesData[ban]) {
				classesData[ban].totalBans++;
				classesData[ban].totalPresence++;
			}
		});
	});

	// Calculate totals and rates
	Object.keys(classesData).forEach((className) => {
		let classData = classesData[className];
		classData.totalWins = classData.AWins + classData.BWins;
		classData.totalLosses = classData.ALosses + classData.BLosses;
		classData.totalDraws = classData.ADraws + classData.BDraws;
	});

	// prepare data for return
	let tableData = Object.keys(classesData).map((className) => {
		let classData = classesData[className];
		let totalGamesPlayed = classData.totalWins + classData.totalLosses + classData.totalDraws;
		let winrate = totalGamesPlayed === 0 ? 0 : (classData.totalWins / totalGamesPlayed) * 100;
		let totalGamesA = classData.AWins + classData.ALosses + classData.ADraws;
		let winrateA = totalGamesA === 0 ? 0 : (classData.AWins / totalGamesA) * 100;
		let totalGamesB = classData.BWins + classData.BLosses + classData.BDraws;
		let winrateB = totalGamesB === 0 ? 0 : (classData.BWins / totalGamesB) * 100;
		let pickrate = totalMatchesAllClasses === 0 ? 0 : (classData.totalPicks / totalMatchesAllClasses) * 100;
		let banrate = totalMatchesAllClasses === 0 ? 0 : (classData.totalBans / totalMatchesAllClasses) * 100;
		let presence = totalMatchesAllClasses === 0 ? 0 : (classData.totalPresence / totalMatchesAllClasses) * 100; // Corrected presence calculation

		return {
			Class: className,
			Winrate: winrate.toFixed(1) + "%",
			Pickrate: pickrate.toFixed(1) + "%",
			Banrate: banrate.toFixed(1) + "%",
			Picks: classData.totalPicks,
			Wins: classData.totalWins,
			Losses: classData.totalLosses,
			Draws: classData.totalDraws,
			Presence: presence.toFixed(1) + "%",
			"Winrate (A)": winrateA.toFixed(1) + "%",
			"Wins (A)": classData.AWins,
			"Losses (A)": classData.ALosses,
			"Draws (A)": classData.ADraws,
			"Winrate (B)": winrateB.toFixed(1) + "%",
			"Wins (B)": classData.BWins,
			"Losses (B)": classData.BLosses,
			"Draws (B)": classData.BDraws,
			Bans: classData.totalBans, // Added Bans count
		};
	});

	// Sort by presence, then winrate
	tableData.sort((a, b) => {
		const presenceA = parseFloat(a.Presence.replace("%", ""));
		const presenceB = parseFloat(b.Presence.replace("%", ""));
		if (presenceB !== presenceA) {
			return presenceB - presenceA;
		}
		const winrateA = parseFloat(a.Winrate.replace("%", ""));
		const winrateB = parseFloat(b.Winrate.replace("%", ""));
		return winrateB - winrateA;
	});

	return tableData; // Return the calculated data
}

export function calculatePickBanOrder(inputMatches: Record<string, Match>) {
	const matches = filterMatches(inputMatches);
	const totalMatchesAllClasses = Object.keys(matches).length;
	if (totalMatchesAllClasses === 0) return [];

	let classesPickBanData: Record<
		string,
		{
			ABan1: number;
			BBan1: number;
			ABan2: number;
			BBan2: number;
			APick1: number;
			BPick1: number;
			BPick2: number;
			APick2: number;
			BBan3: number;
			ABan3: number;
			APick3: number;
			BPick3: number;
			ABan4: number;
			BBan4: number;
			ABan5: number;
			BBan5: number;
		}
	> = {};

	// Initialize
	Object.values(classes).forEach((className) => {
		classesPickBanData[className] = {
			ABan1: 0,
			BBan1: 0,
			ABan2: 0,
			BBan2: 0,
			APick1: 0,
			BPick1: 0,
			BPick2: 0,
			APick2: 0,
			BBan3: 0,
			ABan3: 0,
			APick3: 0,
			BPick3: 0,
			ABan4: 0,
			BBan4: 0,
			ABan5: 0,
			BBan5: 0,
		};
	});

	// Populate
	Object.values(matches).forEach((match) => {
		match.A.bans.forEach((ban, index) => {
			if (ban && classesPickBanData[ban]) {
				let key = `ABan${index + 1}`;
				// @ts-ignore
				classesPickBanData[ban][key]++;
			}
		});
		match.B.bans.forEach((ban, index) => {
			if (ban && classesPickBanData[ban]) {
				let key = `BBan${index + 1}`;
				// @ts-ignore
				classesPickBanData[ban][key]++;
			}
		});
		match.A.picks.forEach((pick, index) => {
			if (pick && classesPickBanData[pick]) {
				let key = `APick${index + 1}`;
				// @ts-ignore
				classesPickBanData[pick][key]++;
			}
		});
		match.B.picks.forEach((pick, index) => {
			if (pick && classesPickBanData[pick]) {
				let key = `BPick${index + 1}`;
				// @ts-ignore
				classesPickBanData[pick][key]++;
			}
		});
	});

	// prepare data for return
	let tableData = Object.keys(classesPickBanData).map((className) => {
		let classData = classesPickBanData[className];
		const formatPercent = (value: number) =>
			totalMatchesAllClasses === 0 ? "0.0%" : ((value / totalMatchesAllClasses) * 100).toFixed(1) + "%";
		return {
			Class: className,
			ABan1: formatPercent(classData.ABan1),
			BBan1: formatPercent(classData.BBan1),
			ABan2: formatPercent(classData.ABan2),
			BBan2: formatPercent(classData.BBan2),
			APick1: formatPercent(classData.APick1),
			BPick1: formatPercent(classData.BPick1),
			BPick2: formatPercent(classData.BPick2),
			APick2: formatPercent(classData.APick2),
			BBan3: formatPercent(classData.BBan3),
			ABan3: formatPercent(classData.ABan3),
			APick3: formatPercent(classData.APick3),
			BPick3: formatPercent(classData.BPick3),
			ABan4: formatPercent(classData.ABan4),
			BBan4: formatPercent(classData.BBan4),
			ABan5: formatPercent(classData.ABan5),
			BBan5: formatPercent(classData.BBan5),
		};
	});

	// Optional: Sort if needed, e.g., by class name
	tableData.sort((a, b) => a.Class.localeCompare(b.Class));

	return tableData; // Return the calculated data
}

// --- Functions below are NOT refactored for this UI example ---
// --- They require more complex handling or might be less relevant for the initial UI ---

export function analyzeTeamStats(teamName: string) {
	// This function is complex due to multiple tables and specific team filtering.
	// It would need significant refactoring to return structured data for a web UI.
	// For now, it's left as is, primarily for CLI usage.
	let matches: Record<string, Match> = JSON.parse(fs.readFileSync("data/result.json", "utf8"));

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		// Updated check for empty picks array or all null picks
		if (
			(matches[matchId].A.picks.length > 0 && matches[matchId].A.picks.every((p) => p === null)) ||
			(matches[matchId].B.picks.length > 0 && matches[matchId].B.picks.every((p) => p === null))
		) {
			delete matches[matchId];
		}
	});
	// remove all matches that are not from the team
	Object.keys(matches).forEach((matchId) => {
		if (matches[matchId].A.teamName !== teamName && matches[matchId].B.teamName !== teamName) {
			delete matches[matchId];
		}
	});

	console.log("----- TEAM STATS FOR: ", teamName, " -----");
	const totalMatches = Object.keys(matches).length;
	console.log("Total matches: ", totalMatches);
	if (totalMatches === 0) {
		console.log("No matches found for this team.");
		return; // Exit if no matches
	}

	let matchesA = Object.values(matches).filter((match) => match.A.teamName === teamName).length;
	let matchesB = Object.values(matches).filter((match) => match.B.teamName === teamName).length;
	let winsA = Object.values(matches).filter((match) => match.A.teamName === teamName && match.winner === "A").length;
	let lossesA = Object.values(matches).filter(
		(match) => match.A.teamName === teamName && match.winner === "B"
	).length;
	let drawsA = Object.values(matches).filter(
		(match) => match.A.teamName === teamName && match.winner === "DRAW"
	).length;
	let winsB = Object.values(matches).filter((match) => match.B.teamName === teamName && match.winner === "B").length;
	let lossesB = Object.values(matches).filter(
		(match) => match.B.teamName === teamName && match.winner === "A"
	).length;
	let drawsB = Object.values(matches).filter(
		(match) => match.B.teamName === teamName && match.winner === "DRAW"
	).length;

	let winrateA = matchesA === 0 ? 0 : (winsA / (winsA + lossesA + drawsA)) * 100;
	let winrateB = matchesB === 0 ? 0 : (winsB / (winsB + lossesB + drawsB)) * 100;
	let totalWins = winsA + winsB;
	let totalLosses = lossesA + lossesB;
	let totalDraws = drawsA + drawsB;
	let totalWinrate = totalMatches === 0 ? 0 : (totalWins / (totalWins + totalLosses + totalDraws)) * 100;

	// prepare data for console.table
	let sideTableData = [
		{
			Side: "A",
			Matches: matchesA,
			Wins: winsA,
			Losses: lossesA,
			Draws: drawsA,
			Winrate: winrateA.toFixed(1) + "%",
		},
		{
			Side: "B",
			Matches: matchesB,
			Wins: winsB,
			Losses: lossesB,
			Draws: drawsB,
			Winrate: winrateB.toFixed(1) + "%",
		},
		{
			Side: "Total",
			Matches: totalMatches,
			Wins: totalWins,
			Losses: totalLosses,
			Draws: totalDraws,
			Winrate: totalWinrate.toFixed(1) + "%",
		},
	];

	// Initialize the printer
	const sidePrinter = new Table({
		title: "Side Stats",
		columns: [
			{ name: "Side", alignment: "left" },
			{ name: "Matches", alignment: "center" },
			{ name: "Wins", alignment: "center" },
			{ name: "Losses", alignment: "center" },
			{ name: "Draws", alignment: "center" },
			{ name: "Winrate", alignment: "center" },
		],
	});
	// print the table
	sideTableData.forEach((row) => {
		sidePrinter.addRow(row);
	});
	sidePrinter.printTable();

	let classesData: Record<string, { picks: number; wins: number; losses: number; draws: number; winrate: number }> =
		{};
	Object.values(classes).forEach((className) => {
		let picks = Object.values(matches).filter(
			(match) =>
				(match.A.teamName === teamName && match.A.picks.includes(className)) ||
				(match.B.teamName === teamName && match.B.picks.includes(className))
		).length;
		let wins = Object.values(matches).filter(
			(match) =>
				match.winner !== "DRAW" && // Exclude draws from win calculation for winrate
				// @ts-ignore
				match[match.winner].teamName === teamName &&
				// @ts-ignore
				match[match.winner].picks.includes(className)
		).length;
		let losses = Object.values(matches).filter(
			(match) =>
				match.winner !== "DRAW" && // Exclude draws from loss calculation for winrate
				match[match.winner === "A" ? "B" : "A"].teamName === teamName &&
				match[match.winner === "A" ? "B" : "A"].picks.includes(className)
		).length;
		let draws = Object.values(matches).filter(
			(match) =>
				match.winner === "DRAW" &&
				((match.A.teamName === teamName && match.A.picks.includes(className)) ||
					(match.B.teamName === teamName && match.B.picks.includes(className)))
		).length;
		let winnableGames = wins + losses; // Games considered for winrate (excluding draws)
		let winrate = winnableGames === 0 ? 0 : (wins / winnableGames) * 100;
		classesData[className] = { picks, wins, losses, draws, winrate };
	});

	let classTableData = Object.keys(classesData).map((className) => {
		let classData = classesData[className];
		return {
			Class: className,
			Picks: classData.picks,
			Wins: classData.wins,
			Losses: classData.losses,
			Draws: classData.draws,
			Winrate: classData.winrate.toFixed(1) + "%",
		};
	});

	// sort tableData by winrate, then by picks
	// classTableData.sort(
	// 	(a, b) => (parseFloat(b.Winrate.replace("%", "")) || 0) - (parseFloat(a.Winrate.replace("%", "")) || 0)
	// );
	classTableData.sort((a, b) => {
		const winrateA = parseFloat(a.Winrate.replace("%", "")) || 0;
		const winrateB = parseFloat(b.Winrate.replace("%", "")) || 0;
		if (winrateB !== winrateA) {
			return winrateB - winrateA;
		}
		return b.Picks - a.Picks; // Secondary sort by picks if winrates are equal
	});

	// initialize the printer
	const classPrinter = new Table({
		title: "Class Stats",
		columns: [
			{ name: "Class", alignment: "left" },
			{ name: "Picks", alignment: "center" },
			{ name: "Wins", alignment: "center" },
			{ name: "Losses", alignment: "center" },
			{ name: "Draws", alignment: "center" },
			{ name: "Winrate", alignment: "center" },
		],
	});

	// print the table
	classTableData.forEach((row) => {
		// Only add rows where the class was picked at least once
		if (row.Picks > 0) {
			classPrinter.addRow(row);
		}
	});

	classPrinter.printTable();

	let classPickStats = Object.keys(classesData).map((className) => {
		return {
			className,
			firstPickCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.picks[0] === className) ||
					(match.B.teamName === teamName && match.B.picks[0] === className)
			),
			secondPickCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.picks[1] === className) ||
					(match.B.teamName === teamName && match.B.picks[1] === className)
			),
			thirdPickCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.picks[2] === className) ||
					(match.B.teamName === teamName && match.B.picks[2] === className)
			),
			firstBanCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.bans[0] === className) ||
					(match.B.teamName === teamName && match.B.bans[0] === className)
			),
			secondBanCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.bans[1] === className) ||
					(match.B.teamName === teamName && match.B.bans[1] === className)
			),
			thirdBanCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.bans[2] === className) ||
					(match.B.teamName === teamName && match.B.bans[2] === className)
			),
			fourthBanCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.bans[3] === className) ||
					(match.B.teamName === teamName && match.B.bans[3] === className)
			),
			fifthBanCount: Object.values(matches).filter(
				(match) =>
					(match.A.teamName === teamName && match.A.bans[4] === className) ||
					(match.B.teamName === teamName && match.B.bans[4] === className)
			),
		};
	});

	const formatStat = (classData: any, countField: string, totalMatches: number) => {
		const count = classData[countField].length;
		const percentage = totalMatches === 0 ? 0 : (count / totalMatches) * 100;
		return `${classData.className} (${percentage.toFixed(1)}%)`;
	};

	let firstPickStats = classPickStats
		.sort((a, b) => b.firstPickCount.length - a.firstPickCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "firstPickCount", totalMatches));

	let secondPickStats = classPickStats
		.sort((a, b) => b.secondPickCount.length - a.secondPickCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "secondPickCount", totalMatches));

	let thirdPickStats = classPickStats
		.sort((a, b) => b.thirdPickCount.length - a.thirdPickCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "thirdPickCount", totalMatches));

	let firstBanStats = classPickStats
		.sort((a, b) => b.firstBanCount.length - a.firstBanCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "firstBanCount", totalMatches));

	let secondBanStats = classPickStats
		.sort((a, b) => b.secondBanCount.length - a.secondBanCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "secondBanCount", totalMatches));

	let thirdBanStats = classPickStats
		.sort((a, b) => b.thirdBanCount.length - a.thirdBanCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "thirdBanCount", totalMatches));

	let fourthBanStats = classPickStats
		.sort((a, b) => b.fourthBanCount.length - a.fourthBanCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "fourthBanCount", totalMatches));

	let fifthBanStats = classPickStats
		.sort((a, b) => b.fifthBanCount.length - a.fifthBanCount.length)
		.slice(0, 4)
		.map((classData) => formatStat(classData, "fifthBanCount", totalMatches));

	// initialize the printer
	const pickPrinter = new Table({
		title: "Pick Order Preference",
		columns: [
			{ name: "Fav Picks", alignment: "left" },
			{ name: "1", alignment: "center", maxLen: 20 },
			{ name: "2", alignment: "center", maxLen: 20 },
			{ name: "3", alignment: "center", maxLen: 20 },
			{ name: "4", alignment: "center", maxLen: 20 },
		],
	});
	// print the table
	pickPrinter.addRow({
		"Fav Picks": "First Pick",
		1: firstPickStats[0] || "-",
		2: firstPickStats[1] || "-",
		3: firstPickStats[2] || "-",
		4: firstPickStats[3] || "-",
	});
	pickPrinter.addRow({
		"Fav Picks": "Second Pick",
		1: secondPickStats[0] || "-",
		2: secondPickStats[1] || "-",
		3: secondPickStats[2] || "-",
		4: secondPickStats[3] || "-",
	});
	pickPrinter.addRow({
		"Fav Picks": "Third Pick",
		1: thirdPickStats[0] || "-",
		2: thirdPickStats[1] || "-",
		3: thirdPickStats[2] || "-",
		4: thirdPickStats[3] || "-",
	});
	pickPrinter.printTable();

	// initialize the printer
	const banPrinter = new Table({
		title: "Ban Order Preference",
		columns: [
			{ name: "Fav Bans", alignment: "left" },
			{ name: "1", alignment: "center", maxLen: 20 },
			{ name: "2", alignment: "center", maxLen: 20 },
			{ name: "3", alignment: "center", maxLen: 20 },
			{ name: "4", alignment: "center", maxLen: 20 },
		],
	});
	// print the table
	banPrinter.addRow({
		"Fav Bans": "First Ban",
		1: firstBanStats[0] || "-",
		2: firstBanStats[1] || "-",
		3: firstBanStats[2] || "-",
		4: firstBanStats[3] || "-",
	});
	banPrinter.addRow({
		"Fav Bans": "Second Ban",
		1: secondBanStats[0] || "-",
		2: secondBanStats[1] || "-",
		3: secondBanStats[2] || "-",
		4: secondBanStats[3] || "-",
	});
	banPrinter.addRow({
		"Fav Bans": "Third Ban",
		1: thirdBanStats[0] || "-",
		2: thirdBanStats[1] || "-",
		3: thirdBanStats[2] || "-",
		4: thirdBanStats[3] || "-",
	});
	banPrinter.addRow({
		"Fav Bans": "Fourth Ban",
		1: fourthBanStats[0] || "-",
		2: fourthBanStats[1] || "-",
		3: fourthBanStats[2] || "-",
		4: fourthBanStats[3] || "-",
	});
	banPrinter.addRow({
		"Fav Bans": "Fifth Ban",
		1: fifthBanStats[0] || "-",
		2: fifthBanStats[1] || "-",
		3: fifthBanStats[2] || "-",
		4: fifthBanStats[3] || "-",
	});
	banPrinter.printTable();
}

export function getWinratesVsClass(className: Classes) {
	// This function also reads the file directly and prints.
	// Refactoring needed for web UI. Left as is for CLI.
	let matches: Record<string, Match> = JSON.parse(fs.readFileSync("data/result.json", "utf8"));

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		// Updated check for empty picks array or all null picks
		if (
			(matches[matchId].A.picks.length > 0 && matches[matchId].A.picks.every((p) => p === null)) ||
			(matches[matchId].B.picks.length > 0 && matches[matchId].B.picks.every((p) => p === null))
		) {
			delete matches[matchId];
		}
	});
	// only include matches of top 32 teams vs top 32 teams
	if (TOP_32_TEAMS_ONLY) {
		Object.keys(matches).forEach((matchId) => {
			if (
				!top32teams.includes(matches[matchId].A.teamName) ||
				!top32teams.includes(matches[matchId].B.teamName)
			) {
				delete matches[matchId];
			}
		});
	}

	let classWinrates: Record<
		string,
		{ encounters: number; wins: number; losses: number; draws: number; winrate: string }
	> = {};

	Object.values(classes).forEach((cn) => {
		if (cn === className) return; // Skip self-comparison

		let encounters = 0;
		let wins = 0;
		let losses = 0;
		let draws = 0;

		Object.values(matches).forEach((match) => {
			const teamAHasClass = match.A.picks.includes(className);
			const teamBHasClass = match.B.picks.includes(className);
			const teamAHasTarget = match.A.picks.includes(cn);
			const teamBHasTarget = match.B.picks.includes(cn);

			// Check if the match involves both classes, but not on the same team
			if ((teamAHasClass && teamBHasTarget) || (teamBHasClass && teamAHasTarget)) {
				encounters++;
				if (match.winner === "DRAW") {
					draws++;
				} else if ((match.winner === "A" && teamAHasClass) || (match.winner === "B" && teamBHasClass)) {
					wins++;
				} else {
					losses++;
				}
			}
		});

		let winnableGames = wins + losses; // Exclude draws for winrate calculation
		let winrate = winnableGames === 0 ? 0 : (wins / winnableGames) * 100;
		if (encounters > 0) {
			// Only include classes that have been encountered
			classWinrates[cn] = { encounters, wins, losses, draws, winrate: winrate.toFixed(1) + "%" };
		}
	});

	// Prepare data for console.table
	let tableData = Object.keys(classWinrates).map((cn) => {
		return {
			"Vs Class": cn,
			Encounters: classWinrates[cn].encounters,
			Wins: classWinrates[cn].wins,
			Losses: classWinrates[cn].losses,
			Draws: classWinrates[cn].draws,
			Winrate: classWinrates[cn].winrate,
		};
	});

	// Sort by winrate
	tableData.sort((a, b) => parseFloat(b.Winrate.replace("%", "")) - parseFloat(a.Winrate.replace("%", "")));

	// Initialize the printer
	const printer = new Table({
		title: `Winrates for ${className} vs Other Classes`,
		columns: [
			{ name: "Vs Class", alignment: "left" },
			{ name: "Encounters", alignment: "center" },
			{ name: "Wins", alignment: "center" },
			{ name: "Losses", alignment: "center" },
			{ name: "Draws", alignment: "center" },
			{ name: "Winrate", alignment: "center" },
		],
	});

	// Print the table
	tableData.forEach((row) => {
		printer.addRow(row);
	});

	printer.printTable();
}

// Add a simple type definition if you don't have one
// You might want to move this to a separate types.ts file
// export interface Match {
// 	winner: "A" | "B" | "DRAW";
// 	A: {
// 		teamName: string;
// 		bans: (string | null)[];
// 		picks: (string | null)[];
// 	};
// 	B: {
// 		teamName: string;
// 		bans: (string | null)[];
// 		picks: (string | null)[];
// 	};
// }
