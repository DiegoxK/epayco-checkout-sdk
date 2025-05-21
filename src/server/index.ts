import axios, { AxiosError } from "axios";
import { createHash } from "crypto";

import type {
  // Core types for session creation
  EpaycoPaymentDetails,
  CreateEpaycoSessionConfig,
  EpaycoSessionRequestBody,
  EpaycoSessionApiResponse,
  EpaycoSessionApiErrorResponse,
  EpaycoLoginResponse,
  EpaycoExtras, // Used internally by mapPaymentDetailsToEpaycoRequest

  // Types for confirmation handling
  EpaycoSignatureConstructionData,
  EpaycoConfirmationData, // User will import this for their endpoint
  EpaycoValidationApiResponse,
  EpaycoBillingDetails,
  EpaycoSplitPayment,
  EpaycoSplitReceiver,
  EpaycoTransactionValidationData,
  EpaycoSessionApiSuccessResponse, // User will import this for their response page
} from "./types";

// --- Constants ---
const DEFAULT_EPAYCO_API_BASE_URL = "https://apify.epayco.co";
const LOGIN_PATH = "/login";
const CREATE_SESSION_PATH = "/payment/session/create";

// --- Internal Helper Functions ---

/**
 * Authenticates with the ePayco API to obtain a JWT.
 * @internal
 * @param publicKey Merchant's ePayco Public Key.
 * @param privateKey Merchant's ePayco Private Key.
 * @param apiBaseUrl Base URL for the ePayco API.
 * You can check on how to obtain this keys at: https://api.epayco.co/#c2b8717a-618c-4e62-a2e3-eb8d4aa6db7e
 * @returns A promise that resolves with the authentication token string.
 * @throws {Error} If authentication fails or an API error occurs.
 */
async function getEpaycoAuthToken(
  publicKey: string,
  privateKey: string,
  apiBaseUrl: string
): Promise<string> {
  const authUrl = `${apiBaseUrl}${LOGIN_PATH}`;
  try {
    const credentials = Buffer.from(`${publicKey}:${privateKey}`).toString(
      "base64"
    );
    const response = await axios.post<EpaycoLoginResponse>(
      authUrl,
      {}, // ePayco login requires an empty body for this endpoint
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    if (response.data && response.data.token) {
      return response.data.token;
    } else {
      const errorFields = response.data || {};
      const errorMessage =
        errorFields.error ||
        errorFields.textResponse ||
        errorFields.titleResponse ||
        errorFields.message ||
        "Invalid token or unknown error response during authentication.";
      console.error(
        "ePayco SDK: Authentication API error details:",
        response.data
      );
      throw new Error(`ePayco Authentication Failed: ${errorMessage}`);
    }
  } catch (error) {
    let detailedMessage =
      "An unknown error occurred during ePayco authentication.";
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<EpaycoLoginResponse>;
      const errorData = axiosError.response?.data;
      console.error(
        "ePayco SDK: Axios error during authentication. Status:",
        axiosError.response?.status,
        "Data:",
        errorData || axiosError.message
      );
      const serverMessage =
        errorData?.message || // Prioritize message field in error data
        errorData?.error ||
        errorData?.textResponse ||
        axiosError.message || // Fallback to Axios's own message
        "Network error or ePayco server issue during authentication.";
      detailedMessage = `ePayco Authentication Failed: ${serverMessage}`;
    } else if (error instanceof Error) {
      console.error(
        "ePayco SDK: Non-Axios error during authentication:",
        error
      );
      detailedMessage = `ePayco Authentication Failed: ${error.message}`;
    } else {
      console.error(
        "ePayco SDK: Unknown error object during authentication:",
        error
      );
    }
    throw new Error(detailedMessage);
  }
}

/**
 * Maps the user-friendly `EpaycoPaymentDetails` to the string-based `EpaycoSessionRequestBody`
 * required by the ePayco API, including root-level billing and extra fields.
 * trying to send values like test:true as a boolean and not an string causes the api to reject the request
 * so the main purpose of this function was to map every value into an string
 * @internal
 * @param details The payment details provided by the SDK user.
 * @param isTestMode Boolean indicating if the transaction is in test mode.
 * @returns The request body object ready to be sent to ePayco.
 */
