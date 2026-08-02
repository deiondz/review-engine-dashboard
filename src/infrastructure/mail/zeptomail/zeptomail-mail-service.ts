import "server-only";

import type {
	MailService,
	SendMailInput,
} from "@/application/ports/outbound/mail-service";

type ZeptoMailErrorBody = {
	error?: {
		code?: string;
		message?: string;
		details?: Array<{ code?: string; message?: string }>;
	};
	request_id?: string;
};

export type ZeptoMailMailServiceOptions = {
	token: string;
	fromEmail: string;
	fromName: string;
	apiUrl: string;
};

export class ZeptoMailMailService implements MailService {
	constructor(private readonly options: ZeptoMailMailServiceOptions) {}

	async send(input: SendMailInput): Promise<void> {
		const body: Record<string, unknown> = {
			from: {
				address: this.options.fromEmail,
				name: this.options.fromName,
			},
			to: [
				{
					email_address: {
						address: input.to.address,
						...(input.to.name ? { name: input.to.name } : {}),
					},
				},
			],
			subject: input.subject,
			htmlbody: input.html,
			textbody: input.text,
		};

		if (input.replyTo) {
			body.reply_to = [
				{
					address: input.replyTo.address,
					...(input.replyTo.name ? { name: input.replyTo.name } : {}),
				},
			];
		}

		const response = await fetch(this.options.apiUrl, {
			method: "POST",
			headers: {
				Authorization: `Zoho-enczapikey ${this.options.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (response.ok) {
			return;
		}

		let errorCode = `HTTP_${response.status}`;
		let errorMessage = response.statusText || "ZeptoMail request failed";

		try {
			const payload = (await response.json()) as ZeptoMailErrorBody;
			const detail = payload.error?.details?.[0];
			errorCode = detail?.code ?? payload.error?.code ?? errorCode;
			errorMessage = detail?.message ?? payload.error?.message ?? errorMessage;
		} catch {
			// Keep status-based fallback when the body is not JSON.
		}

		throw new Error(`ZeptoMail error ${errorCode}: ${errorMessage}`);
	}
}
