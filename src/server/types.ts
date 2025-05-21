/**
 * Response structure from the ePayco /login endpoint.
 */
export interface EpaycoLoginResponse {
  /** The authentication token, present on successful login. */
  token?: string;
  /** Error message if login fails (e.g., "Invalid client: client is invalid"). */
  error?: string;
  // ePayco may return other fields in error scenarios
  success?: boolean;
  status?: string;
  titleResponse?: string;
  textResponse?: string;
  message?: string;
}

/**
 * Billing details for an ePayco transaction.
 */
export interface EpaycoBillingDetails {
  /** Customer's email address. */
  email: string;
  /** Customer's full name. */
  name: string;
  /** Customer's billing address. */
  address: string;
  /**
   * Customer's document type.
   * Refer to ePayco documentation for valid types:
   * https://docs.epayco.com/v1/docs/paginas-de-respuestas#tipos-de-documentos
   */
  typeDoc: string;
  /** Customer's document number. */
  numberDoc: string;
  /** International calling code (e.g., "+57" for Colombia). Optional. */
  callingCode?: string;
  /** Customer's mobile phone number. */
  mobilePhone: string;
}

/**
 * Details for a receiver in a split payment.
 */
export interface EpaycoSplitReceiver {
  /** Merchant ID of the receiver. */
  merchantId: number;
  /** Amount to be transferred to this receiver. */
  amount: number;
  /** Taxable base for this receiver's portion. Optional. */
  taxBase?: number;
  /** Tax amount for this receiver's portion. Optional. */
  tax?: number;
  /** Fee associated with this receiver's portion. Optional. */
  fee?: number;
}

/**
 * Defines the structure for split payments.
 */
export interface EpaycoSplitPayment {
  /** Type of split, e.g., "percentage" or "fixed". */
  type: "percentage" | "fixed"; // Assuming 'fixed' is a valid option
  /** Array of receivers for the split payment. */
  receivers: EpaycoSplitReceiver[];
}

/**
 * Defines the structure for custom 'extra' parameters (extra1 to extra10).
 * These values will be converted to strings when sent to ePayco.
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

/**
 * User-provided details for creating an ePayco payment session.
 * All numeric and boolean values will be converted to strings before sending to ePayco.
 * Refer to ePayco API documentation for detailed field descriptions:
 * Note: The API documentation for checkout_version v2 appears to be inaccurate or not implemented yet.
 * These type definitions were obtains by "reverse engineering" the responses from epayco,
 * please take with a grain of salt.
 * https://api.epayco.co/#50550c23-522b-48bc-a8b4-b8aac33fe16f
 */
export interface EpaycoPaymentDetails {
  // Required transaction info
  name: string;
  description: string;
  currency: string; // e.g., "COP", "USD"
  amount: number; // Will be stringified
  country: string; // e.g., "CO"
  lang: string; // e.g., "ES", "EN"
  ip: string; // Customer's public IP address

  // URLs
  confirmationUrl: string; // Backend URL for ePayco's server-to-server confirmation
  responseUrl: string; // Frontend URL for user redirection after payment attempt

  // Billing Information (nested structure)
  billing: EpaycoBillingDetails;

  // Optional fields
  invoice?: string; // Invoice ID/number
  taxBase?: number; // Taxable base amount (will be stringified)
  tax?: number; // Tax amount (will be stringified)
  taxIco?: number; // ICO tax amount (will be stringified)
  methodsDisable?: string[]; // Payment methods to disable
  splitPayment?: EpaycoSplitPayment; // Split payment details

  /** Custom 'extra' parameters (extra1 to extra10). Values should be strings. */
  extras?: EpaycoExtras;
}

