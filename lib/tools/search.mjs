import { z } from "zod";
const DESC = `This tool enables Retrieval-Augmented Generation (RAG) by performing a semantic search for ioBroker state objects within a vector database.
Provide a natural language query (text parameter) to find state objects whose common.custom["mcp-server.0"].description is semantically similar to your query.
Results are returned as a list of objects ordered by semantic distance (most similar first). Each result contains:
- id: the state's unique ID (used in ioBroker)
- object: the full state object
You can control the maximum number of results returned using the 'limit' parameter.
it is a multilingual embedding model, so you can search in any language, but the results are best in english or german.

Example queries:

`;
export const search = {
	name: "search",
	desc: DESC,
	params: {
		text: z
			.string()
			.describe(
				"natural language query to match against the names, descriptions, roles, rooms, functions, and other meta information of state objects.",
			),
		filter: z
			.record(z.any())
			.optional()
			.default({})
			.describe("An optional filter object to narrow down the search results."),
		limit: z
			.number()
			.optional()
			.default(10)
			.describe(
				"The maximum number of results to return. it has meaningful defaults of 10. ommit or set higher if you don't find what you are looking for",
			),
	},
	call: (API) => async (args) => {
		const data = await API.search(args.text, args.filter || {}, args.limit || 10);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(data),
				},
			],
		};
	},
};
