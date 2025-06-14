import { z } from "zod";
const DESC = `Reads the contents of a file in the ioBroker file system for the current adapter namespace.\nReturns the file content as a string or buffer.`;

export const readFile = {
	name: "readFile",
	desc: DESC,
	params: {
		path: z.string().describe("The path to the file to read, relative to the adapter namespace."),
	},
	call: (API) => async (args) => {
		const ret = await API.readFile(args);
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
