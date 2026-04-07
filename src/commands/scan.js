/**
 * nom scan — Run a deployment scan/audit via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function scan(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  console.log(`\n  Scanning ${appId}...\n`);

  const result = await apiRequest('/runAiScan', {
    apiKey,
    body: { app_id: appId, migration_id: config.migration_id },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Backend may nest under result.results
  const data = result.results || result;

  // Display scores
  const scoreKeys = ['securityScore', 'performanceScore', 'codeQuality'];
  const hasScores = scoreKeys.some(k => data[k] != null);
  if (hasScores) {
    console.log('  Scores:');
    for (const key of scoreKeys) {
      if (data[key] != null) {
        const label = key.replace(/([A-Z])/g, ' $1').trim();
        const bar = buildBar(data[key]);
        console.log(`    ${label.padEnd(20)} ${bar} ${data[key]}/100`);
      }
    }
    console.log();
  }

  // Display overall score
  const overall = data.overall_score || result.overall_score;
  if (overall != null) {
    console.log(`  Overall: ${overall}/100\n`);
  }

  // Display issues
  const issues = data.issues || result.issues || [];
  if (issues.length) {
    console.log('  Issues:\n');
    for (const issue of issues) {
      const severity = (issue.severity || 'info').toUpperCase().padEnd(8);
      const msg = issue.message || issue.title || 'Unknown issue';
      console.log(`    [${severity}] ${msg}`);
      if (issue.description) console.log(`              ${issue.description}`);
      if (issue.fix) console.log(`              Fix: ${issue.fix}`);
    }
    console.log();
  } else {
    console.log('  No issues found.\n');
  }
}

function buildBar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}
