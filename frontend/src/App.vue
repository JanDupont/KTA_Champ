<template>
	<div id="app-container">
		<h1>KTA Championship Stats</h1>

		<!-- Tournament Management -->
		<section class="management-section card">
			<h2>Manage Tournaments</h2>
			<div class="form-group">
				<label for="new-tournament-name">New Tournament Name:</label>
				<input
					type="text"
					id="new-tournament-name"
					v-model.trim="newTournamentName"
					placeholder="e.g., world-cup-2025"
				/>
				<button @click="createTournament" :disabled="!newTournamentName || loadingAction">Create</button>
			</div>
			<div
				v-if="actionMessage && currentAction === 'create'"
				:class="['message', actionError ? 'error' : 'success']"
			>
				{{ actionMessage }}
			</div>
		</section>

		<!-- Tournament Selection -->
		<section class="controls card">
			<h2>View Stats</h2>
			<label for="tournament-select">Select Tournament:</label>
			<select
				id="tournament-select"
				v-model="selectedTournament"
				@change="onTournamentSelect"
				:disabled="loadingTournaments || tournaments.length === 0"
			>
				<option value="">
					{{
						loadingTournaments
							? "Loading..."
							: tournaments.length === 0
							? "-- No Tournaments Found --"
							: "-- Select Tournament --"
					}}
				</option>
				<option v-for="tournament in tournaments" :key="tournament" :value="tournament">
					{{ tournament }}
				</option>
			</select>
			<div v-if="loadingError" class="message error">{{ loadingError }}</div>
		</section>

		<!-- Match Link Management (Shown when a tournament is selected) -->
		<section v-if="selectedTournament" class="management-section card">
			<h2>Manage Matches for: {{ selectedTournament }}</h2>
			<p>Current links: {{ currentLinks.length }}</p>
			<div class="form-group">
				<label for="link-pattern">Link Pattern:</label>
				<input
					type="text"
					id="link-pattern"
					v-model="linkPattern"
					placeholder="e.g., https://ktarena.com/en/xxx-name/match/{id}/1"
				/>
			</div>
			<div class="form-group range-group">
				<label for="start-id">Start ID:</label>
				<input type="number" id="start-id" v-model.number="startId" min="1" />
				<label for="end-id">End ID:</label>
				<input type="number" id="end-id" v-model.number="endId" :min="startId || 1" />
				<button @click="generateLinks" :disabled="!linkPattern || !startId || !endId || startId > endId">
					Generate Links
				</button>
			</div>
			<div class="form-group">
				<label for="generated-links">Add Links:</label>
				<textarea
					id="generated-links"
					v-model="linksToAdd"
					rows="5"
					placeholder="Enter links manually (one per line) or generate above"
				></textarea>
			</div>
			<div class="form-group action-buttons">
				<button @click="saveLinks" :disabled="!linksToAdd || loadingAction">
					Save Links to {{ selectedTournament }}
				</button>
				<button @click="makeStats" :disabled="loadingAction || currentLinks.length === 0">
					Fetch Data & Make Stats
				</button>
			</div>
			<div
				v-if="actionMessage && currentAction !== 'create'"
				:class="['message', actionError ? 'error' : 'success']"
			>
				{{ actionMessage }}
			</div>
			<div v-if="loadingAction" class="message info">Processing... {{ actionProgress }}</div>
		</section>

		<!-- Stats Display -->
		<div id="stats-output" class="card">
			<div v-if="loadingStats" class="loading-message">Loading stats for {{ selectedTournament }}...</div>
			<div v-else-if="statsError" class="message error">Error loading stats: {{ statsError }}</div>
			<div
				v-else-if="
					selectedTournament &&
					statsData &&
					(statsData.sideWinrate?.length > 0 || statsData.globalClasses?.length > 0)
				"
			>
				<StatsTable
					title="Side Winrate"
					:data="statsData.sideWinrate"
					:columns="['Side', 'Winrate', 'Wins', 'Losses', 'Draws', 'Total']"
				/>
				<StatsTable
					title="Global Class Stats"
					:data="statsData.globalClasses"
					:columns="[
						'Class',
						'Presence',
						'Winrate',
						'Pickrate',
						'Banrate',
						'Picks',
						'Bans',
						'Wins',
						'Losses',
						'Draws',
						'Winrate (A)',
						'Wins (A)',
						'Losses (A)',
						'Draws (A)',
						'Winrate (B)',
						'Wins (B)',
						'Losses (B)',
						'Draws (B)',
					]"
				/>
				<StatsTable
					title="Pick/Ban Order (%)"
					:data="statsData.pickBanOrder"
					:columns="[
						'Class',
						'ABan1',
						'BBan1',
						'ABan2',
						'BBan2',
						'APick1',
						'BPick1',
						'BPick2',
						'APick2',
						'BBan3',
						'ABan3',
						'APick3',
						'BPick3',
						'ABan4',
						'BBan4',
						'ABan5',
						'BBan5',
					]"
				/>
			</div>
			<div v-else-if="selectedTournament">
				<p>
					No stats calculated yet for {{ selectedTournament }}. Add match links and click "Fetch Data & Make
					Stats".
				</p>
			</div>
			<div v-else>
				<p>Select or create a tournament.</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import axios from "axios";
