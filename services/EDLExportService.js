/**
 * EDLExportService
 * Exports previz timeline to EDL (Edit Decision List) format (compatible with DaVinci Resolve, Premiere, etc.)
 */
class EDLExportService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export timeline to EDL format
     * @param {Object} timelineData - Timeline data from PrevisManager
     * @param {string} projectName - Name of the project
     * @returns {string} EDL string
     */
    exportToEDL(timelineData, projectName = 'Storyboard Timeline', useRelativePaths = false, clipToFilenameMap = null, exportFolderPath = null) {
        const { timeline, frameRate = 24, totalDuration = 0 } = timelineData;
        
        if (!timeline || timeline.length === 0) {
            throw new Error('Timeline is empty');
        }
        
        // Helper function to convert seconds to timecode (HH:MM:SS:FF)
        const secondsToTimecode = (seconds) => {
            const totalFrames = Math.floor(seconds * frameRate);
            const hours = Math.floor(totalFrames / (frameRate * 3600));
            const minutes = Math.floor((totalFrames % (frameRate * 3600)) / (frameRate * 60));
            const secs = Math.floor((totalFrames % (frameRate * 60)) / frameRate);
            const frames = totalFrames % frameRate;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
        };
        
        // Sort timeline by start time
        const sortedTimeline = [...timeline].sort((a, b) => {
            if (a.startTime !== b.startTime) {
                return a.startTime - b.startTime;
            }
            // If same start time, prioritize video/image over audio
            const aIsVideo = a.fileType === 'image' || a.fileType === 'video' || (!a.fileType && !a.isExternalFile);
            const bIsVideo = b.fileType === 'image' || b.fileType === 'video' || (!b.fileType && !b.isExternalFile);
            if (aIsVideo && !bIsVideo) return -1;
            if (!aIsVideo && bIsVideo) return 1;
            return 0;
        });
        
        // Separate video and audio clips
        const videoClips = sortedTimeline.filter(clip => {
            return clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile);
        });
        
        // Build EDL
        let edl = `TITLE: ${this.escapeEDL(projectName)}\n`;
        edl += `FCM: NON-DROP FRAME\n`;
        
        // Add frame rate information (helpful for DaVinci)
        edl += `* FRAME RATE: ${frameRate}\n`;
        edl += `* NOTE: This EDL contains still image files, not video files.\n`;
        edl += `* Images should be imported into Media Pool before importing this timeline.\n\n`;
        
        // Track counter for EDL (EDL uses track numbers)
        let eventNumber = 1;
        
        // Group video clips by track
        const videoClipsByTrack = new Map();
        videoClips.forEach(clip => {
            const trackId = clip.trackId || 'video_1';
            if (!videoClipsByTrack.has(trackId)) {
                videoClipsByTrack.set(trackId, []);
            }
            videoClipsByTrack.get(trackId).push(clip);
        });
        
        // Sort tracks to ensure proper order (video_1, video_2, etc.)
        const sortedTrackIds = Array.from(videoClipsByTrack.keys()).sort((a, b) => {
            const numA = parseInt(a.replace('video_', '')) || 1;
            const numB = parseInt(b.replace('video_', '')) || 1;
            return numA - numB;
        });
        
        // Export video clips
        sortedTrackIds.forEach(trackId => {
            const trackClips = videoClipsByTrack.get(trackId).sort((a, b) => a.startTime - b.startTime);
            
            trackClips.forEach(clip => {
                // Get filename from clip
                let filename = clip.fileName || clip.imageId || 'clip';
                
                // If we have a filename map (from bundled export), use the actual filename from ZIP
                if (clipToFilenameMap && clipToFilenameMap.has(clip.id)) {
                    filename = clipToFilenameMap.get(clip.id);
                } else {
                    // Extract just the filename (remove path if present)
                    if (filename.includes('/')) {
                        filename = filename.split('/').pop();
                    }
                    if (filename.includes('\\')) {
                        filename = filename.split('\\').pop();
                    }
                }
                
                // Use export folder path if provided, otherwise relative path for bundled, or fake path for standalone
                let filePath;
                if (exportFolderPath && typeof exportFolderPath === 'string') {
                    const normalizedPath = exportFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
                    filePath = `${normalizedPath}/images/${filename}`;
                } else if (useRelativePaths) {
                    filePath = `images/${filename}`;
                } else {
                    filePath = `C:/Media/${filename}`;
                }
                
                // Calculate timecodes
                const recordIn = secondsToTimecode(clip.startTime);
                const recordOut = secondsToTimecode(clip.endTime);
                
                // For still images, source timecodes should start at 00:00:00:00
                // This allows DaVinci to link the files properly
                const sourceIn = '00:00:00:00';
                const sourceOut = secondsToTimecode(clip.duration);
                
                // Determine track label
                // DaVinci Resolve supports multiple video tracks: V, V2, V3, etc.
                // Use V for first track, V2, V3, etc. for additional tracks
                let trackLabel = 'V';
                if (trackId && trackId.startsWith('video_')) {
                    const trackNum = parseInt(trackId.replace('video_', '')) || 1;
                    if (trackNum === 1) {
                        trackLabel = 'V';
                    } else {
                        // Use V2, V3, etc. for additional video tracks
                        trackLabel = `V${trackNum}`;
                    }
                }
                
                // EDL format:
                // EventNumber  Reel  Track  Transition  SourceIn  SourceOut  RecordIn  RecordOut
                // 001  AX       V     C        00:00:00:00 00:00:05:00 00:00:00:00 00:00:05:00
                edl += `${eventNumber.toString().padStart(3, '0')}  ${this.getReelName(filename)}       ${trackLabel}     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}\n`;
                edl += `* FROM CLIP NAME: ${this.escapeEDL(filename)}\n`;
                edl += `* TO CLIP NAME: ${this.escapeEDL(filename)}\n`;
                edl += `* FILE: ${this.escapeEDL(filePath)}\n`;
                // Add metadata to indicate this is a still image (not video)
                // This helps DaVinci Resolve understand it can link to image files
                edl += `* STILL IMAGE: YES\n`;
                edl += `* SOURCE FILE TYPE: IMAGE\n\n`;
                
                eventNumber++;
            });
        });
        
        // Add audio clips if any
        const audioClips = sortedTimeline.filter(clip => clip.fileType === 'audio');
        if (audioClips.length > 0) {
            // Group audio clips by track
            const audioClipsByTrack = new Map();
            audioClips.forEach(clip => {
                const trackId = clip.trackId || 'audio_1';
                if (!audioClipsByTrack.has(trackId)) {
                    audioClipsByTrack.set(trackId, []);
                }
                audioClipsByTrack.get(trackId).push(clip);
            });
            
            // Sort audio tracks to ensure proper order (audio_1 -> A1, audio_2 -> A2, etc.)
            const sortedAudioTrackIds = Array.from(audioClipsByTrack.keys()).sort((a, b) => {
                const numA = parseInt(a.replace('audio_', '')) || 1;
                const numB = parseInt(b.replace('audio_', '')) || 1;
                return numA - numB;
            });
            
            sortedAudioTrackIds.forEach(trackId => {
                const trackClips = audioClipsByTrack.get(trackId).sort((a, b) => a.startTime - b.startTime);
                
                trackClips.forEach(clip => {
                    let filename = clip.fileName || 'audio';
                    
                    // If we have a filename map (from bundled export), use the actual filename from ZIP
                    if (clipToFilenameMap && clipToFilenameMap.has(clip.id)) {
                        filename = clipToFilenameMap.get(clip.id);
                    } else {
                        // Extract just the filename
                        if (filename.includes('/')) {
                            filename = filename.split('/').pop();
                        }
                        if (filename.includes('\\')) {
                            filename = filename.split('\\').pop();
                        }
                    }
                    
                    // Use export folder path if provided, otherwise relative path for bundled, or fake path for standalone
                    let filePath;
                    if (exportFolderPath && typeof exportFolderPath === 'string') {
                        const normalizedPath = exportFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
                        filePath = `${normalizedPath}/audio/${filename}`;
                    } else if (useRelativePaths) {
                        filePath = `audio/${filename}`;
                    } else {
                        filePath = `C:/Media/${filename}`;
                    }
                    
                    // Calculate timecodes
                    const recordIn = secondsToTimecode(clip.startTime);
                    const recordOut = secondsToTimecode(clip.endTime);
                    
                    // For audio, use the trimmed portion if available, otherwise full duration
                    const audioDuration = clip.audioEndOffset && clip.audioStartOffset 
                        ? (clip.audioEndOffset - clip.audioStartOffset) 
                        : clip.duration;
                    
                    // Source timecodes - start from the offset in the original file
                    const sourceIn = secondsToTimecode(clip.audioStartOffset || 0);
                    const sourceOut = secondsToTimecode((clip.audioStartOffset || 0) + audioDuration);
                    
                    // Audio track (A1, A2, etc.) - extract track number
                    let audioTrack = 'A1';
                    if (trackId && trackId.startsWith('audio_')) {
                        const trackNum = parseInt(trackId.replace('audio_', '')) || 1;
                        audioTrack = `A${trackNum}`;
                    }
                    
                    edl += `${eventNumber.toString().padStart(3, '0')}  ${this.getReelName(filename)}       ${audioTrack}     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}\n`;
                    edl += `* FROM CLIP NAME: ${this.escapeEDL(filename)}\n`;
                    edl += `* TO CLIP NAME: ${this.escapeEDL(filename)}\n`;
                    edl += `* FILE: ${this.escapeEDL(filePath)}\n\n`;
                    
                    eventNumber++;
                });
            });
        }
        
        return edl;
    }
    
    /**
     * Get reel name from filename (EDL reel names are typically 8 characters or less)
     */
    getReelName(filename) {
        // Remove extension
        let reel = filename.replace(/\.[^/.]+$/, '');
        // Take first 8 characters, pad if needed
        reel = reel.substring(0, 8).padEnd(8, ' ');
        return reel;
    }
    
    /**
     * Escape EDL special characters
     */
    escapeEDL(str) {
        if (!str) return '';
        // EDL doesn't need much escaping, but remove newlines
        return str.replace(/\n/g, ' ').replace(/\r/g, '');
    }
    
    /**
     * Download EDL file
     */
    downloadEDL(edl, filename = 'timeline.edl') {
        const blob = new Blob([edl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
