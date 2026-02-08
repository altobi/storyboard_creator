/**
 * Image Structure Parser
 * Recognizes and parses various file/folder naming conventions to extract
 * scene, shot, and frame numbers automatically
 */

class ImageStructureParser {
    constructor() {
        // Patterns for recognizing scene/shot/frame numbers
        this.patterns = {
            // Folder patterns
            sceneFolder: /^(scene|sc|Scene|SC)[\s_-]*(\d+)/i,
            shotFolder: /^(shot|sh|Shot|SH)[\s_-]*(\d+)/i,
            frameFolder: /^(frame|fr|Frame|FR)[\s_-]*(\d+)/i,
            
            // Filename patterns (scene_shot_frame, sc001_sh001_fr001, etc.)
            sceneShotFrame: /(?:scene|sc)[\s_-]*(\d+)[\s_-]*(?:shot|sh)[\s_-]*(\d+)[\s_-]*(?:frame|fr)[\s_-]*(\d+)/i,
            shotFrame: /(?:shot|sh)[\s_-]*(\d+)[\s_-]*(?:frame|fr)[\s_-]*(\d+)/i,
            sceneFrame: /(?:scene|sc)[\s_-]*(\d+)[\s_-]*(?:frame|fr)[\s_-]*(\d+)/i,
            
            // Simple number patterns (001, 002, etc.)
            frameNumber: /^(\d+)/,
            
            // Separated by underscores, dashes, or spaces
            separatedNumbers: /[_\-\s]+(\d+)[_\-\s]+(\d+)[_\-\s]+(\d+)/,
            twoNumbers: /[_\-\s]+(\d+)[_\-\s]+(\d+)/,
        };
    }

    /**
     * Parse file structure from FileList or directory structure
     * @param {Array} files - Array of File objects with webkitRelativePath
     * @returns {Object} Parsed structure with images and metadata
     */
    parseFileStructure(files) {
        const structure = {
            type: 'unknown',
            images: [],
            recognized: false,
            structureInfo: null
        };

        if (!files || files.length === 0) {
            return structure;
        }

        // Check for nested folder structure (scene/shot/images)
        const folderStructure = this.detectFolderStructure(files);
        if (folderStructure.recognized) {
            structure.type = 'nested_folders';
            structure.images = folderStructure.images;
            structure.recognized = true;
            structure.structureInfo = folderStructure.info;
            return structure;
        }

        // Check for flat files with naming conventions
        const flatStructure = this.detectFlatFileStructure(files);
        if (flatStructure.recognized) {
            structure.type = 'flat_files';
            structure.images = flatStructure.images;
            structure.recognized = true;
            structure.structureInfo = flatStructure.info;
            return structure;
        }

        // Fallback: just use filenames as frame numbers
        structure.type = 'simple';
        structure.images = this.parseSimpleStructure(files);
        structure.recognized = false;
        return structure;
    }

