import { z } from "zod";
const DESC = `This tool enables Retrieval-Augmented Generation (RAG) by performing a semantic search for ioBroker state objects within a vector database.
Provide a natural language query (text parameter) to find state objects whose common.custom["mcp-server.0"].description is semantically similar to your query.
Results are returned as a list of objects ordered by semantic distance (most similar first). Each result contains:
- id: the state's unique ID (used in ioBroker)
- object: the full state object
You can control the maximum number of results returned using the 'limit' parameter.
it is a multilingual embedding model, so you can search in any language, but the results are best in english or german.
the filter parameter allows you to narrow down the search results with MongoDB queries style syntax.
filters are aplied after the limit is applied. so use larger limits when using filters to ensure you get enough data points.
**WITHOUT API KEY (full-text mode)**: if kiwi has no AI API key configured, this tool uses a full-text search instead of embeddings.
It then matches words of at least 3 characters (also as part of longer words, e.g. "lampe" finds "Wohnzimmerlampe") in the description, name and id of the state,
in the language the descriptions are written in, without understanding synonyms or other languages. Search with several short keywords and synonyms
in one query (e.g. "licht lampe leuchte wohnzimmer") instead of a sentence. "distance" is then the bm25 rank: lower (more negative) is better.
If you get no results, try other keywords or use mingoSearch.
**IMPORTANT**: this tool only searches States (type: "state") in the ioBroker database, not other object types like devices, channels, scripts, etc. toto search for other types of objects, use the mingoSearch tool instead.

example filters:
- { "object.common.name": { "$regex": ".*temperature.*", "$options": "i" } }
- { "distance": { "$lt": 0.3 } }
- { "object.common.role":{ "$regex": ".*switch.*", "$options": "i" } , "currentValue.val": { "$eq": true } }

`;
export const search = {
	name: "searchIobrokerStates",
	desc: DESC,
	params: {
		text: z
			.string()
			.describe(
				"natural language query to match against the names, descriptions, roles, rooms, functions, and other meta information of state objects.",
			),
		filter: z
			.record(z.string(), z.any())
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
