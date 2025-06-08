import { z } from "zod";
const DESC = `
get a list of all valid names of rooms and areas in my iobroker system. 
`;
export const getAllObjectsInRoom = {
	name: "getAllObjectsInRoom",
	desc: DESC,
	params: {
		room: z
			.string()
			.describe(
				"the name of the room as per getAllRooms tool (e.g. 'Kitchen', 'Ground Floor'). This is the name of the room you want to get all objects from. It should match one of the names returned by the getAllRooms tool.",
			),
	},
	call: (API) => async (args) => {
		const res = await API.getAllObjectsInRoom(args.room);
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
