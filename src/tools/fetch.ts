import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {JSDOM} from 'jsdom';
import {Defuddle} from 'defuddle/node';
import {jsonResult} from '../utils/response.js';

const outputSchema = z.object({
	title: z.string().nullable().describe('Page title'),
	url: z.string().describe('Fetched URL'),
	content: z.string().describe('Extracted content'),
});

const errorOutputSchema = z.object({
	error: z.string().describe('Error message'),
	url: z.string().describe('URL that failed'),
});

export function registerFetch(server: McpServer): void {
	server.registerTool(
		'fetch',
		{
			title: 'Fetch URL',
			description: 'Fetches a URL from the internet and extracts its contents as clean, readable text using Defuddle',
			inputSchema: {
				url: z.string().url().describe('URL to fetch'),
				max_length: z.number().int().positive().optional().default(5000).describe('Maximum number of characters to return'),
				start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index'),
				raw: z.boolean().optional().default(false).describe('Get raw content without markdown conversion'),
			},
			outputSchema: z.union([outputSchema, errorOutputSchema]),
			annotations: {
				readOnlyHint: true,
			},
		},
		async (args) => {
			try {
				const res = await (await fetch(args.url)).text();

				if (args.raw) {
					const trimmed = res.substring(args.start_index, args.start_index + args.max_length);
					return jsonResult(outputSchema.parse({
						title: null,
						url: args.url,
						content: trimmed,
					}));
				}

				const dom = new JSDOM(res, {url: args.url});
				// eslint-disable-next-line new-cap
				const result = await Defuddle(dom, args.url, {
					debug: false,
					markdown: true,
				});

				let {content} = result;
				content = content.substring(args.start_index, args.start_index + args.max_length);

				return jsonResult(outputSchema.parse({
					title: result.title || null,
					url: args.url,
					content,
				}));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);

				return {
					...jsonResult(errorOutputSchema.parse({
						error: errorMessage,
						url: args.url,
					})),
					isError: true,
				};
			}
		},
	);
}
