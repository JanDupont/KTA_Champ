import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { calculateSideWinrate, calculateGlobalClassesData, calculatePickBanOrder } from "./src/analyze_results.js";
import { Match } from "./src/types.js";
import { processMatchUrl } from "./src/fetch_data.js"; // Import the processing function

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

const dataDir = path.join(__dirname, "..", "data");

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

// --- Helper Functions ---
function ensureTournamentFiles(tournamentPath: string, tournamentName: string) {
	const linksPath = path.join(tournamentPath, "match_sheet_links.json");
	const resultsPath = path.join(tournamentPath, "result.json");

	if (!fs.existsSync(tournamentPath)) {
		fs.mkdirSync(tournamentPath, { recursive: true });
	}
	if (!fs.existsSync(linksPath)) {
		fs.writeFileSync(linksPath, JSON.stringify([]), "utf8");
		console.log(`Created match_sheet_links.json for ${tournamentName}`);
	}
	if (!fs.existsSync(resultsPath)) {
		fs.writeFileSync(resultsPath, JSON.stringify({}), "utf8");
		console.log(`Created result.json for ${tournamentName}`);
	}
}

// --- API Endpoints ---

// Endpoint to list tournaments
app.get("/api/tournaments", (req, res) => {
	try {
		const tournamentDirs: string[] = [];
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true }); // Create data dir if it doesn't exist
		}
		const entries = fs.readdirSync(dataDir, { withFileTypes: true });
		entries.forEach((entry) => {
			if (entry.isDirectory()) {
				// Ensure files exist when listing/checking
				ensureTournamentFiles(path.join(dataDir, entry.name), entry.name);
				tournamentDirs.push(entry.name);
			}
		});
		res.json(tournamentDirs.sort()); // Return sorted list
	} catch (error) {
		console.error("Error reading tournaments directory:", error);
		res.status(500).json({ error: "Failed to retrieve tournament list" });
	}
});

// Endpoint to CREATE a new tournament
app.post("/api/tournaments", (req, res) => {
	const { tournamentName } = req.body;

	if (!tournamentName || typeof tournamentName !== "string" || !/^[a-zA-Z0-9-_]+$/.test(tournamentName)) {
		return res.status(400).json({ error: "Invalid tournament name. Use letters, numbers, hyphens, underscores." });
	}

	const tournamentPath = path.join(dataDir, tournamentName);

	if (fs.existsSync(tournamentPath)) {
		// Ensure files exist even if directory exists
		ensureTournamentFiles(tournamentPath, tournamentName);
		return res.status(409).json({ error: `Tournament '${tournamentName}' already exists.` });
	}

	try {
		// ensureTournamentFiles creates the directory and files
		ensureTournamentFiles(tournamentPath, tournamentName);
		console.log(`Created tournament directory and files: ${tournamentName}`);
		res.status(201).json({ message: `Tournament '${tournamentName}' created successfully.` });
	} catch (error) {
		console.error(`Error creating tournament ${tournamentName}:`, error);
		res.status(500).json({ error: `Failed to create tournament '${tournamentName}'.` });
	}
});

// Endpoint to GET match links for a tournament
app.get("/api/tournaments/:tournamentName/links", (req, res) => {
	const { tournamentName } = req.params;
	const tournamentPath = path.join(dataDir, tournamentName);
	const linksPath = path.join(tournamentPath, "match_sheet_links.json");

	// Ensure directory and files exist before trying to read
	ensureTournamentFiles(tournamentPath, tournamentName);

	try {
		const linksData = fs.readFileSync(linksPath, "utf8");
		res.json(JSON.parse(linksData));
	} catch (error) {
		console.error(`Error reading links for ${tournamentName}:`, error);
		// Send empty array if read fails after ensuring file exists (e.g., file corrupted)
		res.status(500).json([]);
	}
});

// Endpoint to SAVE/ADD match links for a tournament
app.post("/api/tournaments/:tournamentName/links", (req, res) => {
	const { tournamentName } = req.params;
	const { links } = req.body;

	if (!Array.isArray(links) || !links.every((link) => typeof link === "string")) {
		return res.status(400).json({ error: "Invalid links data. Expected an array of strings." });
	}

	const tournamentPath = path.join(dataDir, tournamentName);
	const linksPath = path.join(tournamentPath, "match_sheet_links.json");

	// Ensure directory and files exist
	ensureTournamentFiles(tournamentPath, tournamentName);

	try {
		const existingLinksRaw = fs.readFileSync(linksPath, "utf8");
		const existingLinks = JSON.parse(existingLinksRaw);
		// Filter out empty strings and ensure uniqueness
		const newValidLinks = links.map((l) => l.trim()).filter((l) => l.length > 0);
		const updatedLinks = Array.from(new Set([...existingLinks, ...newValidLinks]));

		fs.writeFileSync(linksPath, JSON.stringify(updatedLinks, null, 2), "utf8");
		console.log(
			`Updated links for ${tournamentName}. Added ${updatedLinks.length - existingLinks.length} new links.`
		);
		res.json({ message: `Links saved successfully for ${tournamentName}.`, totalLinks: updatedLinks.length });
	} catch (error) {
		console.error(`Error saving links for ${tournamentName}:`, error);
		res.status(500).json({ error: `Failed to save match links for ${tournamentName}.` });
	}
});

