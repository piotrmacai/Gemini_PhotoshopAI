/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface EditPanelProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    onGenerate: () => void;
    isLoading: boolean;
}

const EditPanel: React.FC<EditPanelProps> = ({ prompt, onPromptChange, onGenerate, isLoading }) => {
    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-center text-gray-300">Edit with a Prompt</h3>
            <p className="text-sm text-center text-gray-400 -mt-2">Describe any change you want to make to the entire image.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); onGenerate(); }} className="w-full flex items-center gap-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder="e.g., 'make the photo look like it was taken at night'"
                    className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoading}
                />
                <button 
                    type="submit"
                    className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                    disabled={isLoading || !prompt.trim()}
                >
                    Generate
                </button>
            </form>
        </div>
    );
};

export default EditPanel;
