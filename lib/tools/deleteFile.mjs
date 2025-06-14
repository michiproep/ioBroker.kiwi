import { z } from "zod";
const DESC = `Deletes a file in the ioBroker file system for the current adapter namespace.`;

export const deleteFile = {
	name: "deleteFile",
	desc: DESC,
	params: {
		path: z.string().describe("The path to the file to delete, relative to the adapter namespace."),
	},
	call: (API) => async (args) => {
		const ret = await API.deleteFile(args);
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
