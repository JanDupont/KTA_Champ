import fs from "fs";
import { classes } from "./classes.js";
import { Table } from "console-table-printer";

const MODE = "PLAYOFFS"; // "SWISS" | "PLAYOFFS"
const TOP_32_TEAMS_ONLY = false; // only use this in SWISS mode

type Match = {
	winner: "A" | "B" | "DRAW";
	A: {
		teamName: string;
		bans: string[];
		picks: string[];
	};
	B: {
		teamName: string;
		bans: string[];
		picks: string[];
	};
};

type ClassPlayData = {
	totalPicks: number;
	totalBans: number;
	totalPresence: number;
	totalWins: number;
	totalLosses: number;
	totalDraws: number;
	AWins: number;
	BWins: number;
	ALosses: number;
	BLosses: number;
	ADraws: number;
	BDraws: number;
};
type ClassPickBanData = {
	ABan1: number;
	BBan1: number;
	ABan2: number;
	BBan2: number;
	APick1: number;
	BPick1: number;
	BBan3: number;
	ABan3: number;
	BBan4: number;
	ABan4: number;
	BPick2: number;
	APick2: number;
	ABan5: number;
	BBan5: number;
	APick3: number;
	BPick3: number;
};

let top32teams = [
	"RLCS",
	"Digital",
	"ssj",
	"Polia",
	"Somnium",
	"138",
	"Rfissa gang",
	"HOF YANG",
	"Drunked Totem",
	"Black Flag",
	"HOF YIN",
	"Helios Gaming",
	"Sagarmatha",
	"QUOIQUOUFEUR",
	"Demonic Soldiers",
	"Tempête",
	"Ego",
	"Umbra",
	"Unique",
	"Hasascow",
	"miou",
	"Celestia",
	"Bloodbath",
	"Vroom Vroom",
	"Outbreak",
	"Lone Wolf",
	"GAMA",
	"Boar",
	"Bourds",
	"El Famoso",
	"Les 3 moustiquaires",
	"Faucon Tigré",
];

export function analizeSideWinrate() {
	let matches: Record<string, Match> = JSON.parse(fs.readFileSync("data/result.json", "utf8"));

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		if (matches[matchId].A.picks[0] === null && matches[matchId].B.picks[0] === null) {
			delete matches[matchId];
		}
	});

	// PLAYOFFS: remove draw matches
	if (MODE === "PLAYOFFS") {
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

	let sideWinrates: Record<string, { wins: number; losses: number; draws: number }> = {
		A: {
			wins: 0,
			losses: 0,
			draws: 0,
		},
		B: {
			wins: 0,
			losses: 0,
			draws: 0,
		},
	};

	Object.values(matches).forEach((match) => {
		if (match.winner === "A") sideWinrates.A.wins++;
		else if (match.winner === "B") sideWinrates.B.wins++;
		else {
			sideWinrates.A.draws++;
			sideWinrates.B.draws++;
		}
	});

	sideWinrates.A.losses = Object.keys(matches).length - sideWinrates.A.wins - sideWinrates.A.draws;
	sideWinrates.B.losses = Object.keys(matches).length - sideWinrates.B.wins - sideWinrates.B.draws;

	// prepare data for console.table
	let tableData = Object.keys(sideWinrates).map((side) => {
		let sideData = sideWinrates[side];
		let winrate = (sideData.wins / (sideData.wins + sideData.losses + sideData.draws)) * 100;
		return {
			Side: side,
			Winrate: winrate.toFixed(1) + "%",
			Wins: sideData.wins,
			Losses: sideData.losses,
			Draws: sideData.draws,
		};
	});

	// Initialize the printer
	const printer = new Table({
		columns: [
			{ name: "Side", alignment: "left" },
			{ name: "Winrate", alignment: "center" },
			{ name: "Wins", alignment: "center" },
			{ name: "Losses", alignment: "center" },
			{ name: "Draws", alignment: "center" },
		],
	});

	// Print the table
	tableData.forEach((row) => {
		printer.addRow(row);
	});

	printer.printTable();
}

