const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    // In current SDK, listModels is often part of the Client or requires a different approach.
    // Let's just try to call a known 1.5 model to confirm the SDK works.
    const result = await model.generateContent("Say 'ready'");
    console.log("SDK is working. Response:", (await result.response).text());
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