import StatsTable from "./components/StatsTable.vue";

interface StatsData {
	sideWinrate: any[];
	globalClasses: any[];
	pickBanOrder: any[];
}

type ActionType = "create" | "saveLinks" | "generateStats" | null;

const tournaments = ref<string[]>([]);
const selectedTournament = ref<string>("");
const statsData = ref<StatsData | null>(null);
const loadingTournaments = ref<boolean>(true);
const loadingStats = ref<boolean>(false);
const loadingError = ref<string | null>(null); // Error for loading tournaments list
const statsError = ref<string | null>(null); // Specifically for stats loading error

// Management State
const newTournamentName = ref<string>("");
const linkPattern = ref<string>("https://ktarena.com/en/CHANGE_THIS/match/{id}/1"); // Default example
const startId = ref<number | null>(null);
const endId = ref<number | null>(null);
const linksToAdd = ref<string>("");
const currentLinks = ref<string[]>([]); // Links currently saved for the selected tournament
const loadingAction = ref<boolean>(false); // Loading state for create/save/generate actions
const actionMessage = ref<string | null>(null); // Feedback message for actions
const actionError = ref<boolean>(false); // Was the last action an error?
const currentAction = ref<ActionType>(null); // Track which action is running
const actionProgress = ref<string>(""); // Progress message for long actions

const API_BASE_URL = "http://localhost:3001/api";

const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 600000, // Increase timeout for potentially long operations like generate-stats (10 minutes)
});

const clearActionState = () => {
	actionMessage.value = null;
	actionError.value = false;
	currentAction.value = null;
	actionProgress.value = "";
};

const fetchTournaments = async (selectTournament?: string) => {
	loadingTournaments.value = true;
	loadingError.value = null;
	clearActionState();
	try {
		const response = await api.get<string[]>("/tournaments");
		tournaments.value = response.data; // Already sorted by backend
		if (selectTournament && tournaments.value.includes(selectTournament)) {
			selectedTournament.value = selectTournament;
			await loadTournamentData(); // Load links and stats
		} else if (!selectedTournament.value && tournaments.value.length > 0) {
			// Do nothing, wait for user selection
		} else if (selectedTournament.value && !tournaments.value.includes(selectedTournament.value)) {
			// If the previously selected tournament no longer exists (e.g., deleted manually)
			selectedTournament.value = "";
			statsData.value = null;
			currentLinks.value = [];
		}
	} catch (err: any) {
		console.error("Error fetching tournaments:", err);
		loadingError.value = "Failed to load tournament list. Is the backend server running?";
		tournaments.value = [];
		selectedTournament.value = "";
		statsData.value = null;
		currentLinks.value = [];
	} finally {
		loadingTournaments.value = false;
	}
};

const loadTournamentLinks = async () => {
	if (!selectedTournament.value) {
		currentLinks.value = [];
		return;
	}
	try {
		const response = await api.get<string[]>(`/tournaments/${selectedTournament.value}/links`);
		currentLinks.value = response.data;
	} catch (err: any) {
		console.error(`Error fetching links for ${selectedTournament.value}:`, err);
		actionMessage.value = `Error loading links: ${err.response?.data?.error || err.message}`;
		actionError.value = true;
		currentLinks.value = []; // Reset on error
	}
};

const loadTournamentStats = async () => {
	if (!selectedTournament.value) {
		statsData.value = null;
		statsError.value = null;
		return;
	}

	loadingStats.value = true;
	statsError.value = null;
	statsData.value = null;

	try {
		const response = await api.get<StatsData>(`/tournaments/${selectedTournament.value}/stats`);
		statsData.value = response.data; // Store whatever the backend returns
	} catch (err: any) {
		console.error(`Error fetching stats for ${selectedTournament.value}:`, err);
		statsError.value = `Failed to load stats. ${err.response?.data?.error || err.message}`;
	} finally {
		loadingStats.value = false;
	}
};

