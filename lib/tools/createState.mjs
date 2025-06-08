import { z } from "zod";
const DESC = `Create a new ioBroker state object. Specify id, name, type (default: string), role (default: state), read/write (default: true), and an optional description.

Common valid ioBroker roles for states include (for full list see: https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/objectroles.md):
- state
- value
- value.temperature
- value.humidity
- value.battery
- value.lux
- value.co2
- value.pressure
- value.voltage
- value.current
- value.power
- value.energy
- value.window
- value.door
- value.motion
- value.smoke
- value.gas
- value.alarm
- value.brightness
- value.color
- value.color.temperature
- value.dimmer
- value.switch
- value.button
- value.contact
- value.presence
- value.scene 
- switch.light
- level.dimmer
- level.color.temperature
- level.color.rgb

For lights, the most relevant are:
- switch.light
- level.dimmer
- level.color.temperature
- level.color.rgb
- value.brightness
- value.color
- value.color.temperature
- value.switch
- value.scene

Valid types for ioBroker states include:
- string
- number
- boolean
- array
- object
- mixed
- file
- json
- html
- xml
- icon
- image

This description is intended for AI agents to ensure only valid roles and types are used. Always prefer standard roles and types for compatibility.
`;

export const createState = {
	name: "createState",
	desc: DESC,
	params: {
		id: z
			.string()
			.optional()
			.describe("The ID of the object to create. This can be a device, channel, state or folder id."),
		name: z.string().describe("The display name of the state."),
		type: z
			.string()
			.optional()
			.default("string")
			.describe("The type of the state (e.g., string, number, boolean). Default: string."),
		role: z.string().optional().default("state").describe("The ioBroker role for the state. Default: state."),
		read: z.boolean().optional().default(true).describe("Whether the state is readable. Default: true."),
		write: z.boolean().optional().default(true).describe("Whether the state is writable. Default: true."),
		desc: z.string().optional().describe("Optional description for the state."),
	},
	call: (API) => async (args) => {
		const ret = await API.createState(args);
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
