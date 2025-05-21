import type {
  OpenEpaycoCheckoutParams,
  EpaycoNativeCheckoutHandler,
  EpaycoConfigureOptions,
} from "./types";

// --- Global state for script loading ---
let epaycoLoadPromise: Promise<void> | null = null;

const EPAYCO_SCRIPT_URL = "https://checkout.epayco.co/checkout.js";
const EPAYCO_SCRIPT_ID = "epayco-checkout-script";

// --- TypeScript Augmentation for Window (for internal SDK use) ---
// This informs TypeScript about the global `window.ePayco` object.
declare global {
  interface Window {
    ePayco?: {
      checkout: {
        /**
         * Configures the ePayco checkout.
         * For session-based checkout, `sessionId` and `external` are the primary parameters.
         */
        configure: (
          config: EpaycoConfigureOptions
        ) => EpaycoNativeCheckoutHandler;
      };
    };
  }
}

/**
 * Loads the external ePayco checkout.js script if it hasn't been loaded already.
 * This function is idempotent, meaning it can be called multiple times without
 * unintended side effects (e.g., loading the script multiple times).
 *
 * @returns {Promise<void>} A promise that resolves when the ePayco script is successfully loaded
 * and `window.ePayco.checkout` is available, or rejects if loading fails or
 * if called outside a browser environment.
 */
export function loadEpaycoScript(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error(
        "ePayco SDK's loadEpaycoScript can only be called in a browser environment."
      )
    );
  }

  if (epaycoLoadPromise) {
    return epaycoLoadPromise;
  }

  if (document.getElementById(EPAYCO_SCRIPT_ID) && window.ePayco?.checkout) {
    // Script tag exists and ePayco object is ready (e.g., added by user or previous SDK call)
    return Promise.resolve();
  }

  epaycoLoadPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(
      EPAYCO_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (script && window.ePayco?.checkout) {
      // Extremely rare race condition: script added and ePayco ready between outer check and promise body
      console.log(
        "ePayco SDK: Script was already present and ePayco object available."
      );
      resolve();
      return;
    }

    // If script tag exists but ePayco object not ready (e.g. another part of app is loading it)
    // we'll still create our own listeners on a new script tag attempt for simplicity,
    // or rely on the first epaycoLoadPromise check to handle most concurrency.
    // A more complex solution might try to hook into an existing script's load events.

    script = document.createElement("script");
    script.id = EPAYCO_SCRIPT_ID;
    script.src = EPAYCO_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (
        window.ePayco &&
        window.ePayco.checkout &&
        typeof window.ePayco.checkout.configure === "function"
      ) {
        console.log("ePayco SDK: ePayco script loaded successfully.");
        resolve();
      } else {
        console.error(
          "ePayco SDK: Script loaded, but window.ePayco.checkout.configure is not available."
        );
        epaycoLoadPromise = null; // Allow retrying if this was a loading glitch
        document.getElementById(EPAYCO_SCRIPT_ID)?.remove(); // Clean up potentially bad script
        reject(
          new Error(
            "ePayco script loaded, but ePayco checkout library is malformed or incomplete."
          )
        );
      }
    };

    script.onerror = (eventOrMessage: Event | string) => {
      console.error(
        "ePayco SDK: Failed to load ePayco script.",
        eventOrMessage
      );
      document.getElementById(EPAYCO_SCRIPT_ID)?.remove(); // Clean up failed script tag
      epaycoLoadPromise = null; // Allow retrying

      let errorMessage = `Failed to load ePayco script from ${EPAYCO_SCRIPT_URL}.`;
      if (eventOrMessage instanceof Event) {
        errorMessage += " Network error or script execution error.";
      } else if (typeof eventOrMessage === "string") {
        errorMessage += ` Details: ${eventOrMessage}`;
      }
      reject(new Error(errorMessage));
    };

    document.head.appendChild(script);
  });

  return epaycoLoadPromise;
}

/**
 * Initializes and opens the ePayco checkout UI (modal/iframe or external page).
 * This function ensures the ePayco script is loaded before attempting to configure and open the checkout.
 *
 * @param {OpenEpaycoCheckoutParams} params - The parameters required to open the checkout,
 * including the `sessionId` and `external` flag.
 * @returns {Promise<EpaycoNativeCheckoutHandler>} A promise that resolves with the native ePayco
 * handler instance. This handler can be used to subscribe to ePayco events like
 * `onCreated`, `onResponse`, and `onClosed`.
 * @throws {Error} If `sessionId` or `external` parameter is missing/invalid, if called outside a browser environment,
 * or if ePayco's library fails to initialize or open the checkout.
 */
export async function openEpaycoCheckout(
  params: OpenEpaycoCheckoutParams
): Promise<EpaycoNativeCheckoutHandler> {
  if (typeof window === "undefined" || !window.document) {
    throw new Error(
      "ePayco SDK's openEpaycoCheckout can only be called in a browser environment."
    );
  }

  if (
    !params ||
    typeof params.sessionId !== "string" ||
    params.sessionId.trim() === ""
  ) {
    throw new Error(
      "ePayco SDK: A valid sessionId string is required to open ePayco checkout."
    );
  }

  if (typeof params.external !== "boolean") {
    throw new Error(
      "ePayco SDK: The 'external' parameter (boolean) is required to open ePayco checkout."
    );
  }

  console.log("ePayco SDK: Attempting to open checkout with params:", params);

  try {
    await loadEpaycoScript(); // Ensure the ePayco script is loaded

    if (
      !window.ePayco ||
      !window.ePayco.checkout ||
      typeof window.ePayco.checkout.configure !== "function"
    ) {
      // This error should ideally be caught by loadEpaycoScript's own checks,
      // but an extra check here provides defense in depth.
      throw new Error(
        "ePayco checkout library (window.ePayco.checkout.configure) is not available even after script load attempt."
      );
    }

    const configureOptions: EpaycoConfigureOptions = {
      sessionId: params.sessionId,
      external: params.external,
    };

    const handler = window.ePayco.checkout.configure(configureOptions);

    if (!handler || typeof handler.openNew !== "function") {
      throw new Error(
        "ePayco handler was not configured correctly by ePayco's library, or the openNew method is missing."
      );
    }

    // Call openNew. ePayco's openNew is synchronous and returns the handler for chaining.
    handler.openNew();

    return handler; // Return the native handler for attaching event listeners
  } catch (error) {
    console.error(
      "ePayco SDK: Error during openEpaycoCheckout execution:",
      error
    );
    if (error instanceof Error) {
      // Prepend SDK context to the error message for easier debugging by the user
      throw new Error(`ePayco SDK Error: ${error.message}`);
    }
    throw new Error(
      "ePayco SDK: An unknown error occurred while trying to open ePayco checkout."
    );
  }
}
