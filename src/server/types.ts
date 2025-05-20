// /login endpoint response
export interface EpaycoLoginResponse {
  // Successful response fields
  token?: string; // Present on success

  // Error response fields (based on api error)
  error?: string; // Observed: "Invalid client: client is invalid"

  // ePayco has multiple error formats for login, but prioritize the above one.
  success?: boolean;
  status?: string;
  titleResponse?: string;
  textResponse?: string;
  message?: string;
}

// For the billing object in the session creation request
export interface EpaycoBillingDetails {
  email: string;
  name: string;
  address: string;
  typeDoc: string; //valid doc types: https://docs.epayco.com/v1/docs/paginas-de-respuestas#tipos-de-documentos
  numberDoc: string;
  callingCode?: string; // e.g., "+57"
  mobilePhone: string;
}

// For the splitPayment object
export interface EpaycoSplitReceiver {
  merchantId: number;
  amount: number;
  taxBase?: number;
  tax?: number;
  fee?: number;
}

export interface EpaycoSplitPayment {
  type: "percentage" | "fixed"; // Assuming 'fixed' is also an option
  receivers: EpaycoSplitReceiver[];
}

/* 
  Extras object for additional fields
  This is a flexible object to accommodate any extra fields
  You can later access this extra fields in your confirmation endpoint
*/
export interface EpaycoExtras {
  extra1?: string;
  extra2?: string;
  extra3?: string;
  extra4?: string;
  extra5?: string;
  extra6?: string;
  extra7?: string;
  extra8?: string;
  extra9?: string;
  extra10?: string;
}

// User-provided details for creating a session. https://api.epayco.co/#50550c23-522b-48bc-a8b4-b8aac33fe16f
export interface EpaycoPaymentDetails {
  // Required transaction info
  name: string; // Name of the product/service
  description: string; // Product/service description
  currency: string; // e.g., "COP", "USD"
  amount: number; // Amount (If your account is not verified there are some limits for this value)
  country: string; // e.g., "CO"
  lang: string; // e.g., "ES", "EN"
  ip: string; // User's IP address (Required to be a real public ip, even for testing)

  // URLs
  confirmationUrl: string; // Your backend URL for ePayco to send confirmation (Must point to an actual domain)
  responseUrl: string; // Your frontend URL where user is redirected (Must point to an actual domain)

  // Billing Information (apify docs tell us to send this billing object but it doesnt seems to pick them up for autofilling the checkout information, so we'll also be passing these root-level xxxBilling fields into the endpoint) https://api.epayco.co/#50550c23-522b-48bc-a8b4-b8aac33fe16f
  billing: EpaycoBillingDetails;

  // Optional fields
  invoice?: string;
  taxBase?: number;
  tax?: number;
  taxIco?: number;
  methodsDisable?: string[];
  splitPayment?: EpaycoSplitPayment;

  extras?: EpaycoExtras;
}

// The actual request body sent to ePayco for session creation
export interface EpaycoSessionRequestBody extends EpaycoExtras {
  test: string;
  ip: string;
  name: string;
  description: string;
  currency: string;
  amount: string;
  country: string;
  lang: string;
  response: string;
  confirmation: string;

  // Nested billing object
  billing: EpaycoBillingDetails;

  // Root-level
  nameBilling?: string;
  emailBilling?: string;
  addressBilling?: string;
  typeDocBilling?: string;
  numberDocBilling?: string;
  mobilephoneBilling?: string;

  // Other existing optional fields
  invoice?: string;
  taxBase?: string;
  tax?: string;
  taxIco?: string;
  methodsDisable?: string[];
  splitPayment?: EpaycoSplitPayment;

  // Version 2 of the api
  checkout_version: "2";
}

export interface EpaycoFieldError {
  codError: number; // e.g., 500
  errorMessage: string; // e.g., "field ip with invalid type"
  // Potentially other fields if they exist
}

export interface EpaycoSessionErrorData {
  totalErrors: number;
  errors: EpaycoFieldError[];
}

// For successful session creation
export interface EpaycoSessionSuccessData {
  sessionId: string;
  // Add any other fields if they appear within response.data on success
}

// Discriminated Union for the 'data' field
// type EpaycoSessionResponseDataPayload = EpaycoSessionSuccessData | EpaycoSessionErrorData;

// The overall API response for session creation
export interface EpaycoSessionApiResponseBase {
  success: boolean;
  titleResponse?: string;
  textResponse?: string;
  lastAction?: string;
}

export interface EpaycoSessionApiSuccessResponse
  extends EpaycoSessionApiResponseBase {
  success: true;
  data: EpaycoSessionSuccessData; // 'data' has sessionId on success
}

export interface EpaycoSessionApiErrorResponse
  extends EpaycoSessionApiResponseBase {
  success: false;
  data?: EpaycoSessionErrorData; // 'data' has error details on failure
  // Potentially other root-level error fields if they don't fit in 'data'
}

// This is the type the axios call will use.
export type EpaycoSessionApiResponse =
  | EpaycoSessionApiSuccessResponse
  | EpaycoSessionApiErrorResponse;

// Configuration for the SDK's createEpaycoSession function
export interface CreateEpaycoSessionConfig {
  publicKey: string; // ePayco PUBLIC_KEY
  privateKey: string; // ePayco PRIVATE_KEY
  paymentDetails: EpaycoPaymentDetails;
  isTestMode: boolean; // Will set the 'test' field in the session request

  epaycoApiBaseUrl?: string; // Base URL e.g., "https://api.secure.epayco.co"
}
