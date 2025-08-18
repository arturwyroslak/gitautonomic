// GitAutonomic Dashboard JavaScript
class GitAutonomicDashboard {
    constructor() {
        this.user = null;
        this.charts = {};
        this.enhancementFunctions = [
            { name: 'Performance Analytics Engine', module: 'Module 1', status: 'active', description: 'Code performance analysis with bottleneck detection' },
            { name: 'Code Review Automation', module: 'Module 1', status: 'active', description: 'Automated code review with security scanning' },
            { name: 'Dependency Management', module: 'Module 1', status: 'active', description: 'Vulnerability scanning and optimization' },
            { name: 'Testing Strategy Engine', module: 'Module 1', status: 'active', description: 'Comprehensive testing plan generation' },
            { name: 'Cross-Repository Learning', module: 'Module 1', status: 'active', description: 'Pattern learning from similar projects' },
            { name: 'Collaboration Intelligence', module: 'Module 2', status: 'active', description: 'Team collaboration analysis' },
            { name: 'Security Monitoring', module: 'Module 2', status: 'active', description: 'Multi-layer security analysis' },
            { name: 'Resource Optimization', module: 'Module 2', status: 'active', description: 'Performance and resource optimization' },
            { name: 'Predictive Maintenance', module: 'Module 2', status: 'warning', description: 'Proactive system maintenance' },
            { name: 'Documentation Generator', module: 'Module 2', status: 'active', description: 'Automated API documentation' },
            { name: 'Conflict Resolution', module: 'Module 3', status: 'active', description: 'Intelligent code conflict resolution' },
            { name: 'Migration Assistant', module: 'Module 3', status: 'active', description: 'Framework migration planning' },
            { name: 'API Design Assistant', module: 'Module 3', status: 'active', description: 'OpenAPI specification generation' },
            { name: 'Performance Benchmarking', module: 'Module 3', status: 'active', description: 'Comprehensive performance testing' },
            { name: 'Error Recovery System', module: 'Module 3', status: 'active', description: 'Automated error detection and recovery' },
            { name: 'Code Quality Gates', module: 'Module 4', status: 'active', description: 'Multi-criteria quality evaluation' },
            { name: 'Metrics Collection', module: 'Module 4', status: 'active', description: 'System and performance metrics' },
            { name: 'Workflow Optimization', module: 'Module 4', status: 'active', description: 'CI/CD pipeline optimization' },
            { name: 'Release Management', module: 'Module 4', status: 'active', description: 'Release planning and risk assessment' },
            { name: 'UX Analytics', module: 'Module 4', status: 'active', description: 'User experience analytics' }
        ];
        
        this.init();
    }

    async init() {
        await this.loadUser();
        this.setupEventListeners();
        this.setupNavigation();
        this.loadDashboardData();
        this.initializeCharts();
        this.renderEnhancementFunctions();
        this.startRealTimeUpdates();
    }

    // Helper: build fetch options with optional Authorization and always include cookies
    authFetchOptions(extra = {}) {
        const token = this.getToken();
        const headers = { ...(extra.headers || {}) };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return { credentials: 'include', ...extra, headers };
    }

    async loadUser() {
        try {
            const response = await fetch('/api/auth/me', this.authFetchOptions());

            if (response.ok) {
                this.user = await response.json();
                this.updateUserInterface();
            } else {
                // Redirect to login if not authenticated
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Failed to load user:', error);
            window.location.href = '/';
        }
    }

    getToken() {
        // Tylko localStorage – cookie httpOnly nie jest dostępne w JS
        return localStorage.getItem('auth_token') || null;
    }

    updateUserInterface() {
        if (this.user) {
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            const userEmail = document.getElementById('userEmail');

            if (userAvatar && this.user.avatarUrl) {
                userAvatar.src = this.user.avatarUrl;
            }
            if (userName) {
                userName.textContent = this.user.username || this.user.email;
            }
            if (userEmail) {
                userEmail.textContent = this.user.email;
            }
        }
    }

    setupEventListeners() {
        // Logout functionality
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDashboard());
        }

        // Repository connection
        const connectRepoBtn = document.getElementById('connectRepoBtn');
        if (connectRepoBtn) {
            connectRepoBtn.addEventListener('click', () => this.connectRepository());
        }

