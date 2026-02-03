/**
 * Camera Specifications for Atracsys Optical Tracking Systems
 * Based on official specifications from Atracsys
 *
 * References:
 * - FusionTrack 500: https://atracsys.com/product/fusiontrack-500/
 * - SpryTrak 300: https://atracsys.com/product/sprytrack-300/
 */

const CameraSpecs = {
    sprytrack300: {
        name: 'SpryTrak 300',
        manufacturer: 'Atracsys',

        // Physical dimensions
        dimensions: {
            width: 180,    // mm
            height: 45,    // mm
            depth: 55,     // mm
            weight: 0.35   // kg
        },

        // Field of view (estimated based on typical optical tracking systems)
        fov: {
            horizontal: 42,  // degrees
            vertical: 32     // degrees
        },

        // Working volume
        workingVolume: {
            minDistance: 0.3,   // meters (300mm)
            maxDistance: 1.4,   // meters (1400mm)
            optimalMin: 0.5,    // meters
            optimalMax: 1.2     // meters
        },

        // Performance specifications
        performance: {
            measurementRate: 240,      // Hz
            latency: 6,                // ms
            accuracy: 0.14,            // mm RMS at optimal distance
            accuracyAt1m: 0.14,        // mm RMS
            accuracyAt1_4m: 0.20       // mm RMS (estimated)
        },

        // Tracking capabilities
        tracking: {
            maxMarkers: 8,
            maxFiducialsPerMarker: 6,
            minSphereDiameter: 6,      // mm
            maxSphereDiameter: 19,     // mm
            recommendedSphereDiameter: 12.7  // mm (0.5 inch)
        },

        // Connection
        connection: 'USB 3.0 Type C',

        // Color for visualization
        color: '#f59e0b'
    },

    fusiontrack500: {
        name: 'FusionTrack 500',
        manufacturer: 'Atracsys',

        // Physical dimensions
        dimensions: {
            width: 528,    // mm
            height: 80,    // mm
            depth: 88,     // mm
            weight: 2.3    // kg
        },

        // Field of view (estimated based on larger sensor and specifications)
        fov: {
            horizontal: 55,  // degrees
            vertical: 38     // degrees
        },

        // Working volume
        workingVolume: {
            minDistance: 0.7,   // meters (700mm) - starts at 700mm per datasheet
            maxDistance: 2.8,   // meters (2800mm)
            optimalMin: 0.8,    // meters
            optimalMax: 2.0     // meters
        },

        // Performance specifications
        performance: {
            measurementRate: 335,      // Hz
            latency: 4,                // ms (3ms acquisition + ~1ms processing)
            accuracy: 0.08,            // mm RMS at optimal distance
            accuracyAt2m: 0.08,        // mm RMS up to 2.0m
            accuracyAt2_4m: 0.11,      // mm RMS up to 2.4m
            accuracyAt2_8m: 0.15       // mm RMS up to 2.8m
        },

        // Tracking capabilities
        tracking: {
            maxMarkers: 16,
            maxFiducialsPerMarker: 6,
            minSphereDiameter: 6,      // mm
            maxSphereDiameter: 19,     // mm
            recommendedSphereDiameter: 12.7  // mm (0.5 inch)
        },

        // Connection
        connection: 'Ethernet PoE+',

        // Color for visualization
        color: '#8b5cf6'
    }
};

/**
 * Get camera specifications by ID
 * @param {string} cameraId - Camera identifier (sprytrack300 or fusiontrack500)
 * @returns {Object} Camera specifications
 */
function getCameraSpecs(cameraId) {
    return CameraSpecs[cameraId] || CameraSpecs.sprytrack300;
}

/**
 * Check if a distance is within the camera's working volume
 * @param {string} cameraId - Camera identifier
 * @param {number} distance - Distance in meters
 * @returns {Object} Range status
 */
