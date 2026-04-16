const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

async function install() {
  try {
    execSync('claude --version', { stdio: 'ignore' });
  } catch (e) {
    console.error('Error: claude CLI not found on PATH. Please install it first.');
    process.exit(1);
  }

  const dukarDir = path.join(os.homedir(), '.dukar');
  await fs.mkdir(dukarDir, { recursive: true });

  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = {};
  
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Error: ~/.claude/settings.json is malformed or unreadable.');
      console.error(e.message);
      process.exit(2);
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  const hookExists = settings.hooks.SessionStart.some(h => 
    h.hooks && h.hooks.some(entry => entry.command === 'dukar hook')
  );

  if (!hookExists) {
    settings.hooks.SessionStart.push({
      matcher: '',
      hooks: [
        { type: 'command', command: 'dukar hook' }
      ]
    });
    
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Dukar installed. Diagnostics will run on your first Claude Code session each day.');
  } else {
    console.log('Dukar is already installed.');
  }
}

module.exports = { install };
