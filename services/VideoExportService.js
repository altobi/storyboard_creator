/**
 * VideoExportService
 * Exports previz timeline to video file (MP4/WebM)
 */
class VideoExportService {
    constructor(app) {
        this.app = app;
        this.isExporting = false;
        this.exportProgress = 0;
    }

    /**
     * Calculate default resolutions based on project aspect ratio
     */
    getDefaultResolutions() {
        const aspectRatio = this.app.project?.settings?.imageAspectRatio || '16:9';
        let aspectValue = 16 / 9; // Default
        
        if (aspectRatio === 'custom') {
            const width = this.app.project.settings.customAspectRatioWidth || 16;
            const height = this.app.project.settings.customAspectRatioHeight || 9;
            aspectValue = width / height;
        } else if (aspectRatio !== 'none') {
            const parts = aspectRatio.split(':');
            if (parts.length === 2) {
                aspectValue = parseFloat(parts[0]) / parseFloat(parts[1]);
            }
        }
        
        // Calculate resolutions maintaining aspect ratio
        const resolutions = [
            { label: '1920x' + Math.round(1920 / aspectValue) + ' (Full HD)', value: `1920x${Math.round(1920 / aspectValue)}` },
            { label: '1280x' + Math.round(1280 / aspectValue) + ' (HD)', value: `1280x${Math.round(1280 / aspectValue)}` },
            { label: '854x' + Math.round(854 / aspectValue) + ' (SD)', value: `854x${Math.round(854 / aspectValue)}` }
        ];
        
        return resolutions;
    }

