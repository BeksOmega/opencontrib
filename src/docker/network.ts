import { execFile } from "child_process";
import { promisify } from "util";
import { dockerExec, DockerError } from "./exec";

const execFileAsync = promisify(execFile);

const NETWORK_NAME = "opencontrib-net";

/**
 * Allowed outbound destinations for agent containers.
 * Resolved to IPs at runtime via iptables — these are the hostnames whose
 * traffic we explicitly permit before dropping everything else.
 */
const ALLOWED_HOSTS = [
  "github.com",
  "api.github.com",
  "registry.npmjs.org",
  "pypi.org",
  "crates.io",
  "proxy.golang.org",
  "anthropic.com",
];

/**
 * Runs an iptables command via execFile (no shell).
 * Requires root or CAP_NET_ADMIN.
 */
async function iptables(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("iptables", args);
  return stdout;
}

/**
 * Creates the "opencontrib-net" Docker bridge network if it does not exist,
 * then applies iptables outbound allowlist rules:
 *
 *   ALLOW  github.com, api.github.com
 *   ALLOW  registry.npmjs.org, pypi.org, crates.io, proxy.golang.org
 *   ALLOW  anthropic.com
 *   DROP   everything else outbound from opencontrib-net
 *
 * **Requires root or CAP_NET_ADMIN** — iptables cannot be modified without
 * elevated privileges.
 *
 * The network policy is security-critical (see §6, Layer 3 of the PRD):
 * even a fully compromised container cannot exfiltrate data to arbitrary
 * hosts because outbound traffic is allowlisted at the kernel level.
 */
export async function setupNetwork(): Promise<void> {
  // 1. Create the bridge network if it doesn't already exist.
  try {
    await dockerExec(["network", "inspect", NETWORK_NAME]);
  } catch (err) {
    if (err instanceof DockerError) {
      await dockerExec(["network", "create", "--driver", "bridge", NETWORK_NAME]);
    } else {
      throw err;
    }
  }

  // 2. Determine the bridge interface name for the opencontrib-net network.
  //    Docker names bridge interfaces "br-<short network id>".
  const { stdout: inspectOut } = await dockerExec([
    "network",
    "inspect",
    NETWORK_NAME,
    "--format",
    "{{.Id}}",
  ]);
  const networkId = inspectOut.trim().slice(0, 12);
  const bridgeIface = `br-${networkId}`;

  // 3. Flush any existing rules for this bridge to start from a clean state.
  await iptables(["-D", "FORWARD", "-i", bridgeIface, "-j", "opencontrib-fw"]).catch(() => {
    // Rule may not exist yet — ignore.
  });
  await iptables(["-F", "opencontrib-fw"]).catch(() => {
    // Chain may not exist yet — ignore.
  });
  await iptables(["-X", "opencontrib-fw"]).catch(() => {
    // Chain may not exist yet — ignore.
  });

  // 4. Create a dedicated chain for opencontrib rules.
  await iptables(["-N", "opencontrib-fw"]);

  // 5. Allow established/related connections (return traffic).
  await iptables([
    "-A", "opencontrib-fw",
    "-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED",
    "-j", "ACCEPT",
  ]);

  // 6. Allow traffic to each permitted host by resolving DNS at setup time.
  for (const host of ALLOWED_HOSTS) {
    const { stdout: dnsOut } = await execFileAsync("getent", ["hosts", host]);
    for (const line of dnsOut.split("\n").filter(Boolean)) {
      const ip = line.trim().split(/\s+/)[0];
      if (ip) {
        await iptables(["-A", "opencontrib-fw", "-d", ip, "-j", "ACCEPT"]);
      }
    }
  }

  // 7. Drop everything else outbound from the bridge.
  await iptables(["-A", "opencontrib-fw", "-j", "DROP"]);

  // 8. Jump to the opencontrib-fw chain from FORWARD for this bridge.
  await iptables(["-A", "FORWARD", "-i", bridgeIface, "-j", "opencontrib-fw"]);
}

/**
 * Verifies that the iptables rules for opencontrib-net are in place.
 * Called before every job to ensure the network policy hasn't been removed.
 * Throws if any required rule is missing.
 *
 * **Requires root or CAP_NET_ADMIN.**
 */
export async function verifyNetworkRules(): Promise<void> {
  // Check that the opencontrib-fw chain exists.
  const chainList = await iptables(["-n", "-L", "opencontrib-fw"]).catch(() => null);
  if (chainList === null) {
    throw new Error(
      "opencontrib-fw iptables chain is missing — run setupNetwork() first"
    );
  }

  // Check that the FORWARD rule that jumps to opencontrib-fw exists.
  const forwardRules = await iptables(["-n", "-L", "FORWARD"]);
  if (!forwardRules.includes("opencontrib-fw")) {
    throw new Error(
      "FORWARD rule pointing to opencontrib-fw is missing — run setupNetwork() first"
    );
  }

  // Check that a DROP rule is present at the end of the chain (last-resort deny).
  if (!chainList.includes("DROP")) {
    throw new Error(
      "opencontrib-fw DROP rule is missing — network policy may be incomplete"
    );
  }
}
