/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const dataUrlToPart = (dataUrl: string): { inlineData: { mimeType: string; data: string; } } => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an edited image using generative AI based on a text prompt and a user-drawn mask.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param maskImage The user-drawn mask as a base64 data URL string.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    maskImage: string
): Promise<string> => {
    console.log('Starting generative edit with mask.');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const maskImagePart = dataUrlToPart(maskImage);

    const prompt = `You are an expert, high-fidelity photo editing AI. Your primary function is to edit ONLY the user-specified region of an image, defined by a mask, with maximum precision and realism.

The user has provided three inputs:
1. The original image. Note: This image may be the result of previous edits. Your task is to build upon its current state.
2. A mask image: White areas in this mask pinpoint the EXACT pixels to be modified. Black areas MUST be preserved perfectly, down to the pixel.
3. A text prompt describing the desired edit for the masked (white) area.

User Request: "${userPrompt}"

**Critical Editing Instructions:**
- **Absolute Mask Adherence:** Your edit MUST be confined exclusively to the white areas of the mask. The pixels corresponding to the black areas must remain absolutely unchanged from the original image. This is the most important rule. Any "bleeding" of the edit into the black areas is a failure.
- **Seamless Integration:** The edited (white) area must blend realistically and seamlessly with the unedited (black) area. Pay close attention to matching the original image's lighting, shadows, texture, noise grain, and camera focus (depth of field) within the edited area.
- **Maintain Quality:** The resolution, clarity, and overall quality of the edited portion must match the source image. Do not introduce artifacts or lower the quality.
- **Photorealism is Key:** The final image must look like a real, unedited photograph.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final, edited image in the highest possible quality. Do not include any text, explanations, or apologies.`;
    const textPart = { text: prompt };

    console.log('Sending image, mask, and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, maskImagePart, textPart] },
    });
    console.log('Received response from model.', response);

    return handleApiResponse(response, 'edit');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI specializing in artistic filters. Your task is to apply a stylistic filter to the entire image based on the user's request, while preserving the integrity of the original photo's content.

Filter Request: "${filterPrompt}"

**Critical Filter Instructions:**
- **Preserve Content:** The core subject matter, composition, and details of the image must remain unchanged. The filter should enhance the image's style, not obscure or alter its content.
- **Apply Globally & Consistently:** The filter should be applied evenly across the entire image for a cohesive look.
- **High Quality:** The output must be a high-resolution, professional-quality photograph with the new style applied. Avoid introducing compression artifacts or reducing detail.

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and filter prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo retoucher AI. Your task is to perform a subtle, professional, and photorealistic adjustment to the entire image based on the user's request. The goal is to make the image look as if it were originally captured with these properties.

User Request: "${adjustmentPrompt}"

**Critical Adjustment Guidelines:**
- **Photorealism Above All:** The result must look like a real photograph. The adjustment should be subtle and natural.
- **Avoid Over-processing:** Do not create an overly edited or artificial look. Preserve the original details, texture, and grain of the image.
- **Global Application:** The adjustment must be applied consistently across the entire image.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final adjusted image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and adjustment prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for adjustment.', response);
    
    return handleApiResponse(response, 'adjustment');
};

/**
 * Generates a globally edited image based on a text prompt.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateGlobalEdit = async (
    originalImage: File,
    userPrompt: string,
): Promise<string> => {
    console.log(`Starting global edit generation: ${userPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert, creative photo editing AI. Your task is to perform a major, global edit on the entire image based on the user's request. You can add, remove, or change objects, alter the environment, and apply complex stylistic changes. The result must be a cohesive and photorealistic masterpiece.

User Request: "${userPrompt}"

**Critical Editing Guidelines:**
- **Creative Interpretation:** Fulfill the user's prompt by creatively reinterpreting the entire image as needed.
- **Seamless Compositing:** Any new elements must perfectly match the original image's perspective, lighting, shadows, color temperature, and overall quality to create a single, believable composition.
- **High-Fidelity Output:** The result must be a high-resolution and photorealistic image.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and global edit prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for global edit.', response);
    
    return handleApiResponse(response, 'global edit');
};

/**
 * Generates a segmentation mask for the main subject of an image.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the black and white mask image.
 */