    /**
     * Show export settings dialog
     */
    async showExportDialog() {
        const timelineData = this.app.previsController?.previsManager?.getTimelineData();
        const actualDuration = this.calculateActualDuration(timelineData);
        const frameRate = timelineData?.frameRate || 24;
        const totalFrames = Math.ceil(actualDuration * frameRate);
        
        const defaultResolutions = this.getDefaultResolutions();
        
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Export Video</h2>
                        <span class="close" onclick="this.closest('.modal').style.display='none'">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 16px;">
                            <label for="exportFormat" style="display: block; margin-bottom: 8px;">Format:</label>
                            <select id="exportFormat" style="width: 100%; padding: 8px;">
                                <option value="mp4" selected>MP4 (H.264)</option>
                                <option value="webm">WebM (VP9)</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label for="exportResolution" style="display: block; margin-bottom: 8px;">Resolution:</label>
                            <select id="exportResolution" style="width: 100%; padding: 8px; margin-bottom: 8px;">
                                ${defaultResolutions.map(r => `<option value="${r.value}">${r.label}</option>`).join('')}
                                <option value="custom">Custom...</option>
                            </select>
                            <div id="customResolutionContainer" style="display: none; gap: 8px; align-items: center;">
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <input type="number" id="exportWidth" min="1" max="1920" placeholder="Width" style="flex: 1; padding: 8px;">
                                    <span>x</span>
                                    <input type="number" id="exportHeight" min="1" max="1920" placeholder="Height" style="flex: 1; padding: 8px;">
                                </div>
                            </div>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label for="exportFPS" style="display: block; margin-bottom: 8px;">Frame Rate:</label>
                            <select id="exportFPS" style="width: 100%; padding: 8px;">
                                <option value="24">24 fps</option>
                                <option value="30">30 fps</option>
                                <option value="60">60 fps</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label for="exportQuality" style="display: block; margin-bottom: 8px;">Quality:</label>
                            <select id="exportQuality" style="width: 100%; padding: 8px;">
                                <option value="high">High</option>
                                <option value="medium" selected>Medium</option>
                                <option value="low">Low (Faster)</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px;">Export Region:</label>
                            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                                <label style="flex: 1; font-size: 12px;">Start:</label>
                                <input type="number" id="exportStartTime" min="0" step="0.001" value="0" style="flex: 1; padding: 8px;" placeholder="Seconds">
                                <span style="font-size: 12px;">or</span>
                                <input type="number" id="exportStartFrame" min="0" step="1" value="0" style="flex: 1; padding: 8px;" placeholder="Frames">
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <label style="flex: 1; font-size: 12px;">End:</label>
                                <input type="number" id="exportEndTime" min="0" step="0.001" value="${actualDuration.toFixed(3)}" style="flex: 1; padding: 8px;" placeholder="Seconds">
                                <span style="font-size: 12px;">or</span>
                                <input type="number" id="exportEndFrame" min="0" step="1" value="${totalFrames}" style="flex: 1; padding: 8px;" placeholder="Frames">
                            </div>
                            <div style="font-size: 11px; color: #888; margin-top: 4px;">
                                Timeline duration: ${actualDuration.toFixed(2)}s (${totalFrames} frames @ ${frameRate}fps)
                            </div>
                        </div>
                        <div id="exportProgressContainer" style="display: none; margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>Progress:</span>
                                <span id="exportProgressText">0%</span>
                            </div>
                            <div style="width: 100%; height: 20px; background: #333; border-radius: 4px; overflow: hidden;">
                                <div id="exportProgressBar" style="width: 0%; height: 100%; background: #007acc; transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button id="exportCancelBtn" class="btn btn-secondary">Cancel</button>
                        <button id="exportStartBtn" class="btn btn-primary">Export</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Handle custom resolution
            const resolutionSelect = document.getElementById('exportResolution');
            const customContainer = document.getElementById('customResolutionContainer');
            const widthInput = document.getElementById('exportWidth');
            const heightInput = document.getElementById('exportHeight');
            
            resolutionSelect.addEventListener('change', () => {
                if (resolutionSelect.value === 'custom') {
                    customContainer.style.display = 'block';
                } else {
                    customContainer.style.display = 'none';
                }
            });
            
            // Sync time/frame inputs
            const startTimeInput = document.getElementById('exportStartTime');
            const startFrameInput = document.getElementById('exportStartFrame');
            const endTimeInput = document.getElementById('exportEndTime');
            const endFrameInput = document.getElementById('exportEndFrame');
            
            startTimeInput.addEventListener('input', () => {
                startFrameInput.value = Math.round(startTimeInput.value * frameRate);
            });
            startFrameInput.addEventListener('input', () => {
                startTimeInput.value = (startFrameInput.value / frameRate).toFixed(3);
            });
            endTimeInput.addEventListener('input', () => {
                endFrameInput.value = Math.round(endTimeInput.value * frameRate);
            });
            endFrameInput.addEventListener('input', () => {
                endTimeInput.value = (endFrameInput.value / frameRate).toFixed(3);
            });

            const closeModal = () => {
                modal.style.display = 'none';
                document.body.removeChild(modal);
            };

            document.getElementById('exportCancelBtn').addEventListener('click', () => {
                closeModal();
                resolve(null);
            });

            document.getElementById('exportStartBtn').addEventListener('click', async () => {
                const format = document.getElementById('exportFormat').value;
                let resolution = document.getElementById('exportResolution').value;
                const fps = parseInt(document.getElementById('exportFPS').value);
                const quality = document.getElementById('exportQuality').value;
                
                // Handle custom resolution
                if (resolution === 'custom') {
                    const width = parseInt(widthInput.value);
                    const height = parseInt(heightInput.value);
                    if (!width || !height || width < 1 || height < 1 || width > 1920 || height > 1920) {
                        await this.app.customAlert('Please enter valid resolution values (1-1920 for each dimension)');
                        return;
                    }
                    resolution = `${width}x${height}`;
                }
                
                // Get export region
                const startTime = parseFloat(document.getElementById('exportStartTime').value) || 0;
                const endTime = parseFloat(document.getElementById('exportEndTime').value) || actualDuration;
                const startFrame = parseInt(document.getElementById('exportStartFrame').value) || 0;
                const endFrame = parseInt(document.getElementById('exportEndFrame').value) || totalFrames;
                
                // Validate region (allow small floating point differences)
                const epsilon = 0.001; // Small tolerance for floating point precision
                if (startTime < 0 || endTime <= startTime || endTime > actualDuration + epsilon) {
                    await this.app.customAlert(`Invalid export region. Start must be >= 0, End must be > Start and <= timeline duration (${actualDuration.toFixed(2)}s).`);
                    return;
                }
                
                // Use time-based values (more precise)
                const exportStart = Math.max(0, startTime);
                const exportEnd = Math.min(actualDuration, endTime);

                const settings = { 
                    format, 
                    resolution, 
                    fps, 
                    quality,
                    startTime: exportStart,
                    endTime: exportEnd
                };
                
                // Show progress
                document.getElementById('exportProgressContainer').style.display = 'block';
                document.getElementById('exportStartBtn').disabled = true;
                document.getElementById('exportCancelBtn').disabled = true;

                try {
                    await this.exportVideo(settings, (progress) => {
                        document.getElementById('exportProgressBar').style.width = progress + '%';
                        document.getElementById('exportProgressText').textContent = Math.round(progress) + '%';
                    });
                    closeModal();
                    resolve(settings);
                } catch (error) {
                    console.error('Export error:', error);
                    await this.app.customAlert('Export failed: ' + error.message);
                    closeModal();
                    resolve(null);
                }
            });

            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                    resolve(null);
                }
            });
        });
    }

    /**
     * Calculate actual timeline duration (excluding buffer)
     */
    calculateActualDuration(timelineData) {
        if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
            return 0;
        }
        
        // Find the latest end time of any clip (video, audio, or image)
        let maxEndTime = 0;
        timelineData.timeline.forEach(clip => {
            const endTime = clip.endTime || (clip.startTime + clip.duration);
            if (endTime > maxEndTime) {
                maxEndTime = endTime;
            }
        });
        
        return maxEndTime;
    }

    /**
     * Export timeline to video
     */
    async exportVideo(settings, progressCallback) {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        if (!this.app.previsController || !this.app.previsController.previsManager) {
            throw new Error('No timeline data available');
        }

        this.isExporting = true;
        this.exportProgress = 0;

        try {
            const timelineData = this.app.previsController.previsManager.getTimelineData();
            if (!timelineData || !timelineData.timeline || timelineData.timeline.length === 0) {
                throw new Error('Timeline is empty');
            }

            const [width, height] = settings.resolution.split('x').map(Number);
            const fps = settings.fps;
            const frameRate = fps;

            // Create canvas for rendering
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Get video preview element to capture from
            const videoPreview = document.getElementById('previzVideoPreview');
            if (!videoPreview) {
                throw new Error('Video preview element not found');
            }

            // Sort timeline by start time
            const sortedClips = [...timelineData.timeline].sort((a, b) => a.startTime - b.startTime);
            
            // Use export region if specified, otherwise use actual duration
            const actualDuration = this.calculateActualDuration(timelineData);
            const exportStart = settings.startTime !== undefined ? settings.startTime : 0;
            const exportEnd = settings.endTime !== undefined ? settings.endTime : actualDuration;
            const totalDuration = exportEnd - exportStart;

            // Determine MIME type and codec
            let mimeType = 'video/webm';
            let codec = 'vp9';
            if (settings.format === 'mp4') {
                // Use avc3 instead of avc1 for better compatibility (avoids codec description changes)
                if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc3.42E01E')) {
                    mimeType = 'video/mp4';
                    codec = 'avc3.42E01E';
                } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E')) {
                    mimeType = 'video/mp4';
                    codec = 'avc1.42E01E';
                } else {
                    // Fallback to WebM
                    mimeType = 'video/webm';
                    codec = 'vp8';
                }
            }

            // Create MediaRecorder
            const stream = canvas.captureStream(frameRate);
            
            // Check if codec is supported
            let finalMimeType = mimeType;
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                // Fallback to WebM
                finalMimeType = 'video/webm';
                codec = 'vp8';
            }
            
            // Optimize bitrate for faster encoding (especially for MP4)
            let bitrate = this.getBitrate(settings.quality, width, height);
            if (settings.format === 'mp4' && settings.quality !== 'high') {
                // Reduce bitrate for faster MP4 encoding
                bitrate = Math.floor(bitrate * 0.6); // 40% reduction for medium/low quality
            }

            return new Promise(async (resolve, reject) => {
                try {
                    // Preload all images first
                    const imageCache = new Map();
                    await this.preloadImages(sortedClips, imageCache, progressCallback);

                    // Setup audio mixing
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioDestination = audioContext.createMediaStreamDestination();
                    
                    // Mix audio tracks
                    const audioClips = sortedClips.filter(clip => clip.fileType === 'audio');
                    const audioSources = [];
                    const audioBuffers = new Map();
                    
                    // Preload audio buffers
                    for (const audioClip of audioClips) {
                        if (audioClip.fileUrl && audioClip.startTime < exportEnd && audioClip.endTime > exportStart) {
                            try {
                                const audioBuffer = await this.loadAudioBuffer(audioContext, audioClip.fileUrl);
                                audioBuffers.set(audioClip.id, audioBuffer);
                            } catch (error) {
                                console.warn('Failed to load audio clip:', audioClip.fileName, error);
                            }
                        }
                    }
                    
                    // Create MediaRecorder with video stream first (audio will be added if available)
                    let finalStream = stream;
                    
                    // Only combine audio if we have audio clips
                    if (audioClips.length > 0 && audioDestination.stream.getAudioTracks().length > 0) {
                        finalStream = new MediaStream([
                            ...stream.getVideoTracks(),
                            ...audioDestination.stream.getAudioTracks()
                        ]);
                    }
                    
                    // Create MediaRecorder with stream
                    const mediaRecorder = new MediaRecorder(finalStream, {
                        mimeType: finalMimeType,
                        videoBitsPerSecond: bitrate
                    });
                    
                    const chunks = [];
                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            chunks.push(event.data);
                        }
                    };
                    
                    mediaRecorder.onstop = () => {
                        const blob = new Blob(chunks, { type: finalMimeType });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const projectName = this.app.project.name || 'Storyboard';
                        const extension = finalMimeType.includes('mp4') ? 'mp4' : 'webm';
                        a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_export.${extension}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        this.isExporting = false;
                        // Cleanup audio
                        audioSources.forEach(({ source }) => {
                            try { source.stop(); } catch(e) {}
                        });
                        audioContext.close();
                        resolve();
                    };
                    
                    mediaRecorder.onerror = (event) => {
                        this.isExporting = false;
                        // Cleanup audio
                        audioSources.forEach(({ source }) => {
                            try { source.stop(); } catch(e) {}
                        });
                        audioContext.close();
                        reject(new Error('MediaRecorder error: ' + (event.error || 'Unknown error')));
                    };

                    // Draw first frame before starting recording to ensure canvas is ready
                    const timelineTime = exportStart;
                    const firstClip = sortedClips.find(clip => {
                        const isVideoOrImage = clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile);
                        return isVideoOrImage && timelineTime >= clip.startTime && timelineTime < clip.endTime;
                    });
                    
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, width, height);
                    if (firstClip) {
                        await this.drawClipFromCache(ctx, firstClip, width, height, imageCache);
                    }
                    
                    // Wait a frame to ensure canvas is rendered
                    await new Promise(resolve => requestAnimationFrame(resolve));

                    // Start recording
                    mediaRecorder.start();

                    // Wait a bit for MediaRecorder to initialize, then start audio
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Now start audio sources (synchronized with MediaRecorder)
                    const recordingStartTime = audioContext.currentTime;
                    for (const audioClip of audioClips) {
                        if (audioBuffers.has(audioClip.id)) {
                            const audioBuffer = audioBuffers.get(audioClip.id);
                            const source = audioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            
                            // Calculate offset and duration for this clip within export region
                            const clipStartInExport = Math.max(0, audioClip.startTime - exportStart);
                            const clipEndInExport = Math.min(totalDuration, audioClip.endTime - exportStart);
                            const clipDurationInExport = clipEndInExport - clipStartInExport;
                            
                            if (clipDurationInExport > 0) {
                                const gainNode = audioContext.createGain();
                                source.connect(gainNode);
                                gainNode.connect(audioDestination);
                                
                                // Calculate audio offset within the clip
                                const audioStartOffset = audioClip.audioStartOffset || 0;
                                
                                // Start audio at the right time relative to recording start
                                const startDelay = clipStartInExport;
                                source.start(recordingStartTime + startDelay, audioStartOffset, clipDurationInExport);
                                
                                audioSources.push({ source, gainNode });
                            }
                        }
                    }

                // Render frames
                const frameDuration = 1 / frameRate;
                let currentTime = frameDuration; // Start from second frame (first already drawn)
                let frameCount = 1; // First frame already drawn
                const totalFrames = Math.ceil(totalDuration * frameRate);

                const renderFrame = async () => {
                    if (currentTime >= totalDuration) {
                        // Wait a bit before stopping to ensure last frame is captured
                        setTimeout(() => {
                            mediaRecorder.stop();
                        }, 500);
                        return;
                    }

                    // Calculate timeline time (accounting for export start offset)
                    const timelineTime = exportStart + currentTime;

                    // Find current clip (prioritize video/image clips)
                    const currentClip = sortedClips.find(clip => {
                        const isVideoOrImage = clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile);
                        return isVideoOrImage && timelineTime >= clip.startTime && timelineTime < clip.endTime;
                    });

                    // Clear canvas
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, width, height);

                    if (currentClip) {
                        // Draw clip using cached image
                        await this.drawClipFromCache(ctx, currentClip, width, height, imageCache);
                    }

                    // Update progress (50% for image loading, 50% for rendering)
                    frameCount++;
                    const renderProgress = (frameCount / totalFrames) * 100;
                    const totalProgress = 50 + (renderProgress * 0.5); // Second half of progress
                    this.exportProgress = totalProgress;
                    if (progressCallback) {
                        progressCallback(totalProgress);
                    }

                    // Advance time
                    currentTime += frameDuration;

                    // Use requestAnimationFrame for smooth rendering, then setTimeout for timing
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            renderFrame();
                        }, Math.max(1, (frameDuration * 1000) - 5));
                    });
                };

                // Start rendering after a small delay to ensure MediaRecorder is ready
                setTimeout(() => {
                    renderFrame();
                }, 100);
                } catch (error) {
                    this.isExporting = false;
                    reject(error);
                }
            });
        } catch (error) {
            this.isExporting = false;
            throw error;
        }
    }

    /**
     * Preload all images for export
     */
    async preloadImages(clips, cache, progressCallback) {
        const imageClips = clips.filter(clip => {
            return clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile);
        });
        const total = imageClips.length;
        let loaded = 0;

        const loadPromises = imageClips.map(clip => {
            return new Promise((resolve) => {
                // Try multiple sources for image URL
                let imageUrl = clip.imageUrl || clip.fileUrl || clip.thumbnail || clip.url;
                
                // For storyboard clips, check if they have a compositeUrl (edited images)
                if (!imageUrl && !clip.isExternalFile) {
                    // Try to find the original image from project
                    const projectImage = this.app.project?.images?.find(img => 
                        img.name === clip.imageId || img.sceneNumber === clip.sceneNumber && img.shotNumber === clip.shotNumber && img.frameNumber === clip.frameNumber
                    );
                    if (projectImage) {
                        imageUrl = projectImage.compositeUrl || projectImage.url;
                    }
                }
                
                if (!imageUrl) {
                    console.warn('No image URL found for clip:', clip.id, clip);
                    loaded++;
                    if (progressCallback) {
                        progressCallback((loaded / total) * 50); // First 50% for loading
                    }
                    resolve();
                    return;
                }

                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    cache.set(clip.id, img);
                    loaded++;
                    if (progressCallback) {
                        progressCallback((loaded / total) * 50); // First 50% for loading
                    }
                    resolve();
                };
                
                img.onerror = () => {
                    // Create a placeholder image
                    const placeholder = document.createElement('canvas');
                    placeholder.width = 1920;
                    placeholder.height = 1080;
                    const placeholderCtx = placeholder.getContext('2d');
                    placeholderCtx.fillStyle = '#333333';
                    placeholderCtx.fillRect(0, 0, 1920, 1080);
                    placeholderCtx.fillStyle = '#ffffff';
                    placeholderCtx.font = '48px Arial';
                    placeholderCtx.textAlign = 'center';
                    placeholderCtx.fillText('Image not available', 960, 540);
                    cache.set(clip.id, placeholder);
                    loaded++;
                    if (progressCallback) {
                        progressCallback((loaded / total) * 50);
                    }
                    resolve();
                };
                
                img.src = imageUrl;
            });
        });

        await Promise.all(loadPromises);
    }

    /**
     * Draw a clip on canvas from cache
     */
    async drawClipFromCache(ctx, clip, width, height, imageCache) {
        const img = imageCache.get(clip.id);
        
        if (!img) {
            // Draw black if no image
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        // Calculate aspect ratio and fit
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
            // Image is wider - fit to width
            drawWidth = width;
            drawHeight = width / imgAspect;
            drawX = 0;
            drawY = (height - drawHeight) / 2;
        } else {
            // Image is taller - fit to height
            drawHeight = height;
            drawWidth = height * imgAspect;
            drawX = (width - drawWidth) / 2;
            drawY = 0;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }

    /**
     * Load audio buffer from URL
     */
    async loadAudioBuffer(audioContext, url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    }

    /**
     * Get bitrate based on quality and resolution
     */
    getBitrate(quality, width, height) {
        const pixels = width * height;
        const baseBitrate = {
            low: 1000000,      // 1 Mbps
            medium: 5000000,   // 5 Mbps
            high: 10000000     // 10 Mbps
        };

        // Scale based on resolution
        const scale = pixels / (1920 * 1080);
        return Math.floor(baseBitrate[quality] * scale);
    }
}
