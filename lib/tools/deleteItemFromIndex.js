import {z} from "zod";
const DESC = `This tool allows you to delete items from the vector index used for semantic search in the ioBroker system.
`;
export const deleteItemFromIndex = {
    name:"deleteItemFromIndex",
    desc: DESC,
    params: {
        id: z.string().describe("id of the item to delete from the index."),
    },
    call: API => async (args) => {
        let data = await API.deleteItemFromIndex(args.id)
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data),
                },
            ],
        };
    },
}