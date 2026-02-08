/**
 * XMLExportService
 * Exports previz timeline to FCPXML format (compatible with DaVinci Resolve, Premiere, etc.)
 */
class XMLExportService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export timeline to FCPXML format
     * @param {Object} timelineData - Timeline data from PrevisManager
     * @param {string} projectName - Name of the project
     * @returns {string} FCPXML string
     */
    exportToFCPXML(timelineData, projectName = 'Storyboard Timeline', useRelativePaths = false, clipToFilenameMap = null, exportFolderPath = null) {
        const { timeline, frameRate = 24, totalDuration = 0, videoTracks = [], audioTracks = [] } = timelineData;
        
        if (!timeline || timeline.length === 0) {
            throw new Error('Timeline is empty');
        }
        
        // Calculate timebase (typically 24000 for 24fps, 30000 for 30fps, etc.)
        const timebase = 24000; // Standard for 24fps
        
        // Helper function to convert seconds to timebase units
        const secondsToTimebase = (seconds) => {
            return Math.floor(seconds * timebase);
        };
        
        // Sort timeline by start time
        const sortedTimeline = [...timeline].sort((a, b) => {
            if (a.startTime !== b.startTime) {
                return a.startTime - b.startTime;
            }
            // If same start time, prioritize video/image over audio
            const aIsVideo = a.fileType === 'image' || a.fileType === 'video';
            const bIsVideo = b.fileType === 'image' || b.fileType === 'video';
            if (aIsVideo && !bIsVideo) return -1;
            if (!aIsVideo && bIsVideo) return 1;
            return 0;
        });
        
        // Separate video and audio clips
        const videoClips = sortedTimeline.filter(clip => {
            return clip.fileType === 'image' || clip.fileType === 'video' || (!clip.fileType && !clip.isExternalFile);
        });
        const audioClips = sortedTimeline.filter(clip => clip.fileType === 'audio');
        
        // Generate unique IDs
        const generateId = (prefix, index) => `${prefix}-${index + 1}`;
        
        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format id="r1" name="FFVideoFormat1080p${frameRate}i" frameDuration="${timebase}/${frameRate * 1000}s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
`;
        
        // Add media resources for video clips
        const videoMediaMap = new Map();
        videoClips.forEach((clip, index) => {
            const mediaId = `r${index + 3}`;
            videoMediaMap.set(clip.id, mediaId);
            
            // Determine media type and path
            let mediaPath = '';
            let mediaType = 'image';
            
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
            
            // DaVinci Resolve matches files by filename first, then path
            // For bundled exports, use relative paths; for standalone with export folder, use absolute paths
            if (useRelativePaths) {
                mediaPath = `images/${filename}`; // Relative path for bundled export
            } else if (exportFolderPath && typeof exportFolderPath === 'string') {
                // Use absolute path based on export folder
                // Normalize path separators and ensure images subfolder
                const normalizedPath = exportFolderPath.replace(/\\/g, '/').replace(/\/$/, ''); // Remove trailing slash
                mediaPath = `${normalizedPath}/images/${filename}`;
            } else {
                mediaPath = filename; // Just the filename - DaVinci will find it in media pool
            }
            
            if (clip.isExternalFile && clip.fileType === 'video') {
                mediaType = 'video';
            } else {
                mediaType = 'image';
            }
            
            // Get file extension for format hint
            const fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
            
            // Add duration and start attributes for images (helps DaVinci locate files)
            const durationAttr = clip.duration ? ` duration="${clip.duration}s"` : ' duration="1s"';
            const startAttr = ` start="0s"`;
            
            // Add format information if it's an image (required for DaVinci Resolve)
            let formatInfo = '';
            if (mediaType === 'image') {
                formatInfo = ` format="r1"`;
            }
            
            // Add hasAudio="0" for images (helps DaVinci identify file type)
            const hasAudioAttr = mediaType === 'image' ? ` hasAudio="0"` : '';
            
            // For images, use the exact filename (DaVinci matches by filename in media pool)
            const clipName = clip.fileName || clip.imageId || `Clip ${index + 1}`;
            const cleanName = clipName.split('/').pop().split('\\').pop(); // Just the filename
            
            // Use mediaPath for src (includes relative/absolute path), cleanName for name attribute
            // For bundled exports, use relative path; for standalone with export folder, use absolute path
            // Use forward slashes for cross-platform compatibility
            let srcPath = (useRelativePaths || (exportFolderPath && typeof exportFolderPath === 'string')) 
                ? mediaPath.replace(/\\/g, '/') 
                : cleanName;
            
            // Convert absolute paths to file:/// URLs (DaVinci Resolve expects this format)
            // URL encode the path (spaces become %20, etc.)
            if (srcPath.startsWith('/') || (srcPath.length > 2 && srcPath[1] === ':')) {
                // Absolute path - convert to file:/// URL
                // DaVinci Resolve uses file:/// (three slashes) for both Windows and Unix paths
                let fileUrl = srcPath.replace(/\\/g, '/');
                // Always use file:/// format (three slashes) - DaVinci expects this
                fileUrl = `file:///${fileUrl}`;
                // URL encode the path (but keep the file:/// protocol part)
                const protocol = 'file:///';
                const pathPart = fileUrl.substring(8); // Remove "file:///" prefix
                srcPath = protocol + encodeURI(pathPart).replace(/#/g, '%23');
            }
            
            xml += `        <${mediaType} id="${mediaId}" name="${this.escapeXML(cleanName)}" uid="${mediaId}" src="${this.escapeXML(srcPath)}"${startAttr}${durationAttr}${formatInfo}${hasAudioAttr}>
            <media-rep kind="original-media" src="${this.escapeXML(srcPath)}"/>
        </${mediaType}>
`;
        });
        
        // Add media resources for audio clips
        const audioMediaMap = new Map();
        audioClips.forEach((clip, index) => {
            const mediaId = `r${videoClips.length + index + 3}`;
            audioMediaMap.set(clip.id, mediaId);
            
            // Get filename from clip
            let filename = clip.fileName || 'audio';
            
            // Extract just the filename (remove path if present)
            if (filename.includes('/')) {
                filename = filename.split('/').pop();
            }
            if (filename.includes('\\')) {
                filename = filename.split('\\').pop();
            }
            
            // Use export folder path if provided, otherwise fake directory path
            let mediaPath;
            if (exportFolderPath && typeof exportFolderPath === 'string') {
                const normalizedPath = exportFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
                mediaPath = `${normalizedPath}/audio/${filename}`;
            } else {
                mediaPath = `C:/Media/${filename}`;
            }
            
            // Convert absolute paths to file:/// URLs (DaVinci Resolve expects this format)
            let srcPath = mediaPath;
            if (srcPath.startsWith('/') || (srcPath.length > 2 && srcPath[1] === ':')) {
                // Absolute path - convert to file:/// URL
                // DaVinci Resolve uses file:/// (three slashes) for both Windows and Unix paths
                let fileUrl = srcPath.replace(/\\/g, '/');
                // Always use file:/// format (three slashes) - DaVinci expects this
                fileUrl = `file:///${fileUrl}`;
                // URL encode the path (but keep the file:/// protocol part)
                const protocol = 'file:///';
                const pathPart = fileUrl.substring(8); // Remove "file:///" prefix
                srcPath = protocol + encodeURI(pathPart).replace(/#/g, '%23');
            }
            
            xml += `        <audio id="${mediaId}" name="${clip.fileName || 'Audio ' + (index + 1)}" uid="${mediaId}" src="${this.escapeXML(srcPath)}">
            <media-rep kind="original-media" src="${this.escapeXML(srcPath)}"/>
        </audio>
`;
        });
        
        xml += `    </resources>
    <library>
        <event name="${this.escapeXML(projectName)}">
            <project name="${this.escapeXML(projectName)}" modDate="${new Date().toISOString()}">
                <sequence format="r1" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
                    <spine>
`;
        
        // Group video clips by track for proper sequencing
        const videoClipsByTrack = new Map();
        videoClips.forEach(clip => {
            const trackId = clip.trackId || 'video_1';
            if (!videoClipsByTrack.has(trackId)) {
                videoClipsByTrack.set(trackId, []);
            }
            videoClipsByTrack.get(trackId).push(clip);
        });
        
        // Sort all video clips by start time (FCPXML spine can handle overlapping clips)
        // All video clips go into the spine, sorted by time, then by track
        const sortedVideoClips = videoClips.sort((a, b) => {
            if (a.startTime !== b.startTime) {
                return a.startTime - b.startTime;
            }
            // If same start time, prioritize by track (lower track numbers first)
            const trackA = parseInt((a.trackId || 'video_1').replace('video_', '')) || 1;
            const trackB = parseInt((b.trackId || 'video_1').replace('video_', '')) || 1;
            return trackA - trackB;
        });
        
        // Add all video clips to spine (sorted by time)
        sortedVideoClips.forEach((clip, index) => {
            const mediaId = videoMediaMap.get(clip.id);
            if (!mediaId) {
                console.warn('No media ID found for clip:', clip.id);
                return;
            }
            
            const startFrame = secondsToTimebase(clip.startTime);
            const durationFrames = secondsToTimebase(clip.duration);
            // For images, start from beginning (00:00:00:00) - this helps DaVinci link files
            const offset = 0;
            
            const clipTag = clip.fileType === 'video' ? 'video' : 'video';
            const clipName = clip.fileName || clip.imageId || `Clip ${index + 1}`;
            
            // Add lane attribute for multi-track support (DaVinci uses this)
            const trackNum = parseInt((clip.trackId || 'video_1').replace('video_', '')) || 1;
            const laneAttribute = trackNum > 1 ? ` lane="${trackNum - 1}"` : '';
            
            xml += `                        <${clipTag} ref="${mediaId}" offset="${startFrame}/${timebase}s" name="${this.escapeXML(clipName)}" start="${offset}/${timebase}s" duration="${durationFrames}/${timebase}s" tcFormat="NDF"${laneAttribute}>
`;
            
            // Add audio if it's a video clip with audio
            if (clip.fileType === 'video') {
                xml += `                            <audio ref="${mediaId}" offset="${startFrame}/${timebase}s" start="${offset}/${timebase}s" duration="${durationFrames}/${timebase}s" tcFormat="NDF"/>
`;
            }
            
            xml += `                        </${clipTag}>
`;
        });
        
        xml += `                    </spine>
                    <audio>
`;
        
        // Group audio clips by track
        const audioClipsByTrack = new Map();
        audioClips.forEach(clip => {
            const trackId = clip.trackId || 'audio_1';
            if (!audioClipsByTrack.has(trackId)) {
                audioClipsByTrack.set(trackId, []);
            }
            audioClipsByTrack.get(trackId).push(clip);
        });
        
        // Sort audio tracks numerically
        const sortedAudioTrackIds = Array.from(audioClipsByTrack.keys()).sort((a, b) => {
            const numA = parseInt(a.replace('audio_', '')) || 1;
            const numB = parseInt(b.replace('audio_', '')) || 1;
            return numA - numB;
        });
        
        // Add audio clips (one track at a time, sorted by time within each track)
        sortedAudioTrackIds.forEach(trackId => {
            const trackClips = audioClipsByTrack.get(trackId).sort((a, b) => a.startTime - b.startTime);
            
            trackClips.forEach((clip, index) => {
                const mediaId = audioMediaMap.get(clip.id);
                if (!mediaId) {
                    console.warn('No media ID found for audio clip:', clip.id);
                    return;
                }
                
                const startFrame = secondsToTimebase(clip.startTime);
                const offset = clip.audioStartOffset ? secondsToTimebase(clip.audioStartOffset) : 0;
                const durationFrames = clip.audioEndOffset && clip.audioStartOffset
                    ? secondsToTimebase(clip.audioEndOffset - clip.audioStartOffset)
                    : secondsToTimebase(clip.duration);
                
                const clipName = clip.fileName || `Audio ${index + 1}`;
                
                xml += `                        <audio ref="${mediaId}" offset="${startFrame}/${timebase}s" name="${this.escapeXML(clipName)}" start="${offset}/${timebase}s" duration="${durationFrames}/${timebase}s" tcFormat="NDF"/>
`;
            });
        });
        
        xml += `                    </audio>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>`;
        
        return xml;
    }
    
    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    /**
     * Download XML file
     */
    downloadXML(xml, filename = 'timeline.xml') {
        const blob = new Blob([xml], { type: 'application/xml' });
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
