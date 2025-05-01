export type Classes =
	| "cra"
	| "ecaflip"
	| "eliotrope"
	| "eniripsa"
	| "enutrof"
	| "feca"
	| "huppermage"
	| "iop"
	| "osamodas"
	| "pandawa"
	| "roublard"
	| "sacrieur"
	| "sadida"
	| "sram"
	| "steamer"
	| "xelor"
	| "zobal"
	| "ouginak"
	| "forgelance";
export type Team = {
	teamName: string;
	bans: Classes[];
	picks: Classes[];
};
export type Match = {
	winner: string; // "A" or "B"
	A: Team;
	B: Team;
};
