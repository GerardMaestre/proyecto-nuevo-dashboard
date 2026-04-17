const fs = require('fs');
const os = require('os');
const path = require('path');

const { elevateWithUac } = require('../../../main/utils/uac');

const ALLOWED_PORTS = new Set([
  21, 22, 23, 25, 53, 80, 110, 135,
  139, 443, 445, 1433, 3306, 3389, 5900, 8080
]);

class PortSecurityManager {
  normalizePort(rawPort) {
    const port = Number(rawPort);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Puerto invalido para mitigacion');
    }

    if (!ALLOWED_PORTS.has(port)) {
      throw new Error('Puerto fuera del set de mitigacion segura');
    }

    return port;
  }

  async runElevatedPowerShellLines(lines) {
    if (!Array.isArray(lines) || !lines.length) {
      throw new Error('Script de mitigacion vacio');
    }

    const scriptPath = path.join(
      os.tmpdir(),
      `horus-port-hardening-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`
    );

    await fs.promises.writeFile(scriptPath, lines.join('\r\n'), 'utf8');

    const escapedScriptPath = String(scriptPath).replace(/"/g, '""');
    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${escapedScriptPath}"`;

    try {
      return await elevateWithUac(command, {
        name: 'HORUS Dashboard'
      });
    } finally {
      fs.promises.unlink(scriptPath).catch(() => {});
    }
  }

  async blockPort(payload = {}) {
    const port = this.normalizePort(payload.port);

    const result = await this.runElevatedPowerShellLines([
      "$ErrorActionPreference = 'Stop'",
      `$port = ${port}`,
      "$tcpRuleName = \"HORUS_BLOCK_TCP_$port\"",
      "$udpRuleName = \"HORUS_BLOCK_UDP_$port\"",
      '',
      'if (-not (Get-NetFirewallRule -DisplayName $tcpRuleName -ErrorAction SilentlyContinue)) {',
      '  New-NetFirewallRule -DisplayName $tcpRuleName -Direction Inbound -Profile Any -LocalPort $port -Protocol TCP -Action Block -Enabled True | Out-Null',
      '}',
      '',
      'if (-not (Get-NetFirewallRule -DisplayName $udpRuleName -ErrorAction SilentlyContinue)) {',
      '  New-NetFirewallRule -DisplayName $udpRuleName -Direction Inbound -Profile Any -LocalPort $port -Protocol UDP -Action Block -Enabled True | Out-Null',
      '}',
      '',
      '$tcpReady = [bool](Get-NetFirewallRule -DisplayName $tcpRuleName -ErrorAction SilentlyContinue)',
      '$udpReady = [bool](Get-NetFirewallRule -DisplayName $udpRuleName -ErrorAction SilentlyContinue)',
      'if (-not $tcpReady -or -not $udpReady) { throw "No se pudieron crear reglas de firewall para el puerto." }',
      'Write-Output "HARDEN_OK"'
    ]);

    return {
      success: true,
      action: 'block-port',
      port,
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  }

  async hardenSmb() {
    const result = await this.runElevatedPowerShellLines([
      "$ErrorActionPreference = 'Stop'",
      'Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force | Out-Null',
      'Set-SmbServerConfiguration -EnableSMB2Protocol $true -Force | Out-Null',
      '',
      '$ruleName445 = "HORUS_BLOCK_TCP_445"',
      '$ruleName139 = "HORUS_BLOCK_TCP_139"',
      'if (-not (Get-NetFirewallRule -DisplayName $ruleName445 -ErrorAction SilentlyContinue)) {',
      '  New-NetFirewallRule -DisplayName $ruleName445 -Direction Inbound -Profile Any -LocalPort 445 -Protocol TCP -Action Block -Enabled True | Out-Null',
      '}',
      'if (-not (Get-NetFirewallRule -DisplayName $ruleName139 -ErrorAction SilentlyContinue)) {',
      '  New-NetFirewallRule -DisplayName $ruleName139 -Direction Inbound -Profile Any -LocalPort 139 -Protocol TCP -Action Block -Enabled True | Out-Null',
      '}',
      'Write-Output "SMB_HARDEN_OK"'
    ]);

    return {
      success: true,
      action: 'harden-smb',
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  }

  async forcePublicNetworkProfile() {
    const result = await this.runElevatedPowerShellLines([
      "$ErrorActionPreference = 'Stop'",
      '$profiles = Get-NetConnectionProfile',
      'if ($null -eq $profiles -or $profiles.Count -eq 0) { throw "No se detectaron perfiles de red activos." }',
      '$profiles | Set-NetConnectionProfile -NetworkCategory Public -ErrorAction Stop',
      'Write-Output "NETWORK_PROFILE_PUBLIC_OK"'
    ]);

    return {
      success: true,
      action: 'force-public-network',
      stdout: result.stdout || '',
      stderr: result.stderr || ''
    };
  }
}

module.exports = new PortSecurityManager();
