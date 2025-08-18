import { App } from "@octokit/app";
import { Octokit } from "octokit";
import { cfg } from "./config.js";

const app = new App({
  appId: Number(cfg.appId),          // upewnij się, że to number
  privateKey: cfg.privateKey         // teraz istnieje w cfg
});

export async function getInstallationOctokit(installationId: number | string) {
  return await app.getInstallationOctokit(Number(installationId)) as unknown as Octokit;
}

export { app };
