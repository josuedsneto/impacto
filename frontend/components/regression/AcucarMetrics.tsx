"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AcucarResult } from "./AcucarForm";

interface AcucarMetricsProps {
  result: AcucarResult;
}

export function AcucarMetrics({ result }: AcucarMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Preço Previsto SB=F
          </p>
          <p className="text-2xl font-bold">{result.sb_f_previsto.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">¢/lb</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Intervalo
          </p>
          <p className="text-lg font-bold">
            {result.sb_f_min.toFixed(2)} – {result.sb_f_max.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">¢/lb</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">R²</p>
          <p className="text-2xl font-bold">{result.r2.toFixed(4)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">RMSE</p>
          <p className="text-2xl font-bold">{result.rmse.toFixed(4)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
