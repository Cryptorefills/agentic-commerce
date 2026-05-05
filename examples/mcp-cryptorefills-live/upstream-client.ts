// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// Thin HTTP client for the public Cryptorefills MCP server.
// Endpoint:    https://api.cryptorefills.com/mcp/http
// Transport:   stateless HTTP, JSON-RPC 2.0
// Auth:        none for catalog operations
// Required UA: Cryptorefills-MCP/1.0 (we send the -Demo/0.1 variant so traffic is identifiable in upstream analytics).
//
// Rate limit: 1 req/s by default (very conservative). Override via CRYPTOREFILLS_RATE_LIMIT_RPS.
// Timeout:    5 seconds default. Override via CRYPTOREFILLS_TIMEOUT_MS.

const ENDPOINT = process.env.CRYPTOREFILLS_MCP_URL ?? "https://api.cryptorefills.com/mcp/http";
const USER_AGENT = "Cryptorefills-MCP-Demo/0.1 (https://github.com/cryptorefills/agentic-commerce)";
const REQUEST_TIMEOUT_MS = Number(process.env.CRYPTOREFILLS_TIMEOUT_MS ?? 5000);
const RATE_LIMIT_RPS = Number(process.env.CRYPTOREFILLS_RATE_LIMIT_RPS ?? 1);
const PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: JsonRpcError;
}

interface ToolCallResult {
  structuredContent?: { result?: unknown };
  content?: unknown[];
}

interface InitializeResult {
  protocolVersion: string;
  serverInfo: { name: string; version: string };
}

// Token bucket: enforce minimum interval between requests.
let lastRequestTime = 0;
const minIntervalMs = Math.max(1, Math.ceil(1000 / RATE_LIMIT_RPS));

async function rateLimitedFetch<T>(body: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
  const now = Date.now();
  const wait = Math.max(0, lastRequestTime + minIntervalMs - now);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Honor Retry-After if present.
      const retryAfter = res.headers.get("Retry-After");
      const suffix = retryAfter ? ` (retry-after ${retryAfter})` : "";
      throw new Error(`upstream ${res.status} ${res.statusText}${suffix}`);
    }
    const json = (await res.json()) as JsonRpcResponse<T>;
    return json;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`upstream timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

let nextId = 1;

export async function callUpstream(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const id = nextId++;
  const response = await rateLimitedFetch<ToolCallResult>({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  if (response.error) {
    throw new Error(`upstream tool error (${response.error.code}): ${response.error.message}`);
  }
  // Real Cryptorefills response shape: result.structuredContent.result holds the parsed payload.
  const structured = response.result?.structuredContent?.result;
  if (structured !== undefined) return structured;
  // Fallback to result.content if structuredContent is missing.
  return response.result?.content ?? null;
}

export interface UpstreamInfo {
  name: string;
  version: string;
  protocolVersion: string;
}

export async function initializeUpstream(): Promise<UpstreamInfo> {
  const response = await rateLimitedFetch<InitializeResult>({
    jsonrpc: "2.0",
    id: nextId++,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "cryptorefills-mcp-demo", version: "0.1.0" },
    },
  });
  if (response.error) {
    throw new Error(`upstream initialize error (${response.error.code}): ${response.error.message}`);
  }
  const r = response.result;
  if (!r) throw new Error("upstream initialize returned no result");
  return { name: r.serverInfo.name, version: r.serverInfo.version, protocolVersion: r.protocolVersion };
}
