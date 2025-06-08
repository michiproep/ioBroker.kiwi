import { z } from "zod";
const DESC = `the getStatesWithValues tool retrieves all states values in the ioBroker system that match a specific instance pattern 
    for example zigbee.0.847127fffe7307b1.* gets all states of this device.
    or zigbee.*.group* gets all groups of all zigbee instances.
    or zigbee.*.brightness gets all brightness states of all zigbee instances.
    The pattern can have a wildcard character ("*") anywhere but at the start of the pattern.
`;
export const getStatesWithValues = {
	name: "getStatesWithValues",
	desc: DESC,
	params: {
		instancePattern: z
			.string()
			.describe(
				"The pattern to match the instance name. Default is '*' which matches all instances. the pattern can have a wildcard charcter ('*') anywhere but at the start of the pattern",
			),
	},
	call: (API) => async (args) => {
		const ret = await API.getStatesWithValues(args);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(ret),
				},
			],
		};
	},
};