const loadTournamentData = async () => {
	clearActionState();
	linksToAdd.value = ""; // Clear link input area
	await Promise.all([loadTournamentLinks(), loadTournamentStats()]);
};

const onTournamentSelect = () => {
	loadTournamentData();
};

const createTournament = async () => {
	if (!newTournamentName.value) return;
	loadingAction.value = true;
	clearActionState();
	currentAction.value = "create";
	try {
		const response = await api.post("/tournaments", { tournamentName: newTournamentName.value });
		actionMessage.value = response.data.message;
		const newlyCreatedName = newTournamentName.value; // Store before clearing
		newTournamentName.value = ""; // Clear input
		await fetchTournaments(newlyCreatedName); // Refresh list and select the new one
	} catch (err: any) {
		console.error("Error creating tournament:", err);
		actionMessage.value = `Error: ${err.response?.data?.error || err.message}`;
		actionError.value = true;
	} finally {
		loadingAction.value = false;
	}
};

const generateLinks = () => {
	if (!linkPattern.value || !startId.value || !endId.value || startId.value > endId.value) {
		actionMessage.value = "Invalid pattern or ID range.";
		actionError.value = true;
		currentAction.value = "saveLinks"; // Show message in the link section
		return;
	}
	clearActionState();
	currentAction.value = "saveLinks";

	const generated: string[] = [];
	for (let i = startId.value; i <= endId.value; i++) {
		if (linkPattern.value.includes("{id}")) {
			generated.push(linkPattern.value.replace("{id}", String(i)));
		} else {
			actionMessage.value = "Pattern must include '{id}'.";
			actionError.value = true;
			return;
		}
	}
	// Append to existing text in textarea, separated by newlines
	const existingLinks = linksToAdd.value ? linksToAdd.value.split("\n").filter((link) => link.trim() !== "") : [];
	const combinedLinks = Array.from(new Set([...existingLinks, ...generated])); // Ensure uniqueness
	linksToAdd.value = combinedLinks.join("\n");
};

const saveLinks = async () => {
	if (!selectedTournament.value || !linksToAdd.value) return;

	const links = linksToAdd.value
		.split("\n")
		.map((link) => link.trim())
		.filter((link) => link !== "");
	if (links.length === 0) {
		actionMessage.value = "No valid links to save.";
		actionError.value = true;
		currentAction.value = "saveLinks";
		return;
	}

	loadingAction.value = true;
	clearActionState();
	currentAction.value = "saveLinks";

	try {
		const response = await api.post(`/tournaments/${selectedTournament.value}/links`, { links });
		actionMessage.value = response.data.message;
		linksToAdd.value = ""; // Clear textarea after successful save
		await loadTournamentLinks(); // Refresh the current links count
	} catch (err: any) {
		console.error("Error saving links:", err);
		actionMessage.value = `Error: ${err.response?.data?.error || err.message}`;
		actionError.value = true;
	} finally {
		loadingAction.value = false;
	}
};

const makeStats = async () => {
	if (!selectedTournament.value) return;

	loadingAction.value = true;
	clearActionState();
	currentAction.value = "generateStats";
	statsData.value = null; // Clear old stats display
	statsError.value = null;

	try {
		actionMessage.value = `Starting stats generation for ${selectedTournament.value}... This may take a while.`;
		actionProgress.value = "(Fetching match data...)"; // Initial progress
		// No need for progress updates from backend in this simple version
		const response = await api.post(`/tournaments/${selectedTournament.value}/generate-stats`);
		actionProgress.value = ""; // Clear progress message
		actionMessage.value = `${response.data.message} Processed: ${response.data.processed}, Failed: ${response.data.failed}, Total: ${response.data.totalResults}`;
		await loadTournamentStats(); // Reload stats after generation
	} catch (err: any) {
		console.error("Error generating stats:", err);
		actionMessage.value = `Error generating stats: ${err.response?.data?.error || err.message}`;
		actionError.value = true;
		actionProgress.value = ""; // Clear progress on error
	} finally {
		loadingAction.value = false;
	}
};

onMounted(() => {
	fetchTournaments();
});
</script>

