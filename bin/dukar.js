#!/usr/bin/env node

// Suppress the DEP0190 warning emitted on Windows by spawn({ shell: true }).
// We deliberately use shell:true with our own quoting (see src/invoke.js).
process.removeAllListeners('warning');

const { runManual, runHook, runBackground } = require('../src/runner');
const { install } = require('../src/install');
const { uninstall } = require('../src/uninstall');
const { status } = require('../src/status');
const { history } = require('../src/history');

const pkg = require('../package.json');

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`Dukar v${pkg.version} — daily diagnostic hook for Claude Code`);
  console.log('');
  console.log('Usage: dukar <command>');
  console.log('');
  console.log('Commands:');
  console.log('  install       Register the SessionStart hook in Claude Code');
  console.log('  uninstall     Remove the hook (--keep-history to preserve logs)');
  console.log('  run           Run the full diagnostic battery now');
  console.log('  status        Show results of the most recent run');
  console.log('  history       Show pass rates over the last 7 and 30 days');
  console.log('');
  console.log('Dukar runs automatically on your first Claude Code session each day.');
  console.log('Healthy days produce zero output. Degraded days print a warning.');
}

async function main() {
  switch (command) {
    case 'run':
      await runManual();
      break;
    case 'hook':
      await runHook();
      break;
    case '__background':
      await runBackground(args[1]);
      break;
    case 'install':
      await install();
      break;
    case 'uninstall':
      await uninstall(args.includes('--keep-history'));
      break;
    case 'status':
      await status();
      break;
    case 'history':
      await history();
      break;
    case '--version':
    case '-v':
      console.log(`dukar v${pkg.version}`);
      break;
    case '--help':
    case '-h':
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
