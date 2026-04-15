const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

// Load .env.local
dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "API_KEY_MISSING");

async function run() {
  const modelsToTry = [
    "gemini-3.1-pro", 
    "gemini-3.1-flash-lite", 
    "gemini-1.5-flash"
  ];
  try {
    console.log("Listing available models...");
    const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).listModels();
    // Use the model enumeration if listModels is available on the client
    // Actually listModels is on the genAI instance in some versions or via a different method
    console.log("Checking API access...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent("test");
    console.log("Access successful!");
  } catch (error) {
    console.error("Error details:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

run();
