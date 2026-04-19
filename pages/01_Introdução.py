import streamlit as st
from utils import require_login, show_logo, get_prices_title

st.set_page_config(page_title="Introdução", page_icon="📈", layout="wide")
require_login()
show_logo()
st.title("Gestão de Risco e Derivativos")

dolar, acucar, petroleo = get_prices_title()
if dolar is not None:
    def _br2(v): return f"{v:.2f}".replace(".", ",")
    st.markdown(f"**Dólar:** {_br2(dolar)} | **Açúcar (SB=F):** {_br2(acucar)} | **Petróleo (WTI):** {_br2(petroleo)}")

st.write("""
A indústria açucareira é um dos pilares da economia em muitos países, mas está sujeita a flutuações significativas nos preços do açúcar e do dólar, entre outros fatores. Nesse cenário, a gestão de riscos desempenha um papel fundamental para garantir a estabilidade e a lucratividade das operações.

**Proteção Cambial:**
A volatilidade no mercado de câmbio pode afetar diretamente os resultados financeiros de uma usina de açúcar, especialmente em países onde a moeda local é suscetível a oscilações. A proteção cambial é uma estratégia essencial para mitigar esse risco. Uma maneira comum de proteger-se é através do uso de contratos futuros de câmbio, que permitem fixar uma taxa de câmbio para transações futuras em moeda estrangeira, garantindo assim um preço previsível para as exportações de açúcar.

**Fixações:**
Além da proteção cambial, as usinas de açúcar frequentemente recorrem a estratégias de fixações para garantir um preço mínimo para sua produção. Isso pode ser feito através de contratos a termo ou swaps, onde um preço é acordado antecipadamente para uma determinada quantidade de açúcar. Essas fixações fornecem uma certa segurança contra quedas abruptas nos preços do açúcar, permitindo que a usina planeje suas operações com mais confiança.

**Mercado de Opções do Açúcar:**
Outra ferramenta importante na gestão de riscos é o mercado de opções do açúcar. As opções oferecem às usinas de açúcar a flexibilidade de proteger-se contra movimentos desfavoráveis nos preços do açúcar, enquanto ainda se beneficiam de movimentos favoráveis. Por exemplo, uma usina pode comprar opções de venda para proteger-se contra quedas nos preços do açúcar, enquanto ainda pode aproveitar os aumentos de preço se o mercado se mover a seu favor.

Em resumo, a gestão de riscos na indústria açucareira é essencial para garantir a estabilidade financeira e o crescimento sustentável das usinas de açúcar. Estratégias como proteção cambial, fixações e o uso inteligente do mercado de opções são fundamentais para mitigar os riscos inerentes a esse setor e maximizar os retornos sobre o investimento.
""")