/**
 * Internal representation of the request body sent to ePayco for session creation.
 * All values here are strings, as required by the ePayco API.
 * This interface includes root-level billing and extra fields for compatibility.
 */
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
  checkout_version: "2";

  // Nested billing object (all values are strings)
  billing: {
    email: string;
    name: string;
    address: string;
    typeDoc: string;
    numberDoc: string;
    callingCode?: string;
    mobilePhone: string;
  };

  // Root-level billing fields for enhanced auto-population (all values are strings)
  nameBilling?: string;
  emailBilling?: string;
  addressBilling?: string;
  typeDocBilling?: string;
  numberDocBilling?: string;
  mobilephoneBilling?: string;

  // Other optional fields (all values are strings)
  invoice?: string;
  taxBase?: string;
  tax?: string;
  taxIco?: string;
  methodsDisable?: string[];
  splitPayment?: {
    // Ensure inner values are also strings
    type: string;
    receivers: Array<{
      merchantId: string;
      amount: string;
      taxBase?: string;
      tax?: string;
      fee?: string;
    }>;
  };
}

/**
 * Represents a field-specific error returned by the ePayco API.
 */
export interface EpaycoFieldError {
  codError: number;
  errorMessage: string;
}

/**
 * Structure of the 'data' field in an ePayco API error response for session creation.
 */
export interface EpaycoSessionErrorData {
  totalErrors: number;
  errors: EpaycoFieldError[];
}

/**
 * Structure of the 'data' field in a successful ePayco API response for session creation.
 */
export interface EpaycoSessionSuccessData {
  sessionId: string;
}

/**
 * Base structure for ePayco API responses regarding session creation.
 */
export interface EpaycoSessionApiResponseBase {
  success: boolean;
  titleResponse?: string;
  textResponse?: string;
  lastAction?: string;
}

/**
 * API response for a successful session creation.
 */
export interface EpaycoSessionApiSuccessResponse
  extends EpaycoSessionApiResponseBase {
  success: true;
  data: EpaycoSessionSuccessData;
}

/**
 * API response for a failed session creation.
 */
export interface EpaycoSessionApiErrorResponse
  extends EpaycoSessionApiResponseBase {
  success: false;
  data?: EpaycoSessionErrorData; // 'data' might contain error details
}

/**
 * Union type representing the possible API responses for session creation.
 */
export type EpaycoSessionApiResponse =
  | EpaycoSessionApiSuccessResponse
  | EpaycoSessionApiErrorResponse;

/**
 * Configuration for the SDK's `createEpaycoSession` function.
 */
export interface CreateEpaycoSessionConfig {
  /** Your ePayco Public Key. */
  publicKey: string;
  /** Your ePayco Private Key. */
  privateKey: string;
  /** Details of the payment to be processed. */
  paymentDetails: EpaycoPaymentDetails;
  /**
   * Set to `true` for test transactions, `false` for live transactions.
   * This sets the 'test' field in the ePayco session request.
   */
  isTestMode: boolean;
  /**
   * Optional base URL for the ePayco API.
   * Defaults to "https://apify.epayco.co" if not provided.
   * Useful if ePayco changes their API domain or for testing against a mock server.
   */
  epaycoApiBaseUrl?: string;
}

/**
 * Data structure of the payload ePayco sends to your `confirmationUrl`.
 * All `x_` prefixed values are typically strings.
 */
export interface EpaycoConfirmationData {
  x_cust_id_cliente: string;
  x_ref_payco: string;
  x_id_factura: string;
  x_id_invoice: string;
  x_description: string;
  x_amount: string;
  x_amount_country: string;
  x_amount_ok: string;
  x_tax: string;
  x_amount_base: string;
  x_currency_code: string;
  x_bank_name: string;
  x_cardnumber: string; // Masked
  x_quotas: string;
  x_respuesta: string; // "Aceptada", "Rechazada", "Pendiente", "Fallida", etc.
  x_response: string;
  x_approval_code: string;
  x_transaction_id: string;
  x_fecha_transaccion: string; // Format: "YYYY-MM-DD HH:MM:SS"
  x_transaction_date: string;
  x_cod_respuesta: string; // e.g., "1", "2", "3", "4"
  x_cod_response: string;
  x_response_reason_text: string;
  x_errorcode?: string; // e.g., "00" for success
  x_cod_transaction_state: string; // e.g., "1", "2", "3"
  x_transaction_state: string; // "Aceptada", "Rechazada", "Pendiente", "Fallida", etc.
  x_franchise: string;
  x_business?: string;

