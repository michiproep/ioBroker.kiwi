import {z} from "zod";
const DESC = `The describeBulk tool sets descriptions for multiple objects in the ioBroker system at once, primarily to enable semantic search. When you use this tool on states, it will automatically set both common.custom["mcp-server.0"].description and common.custom["mcp-server.0"].enabled to true for each state. Only states with both fields set will be indexed and thus searchable. Describing devices, channels, or folders can serve as a template for their states, but only states with this explicit description and enabled flag are included in the semantic search index. Use this tool to efficiently set descriptions for many states in one go.`;
export const describeBulk = {
    name: "describeBulk",
    desc: DESC,
    params: {
        items: z.array(z.object({
            id: z.string().describe("The id of the object to describe. This can be a device, channel, state or folder id."),
            desc: z.string().describe("The description to set for the object. This will be stored in the common.desc field of the object.")
        })).describe("Array of objects to describe, each with an id and a description."),
    },
    call: API => async (args) => {
        let ret = await API.describeBulk(args.items)
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(ret),
                },
            ],
        };
    },
}