import {
	test, expect, vi, beforeEach, afterEach, describe,
} from 'vitest';
import {z} from 'zod';
import {JSDOM} from 'jsdom';
import {Defuddle} from 'defuddle/node';
import server from './index.js';
import {readFileSync} from 'node:fs';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Server Configuration', () => {
	test('server is defined and has correct configuration', () => {
		const packageJsonVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;

		expect(server).toBeDefined();
		expect(server.options.name).toBe('defuddle-fetch-mcp-server');
		expect(server.options.version).toBe(packageJsonVersion);
	});
});

describe('Dependencies Integration', () => {
	test('JSDOM integration works correctly', () => {
		const html = '<html><head><title>Test</title></head><body><h1>Hello World</h1><p>Test content</p></body></html>';
		const dom = new JSDOM(html, {url: 'https://example.com'});

		expect(dom.window.document.title).toBe('Test');
		expect(dom.window.document.querySelector('h1')?.textContent).toBe('Hello World');
		expect(dom.window.document.querySelector('p')?.textContent).toBe('Test content');
	});

	test('Defuddle integration processes HTML correctly', async () => {
		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Test Article</title>
				<meta name="author" content="Test Author">
				<meta name="description" content="Test description">
			</head>
			<body>
				<article>
					<h1>Main Article Title</h1>
					<p>This is the main content of the article.</p>
					<p>This is another paragraph.</p>
				</article>
				<aside>This is sidebar content that should be filtered out.</aside>
			</body>
			</html>
		`;

		const dom = new JSDOM(html, {url: 'https://example.com'});
		// eslint-disable-next-line new-cap
		const result = await Defuddle(dom, 'https://example.com', {
			debug: false,
			markdown: true,
		});

		expect(result.title).toBe('Test Article');
		expect(result.content).toMatchInlineSnapshot(`
			"## Main Article Title

			This is the main content of the article.

			This is another paragraph."
		`);
		expect(result.wordCount).toBeGreaterThan(0);
		expect(result.domain).toBe('example.com');
		expect(typeof result.parseTime).toBe('number');
	});

	test('fetch mock works correctly', async () => {
		const mockHtml = '<html><body>Test</body></html>';
		mockFetch.mockResolvedValueOnce({
			text: async () => Promise.resolve(mockHtml),
		});

		const response = await fetch('https://example.com');
		const text = await response.text();

		expect(mockFetch).toHaveBeenCalledWith('https://example.com');
		expect(text).toBe(mockHtml);
	});
});

describe('Parameter Schema Validation', () => {
	const createSchema = () => z.object({
		url: z.string().url().describe('URL to fetch'),
		max_length: z.number().int().positive().optional().default(5000).describe('Maximum number of characters to return'),
		start_index: z.number().int().min(0).optional().default(0).describe('Start content from this character index'),
		raw: z.boolean().optional().default(false).describe('Get raw content without markdown conversion'),
	});

	test('validates URL parameter correctly', () => {
		const schema = createSchema();

		// Valid URLs should pass
		expect(() => schema.parse({url: 'https://example.com'})).not.toThrow();
		expect(() => schema.parse({url: 'http://test.org/path'})).not.toThrow();
		expect(() => schema.parse({url: 'https://subdomain.example.com/path?query=1'})).not.toThrow();

		// Invalid URLs should fail
		expect(() => schema.parse({url: 'not-a-url'})).toThrow();
		expect(() => schema.parse({url: ''})).toThrow();
	});

	test('validates max_length parameter correctly', () => {
		const schema = createSchema();

		// Positive numbers should pass
		expect(() => schema.parse({url: 'https://example.com', max_length: 1000})).not.toThrow();
		expect(() => schema.parse({url: 'https://example.com', max_length: 1})).not.toThrow();

		// Zero and negative numbers should fail
		expect(() => schema.parse({url: 'https://example.com', max_length: 0})).toThrow();
		expect(() => schema.parse({url: 'https://example.com', max_length: -1})).toThrow();
		expect(() => schema.parse({url: 'https://example.com', max_length: -100})).toThrow();
	});

	test('validates start_index parameter correctly', () => {
		const schema = createSchema();

		// Zero and positive numbers should pass
		expect(() => schema.parse({url: 'https://example.com', start_index: 0})).not.toThrow();
		expect(() => schema.parse({url: 'https://example.com', start_index: 10})).not.toThrow();
		expect(() => schema.parse({url: 'https://example.com', start_index: 1000})).not.toThrow();

		// Negative numbers should fail
		expect(() => schema.parse({url: 'https://example.com', start_index: -1})).toThrow();
		expect(() => schema.parse({url: 'https://example.com', start_index: -100})).toThrow();
	});

	test('validates raw parameter correctly', () => {
		const schema = createSchema();

		// Boolean values should pass
		expect(() => schema.parse({url: 'https://example.com', raw: true})).not.toThrow();
		expect(() => schema.parse({url: 'https://example.com', raw: false})).not.toThrow();

		// Non-boolean values should fail
		expect(() => schema.parse({url: 'https://example.com', raw: 'true' as any})).toThrow();
		expect(() => schema.parse({url: 'https://example.com', raw: 1 as any})).toThrow();
	});

	test('applies default values correctly', () => {
		const schema = createSchema();

		const result = schema.parse({url: 'https://example.com'});
		expect(result.max_length).toBe(5000);
		expect(result.start_index).toBe(0);
		expect(result.raw).toBe(false);
		expect(result.url).toBe('https://example.com');
	});

	test('preserves provided values over defaults', () => {
		const schema = createSchema();

		const result = schema.parse({
			url: 'https://example.com',
			max_length: 1000,
			start_index: 10,
			raw: true,
		});

		expect(result.max_length).toBe(1000);
		expect(result.start_index).toBe(10);
		expect(result.raw).toBe(true);
		expect(result.url).toBe('https://example.com');
	});
});

describe('Content Processing Integration', () => {
	test('processes real HTML with JSDOM and Defuddle', async () => {
		const complexHtml = `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Complex Article</title>
				<meta name="author" content="Jane Doe">
				<meta name="description" content="A complex article with lots of metadata">
				<meta property="article:published_time" content="2023-01-01T00:00:00Z">
			</head>
			<body>
				<header>
					<nav>Navigation that should be filtered</nav>
				</header>
				<main>
					<article>
						<h1>Complex Article</h1>
						<p class="byline">By Jane Doe</p>
						<p>This is a complex article with multiple sections.</p>
						<h2>Section 1</h2>
						<p>Content for section 1 with important information.</p>
						<h2>Section 2</h2>
						<p>Content for section 2 with more details.</p>
					</article>
				</main>
				<aside>
					<p>Sidebar content that should be filtered out.</p>
				</aside>
				<footer>
					<p>Footer content that should also be filtered out.</p>
				</footer>
			</body>
			</html>
		`;

		const dom = new JSDOM(complexHtml, {url: 'https://example.com/complex'});
		// eslint-disable-next-line new-cap
		const result = await Defuddle(dom, 'https://example.com/complex', {
			debug: false,
			markdown: true,
		});

		// Verify Defuddle extracted the content correctly
		expect(result.title).toBe('Complex Article');
		expect(result.content).toMatchInlineSnapshot(`
			"By Jane Doe

			This is a complex article with multiple sections.

			## Section 1

			Content for section 1 with important information.

			## Section 2

			Content for section 2 with more details."
		`);
		expect(result.domain).toBe('example.com');
		expect(result.wordCount).toBeGreaterThan(0);

		// Verify that navigation, sidebar, and footer content is filtered out
		expect(result.content).not.toContain('Navigation that should be filtered');
		expect(result.content).not.toContain('Sidebar content that should be filtered');
		expect(result.content).not.toContain('Footer content that should also be filtered');
	});

	test('handles empty or minimal HTML gracefully', async () => {
		const minimalHtml = '<html><body></body></html>';

		const dom = new JSDOM(minimalHtml, {url: 'https://example.com/empty'});
		// eslint-disable-next-line new-cap
		const result = await Defuddle(dom, 'https://example.com/empty', {
			debug: false,
			markdown: true,
		});

		expect(result).toBeDefined();
		expect(result.domain).toBe('example.com');
		expect(typeof result.parseTime).toBe('number');
		expect(typeof result.wordCount).toBe('number');
	});

	test('content trimming works with real processed content', async () => {
		const html = `
			<html>
			<head><title>Test</title></head>
			<body>
				<article>
					<p>${'A'.repeat(1000)}</p>
				</article>
			</body>
			</html>
		`;

		const dom = new JSDOM(html, {url: 'https://example.com'});
		// eslint-disable-next-line new-cap
		const result = await Defuddle(dom, 'https://example.com', {
			debug: false,
			markdown: true,
		});

		// Test content trimming
		const maxLength = 100;
		const startIndex = 10;
		const trimmedContent = result.content.substring(startIndex, startIndex + maxLength);

		expect(trimmedContent.length).toBeLessThanOrEqual(maxLength);
	});
});

describe('Response Format Validation', () => {
	test('validates content response structure', () => {
		const mockResponse = {
			content: [
				{
					type: 'text' as const,
					text: '# Test Title\n\nTest content',
				},
				{
					type: 'text' as const,
					text: '\n\n---\n\n**Metadata:**\n**URL:** https://example.com',
				},
			],
			isError: false,
		};

		expect(mockResponse.content).toHaveLength(2);
		expect(mockResponse.content[0]!.type).toBe('text');
		expect(mockResponse.content[0]!.text).toContain('# Test Title');
		expect(mockResponse.content[1]!.text).toContain('**Metadata:**');
		expect(mockResponse.isError).toBe(false);
	});

	test('validates error response structure', () => {
		const errorResponse = {
			content: [
				{
					type: 'text' as const,
					text: 'Error fetching https://example.com: Network error',
				},
			],
			isError: true,
		};

		expect(errorResponse.content).toHaveLength(1);
		expect(errorResponse.content[0]!.type).toBe('text');
		expect(errorResponse.content[0]!.text).toContain('Error fetching');
		expect(errorResponse.isError).toBe(true);
	});

	test('validates raw response structure', () => {
		const rawResponse = {
			content: [
				{
					type: 'text' as const,
					text: '<html><body>Raw content</body></html>',
				},
			],
			isError: false,
		};

		expect(rawResponse.content).toHaveLength(1);
		expect(rawResponse.content[0]!.type).toBe('text');
		expect(rawResponse.content[0]!.text).toBe('<html><body>Raw content</body></html>');
		expect(rawResponse.isError).toBe(false);
	});
});
