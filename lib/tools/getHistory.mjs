import { z } from "zod";
const DESC = `The getHistory tool retrieves historical state data for a specific ioBroker state (e.g., sensor readings, switch states, etc.).

Use this tool when you need time series data, trends, or past values for any state in the ioBroker system. Provide the state ID (e.g., "hue.0.brightness") and optionally specify query options such as time range, aggregation, or result formatting. This tool is ideal for analyzing device usage, generating reports, or answering questions about how a value changed over time.

Example call:
getHistory({
  id: "hue.0.brightness",
  options: {
    start: 1717000000000,
    end: 1717090000000,
    count: 10,
    aggregate: "average"
  }
})

you can find out which states have history by searching the database for like this 'select * from objects where raw like "%sql.0%' it has history values whe the common.custom["sql.0"] field is enabled 
`;
export const getHistory = {
	name: "getHistory",
	desc: DESC,
	params: {
		id: z
			.string()
			.describe(
				"The ID of the state to get history data for. This is usually in the format {instance}.{adapter}.{state} (e.g., 'hue.0.brightness').",
			),
		options: z
			.object({
				start: z.number().describe("Start timestamp (ms since epoch) for history query.").optional(),
				end: z.number().describe("End timestamp (ms since epoch) for history query.").optional(),
				count: z.number().describe("Number of entries to return.").optional(),
				from: z.boolean().describe("Include 'from' field in results.").optional(),
				ack: z.boolean().describe("Include 'ack' field in results.").optional(),
				q: z.boolean().describe("Include 'q' field in results.").optional(),
				addId: z.boolean().describe("Include 'id' field in results.").optional(),
				limit: z.number().describe("Limit number of results.").optional(),
				ignoreNull: z.boolean().describe("Ignore null values in results.").optional(),
				removeBorderValues: z.boolean().describe("Remove border values from results.").optional(),
				returnNewestEntries: z.boolean().describe("Return newest entries first.").optional(),
				aggregate: z
					.enum([
						"minmax",
						"none",
						"average",
						"total",
						"min",
						"max",
						"count",
						"percentile",
						"quantile",
						"integral",
					])
					.describe("Aggregation method.")
					.optional(),
				percentile: z.number().describe("Percentile value for aggregation.").optional(),
				quantile: z.number().describe("Quantile value for aggregation.").optional(),
				integralUnit: z.string().describe("Unit for integral aggregation.").optional(),
				integralInterpolation: z
					.enum(["linear", "step"])
					.describe("Interpolation method for integral aggregation.")
					.optional(),
			})
			.describe("Options for history query."),
	},
	call: (API) => async (args) => {
		const res = await API.getHistory(args);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(res),
				},
			],
		};
	},
};
