---
layout: page
title: 
permalink: /sia-graph/
exclude_nav: true
---
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Timeline Graph - Integration Demo</title>
    <script>
    class TimelineGraph {
    constructor(options = {}) {
        // Configuration
        this.containerId = options.containerId || 'timeline-graph-container';
        this.startYear = options.startYear || 2025;
        this.endYear = options.endYear || 2030;
        this.targetYear = options.targetYear || this.startYear;
        this.onChange = options.onChange || null;
        this.height = options.height || 300;

        // Animation state
        this.animationProgress = 0;
        this.isAnimating = false;
        this.hoveredYear = null;

        // Mouse tracking
        this.mouseX = 0;
        this.mouseY = 0;

        this.init();
    }

    init() {
        this.createDOM();
        this.setupEventListeners();
        
        // Setup canvas and start animation once DOM is ready
        requestAnimationFrame(() => {
            this.setupCanvas();
            if (this.width && this.width > 0) {
                this.startAnimation();
            }
        });
    }

    createDOM() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with id "${this.containerId}" not found`);
            return;
        }

        container.innerHTML = `
            <div class="timeline-graph-wrapper">
                <canvas class="timeline-graph-canvas"></canvas>
            </div>
        `;

        this.canvas = container.querySelector('.timeline-graph-canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    setupCanvas() {
        const wrapper = this.canvas.parentElement;
        const rect = wrapper.getBoundingClientRect();

        // Ensure we have valid dimensions
        const width = rect.width || wrapper.offsetWidth || wrapper.clientWidth;
        
        if (!width || width === 0) {
            console.warn('Canvas wrapper has no width, retrying...');
            // Retry after a brief delay to allow DOM to layout
            setTimeout(() => {
                this.setupCanvas();
                // Start animation after successful setup
                if (this.width && this.width > 0 && !this.isAnimating) {
                    this.startAnimation();
                }
            }, 10);
            return;
        }

        // Set canvas size with device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = this.height + 'px';

        // Get fresh context after resizing to avoid scale compounding
        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(dpr, dpr);

        // Store logical dimensions
        this.width = width;
    }

    setupEventListeners() {
        // Canvas mouse tracking
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.checkHover();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredYear = null;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hoveredYear !== null) {
                this.targetYear = this.hoveredYear;
                if (this.onChange) {
                    this.onChange(this.targetYear);
                }
                this.animateUpdate();
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            if (this.width && this.width > 0) {
                this.draw();
            }
        });
    }

    checkHover() {
        const padding = 40;
        const graphWidth = this.width - (padding * 2);
        const yearCount = this.endYear - this.startYear + 1;
        const yearWidth = graphWidth / (yearCount - 1);

        // Check if mouse is near any year marker
        for (let i = 0; i < yearCount; i++) {
            const year = this.startYear + i;
            const x = padding + (i * yearWidth);
            const distance = Math.abs(this.mouseX - x);

            if (distance < 15) {
                this.hoveredYear = year;
                return;
            }
        }

        this.hoveredYear = null;
    }

    animateUpdate() {
        this.isAnimating = true;
        this.animationProgress = 0;

        const animate = () => {
            this.animationProgress += 0.05;

            if (this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.isAnimating = false;
            }

            this.draw();

            if (this.isAnimating) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    startAnimation() {
        this.isAnimating = true;
        this.animationProgress = 0;

        const animate = () => {
            this.animationProgress += 0.03;

            if (this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.isAnimating = false;
            }

            this.draw();

            if (this.isAnimating) {
                requestAnimationFrame(animate);
            } else {
                // Continue drawing for hover effects
                requestAnimationFrame(() => this.continuousRender());
            }
        };

        animate();
    }

    continuousRender() {
        this.draw();
        requestAnimationFrame(() => this.continuousRender());
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    draw() {
        // Don't draw if we don't have valid dimensions yet
        if (!this.width || this.width === 0) {
            return;
        }

        const ctx = this.ctx;
        const progress = this.easeOutCubic(this.animationProgress);

        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);

        // Graph dimensions
        const padding = 40;
        const graphWidth = this.width - (padding * 2);
        const centerY = this.height / 2;

        // Calculate positions
        const yearCount = this.endYear - this.startYear + 1;
        const yearWidth = graphWidth / (yearCount - 1);

        // Draw timeline curve with gradient
        this.drawTimelineCurve(ctx, padding, yearWidth, yearCount, centerY, progress);

        // Draw year markers and labels
        this.drawYearMarkers(ctx, padding, yearWidth, yearCount, centerY, progress);

        // Draw target year highlight
        this.drawTargetHighlight(ctx, padding, yearWidth, centerY, progress);

        // Draw hover effect
        if (this.hoveredYear !== null) {
            this.drawHoverEffect(ctx, padding, yearWidth, centerY);
        }
    }

    drawTimelineCurve(ctx, padding, yearWidth, yearCount, centerY, progress) {
        // Use cyan color to match the page theme
        const gradient = ctx.createLinearGradient(padding, 0, this.width - padding, 0);
        gradient.addColorStop(0, 'hsl(187, 100%, 42%)');
        gradient.addColorStop(0.5, 'hsl(187, 80%, 50%)');
        gradient.addColorStop(1, 'hsl(187, 100%, 42%)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Calculate growth curve parameters
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.5;

        // Draw animated curve
        ctx.beginPath();

        for (let i = 0; i < yearCount; i++) {
            const t = i / (yearCount - 1);
            const animatedT = Math.min(t / progress, 1);

            if (animatedT > 1) break;

            const x = padding + (i * yearWidth);

            // Create an always-growing exponential curve
            const growthFactor = Math.pow(t, 3.0);
            const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
            const y = centerY + growthOffset;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                // Smooth curve using quadratic bezier
                const prevX = padding + ((i - 1) * yearWidth);
                const prevT = (i - 1) / (yearCount - 1);
                const prevGrowthFactor = Math.pow(prevT, 3.0);
                const prevGrowthOffset = maxGrowth / 2 - (prevGrowthFactor * maxGrowth);
                const prevY = centerY + prevGrowthOffset;

                const cpX = (prevX + x) / 2;
                const cpY = (prevY + y) / 2;

                ctx.quadraticCurveTo(cpX, cpY, x, y);
            }
        }

        ctx.stroke();

        // Draw subtle glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'hsla(187, 100%, 42%, 0.3)';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawYearMarkers(ctx, padding, yearWidth, yearCount, centerY, progress) {
        ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.5;

        for (let i = 0; i < yearCount; i++) {
            const year = this.startYear + i;
            const x = padding + (i * yearWidth);
            const t = i / (yearCount - 1);
            const growthFactor = Math.pow(t, 3.0);
            const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
            const y = centerY + growthOffset;

            // Animate marker appearance
            const markerProgress = Math.max(0, Math.min(1, (progress - t * 0.5) * 2));
            const scale = this.easeOutCubic(markerProgress);

            if (scale > 0) {
                // Draw marker shape
                const isTarget = year === this.targetYear;
                const isHovered = year === this.hoveredYear;
                const isStart = year === this.startYear;
                const isEnd = year === this.endYear;

                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);

                // Determine shape and color based on year type
                let fillColor, strokeColor, shape;
                
                if (isTarget) {
                    fillColor = 'hsl(187, 100%, 42%)';
                    strokeColor = 'hsl(187, 100%, 35%)';
                    shape = 'diamond';
                    
                    // Outer glow for target
                    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
                    glowGradient.addColorStop(0, 'hsla(187, 100%, 42%, 0.4)');
                    glowGradient.addColorStop(1, 'hsla(187, 100%, 42%, 0)');
                    ctx.fillStyle = glowGradient;
                    ctx.beginPath();
                    ctx.arc(0, 0, 20, 0, Math.PI * 2);
                    ctx.fill();
                } else if (isStart) {
                    fillColor = isHovered ? 'hsl(142, 76%, 46%)' : 'hsl(142, 76%, 36%)';
                    strokeColor = 'hsl(142, 76%, 26%)';
                    shape = 'triangle';
                } else if (isEnd) {
                    fillColor = isHovered ? 'hsl(0, 84%, 60%)' : 'hsl(0, 84%, 50%)';
                    strokeColor = 'hsl(0, 84%, 40%)';
                    shape = 'square';
                } else {
                    fillColor = isHovered ? 'hsl(187, 80%, 50%)' : '#e5e7eb';
                    strokeColor = isHovered ? 'hsl(187, 80%, 40%)' : '#d1d5db';
                    shape = 'circle';
                }

                ctx.fillStyle = fillColor;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2;

                // Draw the appropriate shape
                ctx.beginPath();
                if (shape === 'diamond') {
                    const size = 8;
                    ctx.moveTo(0, -size);
                    ctx.lineTo(size, 0);
                    ctx.lineTo(0, size);
                    ctx.lineTo(-size, 0);
                    ctx.closePath();
                } else if (shape === 'triangle') {
                    const size = 7;
                    ctx.moveTo(size, 0);
                    ctx.lineTo(-size/2, size);
                    ctx.lineTo(-size/2, -size);
                    ctx.closePath();
                } else if (shape === 'square') {
                    const size = 6;
                    ctx.rect(-size, -size, size * 2, size * 2);
                } else {
                    // circle
                    const radius = isHovered ? 7 : 5;
                    ctx.arc(0, 0, radius, 0, Math.PI * 2);
                }
                ctx.fill();
                ctx.stroke();

                ctx.restore();

                // Year label
                ctx.fillStyle = isTarget ? 'hsl(187, 100%, 35%)' :
                    isHovered ? 'hsl(187, 80%, 40%)' :
                        '#6b7280';
                ctx.fillText(year.toString(), x, this.height - padding + 20);
            }
        }
    }

    drawTargetHighlight(ctx, padding, yearWidth, centerY, progress) {
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.5;

        const targetIndex = this.targetYear - this.startYear;
        const x = padding + (targetIndex * yearWidth);
        const t = targetIndex / (this.endYear - this.startYear);
        const growthFactor = Math.pow(t, 3.0);
        const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
        const y = centerY + growthOffset;

        // Pulsing glow effect
        const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.15;

        ctx.save();
        ctx.globalAlpha = 0.2 * progress;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 40 * pulseScale);
        gradient.addColorStop(0, 'hsl(187, 100%, 42%)');
        gradient.addColorStop(1, 'hsla(187, 100%, 42%, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 40 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Vertical highlight line
        ctx.save();
        ctx.globalAlpha = 0.3 * progress;
        ctx.strokeStyle = 'hsl(187, 100%, 42%)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, this.height - padding);
        ctx.stroke();

        ctx.restore();
    }

    drawHoverEffect(ctx, padding, yearWidth, centerY) {
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.5;

        const hoverIndex = this.hoveredYear - this.startYear;
        const x = padding + (hoverIndex * yearWidth);
        const t = hoverIndex / (this.endYear - this.startYear);
        const growthFactor = Math.pow(t, 3.0);
        const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
        const y = centerY + growthOffset;

        // Tooltip
        const tooltipText = `${this.hoveredYear}`;
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const textWidth = ctx.measureText(tooltipText).width;
        const tooltipPadding = 6;
        const tooltipWidth = textWidth + tooltipPadding * 2;
        const tooltipHeight = 20;
        const tooltipX = x - tooltipWidth / 2;
        const tooltipY = y - 30;

        // Tooltip background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.strokeStyle = 'hsl(187, 100%, 42%)';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
        ctx.fill();
        ctx.stroke();

        // Tooltip text
        ctx.fillStyle = 'hsl(187, 100%, 35%)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipText, x, tooltipY + tooltipHeight / 2);
    }

    // Public API methods
    setTargetYear(year) {
        if (year >= this.startYear && year <= this.endYear) {
            this.targetYear = year;
            this.animateUpdate();
            if (this.onChange) {
                this.onChange(this.targetYear);
            }
        }
    }

    setYearRange(startYear, endYear) {
        this.startYear = startYear;
        this.endYear = endYear;

        // Clamp target year to new range
        if (this.targetYear < this.startYear) {
            this.targetYear = this.startYear;
        } else if (this.targetYear > this.endYear) {
            this.targetYear = this.endYear;
        }

        this.animateUpdate();
    }

    getTargetYear() {
        return this.targetYear;
    }

    destroy() {
        // Clean up event listeners
        window.removeEventListener('resize', this.setupCanvas);
    }
}

// Export for use in modules or make available globally
if (typeof module !== 'undefined' && module.exports) {
module.exports = TimelineGraph;
}
    </script>
    <style>
        /* Demo page styles matching the target design */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }


        .page-header {
            margin-bottom: 32px;
        }

        .page-title {
            font-size: 24px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 8px;
        }

        .page-subtitle {
            font-size: 14px;
            color: #6b7280;
        }

        .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
        }

        .card-title {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            margin-bottom: 16px;
        }

        .controls {
            display: flex;
            gap: 32px;
            margin-bottom: 24px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .control-label {
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .control-icon {
            font-size: 16px;
            opacity: 0.7;
        }

        .control-input {
            padding: 8px 12px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            transition: all 0.2s;
        }

        .control-input:focus {
            outline: none;
            border-color: #00bcd4;
            box-shadow: 0 0 0 3px rgba(0, 188, 212, 0.1);
        }

        .btn {
            padding: 8px 16px;
            background: #00bcd4;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            align-self: flex-end;
        }

        .btn:hover {
            background: #00a5bb;
        }

        .btn:active {
            transform: scale(0.98);
        }

        .info-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 24px;
        }

        .info-item {
            padding: 16px;
            background: #f9fafb;
            border-radius: 6px;
        }

        .info-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }

        .info-value {
            font-size: 20px;
            font-weight: 600;
            color: #111827;
        }

        .info-value.highlight {
            color: #00bcd4;
        }

        /* Table styles to match the screenshot */
        .table-container {
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        thead {
            background: #1e293b;
            color: white;
        }

        th {
            padding: 12px 16px;
            text-align: left;
            font-weight: 500;
            font-size: 13px;
        }

        td {
            padding: 12px 16px;
            border-bottom: 1px solid #e5e7eb;
        }

        tbody tr:hover {
            background: #f9fafb;
        }

        .icon {
            width: 20px;
            height: 20px;
            display: inline-block;
            margin-right: 8px;
            vertical-align: middle;
        }


        .timeline-graph-wrapper {
        width: 100%;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        box-sizing: border-box;
        position: relative;
        }
        
        .timeline-graph-canvas {
        width: 100%;
        display: block;
        cursor: pointer;
        }
        
        /* Optional: Add hover state for the wrapper */
        .timeline-graph-wrapper:hover {
        border-color: #00bcd4;
        box-shadow: 0 2px 8px rgba(0, 188, 212, 0.1);
        transition: all 0.2s ease;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="card">
            <h2 class="card-title">Timeline Configuration</h2>

            <div class="controls">
                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #10b981;">►</span>
                        Start Year
                    </label>
                    <input type="number" id="start-year" class="control-input" value="2025" min="2020" max="2050">
                </div>

                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #ef4444;">■</span>
                        End Year
                    </label>
                    <input type="number" id="end-year" class="control-input" value="2030" min="2020" max="2050">
                </div>

                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #00bcd4;">◆</span>
                        Target Year
                    </label>
                    <input type="number" id="target-year" class="control-input" value="2027" min="2025" max="2030">
                </div>
            </div>

            <!-- Timeline Graph Component Container -->
            <div id="timeline-graph-container"></div>

            <div class="info-panel">
                <div class="info-item">
                    <div class="info-label">Year Range</div>
                    <div class="info-value" id="range-display">2025 - 2030</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Target Year</div>
                    <div class="info-value highlight" id="target-display">2027</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Duration</div>
                    <div class="info-value" id="duration-display">5 years</div>
                </div>
            </div>
        </div>

    </div>

    <script>
        // Initialize the timeline graph
        let timelineGraph = new TimelineGraph({
            containerId: 'timeline-graph-container',
            startYear: 2025,
            endYear: 2030,
            targetYear: 2027,
            height: 200,
            onChange: (targetYear) => {
                console.log('Target year changed to:', targetYear);
                updateDisplay();
            }
        });

        // Wire up controls
        const startYearInput = document.getElementById('start-year');
        const endYearInput = document.getElementById('end-year');
        const targetYearInput = document.getElementById('target-year');

        function updateDisplay() {
            const startYear = parseInt(startYearInput.value);
            const endYear = parseInt(endYearInput.value);
            const targetYear = timelineGraph.getTargetYear();

            document.getElementById('range-display').textContent = `${startYear} - ${endYear}`;
            document.getElementById('target-display').textContent = targetYear;
            document.getElementById('duration-display').textContent = `${endYear - startYear} years`;

            targetYearInput.value = targetYear;
        }

        startYearInput.addEventListener('change', () => {
            const startYear = parseInt(startYearInput.value);
            const endYear = parseInt(endYearInput.value);
            const targetYear = parseInt(targetYearInput.value);

            if (startYear < endYear) {
                timelineGraph.setYearRange(startYear, endYear);

                if (targetYear >= startYear && targetYear <= endYear) {
                    timelineGraph.setTargetYear(targetYear);
                } else {
                    timelineGraph.setTargetYear(startYear);
                }

                targetYearInput.min = startYear;
                targetYearInput.max = endYear;

                updateDisplay();
            }
        });

        endYearInput.addEventListener('change', () => {
            const startYear = parseInt(startYearInput.value);
            const endYear = parseInt(endYearInput.value);
            const targetYear = parseInt(targetYearInput.value);

            if (startYear < endYear) {
                timelineGraph.setYearRange(startYear, endYear);

                if (targetYear >= startYear && targetYear <= endYear) {
                    timelineGraph.setTargetYear(targetYear);
                } else {
                    timelineGraph.setTargetYear(endYear);
                }

                targetYearInput.min = startYear;
                targetYearInput.max = endYear;

                updateDisplay();
            }
        });

        targetYearInput.addEventListener('change', () => {
            const targetYear = parseInt(targetYearInput.value);
            timelineGraph.setTargetYear(targetYear);
            updateDisplay();
        });

        // Initial display update
        updateDisplay();
    </script>
</body>

</html>