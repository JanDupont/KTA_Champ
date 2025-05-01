<!-- filepath: c:\Users\Jandu\Documents\git_repos\KTA_Champ\frontend\src\components\StatsTable.vue -->
<template>
	<div v-if="data && data.length > 0">
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
				<tr v-for="(row, rowIndex) in data" :key="rowIndex">
					<td
						v-for="header in tableHeaders"
						:key="`${rowIndex}-${header}`"
						:class="getCellClass(row[header])"
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

interface TableRow {
	[key: string]: string | number | null | undefined;
}

const props = defineProps<{
	title: string;
	data: TableRow[] | null | undefined;
	columns?: string[]; // Optional: Specify column order and inclusion
}>();

const tableId = computed(() => props.title.toLowerCase().replace(/\s+/g, "-") + "-table");

const tableHeaders = computed(() => {
	if (props.columns) {
		return props.columns;
	}
	if (props.data && props.data.length > 0) {
		return Object.keys(props.data[0]);
	}
	return [];
});

const isNumericOrPercent = (value: any): boolean => {
	return typeof value === "number" || (typeof value === "string" && value.includes("%"));
};

const getHeaderClass = (header: string): string => {
	// Attempt to guess alignment based on first data row if available
	if (props.data && props.data.length > 0 && isNumericOrPercent(props.data[0][header])) {
		return "center";
	}
	return "left";
};

const getCellClass = (value: any): string => {
	return isNumericOrPercent(value) ? "center" : "left";
};

const formatCell = (value: any): string => {
	return value !== null && value !== undefined ? String(value) : "-";
};
</script>

<style scoped>
/* Add the CSS from the previous public/style.css here or import a global CSS file */
table {
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 20px;
	font-size: 0.9em;
	background-color: #fff;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

th,
td {
	border: 1px solid #ddd;
	padding: 8px;
	text-align: left;
}

th {
	background-color: #e9e9e9;
	font-weight: bold;
}

tbody tr:nth-child(even) {
	background-color: #f9f9f9;
}

.center {
	text-align: center;
}

.left {
	text-align: left;
}

h2 {
	margin-top: 2rem;
	margin-bottom: 0.5rem;
	color: #333;
}

p {
	color: #666;
}
</style>
