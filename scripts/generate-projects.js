// scripts/generate-projects.js
/**
 * Generates a project showcase for the README.
 * Expects env:
 *   - GITHUB_TOKEN (auto-provided by actions)
 *   - GITHUB_USERNAME (set in workflow)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const USERNAME = process.env.GITHUB_USERNAME || 'ranashardul';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('GITHUB_TOKEN is required.');
  process.exit(1);
}

function apiRequest(pathname) {
  const options = {
    hostname: 'api.github.com',
    path: pathname,
    method: 'GET',
    headers: {
      'User-Agent': 'github-readme-script',
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    // Fetch repos (we'll fetch up to 100; you can handle pagination if you have >100)
    const repos = await apiRequest(`/users/${USERNAME}/repos?per_page=100&sort=pushed`);
    if (!Array.isArray(repos)) {
      console.error('Unexpected response from GitHub API', repos);
      process.exit(1);
    }

    // Filter forks and archived (optional)
    const filtered = repos.filter(r => !r.fork && !r.archived).slice(0, 18); // top 18

    function repoIconForLanguage(lang) {
      if (!lang) return 'https://skillicons.dev/icons?i=github';
      const map = {
        'JavaScript': 'javascript',
        'TypeScript': 'typescript',
        'Python': 'python',
        'Java': 'java',
        'HTML': 'html',
        'CSS': 'css',
        'Jupyter Notebook': 'jupyter',
        'C++': 'cpp',
        'C': 'c',
        'Go': 'go',
        'Shell': 'bash',
        'Kotlin': 'kotlin',
        'Rust': 'rust'
      };
      const key = map[lang] || null;
      if (key) return `https://skillicons.dev/icons?i=${key}`;
      return `https://skillicons.dev/icons?i=github`;
    }

    // Build cards 3 per row
    const rows = [];
    for (let i = 0; i < filtered.length; i += 3) {
      const chunk = filtered.slice(i, i + 3);
      const cols = chunk.map(r => {
        const language = r.language || '';
        const icon = repoIconForLanguage(language);
        const desc = r.description ? r.description.replace(/\n/g, ' ') : '';
        const demo = r.homepage ? `<a href="${r.homepage}" target="_blank">Demo</a>` : '';
        return `
<td align="center" width="33%">
  <a href="${r.html_url}" target="_blank">
    <img src="${icon}" width="80" alt="${r.name}" />
    <h4>${r.name}</h4>
    <p>${desc}</p>
  </a>
</td>`;
      }).join('\n');
      rows.push(`<tr>${cols}</tr>`);
    }

    const tableHtml = `<table>${rows.join('\n')}</table>`;

    // Update README.md: replace between PROJECTS:START and PROJECTS:END
    const readmePath = path.join(process.cwd(), 'README.md');
    let readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';

    const startTag = '<!-- PROJECTS:START -->';
    const endTag = '<!-- PROJECTS:END -->';
    let newSection = `${startTag}\n${tableHtml}\n${endTag}`;

    if (readme.includes(startTag) && readme.includes(endTag)) {
      const before = readme.split(startTag)[0];
      const after = readme.split(endTag)[1];
      readme = `${before}${newSection}${after}`;
    } else {
      // Append if tags not found
      readme = `${readme}\n\n${newSection}\n`;
    }

    fs.writeFileSync(readmePath, readme, 'utf8');
    fs.writeFileSync('projects.md', tableHtml, 'utf8');

    console.log('Project cards generated and README.md updated.');
  } catch (err) {
    console.error('Error generating projects', err);
    process.exit(1);
  }
})();
