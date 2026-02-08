/**
 * BundledExportService
 * Exports timeline with all media files bundled in a ZIP
 */
class BundledExportService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export timeline with all media files bundled
     * @param {string} format - 'xml' or 'edl'
     * @param {Object} timelineData - Timeline data from PrevisManager
     * @param {string} projectName - Name of the project
     */
    async exportBundled(format, timelineData, projectName = 'Storyboard Timeline') {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Please refresh the page.');
        }

        const zip = new JSZip();
        
        // First, collect all images and build filename mapping
        // This ensures XML references match actual filenames in ZIP
        const clipToFilenameMap = new Map();
        const imageFiles = new Map(); // Track which images we've already added (by project image name)
        const videoClips = timelineData.timeline.filter(clip => 
            clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile)
        );

        // Build filename mapping first - process ALL clips, even if image lookup fails
        for (const clip of videoClips) {
            let image = null;
            let imageUrl = null;
            
            // For external files, check if clip has fileUrl directly (base64 data)
            if (clip.isExternalFile && clip.fileUrl && clip.fileUrl.startsWith('data:image/')) {
                // Use the clip's fileUrl directly - it contains the image data
                imageUrl = clip.fileUrl;
                // Create a virtual image object for processing
                image = { url: clip.fileUrl, name: clip.fileName || 'external_image' };
            } else if (clip.isExternalFile) {
                // Try multiple ways to find external file image in project
                image = this.app.project.images.find(img => 
                    img.name === clip.fileName || 
                    img.originalName === clip.fileName ||
                    (clip.fileName && img.name.includes(clip.fileName.split('.')[0]))
                );
            } else {
                // Storyboard clip - try multiple matching strategies
                image = this.app.project.images.find(img => 
                    img.name === clip.imageId || 
                    (img.sceneNumber === clip.sceneNumber && 
                     img.shotNumber === clip.shotNumber && 
                     img.frameNumber === clip.frameNumber) ||
                    (clip.imageId && img.name === clip.imageId)
                );
            }

            // Process clip if we have image data (either from lookup or from clip.fileUrl)
            if (image && image.url) {
                // Get the filename that will be used in XML (from clip)
                let xmlFilename = clip.fileName || clip.imageId || 'clip';
                // Extract just the filename (remove path if present)
                if (xmlFilename.includes('/')) {
                    xmlFilename = xmlFilename.split('/').pop();
                }
                if (xmlFilename.includes('\\')) {
                    xmlFilename = xmlFilename.split('\\').pop();
                }
                
                // Check if we've already processed this image (by project image name)
                let actualFilename = imageFiles.get(image.name);
                
                if (!actualFilename) {
                    // Determine file extension
                    let ext = 'jpg';
                    if (image.url.startsWith('data:image/')) {
                        const mimeMatch = image.url.match(/data:image\/([^;]+)/);
                        if (mimeMatch) {
                            ext = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1];
                        }
                    } else if (image.name) {
                        const nameExt = image.name.split('.').pop().toLowerCase();
                        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(nameExt)) {
                            ext = nameExt === 'jpeg' ? 'jpg' : nameExt;
                        }
                    }
                    
                    // Use XML filename if it has extension, otherwise use original name
                    if (xmlFilename.includes('.')) {
                        actualFilename = xmlFilename;
                    } else {
                        actualFilename = image.originalName || image.name || `image_${imageFiles.size + 1}.${ext}`;
                        // Ensure it has the correct extension
                        if (!actualFilename.includes('.')) {
                            actualFilename = `${actualFilename}.${ext}`;
                        }
                    }
                    imageFiles.set(image.name, actualFilename);
                }
                
                // Map clip to the actual filename (for EDL/XML path correction)
                clipToFilenameMap.set(clip.id, actualFilename);
            } else {
                // Image lookup failed - use clip data directly to create filename
                // This ensures ALL clips get a filename mapping
                let fallbackFilename = clip.fileName || clip.imageId || `clip_${clip.id}`;
                if (fallbackFilename.includes('/')) {
                    fallbackFilename = fallbackFilename.split('/').pop();
                }
                if (fallbackFilename.includes('\\')) {
                    fallbackFilename = fallbackFilename.split('\\').pop();
                }
                // Ensure it has an extension
                if (!fallbackFilename.includes('.')) {
                    fallbackFilename = `${fallbackFilename}.jpg`;
                }
                clipToFilenameMap.set(clip.id, fallbackFilename);
                console.warn('Image not found for clip, using fallback filename:', clip.id, fallbackFilename);
            }
        }

        // Now generate timeline file content with filename mapping
        let timelineContent = '';
        let extension = '';
        
        if (format === 'xml') {
            if (!this.app.xmlExportService) {
                if (typeof XMLExportService !== 'undefined') {
                    this.app.xmlExportService = new XMLExportService(this.app);
                } else {
                    throw new Error('XML export service not available');
                }
            }
            // Pass filename map to XML export for accurate references
            timelineContent = this.app.xmlExportService.exportToFCPXML(timelineData, projectName, true, clipToFilenameMap);
            extension = 'xml';
        } else if (format === 'edl') {
            if (!this.app.edlExportService) {
                if (typeof EDLExportService !== 'undefined') {
                    this.app.edlExportService = new EDLExportService(this.app);
                } else {
                    throw new Error('EDL export service not available');
                }
            }
            // Pass filename map and useRelativePaths flag for bundled EDL
            timelineContent = this.app.edlExportService.exportToEDL(timelineData, projectName, true, clipToFilenameMap);
            extension = 'edl';
        } else {
            throw new Error('Invalid format. Use "xml" or "edl"');
        }

        // Add timeline file to ZIP
        const timelineFilename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_timeline.${extension}`;
        zip.file(timelineFilename, timelineContent);

        // Add images folder to ZIP using the filenames from the mapping
        const imagesFolder = zip.folder('images');
        const addedFilenames = new Set(); // Track filenames already added to avoid duplicates

        for (const clip of videoClips) {
            const actualFilename = clipToFilenameMap.get(clip.id);
            if (actualFilename && !addedFilenames.has(actualFilename)) {
                let image = null;
                
                // Try multiple lookup strategies (same as in mapping phase)
                // First check if clip has fileUrl directly (for external files with base64 data)
                if (clip.isExternalFile && clip.fileUrl && clip.fileUrl.startsWith('data:image/')) {
                    // Use the clip's fileUrl directly
                    image = { url: clip.fileUrl, name: clip.fileName || 'external_image' };
                } else if (clip.isExternalFile) {
                    image = this.app.project.images.find(img => 
                        img.name === clip.fileName || 
                        img.originalName === clip.fileName ||
                        (clip.fileName && img.name.includes(clip.fileName.split('.')[0]))
                    );
                } else {
                    image = this.app.project.images.find(img => 
                        img.name === clip.imageId || 
                        (img.sceneNumber === clip.sceneNumber && 
                         img.shotNumber === clip.shotNumber && 
                         img.frameNumber === clip.frameNumber) ||
                        (clip.imageId && img.name === clip.imageId)
                    );
                }

                if (image && image.url) {
                    // Convert base64 data URL to binary
                    const base64Data = image.url.split(',')[1];
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    imagesFolder.file(actualFilename, bytes);
                    addedFilenames.add(actualFilename);
                } else {
                    // Image not found - log warning
                    console.warn('Image not found for clip, will be missing from ZIP:', clip.id, actualFilename, clip);
                }
            }
        }

        // Collect audio files and add to filename mapping
        const audioClips = timelineData.timeline.filter(clip => clip.fileType === 'audio');
        const addedAudioFiles = new Set();
        if (audioClips.length > 0) {
            const audioFolder = zip.folder('audio');
            
            for (const clip of audioClips) {
                if (clip.fileUrl) {
                    try {
                        // Get filename
                        let filename = clip.fileName || `audio_${audioClips.indexOf(clip) + 1}.mp3`;
                        if (filename.includes('/')) {
                            filename = filename.split('/').pop();
                        }
                        if (filename.includes('\\')) {
                            filename = filename.split('\\').pop();
                        }
                        
                        // Only add if not already added
                        if (!addedAudioFiles.has(filename)) {
                            // Fetch audio file
                            const response = await fetch(clip.fileUrl);
                            const blob = await response.blob();
                            const arrayBuffer = await blob.arrayBuffer();
                            
                            audioFolder.file(filename, arrayBuffer);
                            addedAudioFiles.add(filename);
                        }
                        
                        // Map clip to filename for EDL export
                        clipToFilenameMap.set(clip.id, filename);
                    } catch (error) {
                        console.warn('Failed to include audio file:', clip.fileName, error);
                    }
                }
            }
        }

        // Create README file with instructions
        const readmeContent = `DaVinci Resolve Import Instructions
=====================================

1. Extract this ZIP file to a folder on your computer.
   IMPORTANT: Keep the folder structure intact (${extension} file and images/ folder should be in the same directory).

2. Open DaVinci Resolve.

3. Import the media files FIRST:
   - Go to the Media Pool
   - Right-click and select "Import Media"
   - Navigate to the extracted folder
   - Select the "images" folder (or select all image files)
   - Click "Open" to import all images into the Media Pool

4. Import the timeline:
   - Go to File > Import > Timeline
   - Select the "${timelineFilename}" file
   - DaVinci Resolve will attempt to link the media files by filename

5. If files don't link automatically:
   - Right-click on any unlinked clip in the timeline
   - Select "Relink Selected Clips"
   - Navigate to the "images" folder
   - Select the corresponding image file
   - DaVinci should then link all files with matching names

Note: The ${extension.toUpperCase()} file references files using relative paths (images/filename.jpg).
The images must be imported into DaVinci's Media Pool before importing the timeline.
DaVinci matches files by filename, so make sure the filenames match exactly.
`;
        
        zip.file('README.txt', readmeContent);

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // Download ZIP
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const zipFilename = `${projectName.replace(/[^a-z0-9]/gi, '_')}_timeline_bundle.zip`;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
