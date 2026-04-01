import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Build contents array
      const contents: any[] = [];
      if (history && Array.isArray(history)) {
        for (const msg of history) {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.text }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: "You are an expert in solar cell physics, photovoltaics, and the SCAPS-1D simulation software. Provide helpful, accurate, and concise answers to help the user design better solar cells. If they ask about their simulations, refer to the provided context. Format your responses using Markdown for readability.",
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      res.status(500).json({ error: error.message || "An error occurred while processing your request." });
    }
  });

  app.post("/api/predict-space", async (req, res) => {
    try {
      const { sim } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        Analyze the following solar cell simulation designed for Earth (AM1.5G) and predict its performance and viability in a Space environment (AM0 spectrum, high radiation, extreme temperature cycling, vacuum).
        
        Simulation Name: ${sim.name}
        Earth Performance (AM1.5G):
        - PCE: ${sim.results.pce}%
        - Voc: ${sim.results.voc} V
        - Jsc: ${sim.results.jsc} mA/cm²
        - FF: ${sim.results.ff}%
        
        Layer Stack (Top to Bottom):
        ${sim.layers.map((l: any) => `- ${l.type}: ${l.material} (${l.thickness || 'N/A'} nm)`).join('\n')}
        
        Provide a realistic prediction for its space performance metrics (AM0 typically increases Jsc but extreme temps/radiation affect Voc/FF/PCE), list the pros and cons of this specific material stack in space, and give a brief analysis.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spacePerformance: {
                type: Type.OBJECT,
                properties: {
                  pce: { type: Type.NUMBER, description: "Predicted Power Conversion Efficiency in space (%)" },
                  voc: { type: Type.NUMBER, description: "Predicted Open Circuit Voltage in space (V)" },
                  jsc: { type: Type.NUMBER, description: "Predicted Short Circuit Current in space (mA/cm2)" },
                  ff: { type: Type.NUMBER, description: "Predicted Fill Factor in space (%)" }
                },
                required: ["pce", "voc", "jsc", "ff"]
              },
              pros: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Advantages of this specific solar cell stack in a space environment"
              },
              cons: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Disadvantages or vulnerabilities of this specific solar cell stack in a space environment"
              },
              analysis: {
                type: Type.STRING,
                description: "A brief paragraph explaining the reasoning behind the predictions."
              }
            },
            required: ["spacePerformance", "pros", "cons", "analysis"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        res.json(parsed);
      } else {
        throw new Error("No response from AI");
      }
    } catch (error: any) {
      console.error("Error in /api/predict-space:", error);
      res.status(500).json({ error: error.message || "An error occurred while processing your request." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
