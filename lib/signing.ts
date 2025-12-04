import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const rawPrivateKey = process.env.FACT_BUNDLE_PRIVATE_KEY;

const normalizedKey =
  rawPrivateKey && rawPrivateKey.length > 0
    ? ((rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`) as Hex)
    : null;

const account = normalizedKey ? privateKeyToAccount(normalizedKey) : null;

export type BundleSignature = {
  signature: Hex;
  signer: string;
};

export async function signBundle(payload: unknown): Promise<BundleSignature | null> {
  if (!account) {
    return null;
  }

  const message = JSON.stringify(payload);
  const signature = await account.signMessage({ message });
  return { signature, signer: account.address };
}

