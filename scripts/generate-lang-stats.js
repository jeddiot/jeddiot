#!/usr/bin/env node
/**
 * generate-lang-stats.js
 *
 * Usage:
 *   node scripts/generate-lang-stats.js --user=username --out=docs/languages.svg
 *   OR
 *   node scripts/generate-lang-stats.js --repo=owner/repo --out=docs/languages.svg
 *
 * It reads GITHUB_TOKEN from env if available (for higher rate limits).
 *
 * Requirements: Node 18+ (for global fetch). If using older Node locally, install node-fetch or run in the Action which uses Node 20.
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(a => {
    if (a.startsWith('--')) {
      const [k, v] = a.split('=');
      args[k.replace(/^--/, '')] = v === undefined ? true : v;
    }
  });
  return args;
}

const args = parseArgs();
const repo = args.repo || process.env.REPO;
const user = args.user || process.env.USER;
const outPath = args.out || 'docs/languages.svg';
const token = process.env.GITHUB_TOKEN || args.token || '';

if (!repo && !user) {
  console.error('Error: repo or user not specified. Use --repo=owner/repo or --user=username');
  process.exit(1);
}

async function fetchUserRepos(username) {
  const headers = {
    'User-Agent': 'lang-stats-generator',
    Accept: 'application/vnd.github.v3+json'
  };
  if (token) headers.Authorization = `token ${token}`;
  
  let allRepos = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status} ${res.statusText} for ${url}`);
    }
    const repos = await res.json();
    if (repos.length === 0) break;
    allRepos = allRepos.concat(repos.filter(r => !r.fork)); // exclude forks
    page++;
  }
  return allRepos;
}

async function fetchLanguages(repo) {
  const url = `https://api.github.com/repos/${repo}/languages`;
  const headers = {
    'User-Agent': 'lang-stats-generator',
    Accept: 'application/vnd.github.v3+json'
  };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchAllLanguages(username) {
  const repos = await fetchUserRepos(username);
  console.log(`Found ${repos.length} public repositories for ${username}`);
  
  const allLangs = {};
  for (const repo of repos) {
    try {
      const langs = await fetchLanguages(repo.full_name);
      for (const [lang, bytes] of Object.entries(langs)) {
        allLangs[lang] = (allLangs[lang] || 0) + bytes;
      }
    } catch (err) {
      console.warn(`Warning: Could not fetch languages for ${repo.full_name}: ${err.message}`);
    }
  }
  return allLangs;
}

function colorForLanguage(lang) {
  // small mapping for common languages (GitHub-like colors). Fallback to palette.
  const map = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Java: '#b07219',
    Shell: '#89e051',
    Go: '#00ADD8',
    Rust: '#dea584',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    PHP: '#4F5D95',
    Ruby: '#701516',
    Vue: '#41B883',
    SCSS: '#c6538c',
    Markdown: '#083fa1',
    JSON: '#292929',
  };
  if (map[lang]) return map[lang];
  // fallback palette
  const palette = ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd'];
  let h = 0;
  for (let i = 0; i < lang.length; i++) h = (h * 31 + lang.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function generateSVG(data, title) {
  // data: [{name, bytes, percent}]
  const width = 760;
  const padding = 20;
  const barX = padding;
  const barY = 40;
  const barWidth = width - padding * 2;
  const barHeight = 24;

  const totalText = title;
  // Build stacked bar segments
  let x = barX;
  const segments = data.map((d) => {
    const w = Math.max(Math.round((d.percent / 100) * barWidth), d.percent > 0 ? 1 : 0);
    const seg = { x, width: w, color: colorForLanguage(d.name), name: d.name, percent: d.percent };
    x += w;
    return seg;
  });

  // Legend columns
  const legendX = padding;
  const legendY = barY + barHeight + 16;
  const legendItemHeight = 18;
  const legendCols = 2;
  const legendColWidth = (width - padding * 2) / legendCols;
  
  // Calculate height dynamically based on legend rows
  const legendRows = Math.ceil(data.length / legendCols);
  const legendHeight = legendRows * (legendItemHeight + 6);
  const height = legendY + legendHeight + 30; // Extra space for the updated text

  const ns = 'http://www.w3.org/2000/svg';
  let svg = '';
  svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="${ns}">\n`;
  svg += `<style>
    .title{font:600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;}
    .percent{font:500 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;}
    .legend{font:12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;}
  </style>\n`;
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="#2d2d2d" rx="8" />\n`;
  svg += `<text x="${padding}" y="${padding + 6}" class="title" fill="#ffffff">${escapeXml(totalText)}</text>\n`;

  // stacked bar background
  svg += `<g transform="translate(0,0)">\n`;
  svg += `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="6" fill="#e6e6e6" />\n`;
  // segments
  for (const seg of segments) {
    if (seg.width <= 0) continue;
    svg += `<rect x="${seg.x}" y="${barY}" width="${seg.width}" height="${barHeight}" rx="0" fill="${seg.color}">\n`;
    svg += `<title>${escapeXml(`${seg.name}: ${seg.percent.toFixed(1)}%`)}</title>\n`;
    svg += `</rect>\n`;
  }
  svg += `</g>\n`;

  // Legend
  data.forEach((d, i) => {
    const col = i % legendCols;
    const row = Math.floor(i / legendCols);
    const lx = legendX + col * legendColWidth;
    const ly = legendY + row * (legendItemHeight + 6);
    const color = colorForLanguage(d.name);
    svg += `<g class="legend">\n`;
    svg += `<rect x="${lx}" y="${ly - 12}" width="12" height="12" rx="2" fill="${color}" />\n`;
    svg += `<text x="${lx + 18}" y="${ly - 2}" font-size="12" fill="#ffffff">${escapeXml(d.name)}</text>\n`;
    svg += `<text x="${lx + legendColWidth - 48}" y="${ly - 2}" font-size="12" fill="#ffffff" text-anchor="end">${d.percent.toFixed(1)}%</text>\n`;
    svg += `</g>\n`;
  });

  // Footer small note - positioned below the legend
  svg += `<text x="${padding}" y="${height - 6}" font-size="10" fill="#aaaaaa">Updated: ${new Date().toISOString()}</text>\n`;

  svg += `</svg>\n`;
  return svg;
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
    }
  });
}

(async () => {
  try {
    let json;
    let title;
    
    if (user) {
      // Fetch all repos for the user and aggregate languages
      json = await fetchAllLanguages(user);
      title = `Languages across all repos for ${user}`;
    } else {
      // Single repo mode
      json = await fetchLanguages(repo);
      title = `Languages for ${repo}`;
    }
    
    const entries = Object.entries(json || {});
    if (entries.length === 0) {
      // No languages (maybe empty repo). Create placeholder SVG.
      const placeholderTitle = user ? user : repo;
      const placeholder = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="90" xmlns="http://www.w3.org/2000/svg">
  <style>.t{font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;}</style>
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="16" y="28" class="t">No language data for ${escapeXml(placeholderTitle)}</text>
  <text x="16" y="54" font-size="11" fill="#666">Make sure the repository exists and is public, or provide a token with repo access.</text>
</svg>`;
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, placeholder, 'utf8');
      console.log(`Wrote placeholder SVG to ${outPath}`);
      return;
    }
    const total = entries.reduce((s, [, v]) => s + v, 0);
    let list = entries.map(([k, v]) => ({ name: k, bytes: v, percent: (v / total) * 100 }));
    list.sort((a, b) => b.bytes - a.bytes);

    // Keep top 8, aggregate rest into "Other"
    const maxItems = 8;
    if (list.length > maxItems) {
      const top = list.slice(0, maxItems);
      const rest = list.slice(maxItems);
      const restBytes = rest.reduce((s, r) => s + r.bytes, 0);
      top.push({ name: 'Other', bytes: restBytes, percent: (restBytes / total) * 100 });
      list = top;
    }

    // Round percents nicely but keep sum 100
    let rounded = list.map(l => ({ ...l, percent: l.percent }));
    // ensure sum round doesn't stray too far — just format later with toFixed(1)
    const svg = generateSVG(rounded, title);
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    await fs.promises.writeFile(outPath, svg, 'utf8');
    console.log(`Wrote language SVG to ${outPath}`);
  } catch (err) {
    console.error('Error generating language SVG:', err.message || err);
    process.exit(1);
  }
})();