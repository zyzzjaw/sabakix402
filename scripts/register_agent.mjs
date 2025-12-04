#!/usr/bin/env node
/**
 * Minimal ERC-8004 agent registration helper.
 *
 * Usage:
 *   node scripts/register_agent.mjs \
 *     --registry 0xRegistryAddress \
 *     --token-uri https://facts.sabaki.ai/agent.json \
 *     --private-key $ERC8004_AGENT_PRIVATE_KEY \
 *     --rpc-url https://api.avax-test.network/ext/bc/C/rpc
 *
 * Environment fallbacks:
 *   ERC8004_REGISTRY_ADDRESS
 *   ERC8004_AGENT_TOKEN_URI
 *   ERC8004_AGENT_PRIVATE_KEY
 *   ERC8004_RPC_URL (defaults to FUJI_RPC_URL or avalancheFuji public RPC)
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const ARG_MAP = new Map();
const cliArgs = process.argv.slice(2);
for (let i = 0; i < cliArgs.length; i++) {
  const arg = cliArgs[i];
  if (!arg.startsWith("--")) continue;
  const key = arg;
  const value = cliArgs[i + 1]?.startsWith("--") ? undefined : cliArgs[i + 1];
  ARG_MAP.set(key, value);
  if (value !== undefined) {
    i += 1;
  }
}

const getArg = (flag, envKeys = []) => {
  if (ARG_MAP.has(flag)) return ARG_MAP.get(flag);
  for (const key of envKeys) {
    if (process.env[key] && process.env[key]!.length > 0) {
      return process.env[key];
    }
  }
  return undefined;
};

const registryAddress = getArg("--registry", ["ERC8004_REGISTRY_ADDRESS"]);
const tokenUri = getArg("--token-uri", ["ERC8004_AGENT_TOKEN_URI"]);
const privateKeyRaw = getArg("--private-key", ["ERC8004_AGENT_PRIVATE_KEY", "FACT_BUNDLE_PRIVATE_KEY"]);
const rpcUrl =
  getArg("--rpc-url", ["ERC8004_RPC_URL", "FUJI_RPC_URL"]) ??
  avalancheFuji.rpcUrls.default.http[0];

if (!registryAddress || !tokenUri || !privateKeyRaw) {
  console.error(
    "\nMissing required inputs.\n" +
      "Provide --registry, --token-uri, and --private-key flags or set\n" +
      "ERC8004_REGISTRY_ADDRESS / ERC8004_AGENT_TOKEN_URI / ERC8004_AGENT_PRIVATE_KEY environment variables.\n",
  );
  process.exit(1);
}

const normalizedKey = privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`;
const account = privateKeyToAccount(normalizedKey);

const walletClient = createWalletClient({
  account,
  chain: avalancheFuji,
  transport: http(rpcUrl),
});

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(rpcUrl),
});

const ERC8004_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
];

async function main() {
  console.log("➜ Submitting ERC-8004 register() call");
  console.log(`   registry:   ${registryAddress}`);
  console.log(`   token URI:  ${tokenUri}`);
  console.log(`   from:       ${account.address}`);
  console.log(`   rpc:        ${rpcUrl}`);

  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: ERC8004_REGISTRY_ABI,
    functionName: "register",
    args: [tokenUri],
  });

  console.log(`✓ Transaction submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Included in block ${receipt.blockNumber}`);

  if (receipt.contractAddress) {
    console.log(`ℹ️  Registry deployed at ${receipt.contractAddress}`);
  }

  console.log("Done. Query tokenURI(agentId) on the registry to confirm.");
}

main().catch((err) => {
  console.error("Register agent failed:", err);
  process.exit(1);
});


