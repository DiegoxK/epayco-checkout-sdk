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

// Epayco document types obtained from: https://docs.epayco.com/v1/docs/paginas-de-respuestas#tipos-de-documentos
type EpaycoDocTypes =
  | "NIT"
  | "CC"
  | "CE"
  | "TI"
  | "PPN"
  | "SSN"
  | "LIC"
  | "DNI";

// For the billing object in the session creation request
export interface EpaycoBillingDetails {
  email: string;
  name: string;
  address: string;
  typeDoc: EpaycoDocTypes;
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

export type EpaycoExtras =
  | "extra1"
  | "extra2"
  | "extra3"
  | "extra4"
  | "extra5"
  | "extra6"
  | "extra7"
  | "extra8"
  | "extra9"
  | "extra10"
  | "extra11";

export type EpaycoExtrasEpayco =
  | "extra1"
  | "extra2"
  | "extra3"
  | "extra4"
  | "extra5"
  | "extra6"
  | "extra7"
  | "extra8"
  | "extra9"
  | "extra10"
  | "extra11"
  | "extra12"
  | "extra13"
  | "extra14"
  | "extra15"
  | "extra16"
  | "extra17"
  | "extra18"
  | "extra19"
  | "extra20";

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
  emailBilling?: string;
  nameBilling?: string;
  addressBilling?: string;
  typeDocBilling?: string;
  numberDocBilling?: string;
  mobilephoneBilling?: string;

  // Optional fields
  invoice?: string;
  taxBase?: number;
  tax?: number;
  taxIco?: number;
  methodsDisable?: string[];
  splitPayment?: EpaycoSplitPayment;
  extras?: Partial<Record<EpaycoExtras, string>>; // For extra1 to extra11
  extrasEpayco?: Partial<Record<EpaycoExtrasEpayco, string>>; // For extra1 to extra20
}

// The actual request body sent to ePayco for session creation
export interface EpaycoSessionRequestBody {
  test: string;
  ip: string;
  name: string;
  description: string;
  currency: string;
  amount: string;
  country: string;
  lang: string;
  taxBase?: string;
  tax?: string;
  taxIco?: string;
  methodsDisable?: string[];
  // method?: "POST"; // Seems like a fixed value, maybe not needed
  // config?: {}; // Empty in example, handle if needed
  // acepted?: string; // URLs, usually covered by responseUrl
  // pending?: string; // URLs
  // rejected?: string; // URLs
  response: string;
  confirmation: string;
  splitPayment?: EpaycoSplitPayment;
  extras?: Record<string, string>;
  extrasEpayco?: Record<string, string>;
  billing: EpaycoBillingDetails;
  checkout_version: "2"; // does this even work?
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
