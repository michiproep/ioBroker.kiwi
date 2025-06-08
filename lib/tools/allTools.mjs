import { getAdapters } from "./getAdapters.mjs";
import { getRunningInstances } from "./getInstances.mjs";
import { search } from "./search.mjs";
import { getState } from "./getState.mjs";
import { setState } from "./setState.mjs";
import { getStatesWithValues } from "./getStatesWithValues.mjs";
import { describe } from "./describe.mjs";
import { anotate } from "./anotate.mjs";
import { setStateBulk } from "./setStateBulk.mjs";
import { createState } from "./createState.mjs";
import { createScene } from "./createScene.mjs";
import { setObject } from "./setObject.mjs";
import { getAllRooms } from "./getAllRooms.mjs";
import { getAllObjectsInRoom } from "./getAllObjectsInRoom.mjs";
import { getHistory } from "./getHistory.mjs";
import { describeBulk } from "./describeBulk.mjs";
import { deleteItemFromIndex } from "./deleteItemFromIndex.mjs";
import { getObject } from "./getObject.mjs";
import { getStateBulk } from "./getStateBulk.mjs";

export const Tools = {
	getAdapters,
	getRunningInstances,
	getState,
	setState,
	getStateBulk,
	getStatesWithValues,
	describe,
	anotate,
	setStateBulk,
	createState,
	createScene,
	setObject,
	getObject,
	getAllRooms,
	getAllObjectsInRoom,
	getHistory,
	search,
	describeBulk,
	deleteItemFromIndex,
	// Add other tools here as needed
};
