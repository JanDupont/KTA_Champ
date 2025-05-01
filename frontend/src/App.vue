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

// --- Types ---
interface StatsData {
	sideWinrate: any[];
	globalClasses: any[];
	pickBanOrder: any[];
}

type ActionType = "create" | "saveLinks" | "generateStats" | null;

// --- State ---
const tournaments = ref<string[]>([]);
const selectedTournament = ref<string>("");
const statsData = ref<StatsData | null>(null);
const loadingTournaments = ref<boolean>(true);
const loadingStats = ref<boolean>(false);
const loadingError = ref<string | null>(null); // Error for loading tournaments list
const statsError = ref<string | null>(null); // Specifically for stats loading error

// Management State
const newTournamentName = ref<string>("");
const linkPattern = ref<string>("https://ktarena.com/en/252-war-3/match/{id}/1"); // Default example
const startId = ref<number | null>(null);
const endId = ref<number | null>(null);
const linksToAdd = ref<string>("");
const currentLinks = ref<string[]>([]); // Links currently saved for the selected tournament
const loadingAction = ref<boolean>(false); // Loading state for create/save/generate actions
const actionMessage = ref<string | null>(null); // Feedback message for actions
const actionError = ref<boolean>(false); // Was the last action an error?
const currentAction = ref<ActionType>(null); // Track which action is running
const actionProgress = ref<string>(""); // Progress message for long actions

// --- API ---
const API_BASE_URL = "http://localhost:3001/api";

const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 600000, // Increase timeout for potentially long operations like generate-stats (10 minutes)
});

// --- Methods ---

const clearActionState = () => {
	actionMessage.value = null;
	actionError.value = false;
	currentAction.value = null;
	actionProgress.value = "";
};

// Fetch initial tournament list
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

// Load links for the selected tournament
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

// Load calculated stats for the selected tournament
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

// Load both links and stats
const loadTournamentData = async () => {
	clearActionState();
	linksToAdd.value = ""; // Clear link input area
	await Promise.all([loadTournamentLinks(), loadTournamentStats()]);
};

// Handle tournament selection change
const onTournamentSelect = () => {
	loadTournamentData();
};

// Create a new tournament
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

// Generate links based on pattern and range
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

// Save links (from textarea) to the backend
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

// Trigger backend stats generation process
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

// --- Lifecycle ---
onMounted(() => {
	fetchTournaments();
});
</script>
<style>
/* Global styles */
body {
	font-family: sans-serif;
	margin: 0;
	background-color: #f4f4f4;
	color: #333;
}

#app-container {
	max-width: 1200px;
	margin: 20px auto;
	padding: 0 20px; /* Remove vertical padding */
	background-color: transparent; /* Make container transparent */
	box-shadow: none; /* Remove container shadow */
}

h1 {
	color: #333;
	text-align: center;
	margin-bottom: 1.5rem;
}

h2 {
	margin-top: 0; /* Remove top margin for h2 inside cards */
	margin-bottom: 1rem;
	border-bottom: 1px solid #eee;
	padding-bottom: 0.5rem;
}

/* Card style for sections */
.card {
	background-color: #fff;
	border-radius: 8px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
	padding: 20px;
	margin-bottom: 1.5rem;
}

section {
	/* Remove direct styling from section, apply to .card */
	margin-bottom: 0; /* Reset margin */
	padding: 0; /* Reset padding */
	border-radius: 0;
	background-color: transparent;
	border: none;
}

.controls {
	/* Keep specific background if desired, or use card style */
	background-color: #e9f5ff; /* Light blue background for selection */
}

.management-section {
	/* Keep specific background if desired, or use card style */
	background-color: #f8f9fa; /* Lighter grey for management */
	/* border: 1px solid #dee2e6; */ /* Use shadow instead */
}

label {
	margin-right: 10px;
	font-weight: bold;
	display: inline-block;
	min-width: 120px; /* Align labels better */
	margin-bottom: 5px; /* Add space below label */
}

input[type="text"],
input[type="number"],
select,
textarea {
	padding: 8px 12px;
	border: 1px solid #ccc;
	border-radius: 4px;
	margin-right: 10px;
	margin-bottom: 10px; /* Spacing */
	font-size: 0.95rem; /* Slightly smaller font */
	box-sizing: border-box; /* Include padding and border in the element's total width and height */
}

input[type="text"] {
	flex-grow: 1; /* Allow text input to grow */
	min-width: 200px;
}
textarea {
	width: 100%; /* Make textarea take full width in its container */
	min-height: 80px;
	font-family: monospace;
	margin-top: 5px; /* Space above textarea */
}
input[type="number"] {
	width: 90px;
}

select {
	min-width: 250px;
	flex-grow: 1; /* Allow select to grow */
}

button {
	padding: 8px 15px;
	border: none;
	border-radius: 4px;
	background-color: #007bff;
	color: white;
	cursor: pointer;
	font-size: 0.95rem;
	transition: background-color 0.2s ease;
	margin-left: 5px;
	margin-bottom: 10px; /* Align with inputs */
}

button:hover {
	background-color: #0056b3;
}

button:disabled {
	background-color: #cccccc;
	cursor: not-allowed;
}

.form-group {
	margin-bottom: 15px;
	display: flex;
	align-items: center;
	flex-wrap: wrap; /* Allow wrapping on smaller screens */
}

.form-group label {
	flex-shrink: 0; /* Prevent label from shrinking */
}

.form-group.range-group label {
	min-width: auto; /* Don't force width for range labels */
	margin-left: 10px; /* Space before range labels */
}
.form-group.range-group label:first-of-type {
	margin-left: 0; /* No extra space for the first range label */
}

.form-group.action-buttons {
	justify-content: flex-start; /* Align buttons to the left */
	gap: 10px; /* Add space between buttons */
}
.form-group.action-buttons button {
	margin-left: 0; /* Remove default margin */
}

#stats-output {
	margin-top: 0; /* Remove top margin as it's now a card */
}

.loading-message,
.message {
	padding: 10px 15px;
	border-radius: 5px;
	margin-top: 10px;
	font-size: 0.95rem;
}

.loading-message {
	background-color: #e0e0e0;
	color: #555;
}

.message.info {
	background-color: #cfe2ff;
	color: #084298;
	border: 1px solid #b6d4fe;
}

.message.success {
	background-color: #d1e7dd;
	color: #0f5132;
	border: 1px solid #badbcc;
}

.message.error {
	background-color: #f8d7da;
	color: #842029;
	border: 1px solid #f5c2c7;
}

/* Style for StatsTable component titles */
#stats-output h2 {
	font-size: 1.2em;
	color: #333;
}

#stats-output p {
	/* Style for 'No data' messages */
	color: #666;
	padding: 15px;
	background-color: #f8f9fa;
	border-radius: 5px;
	text-align: center;
}
</style>
