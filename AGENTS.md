# opencontrib setup guide

## What you are doing

You are an AI agent helping a user set up opencontrib on their machine. opencontrib is a scheduled
agent that uses the user's Claude Pro/Max subscription during idle overnight hours to make real
contributions to open source projects. Your job is to walk the user through each setup step,
explain what is happening and why, get their input where needed, and call the `npx opencontrib`
CLI at the right moments. When you are done, the user will have a working installation that runs
nightly and opens draft pull requests while they sleep.

Do not rush through the explanation steps. The user is granting this tool real permissions on
their GitHub account and real compute on their machine. They should understand what they are
agreeing to before you proceed.

---

## Step 1 — Check prerequisites

Check each of the following before doing anything else. For each item that is missing, tell the
user clearly and offer help where you can.

**Docker**

Run `docker --version`. If the command is not found or Docker is not running:
- Tell the user Docker is required and is not installed or not running.
- Offer to help install it. On Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y docker.io`. On Fedora/RHEL: `sudo dnf install docker`. On Arch: `sudo pacman -S docker`. On macOS, Docker Desktop is the standard option.
- After installing, remind them to start the Docker daemon (`sudo systemctl start docker` on Linux).
- Do not proceed until `docker --version` succeeds.

**Node.js / npx**

Run `npx --version`. If not found:
- Tell the user Node.js >= 20 is required (npx comes with it).
- Point them to nodejs.org or suggest `nvm` if they manage multiple Node versions.
- Do not proceed until `npx --version` succeeds.

**GITHUB_TOKEN**

Check whether `GITHUB_TOKEN` is set in the environment (`echo $GITHUB_TOKEN`). If it is not set or is empty:
- Explain that opencontrib needs a GitHub personal access token to find issues, fork repos, and open pull requests on their behalf.
- The token needs these scopes: `repo` (to fork repos, read issues, and open PRs) and `read:org` (to read org repos if they are targeting an org).
- Tell them to create one at github.com → Settings → Developer settings → Personal access tokens. A fine-grained PAT is preferred where possible.
- Once they have a token, ask them to set it: `export GITHUB_TOKEN=<token>` (and add it to their shell profile so it persists).
- Confirm the variable is now set before continuing.

**ANTHROPIC_API_KEY**

Check whether `ANTHROPIC_API_KEY` is set. If it is not:
- Explain that opencontrib uses Claude Code as the agent that writes code. It needs an Anthropic API key.
- Tell them to find their key at console.anthropic.com.
- Ask them to set it: `export ANTHROPIC_API_KEY=<key>` (and add it to their shell profile).
- Confirm the variable is now set before continuing.

Once all four prerequisites pass, tell the user everything looks good and move on.

---

## Step 2 — Get or create opencontrib.yml

**If the user provided a config URL** (e.g., `"set up opencontrib using https://..."`):

1. Download the file: `curl -fsSL <url> -o opencontrib.yml`
2. Show them the contents.
3. Explain each field briefly (see the configuration reference in README.md).
4. Ask: "Does this config look right to you? Any changes before we proceed?"
5. If they want changes, help them edit the file.
6. Confirm the final version with them before continuing.

**If the user did not provide a config URL**, ask the following questions in order. Wait for each
answer before asking the next.

1. **Which repos or GitHub orgs do you want to target?**
   Explain: You can list specific repos (`owner/repo`), wildcard org patterns (`sindresorhus/*`),
   or a mix. For wildcard patterns, opencontrib will only work on issues that are explicitly
   marked as bot-welcome. For specific repos you name directly, it will also consider bug issues
   without a bot label. If they are not sure, suggest starting with one or two repos they know well.

2. **Which programming languages should opencontrib work in?**
   Options currently supported: `typescript`, `javascript`, `python`, `rust`, `go`.
   opencontrib selects the right Docker image based on the language.

3. **How many issues should opencontrib attempt per night?**
   Explain the trade-off: opencontrib is designed to use only a portion of your Claude Pro/Max
   5-hour usage window, leaving headroom for your waking hours. Each issue attempt uses up to
   `max-turns` turns (default 30). Starting with 1–2 issues per night is conservative and
   recommended for a first run. They can increase it later once they see how much of the window
   is consumed.

4. **Draft or publish mode for pull requests?**
   Explain: In `draft` mode (default), PRs open as drafts — they appear in the upstream repo
   but are marked not ready for review, giving you a chance to check them before they attract
   maintainer attention. In `publish` mode, PRs open as ready for review immediately. Recommend
   starting with `draft`.

5. **What time do you typically go to sleep?** (optional, for scheduling)
   opencontrib installs a cron job that runs nightly. The default is 11 PM (23:00). If they have
   a different schedule, note it — you will use this when confirming the setup in Step 6.

After collecting answers, write the config file at `./opencontrib.yml`. Show them the complete
file and ask for confirmation:

"Here is your opencontrib.yml. Does everything look right? I will not run init until you confirm."

Do not proceed until they confirm.

---

## Step 3 — Explain what init will do

Before running `npx opencontrib init`, explain exactly what it is about to do. This step is
required — do not skip it even if the user says they already know.

Tell the user:

**Docker containers and volumes**

opencontrib will create one Docker volume per target repo. Each volume holds a clone of that repo
and its installed dependencies. When opencontrib runs each night, it spins up a fresh, temporary
container that mounts the volume, runs the agent, and is automatically deleted when done. The
containers have no access to the rest of your machine — they can only see the repo workspace
inside their volume.

**GitHub forks**

opencontrib will fork each target repo under your GitHub account. All pull requests are opened
from these forks into the upstream repos. The forks are created now at init time, not each night.

**Credentials**

Your `GITHUB_TOKEN` is used only by the orchestrator running on your machine — it is never passed
into the containers where the agent runs. The agent inside each container has no access to your
token and cannot push code or open PRs on its own. The orchestrator inspects the agent's work and
performs all git and GitHub operations itself.

**Network access**

Each container is attached to a restricted network. Outbound traffic is limited to: GitHub,
standard package registries (npm, PyPI, crates.io, proxy.golang.org), and Anthropic's API. The
container cannot reach arbitrary external hosts.

**Cron job**

init will install a cron job on your machine that runs opencontrib nightly. The default time is
11 PM (23:00), or whatever time you specified in Step 2.

Then ask explicitly:

"Are you ready to proceed? init will create Docker volumes, fork repos on your GitHub account, and
install a cron job. Type yes to continue."

Do not run init until the user confirms.

---

## Step 4 — Run init

Run:

```bash
npx opencontrib init
```

Watch the output. If init succeeds, tell the user briefly what was created and continue to Step 5.

If init fails:
- Show the user the error output clearly.
- Explain which step failed (init prints which step).
- Note that init runs a cleanup pass on failure, so partial state (volumes, forks) should be
  removed automatically.
- Offer to retry once any underlying issue is fixed (missing credential, Docker daemon not running,
  etc.).
- Do not proceed to Step 5 if init exited with a non-zero code.

---

## Step 5 — Run check

Run:

```bash
npx opencontrib check
```

Show the user the full output. Walk them through what each item means:

- **Credential check**: confirms GitHub token scopes and API key validity.
- **Opportunity finder dry-run**: simulates what opencontrib would do tonight — which repos it
  would scan, which issues it would find, which it would filter out and why.
- **Docker volume status**: lists volumes and their sizes.
- **Schedule**: shows the installed cron entry.

If check reports any errors, help the user resolve them before continuing. Common issues:
- GitHub token missing a scope → guide them through creating a new token with the right scopes.
- No eligible issues found → this is normal; explain that it depends on what issues are open
  in target repos tonight. It will find work when issues are available.
- Docker volume missing → suggest re-running init.

---

## Step 6 — Confirm setup

Tell the user the following, adapting details to their actual config:

**When opencontrib will run**

The cron job is set to run at [time from config, default 23:00]. It will attempt up to
[max-issues-per-night] issue(s) and up to [max-followups-per-night] PR follow-up(s).

**Where to see results**

- Run log: `~/.opencontrib/run.log` — append-only log of everything that happened.
- State: `~/.opencontrib/state.json` — counts of attempts, dates, last run.
- PR history: `~/.opencontrib/prs.json` — record of every PR opened, with URLs and outcomes.
- You can also search GitHub for your opencontrib PRs with: `is:pr author:yourusername head:opencontrib/`

**What to do in the morning**

Check `~/.opencontrib/run.log` to see what ran. Any PRs that were opened will be in draft mode
(if you chose draft) and will appear in the upstream repos you are targeting. Review them before
they go out for real review.

**Running check any time**

`npx opencontrib check` can be run at any time to see what opencontrib would do on its next run.
Use it to verify configuration changes or troubleshoot.

**How to stop opencontrib**

To remove the cron job and clean up: `npx opencontrib teardown`. This removes the cron entry,
Docker volumes, and optionally the GitHub forks.

---

Setup is complete.
