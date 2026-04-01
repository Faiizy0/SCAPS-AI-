import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { 
  FlaskConical, 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  ChevronRight,
  Info,
  Activity,
  Layers,
  Zap,
  GripVertical,
  Settings2,
  Search,
  Eye,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SolarCellSimulation, Layer, LayerType, InterfaceDefect, DefectType, EnergeticDistribution } from './types';
import { SolarCellVisualizer } from './components/SolarCellVisualizer';
import { AIAssistant } from './components/AIAssistant';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import { SpaceEnvironmentPredictor } from './components/SpaceEnvironmentPredictor';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LAYER_TYPES: LayerType[] = [
  'Right Contact',
  'Window',
  'Buffer',
  'ETL',
  'Interconnection', // Optional
  'Absorber',
  'HTL', // Optional
  'Left Contact'
];

const createDefaultInterfaceDefect = (): InterfaceDefect => ({
  id: Math.random().toString(36).substr(2, 9),
  type: 'Neutral',
  captureCrossSectionElectron: 1e-15,
  captureCrossSectionHole: 1e-15,
  distribution: 'Single',
  energyReference: 0.6,
  totalDensity: 1e10
});

const INITIAL_LAYERS: Layer[] = [
  { 
    id: 'l1', type: 'Right Contact', material: 'Al',
    metalWorkFunction: 4.2, electronRecVelocity: 1e7, holeRecVelocity: 1e7
  },
  { 
    id: 'l2', type: 'Window', material: 'ZnO:(Al, Ga, Sn)', thickness: 100, bandgap: 3.3, electronAffinity: 4.0, 
    dielectricConstant: 9, cbEffectiveDos: 1e18, vbEffectiveDos: 1e18, 
    electronMobility: 50, holeMobility: 5, donorDensity: 1e18, acceptorDensity: 0, defectDensity: 1e14 
  },
  { 
    id: 'l3', type: 'Buffer', material: 'Zn (O, N, S)', thickness: 50, bandgap: 2.8, electronAffinity: 4.1, 
    dielectricConstant: 10, cbEffectiveDos: 1e18, vbEffectiveDos: 1e18, 
    electronMobility: 10, holeMobility: 1, donorDensity: 1e17, acceptorDensity: 0, defectDensity: 1e15 
  },
  { 
    id: 'l4', type: 'Absorber', material: 'ZnSnN2', thickness: 500, bandgap: 1.4, electronAffinity: 3.9, 
    dielectricConstant: 12, cbEffectiveDos: 1e18, vbEffectiveDos: 1e18, 
    electronMobility: 20, holeMobility: 10, donorDensity: 1e15, acceptorDensity: 0, defectDensity: 1e14 
  },
  { 
    id: 'l5', type: 'Left Contact', material: 'Ni',
    metalWorkFunction: 5.1, electronRecVelocity: 1e7, holeRecVelocity: 1e7
  },
];

const INITIAL_INTERFACE_DEFECTS: InterfaceDefect[] = Array(INITIAL_LAYERS.length - 1).fill(null).map(() => createDefaultInterfaceDefect());

const INITIAL_DATA: SolarCellSimulation[] = [
  {
    id: '1',
    name: 'ZnSnN2 Thin Film Stack',
    layers: INITIAL_LAYERS,
    interfaceDefects: INITIAL_INTERFACE_DEFECTS,
    results: { voc: 1.05, jsc: 22.5, ff: 78, pce: 18.4 },
    timestamp: Date.now()
  }
];

const formatScientific = (num: number) => {
  if (num === 0) return "0E+0";
  return num.toExponential().toUpperCase();
};

const parseScientific = (str: string) => {
  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
};

