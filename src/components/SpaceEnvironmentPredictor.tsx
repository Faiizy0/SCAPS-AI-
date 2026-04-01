import React, { useState } from 'react';
import { SolarCellSimulation } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { Rocket, AlertCircle, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface SpacePredictorProps {
  simulations: SolarCellSimulation[];
}

interface PredictionResult {
  spacePerformance: {
    pce: number;
    voc: number;
    jsc: number;
    ff: number;
  };
  pros: string[];
  cons: string[];
  analysis: string;
}

export function SpaceEnvironmentPredictor({ simulations }: SpacePredictorProps) {
  const [selectedSimId, setSelectedSimId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const handlePredict = async () => {
    const sim = simulations.find(s => s.id === selectedSimId);
    if (!sim) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        Analyze the following solar cell simulation designed for Earth (AM1.5G) and predict its performance and viability in a Space environment (AM0 spectrum, high radiation, extreme temperature cycling, vacuum).
        
        Simulation Name: ${sim.name}
        Earth Performance (AM1.5G):
        - PCE: ${sim.results.pce}%
        - Voc: ${sim.results.voc} V
        - Jsc: ${sim.results.jsc} mA/cm²
        - FF: ${sim.results.ff}%
        
        Layer Stack (Top to Bottom):
        ${sim.layers.map(l => `- ${l.type}: ${l.material} (${l.thickness || 'N/A'} nm)`).join('\n')}
        
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
        setResult(parsed);
      } else {
        throw new Error("No response from AI");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate prediction");
    } finally {
      setLoading(false);
    }
  };

  const selectedSim = simulations.find(s => s.id === selectedSimId);

  return (
    <div className="glass-card p-6 mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-ink">Space Environment Predictor</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">AI analysis for AM0 spectrum and space conditions</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select 
          className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-gray-900 dark:text-ink focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          value={selectedSimId}
          onChange={(e) => {
            setSelectedSimId(e.target.value);
            setResult(null);
            setError(null);
          }}
        >
          <option value="">Select a simulation to analyze...</option>
          {simulations.map(sim => (
            <option key={sim.id} value={sim.id}>{sim.name} (Earth PCE: {sim.results.pce.toFixed(1)}%)</option>
          ))}
        </select>
        <button
          onClick={handlePredict}
          disabled={!selectedSimId || loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center justify-center min-w-[160px] shadow-sm"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze for Space'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 rounded-xl p-4 flex items-start space-x-3 mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {result && selectedSim && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700/50">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Performance Comparison (Earth vs Space)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* PCE */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">PCE (%)</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 line-through font-mono">{selectedSim.results.pce.toFixed(1)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg font-mono">{result.spacePerformance.pce.toFixed(1)}</span>
                </div>
              </div>
              {/* Voc */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">Voc (V)</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 line-through font-mono">{selectedSim.results.voc.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg font-mono">{result.spacePerformance.voc.toFixed(2)}</span>
                </div>
              </div>
              {/* Jsc */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">Jsc (mA/cm²)</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 line-through font-mono">{selectedSim.results.jsc.toFixed(1)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg font-mono">{result.spacePerformance.jsc.toFixed(1)}</span>
                </div>
              </div>
              {/* FF */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-1">FF (%)</p>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500 line-through font-mono">{selectedSim.results.ff.toFixed(1)}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg font-mono">{result.spacePerformance.ff.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl p-5">
              <h3 className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5" /> Space Advantages
              </h3>
              <ul className="space-y-3">
                {result.pros.map((pro, i) => (
                  <li key={i} className="text-sm text-emerald-800 dark:text-emerald-100/80 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span> 
                    <span className="leading-relaxed">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl p-5">
              <h3 className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5" /> Space Vulnerabilities
              </h3>
              <ul className="space-y-3">
                {result.cons.map((con, i) => (
                  <li key={i} className="text-sm text-rose-800 dark:text-rose-100/80 flex items-start gap-2">
                    <span className="text-rose-500 mt-0.5">•</span> 
                    <span className="leading-relaxed">{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700/50">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">AI Analysis</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.analysis}</p>
          </div>
        </div>
      )}
    </div>
  );
}
