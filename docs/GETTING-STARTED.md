# Getting started

Penny runs on your own computer first, where nothing leaves your machine. Open a terminal (on a Mac, Terminal in Applications → Utilities; on Windows, your WSL2 distribution), copy this line into it and press Enter:

```bash
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-penny
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-penny` does the same.

The line installs `rer`, the Run Edit Run command, clones Penny into a `run-penny` folder, installs everything, sets up a local owner with an empty workspace and starts Penny. Open the `RER_OPEN` link it prints, on the same computer: it holds this copy's private dev key, so keep it to yourself. You land on **Finish setup**. This free copy runs only on your computer: it sends no email, and nobody else can open it.

If the installer prints a line that puts `rer` on your PATH, run that line too. To start Penny again later, run the same line from the same folder, or `cd run-penny && rer dev`. `rer dev --stop` stops it.

Next: [Install and deploy](INSTALL.md) covers your own owner address, making Penny yours and deploying it to Cloudflare.
