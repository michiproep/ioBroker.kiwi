import { z } from "zod";
const DESC = `Reads the contents of a directory in the ioBroker file system for the current adapter namespace.\nReturns a list of files and folders in the specified path.`;

export const readDir = {
	name: "readDir",
	desc: DESC,
	params: {
		path: z.string().describe("The path to the directory to read, relative to the adapter namespace."),
	},
	call: (API) => async (args) => {
		const ret = await API.readDir(args);
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