  x_customer_doctype?: string;
  x_customer_document?: string;
  x_customer_name?: string;
  x_customer_lastname?: string;
  x_customer_email?: string;
  x_customer_phone?: string;
  x_customer_movil?: string;
  x_customer_ind_pais?: string;
  x_customer_country?: string;
  x_customer_city?: string;
  x_customer_address?: string;
  x_customer_ip: string;

  x_test_request: string; // "TRUE" or "FALSE"

  x_extra1?: string;
  x_extra2?: string;
  x_extra3?: string;
  x_extra4?: string;
  x_extra5?: string;
  x_extra6?: string;
  x_extra7?: string;
  x_extra8?: string;
  x_extra9?: string;
  x_extra10?: string;

  x_tax_ico?: string;
  x_payment_date?: string | null;
  x_signature: string;
  x_transaction_cycle?: string | null;
  is_processable?: string; // Often "true" or "false" as a string
  x_3ds_authentication?: string;
  x_3ds_reponse?: string | null;
  [key: string]: any; // For any other fields
}

/**
 * Data required to construct and validate an ePayco signature.
 * These fields are extracted from `EpaycoConfirmationData` and merchant secrets.
 */
export interface EpaycoSignatureConstructionData {
  /** Merchant's P_CUST_ID_CLIENTE from ePayco dashboard. */
  p_cust_id_cliente: string;
  /** Merchant's P_KEY from ePayco dashboard. */
  p_key: string;
  /** `x_ref_payco` from the ePayco confirmation data. */
  x_ref_payco: string;
  /** `x_transaction_id` from the ePayco confirmation data. */
  x_transaction_id: string;
  /** `x_amount` from the ePayco confirmation data (as a string). */
  x_amount: string;
  /** `x_currency_code` from the ePayco confirmation data. */
  x_currency_code: string;
}

/**
 * Data structure of the transaction details within `EpaycoValidationApiResponse`.
 * Numeric values are typically numbers here, unlike confirmation data.
 */
export interface EpaycoTransactionValidationData {
  x_cust_id_cliente: number;
  x_ref_payco: number;
  x_id_factura: string;
  x_id_invoice: string;
  x_description: string;
  x_mpd_points?: number;
  x_amount: number;
  x_amount_country: number;
  x_amount_ok: number;
  x_tax: number;
  x_tax_ico: number;
  x_amount_base: number;
  x_currency_code: string;
  x_bank_name: string;
  x_cardnumber: string; // Masked
  x_quotas: string;
  x_respuesta: string;
  x_response: string;
  x_approval_code: string;
  x_transaction_id: string;
  x_fecha_transaccion: string;
  x_transaction_date: string;
  x_cod_respuesta: number;
  x_cod_response: number;
  x_response_reason_text: string;
  x_cod_transaction_state: number;
  x_transaction_state: string;
  x_errorcode: string;
  x_franchise: string;
  x_business: string;
  x_customer_doctype?: string;
  x_customer_document?: string;
  x_customer_name?: string;
  x_customer_lastname?: string;
  x_customer_email: string;
  x_customer_phone?: string;
  x_customer_movil?: string;
  x_customer_ind_pais?: string;
  x_customer_country?: string;
  x_customer_city?: string;
  x_customer_address?: string;
  x_customer_ip: string;
  x_signature: string;
  x_test_request: string; // "TRUE" or "FALSE"
  x_transaction_cycle: string | null;
  x_extra1?: string;
  x_extra2?: string;
  x_extra3?: string;
  x_extra4?: string;
  x_extra5?: string;
  x_extra6?: string;
  x_extra7?: string;
  x_extra8?: string;
  x_extra9?: string;
  x_extra10?: string;
  x_type_payment?: string;
  x_secondary_step?: string;
  [key: string]: any; // For any other fields
}

/**
 * API response structure from ePayco's transaction validation endpoint
 * (`/validation/v1/reference/{ref_payco}`).
 */
export interface EpaycoValidationApiResponse {
  success: boolean;
  title_response: string;
  text_response: string;
  last_action: string;
  data: EpaycoTransactionValidationData;
}