function mapPaymentDetailsToEpaycoRequest(
  details: EpaycoPaymentDetails,
  isTestMode: boolean
): EpaycoSessionRequestBody {
  const stringifiedPayload: Record<string, any> = {
    test: String(isTestMode).toLowerCase(), // "true" or "false" as a string despite docs saying otherwise 💀
    ip: String(details.ip),
    name: String(details.name),
    description: String(details.description),
    currency: String(details.currency).toUpperCase(),
    amount: String(details.amount),
    country: String(details.country).toUpperCase(),
    lang: String(details.lang).toUpperCase(),
    response: String(details.responseUrl),
    confirmation: String(details.confirmationUrl),
    checkout_version: "2",

    // Ensure billing details are also stringified
    billing: {
      email: String(details.billing.email),
      name: String(details.billing.name),
      address: String(details.billing.address),
      typeDoc: String(details.billing.typeDoc),
      numberDoc: String(details.billing.numberDoc),
      mobilePhone: String(details.billing.mobilePhone),
      ...(details.billing.callingCode !== undefined && {
        callingCode: String(details.billing.callingCode),
      }),
    },

    // root-level billing fields
    nameBilling: String(details.billing.name),
    emailBilling: String(details.billing.email),
    addressBilling: String(details.billing.address),
    typeDocBilling: String(details.billing.typeDoc),
    numberDocBilling: String(details.billing.numberDoc),
    mobilephoneBilling: String(details.billing.mobilePhone),

    // Optional fields - ensures their values are also stringified if present
    ...(details.invoice !== undefined && { invoice: String(details.invoice) }),
    ...(details.taxBase !== undefined && { taxBase: String(details.taxBase) }),
    ...(details.tax !== undefined && { tax: String(details.tax) }),
    ...(details.taxIco !== undefined && { taxIco: String(details.taxIco) }),
    ...(details.methodsDisable &&
      details.methodsDisable.length > 0 && {
        methodsDisable: details.methodsDisable.map(String),
      }),

    // Split Payment: Amounts and other numbers within splitPayment also need to be strings
    ...(details.splitPayment && {
      splitPayment: {
        type: String(details.splitPayment.type),
        receivers: details.splitPayment.receivers.map((receiver) => ({
          merchantId: String(receiver.merchantId),
          amount: String(receiver.amount),
          ...(receiver.taxBase !== undefined && {
            taxBase: String(receiver.taxBase),
          }),
          ...(receiver.tax !== undefined && { tax: String(receiver.tax) }),
          ...(receiver.fee !== undefined && { fee: String(receiver.fee) }),
        })),
      },
    }),
  };

  if (details.extras) {
    for (let i = 1; i <= 10; i++) {
      const key = `extra${i}` as keyof EpaycoExtras;
      if (details.extras[key] !== undefined && details.extras[key] !== null) {
        stringifiedPayload[key] = String(details.extras[key]);
      }
    }
  }

  return stringifiedPayload as EpaycoSessionRequestBody;
}

// --- Exported SDK Functions ---

/**
 * Creates an ePayco payment session.
 * This function communicates with the ePayco API to initialize a transaction.
 *
 * @param config Configuration object containing API keys, payment details, and test mode flag.
 * @returns A promise that resolves with the ePayco `sessionId` string.
 * @throws {Error} If required configuration is missing, authentication fails,
 * or the ePayco API returns an error during session creation.
 *
 * @example
 * ```typescript
 * const paymentDetails = {
 *   name: "Test Product",
 *   description: "A product for testing",
 *   currency: "COP",
 *   amount: 50000,
 *   country: "CO",
 *   lang: "ES",
 *   ip: "190.0.0.1",
 *   confirmationUrl: "https://myapp.com/api/epayco-confirmation",
 *   responseUrl: "https://myapp.com/checkout/response",
 *   billing: {
 *     name: "John Doe",
 *     email: "john.doe@example.com",
 *     address: "123 Main St",
 *     typeDoc: "CC",
 *     numberDoc: "123456789",
 *     mobilePhone: "3001234567"
 *   },
 *   extras: {
 *     extra1: "customValue1"
 *   }
 * };
 *
 * const sessionConfig = {
 *   publicKey: "YOUR_EPAYCO_PUBLIC_KEY",
 *   privateKey: "YOUR_EPAYCO_PRIVATE_KEY",
 *   paymentDetails,
 *   isTestMode: true,
 * };
 *
 * try {
 *   const sessionId = await createEpaycoSession(sessionConfig);
 *   console.log("ePayco Session ID:", sessionId);
 *   // Use this sessionId with the client-side SDK's openEpaycoCheckout
 * } catch (error) {
 *   console.error("Failed to create ePayco session:", error);
 * }
 * ```
 */
