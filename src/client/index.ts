import { EpaycoNativeCheckoutHandler, OpenEpaycoCheckoutParams } from "./types";

// --- Global state for script loading ---
let epaycoLoadPromise: Promise<void> | null = null;

const EPAYCO_SCRIPT_URL = "https://checkout.epayco.co/checkout.js";
const EPAYCO_SCRIPT_ID = "epayco-checkout-script"; // To identify the script tag

// --- Script Loader Function ---
export function loadEpaycoScript(): Promise<void> {
  // 1. Check if running in a browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error("ePayco SDK can only be loaded in a browser environment.")
    );
  }

  // 2. Idempotency: If a promise already exists, return it
  if (epaycoLoadPromise) {
    return epaycoLoadPromise;
  }

  // 3. Idempotency: Check if script is already in the DOM (e.g., manually added by user)
  //    and if window.ePayco is already available.
  if (document.getElementById(EPAYCO_SCRIPT_ID) && window.ePayco?.checkout) {
    return Promise.resolve();
  }

  // 4. Create the promise and start loading
  epaycoLoadPromise = new Promise<void>((resolve, reject) => {
    // Check again if script was added by another concurrent call before this promise body executed
    let script = document.getElementById(
      EPAYCO_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (script && window.ePayco?.checkout) {
      console.log(
        "ePayco script was already present and ePayco object available."
      );
      resolve();
      return;
    }

    if (script && !window.ePayco?.checkout) {
      // Script tag exists but ePayco object not yet ready.
      // This can happen if another call to loadEpaycoScript initiated loading.
      // We'll rely on its onload/onerror.
      // To make this robust, the original promise should handle this.
      // For simplicity, we'll assume the first check for epaycoLoadPromise handles most concurrency.
      // Or, we can re-attach listeners if script exists but promise was null.
      // Let's assume for now this means we are the first to create the script tag.
    }

    script = document.createElement("script");
    script.id = EPAYCO_SCRIPT_ID;
    script.src = EPAYCO_SCRIPT_URL;
    script.async = true;

    script.onload = () => {
      if (window.ePayco && window.ePayco.checkout) {
        console.log("ePayco script loaded successfully.");
        resolve();
      } else {
        console.error(
          "ePayco script loaded, but window.ePayco.checkout is not available."
        );
        // Reset promise so it can be tried again if this was a fluke
        epaycoLoadPromise = null;
        reject(
          new Error(
            "ePayco script loaded, but window.ePayco.checkout is not available."
          )
        );
      }
    };

    script.onerror = (error) => {
      console.error("Failed to load ePayco script:", error);
      if (document.getElementById(EPAYCO_SCRIPT_ID)) {
        document.getElementById(EPAYCO_SCRIPT_ID)?.remove(); // Clean up failed script tag
      }
      epaycoLoadPromise = null; // Allow retrying
      reject(
        new Error(
          `Failed to load ePayco script from ${EPAYCO_SCRIPT_URL}. Error: ${error instanceof Event ? "Network error or script error" : error}`
        )
      );
    };

    // Append the script to the document head
    document.head.appendChild(script);
  });

  return epaycoLoadPromise;
}

// --- Main Checkout Function (Placeholder for now) ---
export async function openEpaycoCheckout(
  params: OpenEpaycoCheckoutParams
): Promise<EpaycoNativeCheckoutHandler> {
  // Return the handler
  if (typeof window === "undefined" || !window.document) {
    throw new Error(
      "openEpaycoCheckout can only be called in a browser environment."
    );
  }
  if (!params || !params.sessionId) {
    throw new Error("sessionId is required to open ePayco checkout.");
  }
  // If 'external' is made required in OpenEpaycoCheckoutParams as discussed:
  if (typeof params.external !== "boolean") {
    throw new Error(
      "The 'external' parameter (boolean) is required to open ePayco checkout."
    );
  }

  console.log("Attempting to open ePayco checkout with params:", params);

  try {
    await loadEpaycoScript(); // Ensure the ePayco script is loaded

    if (
      !window.ePayco ||
      !window.ePayco.checkout ||
      !window.ePayco.checkout.configure
    ) {
      throw new Error(
        "ePayco checkout library is not available on window.ePayco.checkout.configure after script load."
      );
    }

    const handler = window.ePayco.checkout.configure({
      sessionId: params.sessionId,
      external: params.external, // Use the provided external value
    });

    if (!handler || typeof handler.openNew !== "function") {
      throw new Error(
        "ePayco handler was not configured correctly or openNew method is missing."
      );
    }

    handler.openNew(); // Open the checkout

    return handler; // Return the native handler for advanced usage (e.g., onResponse)
  } catch (error) {
    console.error("Error during openEpaycoCheckout:", error);
    // Re-throw the error or a more specific SDK error to be caught by the caller
    if (error instanceof Error) {
      throw new Error(`Failed to open ePayco checkout: ${error.message}`);
    }
    throw new Error(
      "An unknown error occurred while trying to open ePayco checkout."
    );
  }
}
