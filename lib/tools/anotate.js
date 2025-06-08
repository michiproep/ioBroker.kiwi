import {z} from "zod";
const DESC = `
The anotate tool allows you to attach structured meta information to any ioBroker object (device, channel, or state). This meta information is not used for search, but is returned by the search function and can be used by agents or users to store helpful context, usage notes, quirks, or tips for future reference.

Typical use cases:
- Remembering which state to use for a specific function (e.g., 'use .ct for color temperature, not .colortemp')
- Storing troubleshooting tips or known quirks (e.g., 'sometimes needs to be toggled twice')
- Documenting usage examples, preferred settings, or integration notes
- Adding tags for logical grouping or categorization (not for search)

Example annotation:
{
  "usage": "Set color temperature with .ct, not .colortemp",
  "lastChecked": "2025-05-27",
  "notes": ["Device sometimes reports wrong state", "Works best with value 2000-6500"],
  "tags": ["color", "temperature", "hue"]
}

To use this tool, provide the id of the object and a structured annotation object. The annotation will be stored in the custom.mcp-server.0.meta field of the object and returned by the search tool for reference.
`;
export const anotate = {
    name:"anotate",
    desc: DESC,
    params: {
        id: z.string().describe("The id of the object to annotate (device, channel, or state)."),
        anotation: z.object({
            usage: z.string().optional().describe("How to use or control this device/state."),
            lastChecked: z.string().optional().describe("Date when this annotation was last updated (ISO format)."),
            notes: z.array(z.string()).optional().describe("Additional notes, quirks, or troubleshooting tips."),
            tags: z.array(z.string()).optional().describe("Tags for grouping or categorizing this object."),
        }).describe("Structured annotation meta information for the object."),
    },
    call: API => async (args) => {
        let ret = await API.anotate(args)
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