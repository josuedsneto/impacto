import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFocus, getPrecos } from "./dados-servidor";

const erro = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  erro.mockClear();
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllGlobals());

function respostaJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("dados-servidor (FD-01, FD-02)", () => {
  it.each(["", "/api"])("URL %j não é absoluta: não chama a API e registra o erro", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", url);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await getFocus("tok");
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalled();
  });

  it("URL absoluta: chama o caminho com o token e devolve os dados", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.com/");
    const fetchMock = vi.fn().mockResolvedValue(respostaJson({ selic: { value: 14.5 } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await getFocus("tok-9");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.exemplo.com/api/focus");
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer tok-9");
    expect(r).toEqual({ ok: true, dados: { selic: { value: 14.5 } } });
  });

  it("HTTP de erro vira { ok: false } com log, não lista vazia", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaJson({}, 503)));
    const r = await getPrecos("SB=F", "tok");
    expect(r).toEqual({ ok: false, erro: "HTTP 503" });
    expect(erro).toHaveBeenCalled();
  });

  it("falha de rede vira { ok: false } com log", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.com");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const r = await getPrecos("SB=F", "tok");
    expect(r.ok).toBe(false);
    expect(erro).toHaveBeenCalled();
  });

  it("cotação sem rows devolve lista vazia com ok: true (vazio não é falha)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.exemplo.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaJson({})));
    await expect(getPrecos("SB=F", "tok")).resolves.toEqual({ ok: true, dados: [] });
  });
});
