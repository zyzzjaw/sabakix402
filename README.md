# x402 Starter Kit

HTTP 402 payment integration with Thirdweb on Avalanche Fuji testnet.

## Setup

```bash
git clone https://github.com/federiconardelli7/x402-starter-kit.git
cd x402-starter-kit
npm install
```

## Thirdweb Setup

### 1. Create Thirdweb Account
1. Go to [Thirdweb Dashboard](https://thirdweb.com/dashboard)
2. **Log in with your wallet** (connect your wallet to the dashboard)
3. Create a new project or use an existing one
4. Get your **Client ID** and **Secret Key** from the project

### 2. Set Up Facilitator Wallet (ERC4337 Smart Account)

**IMPORTANT:** The `THIRDWEB_SERVER_WALLET_ADDRESS` is the **facilitator address** used for transaction processing.

**You MUST use an ERC4337 Smart Account:**
1. In the Thirdweb dashboard, go to **Server Wallets** section
2. Click the switch button **Show ERC4337 Smart Account** 
3. Switch to the network (for example Avalanche Fuji Testnet)
3. Copy the smart account address - this will be your `THIRDWEB_SERVER_WALLET_ADDRESS`
4. Send some testnet token to that address that will pay the gas fee.

**IMPORTANT:** Do NOT use ERC-7702 accounts. Only ERC4337 Smart Accounts are supported as facilitators for some networks.

## Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the required values:

- `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` - Your Thirdweb client ID 
- `THIRDWEB_SECRET_KEY` - Your Thirdweb secret key 
- `THIRDWEB_SERVER_WALLET_ADDRESS` - **Facilitator address** (ERC4337 Smart Account address)
- `MERCHANT_WALLET_ADDRESS` - Payment recipient wallet address 

## Development

```bash
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Paid Fact Endpoints

| Endpoint | Cost | What you get |
| --- | --- | --- |
| `GET /api/facts/feed` | $0.01 | Raw JSON from `https://sabaki.ai/feed` (EPS attestations) |
| `GET /api/facts/pm` | $0.15 | Raw JSON from `https://sabaki.ai/pm` (Polymarket snapshot) |

Both endpoints return the exact upstream payload after the payment succeeds and forward the `X-PAYMENT-RESPONSE` header so you can log the receipt/tx hash.

## sabaki-cli

A minimal CLI that simulates an autonomous agent buying access over x402.

```bash
# Install deps first
npm install

# Configure env (same values as the Next app + X402_CLI_PRIVATE_KEY)
export THIRDWEB_SECRET_KEY=...
export X402_CLI_PRIVATE_KEY=0xabc123...
export CLI_API_BASE_URL=https://x402.sabaki.ai   # wherever you deploy this proxy

# Fetch the paid EPS feed
npm run cli -- fetch --resource feed

# or install the binary locally
npm link
sabaki-cli fetch --resource pm
```

The CLI automatically retries with a payment header, logs the receipt, and prints the JSON payload it purchased.

## Features

- HTTP 402 payment protocol implementation
- Thin proxy that forwards Sabaki fact feeds only after settlement
- CLI + UI demos for paying agents
- Automatic signature normalization for Avalanche Fuji
- Real-time transaction logging
- Modern UI with shadcn components

## Technical Stack

- Next.js 16
- Thirdweb SDK v5
- TypeScript
- Tailwind CSS
- shadcn/ui components
