/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';

interface ExtendPanelProps {
  onApplyExtend: (aspect: number) => void;
  onSetAspect: (aspect: number | undefined) => void;
  isLoading: boolean;
  currentAspect: number;
}

const ExtendPanel: React.FC<ExtendPanelProps> = ({ onApplyExtend, onSetAspect, isLoading, currentAspect }) => {
  const [activeAspectName, setActiveAspectName] = useState<string | null>(null);
  const [activeAspectValue, setActiveAspectValue] = useState<number | undefined>();

  // Reset local state if the image changes (currentAspect changes)
  useEffect(() => {
    setActiveAspectName(null);
    setActiveAspectValue(undefined);
  }, [currentAspect]);

  const handleAspectChange = (name: string, value: number) => {
    setActiveAspectName(name);
    setActiveAspectValue(value);
    onSetAspect(value);
  }

  const aspects: { name: string, value: number }[] = [
    { name: 'Widescreen (16:9)', value: 16 / 9 },
    { name: 'Square (1:1)', value: 1 },
    { name: 'Standard (4:3)', value: 4/3 },
    { name: 'Portrait (3:4)', value: 3/4 },
    { name: 'Tall (9:16)', value: 9/16 },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">Extend Image (Outpainting)</h3>
      <p className="text-sm text-gray-400 -mt-2">Choose a new aspect ratio and AI will fill the new space.</p>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full">
        {aspects.map(({ name, value }) => (
          <button
            key={name}
            onClick={() => handleAspectChange(name, value)}
            disabled={isLoading}
            className={`px-4 py-3 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
              activeAspectName === name
              ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/20' 
              : 'bg-white/10 hover:bg-white/20 text-gray-200'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <button
        onClick={() => { if (activeAspectValue) onApplyExtend(activeAspectValue); }}
        disabled={isLoading || !activeAspectValue}
        className="w-full max-w-xs mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Extend
      </button>
    </div>
  );
};

export default ExtendPanel;