// Endpoint to trigger stats generation (fetching and processing)
app.post("/api/tournaments/:tournamentName/generate-stats", async (req, res) => {
	const { tournamentName } = req.params;
	const tournamentPath = path.join(dataDir, tournamentName);
	const linksPath = path.join(tournamentPath, "match_sheet_links.json");
	const resultsPath = path.join(tournamentPath, "result.json");

	// Ensure directory and files exist
	ensureTournamentFiles(tournamentPath, tournamentName);

	try {
		const linksRaw = fs.readFileSync(linksPath, "utf8");
		const linksToProcess: string[] = JSON.parse(linksRaw);

		const resultsRaw = fs.readFileSync(resultsPath, "utf8");
		const existingResults: Record<string, Match> = JSON.parse(resultsRaw);

		let processedCount = 0;
		let failedCount = 0;
		const newResults: Record<string, Match> = { ...existingResults };

		console.log(
			`Starting stats generation for ${tournamentName}. Total links: ${
				linksToProcess.length
			}. Existing results: ${Object.keys(existingResults).length}`
		);

		for (const link of linksToProcess) {
			// Check if link is valid and not already processed
			if (link && typeof link === "string" && !newResults[link]) {
				console.log(`Processing new link: ${link}`);
				const result = await processMatchUrl(link); // Assumes processMatchUrl handles errors internally
				if (result.data) {
					// @ts-ignore - Assuming structure is correct
					newResults[result.url] = result.data;
					processedCount++;
				} else {
					failedCount++;
					console.warn(`Failed to process ${link}`);
					// Optional: Store failed links?
				}
				// Optional: Add a small delay to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 150)); // 150ms delay
			}
		}

		fs.writeFileSync(resultsPath, JSON.stringify(newResults, null, 2), "utf8");
		console.log(
			`Finished stats generation for ${tournamentName}. Newly Processed: ${processedCount}, Failed: ${failedCount}, Total results: ${
				Object.keys(newResults).length
			}`
		);
		res.json({
			message: `Stats generation complete for ${tournamentName}.`,
			processed: processedCount,
			failed: failedCount,
			totalResults: Object.keys(newResults).length,
		});
	} catch (error) {
		console.error(`Error generating stats for ${tournamentName}:`, error);
		res.status(500).json({ error: `Failed to generate stats for ${tournamentName}.` });
	}
});

// Endpoint to get calculated stats for a specific tournament
app.get("/api/tournaments/:tournamentName/stats", (req, res) => {
	const { tournamentName } = req.params;
	const tournamentPath = path.join(dataDir, tournamentName);
	const resultsPath = path.join(tournamentPath, "result.json");

	// Ensure directory and files exist
	ensureTournamentFiles(tournamentPath, tournamentName);

	if (!fs.existsSync(resultsPath)) {
		// This case should ideally not happen due to ensureTournamentFiles, but as a fallback:
		console.warn(`result.json still not found for ${tournamentName} after check.`);
		return res.json({
			// Return empty stats structure
			sideWinrate: [],
			globalClasses: [],
			pickBanOrder: [],
		});
	}

	try {
		const rawData = fs.readFileSync(resultsPath, "utf8");
		const matches: Record<string, Match> = JSON.parse(rawData);

		if (Object.keys(matches).length === 0) {
			return res.json({
				// Return empty stats if no matches processed yet
				sideWinrate: [],
				globalClasses: [],
				pickBanOrder: [],
			});
		}

		// Run analyses
		const sideWinrateData = calculateSideWinrate(matches);
		const globalClassesData = calculateGlobalClassesData(matches);
		const pickBanOrderData = calculatePickBanOrder(matches);

		res.json({
			sideWinrate: sideWinrateData,
			globalClasses: globalClassesData,
			pickBanOrder: pickBanOrderData,
		});
	} catch (error) {
		console.error(`Error processing stats for ${tournamentName}:`, error);
		res.status(500).json({ error: `Failed to process stats for ${tournamentName}` });
	}
});

app.listen(port, () => {
	console.log(`Backend server listening at http://localhost:${port}`);
});