function checkDistanceRange(cameraId, distance) {
    const camera = getCameraSpecs(cameraId);
    const wv = camera.workingVolume;

    if (distance < wv.minDistance) {
        return {
            inRange: false,
            status: 'too-close',
            message: `Too close (min: ${wv.minDistance}m)`,
            optimal: false
        };
    }

    if (distance > wv.maxDistance) {
        return {
            inRange: false,
            status: 'too-far',
            message: `Too far (max: ${wv.maxDistance}m)`,
            optimal: false
        };
    }

    const isOptimal = distance >= wv.optimalMin && distance <= wv.optimalMax;

    return {
        inRange: true,
        status: isOptimal ? 'optimal' : 'acceptable',
        message: isOptimal ? 'Optimal range' : 'Within range',
        optimal: isOptimal
    };
}

/**
 * Get accuracy at a specific distance
 * @param {string} cameraId - Camera identifier
 * @param {number} distance - Distance in meters
 * @returns {number} Estimated accuracy in mm RMS
 */
function getAccuracyAtDistance(cameraId, distance) {
    const camera = getCameraSpecs(cameraId);
    const wv = camera.workingVolume;
    const perf = camera.performance;

    if (distance < wv.minDistance || distance > wv.maxDistance) {
        return null; // Out of range
    }

    // Linear interpolation based on distance
    if (cameraId === 'fusiontrack500') {
        if (distance <= 2.0) return perf.accuracyAt2m;
        if (distance <= 2.4) return perf.accuracyAt2_4m;
        return perf.accuracyAt2_8m;
    } else {
        // SpryTrak 300
        if (distance <= 1.0) return perf.accuracyAt1m;
        // Estimate degradation at longer distances
        const degradation = (distance - 1.0) * 0.15;
        return perf.accuracyAt1m + degradation;
    }
}

/**
 * Calculate the FOV coverage at a given distance
 * @param {string} cameraId - Camera identifier
 * @param {number} distance - Distance in meters
 * @returns {Object} FOV dimensions
 */
function getFOVAtDistance(cameraId, distance) {
    const camera = getCameraSpecs(cameraId);
    const fov = camera.fov;

    // Calculate FOV dimensions using trigonometry
    // Width = 2 * distance * tan(horizontal_fov / 2)
    const hRadians = (fov.horizontal * Math.PI) / 180;
    const vRadians = (fov.vertical * Math.PI) / 180;

    const width = 2 * distance * Math.tan(hRadians / 2);
    const height = 2 * distance * Math.tan(vRadians / 2);

    return {
        width: width,   // meters
        height: height, // meters
        horizontalAngle: fov.horizontal,
        verticalAngle: fov.vertical
    };
}

/**
 * Generate HTML for camera specifications display
 * @param {string} cameraId - Camera identifier
 * @returns {string} HTML string
 */
function generateCameraSpecsHTML(cameraId) {
    const camera = getCameraSpecs(cameraId);

    return `
        <div class="spec-item">
            <span class="spec-label">FOV (H x V):</span>
            <span class="spec-value">${camera.fov.horizontal}° x ${camera.fov.vertical}°</span>
        </div>
        <div class="spec-item">
            <span class="spec-label">Range:</span>
            <span class="spec-value">${camera.workingVolume.minDistance}m - ${camera.workingVolume.maxDistance}m</span>
        </div>
        <div class="spec-item">
            <span class="spec-label">Accuracy:</span>
            <span class="spec-value">${camera.performance.accuracy} mm RMS</span>
        </div>
        <div class="spec-item">
            <span class="spec-label">Rate:</span>
            <span class="spec-value">${camera.performance.measurementRate} Hz</span>
        </div>
        <div class="spec-item">
            <span class="spec-label">Latency:</span>
            <span class="spec-value">${camera.performance.latency} ms</span>
        </div>
    `;
}

// Export for use in other modules
window.CameraSpecs = CameraSpecs;
window.getCameraSpecs = getCameraSpecs;
window.checkDistanceRange = checkDistanceRange;
window.getAccuracyAtDistance = getAccuracyAtDistance;
window.getFOVAtDistance = getFOVAtDistance;
window.generateCameraSpecsHTML = generateCameraSpecsHTML;
