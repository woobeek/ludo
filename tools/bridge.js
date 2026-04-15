const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load .env
dotenv.config();

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Error: NEXT_PUBLIC_GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function getSupportedModel(genAI) {
  const candidates = [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash"
  ];
  
  for (const name of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const test = await model.generateContent("test");
      if (test) {
        console.log(`Using model: ${name}`);
        return model;
      }
    } catch (e) {
      // Continue to next
    }
  }
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Default
}

async function main() {
  const args = process.argv.slice(2);
  const taskIndex = args.indexOf("--task");
  const filesIndex = args.indexOf("--files");

  if (taskIndex === -1 || filesIndex === -1) {
    console.log("Usage: node tools/bridge.js --task \"Task description\" --files \"path/to/file1,path/to/file2\"");
    process.exit(1);
  }

  const task = args[taskIndex + 1];
  const filePaths = args[filesIndex + 1].split(",").map(p => p.trim());

  const model = await getSupportedModel(genAI);

  let context = "";
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      context += `\n<file path="${filePath}">\n${content}\n</file>\n`;
    } else {
      console.warn(`Warning: File not found: ${filePath}`);
    }
  }

  const prompt = `
Task: ${task}

Environment Context:
${context}

Instructions:
1. Analyze the provided files and the task.
2. Provide the COMPLETELY UPDATED code for each file that needs changes.
3. Wrap each file in a markdown code block.
4. Use the format:
FILE: path/to/file
\`\`\`language
... updated code ...
\`\`\`
`;

  try {
    console.log("--- Calling Gemini 3.1 Pro via Bridge ---");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("--- Processing Response ---");
    
    // Simple regex to find file blocks
    const fileRegex = /FILE: (.*?)\n```(?:\w+)?\n([\s\S]*?)```/g;
    let match;
    let updatedCount = 0;

    while ((match = fileRegex.exec(text)) !== null) {
      let filePath = match[1].trim();
      const newCode = match[2];

      // Fix for common hallucinated extensions or relative paths
      if (!fs.existsSync(filePath)) {
        const alternatives = [
          filePath.replace(".js", ".jsx"),
          filePath.replace(".jsx", ".js"),
          path.join("frontend", filePath),
          path.join("frontend/src", filePath)
        ];
        const found = alternatives.find(alt => fs.existsSync(alt));
        if (found) {
          console.log(`Resolved ${filePath} to ${found}`);
          filePath = found;
        } else {
          console.error(`Error: Could not find file ${filePath}. Skipping update.`);
          continue;
        }
      }

      // Backup
      const backupPath = filePath + ".bak";
      fs.copyFileSync(filePath, backupPath);
      console.log(`Backup created: ${backupPath}`);

      // Overwrite
      fs.writeFileSync(filePath, newCode, "utf-8");
      console.log(`Successfully updated: ${filePath}`);
      updatedCount++;
    }

    if (updatedCount === 0) {
      console.log("No file updates detected in response. Check response text below:");
      console.log(text);
    } else {
      console.log(`Task completed. ${updatedCount} files updated.`);
    }

  } catch (error) {
    console.error("Bridge Error:", error.message);
  }
}

main();
