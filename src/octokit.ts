import { App } from "@octokit/app";
import { Octokit } from "octokit";
import { cfg } from "./config.js";

const app = new App({ appId: cfg.appId, privateKey: cfg.privateKey });

export async function getInstallationOctokit(installationId: number | string) {
  return await app.getInstallationOctokit(Number(installationId)) as unknown as Octokit;
}

export { app };
