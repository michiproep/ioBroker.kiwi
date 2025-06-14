import { z } from "zod";
const DESC = `Creates a new directory in the ioBroker file system for the current adapter namespace.\nIf the directory already exists, nothing happens.`;

export const mkdir = {
	name: "mkdir",
	desc: DESC,
	params: {
		path: z.string().describe("The path to the directory to create, relative to the adapter namespace."),
	},
	call: (API) => async (args) => {
		const ret = await API.mkdir(args);
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