export function analyzeGlobalClassesData() {
	let matches: Record<string, Match> = JSON.parse(fs.readFileSync("data/result.json", "utf8"));

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		if (matches[matchId].A.picks[0] === null && matches[matchId].B.picks[0] === null) {
			delete matches[matchId];
		}
	});

	// PLAYOFFS: remove draw matches
	if (MODE === "PLAYOFFS") {
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

	let totalMatchesAllClasses = Object.keys(matches).length;
	let classesaData: Record<string, ClassPlayData> = {};

	Object.values(classes).forEach((className) => {
		let classData: ClassPlayData = {
			totalPicks: 0,
			totalBans: 0,
			totalPresence: 0,
			totalWins: 0,
			totalLosses: 0,
			totalDraws: 0,
			AWins: 0,
			ALosses: 0,
			ADraws: 0,
			BWins: 0,
			BLosses: 0,
			BDraws: 0,
		};
		Object.values(matches).forEach((match) => {
			// picks
			if (match.A.picks.includes(className) || match.B.picks.includes(className)) classData.totalPicks++;
			// bans
			if (match.A.bans.includes(className) || match.B.bans.includes(className)) classData.totalBans++;
			// draws
			if (match.winner === "DRAW" && match.A.picks.includes(className)) {
				classData.totalDraws++;
				classData.ADraws++;
			}
			if (match.winner === "DRAW" && match.B.picks.includes(className)) {
				classData.totalDraws++;
				classData.BDraws++;
			}
			// wins
			if (match.winner === "A" && match.A.picks.includes(className)) {
				classData.totalWins++;
				classData.AWins++;
			}
			if (match.winner === "B" && match.B.picks.includes(className)) {
				classData.totalWins++;
				classData.BWins++;
			}
			// losses
			if (match.winner === "A" && match.B.picks.includes(className)) {
				classData.totalLosses++;
				classData.BLosses++;
			}
			if (match.winner === "B" && match.A.picks.includes(className)) {
				classData.totalLosses++;
				classData.ALosses++;
			}
		});
		// presence
		classData.totalPresence = (classData.totalPicks + classData.totalBans) / totalMatchesAllClasses;

		classesaData[className] = classData;
	});

	// Prepare data for console.table
	let tableData = Object.keys(classesaData).map((className, index) => {
		let classData = classesaData[className];
		let winrate =
			(classData.totalWins / (classData.totalWins + classData.totalLosses + classData.totalDraws) || 0) * 100;
		let winrateA = (classData.AWins / (classData.AWins + classData.ALosses + classData.ADraws) || 0) * 100;
		let winrateB = (classData.BWins / (classData.BWins + classData.BLosses + classData.BDraws) || 0) * 100;
		let pickrate = (classData.totalPicks / totalMatchesAllClasses || 0) * 100;
		let banrate = (classData.totalBans / totalMatchesAllClasses || 0) * 100;
		let presence = (classData.totalPresence || 0) * 100;

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
			"Winrate (B)": winrateB.toFixed(1) + "%",
			"Picks (A)": classData.AWins + classData.ALosses + classData.ADraws,
			"Picks (B)": classData.BWins + classData.BLosses + classData.BDraws,
			"Wins (A)": classData.AWins,
			"Wins (B)": classData.BWins,
		};
	});

	// Sort tableData by presence
	tableData.sort((a, b) => parseFloat(b.Presence) - parseFloat(a.Presence));

	console.log("Total matches: ", totalMatchesAllClasses);

	// Initialize the printer
	const printer = new Table({
		columns: [
			{ name: "Class", alignment: "left" },
			{ name: "Winrate", alignment: "center" },
			{ name: "Pickrate", alignment: "center" },
			{ name: "Banrate", alignment: "center" },
			{ name: "Picks", alignment: "center" },
			{ name: "Wins", alignment: "center" },
			{ name: "Losses", alignment: "center" },
			{ name: "Draws", alignment: "center" },
			{ name: "Presence", alignment: "center" },
			{ name: "Winrate (A)", alignment: "center" },
			{ name: "Winrate (B)", alignment: "center" },
			{ name: "Picks (A)", alignment: "center" },
			{ name: "Picks (B)", alignment: "center" },
			{ name: "Wins (A)", alignment: "center" },
			{ name: "Wins (B)", alignment: "center" },
		],
	});

	// Print the table with colored winrates
	tableData.forEach((row, index) => {
		// Color winrates
		const winrate = parseFloat(row.Winrate.replace("%", ""));
		const pickRate = parseFloat(row.Pickrate.replace("%", ""));
		const winrateColor =
			pickRate == 0
				? "white"
				: winrate < 52 && winrate > 48
				? "yellow"
				: winrate > 50
				? "green"
				: winrate == 50
				? "white"
				: "red";

		printer.addRow(row, { color: winrateColor });
	});

	// Print the table
	printer.printTable();
}

