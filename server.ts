import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url"; // Import necessary function for ES modules
import { calculateSideWinrate, calculateGlobalClassesData, calculatePickBanOrder } from "./src/analyze_results.js"; // Adjust path if needed
import { Match } from "./src/types.js"; // Adjust path if needed

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001; // Or any other port not used by the Vue dev server (usually 5173)

const dataDir = path.join(__dirname, "..", "data"); // Go one level up from dist

// Enable CORS for frontend requests
app.use(cors()); // Allow all origins for development. Restrict in production.

// Endpoint to list tournaments
app.get("/api/tournaments", (req, res) => {
	try {
		const tournamentDirs: string[] = [];
		const entries = fs.readdirSync(dataDir, { withFileTypes: true });
		entries.forEach((entry) => {
			if (entry.isDirectory()) {
				const resultJsonPath = path.join(dataDir, entry.name, "result.json");
				if (fs.existsSync(resultJsonPath)) {
					tournamentDirs.push(entry.name);
				}
			}
		});
		res.json(tournamentDirs);
	} catch (error) {
		console.error("Error reading tournaments directory:", error);
		res.status(500).json({ error: "Failed to retrieve tournament list" });
	}
});

// Endpoint to get stats for a specific tournament
app.get("/api/tournaments/:tournamentName/stats", (req, res) => {
	const { tournamentName } = req.params;
	const resultJsonPath = path.join(dataDir, tournamentName, "result.json");

	if (!fs.existsSync(resultJsonPath)) {
		return res.status(404).json({ error: `Tournament data not found for ${tournamentName}` });
	}

	try {
		const rawData = fs.readFileSync(resultJsonPath, "utf8");
		const matches: Record<string, Match> = JSON.parse(rawData);

		// Run analyses
		const sideWinrateData = calculateSideWinrate(matches);
		const globalClassesData = calculateGlobalClassesData(matches);
		const pickBanOrderData = calculatePickBanOrder(matches);
		// Add calls to other analysis functions if needed

		res.json({
			sideWinrate: sideWinrateData,
			globalClasses: globalClassesData,
			pickBanOrder: pickBanOrderData,
			// Add other results here
		});
	} catch (error) {
		console.error(`Error processing stats for ${tournamentName}:`, error);
		res.status(500).json({ error: `Failed to process stats for ${tournamentName}` });
	}
});

app.listen(port, () => {
	console.log(`Backend server listening at http://localhost:${port}`);
});
