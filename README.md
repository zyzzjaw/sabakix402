## Sabaki x402 EPS Fact Agent (Starter Kit)

This folder contains a Next.js + Thirdweb x402 demo that sells **attested EPS fact bundles** behind an HTTP 402 paywall.

It exposes a simple API where a caller:
- Requests an EPS fact bundle for a ticker/period (for example `ICUI`, `CY2025Q3`),
- Pays via Thirdweb x402 on Avalanche Fuji,
- Receives a signed JSON payload that links back to the on-chain `SP500Oracle` attestation.

The focus of this folder is the core x402 + Fuji integration. Any separate deployment-specific apps are intentionally **not** documented here.

---

## Features

- **Paid EPS fact bundles**: `GET /api/facts/[ticker]?period=...` returns a JSON bundle with:
  - Extracted Non‑GAAP EPS,
  - Polymarket consensus EPS,
  - Provenance (filing links and timestamps),
  - On-chain `SP500Oracle` attestation details,
  - Payment receipt and service signature.
- **x402 paywall**:
  - Uses Thirdweb x402 helpers to settle per-request payments on Avalanche Fuji.
  - Supports a dev mode (`ALLOW_UNPAID_FACTS=true` and `x-skip-payment: 1`) to bypass payment during local testing.
- **On-chain verification**:
  - `lib/onchain.ts` reads Fuji `SP500Oracle` for a given `(ticker, periodId, metricId)`.
  - The bundle surfaces the evidence hash, URL hash, and transaction hash for replay.
- **Fact cache**:
  - `scripts/build_fact_cache.mjs` builds `data/facts_cache.json` from `attestations_posted.jsonl`.
  - API routes read from the cache first, then enrich from chain, so the app keeps working if the RPC is flaky.
- **CLI example**:
  - `scripts/sabaki-cli.mjs` shows how an x402-aware client can pay and fetch facts from the proxy using Node + Thirdweb.

---

## Directory structure (this folder only)

- **`app/`**
  - `app/page.tsx`: browser UI to connect a Fuji wallet, run the x402 flow, and display the returned JSON.
  - `app/api/facts/[ticker]/route.ts`: main paid EPS fact endpoint (for example `GET /api/facts/ICUI?period=CY2025Q3`).
  - `app/api/facts/feed` and `app/api/facts/pm`: proxy endpoints that sit in front of the Sabaki feed and Polymarket mirror.
  - `app/api/facts/handler.ts`: shared x402 helper logic for the proxy endpoints.
- **`components/`**
  - Presentational UI components for the landing page (`payment-card`, `content-display`, `transaction-log`, etc.).
- **`lib/`**
  - `lib/constants.ts`: network configuration, token addresses, API base URL, and price stubs.
  - `lib/factStore.ts`: loads `data/facts_cache.json` and finds facts by ticker/period.
  - `lib/onchain.ts`: `SP500Oracle` reader for Avalanche Fuji.
  - `lib/signing.ts`: signs bundles with a service key.
  - `lib/payment.ts`: normalized `fetch` wrapper to clean up `X-PAYMENT` headers and signatures.
- **`scripts/`**
  - `scripts/build_fact_cache.mjs`: build the local fact cache from `attestations_posted.jsonl`.
  - `scripts/sabaki-cli.mjs`: x402 CLI to fetch paid resources from the proxy.
  - `scripts/register_agent.mjs`: helper to register the EPS fact agent in an ERC‑8004 registry.
- **`data/`**
  - `data/facts_cache.json`: generated cache of EPS facts and ledger metadata.

---

## Prerequisites

- Node.js 20+ recommended.
- An Avalanche Fuji RPC URL (for example `https://api.avax-test.network/ext/bc/C/rpc`).
- A Fuji deployment of `SP500Oracle` (default address is baked into `lib/onchain.ts`).
- A Thirdweb account with:
  - `THIRDWEB_SECRET_KEY`,
  - A server wallet on Fuji that can receive payments.

---

## Environment variables

You can define these in `.env.local` or `.env` at the root of `x402-starter-kit`.

### Core app

- **`NEXT_PUBLIC_THIRDWEB_CLIENT_ID`**: Thirdweb client ID used by the browser wallet connect UI.
- **`THIRDWEB_SECRET_KEY`**: Thirdweb secret key used on the server to create the x402 facilitator client.
- **`THIRDWEB_SERVER_WALLET_ADDRESS`**: Server wallet that participates in the x402 flow (used by the facilitator).
- **`MERCHANT_WALLET_ADDRESS`**: Fuji address that actually receives payments.
- **`FACT_PRICE_AMOUNT`**: Price per EPS fact (base units, for example `10000` for `0.01` with 6 decimals). If omitted, a stub value in `lib/constants.ts` is used.
- **`ALLOW_UNPAID_FACTS`**: Set to `true` locally to allow `x-skip-payment: 1` and bypass settlement.

### Network + on-chain