export async function createEpaycoSession(
  config: CreateEpaycoSessionConfig
): Promise<string> {
  const {
    publicKey,
    privateKey,
    paymentDetails,
    isTestMode,
    epaycoApiBaseUrl = DEFAULT_EPAYCO_API_BASE_URL, // Use default if not provided
  } = config;

  // Validate required configuration
  if (!publicKey || !privateKey) {
    throw new Error(
      "ePayco SDK: Public Key and Private Key are required in CreateEpaycoSessionConfig."
    );
  }
  if (!paymentDetails) {
    throw new Error(
      "ePayco SDK: Payment details (paymentDetails) are required in CreateEpaycoSessionConfig."
    );
  }
  // Add more specific validation for paymentDetails fields if desired (e.g., amount > 0)

  try {
    const authToken = await getEpaycoAuthToken(
      publicKey,
      privateKey,
      epaycoApiBaseUrl
    );

    const sessionCreateFullUrl = `${epaycoApiBaseUrl}${CREATE_SESSION_PATH}`;
    const requestBody = mapPaymentDetailsToEpaycoRequest(
      paymentDetails,
      isTestMode
    );

    const response = await axios.post<EpaycoSessionApiResponse>(
      sessionCreateFullUrl,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    // Check for successful session creation based on ePayco's 'success' flag
    if (response.data.success === true && response.data.data?.sessionId) {
      return response.data.data.sessionId;
    } else {
      // Handle structured errors from ePayco if present
      let errorMessage = "ePayco session creation failed.";
      const errorResponse = response.data as EpaycoSessionApiErrorResponse;

      if (errorResponse.textResponse || errorResponse.titleResponse) {
        errorMessage =
          errorResponse.textResponse ||
          errorResponse.titleResponse ||
          errorMessage;
      }

      if (errorResponse.data?.errors && errorResponse.data.errors.length > 0) {
        const fieldErrors = errorResponse.data.errors
          .map((err) => `${err.errorMessage} (field code: ${err.codError})`)
          .join(", ");
        errorMessage += ` Details: ${fieldErrors}`;
      }
      console.error(
        "ePayco SDK: Session Creation API error details:",
        response.data
      );
      throw new Error(`ePayco Session Creation Failed: ${errorMessage}`);
    }
  } catch (error) {
    let detailedMessage =
      "An unknown error occurred during ePayco session creation.";
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<EpaycoSessionApiErrorResponse>;
      const errorData = axiosError.response?.data;
      console.error(
        "ePayco SDK: Axios error during session creation. Status:",
        axiosError.response?.status,
        "Data:",
        errorData || axiosError.message
      );

      let serverMessage =
        "Network error or ePayco server issue during session creation.";
      if (errorData) {
        serverMessage =
          errorData.textResponse || errorData.titleResponse || serverMessage;
        if (errorData.data?.errors && errorData.data.errors.length > 0) {
          const fieldErrors = errorData.data.errors
            .map((err) => `${err.errorMessage} (code: ${err.codError})`)
            .join(", ");
          serverMessage += ` Details: ${fieldErrors}`;
        }
      } else {
        serverMessage = axiosError.message || serverMessage;
      }
      detailedMessage = `ePayco Session Creation Failed: ${serverMessage}`;
    } else if (error instanceof Error) {
      // If it's an error we threw deliberately (e.g., from auth or config validation)
      // or an unexpected non-Axios error.
      console.error(
        "ePayco SDK: Non-Axios error during session creation:",
        error
      );
      detailedMessage =
        error.message.startsWith("ePayco SDK:") ||
        error.message.startsWith("ePayco Authentication Failed:") ||
        error.message.startsWith("ePayco Session Creation Failed:")
          ? error.message // Preserve our specific error messages
          : `ePayco Session Creation Failed: ${error.message}`;
    } else {
      console.error(
        "ePayco SDK: Unknown error object during session creation:",
        error
      );
    }
    throw new Error(detailedMessage);
  }
}

