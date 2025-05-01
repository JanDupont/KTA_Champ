<!-- filepath: c:\Users\Jandu\Documents\git_repos\KTA_Champ\frontend\src\components\StatsTable.vue -->
<template>
	<!-- Use sortedData instead of data -->
	<div v-if="sortedData && sortedData.length > 0">
		<h2>{{ title }}</h2>
		<table :id="tableId">
			<thead>
				<tr>
					<th v-for="header in tableHeaders" :key="header" :class="getHeaderClass(header)">
						{{ header }}
					</th>
				</tr>
			</thead>
			<tbody>
				<!-- Apply row class based on title and winrate -->
				<!-- Iterate over sortedData -->
				<tr v-for="(row, rowIndex) in sortedData" :key="rowIndex" :class="getRowClass(row)">
					<td
						v-for="header in tableHeaders"
						:key="`${rowIndex}-${header}`"
						:class="getCellClass(row[header], header, row)"
					>
						{{ formatCell(row[header]) }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
	<div v-else>
		<h2>{{ title }}</h2>
		<p>No data available.</p>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
	title: string;
	data: any[];
	columns: string[];
}>();

const tableId = computed(() => props.title.toLowerCase().replace(/\s+/g, "-"));

// Use provided columns if available, otherwise derive from data
const tableHeaders = computed(() => {
	if (props.columns && props.columns.length > 0) {
		return props.columns;
	}
	if (props.data && props.data.length > 0) {
		return Object.keys(props.data[0]);
	}
	return [];
});

// --- Styling Logic ---

// Helper to safely parse winrate string like "55.5%" to a number 55.5
const parseWinrate = (winrateValue: any): number | null => {
	if (typeof winrateValue === "string" && winrateValue.endsWith("%")) {
		const num = parseFloat(winrateValue.replace("%", ""));
		return isNaN(num) ? null : num;
	}
	if (typeof winrateValue === "number") {
		return winrateValue;
	}
	return null;
};

// --- Sorting Logic ---

// Define the headers corresponding to ban percentages
const banColumns = ["ABan1", "ABan2", "ABan3", "ABan4", "ABan5", "BBan1", "BBan2", "BBan3", "BBan4", "BBan5"];

// Computed property to return sorted data for the Pick/Ban Order table
const sortedData = computed(() => {
	if (props.title !== "Pick/Ban Order (%)" || !props.data || props.data.length === 0) {
		return props.data; // Return original data if not the target table or no data
	}

	// Create a shallow copy to sort without mutating the prop
	const dataToSort = [...props.data];

	// Sort the data
	dataToSort.sort((a, b) => {
		let sumA = 0;
		let sumB = 0;

		// Sum ban percentages for row A
		banColumns.forEach((col) => {
			const valA = parseWinrate(a[col]);
			if (valA !== null) {
				sumA += valA;
			}
		});

		// Sum ban percentages for row B
		banColumns.forEach((col) => {
			const valB = parseWinrate(b[col]);
			if (valB !== null) {
				sumB += valB;
			}
		});

		// Sort descending (higher total ban percentage first)
		return sumB - sumA;
	});

	return dataToSort;
});

// Calculate max values for each column in the Pick/Ban Order table
const maxValuesPerColumn = computed(() => {
	if (props.title !== "Pick/Ban Order (%)" || !props.data || props.data.length === 0) {
		return {};
	}

	const maxValues: Record<string, number> = {};
	const headers = tableHeaders.value.slice(1); // Exclude 'Class' column

	headers.forEach((header) => {
		let max = -Infinity;
		props.data.forEach((row) => {
			const value = parseWinrate(row[header]); // Use parseWinrate
			if (value !== null && value > max) {
				max = value;
			}
		});
		// Store max value only if it's non-negative (percentages shouldn't be negative)
		if (max >= 0) {
			maxValues[header] = max;
		}
	});
	return maxValues;
});

// Get class for the entire table row (<tr>)
const getRowClass = (row: any): string => {
	let winrate: number | null = null;

	if (props.title === "Side Winrate" || props.title === "Global Class Stats") {
		winrate = parseWinrate(row["Winrate"]); // Use the helper
	}

	if (winrate !== null) {
		if (winrate > 53) return "winrate-high";
		if (winrate < 50) return "winrate-low";
		return "winrate-even"; // Exactly 50%
	}

	return ""; // Default no row class
};

