---
layout: page
title: 
permalink: /sia-timeline/
exclude_nav: true
---

<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>


        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
            
            min-height: 100vh;
            color: #111827;
            padding: 40px 20px;
            margin: 0;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            animation: scaleIn 0.5s ease-out;
        }

        .card:hover {
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.2), 0 10px 25px rgba(0, 0, 0, 0.15);
        }

        .card-title {
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 24px;
            letter-spacing: -0.5px;
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
            animation: fadeInUp 0.6s ease-out backwards;
        }

        .control-group:nth-child(1) { animation-delay: 0.1s; }
        .control-group:nth-child(2) { animation-delay: 0.2s; }
        .control-group:nth-child(3) { animation-delay: 0.3s; }
        .control-group:nth-child(4) { animation-delay: 0.4s; }

        .control-label {
            font-size: 13px;
            font-weight: 600;
            color: #4b5563;
            display: flex;
            align-items: center;
            gap: 6px;
            letter-spacing: 0.3px;
        }

        .control-icon {
            font-size: 16px;
            opacity: 0.7;
        }

        .control-input {
            padding: 10px 14px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            transition: all 0.3s ease;
            background: white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .control-input:hover {
            border-color: #d1d5db;
        }

        .control-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }

        .btn {
            padding: 10px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            align-self: flex-end;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            position: relative;
            overflow: hidden;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            transition: left 0.5s;
        }

        .btn:hover::before {
            left: 100%;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
        }

        .btn:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
        }

        .info-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 24px;
        }

        .info-item {
            padding: 10px;
            background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            animation: fadeInUp 0.6s ease-out backwards;
        }

        .info-item:nth-child(1) { animation-delay: 0.5s; }
        .info-item:nth-child(2) { animation-delay: 0.6s; }
        .info-item:nth-child(3) { animation-delay: 0.7s; }
        .info-item:nth-child(4) { animation-delay: 0.8s; }

        .info-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            transform: scaleX(0);
            transition: transform 0.3s ease;
        }

        .info-item:hover::before {
            transform: scaleX(1);
        }

        .info-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
            border-color: #667eea;
        }

        .info-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }

        .info-value {
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .info-value.highlight {
            background: linear-gradient(135deg, #00bcd4, #667eea);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
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

        /* Add smooth entrance animations */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        /* Smooth canvas wrapper transition */
        .timeline-graph-wrapper {
            animation: fadeInUp 0.6s ease-out;
            animation-delay: 0.3s;
            animation-fill-mode: backwards;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            border: 1px solid #e2e8f0;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
            transition: box-shadow 0.3s ease;
        }

        .timeline-graph-wrapper:hover {
            box-shadow: inset 0 2px 12px rgba(0, 0, 0, 0.08);
        }

        .timeline-graph-canvas {
            cursor: pointer;
            border-radius: 8px;
        }

        .page-header {
            text-align: center;
            margin-bottom: 32px;
            animation: fadeInUp 0.5s ease-out;
        }

        .page-title {
            font-size: 42px;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0;
            letter-spacing: -1px;
            text-shadow: 0 2px 20px rgba(255, 255, 255, 0.3);
        }

        .page-subtitle {
            color: rgba(255, 255, 255, 0.9);
            margin-top: 8px;
            font-weight: 500;
        }
    </style>
</head>

<body>
    <div class="container">

        <div class="card">
            <h2 class="card-title">Configuration Controls</h2>

            <div class="controls">
                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #00bcd4;">►</span>
                        Start Year
                    </label>
                    <input type="number" id="start-year" class="control-input" value="2023" min="2020" max="2050">
                </div>

                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #10b981;">►</span>
                        Strategy Init
                    </label>
                    <input type="number" id="strategy-init" class="control-input" value="2024" min="2023" max="2033">
                </div>

                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #ef4444;">■</span>
                        Strategy End
                    </label>
                    <input type="number" id="target-year" class="control-input" value="2029" min="2023" max="2033">
                </div>

                <div class="control-group">
                    <label class="control-label">
                        <span class="control-icon" style="color: #00bcd4;">■</span>
                        End Year
                    </label>
                    <input type="number" id="end-year" class="control-input" value="2030" min="2020" max="2050">
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
                <div class="info-item">
                    <div class="info-label">Strategy Duration</div>
                    <div class="info-value" style="color: #10b981;" id="strategy-duration-display">1 year</div>
                </div>
            </div>
        </div>

    </div>

    <script>
/**
* TimelineGraph Component
* A reusable timeline visualization component with interactive year selection
*
* Usage:
* const graph = new TimelineGraph({
*     containerId: 'my-container',
*     startYear: 2025,
*     endYear: 2030,
*     targetYear: 2027,
*     onChange: (targetYear) => console.log('Target year changed:', targetYear)
* });
  */

class TimelineGraph {
constructor(options = {}) {
// Configuration
this.containerId = options.containerId || 'timeline-graph-container';
this.startYear = options.startYear || 2025;
this.endYear = options.endYear || 2030;
this.strategyInitYear = options.strategyInitYear || this.startYear + 1;
this.targetYear = options.targetYear || this.endYear - 1;
this.currentYear = options.currentYear || new Date().getFullYear();
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
        // Calculate growth curve parameters
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.5;

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw the curve in segments with different thickness
        for (let segment = 0; segment < yearCount - 1; segment++) {
            const year = this.startYear + segment;
            
            // Determine if we're in the strategy period
            const isInStrategy = year >= this.strategyInitYear && year < this.targetYear;
            
            // Set line width and color based on strategy period
            if (isInStrategy) {
                ctx.lineWidth = 8; // Thicker line for strategy period
                // Create gradient for strategy period
                const gradient = ctx.createLinearGradient(
                    padding + (segment * yearWidth), centerY,
                    padding + ((segment + 1) * yearWidth), centerY
                );
                gradient.addColorStop(0, 'hsl(142, 86%, 40%)');
                gradient.addColorStop(1, 'hsl(142, 76%, 46%)');
                ctx.strokeStyle = gradient;
                ctx.shadowColor = 'hsla(142, 76%, 36%, 0.6)';
            } else {
                ctx.lineWidth = 4; // Regular thickness
                // Create gradient for normal period
                const gradient = ctx.createLinearGradient(
                    padding + (segment * yearWidth), centerY,
                    padding + ((segment + 1) * yearWidth), centerY
                );
                gradient.addColorStop(0, 'hsl(187, 100%, 42%)');
                gradient.addColorStop(1, 'hsl(220, 90%, 56%)');
                ctx.strokeStyle = gradient;
                ctx.shadowColor = 'hsla(187, 100%, 42%, 0.5)';
            }

            ctx.shadowBlur = 15;

            // Draw this segment
            ctx.beginPath();
            
            const t1 = segment / (yearCount - 1);
            const t2 = (segment + 1) / (yearCount - 1);
            
            const animatedT1 = Math.min(t1 / progress, 1);
            const animatedT2 = Math.min(t2 / progress, 1);
            
            if (animatedT1 <= 1) {
                const x1 = padding + (segment * yearWidth);
                const y1 = centerY;
                
                ctx.moveTo(x1, y1);
                
                if (animatedT2 <= 1) {
                    const x2 = padding + ((segment + 1) * yearWidth);
                    const y2 = centerY;
                    
                    ctx.lineTo(x2, y2);
                }
            }
            
            ctx.stroke();
        }
        
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
            const y = centerY;
            const t = i / (yearCount - 1);

            // Animate marker appearance
            const markerProgress = Math.max(0, Math.min(1, (progress - t * 0.5) * 2));
            const scale = this.easeOutCubic(markerProgress);

            if (scale > 0) {
                // Draw marker shape
                const isTarget = year === this.targetYear;
                const isHovered = year === this.hoveredYear;
                const isStart = year === this.startYear;
                const isEnd = year === this.endYear;
                const isStrategyInit = year === this.strategyInitYear;
                const isCurrent = year === this.currentYear;

                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);

                // Determine shape and color based on year type
                let fillGradient, strokeColor, shape;
                
                if (isTarget) {
                    fillGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
                    fillGradient.addColorStop(0, 'hsl(0, 84%, 60%)');
                    fillGradient.addColorStop(1, 'hsl(0, 84%, 50%)');
                    strokeColor = 'hsl(0, 84%, 40%)';
                    shape = 'square';
                    
                    // Enhanced outer glow for target
                    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
                    glowGradient.addColorStop(0, 'hsla(0, 84%, 60%, 0.6)');
                    glowGradient.addColorStop(0.5, 'hsla(0, 84%, 50%, 0.3)');
                    glowGradient.addColorStop(1, 'hsla(0, 84%, 50%, 0)');
                    ctx.fillStyle = glowGradient;
                    ctx.beginPath();
                    ctx.arc(0, 0, 25, 0, Math.PI * 2);
                    ctx.fill();
                } else if (isStrategyInit) {
                    fillGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
                    fillGradient.addColorStop(0, isHovered ? 'hsl(142, 86%, 56%)' : 'hsl(142, 86%, 46%)');
                    fillGradient.addColorStop(1, isHovered ? 'hsl(142, 76%, 46%)' : 'hsl(142, 76%, 36%)');
                    strokeColor = 'hsl(142, 76%, 26%)';
                    shape = 'triangle';
                } else if (isStart) {
                    fillGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
                    fillGradient.addColorStop(0, isHovered ? 'hsl(187, 100%, 62%)' : 'hsl(187, 100%, 52%)');
                    fillGradient.addColorStop(1, isHovered ? 'hsl(187, 100%, 52%)' : 'hsl(187, 100%, 42%)');
                    strokeColor = 'hsl(187, 100%, 35%)';
                    shape = 'triangle';
                } else if (isEnd) {
                    fillGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
                    fillGradient.addColorStop(0, isHovered ? 'hsl(187, 100%, 62%)' : 'hsl(187, 100%, 52%)');
                    fillGradient.addColorStop(1, isHovered ? 'hsl(187, 100%, 52%)' : 'hsl(187, 100%, 42%)');
                    strokeColor = 'hsl(187, 100%, 35%)';
                    shape = 'square';
                } else {
                    fillGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
                    fillGradient.addColorStop(0, isHovered ? 'hsl(187, 80%, 60%)' : '#f3f4f6');
                    fillGradient.addColorStop(1, isHovered ? 'hsl(187, 80%, 50%)' : '#e5e7eb');
                    strokeColor = isHovered ? 'hsl(187, 80%, 40%)' : '#d1d5db';
                    shape = 'circle';
                }

                // Add shadow for depth
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 2;

                ctx.fillStyle = fillGradient;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2.5;

                // Draw the appropriate shape
                ctx.beginPath();
                if (shape === 'diamond') {
                    const size = 8;
                    ctx.moveTo(0, -size);
                    ctx.lineTo(size, 0);
                    ctx.lineTo(0, size);
                    ctx.lineTo(-size, 0);
                    ctx.closePath();
                } else if (shape === 'triangleUp') {
                    const size = 7;
                    ctx.moveTo(0, -size);
                    ctx.lineTo(size, size);
                    ctx.lineTo(-size, size);
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

                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.restore();

                // Draw current year indicator
                if (isCurrent) {
                    // Vertical dashed line
                    ctx.save();
                    ctx.strokeStyle = 'hsla(70, 61%, 36%, 1.00)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(x, padding - 10);
                    ctx.lineTo(x, this.height - padding + 5);
                    ctx.stroke();
                    ctx.restore();
                    
                    // "TODAY" badge above the line
                    ctx.save();
                    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                    ctx.textAlign = 'center';
                    const badgeText = 'Current Year';
                    const badgeWidth = ctx.measureText(badgeText).width + 12;
                    const badgeHeight = 16;
                    const badgeX = x - badgeWidth / 2;
                    const badgeY = padding - 30;
                    
                    // Badge background with gradient
                    const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight);
                    badgeGradient.addColorStop(0, 'hsla(57, 56%, 54%, 1.00)');
                    badgeGradient.addColorStop(1, 'hsla(57, 46%, 44%, 1.00)');
                    ctx.fillStyle = badgeGradient;
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
                    ctx.shadowBlur = 6;
                    ctx.shadowOffsetY = 2;
                    ctx.beginPath();
                    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetY = 0;
                    
                    // Badge text
                    ctx.fillStyle = 'white';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(badgeText, x, badgeY + badgeHeight / 2);
                    ctx.restore();
                }

                // Year label
                ctx.fillStyle = isCurrent ? 'hsl(265, 100%, 50%)' :
                    isTarget ? 'hsl(0, 84%, 50%)' :
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
        const y = centerY;

        // Enhanced pulsing glow effect
        const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.2;

        ctx.save();
        ctx.globalAlpha = 0.25 * progress;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 50 * pulseScale);
        gradient.addColorStop(0, 'hsl(220, 90%, 56%)');
        gradient.addColorStop(0.5, 'hsl(187, 100%, 52%)');
        gradient.addColorStop(1, 'hsla(187, 100%, 42%, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 50 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Vertical highlight line with gradient
        ctx.save();
        ctx.globalAlpha = 0.4 * progress;
        const lineGradient = ctx.createLinearGradient(x, padding, x, this.height - padding);
        lineGradient.addColorStop(0, 'hsla(220, 90%, 56%, 0.2)');
        lineGradient.addColorStop(0.5, 'hsl(220, 90%, 56%)');
        lineGradient.addColorStop(1, 'hsla(220, 90%, 56%, 0.2)');
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);

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
        const y = centerY;

        // Tooltip
        const tooltipText = `${this.hoveredYear}`;
        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const textWidth = ctx.measureText(tooltipText).width;
        const tooltipPadding = 6;
        const tooltipWidth = textWidth + tooltipPadding * 2;
        const tooltipHeight = 20;
        const tooltipX = x - tooltipWidth / 2;
        const tooltipY = y - 30;

        // Tooltip background with gradient and shadow
        const tooltipGradient = ctx.createLinearGradient(tooltipX, tooltipY, tooltipX, tooltipY + tooltipHeight);
        tooltipGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        tooltipGradient.addColorStop(1, 'rgba(248, 250, 252, 1)');
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
        
        ctx.fillStyle = tooltipGradient;
        ctx.strokeStyle = 'hsl(220, 90%, 56%)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Tooltip text
        ctx.fillStyle = 'hsl(187, 100%, 35%)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipText, x, tooltipY + tooltipHeight / 2);
    }

    // Public API methods
    setStrategyInitYear(year) {
        if (year >= this.startYear && year <= this.endYear) {
            this.strategyInitYear = year;
            this.animateUpdate();
        }
    }

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

    getStrategyInitYear() {
        return this.strategyInitYear;
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
    <script>
        // Initialize the timeline graph
        let timelineGraph = new TimelineGraph({
            containerId: 'timeline-graph-container',
            startYear: 2023,
            endYear: 2030,
            strategyInitYear: 2024,
            targetYear: 2029,
            currentYear: 2025,
            height: 200,
            onChange: (targetYear) => {
                console.log('Target year changed to:', targetYear);
                updateDisplay();
            }
        });

        // Wire up controls
        const startYearInput = document.getElementById('start-year');
        const endYearInput = document.getElementById('end-year');
        const strategyInitInput = document.getElementById('strategy-init');
        const targetYearInput = document.getElementById('target-year');

        function updateDisplay() {
            const startYear = parseInt(startYearInput.value);
            const endYear = parseInt(endYearInput.value);
            const strategyInit = timelineGraph.getStrategyInitYear();
            const targetYear = timelineGraph.getTargetYear();
            const strategyDuration = targetYear - strategyInit;

            document.getElementById('range-display').textContent = `${startYear} - ${endYear}`;
            document.getElementById('target-display').textContent = targetYear;
            document.getElementById('duration-display').textContent = `${endYear - startYear} years`;
            document.getElementById('strategy-duration-display').textContent = `${strategyDuration} ${strategyDuration === 1 ? 'year' : 'years'}`;

            strategyInitInput.value = strategyInit;
            targetYearInput.value = targetYear;
        }

        startYearInput.addEventListener('change', () => {
            const startYear = parseInt(startYearInput.value);
            const endYear = parseInt(endYearInput.value);
            const strategyInit = parseInt(strategyInitInput.value);
            const targetYear = parseInt(targetYearInput.value);

            if (startYear < endYear) {
                timelineGraph.setYearRange(startYear, endYear);

                if (strategyInit < startYear || strategyInit > endYear) {
                    timelineGraph.setStrategyInitYear(Math.max(startYear, Math.min(endYear, strategyInit)));
                }
                if (targetYear < startYear || targetYear > endYear) {
                    timelineGraph.setTargetYear(Math.max(startYear, Math.min(endYear, targetYear)));
                }

                strategyInitInput.min = startYear;
                strategyInitInput.max = endYear;
                targetYearInput.min = startYear;
                targetYearInput.max = endYear;

                updateDisplay();
            }
        });

        endYearInput.addEventListener('change', () => {
            const startYear = parseInt(startYearInput.value);
            const endYear = parseInt(endYearInput.value);
            const strategyInit = parseInt(strategyInitInput.value);
            const targetYear = parseInt(targetYearInput.value);

            if (startYear < endYear) {
                timelineGraph.setYearRange(startYear, endYear);

                if (strategyInit < startYear || strategyInit > endYear) {
                    timelineGraph.setStrategyInitYear(Math.max(startYear, Math.min(endYear, strategyInit)));
                }
                if (targetYear < startYear || targetYear > endYear) {
                    timelineGraph.setTargetYear(Math.max(startYear, Math.min(endYear, targetYear)));
                }

                strategyInitInput.min = startYear;
                strategyInitInput.max = endYear;
                targetYearInput.min = startYear;
                targetYearInput.max = endYear;

                updateDisplay();
            }
        });

        strategyInitInput.addEventListener('change', () => {
            const strategyInit = parseInt(strategyInitInput.value);
            timelineGraph.setStrategyInitYear(strategyInit);
            updateDisplay();
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