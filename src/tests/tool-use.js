const { invoke } = require('../invoke');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function runToolUse() {
  const dukarDir = path.join(os.homedir(), '.dukar');
  const tmpDir = path.join(dukarDir, 'tmp');
  
  try {
    await fs.mkdir(tmpDir, { recursive: true });
    
    const fixturePath = path.join(tmpDir, 'example.py');
    const fixtureContent = `def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)


def format_percentage(value):
    return str(round(value * 100, 2)) + "%"
`;
    await fs.writeFile(fixturePath, fixtureContent);
    
    const result = await invoke({
      prompt: 'Read the file example.py. There is a bug in calculate_average — it will crash on an empty list because of division by zero. Fix it by adding a guard that returns 0 for empty lists. Do not rewrite the entire file.',
      model: 'opus',
      cwd: tmpDir,
      timeoutMs: 30000,
    });
    
    if (result.error) {
      return { ...result, score: 'error' };
    }
    
    const scoreResult = scoreToolUse(result);
    return { ...result, ...scoreResult };
    
  } catch (err) {
    return { error: err.message, score: 'error' };
  }
}

function scoreToolUse(result) {
  const toolUseEvents = result.toolUseEvents || [];
  
  const readInvoked = toolUseEvents.some(e => e.tool === 'Read' && e.input && JSON.stringify(e.input).includes('example.py'));
  const editInvoked = toolUseEvents.some(e => e.tool === 'Edit' && e.input && JSON.stringify(e.input).includes('example.py'));
  const writeInvoked = toolUseEvents.some(e => e.tool === 'Write' && e.input && JSON.stringify(e.input).includes('example.py'));
  
  let readBeforeEdit = false;
  if (readInvoked && editInvoked) {
    const firstRead = toolUseEvents.findIndex(e => e.tool === 'Read' && e.input && JSON.stringify(e.input).includes('example.py'));
    const firstEdit = toolUseEvents.findIndex(e => e.tool === 'Edit' && e.input && JSON.stringify(e.input).includes('example.py'));
    readBeforeEdit = firstRead < firstEdit;
  }
  
  let score = 'fail';
  if (readInvoked && editInvoked && !writeInvoked && readBeforeEdit) {
    score = 'pass';
  } else if (toolUseEvents.length === 0) {
    score = 'error'; // Subprocess didn't emit any tool use events at all
  }
  
  return {
    score,
    readInvoked,
    editInvoked,
    writeInvoked,
    readBeforeEdit,
    toolUseEventCount: toolUseEvents.length,
    permissionDenialCount: (result.permissionDenials || []).length
  };
}

module.exports = { runToolUse, scoreToolUse };