        const addRepoBtn = document.getElementById('addRepoBtn');
        if (addRepoBtn) {
            addRepoBtn.addEventListener('click', () => this.connectRepository());
        }
    }

    setupNavigation() {
        const menuItems = document.querySelectorAll('.menu-item');
        const contentSections = document.querySelectorAll('.content-section');

        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all items
                menuItems.forEach(mi => mi.classList.remove('active'));
                contentSections.forEach(cs => cs.classList.remove('active'));
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Show corresponding content section
                const sectionId = item.getAttribute('data-section');
                const section = document.getElementById(sectionId);
                if (section) {
                    section.classList.add('active');
                }
            });
        });
    }

    async loadDashboardData() {
        try {
            // Load real dashboard data from API
            await Promise.all([
                this.loadStats(),
                this.loadActivityFeed(),
                this.loadRepositories(),
            ]);
            this.updateMetrics();
            this.loadAgents();
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/dashboard/stats', this.authFetchOptions());

            if (response.ok) {
                this.stats = await response.json();
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    updateMetrics() {
        if (this.stats) {
            document.getElementById('activeAgents').textContent = this.stats.activeAgents || this.enhancementFunctions.filter(f => f.status === 'active').length;
            document.getElementById('totalRepos').textContent = this.stats.totalRepositories || 0;
            document.getElementById('successRate').textContent = `${this.stats.successRate || 98.5}%`;
            document.getElementById('tasksCompleted').textContent = this.stats.tasksCompleted || 247;
        } else {
            // Fallback to mock data
            const activeAgents = this.enhancementFunctions.filter(f => f.status === 'active').length;
            document.getElementById('activeAgents').textContent = activeAgents;
            document.getElementById('totalRepos').textContent = '0';
            document.getElementById('successRate').textContent = '98.5%';
            document.getElementById('tasksCompleted').textContent = '247';
        }
    }

    async loadActivityFeed() {
        try {
            const response = await fetch('/api/dashboard/activity', this.authFetchOptions());

            if (response.ok) {
                const activities = await response.json();
                this.renderActivityFeed(activities);
            } else {
                this.renderMockActivityFeed();
            }
        } catch (error) {
            console.error('Failed to load activity feed:', error);
            this.renderMockActivityFeed();
        }
    }

    renderActivityFeed(activities) {
        const activityFeed = document.getElementById('activityFeed');
        if (activityFeed) {
            activityFeed.innerHTML = activities.map(activity => {
                const timeAgo = this.getTimeAgo(new Date(activity.timestamp));
                const iconClass = this.getActivityIcon(activity.type);
                
                return `
                    <div class="activity-item">
                        <i class="${iconClass}"></i>
                        <div class="activity-content">
                            <div class="activity-text">${activity.message}</div>
                            <div class="activity-time" style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">${timeAgo}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    renderMockActivityFeed() {
        const activities = [
            { icon: 'fas fa-check-circle success', text: 'Performance optimization completed on repo/main', time: '2 minutes ago' },
            { icon: 'fas fa-shield-alt security', text: 'Security scan passed for all repositories', time: '5 minutes ago' },
            { icon: 'fas fa-code performance', text: 'Code quality improvements applied', time: '12 minutes ago' },
            { icon: 'fas fa-bug success', text: 'Auto-resolved 3 critical issues', time: '18 minutes ago' },
            { icon: 'fas fa-rocket success', text: 'Deployment pipeline optimized', time: '25 minutes ago' },
            { icon: 'fas fa-database performance', text: 'Database performance improved by 15%', time: '32 minutes ago' }
        ];

        const activityFeed = document.getElementById('activityFeed');
        if (activityFeed) {
            activityFeed.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <i class="${activity.icon}"></i>
                    <div class="activity-content">
                        <div class="activity-text">${activity.text}</div>
                        <div class="activity-time" style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">${activity.time}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    getActivityIcon(type) {
        const icons = {
            performance: 'fas fa-tachometer-alt performance',
            security: 'fas fa-shield-alt security',
            quality: 'fas fa-code performance',
            bug_fix: 'fas fa-bug success',
            deployment: 'fas fa-rocket success',
            default: 'fas fa-check-circle success'
        };
        return icons[type] || icons.default;
    }

    renderEnhancementFunctions() {
        const functionsGrid = document.getElementById('functionsGrid');
        if (functionsGrid) {
            functionsGrid.innerHTML = this.enhancementFunctions.map(func => `
                <div class="function-card">
                    <div class="function-status ${func.status}"></div>
                    <div class="function-info">
                        <div class="function-name">${func.name}</div>
                        <div class="function-description">${func.description}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    loadAgents() {
        const agents = [
            { 
                name: 'Primary Analysis Agent', 
                status: 'active', 
                repository: 'main-project',
                tasksCompleted: 45,
                uptime: '99.9%',
                lastActivity: '2 min ago'
            },
            { 
                name: 'Security Monitor Agent', 
                status: 'active', 
                repository: 'security-audit',
                tasksCompleted: 23,
                uptime: '100%',
                lastActivity: '5 min ago'
            },
            { 
                name: 'Performance Agent', 
                status: 'active', 
                repository: 'optimization',
                tasksCompleted: 67,
                uptime: '98.5%',
                lastActivity: '1 min ago'
            }
        ];

        const agentsGrid = document.getElementById('agentsGrid');
        if (agentsGrid) {
            agentsGrid.innerHTML = agents.map(agent => `
                <div class="agent-card">
                    <div class="agent-header">
                        <div class="agent-name">${agent.name}</div>
                        <div class="agent-status ${agent.status}">${agent.status.toUpperCase()}</div>
                    </div>
                    <div class="agent-repository" style="color: #6b7280; margin-bottom: 1rem;">
                        <i class="fas fa-code-branch"></i> ${agent.repository}
                    </div>
                    <div class="agent-stats">
                        <div class="agent-stat">
                            <div class="agent-stat-value">${agent.tasksCompleted}</div>
                            <div class="agent-stat-label">Tasks</div>
                        </div>
                        <div class="agent-stat">
                            <div class="agent-stat-value">${agent.uptime}</div>
                            <div class="agent-stat-label">Uptime</div>
                        </div>
                    </div>
                    <div class="agent-activity" style="color: #6b7280; font-size: 0.875rem; margin-top: 1rem;">
                        Last activity: ${agent.lastActivity}
                    </div>
                </div>
            `).join('');
        }
    }

    async loadRepositories() {
        try {
            const response = await fetch('/api/dashboard/repositories', this.authFetchOptions());

            if (response.ok) {
                const repositories = await response.json();
                this.renderRepositories(repositories);
            } else {
                this.renderMockRepositories();
            }
        } catch (error) {
            console.error('Failed to load repositories:', error);
            this.renderMockRepositories();
        }
    }

    renderRepositories(repositories) {
        const repositoriesList = document.getElementById('repositoriesList');
        if (repositoriesList) {
            if (repositories.length === 0) {
                repositoriesList.innerHTML = `
                    <div class="dashboard-card" style="text-align: center; padding: 3rem;">
                        <i class="fas fa-code-branch" style="font-size: 3rem; color: #9ca3af; margin-bottom: 1rem;"></i>
                        <h3 style="margin-bottom: 1rem; color: #6b7280;">No Repositories Connected</h3>
                        <p style="color: #9ca3af; margin-bottom: 2rem;">Connect your GitHub repositories to start using GitAutonomic AI agents.</p>
                        <button id="connectFirstRepo" class="btn-primary">
                            <i class="fab fa-github"></i>
                            Connect Your First Repository
                        </button>
                    </div>
                `;
                
                // Add event listener for connect button
                const connectBtn = document.getElementById('connectFirstRepo');
                if (connectBtn) {
                    connectBtn.addEventListener('click', () => this.connectRepository());
                }
                return;
            }

            repositoriesList.innerHTML = repositories.map(repo => `
                <div class="dashboard-card" style="margin-bottom: 1rem;">
                    <div class="card-header">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <h3>${repo.name}</h3>
                            <span class="agent-status active">connected</span>
                            ${repo.isPrivate ? '<i class="fas fa-lock" style="color: #6b7280;" title="Private repository"></i>' : ''}
                        </div>
                        <div class="card-actions">
                            <button class="btn-icon" onclick="window.open('${repo.url}', '_blank')">
                                <i class="fab fa-github"></i>
                            </button>
                            <button class="btn-icon">
                                <i class="fas fa-cogs"></i>
                            </button>
                        </div>
                    </div>
                    <div style="padding: 1.5rem;">
                        ${repo.description ? `<p style="color: #6b7280; margin-bottom: 1rem;">${repo.description}</p>` : ''}
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                            <div class="agent-stat">
                                <div class="agent-stat-value">${repo.stargazersCount}</div>
                                <div class="agent-stat-label">Stars</div>
                            </div>
                            <div class="agent-stat">
                                <div class="agent-stat-value">${repo.forksCount}</div>
                                <div class="agent-stat-label">Forks</div>
                            </div>
                            <div class="agent-stat">
                                <div class="agent-stat-value">${repo.openIssuesCount}</div>
                                <div class="agent-stat-label">Issues</div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; color: #6b7280; font-size: 0.875rem;">
                            <span><i class="fas fa-code"></i> ${repo.language || 'Unknown'}</span>
                            <span>Updated ${this.getTimeAgo(new Date(repo.updatedAt))}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    renderMockRepositories() {
        const repositories = [
            { 
                name: 'main-project', 
                status: 'active',
                language: 'TypeScript',
                agents: 3,
                lastUpdate: '2 hours ago',
                issues: 2,
                prs: 5
            },
            { 
                name: 'security-tools', 
                status: 'active',
                language: 'Python',
                agents: 1,
                lastUpdate: '1 day ago',
                issues: 0,
                prs: 2
            },
            { 
                name: 'api-gateway', 
                status: 'monitoring',
                language: 'Go',
                agents: 2,
                lastUpdate: '3 hours ago',
                issues: 1,
                prs: 3
            }
        ];

        const repositoriesList = document.getElementById('repositoriesList');
        if (repositoriesList) {
            repositoriesList.innerHTML = repositories.map(repo => `
                <div class="dashboard-card" style="margin-bottom: 1rem;">
                    <div class="card-header">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <h3>${repo.name}</h3>
                            <span class="agent-status ${repo.status}">${repo.status}</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn-icon">
                                <i class="fas fa-cogs"></i>
                            </button>
                        </div>
                    </div>
                    <div style="padding: 1.5rem;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                            <div class="agent-stat">
                                <div class="agent-stat-value">${repo.agents}</div>
                                <div class="agent-stat-label">Agents</div>
                            </div>
                            <div class="agent-stat">
                                <div class="agent-stat-value">${repo.issues}</div>
                                <div class="agent-stat-label">Issues</div>
                            </div>
                            <div class="agent-stat">
                                <div class="agent-stat-value">${repo.prs}</div>
                                <div class="agent-stat-label">PRs</div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; color: #6b7280; font-size: 0.875rem;">
                            <span><i class="fas fa-code"></i> ${repo.language}</span>
                            <span>Updated ${repo.lastUpdate}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    initializeCharts() {
        this.initPerformanceChart();
        this.initQualityChart();
        this.initSecurityChart();
    }

    initPerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (ctx) {
            this.charts.performance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Tasks Completed',
                        data: [12, 19, 15, 25, 22, 18, 24],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }, {
                        label: 'Success Rate %',
                        data: [95, 97, 96, 98, 99, 97, 98],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    initQualityChart() {
        const ctx = document.getElementById('qualityChart');
        if (ctx) {
            this.charts.quality = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Excellent', 'Good', 'Fair', 'Poor'],
                    datasets: [{
                        data: [65, 25, 8, 2],
                        backgroundColor: [
                            '#10b981',
                            '#3b82f6',
                            '#f59e0b',
                            '#ef4444'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }

    initSecurityChart() {
        const ctx = document.getElementById('securityChart');
        if (ctx) {
            this.charts.security = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Vulnerabilities Fixed', 'Scans Passed', 'Compliance Score'],
                    datasets: [{
                        label: 'Security Metrics',
                        data: [23, 45, 95],
                        backgroundColor: [
                            '#10b981',
                            '#3b82f6',
                            '#8b5cf6'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
    }

    startRealTimeUpdates() {
        // Update metrics every 30 seconds
        setInterval(() => {
            this.updateMetrics();
            this.loadActivityFeed();
        }, 30000);
    }

    async refreshDashboard() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            
            setTimeout(() => {
                icon.classList.remove('fa-spin');
            }, 1000);
        }
        
        await this.loadDashboardData();
    }

    connectRepository() {
        // Poprawiony URL – router auth jest pod /api/auth
        window.open('/api/auth/github', '_blank', 'width=600,height=700');
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            localStorage.removeItem('auth_token');
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
            window.location.href = '/';
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GitAutonomicDashboard();
});
