import assert from "node:assert/strict";
import { buildSocialLoginUrl, modelMaintenanceRequest } from "./property_oauth.ts";

process.env.OAUTH_AUTHORIZE_URL = "https://login.example.test/authorize";
const login = buildSocialLoginUrl("github", "/inspections", "https://app.test/oauth/callback");
const parsed = new URL(login);
assert.equal(parsed.searchParams.get("provider"), "github");
assert.equal(parsed.searchParams.get("return_to"), "/inspections");

const queued = modelMaintenanceRequest({ propertyId: "building-7", tenantEmail: "tenant@example.com", summary: "Leaking faucet", captchaToken: "demo", widgetRecordId: "widget-7" });
assert.deepEqual(queued, { propertyId: "building-7", tenantEmail: "tenant@example.com", summary: "Leaking faucet", status: "queued" });
console.log("social login URL and maintenance decision passed");
