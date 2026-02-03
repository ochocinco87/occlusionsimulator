/**
 * Main Application Module
 * Handles UI interactions, state management, and coordinates all modules
 */

const App = {
    // Application state
    state: {
        cameraType: 'sprytrack300',
        cameraHeight: 8.0,      // feet
        cameraDistance: 6.0,    // feet from bed foot
        cameraTilt: -25,        // degrees (negative = looking down)

        bedHeight: 2.5,         // feet
        bedLength: 6.5,         // feet

        referenceArray: {
            x: 0,               // feet (lateral offset from bed center)
            y: 3.0,             // feet (along bed from foot)
            z: 0.5,             // feet (above bed surface)
            pitch: 0,           // degrees
            yaw: 0,             // degrees
            roll: 0             // degrees
        },

        navigationArray: {
            x: 0.5,             // feet
            y: 2.5,             // feet
            z: 1.0,             // feet
            pitch: -15,         // degrees
            yaw: 10,            // degrees
            roll: 0             // degrees
        },

        sphereDiameter: 12.7,   // mm
        arraySpacing: 50        // mm
    },

    // Default state for reset
    defaultState: null,

    // Analysis results
    analysisResults: null,

    /**
     * Initialize the application
     */
    init() {
        // Store default state
        this.defaultState = JSON.parse(JSON.stringify(this.state));

        // Initialize renderer
        Renderer.init('top-view-canvas', 'side-view-canvas');

        // Setup event listeners
        this.setupEventListeners();

        // Update camera specs display
        this.updateCameraSpecsDisplay();

        // Initial analysis and render
        this.updateAnalysis();
    },

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Camera type selector
        document.getElementById('camera-type').addEventListener('change', (e) => {
            this.state.cameraType = e.target.value;
            this.updateCameraSpecsDisplay();
            this.updateAnalysis();
        });

        // Camera controls
        this.setupRangeInput('camera-height', 'cameraHeight');
        this.setupRangeInput('camera-distance', 'cameraDistance');
        this.setupRangeInput('camera-tilt', 'cameraTilt');

        // Bed controls
        this.setupRangeInput('bed-height', 'bedHeight');
        this.setupRangeInput('bed-length', 'bedLength');

        // Reference array controls
        this.setupRangeInput('ref-x', 'referenceArray.x');
        this.setupRangeInput('ref-y', 'referenceArray.y');
        this.setupRangeInput('ref-z', 'referenceArray.z');
        this.setupRangeInput('ref-pitch', 'referenceArray.pitch');
        this.setupRangeInput('ref-yaw', 'referenceArray.yaw');
        this.setupRangeInput('ref-roll', 'referenceArray.roll');

        // Navigation array controls
        this.setupRangeInput('nav-x', 'navigationArray.x');
        this.setupRangeInput('nav-y', 'navigationArray.y');
        this.setupRangeInput('nav-z', 'navigationArray.z');
        this.setupRangeInput('nav-pitch', 'navigationArray.pitch');
        this.setupRangeInput('nav-yaw', 'navigationArray.yaw');
        this.setupRangeInput('nav-roll', 'navigationArray.roll');

        // Array configuration
        this.setupRangeInput('sphere-diameter', 'sphereDiameter');
        this.setupRangeInput('array-spacing', 'arraySpacing');

        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetToDefaults();
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.updateAnalysis();
        });
    },

    /**
     * Setup a range input with value display and state binding
     */
    setupRangeInput(inputId, statePath) {
        const input = document.getElementById(inputId);
        const valueDisplay = document.getElementById(inputId + '-value');

        if (!input) return;

        input.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);

            // Update state
            this.setNestedState(statePath, value);

            // Update display
            if (valueDisplay) {
                valueDisplay.textContent = value.toFixed(1);
            }

            // Trigger analysis update
            this.updateAnalysis();
        });
    },

    /**
     * Set a nested state value using dot notation path
     */
    setNestedState(path, value) {
        const parts = path.split('.');
        let obj = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
        }

        obj[parts[parts.length - 1]] = value;
    },

    /**
     * Get a nested state value using dot notation path
     */
    getNestedState(path) {
        const parts = path.split('.');
        let obj = this.state;

        for (const part of parts) {
            obj = obj[part];
        }

        return obj;
    },

    /**
     * Update camera specifications display
     */
    updateCameraSpecsDisplay() {
        const specsContainer = document.getElementById('camera-specs');
        if (specsContainer) {
            specsContainer.innerHTML = generateCameraSpecsHTML(this.state.cameraType);
        }
    },

    /**
     * Run occlusion analysis and update display
     */
    updateAnalysis() {
        try {
            // Convert state to analysis config
            const config = this.buildAnalysisConfig();

            // Run analysis
            this.analysisResults = OcclusionDetector.analyze(config);

            // Render views
            const renderConfig = {
                cameraHeight: this.state.cameraHeight,
                cameraDistance: this.state.cameraDistance,
                cameraTilt: this.state.cameraTilt,
                bedHeight: this.state.bedHeight,
                bedLength: this.state.bedLength
            };

            Renderer.render(this.analysisResults, renderConfig);

            // Update results panel
            this.updateResultsPanel();
        } catch (error) {
            console.error('Analysis error:', error);
            // Still try to render something
            this.renderFallback();
        }
    },

    /**
     * Render a fallback visualization if analysis fails
     */
    renderFallback() {
        const topCanvas = document.getElementById('top-view-canvas');
        const sideCanvas = document.getElementById('side-view-canvas');

        if (topCanvas) {
            const ctx = topCanvas.getContext('2d');
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, topCanvas.width, topCanvas.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Error - Check console', topCanvas.width/2, topCanvas.height/2);
        }

        if (sideCanvas) {
            const ctx = sideCanvas.getContext('2d');
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, sideCanvas.width, sideCanvas.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Error - Check console', sideCanvas.width/2, sideCanvas.height/2);
        }
    },

    /**
     * Build analysis configuration from current state
     */
    buildAnalysisConfig() {
        const state = this.state;

        // Convert positions from feet to meters
        const feetToMeters = Geometry.feetToMeters.bind(Geometry);

        return {
            cameraType: state.cameraType,
            cameraPosition: {
                x: 0,
                y: 0,  // Camera at foot of bed (origin)
                z: feetToMeters(state.cameraHeight)
            },
            cameraTilt: state.cameraTilt,
            referenceArray: {
                position: {
                    x: feetToMeters(state.referenceArray.x),
                    y: feetToMeters(state.cameraDistance + state.referenceArray.y),
                    z: feetToMeters(state.bedHeight + state.referenceArray.z)
                },
                rotation: {
                    pitch: state.referenceArray.pitch,
                    yaw: state.referenceArray.yaw,
                    roll: state.referenceArray.roll
                }
            },
            navigationArray: {
                position: {
                    x: feetToMeters(state.navigationArray.x),
                    y: feetToMeters(state.cameraDistance + state.navigationArray.y),
                    z: feetToMeters(state.bedHeight + state.navigationArray.z)
                },
                rotation: {
                    pitch: state.navigationArray.pitch,
                    yaw: state.navigationArray.yaw,
                    roll: state.navigationArray.roll
                }
            },
            sphereDiameter: state.sphereDiameter,
            arraySpacing: state.arraySpacing
        };
    },

    /**
     * Update the results panel with analysis results
     */
    updateResultsPanel() {
        if (!this.analysisResults) return;

        const results = this.analysisResults;

        // Update summary
        this.updateSummary(results.overall);

        // Update array statuses
        this.updateArrayStatus('ref-array-status', results.referenceArray, 'reference');
        this.updateArrayStatus('nav-array-status', results.navigationArray, 'navigation');

        // Update distance info
        this.updateDistanceInfo(results);

        // Update recommendations
        this.updateRecommendations(results.recommendations);
    },

    /**
     * Update the summary section
     */
    updateSummary(overall) {
        const container = document.getElementById('results-summary');
        if (!container) return;

        const statusClass = overall.status === 'optimal' ? 'success' :
                           overall.status === 'warning' ? 'warning' : 'danger';

        container.innerHTML = `
            <div class="summary-status">${overall.icon}</div>
            <div class="summary-text ${statusClass}">${overall.message}</div>
            <div class="summary-detail">${overall.detail}</div>
        `;
    },

    /**
     * Update array status display
     */
    updateArrayStatus(containerId, arrayAnalysis, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';

        arrayAnalysis.spheres.forEach(sphere => {
            const statusClass = sphere.status === 'visible' ? 'visible' :
                               sphere.status === 'partial' ? 'partial' :
                               sphere.status === 'occluded' ? 'occluded' : 'out-of-range';

            const statusText = sphere.status === 'visible' ? 'Visible' :
                              sphere.status === 'partial' ? 'Partial' :
                              sphere.status === 'occluded' ? 'Occluded' :
                              sphere.status === 'out-of-range' ? 'Out of Range' : 'Out of FOV';

            html += `
                <div class="sphere-status">
                    <div class="sphere-indicator">
                        <span class="sphere-dot ${statusClass}"></span>
                        <span>Sphere ${sphere.number}</span>
                    </div>
                    <span class="status-text ${statusClass}">${statusText}</span>
                </div>
            `;
        });

        // Add array summary
        html += `
            <div class="sphere-status" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--panel-border);">
                <span style="color: var(--text-muted);">Distance:</span>
                <span class="${arrayAnalysis.inRange ? 'distance-value in-range' : 'distance-value out-of-range'}">
                    ${arrayAnalysis.distanceToCamera.toFixed(2)}m
                </span>
            </div>
        `;

        container.innerHTML = html;
    },

    /**
     * Update distance information
     */
    updateDistanceInfo(results) {
        const container = document.getElementById('distance-info');
        if (!container) return;

        const camera = results.camera;
        const refDist = results.referenceArray.distanceToCamera;
        const navDist = results.navigationArray.distanceToCamera;

        container.innerHTML = `
            <h4>Distance Analysis</h4>
            <div class="distance-item">
                <span class="distance-label">Camera Range:</span>
                <span class="distance-value">${camera.workingVolume.minDistance}m - ${camera.workingVolume.maxDistance}m</span>
            </div>
            <div class="distance-item">
                <span class="distance-label">Optimal Range:</span>
                <span class="distance-value">${camera.workingVolume.optimalMin}m - ${camera.workingVolume.optimalMax}m</span>
            </div>
            <div class="distance-item">
                <span class="distance-label">Reference Array:</span>
                <span class="distance-value ${results.referenceArray.inRange ? 'in-range' : 'out-of-range'}">
                    ${refDist.toFixed(2)}m ${results.referenceArray.rangeStatus.optimal ? '(optimal)' : ''}
                </span>
            </div>
            <div class="distance-item">
                <span class="distance-label">Navigation Array:</span>
                <span class="distance-value ${results.navigationArray.inRange ? 'in-range' : 'out-of-range'}">
                    ${navDist.toFixed(2)}m ${results.navigationArray.rangeStatus.optimal ? '(optimal)' : ''}
                </span>
            </div>
            <div class="distance-item">
                <span class="distance-label">Est. Accuracy:</span>
                <span class="distance-value">
                    ${getAccuracyAtDistance(this.state.cameraType, Math.max(refDist, navDist))?.toFixed(2) || 'N/A'} mm RMS
                </span>
            </div>
        `;
    },

    /**
     * Update recommendations section
     */
    updateRecommendations(recommendations) {
        const container = document.getElementById('recommendations');
        if (!container) return;

        let html = '<h4>Recommendations</h4><ul class="recommendation-list">';

        recommendations.forEach(rec => {
            const className = rec.type === 'danger' ? 'danger' :
                             rec.type === 'warning' ? 'warning' : '';
            html += `<li class="${className}">${rec.message}</li>`;
        });

        html += '</ul>';
        container.innerHTML = html;
    },

    /**
     * Reset all controls to default values
     */
    resetToDefaults() {
        // Restore default state
        this.state = JSON.parse(JSON.stringify(this.defaultState));

        // Update all input values
        this.updateInputValue('camera-type', this.state.cameraType);
        this.updateInputValue('camera-height', this.state.cameraHeight);
        this.updateInputValue('camera-distance', this.state.cameraDistance);
        this.updateInputValue('camera-tilt', this.state.cameraTilt);
        this.updateInputValue('bed-height', this.state.bedHeight);
        this.updateInputValue('bed-length', this.state.bedLength);

        this.updateInputValue('ref-x', this.state.referenceArray.x);
        this.updateInputValue('ref-y', this.state.referenceArray.y);
        this.updateInputValue('ref-z', this.state.referenceArray.z);
        this.updateInputValue('ref-pitch', this.state.referenceArray.pitch);
        this.updateInputValue('ref-yaw', this.state.referenceArray.yaw);
        this.updateInputValue('ref-roll', this.state.referenceArray.roll);

        this.updateInputValue('nav-x', this.state.navigationArray.x);
        this.updateInputValue('nav-y', this.state.navigationArray.y);
        this.updateInputValue('nav-z', this.state.navigationArray.z);
        this.updateInputValue('nav-pitch', this.state.navigationArray.pitch);
        this.updateInputValue('nav-yaw', this.state.navigationArray.yaw);
        this.updateInputValue('nav-roll', this.state.navigationArray.roll);

        this.updateInputValue('sphere-diameter', this.state.sphereDiameter);
        this.updateInputValue('array-spacing', this.state.arraySpacing);

        // Update camera specs display
        this.updateCameraSpecsDisplay();

        // Trigger analysis update
        this.updateAnalysis();
    },

    /**
     * Update an input element's value and display
     */
    updateInputValue(inputId, value) {
        const input = document.getElementById(inputId);
        const valueDisplay = document.getElementById(inputId + '-value');

        if (input) {
            input.value = value;
        }

        if (valueDisplay) {
            valueDisplay.textContent = typeof value === 'number' ? value.toFixed(1) : value;
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for debugging
window.App = App;
