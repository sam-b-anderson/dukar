const { spawnSync, spawn } = require('child_process');

/**
 * Fire an OS-level desktop notification. Cross-platform, zero dependencies.
 * Always best-effort: failures are swallowed so a notification problem
 * never breaks dukar itself.
 *
 *   Windows: user32!MessageBoxTimeout via PowerShell P/Invoke. Auto-dismissing
 *            modal. Synchronous — blocks the hook for the timeout duration.
 *            Chosen because: (a) Anthropic's docs recommend MessageBox for
 *            Windows notifications, (b) BalloonTip is deprecated and unreliable
 *            on Win10/11, (c) detached MessageBox doesn't materialize a visible
 *            window when the parent Node process exits.
 *   macOS:   osascript display notification (per Anthropic docs).
 *   Linux:   notify-send (per Anthropic docs).
 *
 * options.type:
 *   'transient'  - quick info (start/healthy), auto-dismisses fast
 *   'persistent' - actionable (degraded/error), longer-lived
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
  const timeoutMs = type === 'transient' ? 4000 : 30000;
  // MB_ICONINFORMATION = 0x40 (info icon, blue), MB_ICONWARNING = 0x30 (warning, yellow)
  const iconFlag = type === 'transient' ? '0x40' : '0x30';
  // Add MB_SYSTEMMODAL = 0x1000 to keep on top regardless of focus.
  const flags = `(${iconFlag} -bor 0x1000)`;

  const escTitle = title.replace(/'/g, "''");
  const escBody = body.replace(/'/g, "''");
  const ps = `
$sig = @'
[DllImport("user32.dll", CharSet=CharSet.Auto)]
public static extern int MessageBoxTimeout(IntPtr hwnd, String text, String title, uint type, Int16 lang, Int32 ms);
'@
$null = (Add-Type -MemberDefinition $sig -Name MBT -Namespace DukarWin32 -PassThru)::MessageBoxTimeout(0, '${escBody}', '${escTitle}', ${flags}, 0, ${timeoutMs})
`.trim();

  // spawnSync so the hook waits for the popup to dismiss. The detached/unref
  // approach we tried first does not work on Windows — the GUI window never
  // materializes when the parent Node process exits.
  spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], {
    stdio: 'ignore',
    shell: false,
  });
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
    args.push('--expire-time=4000', '--urgency=low');
  } else {
    args.push('--expire-time=30000', '--urgency=normal', '--icon=dialog-warning');
  }
  args.push(title, body);
  const child = spawn('notify-send', args, { detached: true, stdio: 'ignore' });
  child.unref();
}

module.exports = { notify };
