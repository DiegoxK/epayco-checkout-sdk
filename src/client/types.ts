/**
 * Parameters for opening the ePayco checkout.
 */
export interface OpenEpaycoCheckoutParams {
  /** The session ID obtained from your backend. */
  sessionId: string;
  /**
   * Determines how the checkout is displayed.
   * `true`: Opens checkout in a new tab/window (external).
   * `false`: Opens checkout in an iframe on the current page (onepage).
   */
  external: boolean;
}

/**
 * Data object passed to the onResponse callback.
 * The exact shape needs to be confirmed by inspecting a live response.
 */
export interface EpaycoCheckoutResponseData {
  ref_payco?: string;
  transactionID?: string;
  transactionState?: string; // e.g., "Aceptada", "Rechazada", "Pendiente", "Fallida"
  description?: string;
  value?: string;
  currency?: string;
  // ... any other fields ePayco sends
  [key: string]: any; // For flexibility until fully known
}

/**
 * Data object passed to the onClosed callback.
 * The exact shape needs to be confirmed by inspecting a live response.
 * It might be undefined if no specific data is passed on close.
 */
export type EpaycoCheckoutCloseData = any; // Or more specific if known, e.g., { reason?: string } | undefined

/**
 * Data object passed to the onCreated callback (event: "onLoadCheckout").
 * The exact shape needs to be confirmed.
 */
export type EpaycoCheckoutCreatedData = any; // Or more specific if known

/**
 * Represents the handler object returned by ePayco's `checkout.configure`.
 * Allows interaction with the ePayco checkout process.
 */
export interface EpaycoNativeCheckoutHandler {
  /** Opens the ePayco checkout UI based on the current configuration. */
  openNew: () => EpaycoNativeCheckoutHandler;

  /**
   * Registers a callback that is invoked when the checkout process is created/loaded.
   * (Corresponds to internal "onLoadCheckout" event)
   * @param callback Function to execute when the checkout is created.
   * @returns The handler instance for chaining.
   */
  onCreated: (
    callback: (data: EpaycoCheckoutCreatedData) => void
  ) => EpaycoNativeCheckoutHandler;

  /**
   * Registers a callback that is invoked when a transaction ID is loaded (specific timing unclear from snippet).
   * @param callback Function to execute.
   * @returns The handler instance for chaining.
   */
  onLoadTransactionId: (callback: () => void) => EpaycoNativeCheckoutHandler;

  /**
   * Registers a callback that is invoked when a transaction ID is created (specific timing unclear from snippet).
   * @param callback Function to execute.
   * @returns The handler instance for chaining.
   */
  onCreatedTransactionId: (callback: () => void) => EpaycoNativeCheckoutHandler;

  /**
   * Registers a callback for handling errors during the checkout process.
   * Note: The implementation in the provided checkout.js snippet is an empty function.
   * The actual error data structure passed to the callback (if any) would need further inspection.
   * @param callback Function to execute on error.
   * @returns The handler instance for chaining.
   */
  onErrors: (callback: (errorData: any) => void) => EpaycoNativeCheckoutHandler; // Assuming it might pass error data

  /**
   * Registers a callback that is invoked when ePayco returns a response
   * after a payment attempt (e.g., success, failure, pending).
   * (Corresponds to internal "onResponse" event)
   * @param callback Function to execute with the response data.
   * @returns The handler instance for chaining.
   */
  onResponse: (
    callback: (responseData: EpaycoCheckoutResponseData) => void
  ) => EpaycoNativeCheckoutHandler;

  /**
   * Registers a callback that is invoked when the checkout modal is closed by the user
   * or programmatically.
   * (Corresponds to internal "onCloseModal" event)
   * @param callback Function to execute when the checkout is closed.
   * @returns The handler instance for chaining.
   */
  onClosed: (
    callback: (data: EpaycoCheckoutCloseData) => void
  ) => EpaycoNativeCheckoutHandler;

  // The 'configure' and 'open' methods are part of ePayco.checkout, not typically chained after getting a handler instance.
  // We don't need to include them here as the SDK user interacts via openEpaycoCheckout.
}

// --- TypeScript Augmentation for Window (for internal SDK use) ---
declare global {
  interface Window {
    ePayco?: {
      checkout: {
        /**
         * Configures the ePayco checkout.
         * For session-based checkout, `sessionId` and `external` are the primary parameters.
         */
        configure: (config: {
          sessionId: string; // Made non-optional as it's key for this flow
          external: boolean;
          // key?: string; // Optional, likely for non-sessionId flows
          // test?: boolean; // Optional, test mode is typically set during backend session creation
        }) => EpaycoNativeCheckoutHandler;
        // open, openNew etc. are methods on the handler instance, not directly on ePayco.checkout
        // The other methods (onCreated, onResponse etc.) are also on the handler instance.
      };
    };
  }
}
