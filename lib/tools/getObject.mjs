import { z } from "zod";
const DESC = `gets an ioBroker object. can by any type of object like device, channel, state or folder.
    You can specify the object by its ID, which is usually in the format {instance}.{adapter}.{object} (e.g., "hue.0.brightness"). 
    If you want to get the value of a state, you can use the getState tool.
    If you want to set the value of a state, you can use the setState tool.
    `;
export const getObject = {
	name: "getObject",
	desc: DESC,
	params: {
		id: z
			.string()
			.describe(
				"The ID of the object to get. This is usually in the format {instance}.{adapter}.{state} (e.g., 'hue.0.brightness').",
			),
	},
	call: (API) => async (args) => {
		const ret = await API.getObject(args);
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
