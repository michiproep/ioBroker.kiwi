import { z } from "zod";
const DESC = `the setState tool allows you to set the value of a state in the ioBroker system.
    You can specify the state by its ID, which is usually in the format {instance}.{adapter}.{state} (e.g., "hue.0.brightness").
    The value can be any valid JavaScript value, such as a string, number, boolean, or object.
    
    IMPORTANT: there are two destinct scenarios in iobroker when you set a state:
    1. From the poit of view of the user, you set the state and expect the real physical device behind that state to change its real state, for this case you use ack=false (default).
    2. Fromm the point of view of the device, you set the state to reflect change in your own internal state. for this case you use ack=true.
    usually when you have cas 1, the device will change it internal state and answer with case 2
    `;
export const setState = {
	name: "setState",
	desc: DESC,
	params: {
		id: z
			.string()
			.describe(
				"The ID of the state to get. This is usually in the format {instance}.{adapter}.{state} (e.g., 'hue.0.brightness').",
			),
		value: z
			.any()
			.describe(
				"The value to set for the state. This can be any valid JavaScript value, such as a string, number, boolean, or object.",
			),
		ack: z.boolean().optional().default(false).describe("If true, the state will be acknowledged. "),
	},
	call: (API) => async (args) => {
		const ret = await API.setState(args);
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