export function analyzePickBanOrder() {
	let matches: Record<string, Match> = JSON.parse(fs.readFileSync("data/result.json", "utf8"));

	// remove time forfeits (A or B picks == [null, null, null])
	Object.keys(matches).forEach((matchId) => {
		if (matches[matchId].A.picks[0] === null && matches[matchId].B.picks[0] === null) {
			delete matches[matchId];
		}
	});

	// PLAYOFFS: remove draw matches
	if (MODE === "PLAYOFFS") {
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

	let totalMatchesAllClasses = Object.keys(matches).length;
	let classesPickBanData: Record<string, ClassPickBanData> = {};

	Object.values(classes).forEach((className) => {
		let classPickBanData: ClassPickBanData = {
			ABan1: 0,
			BBan1: 0,
			ABan2: 0,
			BBan2: 0,
			APick1: 0,
			BPick1: 0,
			BBan3: 0,
			ABan3: 0,
			BBan4: 0,
			ABan4: 0,
			BPick2: 0,
			APick2: 0,
			ABan5: 0,
			BBan5: 0,
			APick3: 0,
			BPick3: 0,
		};
		classesPickBanData[className] = classPickBanData;
	});

	Object.values(matches).forEach((match) => {
		match.A.bans.forEach((ban, index) => {
			if (!ban) return;
			let key = "ABan" + (index + 1);
			// @ts-ignore
			classesPickBanData[ban][key]++;
		});
		match.B.bans.forEach((ban, index) => {
			if (!ban) return;
			let key = "BBan" + (index + 1);
			// @ts-ignore
			classesPickBanData[ban][key]++;
		});
		match.A.picks.forEach((pick, index) => {
			if (!pick) return;
			let key = "APick" + (index + 1);
			// @ts-ignore
			classesPickBanData[pick][key]++;
		});
		match.B.picks.forEach((pick, index) => {
			if (!pick) return;
			let key = "BPick" + (index + 1);
			// @ts-ignore
			classesPickBanData[pick][key]++;
		});
	});

	// prepare data for console.table
	let tableData = Object.keys(classesPickBanData).map((className, index) => {
		let classData = classesPickBanData[className];
		return {
			Class: className,
			ABan1: ((classData.ABan1 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BBan1: ((classData.BBan1 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			ABan2: ((classData.ABan2 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BBan2: ((classData.BBan2 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			APick1: ((classData.APick1 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BPick1: ((classData.BPick1 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BBan3: ((classData.BBan3 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			ABan3: ((classData.ABan3 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BBan4: ((classData.BBan4 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			ABan4: ((classData.ABan4 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BPick2: ((classData.BPick2 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			APick2: ((classData.APick2 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			ABan5: ((classData.ABan5 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BBan5: ((classData.BBan5 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			APick3: ((classData.APick3 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
			BPick3: ((classData.BPick3 / totalMatchesAllClasses) * 100).toFixed(1) + "%",
		};
	});

	// sort tableData by ABan1
	tableData.sort((a, b) => parseFloat(b.ABan1) - parseFloat(a.ABan1));

	// Initialize the printer
	const printer = new Table({
		columns: [
			{ name: "Class", alignment: "left" },
			{ name: "ABan1", alignment: "center", color: "magenta" },
			{ name: "BBan1", alignment: "center", color: "magenta" },
			{ name: "ABan2", alignment: "center", color: "magenta" },
			{ name: "BBan2", alignment: "center", color: "magenta" },
			{ name: "APick1", alignment: "center", color: "cyan" },
			{ name: "BPick1", alignment: "center", color: "cyan" },
			{ name: "BBan3", alignment: "center", color: "magenta" },
			{ name: "ABan3", alignment: "center", color: "magenta" },
			{ name: "BBan4", alignment: "center", color: "magenta" },
			{ name: "ABan4", alignment: "center", color: "magenta" },
			{ name: "BPick2", alignment: "center", color: "cyan" },
			{ name: "APick2", alignment: "center", color: "cyan" },
			{ name: "ABan5", alignment: "center", color: "magenta" },
			{ name: "BBan5", alignment: "center", color: "magenta" },
			{ name: "APick3", alignment: "center", color: "cyan" },
			{ name: "BPick3", alignment: "center", color: "cyan" },
		],
	});

	tableData.forEach((row, index) => {
		printer.addRow(row);
	});

	// Print the table
	printer.printTable();
}
