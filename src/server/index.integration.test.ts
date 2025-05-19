import { createEpaycoSession } from "./index";
import type { CreateEpaycoSessionConfig, EpaycoPaymentDetails } from "./types";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const runIntegrationTests = process.env.RUN_EPAYCO_INTEGRATION_TESTS === "true";
const describeOrSkip = runIntegrationTests ? describe : describe.skip;

// This will skip all tests in this block if RUN_EPAYCO_INTEGRATION_TESTS is not 'true'
describeOrSkip("ePayco Server SDK - Integration Tests", () => {
  let testPublicKey: string;
  let testPrivateKey: string;
  let testApiBaseUrl: string;
  let testPublicIp: string;

  beforeAll(() => {
    // Ensure environment variables are set before running tests
    testPublicKey = process.env.EPAYCO_TEST_PUBLIC_KEY || "";
    testPrivateKey = process.env.EPAYCO_TEST_PRIVATE_KEY || "";
    testApiBaseUrl =
      process.env.EPAYCO_TEST_API_BASE_URL || "https://api.secure.epayco.co";
    testPublicIp = process.env.TESTING_PUBLIC_IP || "";

    if (!testPublicKey || !testPrivateKey) {
      throw new Error(
        "EPAYCO_TEST_PUBLIC_KEY and EPAYCO_TEST_PRIVATE_KEY must be set in environment variables to run integration tests."
      );
    }
  });

  it("should successfully authenticate and create a test session with ePayco", async () => {
    const paymentDetails: EpaycoPaymentDetails = {
      name: "Integration Test Product",
      description: "Product for SDK integration testing",
      currency: "COP",
      amount: 15000,
      country: "CO",
      lang: "ES",
      ip: testPublicIp, // A real public IP is needed https://whatismyipaddress.com/
      confirmationUrl: "https://my-test-app.com/epayco/confirmation", // Dummy URL
      responseUrl: "https://my-test-app.com/epayco/response", // Dummy URL
      billing: {
        name: "Integration TestUser",
        email: `testuser-${Date.now()}@example.com`, // Unique email to avoid conflicts
        address: "AV 89 # 78 - 87",
        typeDoc: "CC",
        numberDoc: "1032420545", // Use a valid-looking test document number
        callingCode: "+57",
        mobilePhone: "3124567896",
      },
    };

    const config: CreateEpaycoSessionConfig = {
      publicKey: testPublicKey,
      privateKey: testPrivateKey,
      paymentDetails,
      isTestMode: true, // CRUCIAL: Ensure this is set to true for test transactions
      epaycoApiBaseUrl: testApiBaseUrl,
    };

    let sessionId: string | undefined;
    let error: any;

    try {
      sessionId = await createEpaycoSession(config);
    } catch (e) {
      error = e;
      console.error("Integration test failed:", e); // Log the full error for debugging
    }

    // Assertions
    expect(error).toBeUndefined(); // We expect no error to be thrown
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");

    // Check the generated sessionId
    console.log("Received Test Session ID:", sessionId);
  }, 15000); // Increase timeout for network calls (e.g., 15 seconds)
});
