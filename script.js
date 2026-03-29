const CONFIG = {
    gravity: 0.18,
    bounce: -1.0, // Energy-preserving bounce
    ballRadius: 10,
    ballColor: '#00d2ff',
    barWidth: 46,
    maxBarHeight: 180,
    maxLevels: 5,
    barRounded: 8,
    barFill: 'rgba(255, 255, 255, 0.05)',
    barStroke: 'rgba(255, 255, 255, 0.3)',
    barHighlight: 'rgba(0, 210, 255, 0.9)',
};

class Bar {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.w = width;
        this.level = 0;
        this.currentH = 0;
        this.hitAnimation = 0;
    }

    update() {
        const targetH = (this.level / CONFIG.maxLevels) * CONFIG.maxBarHeight;
        this.currentH += (targetH - this.currentH) * 0.1;
        
        if (this.hitAnimation > 0) {
            this.hitAnimation -= 0.05;
        }
    }

    draw(ctx) {
        const topY = this.y - this.currentH;
        
        ctx.save();
        
        // Main Bar Body
        ctx.beginPath();
        ctx.roundRect(this.x - this.w / 2, this.y - CONFIG.maxBarHeight, this.w, CONFIG.maxBarHeight, CONFIG.barRounded);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        // Progress Fill
        if (this.currentH > 0) {
            ctx.beginPath();
            ctx.roundRect(this.x - this.w / 2, topY, this.w, this.currentH, CONFIG.barRounded);
            ctx.fillStyle = CONFIG.barFill;
            ctx.fill();
            ctx.strokeStyle = `rgba(0, 210, 255, ${0.3 + this.hitAnimation * 0.7})`;
            ctx.lineWidth = 1 + this.hitAnimation * 2;
            ctx.stroke();

            // Glow when hit
            if (this.hitAnimation > 0) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = CONFIG.ballColor;
                ctx.stroke();
            }
        }

        // Draw delimiters (paliers)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 1; i < CONFIG.maxLevels; i++) {
            const levelY = this.y - (i / CONFIG.maxLevels) * CONFIG.maxBarHeight;
            ctx.beginPath();
            ctx.moveTo(this.x - this.w / 2 + 5, levelY);
            ctx.lineTo(this.x + this.w / 2 - 5, levelY);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.r = CONFIG.ballRadius;
        this.targetX = x;
    }

    update() {
        this.vy += CONFIG.gravity;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(this.x - 3, this.y - 3, 2, this.x, this.y, this.r);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.4, CONFIG.ballColor);
        gradient.addColorStop(1, '#0096b3');
        
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 15;
        ctx.shadowColor = CONFIG.ballColor;
        ctx.fill();
        ctx.restore();
    }
}

class Simulation {
    constructor(canvasId, mode) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.mode = mode;
        this.bars = [];
        this.ball = null;
        this.currentIndex = 0;
        this.direction = 1; // For multitasking (1 for right, -1 for left)
        this.width = 0;
        this.height = 0;
        this.finished = false;
        
        this.resize();
        this.init();
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        if (this.bars.length > 0) this.init(); // Redraw if resized
    }

    init() {
        const barCount = 5;
        const spacing = this.width / (barCount + 1);
        const groundY = this.height - 40;

        this.bars = [];
        for (let i = 1; i <= barCount; i++) {
            this.bars.push(new Bar(i * spacing, groundY, CONFIG.barWidth));
        }

        this.currentIndex = 0;
        this.direction = 1;
        this.finished = false;
        const startBar = this.bars[this.currentIndex];
        this.ball = new Ball(startBar.x, 60);
    }

    checkFinished() {
        return this.bars.every(bar => bar.level >= CONFIG.maxLevels);
    }

    handleCollision(bar, index) {
        if (this.finished) return;

        const barTop = bar.y - bar.currentH;
        
        // Ball is falling and hits the top of the bar
        if (this.ball.vy > 0 && 
            this.ball.y + this.ball.r >= barTop && 
            this.ball.y - this.ball.r <= barTop + 15 &&
            this.ball.x >= bar.x - bar.w / 2 && 
            this.ball.x <= bar.x + bar.w / 2) {
            
            // Increment progress
            if (bar.level < CONFIG.maxLevels) {
                bar.level++;
                bar.hitAnimation = 1.0;
            }

            // Check if we just finished everything
            if (this.checkFinished()) {
                this.finished = true;
                this.ball.vx = 0;
                this.ball.vy = 0;
                this.ball.y = barTop - this.ball.r;
                return;
            }

            // Decide where to go next
            if (this.mode === 'multitasking') {
                // Check if we should move or bounce again at the edge
                const atEnd = this.currentIndex >= this.bars.length - 1;
                const atStart = this.currentIndex <= 0;
                
                if ((atEnd && this.direction === 1) || (atStart && this.direction === -1)) {
                    this.direction *= -1;
                } else {
                    this.currentIndex += this.direction;
                }
            } else {
                // Focus: stay on same bar until done
                if (bar.level >= CONFIG.maxLevels) {
                    this.currentIndex = (this.currentIndex + 1) % this.bars.length;
                }
            }

            // Calculate jump to target bar
            const targetBar = this.bars[this.currentIndex];
            const dist = targetBar.x - this.ball.x;
            
            this.ball.y = barTop - this.ball.r;
            this.ball.vy = -Math.sqrt(2 * CONFIG.gravity * (this.height - 150));
            
            const timeToImpact = Math.abs(this.ball.vy / CONFIG.gravity) * 2;
            this.ball.vx = dist / timeToImpact;
        }
    }

    update() {
        if (!this.finished) {
            this.ball.update();
        }
        
        this.bars.forEach((bar, index) => {
            this.handleCollision(bar, index);
            bar.update();
        });

        // Ground check (failsafe)
        if (this.ball.y > this.height && !this.finished) {
            this.init();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw Axes (faint)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.beginPath();
        this.ctx.moveTo(40, 20);
        this.ctx.lineTo(40, this.height - 40);
        this.ctx.lineTo(this.width - 20, this.height - 40);
        this.ctx.stroke();

        this.bars.forEach(bar => bar.draw(this.ctx));
        this.ball.draw(this.ctx);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

const mtSim = new Simulation('multitasking-canvas', 'multitasking');
const focusSim = new Simulation('focus-canvas', 'focus');

mtSim.loop();
focusSim.loop();
