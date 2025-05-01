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
export type Side = "A" | "B";
export type Winner = Side | "DRAW";
export type Match = {
	winner: Side;
	A: Team;
	B: Team;
};
