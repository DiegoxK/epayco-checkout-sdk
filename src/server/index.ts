import axios, { AxiosError } from "axios";

import type {
  EpaycoLoginResponse,
  EpaycoPaymentDetails,
  EpaycoSessionRequestBody,
  EpaycoSessionApiResponse,
  CreateEpaycoSessionConfig,
  EpaycoSessionApiErrorResponse,
  EpaycoExtras,
} from "./types";

const DEFAULT_EPAYCO_API_BASE_URL = "https://apify.epayco.co"; // User should verify/configure if the api url changes
const LOGIN_PATH = "/login";
const CREATE_SESSION_PATH = "/payment/session/create";

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
      {}, // Empty body for https://apify.epayco.co
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    // console.log(
    //   "EpaycoLoginResponse DATA:",
    //   JSON.stringify(response.data, null, 2)
    // ); //For debugging the response

    // Retrive token
    if (response.data && response.data.token) {
      // Success path
      return response.data.token;
    } else {
      // Error path
      const errorMessage =
        response.data?.error ||
        response.data?.textResponse ||
        response.data?.titleResponse ||
        response.data?.message ||
        "Failed to authenticate with ePayco: Invalid token or error response.";
      console.error("ePayco Auth Error Details:", response.data);
      throw new Error(`ePayco Authentication Failed: ${errorMessage}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<EpaycoLoginResponse>;
      console.error(
        "ePayco Auth Axios Error:",
        axiosError.response?.data || axiosError.message
      );
      const serverMessage =
        axiosError.response?.data?.message ||
        "Network error or ePayco server issue during authentication.";
      throw new Error(`ePayco Authentication Failed: ${serverMessage}`);
    }
    console.error("ePayco Auth Unknown Error:", error);
    throw new Error(
      `ePayco Authentication Failed: ${(error as Error).message}`
    );
  }
}

function mapPaymentDetailsToEpaycoRequest(
  details: EpaycoPaymentDetails,
  isTestMode: boolean
): EpaycoSessionRequestBody {
  // Construct an intermediate object where all values will be strings
  const stringifiedPayload: Record<string, any> = {
    test: String(isTestMode).toLowerCase(), // "true" or "false" as a string despite docs saying otherwise 💀
    ip: String(details.ip),
    name: String(details.name),
    description: String(details.description),
    currency: String(details.currency).toUpperCase(),
    amount: String(details.amount), // Ensure amount is a string
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

export async function createEpaycoSession(
  config: CreateEpaycoSessionConfig
): Promise<string> {
  const {
    publicKey,
    privateKey,
    paymentDetails,
    isTestMode,
    epaycoApiBaseUrl = DEFAULT_EPAYCO_API_BASE_URL,
  } = config;

  if (!publicKey || !privateKey) {
    throw new Error("ePayco Public Key and Private Key are required.");
  }
  if (!paymentDetails) {
    throw new Error("Payment details are required.");
  }

  // Extra validation can be put here if needed.

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

    // console.log(
    //   "EpaycoSessionApiResponse DATA:",
    //   JSON.stringify(response.data, null, 2)
    // );//For debugging the response if needed

    if (response.data.success === true) {
      // Retrive session
      return response.data.data.sessionId;
    } else {
      // Error path
      let errorMessage =
        response.data.textResponse ||
        response.data.titleResponse ||
        "ePayco session creation failed.";

      // Append specific field errors if available
      if (
        response.data.data &&
        response.data.data.errors &&
        response.data.data.errors.length > 0
      ) {
        const fieldErrors = response.data.data.errors
          .map((err) => `${err.errorMessage} (code: ${err.codError})`)
          .join(", ");
        errorMessage += ` Details: ${fieldErrors}`;
      }

      console.error("ePayco Session Creation Error Details:", response.data);
      throw new Error(`ePayco Session Creation Failed: ${errorMessage}`);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<EpaycoSessionApiErrorResponse>;
      const errorData = axiosError.response?.data;
      console.error(
        "ePayco Session Creation Axios Error Data:",
        JSON.stringify(errorData, null, 2)
      );

      let serverMessage =
        errorData?.textResponse ||
        errorData?.titleResponse ||
        "Network error or ePayco server issue during session creation.";
      if (
        errorData?.data &&
        errorData.data.errors &&
        errorData.data.errors.length > 0
      ) {
        const fieldErrors = errorData.data.errors
          .map((err) => `${err.errorMessage} (code: ${err.codError})`)
          .join(", ");
        serverMessage += ` Details: ${fieldErrors}`;
      }
      throw new Error(`ePayco Session Creation Failed: ${serverMessage}`);
    }
    console.error("ePayco Session Creation Unknown Error:", error);
    throw new Error(
      `ePayco Session Creation Failed: ${(error as Error).message}`
    );
  }
}

// type exports
export type {
  EpaycoLoginResponse,
  EpaycoPaymentDetails,
  EpaycoSessionRequestBody,
  EpaycoSessionApiResponse,
  CreateEpaycoSessionConfig,
  EpaycoSessionApiErrorResponse,
};
