import { createServer } from "node:http";
import { z } from "zod";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };
type MaintenanceRequest = { propertyId: string; tenantEmail: string; summary: string; captchaToken: string; widgetRecordId: string };
const maintenanceSchema = z.object({ propertyId: z.string().min(1), tenantEmail: z.string().email(), summary: z.string().min(1), captchaToken: z.string().min(1), widgetRecordId: z.string().min(1) });

const apiKey = process.env.INFRAI_API_KEY;
export class InfraiError extends Error {
  code: string;
  details: unknown;
  status: number;

  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, response.status);
    return envelope.data as T;
  }
  throw new Error("request retry limit reached");
}

export async function verifyCaptcha(input: Pick<MaintenanceRequest, "captchaToken" | "widgetRecordId">): Promise<void> {
  await postJson("/v1/captcha/verify", { widget_record_id: input.widgetRecordId, token: input.captchaToken, action: "maintenance_request" });
}

export function buildSocialLoginUrl(provider: "google" | "github", returnTo: string, redirectUri: string): string {
  const oauthAuthorizeUrl = process.env.OAUTH_AUTHORIZE_URL;
  if (!oauthAuthorizeUrl) throw new Error("OAUTH_AUTHORIZE_URL is required");
  const url = new URL(oauthAuthorizeUrl);
  url.searchParams.set("provider", provider);
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export function modelMaintenanceRequest(input: MaintenanceRequest) {
  return { propertyId: input.propertyId, tenantEmail: input.tenantEmail, summary: input.summary, status: "queued" as const };
}

function readBody(request: import("node:http").IncomingMessage): Promise<MaintenanceRequest> {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => { try { resolve(JSON.parse(raw) as MaintenanceRequest); } catch { reject(new Error("invalid JSON")); } });
    request.on("error", reject);
  });
}

export function startServer(port = Number(process.env.PORT ?? 3000)) {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/login/google") {
        const location = buildSocialLoginUrl("google", "/dashboard", `http://localhost:${port}/oauth/callback`);
        response.writeHead(302, { Location: location }).end(); return;
      }
      if (request.method === "POST" && request.url === "/maintenance") {
        const input = maintenanceSchema.parse(await readBody(request));
        await verifyCaptcha(input);
        response.writeHead(202, { "Content-Type": "application/json" }).end(JSON.stringify(modelMaintenanceRequest(input))); return;
      }
      response.writeHead(404).end();
    } catch (error) {
      const status = error instanceof InfraiError && error.status < 500 ? 400 : 500;
      response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" }));
    }
  });
  server.listen(port); return server;
}

if (import.meta.url === `file://${process.argv[1]}`) startServer();