- **`FUJI_RPC_URL`**: Avalanche Fuji RPC used by `lib/onchain.ts` (defaults to the public RPC).
- **`SP500_ORACLE_ADDR`**: Optional override for the `SP500Oracle` contract address (defaults to the currently deployed address).

### API base + feeds

- **`NEXT_PUBLIC_API_BASE_URL`**: Public base URL for this app (for example `https://facts.sabaki.ai`); used to construct absolute endpoints in the UI.
- **`CLI_API_BASE_URL`**: Base URL used by the CLI (`scripts/sabaki-cli.mjs`) to hit the proxy endpoints.
- **`SABAKI_FEED_URL`**: Upstream Sabaki EPS feed (`https://sabaki.ai/feed` by default).
- **`SABAKI_PM_URL`**: Upstream Polymarket mirror (`https://sabaki.ai/pm` by default).

### Signing + ERC‑8004 (optional, but recommended)

- **`FACT_BUNDLE_PRIVATE_KEY`**: Private key used to sign the JSON bundles.
- **`ERC8004_REGISTRY_ADDRESS`**: ERC‑8004 Identity Registry contract address on Fuji.
- **`ERC8004_AGENT_TOKEN_URI`**: Hosted URI for `public/agent.json`.
- **`ERC8004_AGENT_PRIVATE_KEY`**: Private key that owns the agent NFT (defaults to `FACT_BUNDLE_PRIVATE_KEY` if omitted).

---

## Getting started (local)

### 1. Install dependencies

```bash
cd x402-starter-kit
npm install
```

### 2. Build the fact cache

This reads `attestations_posted.jsonl` from the monorepo root and produces `data/facts_cache.json` used by the API.

```bash
node scripts/build_fact_cache.mjs \
  --input /home/dude/oracle/attestations_posted.jsonl \
  --out data/facts_cache.json
```

### 3. Set minimal env vars for local dev

```bash
export NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...
export THIRDWEB_SECRET_KEY=...
export MERCHANT_WALLET_ADDRESS=0x...
export FACT_PRICE_AMOUNT=10000        # 0.01 in base units
export ALLOW_UNPAID_FACTS=true        # optional, for dev
```

You can also place these values in `.env.local` instead of exporting them in your shell.

### 4. Run the Next.js dev server

```bash
npm run dev
```

Then open `http://localhost:3000` to use the EPS fact UI.

---

## API usage

### EPS fact bundle for a specific ticker

Endpoint:

- **`GET /api/facts/[ticker]?period=CY2025Q3`**

Example (dev mode, no payment required):

```bash
curl -H "x-skip-payment: 1" \
  "http://localhost:3000/api/facts/ICUI?period=CY2025Q3" \
  | jq
```

In production, clients:

1. Call the same URL once and receive `402 Payment Required` plus x402 payment terms in the headers.
2. Use Thirdweb x402 (for example `wrapFetchWithPayment`) to:
   - Construct and send the payment on Avalanche Fuji,
   - Attach the resulting `X-PAYMENT` header.
3. Re‑request the URL with `X-PAYMENT` present and receive the paid JSON bundle.

The bundle contains:

- `facts.non_gaap_eps` and `facts.pm_consensus_eps`,
- `provenance` (filing URLs, update time),
- `attestation` (Fuji `SP500Oracle` contract, evidence hash, URL hash, tx hash, on‑chain values),
- `payment_receipt`,
- `signature` and `signer`.

---

## CLI helper (`scripts/sabaki-cli.mjs`)

The CLI shows how an automated client can perform the x402 flow and fetch resources programmatically.

### Env for the CLI

Either export these or place them in `.env` (the script loads `dotenv`):

- `THIRDWEB_SECRET_KEY` **or** `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`
- `X402_CLI_PRIVATE_KEY` (Fuji private key the CLI uses to pay)
- `CLI_API_BASE_URL` (for example `https://facts.sabaki.ai` or `http://localhost:3000`)

### Usage

```bash
npm run cli -- fetch --resource feed
```

This will:

- Discover the x402 terms from the proxy,
- Pay on Avalanche Fuji using the configured private key,
- Print the resulting JSON feed (multiple tickers) to stdout.

---

## On-chain verification (`SP500Oracle`)

`lib/onchain.ts` wraps the `SP500Oracle` contract on Avalanche Fuji.

Given a bundle, you can independently verify the on-chain attestation with `cast`:

```bash
cast call $SP500_ORACLE_ADDR "getAttestation(string,bytes32,bytes32)" \
  ICUI \
  $(cast keccak CY2025Q3) \
  $(cast keccak "non-gaap:EPS") \
  --rpc-url $FUJI_RPC_URL
```

The returned `evidenceHash`, `urlHash`, and value should match the ones surfaced in the fact bundle.

---

## Notes

- This README documents only the `x402-starter-kit` folder.
- Any separate deployment-oriented apps or subfolders are intentionally out of scope here.


