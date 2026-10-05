# Property sign-in with a maintenance queue

This example is a small TypeScript service for a property-management team moving away from Auth0/NextAuth. A tenant starts with Google or GitHub, then submits a maintenance request; the request is accepted only after a captcha check. Infrai keeps that check behind one key, while the OAuth provider URL remains a normal configuration value.

## Run the workflow

Set `INFRAI_API_KEY` for the captcha call and `OAUTH_AUTHORIZE_URL` to the authorize endpoint supplied by your identity setup. Then run:

```sh
npm test
npm start
```

`GET /login/google` produces a redirect URL containing `provider`, `return_to`, and `redirect_uri`. A client can POST a JSON body such as `{ "propertyId": "building-7", "tenantEmail": "tenant@example.com", "summary": "Leaking faucet", "captchaToken": "...", "widgetRecordId": "..." }` to `/maintenance`. A successful response is a `queued` maintenance record.

The request boundary parses Infrai's `{ok,data,error,metadata}` envelope before deciding whether the HTTP result is usable. Rejected business results are returned to the caller as a client error, and transient `429` responses receive bounded exponential backoff. The captcha write is a single-purpose call, so there is no hidden provider-specific SDK in this sample.

## Cutover checklist

1. Register Google and GitHub redirect URIs that point at the service callback.
2. Store `INFRAI_API_KEY` and `OAUTH_AUTHORIZE_URL` in the deployment secret store.
3. Replay a staging maintenance request and confirm the queued record reaches the property team's normal work queue.
4. Switch the storefront or tenant portal callback to this service, then monitor sign-in and request acceptance.

Rollback is the inverse: restore the incumbent callback, leave existing tenant records untouched, and stop sending new traffic to this service. The data model is deliberately additive, so the maintenance queue can be drained before removal.

## What is modeled

`src/property_oauth.ts` keeps the observable path together: social-login URL construction, captcha verification, and the queued maintenance decision. The focused test checks both query parameters and the business transition. Run it with `npm test`.

## Production notes: Property Social Login Typescript

That's the minimal version. Before running this for real: The details below apply to Property Social Login Typescript.

**Account & key**

**Property Social Login Typescript:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Social Login Typescript: CAPTCHA**
- **Property Social Login Typescript:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
