import { z } from "zod";
const DESC = `Checks if a file exists in the ioBroker file system for the current adapter namespace.\nReturns true if the file exists, false otherwise.`;

export const fileExists = {
	name: "fileExists",
	desc: DESC,
	params: {
		path: z.string().describe("The path to the file to check, relative to the adapter namespace."),
	},
	call: (API) => async (args) => {
		const ret = await API.fileExists(args);
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
