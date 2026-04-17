const { spawn } = require('child_process');

/**
 * Fire an OS-level desktop notification. Cross-platform, zero dependencies.
 * Always best-effort: failures are swallowed so a notification problem
 * never breaks dukar itself.
 *
 * options.type:
 *   'transient' - short, auto-dismisses fast (status update)
 *   'persistent' - longer-lived, more likely to be seen and acknowledged
 *
 *   Windows: System.Windows.Forms.NotifyIcon BalloonTip via PowerShell
 *   macOS:   osascript display notification
 *   Linux:   notify-send (libnotify)
 */
function notify(title, body, options = {}) {
  const { type = 'persistent' } = options;
  try {
    if (process.platform === 'win32') {
      return notifyWindows(title, body, type);
    }
    if (process.platform === 'darwin') {
      return notifyMacOS(title, body, type);
    }
    return notifyLinux(title, body, type);
  } catch {
    // Never let notification failures break the diagnostic
  }
}

function notifyWindows(title, body, type) {
  const timeoutMs = type === 'transient' ? 3000 : 30000;
  const sleepSec = type === 'transient' ? 4 : 31;
  const escTitle = title.replace(/'/g, "''");
  const escBody = body.replace(/'/g, "''");
  const ps = [
    `Add-Type -AssemblyName System.Windows.Forms`,
    `$balloon = New-Object System.Windows.Forms.NotifyIcon`,
    `$balloon.Icon = [System.Drawing.SystemIcons]::${type === 'transient' ? 'Information' : 'Warning'}`,
    `$balloon.BalloonTipTitle = '${escTitle}'`,
    `$balloon.BalloonTipText = '${escBody}'`,
    `$balloon.Visible = $true`,
    `$balloon.ShowBalloonTip(${timeoutMs})`,
    `Start-Sleep -Seconds ${sleepSec}`,
    `$balloon.Dispose()`,
  ].join('; ');

  const child = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
    detached: true,
    stdio: 'ignore',
    shell: false,
  });
  child.unref();
}

function notifyMacOS(title, body, _type) {
  const escTitle = title.replace(/"/g, '\\"');
  const escBody = body.replace(/"/g, '\\"');
  const child = spawn('osascript', [
    '-e',
    `display notification "${escBody}" with title "${escTitle}"`,
  ], { detached: true, stdio: 'ignore' });
  child.unref();
}

function notifyLinux(title, body, type) {
  const args = ['--app-name=Dukar'];
  if (type === 'transient') {
    args.push('--expire-time=3000', '--urgency=low');
  } else {
    args.push('--expire-time=30000', '--urgency=normal', '--icon=dialog-warning');
  }
  args.push(title, body);
  const child = spawn('notify-send', args, { detached: true, stdio: 'ignore' });
  child.unref();
}

module.exports = { notify };
