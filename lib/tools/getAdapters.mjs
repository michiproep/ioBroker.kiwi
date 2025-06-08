const DESC = `In IOBroker, an adapter is a software component that extends the functionality of the system, allowing it to interact with various devices and services. 
    This tool retrieves a list of all installed adapters in the IO Broker system including a description, a name, a title, keywords and a link to the adapters readme witch describes the functionality even further.
    to find divices, states, folders and othe objects you use the patter {name}.0 there might be mutiple instances running 
    you can use the getInstances tool to get a list of all instances of an adapter and if it is currently running or not.
    `;
export const getAdapters = {
	name: "getAdapters",
	desc: DESC,
	params: {},
	call: (API) => async (_args) => {
		const adapters = await API.getAdapters();
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(adapters),
				},
			],
		};
	},
};
