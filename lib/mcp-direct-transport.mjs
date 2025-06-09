export class DirectTransport {
	constructor() {
		this.isConnected = false;
		this.onmessage = null;
		this.onclose = null;
		this.onerror = null;
		this.mcpServer = null;
		this.requestHandlers = new Map();
		this.clientTransport = null;
	}

	async start() {
		this.isConnected = true;
	}

	async close() {
		this.isConnected = false;
		if (this.onclose) {
			this.onclose();
		}
	}

	async receiveMessage(message) {
		if (!this.isConnected) {
			throw new Error("Transport not connected");
		}

		if (this.onmessage) {
			const originalSend = this.send;
			this.send = async (response) => {
				if (this.clientTransport) {
					this.clientTransport.receiveResponse(response);
				}
				this.send = originalSend;
			};

			this.onmessage(message);
		}
	}
}

export class DirectClientTransport {
	constructor(serverTransport) {
		this.serverTransport = serverTransport;
		this.isConnected = false;
		this.onmessage = null;
		this.onclose = null;
		this.onerror = null;
		this.pendingRequests = new Map();
	}

	async start() {
		this.isConnected = true;
		this.serverTransport.clientTransport = this;
		await this.serverTransport.start();
	}

	async close() {
		this.isConnected = false;
		await this.serverTransport.close();
		if (this.onclose) {
			this.onclose();
		}
	}

	async send(message) {
		if (!this.isConnected) {
			throw new Error("Transport not connected");
		}
		await this.serverTransport.receiveMessage(message);
	}
	receiveResponse(response) {
		if (this.onmessage) {
			this.onmessage(response);
		}
	}
}
