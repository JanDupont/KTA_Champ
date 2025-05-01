import { classes } from "./classes.js";
import { Match, Side } from "./types.js";

function filterMatches(inputMatches: Record<string, Match>): Record<string, Match> {
	let matches = JSON.parse(JSON.stringify(inputMatches)); // Deep clone to avoid modifying original data

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		if (
			(matches[matchId].A.picks.length > 0 && matches[matchId].A.picks.every((p: string | null) => p === null)) ||
			(matches[matchId].B.picks.length > 0 && matches[matchId].B.picks.every((p: string | null) => p === null))
		) {
			delete matches[matchId];
		}
	});

	return matches;
}

export function calculateSideWinrate(inputMatches: Record<string, Match>) {
	const matches = filterMatches(inputMatches);
	const totalMatches = Object.keys(matches).length;
	if (totalMatches === 0) return []; // Return empty array if no matches

	let sideWinrates: Record<Side, { wins: number; losses: number; draws: number }> = {
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
		let sideData = sideWinrates[side as Side];
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
