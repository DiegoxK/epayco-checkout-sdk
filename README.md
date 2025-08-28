# ePayco Checkout Community SDK

[![npm version](https://badge.fury.io/js/epayco-checkout-community-sdk.svg)](https://badge.fury.io/js/epayco-checkout-community-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A client and server SDK for Node.js and browser environments designed to simplify the integration of ePayco's [**checkout process**](https://docs.epayco.com/docs/metodos-de-integracion). This SDK handles session creation, client-side checkout invocation, and provides helpers for validating ePayco's confirmation webhook signatures.

<img width="1360" height="768" alt="{41DB9C52-0316-43A6-8B32-904E04D56D6E}" src="https://github.com/user-attachments/assets/fe0e02bc-3c0f-4f1f-af3e-ac2ed61a2a95" />

### Disclaimer

This is a community-driven SDK and is **not officially affiliated with, endorsed by, or supported by ePayco**. It was initially developed for personal use and has been expanded based on direct testing and "reverse engineering" of ePayco's APIs, as the official documentation for the V2 checkout session flow was found to be inconsistent or lacking in certain areas.

While this SDK aims to be accurate, **ePayco may update their APIs or `checkout.js` library at any time**, which could affect the functionality of this SDK without notice. If ePayco releases an official, comprehensive SDK for their checkout process, that would likely become the recommended solution.

For other ePayco services (Customers, Plans, Subscriptions, PSE, Cash payments, etc.), please refer to ePayco's official Node SDK: [epayco/epayco-node](https://github.com/epayco/epayco-node).

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [The ePayco Checkout Flow: An Overview](#the-epayco-checkout-flow-an-overview)
- [Server-Side Usage (`epayco-checkout-community-sdk/server`)](#server-side-usage-epayco-checkout-community-sdkserver)
  - [A. Creating a Payment Session (`createEpaycoSession`)](#a-creating-a-payment-session-createepaycosession)
  - [B. Handling the Confirmation Webhook (`validateEpaycoSignature`)](#b-handling-the-confirmation-webhook-validateepaycosignature)
- [Client-Side Usage (`epayco-checkout-community-sdk`)](#client-side-usage-epayco-checkout-community-sdk)
  - [A. Opening the ePayco Checkout (`openEpaycoCheckout`)](#a-opening-the-epayco-checkout-openepaycocheckout)
  - [B. Using Client-Side Event Handlers](#b-using-client-side-event-handlers)
- [Your Responsibility: Implementing the `responseUrl` Page](#your-responsibility-implementing-the-responseurl-page)
- [Security Best Practices](#security-best-practices)
- [API Reference (Key Types)](#api-reference-key-types)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- Facilitates server-side payment session creation with ePayco's API.
- Handles ePayco API authentication (JWT generation).
- Automatically stringifies payment details as required by ePayco's session creation endpoint.
- Provides client-side utilities to load ePayco's `checkout.js` and invoke the checkout UI.
- Offers Type-Safe interfaces for all interactions (TypeScript).
- Includes a helper function to validate ePayco's confirmation webhook signatures.
- Supports passing `extra1` through `extra10` parameters to ePayco.

## Prerequisites

- An active ePayco merchant account.
- Your ePayco API Keys, which you can find in your ePayco dashboard:
  - `PUBLIC_KEY` & `PRIVATE_KEY` (for API authentication)
  - `P_CUST_ID_CLIENTE` & `P_KEY` (for signature validation)

## Installation

```bash
npm install epayco-checkout-community-sdk
# or
yarn add epayco-checkout-community-sdk
# or
pnpm add epayco-checkout-community-sdk
```

## The ePayco Checkout Flow: An Overview

Integrating ePayco's checkout involves several steps. This SDK assists with steps 2, 3, and part of 6.

1.  **User Action:** A user on your website decides to purchase a product or service.
2.  **Your Backend (using SDK):** Your application's backend server uses `createEpaycoSession` to communicate with ePayco and generate a unique `sessionId` for the transaction. **Crucially, your backend must be the source of truth for the price and product details.**
3.  **Your Frontend (using SDK):** The `sessionId` is sent from your backend to your frontend. Your frontend then uses `openEpaycoCheckout` to launch ePayco's secure payment interface (either as a modal/iframe or an external page).
4.  **ePayco UI:** The user interacts directly with ePayco's interface to enter their payment details. This SDK does not control this part of the experience.
5.  **User Redirect (`responseUrl` - You Implement):** After the payment attempt, ePayco redirects the user's browser to your `responseUrl`. Your application's page at this URL is responsible for providing immediate feedback to the user by validating the transaction status with ePayco.
6.  **Webhook Confirmation (`confirmationUrl` - You Implement):** ePayco sends a server-to-server request to your `confirmationUrl`. This is the **authoritative confirmation** of the transaction's status. Your backend endpoint must validate the request's signature using `validateEpaycoSignature` and then securely process the order.

## Server-Side Usage (`epayco-checkout-community-sdk/server`)

### A. Creating a Payment Session (`createEpaycoSession`)

Use this function on your backend to initialize a payment.

> **IMPORTANT SECURITY NOTE:** To prevent price tampering, your backend **must not** trust the `amount` sent from the client. Instead, use an identifier (like a product ID or SKU) sent from the client to look up the correct price in your own database. Use that server-verified price to create the payment session.

```typescript
// Example: In a Next.js API Route (/app/api/create-session/route.ts)
import {
  createEpaycoSession,
  type EpaycoPaymentDetails,
  type CreateEpaycoSessionConfig,
} from "epayco-checkout-community-sdk/server";

export async function POST(req: Request) {
  try {
    // In a real app, you'd get a productId or cartId from the client
    // const { productId } = await req.json();
    // const product = await getProductFromDb(productId); // Fetch from your DB
    // const amount = product.price;

    const paymentDetails: EpaycoPaymentDetails = {
      name: "My Awesome Product", // From your DB
      description: "Subscription to premium features", // From your DB
      amount: 50000, // From your DB
      currency: "COP",
      country: "CO",
      lang: "ES",
      ip: "190.1.2.3", // Customer's public IP address (required)
      confirmationUrl: `https://yourdomain.com/api/epayco-confirmation`,
      responseUrl: `https://yourdomain.com/checkout/response`,
      billing: {
        name: "John Doe",
        email: "john.doe@example.com",
        address: "123 Main St, Anytown",
        typeDoc: "CC",
        numberDoc: "123456789",
        mobilePhone: "3001234567",
      },
      extras: {
        // Optional: Pass your internal OrderID, UserID, etc.
        extra1: "OrderID-12345",
      },
      invoice: "INV-12345", // Your internal invoice number
    };

    // Before creating the session, create a transaction record in your DB
    // with status 'PENDING' and the authoritative amount.
    // await createPendingTransactionInDb({ orderId: "OrderID-12345", amount: 50000 });

    const sessionConfig: CreateEpaycoSessionConfig = {
      publicKey: process.env.EPAYco_PUBLIC_KEY!,
      privateKey: process.env.EPAYCO_PRIVATE_KEY!,
      paymentDetails,
      isTestMode: process.env.NODE_ENV !== "production",
    };

    const sessionId = await createEpaycoSession(sessionConfig);

    return new Response(JSON.stringify({ sessionId }), { status: 200 });
  } catch (error: any) {
    console.error("ePayco SDK: Session creation error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
```

### B. Handling the Confirmation Webhook (`validateEpaycoSignature`)

This is the most critical backend step for security and order fulfillment. ePayco sends a POST request with data as **URL query parameters** to your `confirmationUrl`.

```typescript
// Example: In your confirmation endpoint (/app/api/epayco-confirmation/route.ts)
import {
  validateEpaycoSignature,
  type EpaycoConfirmationData,
  type EpaycoSignatureConstructionData,
} from "epayco-checkout-community-sdk/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const queryParams = req.nextUrl.searchParams;
  const epaycoData = Object.fromEntries(
    queryParams
  ) as unknown as EpaycoConfirmationData;

  // --- 1. Signature Validation (CRITICAL) ---
  const signatureData: EpaycoSignatureConstructionData = {
    p_cust_id_cliente: process.env.EPAYCO_P_CUST_ID_CLIENTE!,
    p_key: process.env.EPAYCO_P_KEY!,
    x_ref_payco: epaycoData.x_ref_payco,
    x_transaction_id: epaycoData.x_transaction_id,
    x_amount: epaycoData.x_amount,
    x_currency_code: epaycoData.x_currency_code,
  };

  if (!validateEpaycoSignature(epaycoData.x_signature, signatureData)) {
    console.error("ePayco Confirmation: Invalid signature.");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
    });
  }

  // --- 2. Business Logic Validation (CRITICAL) ---
  // Fetch your internal order using a reference (e.g., from x_id_factura or an extra field)
  // const internalOrder = await getOrderFromDb(epaycoData.x_extra1); // e.g., "OrderID-12345"
  // if (!internalOrder || parseFloat(internalOrder.amount) !== parseFloat(epaycoData.x_amount)) {
  //   console.error(`ePayco Confirmation: Amount or Order mismatch for invoice ${epaycoData.x_id_factura}.`);
  //   return new Response(JSON.stringify({ error: "Order data mismatch" }), { status: 400 });
  // }

  // --- 3. Process Based on Transaction Status ---
  // x_cod_response: 1=Aceptada, 2=Rechazada, 3=Pendiente, 4=Fallida
  switch (epaycoData.x_cod_response) {
    case "1": // Transaction Aceptada (Accepted)
      // Mark order as paid, fulfill services, send success email, etc.
      // Make this process idempotent (check if already processed).
      console.log(`Transaction ${epaycoData.x_ref_payco} accepted.`);
      break;
    // ... handle other cases (2, 3, 4) ...
  }

  // Acknowledge receipt to ePayco to prevent retries.
  return new Response(JSON.stringify({ message: "Confirmation received" }), {
    status: 200,
  });
}
```

## Client-Side Usage (`epayco-checkout-community-sdk`)

Use this part of the SDK in your frontend to display the checkout.

### A. Opening the ePayco Checkout (`openEpaycoCheckout`)

```typescript
import {
  openEpaycoCheckout,
  type OpenEpaycoCheckoutParams,
} from "epayco-checkout-community-sdk";

// Example in a React component
async function handlePayment() {
  // 1. Fetch sessionId from your backend
  const response = await fetch("/api/create-session", {
    method: "POST" /* body */,
  });
  const { sessionId, error: sessionError } = await response.json();

  if (sessionError) {
    console.error("Failed to get session ID:", sessionError);
    return;
  }

  // 2. Open ePayco Checkout
  const params: OpenEpaycoCheckoutParams = {
    sessionId: sessionId,
    external: false, // `false` for iframe/modal, `true` for external page
  };

  try {
    const handler = await openEpaycoCheckout(params);
    // You can now attach event listeners to the handler (see below)
  } catch (error: any) {
    console.error("ePayco SDK: Failed to open checkout:", error.message);
  }
}
```

### B. Using Client-Side Event Handlers

The `handler` object returned by `openEpaycoCheckout` allows you to subscribe to events for better UX and debugging.

```typescript
// ... inside handlePayment after getting the handler
const handler = await openEpaycoCheckout(params);

handler.onCreated((data) => {
  console.log("ePayco UI Created:", data.transactionId);
});

handler.onResponse((data) => {
  console.log("ePayco Client-Side Response:", data.estado);
  // Provides immediate feedback before the user is redirected.
  // Useful for showing a quick "Payment Accepted, redirecting..." message.
});

handler.onClosed((data) => {
  console.log("ePayco Checkout Closed by user.");
  // Useful for `external: false` mode to re-enable your form.
});
```

## Your Responsibility: Implementing the `responseUrl` Page

After the payment attempt, the user is redirected to your `responseUrl`. This page must provide them with clear feedback.

**Steps:**

1.  Extract the `ref_payco` from the URL query parameters.
2.  Make a GET request to ePayco's validation endpoint: `https://secure.epayco.co/validation/v1/reference/{ref_payco}`.
3.  Use the response to display a success, failure, or pending message.

**Note:** Fulfill orders based on the `confirmationUrl` webhook, not this page. This page is for user experience only.

```typescript
// Conceptual example for a Next.js page at `/checkout/response`
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EpaycoValidationApiResponse } from 'epayco-checkout-community-sdk/server';

export default function CheckoutResponsePage() {
  const searchParams = useSearchParams();
  const ref_payco = searchParams.get('ref_payco');
  const [message, setMessage] = useState("Verificando estado del pago...");

  useEffect(() => {
    if (ref_payco) {
      fetch(`https://secure.epayco.co/validation/v1/reference/${ref_payco}`)
        .then(res => res.json())
        .then((result: EpaycoValidationApiResponse) => {
          if (result.success && result.data) {
            switch (result.data.x_cod_respuesta) {
              case 1: setMessage("¡Gracias! Tu pago fue aceptado."); break;
              case 2: setMessage("Tu pago fue rechazado."); break;
              case 3: setMessage("Tu pago está pendiente de confirmación."); break;
              default: setMessage("Hubo un problema con tu pago. Por favor, contacta a soporte.");
            }
          } else {
            throw new Error(result.text_response || "Falló la validación.");
          }
        })
        .catch(err => setMessage(`Error al verificar el pago: ${err.message}`));
    } else {
      setMessage("No se encontró una referencia de pago para validar.");
    }
  }, [ref_payco]);

  return (
    <div>
      <h1>Estado de tu Compra</h1>
      <p>{message}</p>
    </div>
  );
}
```

## Security Best Practices

- **Never trust client-side data for pricing.** Always calculate and validate amounts on your server.
- **Keep all secret keys (`PRIVATE_KEY`, `P_KEY`, `P_CUST_ID_CLIENTE`) on your server.** Never expose them in frontend code.
- **Always validate the `x_signature`** on your `confirmationUrl`. This is your primary defense against fraudulent requests.
- **Always validate the `x_amount` and `x_id_factura`** from the confirmation against your database records before fulfilling an order.
- **Design your `confirmationUrl` endpoint to be idempotent** to handle potential webhook retries from ePayco safely.

## API Reference (Key Types)

This SDK exports several TypeScript types to help with your integration.

**Server-Side (`epayco-checkout-community-sdk/server`):**

- `CreateEpaycoSessionConfig`: Configuration for `createEpaycoSession`.
- `EpaycoPaymentDetails`: Input details for a payment session.
- `EpaycoConfirmationData`: Type for the data ePayco sends to your `confirmationUrl`.
- `EpaycoSignatureConstructionData`: Input for `validateEpaycoSignature`.
- `EpaycoValidationApiResponse`: Type for ePayco's transaction validation endpoint response.

**Client-Side (`epayco-checkout-community-sdk`):**

- `OpenEpaycoCheckoutParams`: Input for `openEpaycoCheckout`.
- `EpaycoNativeCheckoutHandler`: The handler object returned by `openEpaycoCheckout`.
- `EpaycoCheckoutCreatedData`, `EpaycoCheckoutResponseData`, `EpaycoCheckoutCloseData`: Data types for the client-side event handlers.

## Troubleshooting

- **Authentication Errors:** Double-check your `PUBLIC_KEY` and `PRIVATE_KEY`.
- **Session Creation Failed:** Verify all required fields in `EpaycoPaymentDetails` (especially `ip`) and ensure your URLs are valid. Check your server logs for detailed errors from the SDK.
- **Signature Validation Failure:** Ensure you are using the correct `P_CUST_ID_CLIENTE` and `P_KEY`. Verify the fields used to construct the signature string exactly match what ePayco sent.
- **`confirmationUrl` Not Being Called:** Check for firewall issues and ensure the URL is publicly accessible.

## Contributing

Contributions are welcome! This SDK was created to solve a real-world integration challenge and relies on community findings. If you find a bug, have a suggestion, or want to improve documentation, please feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
