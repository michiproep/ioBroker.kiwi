import {z} from "zod";
const DESC = `Set multiple ioBroker states in a single call. Pass an array of objects, each with an 'id' (state ID) and 'value' (the value to set). Useful for Szenen, Gruppenaktionen oder das gleichzeitige Schalten mehrerer Geräte. Besonders praktisch, um bei Lampen gleichzeitig Farbe, Helligkeit und An/Aus-Zustand zu setzen. Rückgabe enthält das Ergebnis für jeden gesetzten State.`
export const setStateBulk = {
    name:"setStateBulk",
    desc: DESC,
    params: {
        states: z.array(
            z.object({
                id: z.string().describe("The ID of the state to set."),
                value: z.any().describe("The value to set for the state."),
            })
        ).describe("An array of states to set. Each state is an object with an 'id' and a 'value'."),
    },
    call: API => async (args) => {
        let ret = await API.setStateBulk(args.states)
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