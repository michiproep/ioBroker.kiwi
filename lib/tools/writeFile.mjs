import { z } from "zod";
const DESC = `Writes content to a file in the ioBroker file system for the current adapter namespace.\nCreates the file if it does not exist, or overwrites it if it does.`;

export const writeFile = {
	name: "writeFile",
	desc: DESC,
	params: {
		path: z.string().describe("The path to the file to write, relative to the adapter namespace."),
		content: z.string().describe("The content to write to the file."),
	},
	call: (API) => async (args) => {
		const ret = await API.writeFile(args);
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
