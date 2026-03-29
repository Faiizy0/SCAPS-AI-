import { GoogleGenAI } from "@google/genai";
import { SolarCellSimulation, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeSolarCellData(data: SolarCellSimulation[]): Promise<AnalysisResult> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    You are an expert in Perovskite Solar Cell research and SCAPS-1D simulation analysis.
    Analyze the following multi-layer solar cell simulation dataset:
    
    ${JSON.stringify(data, null, 2)}
    
    The data includes multiple layers (Left Contact, ETL, Absorber, HTL, Right Contact, etc.) for each simulation.
    Note: Some architectures are "HTL-free" (no HTL layer) or may not include an Interconnection layer.
    
    Based on this data, provide:
    1. A concise summary of how the layer combinations and contact properties (work function, recombination velocities) affect performance.
    2. Specific recommendations for optimizing the stack (e.g., thickness of ETL vs Absorber).
    3. Identification of key trends across simulations.
    
    Return the response in JSON format with the following structure:
    {
      "summary": "string",
      "recommendations": ["string", "string"],
      "trends": "string"
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    const parsed = JSON.parse(response.text || "{}");
    return {
      summary: parsed.summary || "No summary available.",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : ["No specific recommendations at this time."],
      trends: parsed.trends || "No trends identified."
    };
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return {
      summary: "Analysis failed to generate properly.",
      recommendations: ["Check your data inputs and try again."],
      trends: "No trends identified."
    };
  }
}
