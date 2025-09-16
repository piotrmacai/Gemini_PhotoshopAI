/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Tool } from '../App';
import { BrushIcon, EraserIcon, TrashIcon, RectangleIcon, CircleIcon, PolygonIcon, MagicWandIcon, SelectSubjectIcon, SmartSelectIcon } from './icons';

interface MaskPanelProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    onGenerate: () => void;
    isLoading: boolean;
    hasMask: boolean;
    brushSize: number;
    onBrushSizeChange: (value: number) => void;
    tool: Tool;
    onToolChange: (tool: Tool) => void;
    isSoftErase: boolean;
    onIsSoftEraseChange: (value: boolean) => void;
    onClear: () => void;
    magicWandTolerance: number;
    onMagicWandToleranceChange: (value: number) => void;
    refineEdges: boolean;
    onRefineEdgesChange: (value: boolean) => void;
    onSelectSubject: () => void;
}

const MaskPanel: React.FC<MaskPanelProps> = ({
    prompt,
    onPromptChange,
    onGenerate,
    isLoading,
    hasMask,
    brushSize,
    onBrushSizeChange,
    tool,
    onToolChange,
    isSoftErase,
    onIsSoftEraseChange,
    onClear,
    magicWandTolerance,
    onMagicWandToleranceChange,
    refineEdges,
    onRefineEdgesChange,
    onSelectSubject,
}) => {
    const tools: { name: Tool, icon: React.FC<{className?: string}>, title: string }[] = [
        { name: 'brush', icon: BrushIcon, title: 'Brush' },
        { name: 'eraser', icon: EraserIcon, title: 'Eraser' },
        { name: 'rectangle', icon: RectangleIcon, title: 'Rectangle' },
        { name: 'circle', icon: CircleIcon, title: 'Circle' },
        { name: 'polygon', icon: PolygonIcon, title: 'Polygon Tool (Click to place points, click start to close)' },
        { name: 'magicWand', icon: MagicWandIcon, title: 'Magic Wand (Click to select color area)' },
        { name: 'smartSelect', icon: SmartSelectIcon, title: 'Smart Select (Click an object to select with AI)' },
    ];

    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
            
            <div className="flex flex-col md:flex-row items-start gap-4">
                {/* Tool Selector */}
                <div className="flex flex-row md:flex-col items-center gap-1 bg-gray-900/50 p-1 rounded-lg">
                    {tools.map(t => (
                         <button 
                            key={t.name}
                            onClick={() => onToolChange(t.name)}
                            className={`p-3 rounded-md transition-colors ${tool === t.name ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-white/10'}`}
                            aria-label={`Select ${t.title}`}
                            title={t.title}
                            disabled={isLoading}
                        >
                            <t.icon className="w-5 h-5" />
                        </button>
                    ))}
                </div>
                
                {/* Tool Options & Prompt */}
                <div className="w-full flex flex-col gap-4 flex-grow">
                     <button
                        onClick={onSelectSubject}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        <SelectSubjectIcon className="w-5 h-5" />
                        Select Subject (AI)
                    </button>
                     <div className="w-full flex flex-col gap-4 bg-gray-900/50 p-3 rounded-lg">
                        <p className="text-sm text-gray-400 -mb-2">
                           {
                             tool === 'polygon' ? 'Click to place points, click the first point to close the shape.' :
                             tool === 'magicWand' ? 'Click on the image to select an area by color.' :
                             tool === 'smartSelect' ? 'Click on an object in the image to select it with AI.' :
                             'Select a tool and draw on the image to create a mask.'
                           }
                        </p>
                        
                        {(tool === 'brush' || tool === 'eraser') && (
                            <div className="flex-grow flex items-center gap-2">
                                <label className="text-sm text-gray-400 w-20 flex-shrink-0">Brush Size</label>
                                <input type="range" min="1" max="150" value={brushSize} onChange={(e) => onBrushSizeChange(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" disabled={isLoading} aria-label="Brush Size"/>
                                <span className="text-sm text-gray-300 w-8 text-center">{brushSize}</span>
                            </div>
                        )}
                        
                        {tool === 'eraser' && (
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="soft-erase-check" checked={isSoftErase} onChange={e => onIsSoftEraseChange(e.target.checked)} disabled={isLoading} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"/>
                                <label htmlFor="soft-erase-check" className="text-sm font-medium text-gray-300 cursor-pointer select-none">Soft Edge</label>
                            </div>
                        )}
                        
                        {tool === 'magicWand' && (
                            <div className="flex-grow flex items-center gap-2">
                                <label className="text-sm text-gray-400 w-20 flex-shrink-0">Tolerance</label>
                                <input type="range" min="1" max="100" value={magicWandTolerance} onChange={(e) => onMagicWandToleranceChange(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" disabled={isLoading} aria-label="Magic Wand Tolerance"/>
                                <span className="text-sm text-gray-300 w-8 text-center">{magicWandTolerance}</span>
                            </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="refine-edges-check" checked={refineEdges} onChange={e => onRefineEdgesChange(e.target.checked)} disabled={isLoading} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 cursor-pointer"/>
                                <label htmlFor="refine-edges-check" className="text-sm font-medium text-gray-300 cursor-pointer select-none">Refine Edges</label>
                            </div>
                             <button 
                                onClick={onClear}
                                className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-gray-400 hover:bg-white/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400 text-sm"
                                aria-label="Clear Mask"
                                title="Clear Mask"
                                disabled={isLoading || !hasMask}
                            >
                                <TrashIcon className="w-4 h-4" /> Clear Mask
                            </button>
                        </div>
                    </div>
                    
                    <form onSubmit={(e) => { e.preventDefault(); onGenerate(); }} className="w-full flex items-center gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            placeholder={hasMask ? "e.g., 'change my shirt color to blue'" : "First, create a selection on the image"}
                            className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isLoading || !hasMask}
                        />
                        <button 
                            type="submit"
                            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                            disabled={isLoading || !prompt.trim() || !hasMask}
                        >
                            Generate
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MaskPanel;