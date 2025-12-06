import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PaymentCardProps {
  tier: string;
  price: string;
  description: string;
  features?: string[];
  onPayClick: () => void;
  isPaying: boolean;
  badgeText?: string;
  disabled?: boolean;
  disabledLabel?: string;
}

export function PaymentCard({
  tier,
  price,
  description,
  features,
  onPayClick,
  isPaying,
  badgeText = "x402",
  disabled = false,
  disabledLabel = "Coming Soon",
}: PaymentCardProps) {
  return (
    <Card
      className={`w-full max-w-sm bg-slate-900 border-slate-800 text-slate-100 shadow-lg ${disabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl">{tier}</CardTitle>
          <Badge variant="secondary" className="uppercase tracking-tight">
            {badgeText}
          </Badge>
        </div>
        <CardDescription className="text-slate-300">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold mb-4">
          {price} <span className="text-sm text-slate-400">AVAX</span>
        </div>
        {features && features.length > 0 && (
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm text-slate-200">
                <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={onPayClick}
          disabled={disabled || isPaying}
        >
          {disabled ? disabledLabel : isPaying ? "Processing..." : "Pay Now"}
        </Button>
      </CardFooter>
    </Card>
  );
}
