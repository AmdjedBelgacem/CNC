# Vendored Moyasar Payment Form

Copied from the npm package `moyasar-payment-form@2.3.0` (MIT, see `LICENSE.md`),
so checkout does not depend on Moyasar's CDN staying up.

## Why this is here

`cdn.moyasar.com` returned `403 AccessDenied` from CloudFront on **every** path, for every
client, while `api.moyasar.com` and `moyasar.com` served normally. The vendor's CDN going
down took the entire checkout flow with it. Serving the SDK from our own origin removes that
single point of failure.

## Updating

    npm pack moyasar-payment-form@<version>
    tar xzf moyasar-payment-form-<version>.tgz
    cp package/dist/moyasar.umd.js package/dist/moyasar.css .

Then update `MOYASAR_SDK_VERSION` and the integrity hash in
`src/app/(main)/(store)/checkout/page.tsx`.

## Provenance caveat

This package is published by a third party (Railwaymen Team), not by Moyasar Financial. It is
MIT licensed and its bundle talks to `api.moyasar.com`, and it was verified to render a working
card form, but it is not an official Moyasar artifact. Re-check provenance on each upgrade, and
prefer the vendor CDN once their outage is resolved.

## API note

The SDK exposes `Moyasar.init(config)` and `Moyasar.setAmount(amount)`. It does **not** have
`createPaymentForm` — that method belongs to QIWI, ConnexPay and myPOS, not Moyasar.
