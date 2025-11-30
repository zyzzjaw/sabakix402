// Temporary diagnostics route to confirm which env vars Lambda sees.
// Remove this file once Amplify secrets propagation is verified.
const EXPOSE_PREFIXES = [
  "THIRDWEB",
  "MERCHANT",
  "SABAKI",
  "NEXT_PUBLIC_THIRDWEB",
  "CLI_API",
] as const;

type ExposedEnv = {
  key: string;
  present: boolean;
};

const collectEnv = (): ExposedEnv[] => {
  return Object.keys(process.env)
    .filter((key) => EXPOSE_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .sort()
    .map((key) => ({
      key,
      present: typeof process.env[key] === "string" && process.env[key]!.length > 0,
    }));
};

export async function GET() {
  const exposedEnv = collectEnv();
  return new Response(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      env: exposedEnv,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}


