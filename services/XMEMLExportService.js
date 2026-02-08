/**
 * XMEMLExportService
 * Exports previz timeline to XMEML format (DaVinci Resolve native format)
 */
class XMEMLExportService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Export timeline to XMEML format
     * @param {Object} timelineData - Timeline data from PrevisManager
     * @param {string} projectName - Name of the project
     * @param {string} exportFolderPath - Full path to export folder
     * @param {Map} clipToFilenameMap - Map of clip IDs to exported filenames
     * @returns {string} XMEML string
     */
    exportToXMEML(timelineData, projectName = 'Storyboard Timeline', exportFolderPath = null, clipToFilenameMap = null) {
        const { timeline, frameRate = 24, totalDuration = 0, videoTracks = [], audioTracks = [] } = timelineData;
        
        if (!timeline || timeline.length === 0) {
            throw new Error('Timeline is empty');
        }
        
        // Use frame rate from timeline, default to 24fps (DaVinci Resolve standard)
        const timebase = frameRate || 24;
        
        // Sort timeline by start time
        const sortedTimeline = [...timeline].sort((a, b) => {
            if (a.startTime !== b.startTime) {
                return a.startTime - b.startTime;
            }
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
        
        // Group clips by track
        const videoClipsByTrack = new Map();
        const audioClipsByTrack = new Map();
        
        videoClips.forEach(clip => {
            const trackId = clip.trackId || 1;
            if (!videoClipsByTrack.has(trackId)) {
                videoClipsByTrack.set(trackId, []);
            }
            videoClipsByTrack.get(trackId).push(clip);
        });
        
        audioClips.forEach(clip => {
            const trackId = clip.trackId || 1;
            if (!audioClipsByTrack.has(trackId)) {
                audioClipsByTrack.set(trackId, []);
            }
            audioClipsByTrack.get(trackId).push(clip);
        });
        
        // Calculate total duration in frames
        const maxEndTime = Math.max(...sortedTimeline.map(clip => clip.endTime || 0), 0);
        const totalDurationFrames = Math.ceil(maxEndTime * timebase);
        
        // Helper to convert seconds to frames
        const secondsToFrames = (seconds) => Math.floor(seconds * timebase);
        
        // Helper to escape XML
        const escapeXML = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };
        
        // Helper to convert path to file:/// URL (with proper encoding)
        const pathToFileURL = (path) => {
            if (!path) return '';
            // Normalize path separators
            let normalizedPath = path.replace(/\\/g, '/');
            // Remove leading slash if present (we'll add file:/// which includes the slash)
            if (normalizedPath.startsWith('/')) {
                normalizedPath = normalizedPath.substring(1);
            }
            // Use file:/// format (3 slashes total: file: + ///)
            // URL encode the path (spaces become %20, etc.)
            const encodedPath = encodeURI(normalizedPath).replace(/#/g, '%23');
            return `file:///${encodedPath}`;
        };
        
        // Build XMEML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
    <sequence>
        <name>${escapeXML(projectName)}</name>
        <duration>${totalDurationFrames}</duration>
        <rate>
            <timebase>${timebase}</timebase>
            <ntsc>FALSE</ntsc>
        </rate>
        <in>-1</in>
        <out>-1</out>
        <timecode>
            <string>01:00:00:00</string>
            <frame>86400</frame>
            <displayformat>NDF</displayformat>
            <rate>
                <timebase>${timebase}</timebase>
                <ntsc>FALSE</ntsc>
            </rate>
        </timecode>
        <media>
            <video>
`;
        
        // Add video tracks
        const sortedVideoTrackIds = Array.from(videoClipsByTrack.keys()).sort((a, b) => a - b);
        sortedVideoTrackIds.forEach(trackId => {
            const trackClips = videoClipsByTrack.get(trackId).sort((a, b) => a.startTime - b.startTime);
            
            xml += `                <track>
`;
            
            // Track file IDs to avoid duplicates
            const fileIdMap = new Map();
            let fileIdCounter = 0;
            
            trackClips.forEach((clip, clipIndex) => {
                // Get filename from map if available (uses exported PNG filename with track/order)
                let filename;
                if (clipToFilenameMap && clipToFilenameMap.has(clip.id)) {
                    filename = clipToFilenameMap.get(clip.id);
                } else {
                    filename = clip.fileName || clip.imageId || `clip_${clipIndex}`;
                    if (filename.includes('/')) filename = filename.split('/').pop();
                    if (filename.includes('\\')) filename = filename.split('\\').pop();
                    // Ensure PNG extension
                    if (!filename.endsWith('.png')) {
                        const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
                        filename = `${baseName}.png`;
                    }
                }
                
                // Build file path
                let filePath = '';
                if (exportFolderPath) {
                    const normalizedPath = exportFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
                    filePath = `${normalizedPath}/images/${filename}`;
                } else {
                    filePath = `C:/Media/${filename}`;
                }
                
                const fileURL = pathToFileURL(filePath);
                
                // Generate unique file ID
                let fileId = fileIdMap.get(filename);
                if (!fileId) {
                    fileIdCounter++;
                    fileId = `${filename.replace(/[^a-zA-Z0-9]/g, '_')} ${fileIdCounter}`;
                    fileIdMap.set(filename, fileId);
                }
                
                // Clip duration in frames
                const clipDuration = secondsToFrames(clip.duration || 1);
                const clipStart = secondsToFrames(clip.startTime || 0);
                const clipEnd = clipStart + clipDuration;
                
                // For still images, file duration should be 1 frame (not clip duration)
                // This is how DaVinci Resolve expects still images to be represented
                const fileDuration = 1; // Still images are always 1 frame in duration
                const videoMediaDuration = 1; // Video media duration for still images
                
                // Get image dimensions (default to 1920x1080)
                const width = 1920;
                const height = 1080;
                
                xml += `                    <clipitem id="${escapeXML(clip.id || `clip_${clipIndex}`)}">
                        <name>${escapeXML(filename)}</name>
                        <duration>${clipDuration}</duration>
                        <rate>
                            <timebase>${timebase}</timebase>
                            <ntsc>FALSE</ntsc>
                        </rate>
                        <start>${clipStart}</start>
                        <end>${clipEnd}</end>
                        <enabled>TRUE</enabled>
                        <in>0</in>
                        <out>${clipDuration}</out>
                        <file id="${escapeXML(fileId)}">
                            <duration>${fileDuration}</duration>
                            <rate>
                                <timebase>${timebase}</timebase>
                                <ntsc>FALSE</ntsc>
                            </rate>
                            <name>${escapeXML(filename)}</name>
                            <pathurl>${escapeXML(fileURL)}</pathurl>
                            <timecode>
                                <string>00:00:00:00</string>
                                <displayformat>NDF</displayformat>
                                <rate>
                                    <timebase>${timebase}</timebase>
                                    <ntsc>FALSE</ntsc>
                                </rate>
                            </timecode>
                            <media>
                                <video>
                                    <duration>${videoMediaDuration}</duration>
                                    <samplecharacteristics>
                                        <width>${width}</width>
                                        <height>${height}</height>
                                    </samplecharacteristics>
                                </video>
                            </media>
                        </file>
                        <compositemode>normal</compositemode>
                        <filter>
                            <enabled>TRUE</enabled>
                            <start>0</start>
                            <end>${clipDuration}</end>
                            <effect>
                                <name>Basic Motion</name>
                                <effectid>basic</effectid>
                                <effecttype>motion</effecttype>
                                <mediatype>video</mediatype>
                                <effectcategory>motion</effectcategory>
                                <parameter>
                                    <name>Scale</name>
                                    <parameterid>scale</parameterid>
                                    <value>100</value>
                                    <valuemin>0</valuemin>
                                    <valuemax>10000</valuemax>
                                </parameter>
                                <parameter>
                                    <name>Center</name>
                                    <parameterid>center</parameterid>
                                    <value>
                                        <horiz>0</horiz>
                                        <vert>0</vert>
                                    </value>
                                </parameter>
                                <parameter>
                                    <name>Rotation</name>
                                    <parameterid>rotation</parameterid>
                                    <value>0</value>
                                    <valuemin>-100000</valuemin>
                                    <valuemax>100000</valuemax>
                                </parameter>
                                <parameter>
                                    <name>Anchor Point</name>
                                    <parameterid>centerOffset</parameterid>
                                    <value>
                                        <horiz>0</horiz>
                                        <vert>0</vert>
                                    </value>
                                </parameter>
                            </effect>
                        </filter>
                        <filter>
                            <enabled>TRUE</enabled>
                            <start>0</start>
                            <end>${clipDuration}</end>
                            <effect>
                                <name>Crop</name>
                                <effectid>crop</effectid>
                                <effecttype>motion</effecttype>
                                <mediatype>video</mediatype>
                                <effectcategory>motion</effectcategory>
                                <parameter>
                                    <name>left</name>
                                    <parameterid>left</parameterid>
                                    <value>0</value>
                                    <valuemin>0</valuemin>
                                    <valuemax>100</valuemax>
                                </parameter>
                                <parameter>
                                    <name>right</name>
                                    <parameterid>right</parameterid>
                                    <value>0</value>
                                    <valuemin>0</valuemin>
                                    <valuemax>100</valuemax>
                                </parameter>
                                <parameter>
                                    <name>top</name>
                                    <parameterid>top</parameterid>
                                    <value>0</value>
                                    <valuemin>0</valuemin>
                                    <valuemax>100</valuemax>
                                </parameter>
                                <parameter>
                                    <name>bottom</name>
                                    <parameterid>bottom</parameterid>
                                    <value>0</value>
                                    <valuemin>0</valuemin>
                                    <valuemax>100</valuemax>
                                </parameter>
                            </effect>
                        </filter>
                        <filter>
                            <enabled>TRUE</enabled>
                            <start>0</start>
                            <end>${clipDuration}</end>
                            <effect>
                                <name>Opacity</name>
                                <effectid>opacity</effectid>
                                <effecttype>motion</effecttype>
                                <mediatype>video</mediatype>
                                <effectcategory>motion</effectcategory>
                                <parameter>
                                    <name>opacity</name>
                                    <parameterid>opacity</parameterid>
                                    <value>100</value>
                                    <valuemin>0</valuemin>
                                    <valuemax>100</valuemax>
                                </parameter>
                            </effect>
                        </filter>
                        <comments/>
                    </clipitem>
`;
            });
            
            xml += `                    <enabled>TRUE</enabled>
                    <locked>FALSE</locked>
                </track>
`;
        });
        
        // Add format section
        xml += `                <format>
                    <samplecharacteristics>
                        <width>1920</width>
                        <height>1080</height>
                        <pixelaspectratio>square</pixelaspectratio>
                        <rate>
                            <timebase>${timebase}</timebase>
                            <ntsc>FALSE</ntsc>
                        </rate>
                        <codec>
                            <appspecificdata>
                                <appname>Final Cut Pro</appname>
                                <appmanufacturer>Apple Inc.</appmanufacturer>
                                <data>
                                    <qtcodec/>
                                </data>
                            </appspecificdata>
                        </codec>
                    </samplecharacteristics>
                </format>
            </video>
            <audio>
`;
        
        // Add audio tracks
        const sortedAudioTrackIds = Array.from(audioClipsByTrack.keys()).sort((a, b) => a - b);
        sortedAudioTrackIds.forEach(trackId => {
            const trackClips = audioClipsByTrack.get(trackId).sort((a, b) => a.startTime - b.startTime);
            
            xml += `                <track>
`;
            
            // Track file IDs
            const audioFileIdMap = new Map();
            let audioFileIdCounter = 0;
            
            trackClips.forEach((clip, clipIndex) => {
                // Get filename
                let filename = clip.fileName || `audio_${clipIndex}`;
                if (filename.includes('/')) filename = filename.split('/').pop();
                if (filename.includes('\\')) filename = filename.split('\\').pop();
                
                // Build file path
                let filePath = '';
                if (exportFolderPath) {
                    const normalizedPath = exportFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
                    filePath = `${normalizedPath}/audio/${filename}`;
                } else {
                    filePath = `C:/Media/${filename}`;
                }
                
                const fileURL = pathToFileURL(filePath);
                
                // Generate unique file ID
                let fileId = audioFileIdMap.get(filename);
                if (!fileId) {
                    audioFileIdCounter++;
                    fileId = `${filename.replace(/[^a-zA-Z0-9]/g, '_')} ${audioFileIdCounter}`;
                    audioFileIdMap.set(filename, fileId);
                }
                
                // Clip duration in frames (trimmed duration)
                const clipDuration = secondsToFrames(clip.duration || 1);
                const clipStart = secondsToFrames(clip.startTime || 0);
                const clipEnd = clipStart + clipDuration;
                
                // For audio files, use the original audio duration (full file length), not the trimmed clip duration
                // The file duration should be the full audio file length
                // The clipitem in/out points handle the trimming
                const audioFileDuration = clip.originalAudioDuration 
                    ? secondsToFrames(clip.originalAudioDuration) 
                    : clipDuration; // Fallback to clip duration if original not available
                
                // Calculate in/out points for trimming (if audio is trimmed)
                const audioIn = clip.audioStartOffset ? secondsToFrames(clip.audioStartOffset) : 0;
                const audioOut = clip.audioEndOffset ? secondsToFrames(clip.audioEndOffset) : audioFileDuration;
                
                xml += `                    <clipitem id="${escapeXML(clip.id || `audio_${clipIndex}`)}">
                        <name>${escapeXML(filename)}</name>
                        <duration>${clipDuration}</duration>
                        <rate>
                            <timebase>${timebase}</timebase>
                            <ntsc>FALSE</ntsc>
                        </rate>
                        <start>${clipStart}</start>
                        <end>${clipEnd}</end>
                        <enabled>TRUE</enabled>
                        <in>${audioIn}</in>
                        <out>${audioOut}</out>
                        <file id="${escapeXML(fileId)}">
                            <duration>${audioFileDuration}</duration>
                            <rate>
                                <timebase>${timebase}</timebase>
                                <ntsc>FALSE</ntsc>
                            </rate>
                            <name>${escapeXML(filename)}</name>
                            <pathurl>${escapeXML(fileURL)}</pathurl>
                            <media>
                                <audio>
                                    <channelcount>2</channelcount>
                                </audio>
                            </media>
                        </file>
                        <sourcetrack>
                            <mediatype>audio</mediatype>
                            <trackindex>1</trackindex>
                        </sourcetrack>
                        <filter>
                            <enabled>TRUE</enabled>
                            <start>0</start>
                            <end>${clipDuration}</end>
                            <effect>
                                <name>Audio Levels</name>
                                <effectid>audiolevels</effectid>
                                <effecttype>audiolevels</effecttype>
                                <mediatype>audio</mediatype>
                                <effectcategory>audiolevels</effectcategory>
                                <parameter>
                                    <name>Level</name>
                                    <parameterid>level</parameterid>
                                    <value>1</value>
                                    <valuemin>1e-05</valuemin>
                                    <valuemax>31.6228</valuemax>
                                </parameter>
                            </effect>
                        </filter>
                        <filter>
                            <enabled>TRUE</enabled>
                            <start>0</start>
                            <end>${clipDuration}</end>
                            <effect>
                                <name>Audio Pan</name>
                                <effectid>audiopan</effectid>
                                <effecttype>audiopan</effecttype>
                                <mediatype>audio</mediatype>
                                <effectcategory>audiopan</effectcategory>
                                <parameter>
                                    <name>Pan</name>
                                    <parameterid>pan</parameterid>
                                    <value>0</value>
                                    <valuemin>-1</valuemin>
                                    <valuemax>1</valuemax>
                                </parameter>
                            </effect>
                        </filter>
                        <comments/>
                    </clipitem>
`;
            });
            
            xml += `                    <enabled>TRUE</enabled>
                    <locked>FALSE</locked>
                </track>
`;
        });
        
        xml += `            </audio>
        </media>
    </sequence>
</xmeml>
`;
        
        return xml;
    }
}
