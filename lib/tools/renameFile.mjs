import { z } from "zod";
const DESC = `Renames a file or directory in the ioBroker file system for the current adapter namespace.`;

export const renameFile = {
	name: "renameFile",
	desc: DESC,
	params: {
		oldPath: z.string().describe("The current path of the file or directory, relative to the adapter namespace."),
		newPath: z.string().describe("The new path for the file or directory, relative to the adapter namespace."),
	},
	call: (API) => async (args) => {
		const ret = await API.renameFile(args);
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
