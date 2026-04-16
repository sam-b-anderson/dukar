const { runHook } = require('./runner');

// This file is used by the SessionStart hook
runHook().catch(err => {
  // Silent fail in hook mode as per design principles
});
