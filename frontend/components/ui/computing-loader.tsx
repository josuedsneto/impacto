"use client";

import { useEffect, useState } from "react";

const FACTS = [
  "O Brasil é o maior exportador mundial de açúcar, responsável por cerca de 40% das exportações globais.",
  "O açúcar NY #11 é cotado em centavos por libra-peso na bolsa ICE Futures U.S., em Nova York.",
  "A volatilidade histórica do açúcar costuma variar entre 15% e 40% ao ano, dependendo do ciclo de safra.",
  "O câmbio USD/BRL tem correlação positiva com o preço do açúcar em reais — dólar alto beneficia exportadores.",
  "A simulação Monte Carlo usa milhares de caminhos aleatórios para estimar a distribuição futura de preços.",
  "O VaR a 95% estima a perda máxima esperada em 95% dos cenários em um horizonte definido.",
  "O modelo ARIMA captura padrões de tendência e sazonalidade em séries temporais de preços.",
  "Fixações de preço reduzem a exposição a oscilações de mercado e garantem margens mínimas.",
  "O ATR (Açúcar Total Recuperável) mede a eficiência de conversão da cana-de-açúcar em açúcar.",
  "O preço do petróleo influencia o açúcar indiretamente via demanda por etanol, concorrente da gasolina.",
  "Safras do Centro-Sul do Brasil são colhidas entre abril e novembro, pressionando preços nesse período.",
  "O índice de cobertura compara o volume fixado com a produção estimada — idealmente acima de 60%.",
];

interface ComputingLoaderProps {
  label?: string;
  expectedSeconds?: number;
}

export function ComputingLoader({
  label = "Calculando...",
  expectedSeconds = 30,
}: ComputingLoaderProps) {
  const [factIndex, setFactIndex] = useState(() =>
    Math.floor(Math.random() * FACTS.length)
  );
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Progress bar: grows toward 95% over expectedSeconds, then stalls
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed((e) => e + 1);
      setProgress((p) => {
        const remaining = 95 - p;
        return p + remaining * (1 / expectedSeconds) * 1.4;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [expectedSeconds]);

  // Rotate facts with a fade
  useEffect(() => {
    const rotate = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setFactIndex((i) => (i + 1) % FACTS.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(rotate);
  }, []);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{elapsed}s</span>
        </div>
        <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(progress, 95)}%` }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Enquanto você espera o cálculo, seguem alguns dados importantes...
        </p>
        <p
          className="text-sm leading-relaxed transition-opacity duration-400"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {FACTS[factIndex]}
        </p>
      </div>
    </div>
  );
}