const ScientificInput = ({ 
  value, 
  onChange, 
  label, 
  className = "input-field py-1 text-sm font-mono" 
}: { 
  value: number, 
  onChange: (val: number) => void, 
  label?: string,
  className?: string
}) => {
  const [localValue, setLocalValue] = useState(formatScientific(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatScientific(value));
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseScientific(localValue);
    onChange(parsed);
    setLocalValue(formatScientific(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const inputElement = (
    <input 
      type="text" 
      className={className} 
      value={isFocused ? localValue : formatScientific(value)} 
      onChange={e => setLocalValue(e.target.value)} 
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );

  if (label) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 dark:text-ink">{label}</label>
        {inputElement}
      </div>
    );
  }

  return inputElement;
};

export default function App() {
  const [data, setData] = useState<SolarCellSimulation[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        signInAnonymously(auth);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, 'simulations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const simulations: SolarCellSimulation[] = [];
      snapshot.forEach((doc) => {
        simulations.push({ id: doc.id, ...doc.data() } as SolarCellSimulation);
      });
      setData(simulations);
    });

    return () => unsubscribe();
  }, [userId]);

  const [showForm, setShowForm] = useState(false);
  const [editingSimId, setEditingSimId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingSim, setViewingSim] = useState<SolarCellSimulation | null>(null);

  // Form State
  const [simName, setSimName] = useState('New Simulation');
  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS);
  const [interfaceDefects, setInterfaceDefects] = useState<InterfaceDefect[]>(INITIAL_INTERFACE_DEFECTS);
  const [results, setResults] = useState({ voc: 0, jsc: 0, ff: 0, pce: 0 });

  const handleAddLayer = (index?: number) => {
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Absorber',
      material: 'New Material',
      thickness: 100,
      bandgap: 1.5,
      electronAffinity: 4.0,
      dielectricConstant: 10,
      cbEffectiveDos: 1e18,
      vbEffectiveDos: 1e18,
      electronMobility: 10,
      holeMobility: 10,
      donorDensity: 1e15,
      acceptorDensity: 0,
      defectDensity: 1e14
    };
    
    if (typeof index === 'number') {
      const newLayers = [...layers];
      newLayers.splice(index, 0, newLayer);
      setLayers(newLayers);
      
      const newDefects = [...interfaceDefects];
      const defectIndex = Math.max(0, Math.min(index, interfaceDefects.length));
      newDefects.splice(defectIndex, 0, createDefaultInterfaceDefect());
      setInterfaceDefects(newDefects);
    } else {
      setLayers([...layers, newLayer]);
      setInterfaceDefects([...interfaceDefects, createDefaultInterfaceDefect()]);
    }
  };

  const handleUpdateLayerType = (id: string, type: LayerType) => {
    setLayers(layers.map(l => {
      if (l.id !== id) return l;
      
      const isContact = type === 'Left Contact' || type === 'Right Contact';
      const base = { id: l.id, type, material: l.material };
      
      if (isContact) {
        return {
          ...base,
          metalWorkFunction: 4.5,
          electronRecVelocity: 1e7,
          holeRecVelocity: 1e7
        };
      } else {
        return {
          ...base,
          thickness: l.thickness || 100,
          bandgap: 1.5,
          electronAffinity: 4.0,
          dielectricConstant: 10,
          cbEffectiveDos: 1e18,
          vbEffectiveDos: 1e18,
          electronMobility: 10,
          holeMobility: 10,
          donorDensity: 1e15,
          acceptorDensity: 0,
          defectDensity: 1e14
        };
      }
    }));
  };

  const handleRemoveLayer = (id: string) => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    
    const newDefects = [...interfaceDefects];
    if (idx < interfaceDefects.length) {
      newDefects.splice(idx, 1);
    } else if (interfaceDefects.length > 0) {
      newDefects.splice(interfaceDefects.length - 1, 1);
    }
    setInterfaceDefects(newDefects);
  };

  const handleUpdateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const handleUpdateInterfaceDefect = (id: string, updates: Partial<InterfaceDefect>) => {
    setInterfaceDefects(interfaceDefects.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const handleAddSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const simData = {
      name: simName,
      layers: [...layers],
      interfaceDefects: [...interfaceDefects],
      results: { ...results },
      timestamp: Date.now(),
      userId: userId
    };
    
    if (editingSimId) {
      await updateDoc(doc(db, 'simulations', editingSimId), simData);
    } else {
      await addDoc(collection(db, 'simulations'), simData);
    }
    
    setShowForm(false);
    setEditingSimId(null);
    // Reset form
    setSimName('New Simulation');
    setLayers(INITIAL_LAYERS);
    setInterfaceDefects(INITIAL_INTERFACE_DEFECTS);
    setResults({ voc: 0, jsc: 0, ff: 0, pce: 0 });
  };

  const handleEditSim = (sim: SolarCellSimulation) => {
    setSimName(sim.name);
    setLayers([...sim.layers]);
    setInterfaceDefects([...sim.interfaceDefects]);
    setResults({ ...sim.results });
    setEditingSimId(sim.id);
    setShowForm(true);
  };

  const handleDeleteSim = async (id: string) => {
    await deleteDoc(doc(db, 'simulations', id));
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(sim => 
      sim.layers.some(layer => 
        layer.material.toLowerCase().includes(query)
      )
    );
  }, [data, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <FlaskConical size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight dark:text-ink">Perovskite AI Research</h1>
              <p className="text-xs text-slate-500 dark:text-ink font-mono tracking-wider">SCAPS Simulation data - Author: Vi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setEditingSimId(null);
                setSimName('New Simulation');
                setLayers(INITIAL_LAYERS);
                setInterfaceDefects(INITIAL_INTERFACE_DEFECTS);
                setResults({ voc: 0, jsc: 0, ff: 0, pce: 0 });
                setShowForm(true);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} />
              <span>New Simulation</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Main Content */}
        <div className="space-y-8">
          
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Simulations', value: data.length, icon: Layers, color: 'text-purple-500' },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-4 flex items-center gap-4">
                <div className={cn("p-2 rounded-lg bg-slate-50 dark:bg-slate-900", stat.color)}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-ink font-medium">{stat.label}</p>
                  <p className="text-xl font-bold dark:text-ink">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
          
          <SpaceEnvironmentPredictor simulations={data} />

          {/* Simulation List */}
          <section className="space-y-4 mt-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
              <h2 className="font-bold text-lg flex items-center gap-2 dark:text-ink">
                <Activity size={20} className="text-blue-600" />
                Simulation History
              </h2>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Search by material (e.g. MAPbI3, TiO2)..."
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-ink"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredData.length > 0 ? (
                filteredData.map((sim) => (
                  <motion.div 
                    key={sim.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card"
                  >
                    <div className="p-6 flex flex-col md:flex-row gap-8">
                      <div className="w-full md:w-56 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                        <SolarCellVisualizer layers={sim.layers} />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg dark:text-ink">{sim.name}</h3>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-ink">PCE (%)</span>
                              <span className="text-xl font-black text-blue-600 dark:text-blue-400">{sim.results.pce.toFixed(2)}%</span>
                            </div>
                            <button 
                              onClick={() => setViewingSim(sim)}
                              className="p-2 text-slate-300 hover:text-blue-500 dark:text-ink dark:hover:text-blue-400 transition-colors"
                              title="View Details"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              onClick={() => handleEditSim(sim)}
                              className="p-2 text-slate-300 hover:text-blue-500 dark:text-ink dark:hover:text-blue-400 transition-colors"
                              title="Edit Simulation"
                            >
                              <Pencil size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteSim(sim.id)}
                              className="p-2 text-slate-300 hover:text-red-500 dark:text-ink dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {/* Layer Stack Visualization */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-ink mb-1">layer stack</span>
                          <div className="flex h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                            {sim.layers.map((layer, idx) => (
                              <React.Fragment key={layer.id}>
                                <div 
                                  className={cn(
                                    "flex-1 flex items-center justify-center text-[10px] font-bold text-white transition-all hover:flex-[1.5] cursor-help border-r border-white/20 last:border-0 truncate px-0.5",
                                    layer.type === 'Absorber' ? 'bg-amber-600' : 
                                    layer.type === 'ETL' ? 'bg-blue-500' :
                                    layer.type === 'HTL' ? 'bg-emerald-500' :
                                    layer.type === 'Window' ? 'bg-cyan-500' :
                                    layer.type === 'Buffer' ? 'bg-lime-500' :
                                    layer.type === 'Left Contact' || layer.type === 'Right Contact' ? 'bg-slate-700' : 'bg-slate-400'
                                  )}
                                  title={
                                    layer.type === 'Left Contact' || layer.type === 'Right Contact' 
                                    ? `${layer.type}: ${layer.material} (wf: ${formatScientific(layer.metalWorkFunction || 0)}eV)`
                                    : `${layer.type}: ${layer.material} (${formatScientific(layer.thickness || 0)}nm)`
                                  }
                                >
                                  {layer.material}
                                </div>
                                {idx < sim.layers.length - 1 && sim.interfaceDefects && 
                                 sim.layers[idx].type !== 'Left Contact' && sim.layers[idx].type !== 'Right Contact' &&
                                 sim.layers[idx+1].type !== 'Left Contact' && sim.layers[idx+1].type !== 'Right Contact' && (
                                  <div 
                                    className="w-1 bg-amber-400 hover:w-2 transition-all cursor-help" 
                                    title={`Interface Defect: ${sim.interfaceDefects[idx].type} (density: ${formatScientific(sim.interfaceDefects[idx].totalDensity)}cm⁻²)`}
                                  />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 dark:text-ink">Voc (V)</label>
                              <p className="font-mono font-bold dark:text-ink">{sim.results.voc.toFixed(3)} V</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 dark:text-ink">Jsc (mA/cm²)</label>
                              <p className="font-mono font-bold dark:text-ink">{sim.results.jsc.toFixed(2)} mA/cm²</p>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 dark:text-ink">FF (%)</label>
                              <p className="font-mono font-bold dark:text-ink">{sim.results.ff.toFixed(2)}%</p>
                            </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-slate-400 dark:text-ink space-y-4">
                  <Search size={48} className="opacity-20" />
                  <p className="font-medium dark:text-ink">No simulations found matching your search.</p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-blue-600 hover:underline text-sm font-bold"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Multi-Layer Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold dark:text-ink">{editingSimId ? 'Edit Simulation' : 'New thin - Solar cell simulation'}</h2>
                <button onClick={() => { setShowForm(false); setEditingSimId(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <Trash2 size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Live Preview */}
                <div className="glass-card p-6 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Live Stack Preview</label>
                  <div className="w-full max-w-md">
                    <SolarCellVisualizer layers={layers} />
                  </div>
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 dark:text-ink">simulation name</label>
                  <input 
                    type="text" 
                    className="input-field text-lg font-bold" 
                    value={simName} 
                    onChange={e => setSimName(e.target.value)} 
                  />
                </div>

                {/* Layer Editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 dark:text-ink">layer stack (top to bottom)</label>
                    <button onClick={() => handleAddLayer()} className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
                      <Plus size={14} /> add layer
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-center -mb-2">
                      <button 
                        onClick={() => handleAddLayer(0)} 
                        className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800 shadow-sm z-10"
                        title="Add layer at top"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {layers.map((layer, idx) => (
                      <React.Fragment key={layer.id}>
                        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-4 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 dark:text-ink">
                                {idx + 1}
                              </div>
                              <select 
                                className="input-field py-1 text-sm font-bold w-48"
                                value={layer.type}
                                onChange={e => handleUpdateLayerType(layer.id, e.target.value as LayerType)}
                              >
                                {LAYER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <input 
                                className="input-field py-1 text-sm font-bold w-48"
                                placeholder="Material Name"
                                value={layer.material}
                                onChange={e => handleUpdateLayer(layer.id, { material: e.target.value })}
                              />
                            </div>
                            <button onClick={() => handleRemoveLayer(layer.id)} className="p-2 text-slate-300 hover:text-red-500 dark:text-ink dark:hover:text-red-400">
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            { (layer.type !== 'Left Contact' && layer.type !== 'Right Contact') && (
                              <ScientificInput label="thickness (nm)" value={layer.thickness || 0} onChange={val => handleUpdateLayer(layer.id, { thickness: val })} />
                            )}
                            { (layer.type === 'Left Contact' || layer.type === 'Right Contact') ? (
                              <>
                                <ScientificInput label="metal work function (eV)" value={layer.metalWorkFunction || 0} onChange={val => handleUpdateLayer(layer.id, { metalWorkFunction: val })} />
                                <ScientificInput label="e- rec. velocity (s_e, cm/s)" value={layer.electronRecVelocity || 0} onChange={val => handleUpdateLayer(layer.id, { electronRecVelocity: val })} />
                                <ScientificInput label="h+ rec. velocity (s_h, cm/s)" value={layer.holeRecVelocity || 0} onChange={val => handleUpdateLayer(layer.id, { holeRecVelocity: val })} />
                              </>
                            ) : (
                              <>
                                <ScientificInput label="bandgap (eV)" value={layer.bandgap || 0} onChange={val => handleUpdateLayer(layer.id, { bandgap: val })} />
                                <ScientificInput label="affinity (χ, eV)" value={layer.electronAffinity || 0} onChange={val => handleUpdateLayer(layer.id, { electronAffinity: val })} />
                                <ScientificInput label="dielectric (ε_r)" value={layer.dielectricConstant || 0} onChange={val => handleUpdateLayer(layer.id, { dielectricConstant: val })} />
                                <ScientificInput label="cb dos (n_c, cm⁻³)" value={layer.cbEffectiveDos || 0} onChange={val => handleUpdateLayer(layer.id, { cbEffectiveDos: val })} />
                                <ScientificInput label="vb dos (n_v, cm⁻³)" value={layer.vbEffectiveDos || 0} onChange={val => handleUpdateLayer(layer.id, { vbEffectiveDos: val })} />
                                <ScientificInput label="electron mobility (cm²/Vs)" value={layer.electronMobility || 0} onChange={val => handleUpdateLayer(layer.id, { electronMobility: val })} />
                                <ScientificInput label="hole mobility (cm²/Vs)" value={layer.holeMobility || 0} onChange={val => handleUpdateLayer(layer.id, { holeMobility: val })} />
                                <ScientificInput label="donor (n_d, cm⁻³)" value={layer.donorDensity || 0} onChange={val => handleUpdateLayer(layer.id, { donorDensity: val })} />
                                <ScientificInput label="acceptor (n_a, cm⁻³)" value={layer.acceptorDensity || 0} onChange={val => handleUpdateLayer(layer.id, { acceptorDensity: val })} />
                                <ScientificInput label="defect (n_t, cm⁻³)" value={layer.defectDensity || 0} onChange={val => handleUpdateLayer(layer.id, { defectDensity: val })} />
                              </>
                            )}
                          </div>
                        </div>

                        {/* Interface Defect Editor (between layers) */}
                        {idx < layers.length - 1 && interfaceDefects[idx] && 
                         layers[idx].type !== 'Left Contact' && layers[idx].type !== 'Right Contact' &&
                         layers[idx+1].type !== 'Left Contact' && layers[idx+1].type !== 'Right Contact' && (
                          <div className="p-4 border-l-4 border-amber-400 bg-amber-50/30 dark:bg-amber-900/10 rounded-r-xl space-y-3 ml-8 relative">
                            <div className="absolute -left-[22px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-slate-800" />
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-amber-500" />
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Interface Defect (Layer {idx+1} / {idx+2})</span>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-ink">defect type</label>
                                <select 
                                  className="input-field py-1 text-xs font-bold"
                                  value={interfaceDefects[idx].type}
                                  onChange={e => handleUpdateInterfaceDefect(interfaceDefects[idx].id, { type: e.target.value as DefectType })}
                                >
                                  <option value="Neutral">Neutral</option>
                                  <option value="Donor">Donor</option>
                                  <option value="Acceptor">Acceptor</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-ink">distribution</label>
                                <select 
                                  className="input-field py-1 text-xs font-bold"
                                  value={interfaceDefects[idx].distribution}
                                  onChange={e => handleUpdateInterfaceDefect(interfaceDefects[idx].id, { distribution: e.target.value as EnergeticDistribution })}
                                >
                                  <option value="Single">Single</option>
                                  <option value="Uniform">Uniform</option>
                                  <option value="Gau">Gau</option>
                                  <option value="CB tail">CB tail</option>
                                  <option value="VB tail">VB tail</option>
                                </select>
                              </div>
                              <ScientificInput className="input-field py-1 text-xs font-mono" label="σ_e (cm²)" value={interfaceDefects[idx].captureCrossSectionElectron} onChange={val => handleUpdateInterfaceDefect(interfaceDefects[idx].id, { captureCrossSectionElectron: val })} />
                              <ScientificInput className="input-field py-1 text-xs font-mono" label="σ_h (cm²)" value={interfaceDefects[idx].captureCrossSectionHole} onChange={val => handleUpdateInterfaceDefect(interfaceDefects[idx].id, { captureCrossSectionHole: val })} />
                              <ScientificInput className="input-field py-1 text-xs font-mono" label="energy (eV)" value={interfaceDefects[idx].energyReference} onChange={val => handleUpdateInterfaceDefect(interfaceDefects[idx].id, { energyReference: val })} />
                              <ScientificInput className="input-field py-1 text-xs font-mono" label="density (cm⁻²)" value={interfaceDefects[idx].totalDensity} onChange={val => handleUpdateInterfaceDefect(interfaceDefects[idx].id, { totalDensity: val })} />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-center -my-2">
                          <button 
                            onClick={() => handleAddLayer(idx + 1)} 
                            className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm z-10"
                            title={`Add layer after ${layer.type}`}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Results Editor */}
                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 dark:text-ink">simulation results (scaps output)</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-ink">Voc (V)</label>
                      <input type="number" step="0.001" className="input-field" value={results.voc} onChange={e => setResults({...results, voc: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-ink">Jsc (mA/cm²)</label>
                      <input type="number" step="0.1" className="input-field" value={results.jsc} onChange={e => setResults({...results, jsc: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-ink">FF (%)</label>
                      <input type="number" step="0.1" className="input-field" value={results.ff} onChange={e => setResults({...results, ff: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-ink">PCE (%)</label>
                      <input type="number" step="0.01" className="input-field bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-600 dark:text-blue-400" value={results.pce} onChange={e => setResults({...results, pce: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                <button onClick={() => { setShowForm(false); setEditingSimId(null); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleAddSimulation} className="btn-primary flex-1">
                  {editingSimId ? 'Update Simulation' : 'Save Simulation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail View Modal */}
      <AnimatePresence>
        {viewingSim && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setViewingSim(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <div>
                  <h2 className="text-xl font-bold dark:text-ink">{viewingSim.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-ink font-mono">Simulation ID: {viewingSim.id}</p>
                </div>
                <button onClick={() => setViewingSim(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Trash2 size={20} className="text-slate-400 rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="glass-card p-6 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Stack Visualization</label>
                      <div className="w-full">
                        <SolarCellVisualizer layers={viewingSim.layers} />
                      </div>
                    </div>

                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-sm font-bold flex items-center gap-2 dark:text-ink">
                        <Zap size={16} className="text-amber-500" />
                        Performance Metrics
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-ink uppercase">Voc</p>
                          <p className="text-lg font-bold dark:text-ink">{viewingSim.results.voc.toFixed(3)} V</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-ink uppercase">Jsc</p>
                          <p className="text-lg font-bold dark:text-ink">{viewingSim.results.jsc.toFixed(2)} mA/cm²</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-ink uppercase">Fill Factor</p>
                          <p className="text-lg font-bold dark:text-ink">{viewingSim.results.ff.toFixed(2)}%</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                          <p className="text-[10px] font-bold text-blue-400 uppercase">Efficiency (PCE)</p>
                          <p className="text-xl font-black text-blue-600 dark:text-blue-400">{viewingSim.results.pce.toFixed(2)}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-card p-6 space-y-4">
                      <h3 className="text-sm font-bold flex items-center gap-2 dark:text-ink">
                        <Layers size={16} className="text-blue-500" />
                        Layer Details
                      </h3>
                      <div className="space-y-3">
                        {viewingSim.layers.map((layer, idx) => (
                          <div key={layer.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-500 dark:text-ink uppercase">{layer.type}</span>
                              <span className="text-sm font-bold dark:text-ink">{layer.material}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {layer.thickness !== undefined && (
                                <div>
                                  <span className="text-[10px] text-slate-400 dark:text-ink block">Thickness</span>
                                  <span className="text-xs font-mono dark:text-ink">{layer.thickness} nm</span>
                                </div>
                              )}
                              {layer.bandgap !== undefined && (
                                <div>
                                  <span className="text-[10px] text-slate-400 dark:text-ink block">Bandgap</span>
                                  <span className="text-xs font-mono dark:text-ink">{layer.bandgap} eV</span>
                                </div>
                              )}
                              {layer.metalWorkFunction !== undefined && (
                                <div>
                                  <span className="text-[10px] text-slate-400 dark:text-ink block">Work Function</span>
                                  <span className="text-xs font-mono dark:text-ink">{layer.metalWorkFunction} eV</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AIAssistant simulations={data} />
    </div>
  );
}