// Get class for individual table cells (<td>)
const getCellClass = (value: any, header: string, row: any): string => {
	let classes: string[] = [];

	// General numeric alignment
	if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?%?$/.test(value))) {
		classes.push("text-right");
	}

	// Pick/Ban Order specific highlighting
	if (props.title === "Pick/Ban Order (%)" && header !== "Class") {
		const numericValue = parseWinrate(value);
		const maxValue = maxValuesPerColumn.value[header];
		// Check if numericValue is not null, maxValue exists, and they are equal
		if (numericValue !== null && maxValue !== undefined && numericValue === maxValue && numericValue > 0) {
			classes.push("column-max");
		}
	}

	// Global Class Stats Winrate column bold
	if (props.title === "Global Class Stats" && header === "Winrate") {
		classes.push("bold");
	}

	// Add other potential cell-specific classes here if needed

	return classes.join(" ");
};

// Get class for table headers (<th>) - Example: right-align numeric columns
const getHeaderClass = (header: string): string => {
	let classes: string[] = [];
	// Simple check if header implies numeric data (could be more sophisticated)
	if (header !== "Class" && header !== "Side" && header !== "Team") {
		classes.push("text-right");
	}

	// Global Class Stats Winrate header bold
	if (props.title === "Global Class Stats" && header === "Winrate") {
		classes.push("bold");
	}

	return classes.join(" ");
};

// Format cell content (e.g., add % sign, round numbers)
const formatCell = (value: any): string => {
	if (typeof value === "number") {
		// Example: Round floating point numbers, but maybe not for IDs etc.
		// This needs refinement based on column context if necessary.
		// if (!Number.isInteger(value)) {
		//     return value.toFixed(1); // Example: 1 decimal place
		// }
		return value.toString();
	}
	// Handle null or undefined gracefully
	if (value === null || value === undefined) {
		return "-"; // Or empty string ''
	}
	return String(value); // Ensure it's a string
};
</script>

<style scoped>
/* ... existing styles ... */

table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 1.5rem;
	font-size: 0.9em; /* Slightly smaller font for tables */
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	border-radius: 4px; /* Optional: round corners */
	overflow: hidden; /* Needed for border-radius on table */
}

th,
td {
	border: 1px solid #ddd;
	padding: 8px 10px; /* Adjust padding */
	text-align: left;
	vertical-align: middle; /* Align text vertically */
}

th {
	background-color: #f2f2f2;
	font-weight: bold;
	position: sticky; /* Make headers sticky */
	top: 0; /* Stick to the top */
	z-index: 1; /* Ensure header is above scrolling content */
}

/* Alternating row colors for readability */
tbody tr:nth-child(even) {
	background-color: #f9f9f9;
}
tbody tr:hover {
	background-color: #f1f1f1; /* Highlight row on hover */
}

/* Text alignment classes */
.text-right {
	text-align: right;
}

/* Bold class */
.bold {
	font-weight: bold;
}

/* Winrate Row Highlighting */
.winrate-high {
	background-color: #e6ffed !important; /* Light green, !important overrides nth-child */
	/* color: #1f7a1f; */ /* Optional: darker green text */
}
.winrate-low {
	background-color: #ffe6e6 !important; /* Light red */
	/* color: #a61c1c; */ /* Optional: darker red text */
}
.winrate-even {
	background-color: #fff3e0 !important; /* Light orange */
	/* color: #b36d00; */ /* Optional: darker orange text */
}

/* Pick/Ban Order Column Max Highlighting */
.column-max {
	background-color: #e0f2ff !important; /* Light blue */
	font-weight: bold;
	color: #0056b3;
}

/* Ensure hover doesn't override max highlight too much */
tr:hover .column-max {
	background-color: #cce9ff !important; /* Slightly darker blue on hover */
}

/* Ensure hover works well with winrate highlights */
tr.winrate-high:hover {
	background-color: #d6f5e0 !important;
}
tr.winrate-low:hover {
	background-color: #fcdbdb !important;
}
tr.winrate-even:hover {
	background-color: #ffeacc !important;
}

/* Add specific styles for certain columns if needed */
/* Example: Make class names bold */
/*
td:first-child, th:first-child {
    font-weight: bold;
}
*/
</style>
