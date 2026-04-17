const { spawn } = require('child_process');
const path = require('path');

async function invoke({
  prompt,
  model = 'opus',
  envOverrides = {},
  cwd,
  timeoutMs = 30000,
  _spawn = spawn,
}) {
  const env = {
    ...process.env,
    ...envOverrides,
    DUKAR_RUNNING: '1',
  };

  const args = [
    '-p',
    '--setting-sources', '',
    '--output-format', 'stream-json',
    '--verbose',
    '--no-session-persistence',
    '--model', model,
    prompt,
  ];

  // On Windows, shell:true joins args naively and drops empty strings —
  // build the command string ourselves with proper cmd quoting.
  let child;
  if (process.platform === 'win32') {
    const quoteForCmd = (arg) => {
      if (arg === '') return '""';
      if (/[\s"&|<>^()%!,;=]/.test(arg)) return `"${arg.replace(/"/g, '\\"')}"`;
      return arg;
    };
    const cmdString = `claude ${args.map(quoteForCmd).join(' ')}`;
    child = _spawn(cmdString, [], {
      env,
      cwd: cwd || process.cwd(),
      shell: true,
    });
  } else {
    child = _spawn('claude', args, {
      env,
      cwd: cwd || process.cwd(),
      shell: false,
    });
  }

  let thinkingContent = '';
  let responseText = '';
  const toolUseEvents = [];
  let usage = null;
  let total_cost_usd = 0;
  let duration_api_ms = 0;
  let permission_denials = [];
  let num_turns = 0;
  let quotaUtilization = null;
  let rateLimitType = null;
  let quotaResetsAt = null;
  let isUsingOverage = null;
  let error = null;
  let thinkingPresent = false;
  let cacheTier = 'unknown';

  let buffer = '';

  const timeout = setTimeout(() => {
    if (child.kill) child.kill();
    error = 'timeout';
  }, timeoutMs);

  return new Promise((resolve) => {
    let malformedLines = 0;
    if (!child.stdout) {
      clearTimeout(timeout);
      resolve({ error: 'failed_to_spawn', model });
      return;
    }

    child.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event && event.type === 'assistant') {
            const content = event.message?.content || [];
            for (const block of content) {
              if (block && block.type === 'thinking') {
                thinkingPresent = true;
                thinkingContent += block.thinking || '';
              } else if (block && block.type === 'text') {
                responseText += block.text || '';
              } else if (block && block.type === 'tool_use') {
                toolUseEvents.push({
                  tool: block.name,
                  input: block.input,
                });
              }
            }
            if (event.error) {
              error = event.error;
            }
            // Detect auth failure in text if not explicitly in event.error
            if (responseText && (responseText.includes('authentication_error') || responseText.includes('Failed to authenticate'))) {
              error = 'auth';
            }
          } else if (event && event.type === 'rate_limit_event') {
            const info = event.rate_limit_info || {};
            quotaUtilization = info.utilization ?? null;
            rateLimitType = info.rateLimitType ?? null;
            quotaResetsAt = info.resetsAt ?? null;
            isUsingOverage = info.isUsingOverage ?? null;
          } else if (event && event.type === 'result') {
            usage = event.usage;
            total_cost_usd = event.total_cost_usd || 0;
            duration_api_ms = event.duration_api_ms || 0;
            permission_denials = event.permission_denials || [];
            num_turns = event.num_turns || 0;
            
            if (usage && usage.cache_creation) {
              if (usage.cache_creation.ephemeral_1h_input_tokens > 0) {
                cacheTier = '1h';
              } else if (usage.cache_creation.ephemeral_5m_input_tokens > 0) {
                cacheTier = '5m';
              }
            }
          }
        } catch (e) {
          malformedLines++;
          if (malformedLines > 5) { // Stricter limit for malformed lines
            error = 'malformed_output';
          }
        }
      }
    });

    const getResult = () => ({
      thinkingPresent,
      thinkingContent: thinkingPresent ? thinkingContent : null,
      responseText,
      toolUseEvents,
      outputTokens: usage?.output_tokens || 0,
      inputTokens: usage?.input_tokens || 0,
      cacheCreationTokens: usage?.cache_creation_input_tokens || 0,
      cacheReadTokens: usage?.cache_read_input_tokens || 0,
      cacheTier,
      durationApiMs: duration_api_ms,
      costUsd: total_cost_usd,
      permissionDenials: permission_denials,
      numTurns: num_turns,
      quotaUtilization,
      rateLimitType,
      quotaResetsAt,
      isUsingOverage,
      model,
      error: error || null
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      error = err.message;
      resolve(getResult());
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !error) {
        error = `exit_code_${code}`;
      }
      resolve(getResult());
    });
  });
}

module.exports = { invoke };
