import React from 'react';
import { Layer } from '../types';

interface SolarCellVisualizerProps {
  layers: Layer[];
  className?: string;
}

const getLayerColor = (type: string): string => {
  switch (type) {
    case 'Absorber': return '#FDE047'; // Yellow
    case 'ETL': return '#3B82F6';      // Blue
    case 'HTL': return '#10B981';      // Emerald
    case 'Window': return '#22C55E';   // Green
    case 'Buffer': return '#D946EF';   // Fuchsia
    case 'Left Contact': return '#94A3B8'; // Slate
    case 'Right Contact': return '#475569'; // Dark Slate
    case 'Interconnection': return '#F97316'; // Orange
    default: return '#CBD5E1';
  }
};

export const SolarCellVisualizer: React.FC<SolarCellVisualizerProps> = ({ layers, className }) => {
  // Filter out contacts for the main stack drawing, handle them separately
  const mainLayers = layers.filter(l => l.type !== 'Left Contact' && l.type !== 'Right Contact');
  const leftContact = layers.find(l => l.type === 'Left Contact');
  const rightContact = layers.find(l => l.type === 'Right Contact');

  const width = 300;
  const height = 300;
  const perspectiveX = 60;
  const perspectiveY = 30;
  
  const layerHeight = 30;
  const totalStackHeight = mainLayers.length * layerHeight;
  const startY = 100;
  const svgHeight = startY + totalStackHeight + (rightContact ? 10 : 0) + 60;

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width + perspectiveX} ${svgHeight}`} className="w-full h-auto drop-shadow-xl">
        {/* Sun & Light */}
        <g transform="translate(280, 20)">
          <circle cx="0" cy="0" r="15" fill="#FDE047" />
          <g className="animate-pulse">
            {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
              <line 
                key={angle}
                x1="20" y1="0" x2="30" y2="0" 
                stroke="#FDE047" strokeWidth="2" 
                transform={`rotate(${angle})`} 
              />
            ))}
          </g>
        </g>
        
        <text x="180" y="30" className="text-[10px] font-bold fill-slate-500 italic">AM1.5G spectrum</text>
        
        {/* Light Waves */}
        <g transform="translate(150, 40)" className="opacity-60">
          {[0, 30, 60].map((offset, i) => (
            <path 
              key={i}
              d={`M ${offset} 0 Q ${offset + 10} 10, ${offset} 20 T ${offset} 40`}
              fill="none"
              stroke={['#EF4444', '#F59E0B', '#3B82F6'][i]}
              strokeWidth="2"
              className="animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </g>

        {/* The Stack */}
        <g transform={`translate(20, ${startY})`}>
          {/* Main Layers */}
          {mainLayers.map((layer, idx) => {
            const y = idx * layerHeight;
            const color = getLayerColor(layer.type);
            
            return (
              <g key={layer.id}>
                {/* Front Face */}
                <rect 
                  x="0" y={y} width={width - perspectiveX} height={layerHeight} 
                  fill={color} stroke="rgba(0,0,0,0.1)" 
                />
                {/* Side Face */}
                <path 
                  d={`M ${width - perspectiveX} ${y} L ${width} ${y - perspectiveY} L ${width} ${y + layerHeight - perspectiveY} L ${width - perspectiveX} ${y + layerHeight} Z`}
                  fill={color} filter="brightness(0.8)" stroke="rgba(0,0,0,0.1)"
                />
                {/* Top Face (only for the very top layer) */}
                {idx === 0 && (
                  <path 
                    d={`M 0 0 L ${perspectiveX} ${-perspectiveY} L ${width} ${-perspectiveY} L ${width - perspectiveX} 0 Z`}
                    fill={color} filter="brightness(1.1)" stroke="rgba(0,0,0,0.1)"
                  />
                )}
                
                {/* Labels */}
                <text 
                  x={(width - perspectiveX) / 2} y={y + layerHeight / 2 + 4} 
                  textAnchor="middle" 
                  className="text-[10px] font-bold fill-white drop-shadow-sm pointer-events-none"
                >
                  {layer.material}
                </text>
                
                <text 
                  x={width - perspectiveX / 2} y={y + layerHeight / 2 - perspectiveY / 2 + 4} 
                  textAnchor="middle" 
                  transform={`rotate(-25, ${width - perspectiveX / 2}, ${y + layerHeight / 2 - perspectiveY / 2})`}
                  className="text-[8px] font-bold fill-white/80 pointer-events-none"
                >
                  {layer.type}
                </text>
              </g>
            );
          })}

          {/* Front Contacts (Top) */}
          {leftContact && (
            <g transform={`translate(0, 0)`}>
              {/* Left Block */}
              <g>
                <rect x="0" y="-15" width="40" height="15" fill="#E2E8F0" stroke="rgba(0,0,0,0.1)" />
                <path d="M 40 -15 L 60 -35 L 60 -20 L 40 0 Z" fill="#CBD5E1" stroke="rgba(0,0,0,0.1)" />
                <path d="M 0 -15 L 20 -35 L 60 -35 L 40 -15 Z" fill="#F1F5F9" stroke="rgba(0,0,0,0.1)" />
                <text x="20" y="-5" textAnchor="middle" className="text-[8px] font-bold fill-slate-600">{leftContact.material}</text>
              </g>
              {/* Right Block */}
              <g transform={`translate(${width - perspectiveX - 40}, 0)`}>
                <rect x="0" y="-15" width="40" height="15" fill="#E2E8F0" stroke="rgba(0,0,0,0.1)" />
                <path d="M 40 -15 L 60 -35 L 60 -20 L 40 0 Z" fill="#CBD5E1" stroke="rgba(0,0,0,0.1)" />
                <path d="M 0 -15 L 20 -35 L 60 -35 L 40 -15 Z" fill="#F1F5F9" stroke="rgba(0,0,0,0.1)" />
                <text x="20" y="-5" textAnchor="middle" className="text-[8px] font-bold fill-slate-600">{leftContact.material}</text>
              </g>
              <text x={width - 20} y={-perspectiveY} className="text-[8px] font-bold fill-slate-500">Front contact</text>
            </g>
          )}

          {/* Back Contact (Bottom) */}
          {rightContact && (
            <g transform={`translate(0, ${totalStackHeight})`}>
              <rect x="0" y="0" width={width - perspectiveX} height="10" fill="#475569" stroke="rgba(0,0,0,0.1)" />
              <path d={`M ${width - perspectiveX} 0 L ${width} ${-perspectiveY} L ${width} ${10 - perspectiveY} L ${width - perspectiveX} 10 Z`} fill="#334155" stroke="rgba(0,0,0,0.1)" />
              <text x={(width - perspectiveX) / 2} y="8" textAnchor="middle" className="text-[8px] font-bold fill-white/80">{rightContact.material}</text>
              <text x={width - 20} y={10 - perspectiveY} className="text-[8px] font-bold fill-slate-500">Back contact</text>
            </g>
          )}

          {/* Substrate Base */}
          <g transform={`translate(0, ${totalStackHeight + (rightContact ? 10 : 0)})`}>
            <rect x="0" y="0" width={width - perspectiveX} height="30" fill="#0284C7" stroke="rgba(0,0,0,0.1)" />
            <path d={`M ${width - perspectiveX} 0 L ${width} ${-perspectiveY} L ${width} ${30 - perspectiveY} L ${width - perspectiveX} 30 Z`} fill="#0369A1" stroke="rgba(0,0,0,0.1)" />
            <text x={(width - perspectiveX) / 2} y="20" textAnchor="middle" className="text-[12px] font-bold fill-white">Substrate</text>
          </g>
        </g>
      </svg>
    </div>
  );
};
