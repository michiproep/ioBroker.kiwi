import {z} from "zod";
const DESC = `
get a list of all valid rooms and areas in my iobroker system
`;
export const getAllRooms = {
    name:"getAllRooms",
    desc: DESC,
    params: {},
    call: API => async (args) => {
        let res = await API.getAllRooms()
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