export const generateSubjectMask = async (
    originalImage: File
): Promise<string> => {
    console.log('Starting subject mask generation.');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are a high-precision image segmentation AI. Your sole purpose is to identify the primary subject in the provided image and create a perfect, corresponding mask.

**Instructions:**
1.  Analyze the image to determine the main subject. This is typically the element that the photo is focused on, such as a person, animal, or the most prominent foreground object.
2.  Generate a new image that is a black and white mask of the identified subject.
3.  The mask image MUST be the exact same dimensions as the original image.
4.  The area corresponding to the main subject MUST be solid white (#FFFFFF).
5.  All other areas (the background) MUST be solid black (#000000).
6.  **Edge Precision is Critical:** The edges of the mask must be extremely clean and precise. Pay special attention to fine details like hair, fur, or complex edges to create a professional-grade mask. Do not include any gray pixels, feathering, or anti-aliasing.

Output: Return ONLY the final, black and white mask image. Do not include any text, explanations, or other content.`;
    const textPart = { text: prompt };

    console.log('Sending image to the model for subject segmentation...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for subject mask.', response);

    return handleApiResponse(response, 'subject mask');
};

/**
 * Generates a segmentation mask for an object at a specific point in an image.
 * @param originalImage The original image file.
 * @param point The {x, y} coordinate of the click on the object.
 * @returns A promise that resolves to the data URL of the black and white mask image.
 */
export const generateObjectMask = async (
    originalImage: File,
    point: { x: number; y: number }
): Promise<string> => {
    console.log(`Starting smart selection mask generation at point (${point.x}, ${point.y}).`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    // Create a temporary canvas to draw the image and the selection dot
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not create canvas context for smart selection.");

    const img = new Image();
    const objectUrl = URL.createObjectURL(originalImage);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
    });
    
    URL.revokeObjectURL(objectUrl);

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Draw a uniquely colored dot at the specified point
    ctx.beginPath();
    const radius = Math.max(5, Math.min(canvas.width, canvas.height) * 0.005);
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#FF00FF'; // Bright magenta
    ctx.fill();

    const imageWithDotDataUrl = canvas.toDataURL('image/png');
    const imageWithDotPart = dataUrlToPart(imageWithDotDataUrl);

    const prompt = `You are a high-precision image segmentation AI. The user has provided an image with a single, bright magenta dot (#FF00FF). Your task is to identify the specific object located directly under that dot and create a perfect mask for the entire object.

**Instructions:**
1.  Analyze the image to find the magenta dot.
2.  Identify the single, complete object that the dot is pointing to.
3.  Generate a new image that is a black and white mask of ONLY that identified object.
4.  The mask image MUST be the exact same dimensions as the original image.
5.  The area corresponding to the object MUST be solid white (#FFFFFF).
6.  All other areas (the background and other objects) MUST be solid black (#000000).
7.  **Edge Precision is Critical:** The edges of the mask should be sharp and clean, capturing the full boundary of the object. Do not include any gray pixels, feathering, or anti-aliasing.

Output: Return ONLY the final, black and white mask image. Do not include any text, explanations, or other content.`;
    const textPart = { text: prompt };

    console.log('Sending image with selection dot to model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imageWithDotPart, textPart] },
    });
    console.log('Received response from model for smart select mask.', response);

    return handleApiResponse(response, 'smart select mask');
};


/**
 * Extends an image by filling in transparent areas (outpainting).
 * @param compositeImage A data URL of the original image centered on a transparent canvas.
 * @returns A promise that resolves to the data URL of the extended image.
 */
export const generateExtendedImage = async (
    compositeImage: string,
): Promise<string> => {
    console.log('Starting generative extend (outpainting).');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const compositeImagePart = dataUrlToPart(compositeImage);

    const prompt = `You are an expert photo restoration and editing AI specializing in outpainting. Your task is to "uncrop" an image by intelligently filling in the surrounding transparent areas.

The user has provided an image on a larger, transparent canvas. The original image is centered, and the surrounding area is transparent.

**Critical Instructions:**
- **Fill Transparent Areas:** Your only job is to generate new, realistic image data to fill the transparent pixels.
- **Preserve Original Pixels:** You MUST NOT change any of the existing, non-transparent pixels from the original image. They are the ground truth and must be preserved perfectly.
- **Seamless Blending:** The newly generated content must seamlessly and realistically blend with the original image's edges in terms of style, lighting, color, texture, and subject matter. The transition should be completely invisible.
- **Maintain Context and Perspective:** The generated content should logically extend the scene in the original image, continuing patterns, landscapes, and objects in a physically plausible way. The extension must match the original image's artistic style, camera angle, and lens properties (like depth of field and perspective).

Output: Return ONLY the final, fully filled-in, rectangular image. Do not include any text or explanations.`;
    const textPart = { text: prompt };

    console.log('Sending composite image to model for outpainting...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [compositeImagePart, textPart] },
    });
    console.log('Received response from model for extend.', response);
    
    return handleApiResponse(response, 'extend');
};

/**
 * Removes the background from an image, leaving the subject on a transparent background.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the image with a transparent background.
 */
export const removeBackgroundImage = async (
    originalImage: File
): Promise<string> => {
    console.log('Starting background removal.');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are a precision, professional-grade photo editing AI. Your sole task is to identify the main subject(s) in the image, create a perfect cutout, and place the subject(s) on a transparent background.

**Critical Rules:**
1.  **Identify and Preserve Subject:** Accurately find the most prominent subject(s) (e.g., person, animal, car). This is the foreground content and it MUST be preserved with all its details.
2.  **Complete Background Removal:** Make everything that is not the subject completely transparent (alpha channel = 0).
3.  **DO NOT RETURN AN EMPTY IMAGE:** It is a critical failure to return a completely transparent image. If the subject is ambiguous, you must make a best-effort guess and preserve the most likely object in the foreground. Never erase the entire image.
4.  **Professional-Quality Edges:** The cutout of the subject must have clean, precise, and finely detailed edges. Pay special attention to semi-transparent areas and complex details like hair, fur, or fabric textures to ensure a natural-looking extraction.
5.  **Output:** Return ONLY the final PNG image with a transparent background. Do not include any text.`;
    const textPart = { text: prompt };

    console.log('Sending image to model for background removal...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for background removal.', response);

    return handleApiResponse(response, 'background removal');
};

/**
 * Composites a foreground image onto a new background image.
 * @param foregroundImage The image of the subject with a transparent background.
 * @param backgroundImage The new background image.
 * @returns A promise that resolves to the data URL of the final composite image.
 */
export const changeBackgroundImage = async (
    foregroundImage: File,
    backgroundImage: File
): Promise<string> => {
    console.log('Starting background change.');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const foregroundImagePart = await fileToPart(foregroundImage);
    const backgroundImagePart = await fileToPart(backgroundImage);

    const prompt = `You are a world-class visual effects and photo compositing AI. You will receive two images: a 'foreground' image containing a subject on a transparent background, and a 'background' image. Your task is to flawlessly integrate the subject from the foreground image into the background image. The final composite must be indistinguishable from a real photograph.

**Your process must meticulously account for the following:**
1.  **Scale & Perspective**: Analyze the background image to determine its perspective lines and depth. Place and scale the foreground subject so that it fits realistically within the scene.
2.  **Lighting, Shadows, & Reflections**: This is critical for realism.
    - **Lighting Match**: The lighting on the subject (direction, color, intensity, softness) must perfectly match the lighting of the background scene.
    - **Shadows**: Generate soft, realistic contact shadows where the subject touches surfaces, and accurate cast shadows that follow the direction of the scene's primary light source.
    - **Reflections**: If the background has reflective surfaces (water, glass, metal), add subtle, physically accurate reflections of the subject.
3.  **Color Grading & Integration**: Perform a final, holistic color grade on the entire composite image. This includes perfectly matching the black levels, white balance, saturation, and overall color tones between the subject and the background.
4.  **Atmospheric Effects**: Integrate the subject with the background's atmosphere. If the scene has haze, fog, or dust, the subject should be appropriately affected by it based on its distance from the camera. The subject's focus should also match the background's depth of field.

Output: Return ONLY the final, masterfully composited image. Do not include any text or explanations.`;
    const textPart = { text: prompt };

    console.log('Sending foreground and background to model for compositing...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [backgroundImagePart, foregroundImagePart, textPart] },
    });
    console.log('Received response from model for background change.', response);

    return handleApiResponse(response, 'background change');
};