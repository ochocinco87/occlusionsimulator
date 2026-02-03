/**
 * Occlusion Detection Module
 * Handles visibility calculations and occlusion analysis for retroreflector arrays
 */

const OcclusionDetector = {
    /**
     * Sphere visibility status constants
     */
    Status: {
        VISIBLE: 'visible',
        OCCLUDED: 'occluded',
        PARTIAL: 'partial',
        OUT_OF_RANGE: 'out-of-range',
        OUT_OF_FOV: 'out-of-fov'
    },

    /**
     * Perform complete occlusion analysis
     * @param {Object} config - Configuration object with all scene parameters
     * @returns {Object} Analysis results
     */
    analyze(config) {
        const {
            cameraType,
            cameraPosition,
            cameraTilt,
            referenceArray,
            navigationArray,
            sphereDiameter,
            arraySpacing
        } = config;

        const camera = getCameraSpecs(cameraType);
        const cameraDir = Geometry.getCameraDirection(cameraTilt);

        // Generate array geometries
        const baseGeometry = Geometry.generateArrayGeometry(arraySpacing, sphereDiameter);

        // Transform arrays to world coordinates
        const refTransformed = Geometry.transformArray(
            baseGeometry,
            referenceArray.position,
            referenceArray.rotation
        );

        const navTransformed = Geometry.transformArray(
            baseGeometry,
            navigationArray.position,
            navigationArray.rotation
        );

        // Analyze each array
        const refAnalysis = this.analyzeArray(
            refTransformed,
            cameraPosition,
            cameraDir,
            camera,
            navTransformed,
            'Reference'
        );

        const navAnalysis = this.analyzeArray(
            navTransformed,
            cameraPosition,
            cameraDir,
            camera,
            refTransformed,
            'Navigation'
        );

        // Generate overall status
        const overallStatus = this.getOverallStatus(refAnalysis, navAnalysis);

        // Generate recommendations
        const recommendations = this.generateRecommendations(
            refAnalysis,
            navAnalysis,
            camera,
            cameraPosition,
            cameraTilt
        );

        return {
            camera: camera,
            cameraPosition: cameraPosition,
            cameraDirection: cameraDir,
            referenceArray: {
                ...refAnalysis,
                transformed: refTransformed
            },
            navigationArray: {
                ...navAnalysis,
                transformed: navTransformed
            },
            overall: overallStatus,
            recommendations: recommendations
        };
    },

    /**
     * Analyze visibility of all spheres in an array
     */
    analyzeArray(array, cameraPos, cameraDir, camera, otherArray, arrayName) {
        const results = {
            name: arrayName,
            spheres: [],
            visibleCount: 0,
            occludedCount: 0,
            partialCount: 0,
            outOfRangeCount: 0,
            outOfFOVCount: 0,
            allVisible: true,
            anyVisible: false,
            distanceToCamera: 0,
            inRange: true,
            rangeStatus: null
        };

        // Calculate distance from camera to array center
        results.distanceToCamera = Geometry.distance3D(cameraPos, array.position);
        results.rangeStatus = checkDistanceRange(camera.name.toLowerCase().replace(' ', ''), results.distanceToCamera);
        results.inRange = results.rangeStatus.inRange;

        // Analyze each sphere
        array.spheres.forEach((sphere, index) => {
            const sphereResult = this.analyzeSphere(
                sphere,
                cameraPos,
                cameraDir,
                camera,
                array,
                otherArray,
                index + 1
            );

            results.spheres.push(sphereResult);

            switch (sphereResult.status) {
                case this.Status.VISIBLE:
                    results.visibleCount++;
                    results.anyVisible = true;
                    break;
                case this.Status.OCCLUDED:
                    results.occludedCount++;
                    results.allVisible = false;
                    break;
                case this.Status.PARTIAL:
                    results.partialCount++;
                    results.anyVisible = true;
                    results.allVisible = false;
                    break;
                case this.Status.OUT_OF_RANGE:
                    results.outOfRangeCount++;
                    results.allVisible = false;
                    break;
                case this.Status.OUT_OF_FOV:
                    results.outOfFOVCount++;
                    results.allVisible = false;
                    break;
            }
        });

        return results;
    },

    /**
     * Analyze visibility of a single sphere
     */
    analyzeSphere(sphere, cameraPos, cameraDir, camera, ownArray, otherArray, sphereNum) {
        const result = {
            id: sphere.id,
            number: sphereNum,
            position: { x: sphere.x, y: sphere.y, z: sphere.z },
            status: this.Status.VISIBLE,
            distance: 0,
            inFOV: true,
            inRange: true,
            occlusionSources: []
        };

        // Calculate distance to camera
        result.distance = Geometry.distance3D(cameraPos, sphere);

        // Check if in range
        const cameraId = camera.name.toLowerCase().replace(' ', '');
        const rangeCheck = checkDistanceRange(cameraId, result.distance);
        result.inRange = rangeCheck.inRange;
        result.rangeStatus = rangeCheck;

        if (!result.inRange) {
            result.status = this.Status.OUT_OF_RANGE;
            return result;
        }

        // Check if in FOV
        result.inFOV = Geometry.isInFOV(
            sphere,
            cameraPos,
            cameraDir,
            camera.fov.horizontal,
            camera.fov.vertical
        );

        if (!result.inFOV) {
            result.status = this.Status.OUT_OF_FOV;
            return result;
        }

        // Check for occlusion by own array's mounting plate
        const ownOcclusion = this.checkArrayOcclusion(sphere, cameraPos, ownArray, 'own array plate');
        if (ownOcclusion.occluded) {
            result.occlusionSources.push(ownOcclusion);
        }

        // Check for occlusion by other array's mounting plate
        const otherPlateOcclusion = this.checkArrayOcclusion(sphere, cameraPos, otherArray, 'other array plate');
        if (otherPlateOcclusion.occluded) {
            result.occlusionSources.push(otherPlateOcclusion);
        }

        // Check for occlusion by other array's spheres
        otherArray.spheres.forEach((otherSphere, idx) => {
            const sphereOcclusion = this.checkSphereOcclusion(
                sphere,
                cameraPos,
                otherSphere,
                otherArray.sphereRadius,
                `other array sphere ${idx + 1}`
            );
            if (sphereOcclusion.occluded) {
                result.occlusionSources.push(sphereOcclusion);
            }
        });

        // Determine final status
        if (result.occlusionSources.length > 0) {
            // Check if fully or partially occluded
            const fullOcclusions = result.occlusionSources.filter(o => o.type === 'full');
            if (fullOcclusions.length > 0) {
                result.status = this.Status.OCCLUDED;
            } else {
                result.status = this.Status.PARTIAL;
            }
        }

        return result;
    },

    /**
     * Check if a sphere is occluded by an array's mounting plate
     */
    checkArrayOcclusion(sphere, cameraPos, array, sourceName) {
        const result = {
            source: sourceName,
            occluded: false,
            type: 'none',
            intersectionPoint: null
        };

        // Get the array's plane normal
        const normal = Geometry.getArrayNormal(array.rotation);

        // Check if the line from camera to sphere intersects the array's occluded zone
        const intersection = Geometry.linePlaneIntersection(
            cameraPos,
            sphere,
            array.occludedZone.center,
            normal
        );

        if (intersection && intersection.t > 0.01 && intersection.t < 0.99) {
            // Check if intersection is within the occluded zone
            // Transform intersection point to array's local coordinates for checking
            const localIntersection = this.worldToArrayLocal(intersection, array);

            const halfSize = array.occludedZone.width / 2;
            if (Math.abs(localIntersection.x) < halfSize &&
                Math.abs(localIntersection.y) < halfSize) {
                result.occluded = true;
                result.type = 'full';
                result.intersectionPoint = intersection;
            }
        }

        return result;
    },

    /**
     * Check if a sphere is occluded by another sphere
     */
    checkSphereOcclusion(targetSphere, cameraPos, occluderSphere, occluderRadius, sourceName) {
        const result = {
            source: sourceName,
            occluded: false,
            type: 'none',
            intersectionPoint: null
        };

        // Calculate if the line from camera to target sphere passes through the occluder sphere
        const lineDir = {
            x: targetSphere.x - cameraPos.x,
            y: targetSphere.y - cameraPos.y,
            z: targetSphere.z - cameraPos.z
        };
        const lineLength = Math.sqrt(lineDir.x * lineDir.x + lineDir.y * lineDir.y + lineDir.z * lineDir.z);

        // Vector from camera to occluder
        const toOccluder = {
            x: occluderSphere.x - cameraPos.x,
            y: occluderSphere.y - cameraPos.y,
            z: occluderSphere.z - cameraPos.z
        };

        // Project occluder position onto the line
        const dot = (toOccluder.x * lineDir.x + toOccluder.y * lineDir.y + toOccluder.z * lineDir.z) / (lineLength * lineLength);

        // Only check if occluder is between camera and target
        if (dot > 0.05 && dot < 0.95) {
            // Find closest point on line to occluder center
            const closest = {
                x: cameraPos.x + dot * lineDir.x,
                y: cameraPos.y + dot * lineDir.y,
                z: cameraPos.z + dot * lineDir.z
            };

            // Distance from occluder center to the line
            const distToLine = Geometry.distance3D(closest, occluderSphere);

            // If distance is less than occluder radius, there's occlusion
            if (distToLine < occluderRadius * 1.5) {
                result.occluded = true;
                result.type = distToLine < occluderRadius * 0.5 ? 'full' : 'partial';
                result.intersectionPoint = closest;
            }
        }

        return result;
    },

    /**
     * Transform world coordinates to array local coordinates
     */
    worldToArrayLocal(point, array) {
        // Translate to array origin
        const translated = {
            x: point.x - array.position.x,
            y: point.y - array.position.y,
            z: point.z - array.position.z
        };

        // Apply inverse rotation
        const rot = array.rotation;
        let local = Geometry.rotateZ(translated, -rot.roll);
        local = Geometry.rotateY(local, -rot.yaw);
        local = Geometry.rotateX(local, -rot.pitch);

        return local;
    },

    /**
     * Determine overall tracking status
     */
    getOverallStatus(refAnalysis, navAnalysis) {
        const refTrackable = refAnalysis.visibleCount >= 3;
        const navTrackable = navAnalysis.visibleCount >= 3;
        const refFullyVisible = refAnalysis.allVisible && refAnalysis.inRange;
        const navFullyVisible = navAnalysis.allVisible && navAnalysis.inRange;

        if (refFullyVisible && navFullyVisible) {
            return {
                status: 'optimal',
                icon: '\u2714',
                message: 'All Spheres Visible',
                detail: 'Both arrays fully visible with no occlusion',
                canTrack: true
            };
        }

        if (refTrackable && navTrackable) {
            const totalPartial = refAnalysis.partialCount + navAnalysis.partialCount;
            const totalOccluded = refAnalysis.occludedCount + navAnalysis.occludedCount;

            if (totalOccluded === 0 && totalPartial > 0) {
                return {
                    status: 'warning',
                    icon: '\u26A0',
                    message: 'Minor Occlusion',
                    detail: `${totalPartial} sphere(s) partially occluded`,
                    canTrack: true
                };
            }

            return {
                status: 'warning',
                icon: '\u26A0',
                message: 'Partial Occlusion',
                detail: `${totalOccluded} sphere(s) occluded, but tracking possible`,
                canTrack: true
            };
        }

        if (!refTrackable && !navTrackable) {
            return {
                status: 'danger',
                icon: '\u2716',
                message: 'Tracking Lost',
                detail: 'Both arrays have insufficient visible spheres',
                canTrack: false
            };
        }

        const lostArray = !refTrackable ? 'Reference' : 'Navigation';
        return {
            status: 'danger',
            icon: '\u2716',
            message: `${lostArray} Array Lost`,
            detail: `${lostArray} array has fewer than 3 visible spheres`,
            canTrack: false
        };
    },

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(refAnalysis, navAnalysis, camera, cameraPos, cameraTilt) {
        const recommendations = [];

        // Check camera height
        if (cameraPos.z < Geometry.feetToMeters(7)) {
            recommendations.push({
                type: 'info',
                message: 'Consider raising camera height for better coverage of both arrays'
            });
        }

        // Check camera tilt
        if (cameraTilt > -15) {
            recommendations.push({
                type: 'warning',
                message: 'Camera may need more downward tilt to see arrays on bed'
            });
        }

        // Check range issues
        if (!refAnalysis.inRange) {
            if (refAnalysis.rangeStatus.status === 'too-far') {
                recommendations.push({
                    type: 'danger',
                    message: `Reference array is too far (${refAnalysis.distanceToCamera.toFixed(2)}m). Move camera closer or use FusionTrack 500 for longer range.`
                });
            } else {
                recommendations.push({
                    type: 'danger',
                    message: `Reference array is too close (${refAnalysis.distanceToCamera.toFixed(2)}m). Increase camera distance.`
                });
            }
        }

        if (!navAnalysis.inRange) {
            if (navAnalysis.rangeStatus.status === 'too-far') {
                recommendations.push({
                    type: 'danger',
                    message: `Navigation array is too far (${navAnalysis.distanceToCamera.toFixed(2)}m). Move camera closer or use FusionTrack 500 for longer range.`
                });
            } else {
                recommendations.push({
                    type: 'danger',
                    message: `Navigation array is too close (${navAnalysis.distanceToCamera.toFixed(2)}m). Increase camera distance.`
                });
            }
        }

        // Check for occlusion issues
        if (refAnalysis.occludedCount > 0) {
            recommendations.push({
                type: 'warning',
                message: `${refAnalysis.occludedCount} reference sphere(s) occluded. Try adjusting array angle or position.`
            });
        }

        if (navAnalysis.occludedCount > 0) {
            recommendations.push({
                type: 'warning',
                message: `${navAnalysis.occludedCount} navigation sphere(s) occluded. Try adjusting array angle or position.`
            });
        }

        // Check FOV issues
        if (refAnalysis.outOfFOVCount > 0) {
            recommendations.push({
                type: 'warning',
                message: `${refAnalysis.outOfFOVCount} reference sphere(s) outside camera FOV. Adjust camera position or tilt.`
            });
        }

        if (navAnalysis.outOfFOVCount > 0) {
            recommendations.push({
                type: 'warning',
                message: `${navAnalysis.outOfFOVCount} navigation sphere(s) outside camera FOV. Adjust camera position or tilt.`
            });
        }

        // Optimal setup suggestion
        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                message: 'Current setup provides optimal visibility for both arrays.'
            });
        }

        return recommendations;
    }
};

// Export for use in other modules
window.OcclusionDetector = OcclusionDetector;
