import express from 'express';
import { authenticateToken } from '../auth.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const router = express.Router();

// Get user's repositories
router.get('/repositories', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (!user.accessToken) {
      return res.status(400).json({ error: 'GitHub access token required' });
    }

    // Fetch user's repositories from GitHub
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
      headers: {
        'Authorization': `token ${user.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    const repositories = await response.json();
    
    // Transform repository data for dashboard
    const transformedRepos = repositories.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      language: repo.language,
      isPrivate: repo.private,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      openIssuesCount: repo.open_issues_count,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      createdAt: repo.created_at,
    }));

    res.json(transformedRepos);
  } catch (error) {
    log.error({ error }, 'Failed to fetch repositories');
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// Get repository details
router.get('/repositories/:owner/:repo', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { owner, repo } = req.params;
    
    if (!user.accessToken) {
      return res.status(400).json({ error: 'GitHub access token required' });
    }

    // Fetch repository details from GitHub
    const [repoResponse, issuesResponse, prsResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `token ${user.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`, {
        headers: {
          'Authorization': `token ${user.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=10`, {
        headers: {
          'Authorization': `token ${user.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }),
    ]);

    if (!repoResponse.ok) {
      throw new Error('Failed to fetch repository details');
    }

    const [repoData, issuesData, prsData] = await Promise.all([
      repoResponse.json(),
      issuesResponse.ok ? issuesResponse.json() : [],
      prsResponse.ok ? prsResponse.json() : [],
    ]);

    res.json({
      repository: repoData,
      issues: issuesData,
      pullRequests: prsData,
      metrics: {
        openIssues: issuesData.length,
        openPRs: prsData.length,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to fetch repository details');
    res.status(500).json({ error: 'Failed to fetch repository details' });
  }
});

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Mock statistics for now - in production, these would come from your database
    const stats = {
      activeAgents: 15,
      totalRepositories: 8,
      successRate: 98.5,
      tasksCompleted: 247,
      tasksToday: 23,
      vulnerabilitiesFixed: 12,
      performanceImprovements: 8,
      codeQualityScore: 95,
    };

    res.json(stats);
  } catch (error) {
    log.error({ error }, 'Failed to fetch dashboard stats');
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get activity feed
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    // Mock activity data - in production, this would come from your database
    const activities = [
      {
        id: 1,
        type: 'performance',
        message: 'Performance optimization completed on main-project',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        repository: 'main-project',
        status: 'success',
      },
      {
        id: 2,
        type: 'security',
        message: 'Security scan passed for all repositories',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        repository: 'all',
        status: 'success',
      },
      {
        id: 3,
        type: 'quality',
        message: 'Code quality improvements applied to api-gateway',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        repository: 'api-gateway',
        status: 'success',
      },
      {
        id: 4,
        type: 'bug_fix',
        message: 'Auto-resolved 3 critical issues in security-tools',
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        repository: 'security-tools',
        status: 'success',
      },
      {
        id: 5,
        type: 'deployment',
        message: 'Deployment pipeline optimized for main-project',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        repository: 'main-project',
        status: 'success',
      },
    ];

    res.json(activities);
  } catch (error) {
    log.error({ error }, 'Failed to fetch activity feed');
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// Enable/disable agent for repository
router.post('/repositories/:owner/:repo/agent', authenticateToken, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { enabled } = req.body;

    // In production, this would update your database
    log.info({ owner, repo, enabled }, 'Agent status updated');

    res.json({ 
      message: `Agent ${enabled ? 'enabled' : 'disabled'} for ${owner}/${repo}`,
      status: enabled ? 'active' : 'inactive'
    });
  } catch (error) {
    log.error({ error }, 'Failed to update agent status');
    res.status(500).json({ error: 'Failed to update agent status' });
  }
});

export default router;