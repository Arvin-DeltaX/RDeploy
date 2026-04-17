import { spawn, spawnSync, ChildProcess } from "child_process";

export interface ContainerState {
  running: boolean;
  exitCode: number;
  restartCount: number;
  startedAt: string;
}

/**
 * Build a Docker image. Streams output lines via onOutput callback.
 * Returns combined stdout+stderr output string.
 * Throws on non-zero exit code.
 */
export function buildImage(
  tag: string,
  dockerfilePath: string,
  contextDir: string,
  onOutput?: (line: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["build", "-t", tag, "-f", dockerfilePath, contextDir];
    const proc = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });

    let output = "";

    function handleData(chunk: Buffer): void {
      const text = chunk.toString("utf8");
      output += text;
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.trim() && onOutput) {
          onOutput(line);
        }
      }
    }

    proc.stdout.on("data", handleData);
    proc.stderr.on("data", handleData);

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`docker build exited with code ${code ?? "unknown"}\n${output}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`docker build spawn error: ${err.message}`));
    });
  });
}

/**
 * Run a Docker container with Traefik labels.
 * Returns the container ID.
 */
export function runContainer(
  tag: string,
  containerName: string,
  port: number,
  network: string,
  projectSlug: string,
  teamSlug: string,
  domain: string,
  envFilePath: string,
  onOutput?: (line: string) => void,
  cpuLimit?: string | null,
  memoryLimit?: string | null,
  traefikRouterName?: string,
  customDomain?: string | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const routerName = traefikRouterName ?? containerName;
    const args = [
      "run",
      "-d",
      "--name", containerName,
      "--network", network,
      "--env-file", envFilePath,
      `-p`, `${port}:${port}`,
    ];

    if (cpuLimit) {
      args.push(`--cpus=${cpuLimit}`);
    }
    if (memoryLimit) {
      args.push(`--memory=${memoryLimit}`);
    }

    args.push(
      `--label`, `traefik.enable=true`,
      `--label`, `traefik.http.routers.${routerName}.rule=Host(\`${projectSlug}-${teamSlug}.${domain}\`)`,
      `--label`, `traefik.http.services.${routerName}.loadbalancer.server.port=${port}`,
    );

    if (customDomain) {
      const customRouterName = `${routerName}-custom`;
      args.push(
        `--label`, `traefik.http.routers.${customRouterName}.rule=Host(\`${customDomain}\`)`,
        `--label`, `traefik.http.routers.${customRouterName}.entrypoints=websecure`,
        `--label`, `traefik.http.routers.${customRouterName}.tls=true`,
        `--label`, `traefik.http.routers.${customRouterName}.service=${routerName}`,
      );
    }

    args.push(tag);

    const proc = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });

    let output = "";

    function handleData(chunk: Buffer): void {
      const text = chunk.toString("utf8");
      output += text;
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.trim() && onOutput) {
          onOutput(line);
        }
      }
    }

    proc.stdout.on("data", handleData);
    proc.stderr.on("data", handleData);

    proc.on("close", (code) => {
      if (code === 0) {
        const containerId = output.trim();
        resolve(containerId);
      } else {
        reject(new Error(`docker run exited with code ${code ?? "unknown"}\n${output}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`docker run spawn error: ${err.message}`));
    });
  });
}

/**
 * Stop a container. Ignores errors if not running.
 */
export function stopContainer(containerId: string): void {
  spawnSync("docker", ["stop", containerId], { stdio: "ignore" });
}

/**
 * Remove a container. Ignores errors if not exists.
 */
export function removeContainer(containerId: string): void {
  spawnSync("docker", ["rm", containerId], { stdio: "ignore" });
}

/**
 * Start a stopped container. Returns true on success, false on failure.
 */
export function startContainer(containerId: string): boolean {
  const result = spawnSync("docker", ["start", containerId], { stdio: "ignore" });
  return result.status === 0;
}

/**
 * Remove a Docker image. Ignores errors.
 */
export function removeImage(tag: string): void {
  spawnSync("docker", ["rmi", tag], { stdio: "ignore" });
}

/**
 * Tag an existing Docker image with an additional tag.
 * e.g. tagImage("rdeploy-foo-bar:latest", "rdeploy-foo-bar:3")
 * Ignores errors (best-effort).
 */
export function tagImage(sourceTag: string, targetTag: string): void {
  spawnSync("docker", ["tag", sourceTag, targetTag], { stdio: "ignore" });
}

/**
 * Inspect a container and return its state, or null if not found.
 */
export function inspectContainer(containerId: string): ContainerState | null {
  const result = spawnSync(
    "docker",
    ["inspect", "--format", "{{json .State}} {{json .RestartCount}}", containerId],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  try {
    // docker inspect outputs the container as an array
    const fullResult = spawnSync(
      "docker",
      ["inspect", containerId],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );

    if (fullResult.status !== 0 || !fullResult.stdout) {
      return null;
    }

    const data = JSON.parse(fullResult.stdout) as Array<{
      State: {
        Running: boolean;
        ExitCode: number;
        StartedAt: string;
      };
      RestartCount: number;
    }>;

    if (!data || data.length === 0) {
      return null;
    }

    const container = data[0];
    return {
      running: container.State.Running,
      exitCode: container.State.ExitCode,
      restartCount: container.RestartCount,
      startedAt: container.State.StartedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Stream docker logs (--tail=100 --follow).
 * Calls onLine for each new line of output.
 * Returns a cleanup function that kills the process.
 */
export function streamContainerLogs(
  containerId: string,
  onLine: (line: string) => void,
  onClose: () => void
): () => void {
  const proc: ChildProcess = spawn(
    "docker",
    ["logs", "--tail=100", "--follow", containerId],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let buffer = "";

  function handleData(chunk: Buffer): void {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      onLine(line);
    }
  }

  if (proc.stdout) {
    proc.stdout.on("data", handleData);
  }
  if (proc.stderr) {
    proc.stderr.on("data", handleData);
  }

  proc.on("close", () => {
    if (buffer.trim()) {
      onLine(buffer);
      buffer = "";
    }
    onClose();
  });

  return () => {
    proc.kill();
  };
}