<style>
body {
	font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
	margin: 0;
	background: linear-gradient(135deg, #cb4aec, #18d8fc);
	background-size: 200% 200%; /* For animation */
	animation: gradientBG 10s ease infinite;
	color: #fff;
	min-height: 100vh; /* Ensure gradient covers full height */
}

@keyframes gradientBG {
	0% {
		background-position: 0% 50%;
	}
	50% {
		background-position: 100% 50%;
	}
	100% {
		background-position: 0% 50%;
	}
}

#app-container {
	margin: 20px auto;
	padding: 0 20px;
	background-color: transparent;
	box-shadow: none;
}

h1 {
	color: #fff;
	text-align: center;
	margin-bottom: 2rem;
	text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

h2 {
	margin-top: 0;
	margin-bottom: 1rem;
	border-bottom: 1px solid rgba(255, 255, 255, 0.3);
	padding-bottom: 0.5rem;
	color: #fff;
	text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card {
	background: rgba(255, 255, 255, 0.1); /* Increased opacity for "milky" look */
	backdrop-filter: blur(10px); /* Slightly reduced blur */
	-webkit-backdrop-filter: blur(10px); /* Safari support */
	border-radius: 12px; /* Softer corners */
	border: 1px solid rgba(255, 255, 255, 0.3); /* Slightly more visible border */
	box-shadow: 0 6px 24px 0 rgba(0, 0, 0, 0.1); /* Adjusted shadow */
	padding: 25px; /* Slightly more padding */
	margin-bottom: 2rem; /* More spacing */
}

label {
	margin-right: 10px;
	font-weight: bold;
	display: inline-block;
	min-width: 120px;
	margin-bottom: 5px;
	color: #f0f0f0; /* Slightly brighter label */
}

input[type="text"],
input[type="number"],
select,
textarea {
	padding: 10px 14px; /* Slightly larger padding */
	border: 1px solid rgba(255, 255, 255, 0.3); /* Light border */
	border-radius: 6px; /* Match card radius */
	margin-right: 10px;
	margin-bottom: 10px;
	font-size: 0.95rem;
	box-sizing: border-box;
	background: rgba(255, 255, 255, 0.15); /* Increased opacity slightly */
	color: #fff; /* White text */
	outline: none; /* Remove default outline */
	transition: border-color 0.2s ease, background-color 0.2s ease;
}

input[type="text"]::placeholder,
textarea::placeholder {
	color: rgba(255, 255, 255, 0.6); /* Lighter placeholder text */
}

input[type="text"]:focus,
input[type="number"]:focus,
select:focus,
textarea:focus {
	border-color: rgba(255, 255, 255, 0.6); /* Highlight border on focus */
	background: rgba(255, 255, 255, 0.15); /* Slightly more opaque on focus */
}

input[type="text"] {
	flex-grow: 1;
	min-width: 200px;
}
textarea {
	width: 100%;
	min-height: 80px;
	font-family: monospace;
	margin-top: 5px;
}
input[type="number"] {
	width: 90px;
}

select {
	min-width: 250px;
	flex-grow: 1;
	/* Appearance reset might be needed for consistent styling */
	appearance: none;
	-webkit-appearance: none;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23ffffff' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E"); /* White dropdown arrow */
	background-repeat: no-repeat;
	background-position: right 10px center;
	background-size: 16px 12px;
	padding-right: 35px; /* Space for the arrow */
}

select option {
	background-color: #333; /* Dark background for dropdown options */
	color: #fff;
}

button {
	padding: 10px 18px; /* Slightly larger */
	border: 1px solid rgba(255, 255, 255, 0.4); /* Match border opacity increase */
	border-radius: 6px;
	/* Milky White Button Background */
	background: rgba(255, 255, 255, 0.25); /* Increased opacity */
	color: white;
	cursor: pointer;
	font-size: 0.95rem;
	font-weight: bold;
	transition: all 0.3s ease;
	margin-left: 5px;
	margin-bottom: 10px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* Reduced shadow */
	backdrop-filter: blur(2px); /* Subtle blur on button */
	-webkit-backdrop-filter: blur(2px);
}

button:hover {
	background: rgba(255, 255, 255, 0.35); /* Lighten on hover */
	border-color: rgba(255, 255, 255, 0.6);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	transform: translateY(-1px); /* Smaller lift */
}

button:disabled {
	background: rgba(255, 255, 255, 0.1); /* Keep disabled subtle */
	color: rgba(255, 255, 255, 0.5); /* Slightly brighter disabled text */
	border-color: rgba(255, 255, 255, 0.2);
	cursor: not-allowed;
	box-shadow: none;
	transform: none;
	backdrop-filter: none;
	-webkit-backdrop-filter: none;
}

.form-group {
	margin-bottom: 15px;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
}

.form-group label {
	flex-shrink: 0;
}

.form-group.range-group label {
	min-width: auto;
	margin-left: 10px;
}
.form-group.range-group label:first-of-type {
	margin-left: 0;
}

.form-group.action-buttons {
	justify-content: flex-start;
	gap: 10px;
}
.form-group.action-buttons button {
	margin-left: 0;
}

#stats-output {
	margin-top: 0;
}

.loading-message,
.message {
	padding: 12px 18px; /* Slightly more padding */
	border-radius: 8px; /* Match card radius */
	margin-top: 15px; /* More spacing */
	font-size: 0.95rem;
	border: 1px solid rgba(255, 255, 255, 0.25);
	background: rgba(255, 255, 255, 0.12); /* Slightly increased opacity */
	backdrop-filter: blur(5px);
	-webkit-backdrop-filter: blur(5px);
	color: #f0f0f0; /* Brighter default text */
}

.message.error {
	/* border-left: 3px solid rgba(255, 107, 107, 0.5); */
	color: #ffdddd; /* Slightly reddish text for errors */
}

/* Style for StatsTable component titles */
#stats-output h2 {
	font-size: 1.3em; /* Slightly larger */
	color: #fff;
	text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

#stats-output p {
	color: #eee; /* Lighter text for 'No data' */
	padding: 15px;
	background: rgba(255, 255, 255, 0.1); /* Keep 'no data' slightly less opaque */
	border-radius: 8px;
	text-align: center;
	border: 1px solid rgba(255, 255, 255, 0.2);
}

