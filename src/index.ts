#!/usr/bin/env node

import {FastMCP} from 'fastmcp';
import {z} from 'zod';
import {JSDOM} from 'jsdom';
import {Defuddle} from 'defuddle/node';

const server = new FastMCP({
	name: 'defuddle-fetch-mcp-server',
	version: '1.0.0',
});

server.addTool({
	name: 'fetch',
	description: 'Fetches a URL from the internet and extracts its contents as clean, readable text using Defuddle',
	parameters: z.object({
		url: z.string().url().describe('URL to fetch'),
		max_length: z.number().int().positive().optional().default(5000).describe('Maximum number of characters to return'),
		start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index'),
		raw: z.boolean().optional().default(false).describe('Get raw content without markdown conversion'),
	}),
	async execute(args, {log}) {
		try {
			log.debug('Fetching URL', {url: args.url});
			const res = await (await fetch(args.url)).text();

			if (args.raw) {
				log.debug('Returning raw result');
				const trimmed = res.substring(args.start_index, args.start_index + args.max_length);
				return {
					content: [
						{
							type: 'text' as const,
							text: trimmed,
						},
					],
					isError: false,
				};
			}

			log.debug('Processing content with Defuddle');
			const dom = new JSDOM(res, {url: args.url});
			// eslint-disable-next-line new-cap
			const result = await Defuddle(dom, args.url, {
				debug: false,
				markdown: true,
			});

			let {content} = result;
			content = content.substring(args.start_index, args.start_index + args.max_length);

			const metadata = [
				`**URL:** ${args.url}`,
				`**Title:** ${result.title || 'N/A'}`,
				`**Author:** ${result.author || 'N/A'}`,
				`**Published:** ${result.published || 'N/A'}`,
				`**Word Count:** ${result.wordCount}`,
				`**Domain:** ${result.domain || 'N/A'}`,
				`**Parse Time:** ${result.parseTime}ms`,
			];

			if (result.description) {
				metadata.push(`**Description:** ${result.description}`);
			}

			const response = {
				content: [
					{
						type: 'text' as const,
						text: `# ${result.title || 'Untitled'}\n\n${content}`,
					},
					{
						type: 'text' as const,
						text: `\n\n---\n\n**Metadata:**\n${metadata.join('\n')}`,
					},
				],
				isError: false,
			};

			return response;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			log.error('Failed to fetch URL', {url: args.url, error: errorMessage});

			return {
				content: [
					{
						type: 'text' as const,
						text: `Error fetching ${args.url}: ${errorMessage}`,
					},
				],
				isError: true,
			};
		}
	},
});

server.addPrompt({
	name: 'fetch',
	description: 'Fetch a URL and extract its contents as clean, readable text',
	arguments: [
		{
			name: 'url',
			description: 'URL to fetch',
			required: true,
		},
	],
	async load(args) {
		return `Please fetch the content from this URL and provide a clean, readable summary: ${args.url}`;
	},
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
	void server.start({
		transportType: 'stdio',
	});
}

export default server;
