<template>
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

const tableHeaders = computed(() => {
	if (props.columns && props.columns.length > 0) {
		return props.columns;
	}
	if (props.data && props.data.length > 0) {
		return Object.keys(props.data[0]);
	}
	return [];
});

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

const banColumns = ["ABan1", "ABan2", "ABan3", "ABan4", "ABan5", "BBan1", "BBan2", "BBan3", "BBan4", "BBan5"];

const sortedData = computed(() => {
	if (props.title !== "Pick/Ban Order (%)" || !props.data || props.data.length === 0) {
		return props.data;
	}

	// Create a shallow copy to sort without mutating the prop
	const dataToSort = [...props.data];

	dataToSort.sort((a, b) => {
		let sumA = 0;
		let sumB = 0;

		banColumns.forEach((col) => {
			const valA = parseWinrate(a[col]);
			if (valA !== null) {
				sumA += valA;
			}
		});
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
		if (max >= 0) {
			maxValues[header] = max;
		}
	});
	return maxValues;
});

const getRowClass = (row: any): string => {
	let winrate: number | null = null;

	if (props.title === "Side Winrate" || props.title === "Global Class Stats") {
		winrate = parseWinrate(row["Winrate"]);
	}

	if (winrate !== null) {
		if (winrate > 53) return "winrate-high";
		if (winrate < 50) return "winrate-low";
		return "winrate-even";
	}

	return "";
};

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

	return classes.join(" ");
};

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
		return value.toString();
	}
	if (value === null || value === undefined) {
		return "-";
	}
	return String(value);
};
</script>

<style scoped>
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

.text-right {
	text-align: right;
}

.bold {
	font-weight: bold;
}

/* Winrate Row Highlighting */
.winrate-high {
	background-color: #e6ffed !important; /* Light green, !important overrides nth-child */
}
.winrate-low {
	background-color: #ffe6e6 !important; /* Light red */
}
.winrate-even {
	background-color: #fff3e0 !important; /* Light orange */
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
</style>