    /**
     * Detect nested folder structure (scene/shot/images)
     */
    detectFolderStructure(files) {
        const sceneMap = new Map();
        let hasSceneFolders = false;
        let hasShotFolders = false;

        files.forEach(file => {
            // Get path - webkitRelativePath might be a getter or property
            // Handle both regular files and our wrapper objects
            let path;
            if (file.webkitRelativePath !== undefined) {
                path = file.webkitRelativePath;
            } else if (file.name) {
                path = file.name;
            } else {
                // Fallback for wrapper objects
                path = (file.file && file.file.name) ? file.file.name : 'unknown';
            }
            const parts = path.split('/');
            
            if (parts.length >= 3) {
                // Potential structure: folder1/folder2/image.jpg
                const folder1 = parts[parts.length - 3];
                const folder2 = parts[parts.length - 2];
                const filename = parts[parts.length - 1];

                // Check if folder1 is a scene folder
                const sceneMatch = this.patterns.sceneFolder.exec(folder1);
                if (sceneMatch) {
                    hasSceneFolders = true;
                    const sceneNum = this.padNumber(sceneMatch[2]);

                    // Check if folder2 is a shot folder
                    const shotMatch = this.patterns.shotFolder.exec(folder2);
                    if (shotMatch) {
                        hasShotFolders = true;
                        const shotNum = this.padNumber(shotMatch[2]);
                        const frameNum = this.extractFrameNumber(filename);

                        if (!sceneMap.has(sceneNum)) {
                            sceneMap.set(sceneNum, new Map());
                        }
                        if (!sceneMap.get(sceneNum).has(shotNum)) {
                            sceneMap.get(sceneNum).set(shotNum, []);
                        }

                        sceneMap.get(sceneNum).get(shotNum).push({
                            file: file,
                            sceneNumber: sceneNum,
                            shotNumber: shotNum,
                            frameNumber: frameNum,
                            path: path
                        });
                    }
                }
            }
        });

        if (hasSceneFolders && hasShotFolders) {
            const images = [];
            // Sort by scene, then shot, then frame
            const sortedScenes = Array.from(sceneMap.keys()).sort((a, b) => 
                parseInt(a) - parseInt(b)
            );

            sortedScenes.forEach(sceneNum => {
                const shotMap = sceneMap.get(sceneNum);
                const sortedShots = Array.from(shotMap.keys()).sort((a, b) => 
                    parseInt(a) - parseInt(b)
                );

                sortedShots.forEach(shotNum => {
                    const frames = shotMap.get(shotNum);
                    frames.sort((a, b) => {
                        const aNum = parseInt(a.frameNumber) || 0;
                        const bNum = parseInt(b.frameNumber) || 0;
                        return aNum - bNum;
                    });
                    images.push(...frames);
                });
            });

            return {
                recognized: true,
                images: images,
                info: {
                    structure: 'scene/shot/frame folders',
                    scenes: sortedScenes.length,
                    shots: Array.from(sceneMap.values()).reduce((sum, shotMap) => sum + shotMap.size, 0),
                    frames: images.length
                }
            };
        }

        return { recognized: false };
    }

    /**
     * Detect flat file structure with naming conventions
     */
    detectFlatFileStructure(files) {
        const images = [];
        let recognizedCount = 0;
        let hasSceneShotFrame = false;
        let hasShotFrame = false;
        let hasSceneFrame = false;

        files.forEach(file => {
            const filename = file.name;
            const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension

            let sceneNum = '';
            let shotNum = '';
            let frameNum = '';

            // Try scene_shot_frame pattern
            const sceneShotFrameMatch = this.patterns.sceneShotFrame.exec(baseName);
            if (sceneShotFrameMatch) {
                sceneNum = this.padNumber(sceneShotFrameMatch[1]);
                shotNum = this.padNumber(sceneShotFrameMatch[2]);
                frameNum = this.padNumber(sceneShotFrameMatch[3]);
                hasSceneShotFrame = true;
                recognizedCount++;
            } else {
                // Try shot_frame pattern
                const shotFrameMatch = this.patterns.shotFrame.exec(baseName);
                if (shotFrameMatch) {
                    shotNum = this.padNumber(shotFrameMatch[1]);
                    frameNum = this.padNumber(shotFrameMatch[2]);
                    hasShotFrame = true;
                    recognizedCount++;
                } else {
                    // Try scene_frame pattern
                    const sceneFrameMatch = this.patterns.sceneFrame.exec(baseName);
                    if (sceneFrameMatch) {
                        sceneNum = this.padNumber(sceneFrameMatch[1]);
                        frameNum = this.padNumber(sceneFrameMatch[2]);
                        hasSceneFrame = true;
                        recognizedCount++;
                    } else {
                        // Try three separated numbers
                        const threeNumbersMatch = this.patterns.separatedNumbers.exec(baseName);
                        if (threeNumbersMatch) {
                            sceneNum = this.padNumber(threeNumbersMatch[1]);
                            shotNum = this.padNumber(threeNumbersMatch[2]);
                            frameNum = this.padNumber(threeNumbersMatch[3]);
                            recognizedCount++;
                        } else {
                            // Try two separated numbers (shot_frame)
                            const twoNumbersMatch = this.patterns.twoNumbers.exec(baseName);
                            if (twoNumbersMatch) {
                                shotNum = this.padNumber(twoNumbersMatch[1]);
                                frameNum = this.padNumber(twoNumbersMatch[2]);
                                recognizedCount++;
                            } else {
                                // Fallback: just use filename as frame number
                                frameNum = this.extractFrameNumber(filename);
                            }
                        }
                    }
                }
            }

            images.push({
                file: file, // Keep the wrapper if it exists, parser will handle it
                sceneNumber: sceneNum,
                shotNumber: shotNum,
                frameNumber: frameNum,
                path: file.webkitRelativePath || file.name || (file.file && file.file.name) || 'unknown'
            });
        });

        // Sort by scene, shot, frame
        images.sort((a, b) => {
            if (a.sceneNumber && b.sceneNumber) {
                const sceneDiff = parseInt(a.sceneNumber) - parseInt(b.sceneNumber);
                if (sceneDiff !== 0) return sceneDiff;
            } else if (a.sceneNumber) return -1;
            else if (b.sceneNumber) return 1;

            if (a.shotNumber && b.shotNumber) {
                const shotDiff = parseInt(a.shotNumber) - parseInt(b.shotNumber);
                if (shotDiff !== 0) return shotDiff;
            } else if (a.shotNumber) return -1;
            else if (b.shotNumber) return 1;

            const frameA = parseInt(a.frameNumber) || 0;
            const frameB = parseInt(b.frameNumber) || 0;
            return frameA - frameB;
        });

        // Consider recognized if at least 50% of files match patterns
        const recognized = recognizedCount >= files.length * 0.5;

        if (recognized) {
            let structureType = 'named files';
            if (hasSceneShotFrame) structureType = 'scene_shot_frame naming';
            else if (hasShotFrame) structureType = 'shot_frame naming';
            else if (hasSceneFrame) structureType = 'scene_frame naming';

            return {
                recognized: true,
                images: images,
                info: {
                    structure: structureType,
                    recognized: recognizedCount,
                    total: files.length,
                    scenes: new Set(images.map(img => img.sceneNumber).filter(Boolean)).size,
                    shots: new Set(images.map(img => img.shotNumber).filter(Boolean)).size
                }
            };
        }

        return { recognized: false };
    }

