// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// Thin HTTP client for the public Cryptorefills x402 server.
// All requests go through one rate-limited fetcher. The User-Agent identifies
// this as a demo. Defaults are conservative: 1 req/s, 5s timeout.
//
// This file deliberately does NOT include any cryptographic signing helpers,
// wallet integration, or payment-submission logic. The demo stops at catalog
// reads and 402 inspection.

const BASE_URL = process.env.CRYPTOREFILLS_X402_URL ?? "https://x402.cryptorefills.com";
const USER_AGENT = "Cryptorefills-x402-Demo/0.1 (https://github.com/cryptorefills/agentic-commerce)";
const REQUEST_TIMEOUT_MS = Number(process.env.CRYPTOREFILLS_X402_TIMEOUT_MS ?? 5000);
const RATE_LIMIT_RPS = Number(process.env.CRYPTOREFILLS_X402_RATE_LIMIT_RPS ?? 1);

let lastRequestAt = 0;
const minIntervalMs = Math.ceil(1000 / RATE_LIMIT_RPS);

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + minIntervalMs - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export type FetchResult = {
  status: number;
  headers: Headers;
  body: unknown;
};

async function rateLimitedFetch(path: string, init: RequestInit = {}): Promise<FetchResult> {
  await rateLimit();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = new URL(path, BASE_URL).toString();
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });
    let body: unknown = null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => "");
    }
    return { status: res.status, headers: res.headers, body };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`upstream timeout after ${REQUEST_TIMEOUT_MS}ms (url=${url})`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchManifest(): Promise<FetchResult> {
  return rateLimitedFetch("/.well-known/x402.json");
}

export async function listBrands(countryCode: string): Promise<FetchResult> {
  if (!/^[a-z]{2}$/.test(countryCode)) {
    throw new Error(`country_code must be lowercase ISO 3166-1 alpha-2 (e.g. "us"); got "${countryCode}"`);
  }
  return rateLimitedFetch(`/v1/brands?country_code=${encodeURIComponent(countryCode)}`);
}

export async function getCatalog(countryCode: string, brandName: string): Promise<FetchResult> {
  if (!/^[a-z]{2}$/.test(countryCode)) {
    throw new Error(`country_code must be lowercase ISO 3166-1 alpha-2; got "${countryCode}"`);
  }
  return rateLimitedFetch(
    `/v1/catalog?country_code=${encodeURIComponent(countryCode)}&brand_name=${encodeURIComponent(brandName)}`,
  );
}

export async function postOrderForInspection(orderBody: unknown): Promise<FetchResult> {
  // Submits POST /v1/orders WITHOUT a payment signature. The server is
  // expected to respond with 402 PAYMENT-REQUIRED (or 400 if the body is
  // structurally invalid). This call deliberately does NOT include
  // PAYMENT-SIGNATURE — that's the line we never cross in this demo.
  return rateLimitedFetch("/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody),
  });
}

export const UPSTREAM_INFO = {
  baseUrl: BASE_URL,
  userAgent: USER_AGENT,
  timeoutMs: REQUEST_TIMEOUT_MS,
  rateLimitRps: RATE_LIMIT_RPS,
};
