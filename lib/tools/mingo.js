import { z } from "zod";
const DESC = `with this tool you can search the complete ioBroker object database. you can search for type= "object" type="folder" type="channel" type="state" type="script" type="enum" type="device" etc.
this tool is mainly used for maintainace and administration of the ioBroker system, to find state-objects that are not in the semantic search index yet. or find scripts and edit scripts etc.
the sytax is similar to MongoDB's Mingo query language, so you can use operators like $eq, $gt, $lt, $in, etc.
Example queries:
- { "type": "state", "common.name": { "$regex": ".*temperature.*", "$options": "i" } }
- { "type": "device", "common.custom.mcp-server.0.description": { "$regex": ".*light.*", "$options": "i" } }
- { "type": "script", "common.name": { "$regex": ".*scene.*", "$options": "i" } }
- { "type": "object", "common.custom.mcp-server"::{"$exists": true } }

    `;
export const mingoSearch = {
	name: "mingoSearch",
	desc: DESC,
	params: {
		query: z
			.record(z.any())
			.describe(
				'the query to search for objects in the ioBroker database. The syntax is similar to MongoDB\'s Mingo query language, so you can use operators like $eq, $gt, $lt, $in, etc. Example queries: { "type": "state", "common.name": { "$regex": ".*temperature.*", "$options": "i" } }',
			),
		limit: z
			.number()
			.optional()
			.default(100)
			.describe(
				"limits the number of objects returned. defaults to 100, set to higher if you want to get more objects.",
			),
		skip: z
			.number()
			.optional()
			.default(0)
			.describe("skips the first n objects in the result set. useful for pagination."),
	},
	call: (API) => async (args) => {
		const objects = await API.mingoSearch(args.query, args.limit, args.skip);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(objects),
				},
			],
		};
	},
};
