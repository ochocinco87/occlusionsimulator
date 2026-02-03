/**
 * Geometry utilities for 3D transformations and calculations
 * Handles coordinate systems, rotations, and projections
 */

const Geometry = {
    // Unit conversions
    FEET_TO_METERS: 0.3048,
    METERS_TO_FEET: 3.28084,
    MM_TO_METERS: 0.001,
    METERS_TO_MM: 1000,

    /**
     * Convert feet to meters
     */
    feetToMeters(feet) {
        return feet * this.FEET_TO_METERS;
    },

    /**
     * Convert meters to feet
     */
    metersToFeet(meters) {
        return meters * this.METERS_TO_FEET;
    },

    /**
     * Convert degrees to radians
     */
    degToRad(degrees) {
        return (degrees * Math.PI) / 180;
    },

    /**
     * Convert radians to degrees
     */
    radToDeg(radians) {
        return (radians * 180) / Math.PI;
    },

    /**
     * Create a 3D point
     */
    point3D(x, y, z) {
        return { x, y, z };
    },

    /**
     * Calculate distance between two 3D points
     */
    distance3D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    /**
     * Calculate 2D distance (XY plane)
     */
    distance2D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Rotate a point around X axis (pitch)
     */
    rotateX(point, angle) {
        const rad = this.degToRad(angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: point.x,
            y: point.y * cos - point.z * sin,
            z: point.y * sin + point.z * cos
        };
    },

    /**
     * Rotate a point around Y axis (yaw)
     */
    rotateY(point, angle) {
        const rad = this.degToRad(angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: point.x * cos + point.z * sin,
            y: point.y,
            z: -point.x * sin + point.z * cos
        };
    },

    /**
     * Rotate a point around Z axis (roll)
     */
    rotateZ(point, angle) {
        const rad = this.degToRad(angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: point.x * cos - point.y * sin,
            y: point.x * sin + point.y * cos,
            z: point.z
        };
    },

    /**
     * Apply Euler rotation (pitch, yaw, roll) to a point
     */
    applyRotation(point, pitch, yaw, roll) {
        let rotated = this.rotateX(point, pitch);
        rotated = this.rotateY(rotated, yaw);
        rotated = this.rotateZ(rotated, roll);
        return rotated;
    },

    /**
     * Translate a point
     */
    translate(point, offset) {
        return {
            x: point.x + offset.x,
            y: point.y + offset.y,
            z: point.z + offset.z
        };
    },

    /**
     * Generate sphere positions for a 4-ball array in a square pattern
     * The center area between balls is treated as occluded (the mounting plate)
     * @param {number} spacing - Distance between adjacent spheres (mm)
     * @param {number} sphereDiameter - Diameter of spheres (mm)
     * @returns {Object} Array with sphere positions and occluded zone
     */
    generateArrayGeometry(spacing, sphereDiameter) {
        const halfSpacing = (spacing * this.MM_TO_METERS) / 2;
        const sphereRadius = (sphereDiameter * this.MM_TO_METERS) / 2;

        // 4 spheres in a square pattern, centered at origin
        const spheres = [
            { x: -halfSpacing, y: -halfSpacing, z: 0, id: 1 },  // Bottom-left
            { x: halfSpacing, y: -halfSpacing, z: 0, id: 2 },   // Bottom-right
            { x: halfSpacing, y: halfSpacing, z: 0, id: 3 },    // Top-right
            { x: -halfSpacing, y: halfSpacing, z: 0, id: 4 }    // Top-left
        ];

        // Occluded zone is the square area between the spheres (the mounting plate)
        const occludedZone = {
            type: 'square',
            center: { x: 0, y: 0, z: 0 },
            width: spacing * this.MM_TO_METERS,
            height: spacing * this.MM_TO_METERS,
            // Corners of the occluded zone (slightly inset from sphere positions)
            corners: spheres.map(s => ({ x: s.x * 0.8, y: s.y * 0.8, z: s.z }))
        };

        return {
            spheres,
            sphereRadius,
            occludedZone,
            spacing: spacing * this.MM_TO_METERS
        };
    },

    /**
     * Transform array geometry to world coordinates
     * @param {Object} arrayGeometry - Base array geometry
     * @param {Object} position - Position {x, y, z} in meters
     * @param {Object} rotation - Rotation {pitch, yaw, roll} in degrees
     * @returns {Object} Transformed geometry
     */
    transformArray(arrayGeometry, position, rotation) {
        const transformPoint = (point) => {
            // Apply rotation first (around array center)
            let transformed = this.applyRotation(point, rotation.pitch, rotation.yaw, rotation.roll);
            // Then translate to world position
            transformed = this.translate(transformed, position);
            return transformed;
        };

        return {
            spheres: arrayGeometry.spheres.map(s => ({
                ...transformPoint(s),
                id: s.id,
                localPos: { x: s.x, y: s.y, z: s.z }
            })),
            sphereRadius: arrayGeometry.sphereRadius,
            occludedZone: {
                ...arrayGeometry.occludedZone,
                center: transformPoint(arrayGeometry.occludedZone.center),
                corners: arrayGeometry.occludedZone.corners.map(c => transformPoint(c)),
                // Store rotation for proper occlusion plane calculation
                rotation: { ...rotation }
            },
            position: { ...position },
            rotation: { ...rotation }
        };
    },

    /**
     * Calculate the normal vector of the array plane after rotation
     */
    getArrayNormal(rotation) {
        // Base normal is pointing up (Z direction) for a horizontal array
        const baseNormal = { x: 0, y: 0, z: 1 };
        return this.applyRotation(baseNormal, rotation.pitch, rotation.yaw, rotation.roll);
    },

    /**
     * Check if a point is within the camera's field of view cone
     * @param {Object} point - Point to check {x, y, z}
     * @param {Object} cameraPos - Camera position {x, y, z}
     * @param {Object} cameraDir - Camera direction vector (normalized)
     * @param {number} hFOV - Horizontal FOV in degrees
     * @param {number} vFOV - Vertical FOV in degrees
     * @returns {boolean} True if point is within FOV
     */
    isInFOV(point, cameraPos, cameraDir, hFOV, vFOV) {
        // Vector from camera to point
        const toPoint = {
            x: point.x - cameraPos.x,
            y: point.y - cameraPos.y,
            z: point.z - cameraPos.z
        };

        // Normalize
        const length = Math.sqrt(toPoint.x * toPoint.x + toPoint.y * toPoint.y + toPoint.z * toPoint.z);
        if (length === 0) return true;

        const normalized = {
            x: toPoint.x / length,
            y: toPoint.y / length,
            z: toPoint.z / length
        };

        // Angle between camera direction and vector to point
        const dot = cameraDir.x * normalized.x + cameraDir.y * normalized.y + cameraDir.z * normalized.z;
        const angle = this.radToDeg(Math.acos(Math.max(-1, Math.min(1, dot))));

        // Simplified FOV check using the larger of the two FOV angles
        const maxHalfFOV = Math.max(hFOV, vFOV) / 2;
        return angle <= maxHalfFOV;
    },

    /**
     * Get camera direction vector from tilt angle
     * Camera is at foot of bed, looking towards head of bed (negative Y direction)
     * with tilt determining the up/down angle
     */
    getCameraDirection(tiltDegrees) {
        const tiltRad = this.degToRad(tiltDegrees);
        // Camera looks along negative Y axis (towards bed), with tilt rotating around X axis
        return {
            x: 0,
            y: Math.cos(tiltRad),  // Forward component (negative = towards bed)
            z: Math.sin(tiltRad)   // Vertical component (negative = looking down)
        };
    },

    /**
     * Project a 3D point to 2D for top-down view (XY plane)
     */
    projectTopDown(point, scale, offsetX, offsetY) {
        return {
            x: point.x * scale + offsetX,
            y: -point.y * scale + offsetY  // Flip Y for screen coordinates
        };
    },

    /**
     * Project a 3D point to 2D for side view (YZ plane)
     */
    projectSideView(point, scale, offsetX, offsetY) {
        return {
            x: point.y * scale + offsetX,
            y: -point.z * scale + offsetY  // Flip Z for screen coordinates
        };
    },

    /**
     * Calculate line-plane intersection for occlusion checking
     * @param {Object} lineStart - Start of line (camera position)
     * @param {Object} lineEnd - End of line (sphere position)
     * @param {Object} planePoint - Point on plane (array center)
     * @param {Object} planeNormal - Normal vector of plane
     * @returns {Object|null} Intersection point or null if parallel
     */
    linePlaneIntersection(lineStart, lineEnd, planePoint, planeNormal) {
        const lineDir = {
            x: lineEnd.x - lineStart.x,
            y: lineEnd.y - lineStart.y,
            z: lineEnd.z - lineStart.z
        };

        const denom = planeNormal.x * lineDir.x +
                      planeNormal.y * lineDir.y +
                      planeNormal.z * lineDir.z;

        if (Math.abs(denom) < 0.0001) {
            return null; // Line is parallel to plane
        }

        const planeD = -(planeNormal.x * planePoint.x +
                        planeNormal.y * planePoint.y +
                        planeNormal.z * planePoint.z);

        const t = -(planeNormal.x * lineStart.x +
                   planeNormal.y * lineStart.y +
                   planeNormal.z * lineStart.z + planeD) / denom;

        if (t < 0 || t > 1) {
            return null; // Intersection is outside the line segment
        }

        return {
            x: lineStart.x + t * lineDir.x,
            y: lineStart.y + t * lineDir.y,
            z: lineStart.z + t * lineDir.z,
            t: t
        };
    },

    /**
     * Check if a point is inside a square (for occluded zone check)
     */
    isPointInSquare(point, corners) {
        // Simple bounding box check for the square
        const xs = corners.map(c => c.x);
        const ys = corners.map(c => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return point.x >= minX && point.x <= maxX &&
               point.y >= minY && point.y <= maxY;
    }
};

// Export for use in other modules
window.Geometry = Geometry;
