import {z} from "zod";
const DESC = `Create a new scene object in ioBroker.

A scene is a named collection of state/value pairs that can be applied together, for example to set a group of lights, blinds, or other devices to a desired configuration.

To create a scene, provide:
- name: A descriptive name for the scene (e.g. 'kitchen_evening', 'all_off', 'party').
- members: An array of objects, each with:
    - id: The state ID to set (e.g. 'hue.0.Kücheninsel_1.bri').
    - value: The value to set for that state (e.g. 80, true, 'warmwhite').

Scenes can be used for lighting, climate, security, or any other group action.

Example:
{
  name: 'kitchen_evening',
  members: [
    { id: 'hue.0.Kücheninsel_1.on', value: true },
    { id: 'hue.0.Kücheninsel_1.bri', value: 80 },
    { id: 'hue.0.Kücheninsel_2.on', value: true },
    { id: 'hue.0.Kücheninsel_2.bri', value: 80 }
  ]
}
scenes are stored in "0_userdata.0.mcp_server.scenes" and can be applied buy setting the scenes state to true
Scenes are typically stored as JSON and can be triggered to apply all member states at once.`;

export const createScene = {
    name:"createScene",
    desc: DESC,
    params: {
        name: z.string().describe(`The name of the scene to create. This should be a descriptive name for the scene.`),
        members: z.array(
            z.object({
                id: z.string().describe("The ID of the state to set as part of the scene."),
                value: z.any().describe("The value to set for the state in this scene.")
            })
        ).describe("Array of state/value pairs that define the scene."),
    },
    call: API => async (args) => {
        let ret = await API.createScene(args)
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