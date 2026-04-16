const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function uninstall(keepHistory = false) {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = {};
  
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    settings = JSON.parse(raw);
    
    if (settings.hooks && settings.hooks.SessionStart) {
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(h => 
        !h.hooks || !h.hooks.some(entry => entry.command === 'dukar hook')
      );
      
      if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
      
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn('Note: encountered issue with ~/.claude/settings.json, cleaning up files anyway.');
    }
  }

  const dukarDir = path.join(os.homedir(), '.dukar');
  try {
    if (keepHistory) {
      const files = await fs.readdir(dukarDir);
      for (const file of files) {
        if (file !== 'history.jsonl') {
          await fs.rm(path.join(dukarDir, file), { recursive: true, force: true });
        }
      }
      console.log('Dukar uninstalled. History preserved at ~/.dukar/history.jsonl');
    } else {
      await fs.rm(dukarDir, { recursive: true, force: true });
      console.log('Dukar uninstalled.');
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('Error during directory cleanup:', e.message);
    } else {
      console.log('Dukar not installed.');
    }
  }
}

module.exports = { uninstall };
