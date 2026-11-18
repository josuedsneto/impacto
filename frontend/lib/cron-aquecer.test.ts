import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/cron/aquecer-cache/route";

const CRON = "segredo-cron";
const JOBS = "segredo-jobs";

function pedido(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  return new Request("http://app.test/api/cron/aquecer-cache", { headers });
}

describe("rota do cron de aquecimento (YAH-06.2)", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON);
    vi.stubEnv("JOBS_SECRET", JOBS);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sem bearer responde 401 e não chama o backend", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    const res = await GET(pedido());
    expect(res.status).toBe(401);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("bearer errado responde 401", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await GET(pedido("Bearer outro"))).status).toBe(401);
  });

  it("sem segredo configurado responde 500 (falha fechada)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubGlobal("fetch", vi.fn());
    expect((await GET(pedido(`Bearer ${CRON}`))).status).toBe(500);
  });

  it("com bearer certo chama o backend com X-Job-Secret e devolve a resposta", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ aquecidos: [] }), { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchFalso);
    const res = await GET(pedido(`Bearer ${CRON}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aquecidos: [] });
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("http://api.test/api/jobs/aquecer-cache");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Job-Secret"]).toBe(JOBS);
  });

  it("backend fora responde 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fora")));
    expect((await GET(pedido(`Bearer ${CRON}`))).status).toBe(502);
  });
});