/**
 * Validates an ePayco signature received on the confirmation URL webhook.
 * This is crucial for verifying the authenticity of the confirmation data.
 *
 * @param receivedSignature The `x_signature` string received from ePayco in the confirmation payload.
 * @param constructionData An object containing all the necessary fields from the
 *                         ePayco confirmation data and the merchant's secret credentials
 *                         (`p_cust_id_cliente`, `p_key`) required to reconstruct the signature.
 * @returns `true` if the `receivedSignature` matches the calculated signature, `false` otherwise.
 *
 * @example
 * ```typescript
 * // In your ePayco confirmation endpoint (e.g., a Next.js API route)
 * // Assume `epaycoConfirmationPayload` is an object of type EpaycoConfirmationData
 * // and `merchantSecrets` contains your p_cust_id_cliente and p_key.
 *
 * const isValid = validateEpaycoSignature(
 *   epaycoConfirmationPayload.x_signature,
 *   {
 *     p_cust_id_cliente: merchantSecrets.p_cust_id_cliente,
 *     p_key: merchantSecrets.p_key,
 *     x_ref_payco: epaycoConfirmationPayload.x_ref_payco,
 *     x_transaction_id: epaycoConfirmationPayload.x_transaction_id,
 *     x_amount: epaycoConfirmationPayload.x_amount,
 *     x_currency_code: epaycoConfirmationPayload.x_currency_code,
 *   }
 * );
 *
 * if (isValid) {
 *   // Process the confirmed transaction
 * } else {
 *   // Signature is invalid, treat as suspicious
 * }
 * ```
 */
export function validateEpaycoSignature(
  receivedSignature: string,
  constructionData: EpaycoSignatureConstructionData
): boolean {
  const {
    p_cust_id_cliente,
    p_key,
    x_ref_payco,
    x_transaction_id,
    x_amount,
    x_currency_code,
  } = constructionData;

  if (
    !receivedSignature ||
    !p_cust_id_cliente ||
    !p_key ||
    !x_ref_payco ||
    !x_transaction_id ||
    x_amount === undefined ||
    x_amount === null || // Amount must be present (even if "0")
    !x_currency_code
  ) {
    console.error(
      "ePayco SDK: Missing required parameters for ePayco signature validation. Ensure all fields in EpaycoSignatureConstructionData and receivedSignature are provided."
    );
    return false;
  }

  const signatureString = `${p_cust_id_cliente}^${p_key}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;

  const calculatedSignature = createHash("sha256")
    .update(signatureString)
    .digest("hex");

  return calculatedSignature === receivedSignature;
}

// Selective type exports for SDK users.
// Users will primarily interact with these types when using the SDK.
export type {
  // Config and input types for creating a session
  CreateEpaycoSessionConfig,
  EpaycoPaymentDetails,
  EpaycoBillingDetails,
  EpaycoSplitPayment,
  EpaycoSplitReceiver,
  EpaycoExtras,

  // Types related to ePayco's confirmation webhook
  EpaycoConfirmationData,
  EpaycoSignatureConstructionData,

  // Types related to ePayco's transaction validation endpoint
  EpaycoValidationApiResponse,
  EpaycoTransactionValidationData,

  // Lower-level API response types (less commonly directly used by SDK consumers, but available)
  EpaycoLoginResponse,
  EpaycoSessionApiResponse,
  EpaycoSessionApiSuccessResponse,
  EpaycoSessionApiErrorResponse,
  EpaycoSessionRequestBody, // This is an internal type for the SDK
};
