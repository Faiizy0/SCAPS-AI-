import React, { useState, useEffect } from 'react';
import { SolarCellSimulation } from '../types';
import { trainAndAnalyze, FeatureImportance } from '../lib/ml';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Brain, AlertCircle, Loader2 } from 'lucide-react';

interface AIModelAnalysisProps {
  simulations: SolarCellSimulation[];
}

export function AIModelAnalysis({ simulations }: AIModelAnalysisProps) {
  const [target, setTarget] = useState<'pce' | 'voc' | 'jsc' | 'ff'>('pce');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    importances: FeatureImportance[];
    r2: number;
    mse: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function runAnalysis() {
      if (simulations.length < 5) {
        setError("Not enough data. Please add at least 5 simulations to train the Random Forest model.");
        setResults(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Run in a slight timeout to allow UI to show loading state
        await new Promise(resolve => setTimeout(resolve, 100));
        const analysis = await trainAndAnalyze(simulations, target);
        if (mounted) {
          setResults(analysis);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "An error occurred during training.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    runAnalysis();

    return () => {
      mounted = false;
    };
  }, [simulations, target]);

  const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Performance Predictor</h2>
            <p className="text-sm text-gray-500">Random Forest regression to identify key factors</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Target Metric:</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as any)}
            className="input-field py-1 px-3"
          >
            <option value="pce">PCE (%)</option>
            <option value="voc">Voc (V)</option>
            <option value="jsc">Jsc (mA/cm²)</option>
            <option value="ff">FF (%)</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium">Analysis Unavailable</h3>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-sm mt-2 text-amber-700">
              Current simulations: {simulations.length} / 5 required
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
          <p>Training Random Forest model on {simulations.length} simulations...</p>
        </div>
      ) : results ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Model R² Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {(results.r2 * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Variance explained by model</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <p className="text-sm text-gray-500 font-medium">Mean Squared Error</p>
              <p className="text-2xl font-bold text-gray-900">
                {results.mse.toExponential(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Prediction error</p>
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Feature Importance (Permutation)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={results.importances.slice(0, 8)} // Show top 8
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                  <YAxis 
                    dataKey="feature" 
                    type="category" 
                    width={150} 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Importance']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {results.importances.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Shows how much each parameter influences the {target.toUpperCase()} based on your simulation history.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
