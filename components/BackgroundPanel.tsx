/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { UploadIcon } from './icons';

interface BackgroundPanelProps {
    onRemoveBackground: () => void;
    onChangeBackground: () => void;
    isLoading: boolean;
    newBackgroundFile: File | null;
    onNewBackgroundFileChange: (file: File | null) => void;
}

const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ 
    onRemoveBackground, 
    onChangeBackground,
    isLoading,
    newBackgroundFile,
    onNewBackgroundFileChange
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onNewBackgroundFileChange(event.target.files[0]);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-gray-300">Background Tools</h3>
            <p className="text-sm text-gray-400 -mt-2">Remove the background or replace it with a new image.</p>
            
            <div className="w-full max-w-md flex flex-col gap-4 items-center">
                <button
                    onClick={onRemoveBackground}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                >
                    Remove Background
                </button>
                
                <div className="w-full h-px bg-gray-600 my-2"></div>

                <div className="flex flex-col items-center gap-2 w-full">
                    <p className="text-sm font-medium text-gray-400">Replace with new background:</p>
                    
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                        disabled={isLoading}
                    />

                    <button
                        onClick={handleButtonClick}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UploadIcon className="w-5 h-5" />
                        {newBackgroundFile ? 'Change Background Image' : 'Upload Background Image'}
                    </button>

                    {newBackgroundFile && (
                         <div className="w-full mt-2 animate-fade-in flex flex-col items-center gap-4">
                            <p className="text-sm text-gray-300 truncate px-4">Selected: <strong>{newBackgroundFile.name}</strong></p>
                            <button
                                onClick={onChangeBackground}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                            >
                                Apply New Background
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BackgroundPanel;