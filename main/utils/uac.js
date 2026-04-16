const sudo = require('sudo-prompt');

function escapePowerShellSingleQuote(value) {
  return String(value).replace(/'/g, "''");
}

function elevateWithUac(command, options = {}) {
  return new Promise((resolve, reject) => {
    if (!command || typeof command !== 'string') {
      reject(new Error('A valid command string is required for UAC elevation'));
      return;
    }

    sudo.exec(command, {
      name: options.name || 'My Dashboard',
      icns: options.icns,
      env: options.env
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(error.message || 'Failed to elevate command with UAC'));
        return;
      }

      resolve({
        success: true,
        command,
        stdout: stdout || '',
        stderr: stderr || ''
      });
    });
  });
}

function buildRunAsPowerShell({ filePath, argumentList = [], outputFile, errorFile, workingDirectory }) {
  if (!filePath) {
    throw new Error('filePath is required to build RunAs PowerShell command');
  }

  const escapedPath = escapePowerShellSingleQuote(filePath);
  const argsLiteral = `@(${argumentList
    .map((arg) => `'${escapePowerShellSingleQuote(arg)}'`)
    .join(',')})`;
  const escapedOutput = escapePowerShellSingleQuote(outputFile || '');
  const escapedError = escapePowerShellSingleQuote(errorFile || '');
  const escapedWorkingDirectory = escapePowerShellSingleQuote(workingDirectory || '');

  const startProcessCommand = workingDirectory
    ? "$process = Start-Process -FilePath $filePath -ArgumentList $argumentList -WorkingDirectory $workingDirectory -Verb RunAs -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile"
    : "$process = Start-Process -FilePath $filePath -ArgumentList $argumentList -Verb RunAs -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile";

  return [
    "$ErrorActionPreference = 'Stop'",
    `$filePath = '${escapedPath}'`,
    `$argumentList = ${argsLiteral}`,
    `$stdoutFile = '${escapedOutput}'`,
    `$stderrFile = '${escapedError}'`,
    `$workingDirectory = '${escapedWorkingDirectory}'`,
    startProcessCommand,
    'Write-Output "__PID__=$($process.Id)"',
    '$process.WaitForExit()',
    'Write-Output "__EXIT_CODE__=$($process.ExitCode)"'
  ].join('; ');
}

module.exports = {
  elevateWithUac,
  buildRunAsPowerShell
};
