const DESC = `ioBroker-Instanzen sind unabhängige Prozesse, die einen ioBroker-Adapter ausführen. Ein Adapter stellt eine Verbindung zu einem Gerät oder einer Plattform her und ermöglicht die Interaktion mit ioBroker. Eine Instanz ist eine spezielle Ausführung eines Adapters. 
    Diese Funktion ruft eine Liste aller installierten Adapter in der ioBroker-Instanz ab, einschließlich ihrer Beschreibung, ihres Namens, Titels, Schlüsselwörter und eines Links zur Readme des Adapters, die die Funktionalität weiter beschreibt
    dieses tools listet alle Instanzen im System auf und gibt an ab sie enabled sind also ob sie laufen oder gestoppt sind. 
    instanzen haben ids der form {name}.{instanznummer}. 
    `;
export const getRunningInstances = {
	name: "getRunningInstances",
	desc: DESC,
	params: {},
	call: (API) => async (_args) => {
		const instances = await API.getRunningInstances();
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(instances),
				},
			],
		};
	},
};
