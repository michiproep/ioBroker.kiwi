import { z } from "zod";

const DESC_DELETE = `Deletes an ioBroker object. Can be any type of object like device, channel, state, or folder.
You must specify the object by its ID, which is usually in the format {instance}.{adapter}.{object} (e.g., "hue.0.brightness").
IMPORTANT: deleting objetcs you have not created yourself is very dangerous and can lead to data loss! ALLWAYS ask the user before deleting objects.`;

export const deleteObject = {
	name: "deleteObject",
	desc: DESC_DELETE,
	params: {
		id: z
			.string()
			.describe(
				"The ID of the object to delete. This is usually in the format {instance}.{adapter}.{state} (e.g., 'hue.0.brightness').",
			),
	},
	call: (API) => async (args) => {
		const ret = await API.deleteObject(args);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(ret),
				},
			],
		};
	},
};
