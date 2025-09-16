/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateGlobalEdit, generateSubjectMask, generateExtendedImage, generateObjectMask, removeBackgroundImage, changeBackgroundImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import MaskPanel from './components/MaskPanel';
import DrawingCanvas from './components/DrawingCanvas';
import { UndoIcon, RedoIcon, EyeIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import EditPanel from './components/EditPanel';
import ExtendPanel from './components/ExtendPanel';
import BackgroundPanel from './components/BackgroundPanel';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'edit' | 'mask' | 'adjust' | 'filters' | 'crop' | 'extend' | 'background';
export type Tool = 'brush' | 'eraser' | 'rectangle' | 'circle' | 'polygon' | 'magicWand' | 'smartSelect';

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('edit');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [extendAspect, setExtendAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Masking state
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [maskToLoad, setMaskToLoad] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [tool, setTool] = useState<Tool>('brush');
  const [isSoftErase, setIsSoftErase] = useState(false);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState(0);
  const [magicWandTolerance, setMagicWandTolerance] = useState(20);
  const [refineEdges, setRefineEdges] = useState(true);

  // Background state
  const [newBackgroundFile, setNewBackgroundFile] = useState<File | null>(null);

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);

  // Effect to set the initial aspect for the extend preview
  useEffect(() => {
    if (activeTab === 'extend' && imgRef.current) {
        if (imgRef.current.complete) {
            const { naturalWidth, naturalHeight } = imgRef.current;
            setExtendAspect(naturalWidth / naturalHeight);
        } else {
            imgRef.current.onload = () => {
                if (imgRef.current) {
                    const { naturalWidth, naturalHeight } = imgRef.current;
                    setExtendAspect(naturalWidth / naturalHeight);
                }
            }
        }
    } else if (activeTab !== 'extend') {
        setExtendAspect(undefined);
    }
  }, [activeTab, currentImage]);

  // Reset transient states when tab changes
  useEffect(() => {
    setNewBackgroundFile(null);
  }, [activeTab]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleToolChange = (newTool: Tool) => {
    setTool(newTool);
    if (newTool !== 'eraser') {
      setIsSoftErase(false);
    }
  };

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
    setExtendAspect(undefined);
    setNewBackgroundFile(null);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setActiveTab('edit');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!maskDataUrl) {
        setError('Please paint a mask on the image to select an area to edit.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, maskDataUrl);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setClearCanvasTrigger(c => c + 1);
        setMaskDataUrl(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, maskDataUrl, addImageToHistory]);
  
  const handleApplyGlobalEdit = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateGlobalEdit(currentImage, prompt);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, addImageToHistory]);

  const handleSelectSubject = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to select a subject from.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const maskUrl = await generateSubjectMask(currentImage);
        setMaskToLoad(maskUrl);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to select the subject. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage]);

  const handleSmartSelect = useCallback(async (point: {x: number, y: number}) => {
    if (!currentImage) {
        setError('No image loaded to select from.');
        return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const maskUrl = await generateObjectMask(currentImage, point);
        setMaskToLoad(maskUrl);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to select the object. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the filter. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the adjustment. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Please select an area to crop.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);
  
  const handleApplyExtend = useCallback(async (targetAspect: number) => {
    if (!currentImage || !imgRef.current) {
      setError('No image loaded to extend.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const image = imgRef.current;
      const { naturalWidth, naturalHeight } = image;
      
      let newWidth: number, newHeight: number;
      const currentAspect = naturalWidth / naturalHeight;

      if (targetAspect > currentAspect) {
        // New aspect is wider, so extend width
        newWidth = Math.round(naturalHeight * targetAspect);
        newHeight = naturalHeight;
      } else {
        // New aspect is taller, so extend height
        newWidth = naturalWidth;
        newHeight = Math.round(naturalWidth / targetAspect);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not create canvas context for extending.');
      }
      
      // Draw the original image in the center of the new, larger canvas
      const offsetX = (newWidth - naturalWidth) / 2;
      const offsetY = (newHeight - naturalHeight) / 2;
      ctx.drawImage(image, offsetX, offsetY, naturalWidth, naturalHeight);
      
      const compositeImageWithTransparency = canvas.toDataURL('image/png');
      
      const extendedImageUrl = await generateExtendedImage(compositeImageWithTransparency);
      const newImageFile = dataURLtoFile(extendedImageUrl, `extended-${Date.now()}.png`);
      addImageToHistory(newImageFile);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to extend the image. ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleRemoveBackground = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to remove the background from.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const imageUrl = await removeBackgroundImage(currentImage);
        const newImageFile = dataURLtoFile(imageUrl, `bg-removed-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to remove the background. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleChangeBackground = useCallback(async () => {
    if (!currentImage) {
      setError('No image with a removed background is available.');
      return;
    }
    if (!newBackgroundFile) {
        setError('Please upload a new background image first.');
        return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const imageUrl = await changeBackgroundImage(currentImage, newBackgroundFile);
        const newImageFile = dataURLtoFile(imageUrl, `bg-changed-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to change the background. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, newBackgroundFile, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
  }, []);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} />;
    }

    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20">
            {isLoading && (
                <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <Spinner />
                    <p className="text-gray-300">AI is working its magic...</p>
                </div>
            )}
            
            {activeTab === 'crop' ? (
              <div className="flex justify-center items-center">
                <ReactCrop 
                  crop={crop} 
                  onChange={c => setCrop(c)} 
                  onComplete={c => setCompletedCrop(c)}
                  aspect={aspect}
                  className="max-h-[60vh]"
                >
                  <img 
                    ref={imgRef}
                    src={currentImageUrl} 
                    alt="Crop this image"
                    className="object-contain max-h-[60vh] rounded-xl"
                  />
                </ReactCrop>
              </div>
            ) : activeTab === 'extend' ? (
                <div 
                    className="flex justify-center items-center max-h-[60vh]"
                >
                  <div 
                      className="w-full transition-all duration-300"
                      style={{ aspectRatio: extendAspect ? `${extendAspect}` : 'auto' }}
                  >
                      <img
                          ref={imgRef}
                          src={currentImageUrl}
                          alt="Extend this image"
                          className="w-full h-full object-contain rounded-xl shadow-2xl"
                      />
                  </div>
                </div>
            ) : (
                <div className="relative flex justify-center items-center max-h-[60vh]">
                    {/* Base image is the original, always at the bottom for comparison */}
                    {originalImageUrl && (
                        <img
                            key={`original-${originalImageUrl}`}
                            src={originalImageUrl}
                            alt="Original"
                            className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
                        />
                    )}
                    {/* The current image is an overlay that fades in/out for comparison */}
                    <img
                        ref={imgRef}
                        key={`current-${currentImageUrl}`}
                        src={currentImageUrl}
                        alt="Current"
                        className={`absolute top-0 left-0 w-full h-full object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'}`}
                    />
                    {/* The drawing canvas is another overlay */}
                    {activeTab === 'mask' && !isLoading && (
                         <DrawingCanvas
                            targetRef={imgRef}
                            brushSize={brushSize}
                            tool={tool}
                            isSoftErase={isSoftErase}
                            onMaskChange={setMaskDataUrl}
                            clearTrigger={clearCanvasTrigger}
                            magicWandTolerance={magicWandTolerance}
                            refineEdges={refineEdges}
                            loadMaskUrl={maskToLoad}
                            onMaskLoaded={() => setMaskToLoad(null)}
                            onSmartSelect={handleSmartSelect}
                            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        />
                    )}
                </div>
            )}
        </div>
        
        <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-2 backdrop-blur-sm">
            {(['edit', 'mask', 'crop', 'extend', 'adjust', 'filters', 'background'] as Tab[]).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base ${
                        activeTab === tab 
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>
        
        <div className="w-full">
            {activeTab === 'edit' && (
                <EditPanel
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    onGenerate={handleApplyGlobalEdit}
                    isLoading={isLoading}
                />
            )}
            {activeTab === 'mask' && (
                <MaskPanel
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    onGenerate={handleGenerate}
                    isLoading={isLoading}
                    hasMask={!!maskDataUrl}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    tool={tool}
                    onToolChange={handleToolChange}
                    isSoftErase={isSoftErase}
                    onIsSoftEraseChange={setIsSoftErase}
                    onClear={() => {
                        setClearCanvasTrigger(c => c + 1);
                        setMaskDataUrl(null);
                    }}
                    magicWandTolerance={magicWandTolerance}
                    onMagicWandToleranceChange={setMagicWandTolerance}
                    refineEdges={refineEdges}
                    onRefineEdgesChange={setRefineEdges}
                    onSelectSubject={handleSelectSubject}
                 />
            )}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'extend' && <ExtendPanel onApplyExtend={handleApplyExtend} onSetAspect={setExtendAspect} isLoading={isLoading} currentAspect={currentImage && imgRef.current?.naturalWidth ? imgRef.current.naturalWidth / imgRef.current.naturalHeight : 1} />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
            {activeTab === 'background' && <BackgroundPanel onRemoveBackground={handleRemoveBackground} onChangeBackground={handleChangeBackground} isLoading={isLoading} newBackgroundFile={newBackgroundFile} onNewBackgroundFileChange={setNewBackgroundFile} />}
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button 
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="Undo last action"
            >
                <UndoIcon className="w-5 h-5 mr-2" />
                Undo
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="Redo last action"
            >
                <RedoIcon className="w-5 h-5 mr-2" />
                Redo
            </button>
            
            <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>

            {canUndo && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                  aria-label="Press and hold to see original image"
              >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  Compare
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={!canUndo}
                className="text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
              >
                Reset
            </button>
            <button 
                onClick={handleUploadNew}
                className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
            >
                Upload New
            </button>

            <button 
                onClick={handleDownload}
                className="flex-grow sm:flex-grow-0 ml-auto bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
            >
                Download Image
            </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${currentImage ? 'items-start' : 'items-center'}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;