import { z } from "zod";
const DESC = `The describe tool sets a description for an object in the ioBroker system, primarily to enable semantic search. When you use this tool on a state, it will automatically set both common.custom["mcp-server.0"].description and common.custom["mcp-server.0"].enabled to true. Only states with both fields set will be indexed and thus searchable. Describing devices, channels, or folders can serve as a template for their states, but only states with this explicit description and enabled flag are included in the semantic search index.`;
export const describe = {
	name: "describe",
	desc: DESC,
	params: {
		id: z.string().describe("the id of the object to describe. This can be a device, channel, state or folder id."),
		desc: z
			.string()
			.describe(
				"the description to set for the object. This will be stored in the common.desc field of the object. this field is part of the search tool",
			),
	},
	call: (API) => async (args) => {
		const ret = await API.describe(args);
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
