/* eslint-env browser */
// @ts-nocheck
import { LitElement, html, css } from "https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js";
import { io } from "../socket.io.esm.min.js";

class IoBrokerApp extends LitElement {
	static styles = css`
		:host {
			display: block;
			font-family: Arial, sans-serif;
		}
		.container {
			padding: 16px;
			background-color: #f9f9f9;
			border: 1px solid #ddd;
			border-radius: 8px;
		}
		h1 {
			color: #333;
		}
	`;

	static properties = {
		title: { type: String },
	};

	constructor() {
		super();
		this.title = "ioBroker App";
		this.socket = io({ port: this.port || 8082, path: this.path || "/" });
	}

	render() {
		return html`
			<div class="container">
				<h1>${this.title}</h1>
			</div>
		`;
	}

	_handleClick() {
		console.log("Button clicked!");
		alert("Button clicked!");
	}
}

customElements.define("io-broker-app", IoBrokerApp);
