import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ContentDisplayProps {
  resource: string;
  count?: number;
  source: string;
  payload: unknown;
  paymentReceipt?: string | null;
  timestamp: string;
}

const stringifyPayload = (payload: unknown) => {
  try {
    if (Array.isArray(payload)) {
      return JSON.stringify(payload.slice(0, 3), null, 2);
    }
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

export function ContentDisplay({ resource, count, source, payload, paymentReceipt, timestamp }: ContentDisplayProps) {
  const preview = stringifyPayload(payload);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment Successful</CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Verified
          </Badge>
        </div>
        <CardDescription className="space-y-1 text-sm text-muted-foreground">
          <div>
            Resource: <span className="font-medium text-foreground">{resource}</span>
          </div>
          <div>Source: <code className="text-xs">{source}</code></div>
          {typeof count === "number" && <div>Entries delivered: <span className="font-medium">{count}</span></div>}
          {paymentReceipt && (
            <div className="break-all">
              Tx Receipt: <span className="text-[11px] font-mono">{paymentReceipt}</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Preview (first items)</p>
          <pre className="overflow-x-auto rounded bg-zinc-900/90 p-4 text-[12px] text-zinc-100">
            {preview}
          </pre>
          {Array.isArray(payload) && payload.length > 3 && (
            <p className="text-xs text-muted-foreground mt-2">Showing first 3 entries out of {payload.length}.</p>
          )}
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Timestamp: {new Date(timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
