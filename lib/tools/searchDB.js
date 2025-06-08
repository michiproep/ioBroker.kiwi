import {z} from "zod";
const DESC = `
Query the ioBroker objects database using SQL statements. This tool is designed for LLM agents to perform advanced, flexible searches over all ioBroker objects (devices, channels, states, folders, scripts, adapters, etc.).

There is a single table available: "objects" with the following columns:
- id: The object's unique ID
- type: The object's type (e.g., state, device, channel, folder, script, adapter)
- common_role: The role of the state (e.g., switch, value.temperature)
- common_name: The name of the object (string, or English fallback)
- common_desc: A description of the object (string, or English fallback)
- common_type: The data type of the state (when type is "state")
- rooms: Comma-separated list of rooms associated with the object (if available)
- functions: Purpose or functions of the object (if available)
- raw: Fulltext search field (contains all raw object data as a string)

This database is read-only and does not contain live state values.

Example queries:
- SELECT * FROM objects WHERE type = 'state' AND common_role LIKE 'switch%' LIMIT 10
- SELECT * FROM objects WHERE type = 'device' AND rooms LIKE '%kitchen%' LIMIT 20
- SELECT id, common_name, common_desc FROM objects WHERE type = 'state' AND common_role LIKE '%temperature%' LIMIT 5
- SELECT * FROM objects WHERE raw LIKE '%hue%' AND type = 'state' LIMIT 10
- SELECT * FROM objects WHERE type = 'script' LIMIT 10
- SELECT * FROM objects WHERE common_desc LIKE '%outdoor%' LIMIT 10

Always use LIMIT in your queries to avoid excessive data.
the default language in ioBroker is english, so espeacially for rooms and function look for englsish names first. 
IMPORTANT! **before you even search in a room call getAllRooms() to get an overview of the rooms in the system.**
`;
export const searchDB = {
    name:"searchDB",
    desc: DESC,
    params: {
        sqlQuery: z.string().describe("A SQL query to execute on the objects database. The query should be a valid SQL statement for the 'objects' table. For example: SELECT * FROM objects WHERE type = 'state' AND common_role LIKE 'switch%' LIMIT 10. Always use LIMIT because there may be a lot of data." ),
    },
    call: API => async (args) => {
        let res = await API.searchDB(args.sqlQuery)
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(res),
                },
            ],
        };
    },
}