    /**
     * Parse simple structure (just use filenames)
     */
    parseSimpleStructure(files) {
        return files.map(file => {
            // Handle both regular files and wrapper objects
            const fileName = file.name || (file.file && file.file.name) || 'unknown';
            const frameNum = this.extractFrameNumber(fileName);
            return {
                file: file, // Keep the wrapper if it exists
                sceneNumber: '',
                shotNumber: '',
                frameNumber: frameNum,
                path: file.webkitRelativePath || fileName
            };
        });
    }

    /**
     * Extract frame number from filename
     */
    extractFrameNumber(filename) {
        const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
        
        // Try frame folder pattern
        const frameMatch = this.patterns.frameFolder.exec(baseName);
        if (frameMatch) {
            return this.padNumber(frameMatch[2]);
        }

        // Try simple number at start
        const numberMatch = this.patterns.frameNumber.exec(baseName);
        if (numberMatch) {
            return this.padNumber(numberMatch[1]);
        }

        // Fallback: use base filename
        return baseName;
    }

    /**
     * Pad number with leading zeros (e.g., 1 -> "001", 23 -> "023")
     */
    padNumber(num) {
        const numStr = num.toString();
        // Keep original if already 3+ digits, otherwise pad to 3 digits
        return numStr.length >= 3 ? numStr : numStr.padStart(3, '0');
    }

    /**
     * Get structure recognition examples for UI display
     */
    getRecognitionExamples() {
        return [
            {
                type: 'nested_folders',
                name: 'Nested Folder Structure',
                icon: '📁',
                examples: [
                    'scene001/shot001/image001.jpg',
                    'sc002/sh002/fr003.png',
                    'Scene 3/Shot 4/frame.jpg'
                ],
                description: 'Folders organized by scene → shot → images'
            },
            {
                type: 'named_files',
                name: 'Named File Structure',
                icon: '📄',
                examples: [
                    'scene001_shot001_frame001.jpg',
                    'sc002_sh002_fr003.png',
                    'Scene 3 Shot 4 Frame 5.jpg'
                ],
                description: 'Files named with scene, shot, and frame numbers'
            },
            {
                type: 'numbered_files',
                name: 'Numbered Files',
                icon: '🔢',
                examples: [
                    '001.jpg',
                    '002.png',
                    'frame_003.jpg'
                ],
                description: 'Simple numbered files (frame numbers only)'
            }
        ];
    }
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.ImageStructureParser = ImageStructureParser;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.ImageStructureParser = ImageStructureParser;
}

// Export for use in modules (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageStructureParser;
}

