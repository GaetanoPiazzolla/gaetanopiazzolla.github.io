// ==================== //
// Timeline Graph App   //
// ==================== //

class TimelineGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // State
        this.startYear = 2025;
        this.endYear = 2030;
        this.targetYear = 2027;

        // Animation state
        this.animationProgress = 0;
        this.isAnimating = false;
        this.hoveredYear = null;

        // Mouse tracking for interactive effects
        this.mouseX = 0;
        this.mouseY = 0;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.updateDisplay();
        this.startAnimation();
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set canvas size with device pixel ratio for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = 400 * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = '400px';

        this.ctx.scale(dpr, dpr);

        // Store logical dimensions
        this.width = rect.width;
        this.height = 400;
    }

    setupEventListeners() {
        // Input controls
        document.getElementById('start-year').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value < this.endYear) {
                this.startYear = value;
                this.updateTargetYearConstraints();
            }
        });

        document.getElementById('end-year').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value > this.startYear) {
                this.endYear = value;
                this.updateTargetYearConstraints();
            }
        });

        document.getElementById('target-year').addEventListener('input', (e) => {
            this.targetYear = parseInt(e.target.value);
            this.updateDisplay();
        });

        document.getElementById('update-btn').addEventListener('click', () => {
            this.animateUpdate();
        });

        // Canvas mouse tracking
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            // Update CSS custom properties for hover effect
            const container = this.canvas.parentElement;
            container.style.setProperty('--mouse-x', `${(this.mouseX / rect.width) * 100}%`);
            container.style.setProperty('--mouse-y', `${(this.mouseY / rect.height) * 100}%`);

            this.checkHover();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredYear = null;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hoveredYear !== null) {
                this.targetYear = this.hoveredYear;
                document.getElementById('target-year').value = this.targetYear;
                this.updateDisplay();
                this.animateUpdate();
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
    }

    updateTargetYearConstraints() {
        const targetInput = document.getElementById('target-year');
        targetInput.min = this.startYear;
        targetInput.max = this.endYear;

        // Clamp target year to new range
        if (this.targetYear < this.startYear) {
            this.targetYear = this.startYear;
            targetInput.value = this.targetYear;
        } else if (this.targetYear > this.endYear) {
            this.targetYear = this.endYear;
            targetInput.value = this.targetYear;
        }

        this.updateDisplay();
    }

    updateDisplay() {
        document.getElementById('range-display').textContent = `${this.startYear} - ${this.endYear}`;
        document.getElementById('target-display').textContent = this.targetYear;
        document.getElementById('duration-display').textContent =
            `${this.endYear - this.startYear} anni`;
    }

    checkHover() {
        const padding = 60;
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
        const ctx = this.ctx;
        const progress = this.easeOutCubic(this.animationProgress);

        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);

        // Graph dimensions
        const padding = 60;
        const graphWidth = this.width - (padding * 2);
        const graphHeight = this.height - (padding * 2);
        const centerY = this.height / 2;

        // Calculate positions
        const yearCount = this.endYear - this.startYear + 1;
        const yearWidth = graphWidth / (yearCount - 1);

        // Draw background grid (subtle)
        ctx.strokeStyle = 'hsla(220, 15%, 30%, 0.1)';
        ctx.lineWidth = 1;

        for (let i = 0; i < yearCount; i++) {
            const x = padding + (i * yearWidth);

            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, this.height - padding);
            ctx.stroke();
        }

        // Draw horizontal center line
        ctx.strokeStyle = 'hsla(220, 15%, 30%, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, centerY);
        ctx.lineTo(this.width - padding, centerY);
        ctx.stroke();

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
        const gradient = ctx.createLinearGradient(padding, 0, this.width - padding, 0);
        gradient.addColorStop(0, 'hsl(260, 85%, 65%)');
        gradient.addColorStop(0.5, 'hsl(200, 90%, 60%)');
        gradient.addColorStop(1, 'hsl(340, 80%, 60%)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Calculate growth curve parameters
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.6; // Use 60% of available height for growth

        // Draw animated curve
        ctx.beginPath();

        for (let i = 0; i < yearCount; i++) {
            const t = i / (yearCount - 1);
            const animatedT = Math.min(t / progress, 1);

            if (animatedT > 1) break;

            const x = padding + (i * yearWidth);

            // Create an always-growing exponential curve
            // Starts at top (high value), ends at bottom (low value) - INVERTED for upward growth
            const growthFactor = Math.pow(t, 1.5); // Exponential growth (adjust power for steepness)
            const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
            const y = centerY + growthOffset;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                // Smooth curve using quadratic bezier
                const prevX = padding + ((i - 1) * yearWidth);
                const prevT = (i - 1) / (yearCount - 1);
                const prevGrowthFactor = Math.pow(prevT, 1.5);
                const prevGrowthOffset = maxGrowth / 2 - (prevGrowthFactor * maxGrowth);
                const prevY = centerY + prevGrowthOffset;

                const cpX = (prevX + x) / 2;
                const cpY = (prevY + y) / 2;

                ctx.quadraticCurveTo(cpX, cpY, x, y);
            }
        }

        ctx.stroke();

        // Draw glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'hsla(260, 85%, 65%, 0.5)';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawYearMarkers(ctx, padding, yearWidth, yearCount, centerY, progress) {
        ctx.font = '600 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.6;

        for (let i = 0; i < yearCount; i++) {
            const year = this.startYear + i;
            const x = padding + (i * yearWidth);
            const t = i / (yearCount - 1);
            const growthFactor = Math.pow(t, 1.5);
            const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
            const y = centerY + growthOffset;

            // Animate marker appearance
            const markerProgress = Math.max(0, Math.min(1, (progress - t * 0.5) * 2));
            const scale = this.easeOutCubic(markerProgress);

            if (scale > 0) {
                // Draw marker circle
                const isTarget = year === this.targetYear;
                const isHovered = year === this.hoveredYear;
                const radius = isTarget ? 10 : (isHovered ? 8 : 6);

                ctx.save();
                ctx.translate(x, y);
                ctx.scale(scale, scale);

                // Outer glow for target
                if (isTarget) {
                    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 3);
                    glowGradient.addColorStop(0, 'hsla(260, 85%, 65%, 0.3)');
                    glowGradient.addColorStop(1, 'hsla(260, 85%, 65%, 0)');

                    ctx.fillStyle = glowGradient;
                    ctx.beginPath();
                    ctx.arc(0, 0, radius * 3, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Marker circle
                const markerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
                if (isTarget) {
                    markerGradient.addColorStop(0, 'hsl(260, 85%, 75%)');
                    markerGradient.addColorStop(1, 'hsl(260, 85%, 55%)');
                } else if (isHovered) {
                    markerGradient.addColorStop(0, 'hsl(200, 90%, 70%)');
                    markerGradient.addColorStop(1, 'hsl(200, 90%, 50%)');
                } else {
                    markerGradient.addColorStop(0, 'hsl(220, 18%, 30%)');
                    markerGradient.addColorStop(1, 'hsl(220, 18%, 20%)');
                }

                ctx.fillStyle = markerGradient;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fill();

                // Border
                ctx.strokeStyle = isTarget ? 'hsl(260, 85%, 85%)' :
                    isHovered ? 'hsl(200, 90%, 80%)' :
                        'hsl(220, 18%, 40%)';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.restore();

                // Year label
                ctx.fillStyle = isTarget ? 'hsl(260, 85%, 75%)' :
                    isHovered ? 'hsl(200, 90%, 70%)' :
                        'hsl(220, 10%, 70%)';
                ctx.fillText(year.toString(), x, this.height - padding + 25);
            }
        }
    }

    drawTargetHighlight(ctx, padding, yearWidth, centerY, progress) {
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.6;

        const targetIndex = this.targetYear - this.startYear;
        const x = padding + (targetIndex * yearWidth);
        const t = targetIndex / (this.endYear - this.startYear);
        const growthFactor = Math.pow(t, 1.5);
        const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
        const y = centerY + growthOffset;

        // Pulsing glow effect
        const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.2;

        ctx.save();
        ctx.globalAlpha = 0.3 * progress;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 60 * pulseScale);
        gradient.addColorStop(0, 'hsl(260, 85%, 65%)');
        gradient.addColorStop(1, 'hsla(260, 85%, 65%, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 60 * pulseScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Vertical highlight line
        ctx.save();
        ctx.globalAlpha = 0.4 * progress;
        ctx.strokeStyle = 'hsl(260, 85%, 65%)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, this.height - padding);
        ctx.stroke();

        ctx.restore();
    }

    drawHoverEffect(ctx, padding, yearWidth, centerY) {
        const graphHeight = this.height - (padding * 2);
        const maxGrowth = graphHeight * 0.6;

        const hoverIndex = this.hoveredYear - this.startYear;
        const x = padding + (hoverIndex * yearWidth);
        const t = hoverIndex / (this.endYear - this.startYear);
        const growthFactor = Math.pow(t, 1.5);
        const growthOffset = maxGrowth / 2 - (growthFactor * maxGrowth);
        const y = centerY + growthOffset;

        // Tooltip
        const tooltipText = `Anno ${this.hoveredYear}`;
        ctx.font = '600 12px Inter, sans-serif';
        const textWidth = ctx.measureText(tooltipText).width;
        const tooltipPadding = 8;
        const tooltipWidth = textWidth + tooltipPadding * 2;
        const tooltipHeight = 24;
        const tooltipX = x - tooltipWidth / 2;
        const tooltipY = y - 40;

        // Tooltip background
        ctx.fillStyle = 'hsla(220, 20%, 12%, 0.95)';
        ctx.strokeStyle = 'hsl(200, 90%, 60%)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
        ctx.fill();
        ctx.stroke();

        // Tooltip text
        ctx.fillStyle = 'hsl(200, 90%, 70%)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipText, x, tooltipY + tooltipHeight / 2);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const graph = new TimelineGraph('timeline-canvas');
});
