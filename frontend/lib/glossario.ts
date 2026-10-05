// Termos do glossário (LING-07). Ordem alfabética; até 3 frases por definição.

export interface Termo {
  id: string;
  termo: string;
  definicao: string;
}

export const GLOSSARIO: Termo[] = [
  { id: "atr", termo: "ATR", definicao: "Açúcar Total Recuperável: quilos de açúcar que se consegue extrair de cada tonelada de cana. É a base do pagamento da cana pelo Consecana. Chuva e impureza costumam reduzi-lo." },
  { id: "breakeven", termo: "Breakeven", definicao: "Ponto de equilíbrio: o valor de uma variável em que o resultado fica exatamente em zero. Abaixo dele há prejuízo; acima, lucro." },
  { id: "call", termo: "Call", definicao: "Opção de compra: dá o direito, mas não a obrigação, de comprar o ativo pelo preço de exercício até o vencimento. Quem compra a call paga um prêmio por esse direito." },
  { id: "cambio", termo: "Câmbio", definicao: "Quantos reais vale um dólar (R$/US$). Como o açúcar é cotado em dólar, um dólar mais caro aumenta a receita em reais da usina." },
  { id: "cbio", termo: "CBIO", definicao: "Crédito de Descarbonização do RenovaBio. A usina emite CBIOs pelo etanol produzido e os vende a distribuidoras de combustível." },
  { id: "drawdown", termo: "Drawdown", definicao: "Queda do preço desde um pico até o fundo seguinte, em porcentagem. Mede o tamanho das piores perdas da história." },
  { id: "ebitda", termo: "EBITDA", definicao: "Resultado operacional antes de juros, impostos, depreciação e amortização. Mostra quanto a operação da usina gera de caixa." },
  { id: "fixacao", termo: "Fixação", definicao: "Travar hoje o preço de uma venda futura de açúcar. Protege a usina de quedas de preço, mas abre mão de ganhar com altas." },
  { id: "hedge", termo: "Hedge", definicao: "Operação feita para reduzir um risco, como fixar preço ou comprar opções. O objetivo é proteção, não lucro com a operação em si." },
  { id: "monte-carlo", termo: "Monte Carlo", definicao: "Método que simula milhares de cenários aleatórios para ver a faixa de resultados possíveis. Quanto mais cenários, mais estável o resultado." },
  { id: "percentil", termo: "Percentil", definicao: "Valor abaixo do qual fica uma parte dos cenários. P5 é o valor que só 5% dos cenários ficam abaixo; P50 é a mediana." },
  { id: "premio", termo: "Prêmio", definicao: "Preço pago por uma opção. Quem compra a opção paga o prêmio; quem vende recebe." },
  { id: "put", termo: "Put", definicao: "Opção de venda: dá o direito, mas não a obrigação, de vender o ativo pelo preço de exercício até o vencimento. Funciona como um seguro contra queda de preço." },
  { id: "regressao", termo: "Regressão", definicao: "Modelo estatístico que estima uma variável a partir de outras, com base no histórico. A qualidade depende de quantos dados existem e de o passado se repetir." },
  { id: "strike", termo: "Strike", definicao: "Preço de exercício: o preço combinado pelo qual a opção permite comprar (call) ou vender (put) o ativo." },
  { id: "var", termo: "VaR", definicao: "Value at Risk: a maior perda esperada em um prazo, para um nível de confiança. VaR de 95% em 1 dia significa que em 95 de cada 100 dias a perda não passa desse valor." },
  { id: "vhp", termo: "VHP", definicao: "Very High Polarization: açúcar bruto de alta pureza, o tipo mais exportado pelo Brasil e a referência do contrato NY nº 11." },
  { id: "volatilidade", termo: "Volatilidade", definicao: "Quanto o preço costuma oscilar, em porcentagem ao ano. Volatilidade alta significa movimentos maiores para cima e para baixo." },
];
