#!/usr/bin/env node

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {JSDOM} from 'jsdom';
import {Defuddle} from 'defuddle/node';
import packageJson from '../package.json' with { type: 'json' };

const server = new McpServer({
	name: 'defuddle-fetch-mcp-server',
	version: packageJson.version,
});

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
	},
	async (args) => {
		try {
			const res = await (await fetch(args.url)).text();

			if (args.raw) {
				const trimmed = res.substring(args.start_index, args.start_index + args.max_length);
				return {
					content: [
						{
							type: 'text' as const,
							text: trimmed,
						},
					],
				};
			}

			const dom = new JSDOM(res, {url: args.url});
			// eslint-disable-next-line new-cap
			const result = await Defuddle(dom, args.url, {
				debug: false,
				markdown: true,
			});

			let {content} = result;
			content = content.substring(args.start_index, args.start_index + args.max_length);

			return {
				content: [
					{
						type: 'text' as const,
						text: `# ${result.title || 'Untitled'}\n\n**URL**: ${args.url}\n\n${content}`,
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

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
);

// Start the server
const transport = new StdioServerTransport();
void server.connect(transport);

export default server;
