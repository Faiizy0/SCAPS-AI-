export type LayerType = 'Left Contact' | 'ETL' | 'Interconnection' | 'Absorber' | 'HTL' | 'Window' | 'Buffer' | 'Right Contact';

export type DefectType = 'Neutral' | 'Donor' | 'Acceptor';
export type EnergeticDistribution = 'Single' | 'Uniform' | 'Gau' | 'CB tail' | 'VB tail';

export interface InterfaceDefect {
  id: string;
  type: DefectType;
  captureCrossSectionElectron: number; // cm^2
  captureCrossSectionHole: number; // cm^2
  distribution: EnergeticDistribution;
  energyReference: number; // eV
  totalDensity: number; // cm^-2
}

export interface Layer {
  id: string;
  type: LayerType;
  material: string;
  // Standard Material Parameters
  thickness?: number; // nm
  bandgap?: number; // eV
  electronAffinity?: number; // eV
  dielectricConstant?: number; // K
  cbEffectiveDos?: number; // cm^-3
  vbEffectiveDos?: number; // cm^-3
  electronMobility?: number; // cm^2/Vs
  holeMobility?: number; // cm^2/Vs
  donorDensity?: number; // cm^-3
  acceptorDensity?: number; // cm^-3
  defectDensity?: number; // cm^-3
  // Contact Specific Parameters
  electronRecVelocity?: number; // cm/s
  holeRecVelocity?: number; // cm/s
  metalWorkFunction?: number; // eV
}

export interface SolarCellSimulation {
  id: string;
  name: string;
  layers: Layer[];
  interfaceDefects: InterfaceDefect[];
  results: {
    voc: number; // V
    jsc: number; // mA/cm^2
    ff: number; // %
    pce: number; // %
  };
  timestamp: number;
}

export interface AnalysisResult {
  summary: string;
  recommendations: string[];
  trends: string;
}