#stats-output table {
	box-shadow: none; /* Remove internal shadow, rely on card */
	border-radius: 8px; /* Match card */
	border: none; /* Remove internal border */
	border-collapse: separate; /* Needed for border-radius on cells */
	border-spacing: 0;
	background: rgba(0, 0, 0, 0.55); /* Slightly darker table background for contrast */
}

#stats-output th,
#stats-output td {
	border: none; /* Remove internal borders */
	border-bottom: 1px solid rgba(255, 255, 255, 0.15); /* Slightly stronger lines */
	padding: 10px 12px;
	color: #fff; /* White text in table */
	background: transparent; /* Ensure cells are transparent */
}

#stats-output td:first-child,
#stats-output th:first-child {
	border-left: none;
}
#stats-output td:last-child,
#stats-output th:last-child {
	border-right: none;
}
#stats-output tr:last-child td {
	border-bottom: none; /* No border on last row */
}

#stats-output th {
	font-weight: bold;
	color: #fff;
	position: sticky;
	top: 0;
	backdrop-filter: blur(5px); /* Blur for sticky header */
	-webkit-backdrop-filter: blur(5px);
}

/* Alternating row colors - adjust opacity */
#stats-output tbody tr:nth-child(even) {
	background-color: rgba(255, 255, 255, 0.04); /* Slightly more visible */
}
#stats-output tbody tr:hover {
	background-color: rgba(255, 255, 255, 0.1); /* Slightly more visible hover */
}

/* Override winrate/max highlights for glass - Restore Colors */
#stats-output .winrate-high {
	/* Semi-transparent green */
	background-color: rgba(46, 213, 115, 0.2) !important;
}
#stats-output .winrate-low {
	/* Semi-transparent red */
	background-color: rgba(255, 107, 107, 0.2) !important;
}
#stats-output .winrate-even {
	/* Semi-transparent orange */
	background-color: rgba(254, 202, 87, 0.2) !important;
}
#stats-output .column-max {
	/* Semi-transparent blue for max */
	background-color: rgba(72, 219, 251, 0.5) !important;
	font-weight: bold; /* Keep bold for max */
	color: #fff !important; /* Ensure text stays white */
}

/* Hover states for highlighted rows - Darken the specific color */
#stats-output tr.winrate-high:hover {
	background-color: rgba(46, 213, 115, 0.3) !important;
}
#stats-output tr.winrate-low:hover {
	background-color: rgba(255, 107, 107, 0.3) !important;
}
#stats-output tr.winrate-even:hover {
	background-color: rgba(254, 202, 87, 0.3) !important;
}
#stats-output tr:hover .column-max {
	background-color: rgba(72, 219, 251, 0.35) !important;
}
</style>
