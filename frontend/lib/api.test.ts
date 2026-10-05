import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  getSession: vi.fn(),
  refreshSession: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }));

const assign = vi.fn();
vi.stubGlobal("window", { location: { pathname: "/app/var", search: "?t=1", assign } });

function resposta(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

async function carregar() {
  vi.resetModules();
  return import("./api");
}

beforeEach(() => {
  vi.restoreAllMocks();
  assign.mockReset();
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } });
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("x") });
});

describe("apiFetch", () => {
  it("envia o token da sessão no header Authorization (API-01)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await carregar();
    await apiFetch("/api/x");
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer tok-1");
  });

  it("devolve o JSON em 2xx (API-01)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(200, { preco: 21.5 })));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).resolves.toEqual({ preco: 21.5 });
  });

  it("lança o detail da API em 4xx/5xx (API-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(400, { detail: "Ticker inválido." })));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ message: "Ticker inválido.", status: 400 });
  });

  it("usa a mensagem genérica quando não há detail (API-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(500, undefined)));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).rejects.toThrow(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });

  it("troca a lista de erros do 422 por mensagem legível (API-02)", async () => {
    const detail = [{ loc: ["body", "S"], msg: "Input should be greater than 0" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(422, { detail })));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).rejects.toThrow("Algum campo está fora do intervalo permitido.");
  });

  it("traduz falha de rede (API-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).rejects.toThrow(
      "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    );
  });

  it("traduz tempo limite estourado (API-02)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x", { timeoutMs: 10 })).rejects.toThrow(
      "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    );
  });

  it("em 401 renova a sessão e repete a requisição (API-04)", async () => {
    auth.refreshSession.mockResolvedValue({ data: { session: { access_token: "tok-2" } }, error: null });
    auth.getSession
      .mockResolvedValueOnce({ data: { session: { access_token: "tok-1" } } })
      .mockResolvedValueOnce({ data: { session: { access_token: "tok-2" } } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resposta(401, { detail: "Token expirado" }))
      .mockResolvedValueOnce(resposta(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).resolves.toEqual({ ok: true });
    expect((fetchMock.mock.calls[1][1].headers as Headers).get("Authorization")).toBe("Bearer tok-2");
    expect(assign).not.toHaveBeenCalled();
  });

  it("se a renovação falha, vai ao login com expirada e voltar (API-04)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(401, {})));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith("/login?expirada=1&voltar=%2Fapp%2Fvar%3Ft%3D1");
  });

  it("401 simultâneos fazem uma renovação e um redirecionamento (edge case)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(401, {})));
    const { apiFetch } = await carregar();
    await Promise.allSettled([apiFetch("/api/a"), apiFetch("/api/b")]);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("na tela de login não redireciona de novo (edge case)", async () => {
    vi.stubGlobal("window", { location: { pathname: "/login", search: "", assign } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta(401, {})));
    const { apiFetch } = await carregar();
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
    vi.stubGlobal("window", { location: { pathname: "/app/var", search: "?t=1", assign } });
  });
});

describe("destinoSeguro (API-05)", () => {
  it("aceita caminho dentro de /app/", async () => {
    const { destinoSeguro } = await carregar();
    expect(destinoSeguro("/app/var?t=1")).toBe("/app/var?t=1");
  });

  it("ignora destino fora de /app/", async () => {
    const { destinoSeguro } = await carregar();
    expect(destinoSeguro("https://malicioso.com")).toBe("/app/dashboard");
    expect(destinoSeguro(null)).toBe("/app/dashboard");
  });
});
