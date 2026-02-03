/**
 * Renderer Module
 * Handles all canvas rendering for top-down and side views
 */

const Renderer = {
    // Colors
    colors: {
        background: '#0f172a',
        grid: '#1e293b',
        gridMajor: '#334155',
        camera: '#f59e0b',
        cameraFOV: 'rgba(245, 158, 11, 0.15)',
        cameraFOVBorder: 'rgba(245, 158, 11, 0.4)',
        reference: '#22c55e',
        referenceOccluded: '#166534',
        navigation: '#3b82f6',
        navigationOccluded: '#1e40af',
        bed: '#64748b',
        bedSurface: '#475569',
        floor: '#334155',
        occlusion: 'rgba(239, 68, 68, 0.3)',
        occlusionBorder: 'rgba(239, 68, 68, 0.6)',
        text: '#f1f5f9',
        textMuted: '#94a3b8',
        outOfRange: '#6b7280',
        warning: '#f59e0b'
    },

    // Canvas references
    topCanvas: null,
    sideCanvas: null,
    topCtx: null,
    sideCtx: null,

    // View settings
    topViewScale: 40, // pixels per foot
    sideViewScale: 40,
    topViewOffset: { x: 0, y: 0 },
    sideViewOffset: { x: 0, y: 0 },

    /**
     * Initialize renderer with canvas elements
     */
    init(topCanvasId, sideCanvasId) {
        this.topCanvas = document.getElementById(topCanvasId);
        this.sideCanvas = document.getElementById(sideCanvasId);

        if (this.topCanvas) {
            this.topCtx = this.topCanvas.getContext('2d');
            this.setupCanvas(this.topCanvas);
        }

        if (this.sideCanvas) {
            this.sideCtx = this.sideCanvas.getContext('2d');
            this.setupCanvas(this.sideCanvas);
        }

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    },

    /**
     * Setup canvas for high DPI displays
     */
    setupCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    },

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.topCanvas) this.setupCanvas(this.topCanvas);
        if (this.sideCanvas) this.setupCanvas(this.sideCanvas);
    },

    /**
     * Render all views
     */
    render(analysisResults, config) {
        this.renderTopView(analysisResults, config);
        this.renderSideView(analysisResults, config);
    },

    /**
     * Render top-down view (XY plane, looking down)
     */
    renderTopView(analysis, config) {
        const ctx = this.topCtx;
        const canvas = this.topCanvas;
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Clear canvas
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, width, height);

        // Calculate view center and scale
        const scale = this.topViewScale;
        const centerX = width / 2;
        const centerY = height * 0.7; // Camera at bottom

        // Draw grid
        this.drawGrid(ctx, width, height, scale, centerX, centerY, 'top');

        // Draw bed outline (top view)
        this.drawBedTopView(ctx, config, scale, centerX, centerY);

        // Draw camera FOV cone (top view)
        this.drawCameraFOVTopView(ctx, analysis, config, scale, centerX, centerY);

        // Draw arrays
        this.drawArrayTopView(ctx, analysis.referenceArray, 'reference', scale, centerX, centerY);
        this.drawArrayTopView(ctx, analysis.navigationArray, 'navigation', scale, centerX, centerY);

        // Draw camera
        this.drawCameraTopView(ctx, analysis.cameraPosition, scale, centerX, centerY);

        // Draw labels
        this.drawTopViewLabels(ctx, width, height);
    },

    /**
     * Render side view (YZ plane, looking from left/right)
     */
    renderSideView(analysis, config) {
        const ctx = this.sideCtx;
        const canvas = this.sideCanvas;
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Clear canvas
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, width, height);

        // Calculate view center and scale
        const scale = this.sideViewScale;
        const centerX = width * 0.15; // Camera on left side
        const groundY = height * 0.85; // Ground line near bottom

        // Draw grid
        this.drawGrid(ctx, width, height, scale, centerX, groundY, 'side');

        // Draw floor line
        ctx.strokeStyle = this.colors.floor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(width, groundY);
        ctx.stroke();

        // Draw bed (side view)
        this.drawBedSideView(ctx, config, scale, centerX, groundY);

        // Draw camera FOV (side view)
        this.drawCameraFOVSideView(ctx, analysis, config, scale, centerX, groundY);

        // Draw arrays (side view)
        this.drawArraySideView(ctx, analysis.referenceArray, 'reference', scale, centerX, groundY);
        this.drawArraySideView(ctx, analysis.navigationArray, 'navigation', scale, centerX, groundY);

        // Draw camera (side view)
        this.drawCameraSideView(ctx, analysis.cameraPosition, config.cameraTilt, scale, centerX, groundY);

        // Draw labels
        this.drawSideViewLabels(ctx, width, height, groundY);
    },

    /**
     * Draw grid lines
     */
    drawGrid(ctx, width, height, scale, centerX, centerY, viewType) {
        const gridSpacing = scale; // 1 foot grid

        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.5;

        // Vertical lines
        for (let x = centerX % gridSpacing; x < width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = centerY % gridSpacing; y < height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        for (let y = centerY % gridSpacing; y > 0; y -= gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    },

    /**
     * Draw bed outline in top view
     */
    drawBedTopView(ctx, config, scale, centerX, centerY) {
        const bedLength = config.bedLength * scale;
        const bedWidth = 2.5 * scale; // Assume 2.5 ft bed width

        ctx.fillStyle = this.colors.bedSurface;
        ctx.strokeStyle = this.colors.bed;
        ctx.lineWidth = 2;

        const bedX = centerX - bedWidth / 2;
        const bedY = centerY - bedLength;

        ctx.fillRect(bedX, bedY, bedWidth, bedLength);
        ctx.strokeRect(bedX, bedY, bedWidth, bedLength);

        // Bed label
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BED', centerX, centerY - bedLength / 2);

        // Head/Foot labels
        ctx.font = '10px sans-serif';
        ctx.fillText('HEAD', centerX, bedY + 15);
        ctx.fillText('FOOT', centerX, centerY - 10);
    },

    /**
     * Draw bed in side view
     */
    drawBedSideView(ctx, config, scale, centerX, groundY) {
        const bedHeight = config.bedHeight * scale;
        const bedLength = config.bedLength * scale;
        const bedThickness = 0.3 * scale; // 0.3 ft thick mattress

        // Bed frame/legs
        ctx.fillStyle = this.colors.bed;
        const legWidth = 0.1 * scale;

        // Left leg (at camera position)
        const bedStartX = centerX + config.cameraDistance * scale;
        ctx.fillRect(bedStartX - legWidth / 2, groundY - bedHeight, legWidth, bedHeight);

        // Right leg
        ctx.fillRect(bedStartX + bedLength - legWidth / 2, groundY - bedHeight, legWidth, bedHeight);

        // Mattress surface
        ctx.fillStyle = this.colors.bedSurface;
        ctx.fillRect(bedStartX, groundY - bedHeight - bedThickness, bedLength, bedThickness);
        ctx.strokeStyle = this.colors.bed;
        ctx.lineWidth = 1;
        ctx.strokeRect(bedStartX, groundY - bedHeight - bedThickness, bedLength, bedThickness);

        // Labels
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FOOT', bedStartX, groundY + 15);
        ctx.fillText('HEAD', bedStartX + bedLength, groundY + 15);
    },

    /**
     * Draw camera FOV in top view
     */
    drawCameraFOVTopView(ctx, analysis, config, scale, centerX, centerY) {
        const camera = analysis.camera;
        const hFOV = camera.fov.horizontal;
        const cameraY = centerY;

        // Calculate FOV cone
        const maxRange = Math.min(camera.workingVolume.maxDistance, 4) * Geometry.METERS_TO_FEET * scale;
        const minRange = camera.workingVolume.minDistance * Geometry.METERS_TO_FEET * scale;

        const halfAngle = Geometry.degToRad(hFOV / 2);

        // Draw FOV cone (filled)
        ctx.fillStyle = this.colors.cameraFOV;
        ctx.beginPath();
        ctx.moveTo(centerX, cameraY);
        ctx.lineTo(centerX - maxRange * Math.tan(halfAngle), cameraY - maxRange);
        ctx.lineTo(centerX + maxRange * Math.tan(halfAngle), cameraY - maxRange);
        ctx.closePath();
        ctx.fill();

        // Draw FOV cone border
        ctx.strokeStyle = this.colors.cameraFOVBorder;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(centerX, cameraY);
        ctx.lineTo(centerX - maxRange * Math.tan(halfAngle), cameraY - maxRange);
        ctx.moveTo(centerX, cameraY);
        ctx.lineTo(centerX + maxRange * Math.tan(halfAngle), cameraY - maxRange);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw range indicators
        ctx.strokeStyle = this.colors.cameraFOVBorder;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Min range arc
        ctx.beginPath();
        ctx.arc(centerX, cameraY, minRange, -Math.PI / 2 - halfAngle, -Math.PI / 2 + halfAngle);
        ctx.stroke();

        // Max range arc
        ctx.beginPath();
        ctx.arc(centerX, cameraY, maxRange, -Math.PI / 2 - halfAngle, -Math.PI / 2 + halfAngle);
        ctx.stroke();

        ctx.setLineDash([]);
    },

    /**
     * Draw camera FOV in side view
     */
    drawCameraFOVSideView(ctx, analysis, config, scale, centerX, groundY) {
        const camera = analysis.camera;
        const vFOV = camera.fov.vertical;
        const tilt = config.cameraTilt;
        const cameraHeight = config.cameraHeight * scale;

        const cameraX = centerX;
        const cameraY = groundY - cameraHeight;

        // Calculate FOV cone with tilt
        const maxRange = Math.min(camera.workingVolume.maxDistance, 4) * Geometry.METERS_TO_FEET * scale;
        const tiltRad = Geometry.degToRad(tilt);
        const halfAngle = Geometry.degToRad(vFOV / 2);

        // Direction vector (tilted)
        const dirX = Math.cos(tiltRad);
        const dirY = -Math.sin(tiltRad);

        // FOV edge angles
        const topAngle = tiltRad + halfAngle;
        const bottomAngle = tiltRad - halfAngle;

        // Draw FOV cone
        ctx.fillStyle = this.colors.cameraFOV;
        ctx.beginPath();
        ctx.moveTo(cameraX, cameraY);
        ctx.lineTo(cameraX + maxRange * Math.cos(topAngle), cameraY - maxRange * Math.sin(topAngle));
        ctx.lineTo(cameraX + maxRange * Math.cos(bottomAngle), cameraY - maxRange * Math.sin(bottomAngle));
        ctx.closePath();
        ctx.fill();

        // Draw FOV edges
        ctx.strokeStyle = this.colors.cameraFOVBorder;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cameraX, cameraY);
        ctx.lineTo(cameraX + maxRange * Math.cos(topAngle), cameraY - maxRange * Math.sin(topAngle));
        ctx.moveTo(cameraX, cameraY);
        ctx.lineTo(cameraX + maxRange * Math.cos(bottomAngle), cameraY - maxRange * Math.sin(bottomAngle));
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw camera direction line
        ctx.strokeStyle = this.colors.camera;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cameraX, cameraY);
        ctx.lineTo(cameraX + maxRange * 0.3 * dirX, cameraY + maxRange * 0.3 * dirY);
        ctx.stroke();
    },

    /**
     * Draw array in top view
     */
    drawArrayTopView(ctx, arrayAnalysis, type, scale, centerX, centerY) {
        const array = arrayAnalysis.transformed;
        const baseColor = type === 'reference' ? this.colors.reference : this.colors.navigation;
        const occludedColor = type === 'reference' ? this.colors.referenceOccluded : this.colors.navigationOccluded;

        // Draw occluded zone (mounting plate)
        const plateSize = array.occludedZone.width * Geometry.METERS_TO_FEET * scale;
        const plateCenterX = centerX + array.position.x * Geometry.METERS_TO_FEET * scale;
        const plateCenterY = centerY - array.position.y * Geometry.METERS_TO_FEET * scale;

        ctx.save();
        ctx.translate(plateCenterX, plateCenterY);
        ctx.rotate(-Geometry.degToRad(array.rotation.yaw));

        ctx.fillStyle = this.colors.occlusion;
        ctx.strokeStyle = this.colors.occlusionBorder;
        ctx.lineWidth = 1;
        ctx.fillRect(-plateSize / 2, -plateSize / 2, plateSize, plateSize);
        ctx.strokeRect(-plateSize / 2, -plateSize / 2, plateSize, plateSize);

        ctx.restore();

        // Draw spheres
        arrayAnalysis.spheres.forEach((sphere, idx) => {
            const screenX = centerX + sphere.position.x * Geometry.METERS_TO_FEET * scale;
            const screenY = centerY - sphere.position.y * Geometry.METERS_TO_FEET * scale;
            const radius = array.sphereRadius * Geometry.METERS_TO_FEET * scale * 10; // Exaggerate for visibility

            // Determine color based on status
            let fillColor = baseColor;
            let strokeColor = baseColor;

            if (sphere.status === 'occluded') {
                fillColor = occludedColor;
                strokeColor = this.colors.occlusion;
            } else if (sphere.status === 'partial') {
                fillColor = this.colors.warning;
            } else if (sphere.status === 'out-of-range' || sphere.status === 'out-of-fov') {
                fillColor = this.colors.outOfRange;
                strokeColor = this.colors.outOfRange;
            }

            // Draw sphere
            ctx.beginPath();
            ctx.arc(screenX, screenY, Math.max(radius, 6), 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw sphere number
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sphere.number.toString(), screenX, screenY);
        });

        // Draw array label
        ctx.fillStyle = baseColor;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const labelY = plateCenterY + plateSize / 2 + 15;
        ctx.fillText(type === 'reference' ? 'REF' : 'NAV', plateCenterX, labelY);
    },

    /**
     * Draw array in side view
     */
    drawArraySideView(ctx, arrayAnalysis, type, scale, centerX, groundY) {
        const array = arrayAnalysis.transformed;
        const baseColor = type === 'reference' ? this.colors.reference : this.colors.navigation;
        const occludedColor = type === 'reference' ? this.colors.referenceOccluded : this.colors.navigationOccluded;

        // Calculate screen position
        const arrayY = array.position.y * Geometry.METERS_TO_FEET * scale;
        const arrayZ = array.position.z * Geometry.METERS_TO_FEET * scale;
        const screenX = centerX + arrayY;
        const screenY = groundY - arrayZ;

        // Draw mounting plate (side view - as a line)
        const plateSize = array.occludedZone.width * Geometry.METERS_TO_FEET * scale;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(Geometry.degToRad(array.rotation.pitch));

        ctx.fillStyle = this.colors.occlusion;
        ctx.strokeStyle = this.colors.occlusionBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-plateSize / 2, 0);
        ctx.lineTo(plateSize / 2, 0);
        ctx.stroke();

        ctx.restore();

        // Draw spheres
        arrayAnalysis.spheres.forEach((sphere, idx) => {
            const sphereY = sphere.position.y * Geometry.METERS_TO_FEET * scale;
            const sphereZ = sphere.position.z * Geometry.METERS_TO_FEET * scale;
            const sphereScreenX = centerX + sphereY;
            const sphereScreenY = groundY - sphereZ;
            const radius = array.sphereRadius * Geometry.METERS_TO_FEET * scale * 10;

            // Determine color
            let fillColor = baseColor;
            if (sphere.status === 'occluded') {
                fillColor = occludedColor;
            } else if (sphere.status === 'partial') {
                fillColor = this.colors.warning;
            } else if (sphere.status === 'out-of-range' || sphere.status === 'out-of-fov') {
                fillColor = this.colors.outOfRange;
            }

            ctx.beginPath();
            ctx.arc(sphereScreenX, sphereScreenY, Math.max(radius, 5), 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw label
        ctx.fillStyle = baseColor;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(type === 'reference' ? 'REF' : 'NAV', screenX, screenY - 15);
    },

    /**
     * Draw camera in top view
     */
    drawCameraTopView(ctx, cameraPos, scale, centerX, centerY) {
        const screenX = centerX + cameraPos.x * Geometry.METERS_TO_FEET * scale;
        const screenY = centerY; // Camera is at Y=0 (foot of bed)

        // Draw camera body
        ctx.fillStyle = this.colors.camera;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // Camera shape (rectangle with triangle pointing forward)
        const cameraWidth = 20;
        const cameraHeight = 12;

        ctx.beginPath();
        ctx.rect(screenX - cameraWidth / 2, screenY - cameraHeight / 2, cameraWidth, cameraHeight);
        ctx.fill();
        ctx.stroke();

        // Direction indicator
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - cameraHeight / 2);
        ctx.lineTo(screenX - 6, screenY - cameraHeight / 2 - 8);
        ctx.lineTo(screenX + 6, screenY - cameraHeight / 2 - 8);
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CAM', screenX, screenY + cameraHeight / 2 + 12);
    },

    /**
     * Draw camera in side view
     */
    drawCameraSideView(ctx, cameraPos, tilt, scale, centerX, groundY) {
        const cameraHeight = cameraPos.z * Geometry.METERS_TO_FEET * scale;
        const screenX = centerX;
        const screenY = groundY - cameraHeight;

        // Draw camera mount/pole
        ctx.strokeStyle = this.colors.bed;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenX, groundY);
        ctx.lineTo(screenX, screenY);
        ctx.stroke();

        // Draw camera body
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(Geometry.degToRad(-tilt));

        ctx.fillStyle = this.colors.camera;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // Camera shape
        const cameraWidth = 25;
        const cameraHeight = 15;

        ctx.beginPath();
        ctx.rect(0, -cameraHeight / 2, cameraWidth, cameraHeight);
        ctx.fill();
        ctx.stroke();

        // Lens
        ctx.beginPath();
        ctx.arc(cameraWidth, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Height label
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${(cameraPos.z * Geometry.METERS_TO_FEET).toFixed(1)} ft`, screenX + 10, screenY);
    },

    /**
     * Draw labels for top view
     */
    drawTopViewLabels(ctx, width, height) {
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';

        // Coordinate labels
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px sans-serif';
        ctx.fillText('X', width - 20, height / 2);
        ctx.fillText('Y', width / 2, 15);
    },

    /**
     * Draw labels for side view
     */
    drawSideViewLabels(ctx, width, height, groundY) {
        ctx.fillStyle = this.colors.textMuted;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';

        // Scale indicator
        ctx.fillText('1 ft', 10, groundY - 10);
        ctx.strokeStyle = this.colors.textMuted;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, groundY - 5);
        ctx.lineTo(10, groundY - 5 - this.sideViewScale);
        ctx.moveTo(5, groundY - 5);
        ctx.lineTo(15, groundY - 5);
        ctx.moveTo(5, groundY - 5 - this.sideViewScale);
        ctx.lineTo(15, groundY - 5 - this.sideViewScale);
        ctx.stroke();

        // Axis labels
        ctx.fillText('Y', width - 20, groundY - 10);
        ctx.fillText('Z', 15, 15);
    }
};

// Export for use in other modules
window.Renderer = Renderer;
