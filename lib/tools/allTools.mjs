import { getAdapters } from "./getAdapters.mjs";
import { getRunningInstances } from "./getInstances.mjs";
import { search } from "./search.mjs";
import { getState } from "./getState.mjs";
import { setState } from "./setState.mjs";
import { describe } from "./describe.mjs";
import { setStateBulk } from "./setStateBulk.mjs";
import { createState } from "./createState.mjs";
import { createScene } from "./createScene.mjs";
import { setObject } from "./setObject.mjs";
import { getAllRooms } from "./getAllRooms.mjs";
import { getHistory } from "./getHistory.mjs";
import { describeBulk } from "./describeBulk.mjs";
import { deleteItemFromIndex } from "./deleteItemFromIndex.mjs";
import { getObject } from "./getObject.mjs";
import { getStateBulk } from "./getStateBulk.mjs";
import { mingoSearch } from "./mingo.js";
export const Tools = {
	getAdapters,
	getRunningInstances,
	getState,
	setState,
	getStateBulk,
	describe,
	setStateBulk,
	createState,
	createScene,
	setObject,
	getObject,
	getAllRooms,
	getHistory,
	search,
	describeBulk,
	deleteItemFromIndex,
	mingoSearch,
	// Add other tools here as needed
};
