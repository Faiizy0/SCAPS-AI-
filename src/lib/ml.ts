import { RandomForestRegression } from 'ml-random-forest';
import { SolarCellSimulation, LayerType } from '../types';

export const FEATURE_NAMES = [
  'Absorber Thickness',
  'Absorber Bandgap',
  'Absorber Electron Affinity',
  'Absorber Defect Density',
  'ETL Thickness',
  'ETL Bandgap',
  'HTL Thickness',
  'HTL Bandgap',
  'Window Thickness',
  'Buffer Thickness',
  'Avg Interface Defect Density'
];

export function extractFeatures(sim: SolarCellSimulation): number[] {
  const getLayer = (type: LayerType) => sim.layers.find(l => l.type === type);
  
  const absorber = getLayer('Absorber');
  const etl = getLayer('ETL');
  const htl = getLayer('HTL');
  const window = getLayer('Window');
  const buffer = getLayer('Buffer');

  const avgInterfaceDefects = sim.interfaceDefects.length > 0 
    ? sim.interfaceDefects.reduce((sum, d) => sum + (d.totalDensity || 0), 0) / sim.interfaceDefects.length
    : 0;

  return [
    absorber?.thickness || 0,
    absorber?.bandgap || 0,
    absorber?.electronAffinity || 0,
    absorber?.defectDensity || 0,
    etl?.thickness || 0,
    etl?.bandgap || 0,
    htl?.thickness || 0,
    htl?.bandgap || 0,
    window?.thickness || 0,
    buffer?.thickness || 0,
    avgInterfaceDefects
  ];
}

function calculateMSE(predictions: number[], actual: number[]): number {
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += Math.pow(predictions[i] - actual[i], 2);
  }
  return sum / predictions.length;
}

// Shuffle array in place
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export async function trainAndAnalyze(simulations: SolarCellSimulation[], target: 'pce' | 'voc' | 'jsc' | 'ff' = 'pce'): Promise<{
  importances: FeatureImportance[],
  r2: number,
  mse: number
}> {
  if (simulations.length < 5) {
    throw new Error("Not enough data to train the model. Please add at least 5 simulations.");
  }

  const X = simulations.map(extractFeatures);
  const y = simulations.map(sim => sim.results[target]);

  const options = {
    seed: 42,
    maxFeatures: Math.max(1, Math.floor(X[0].length / 3)),
    replacement: true,
    nEstimators: 100
  };

  const rf = new RandomForestRegression(options);
  rf.train(X, y);

  const predictions = rf.predict(X);
  const baselineMSE = calculateMSE(predictions, y);

  // Calculate R2
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((a, b) => a + Math.pow(b - meanY, 2), 0);
  const ssRes = predictions.reduce((a, b, i) => a + Math.pow(y[i] - b, 2), 0);
  const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  // Permutation Feature Importance
  const importances: number[] = new Array(X[0].length).fill(0);
  const nPermutations = 5;

  for (let f = 0; f < X[0].length; f++) {
    let permutedMSE = 0;
    for (let p = 0; p < nPermutations; p++) {
      // Copy X
      const X_permuted = X.map(row => [...row]);
      // Extract column f
      const col = X_permuted.map(row => row[f]);
      shuffleArray(col);
      // Put shuffled column back
      for (let i = 0; i < X_permuted.length; i++) {
        X_permuted[i][f] = col[i];
      }
      
      const permutedPreds = rf.predict(X_permuted);
      permutedMSE += calculateMSE(permutedPreds, y);
    }
    permutedMSE /= nPermutations;
    importances[f] = Math.max(0, permutedMSE - baselineMSE); // Importance is increase in error
  }

  // Normalize importances
  const totalImportance = importances.reduce((a, b) => a + b, 0);
  const normalizedImportances = totalImportance === 0 
    ? importances.map(() => 0)
    : importances.map(imp => imp / totalImportance);

  const featureImportances: FeatureImportance[] = FEATURE_NAMES.map((name, i) => ({
    feature: name,
    importance: normalizedImportances[i]
  })).sort((a, b) => b.importance - a.importance);

  return {
    importances: featureImportances,
    r2,
    mse: baselineMSE
  };
}
