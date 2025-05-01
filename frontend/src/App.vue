<!-- filepath: c:\Users\Jandu\Documents\git_repos\KTA_Champ\frontend\src\App.vue -->
<template>
	<div id="app-container">
		<h1>KTA Championship Stats</h1>

		<div class="controls">
			<label for="tournament-select">Select Tournament:</label>
			<select
				id="tournament-select"
				v-model="selectedTournament"
				@change="loadTournamentStats"
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
		</div>

		<div id="stats-output">
			<div v-if="loadingStats" class="loading-message">Loading stats for {{ selectedTournament }}...</div>
			<div v-else-if="error" class="error-message">Error loading stats: {{ error }}</div>
			<div v-else-if="selectedTournament && statsData">
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
				<!-- Add more StatsTable components for other data if needed -->
			</div>
			<div v-else>
				<p>Select a tournament to view stats.</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import axios from "axios";
import StatsTable from "./components/StatsTable.vue";

// Define the structure of the stats data received from the API
interface StatsData {
	sideWinrate: any[]; // Replace 'any' with specific types if known
	globalClasses: any[];
	pickBanOrder: any[];
	// Add other stats properties here
}

const tournaments = ref<string[]>([]);
const selectedTournament = ref<string>("");
const statsData = ref<StatsData | null>(null);
const loadingTournaments = ref<boolean>(true);
const loadingStats = ref<boolean>(false);
const error = ref<string | null>(null);

// Define API base URL - adjust if your backend runs elsewhere
const API_BASE_URL = "http://localhost:3001/api"; // Make sure this matches your server port

const fetchTournaments = async () => {
	loadingTournaments.value = true;
	error.value = null;
	try {
		const response = await axios.get<string[]>(`${API_BASE_URL}/tournaments`);
		tournaments.value = response.data;
	} catch (err: any) {
		console.error("Error fetching tournaments:", err);
		error.value = "Failed to load tournament list. Is the backend server running?";
		tournaments.value = []; // Clear tournaments on error
	} finally {
		loadingTournaments.value = false;
	}
};

const loadTournamentStats = async () => {
	if (!selectedTournament.value) {
		statsData.value = null;
		error.value = null;
		return;
	}

	loadingStats.value = true;
	error.value = null;
	statsData.value = null; // Clear previous stats

	try {
		const response = await axios.get<StatsData>(`${API_BASE_URL}/tournaments/${selectedTournament.value}/stats`);
		statsData.value = response.data;
	} catch (err: any) {
		console.error(`Error fetching stats for ${selectedTournament.value}:`, err);
		error.value = `Failed to load stats for ${selectedTournament.value}. ${
			err.response?.data?.error || err.message
		}`;
	} finally {
		loadingStats.value = false;
	}
};

onMounted(() => {
	fetchTournaments();
});
</script>

<style>
/* Global styles - you can move these to a separate CSS file like main.css */
body {
	font-family: sans-serif;
	margin: 0;
	background-color: #f4f4f4;
	color: #333;
}

#app-container {
	max-width: 1200px;
	margin: 20px auto;
	padding: 20px;
	background-color: #fff;
	border-radius: 8px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

h1 {
	color: #333;
	text-align: center;
	margin-bottom: 1.5rem;
}

.controls {
	margin-bottom: 20px;
	padding: 15px;
	background-color: #eee;
	border-radius: 5px;
}

label {
	margin-right: 10px;
	font-weight: bold;
}

select {
	padding: 8px 12px;
	min-width: 250px;
	border: 1px solid #ccc;
	border-radius: 4px;
}

#stats-output {
	margin-top: 20px;
}

.loading-message,
.error-message {
	padding: 15px;
	border-radius: 5px;
	margin-top: 15px;
}

.loading-message {
	background-color: #e0e0e0;
	color: #555;
}

.error-message {
	background-color: #f8d7da;
	color: #721c24;
	border: 1px solid #f5c6cb;
}

/* Add other styles as needed */
</style>
