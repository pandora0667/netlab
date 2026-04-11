import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveFixedExecutable } from "../src/lib/system-binaries.js";

export type ResourceMetricBasis = "cgroup" | "host";
export type CpuMetricSource = "cgroup" | "loadavg";
export type MemoryMetricSource = "cgroup" | "host";

const VM_STAT_EXECUTABLE_CANDIDATES = ["/usr/bin/vm_stat"];

export interface RuntimeResourceSnapshot {
  basis: ResourceMetricBasis;
  hostCpuCount: number;
  effectiveCpuLimit: number;
  cpuQuotaMicros: number | null;
  cpuPeriodMicros: number | null;
  cpuUsageMicros: number | null;
  cpuThrottleMicros: number | null;
  cpuMetricSource: CpuMetricSource;
  loadAverage1m: number;
  memoryMetricSource: MemoryMetricSource;
  memoryCurrentBytes: number;
  memoryLimitBytes: number;
  memoryHeadroomBytes: number;
  memoryUtilizationPercent: number;
  rssBytes: number;
}

interface MemoryDescriptor {
  currentBytes: number;
  limitBytes: number;
  headroomBytes: number;
  utilizationPercent: number;
  source: MemoryMetricSource;
}

function clampMemoryBytes(value: number, totalBytes: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.max(0, Math.min(totalBytes, Math.round(value)));
}

function readLinuxMemAvailableBytes(hostTotalMemoryBytes: number) {
  const rawMeminfo = readTextFile(["/proc/meminfo"]);
  if (!rawMeminfo) {
    return null;
  }

  const match = rawMeminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/mi);
  if (!match) {
    return null;
  }

  return clampMemoryBytes(Number.parseInt(match[1], 10) * 1024, hostTotalMemoryBytes);
}

function readDarwinAvailableMemoryBytes(hostTotalMemoryBytes: number) {
  try {
    const rawVmStat = execFileSync(
      resolveFixedExecutable("vm_stat", VM_STAT_EXECUTABLE_CANDIDATES),
      { encoding: "utf8" },
    );
    const pageSizeMatch = rawVmStat.match(/page size of (\d+) bytes/i);
    const pageSize = pageSizeMatch ? Number.parseInt(pageSizeMatch[1], 10) : 4096;

    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return null;
    }

    const pagesFor = (label: string) => {
      const match = rawVmStat.match(new RegExp(`${label}:\\s+([\\d.]+)`, "i"));
      return match ? Number.parseFloat(match[1].replace(/\./g, "")) : 0;
    };

    const availablePages = pagesFor("Pages free")
      + pagesFor("Pages inactive")
      + pagesFor("Pages speculative")
      + pagesFor("Pages purgeable");

    return clampMemoryBytes(availablePages * pageSize, hostTotalMemoryBytes);
  } catch {
    return null;
  }
}

function resolveHostAvailableMemoryBytes(hostTotalMemoryBytes: number, hostFreeMemoryBytes: number) {
  if (process.platform === "linux") {
    return readLinuxMemAvailableBytes(hostTotalMemoryBytes) ?? hostFreeMemoryBytes;
  }

  if (process.platform === "darwin") {
    return readDarwinAvailableMemoryBytes(hostTotalMemoryBytes) ?? hostFreeMemoryBytes;
  }

  return hostFreeMemoryBytes;
}

interface ProcSelfCgroup {
  unifiedPath: string | null;
  controllerPaths: Map<string, string>;
}

function normalizeCgroupPath(rawPath: string | null | undefined) {
  if (!rawPath || rawPath === "/" || rawPath === ".") {
    return "";
  }

  let start = 0;
  let end = rawPath.length;

  while (start < end && rawPath[start] === "/") {
    start += 1;
  }

  while (end > start && rawPath[end - 1] === "/") {
    end -= 1;
  }

  return rawPath.slice(start, end);
}

function readTextFile(candidatePaths: string[]) {
  for (const candidatePath of candidatePaths) {
    try {
      return readFileSync(candidatePath, "utf8").trim();
    } catch {
      continue;
    }
  }

  return null;
}

function parseKeyedStats(input: string) {
  return input.split(/\r?\n/).reduce<Record<string, number>>((accumulator, line) => {
    const [key, rawValue] = line.trim().split(/\s+/, 2);
    const value = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;

    if (key && Number.isFinite(value)) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function readProcSelfCgroup(): ProcSelfCgroup {
  const controllerPaths = new Map<string, string>();
  let unifiedPath: string | null = null;

  try {
    const lines = readFileSync("/proc/self/cgroup", "utf8")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    for (const line of lines) {
      const [hierarchyId, controllers, rawPath] = line.split(":");
      const normalizedPath = normalizeCgroupPath(rawPath);

      if (hierarchyId === "0" && controllers === "") {
        unifiedPath = normalizedPath;
        continue;
      }

      for (const controller of controllers.split(",").filter(Boolean)) {
        controllerPaths.set(controller, normalizedPath);
      }
    }
  } catch {
    return {
      unifiedPath: null,
      controllerPaths,
    };
  }

  return {
    unifiedPath,
    controllerPaths,
  };
}

function buildCandidatePaths(rootPath: string, relativePath: string | null, filename: string) {
  const normalizedRelativePath = normalizeCgroupPath(relativePath);

  if (!normalizedRelativePath) {
    return [path.posix.join(rootPath, filename)];
  }

  return [
    path.posix.join(rootPath, normalizedRelativePath, filename),
    path.posix.join(rootPath, filename),
  ];
}

function parseCpuMax(rawValue: string) {
  const [quotaToken, periodToken] = rawValue.trim().split(/\s+/, 2);
  if (!quotaToken) {
    return {
      quotaMicros: null,
      periodMicros: null,
    };
  }

  const periodMicros = Number.parseInt(periodToken || "100000", 10);
  if (!Number.isFinite(periodMicros) || periodMicros <= 0 || quotaToken === "max") {
    return {
      quotaMicros: null,
      periodMicros: Number.isFinite(periodMicros) && periodMicros > 0 ? periodMicros : null,
    };
  }

  const quotaMicros = Number.parseInt(quotaToken, 10);
  return {
    quotaMicros: Number.isFinite(quotaMicros) && quotaMicros > 0 ? quotaMicros : null,
    periodMicros: Number.isFinite(periodMicros) && periodMicros > 0 ? periodMicros : null,
  };
}

function toFiniteCpuLimit(
  hostCpuCount: number,
  quotaMicros: number | null,
  periodMicros: number | null,
) {
  if (!quotaMicros || !periodMicros) {
    return hostCpuCount;
  }

  const derivedLimit = quotaMicros / periodMicros;
  if (!Number.isFinite(derivedLimit) || derivedLimit <= 0) {
    return hostCpuCount;
  }

  return Math.max(0.25, Math.min(hostCpuCount, Number(derivedLimit.toFixed(2))));
}

function resolveCpuDescriptor(procSelfCgroup: ProcSelfCgroup, hostCpuCount: number) {
  const unifiedCpuMax = readTextFile(buildCandidatePaths("/sys/fs/cgroup", procSelfCgroup.unifiedPath, "cpu.max"));
  if (unifiedCpuMax) {
    const { quotaMicros, periodMicros } = parseCpuMax(unifiedCpuMax);
    const cpuStatRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup", procSelfCgroup.unifiedPath, "cpu.stat"));
    const cpuStats = cpuStatRaw ? parseKeyedStats(cpuStatRaw) : {};

    return {
      limit: {
        effectiveCpuLimit: toFiniteCpuLimit(hostCpuCount, quotaMicros, periodMicros),
        cpuQuotaMicros: quotaMicros,
        cpuPeriodMicros: periodMicros,
        source: cpuStats.usage_usec != null ? "cgroup" as const : "loadavg" as const,
      },
      usageMicros: cpuStats.usage_usec ?? null,
      throttledMicros: cpuStats.throttled_usec ?? null,
    };
  }

  const cpuRelativePath = procSelfCgroup.controllerPaths.get("cpu")
    ?? procSelfCgroup.controllerPaths.get("cpuacct")
    ?? null;
  const quotaRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup/cpu", cpuRelativePath, "cpu.cfs_quota_us"));
  const periodRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup/cpu", cpuRelativePath, "cpu.cfs_period_us"));
  const quotaMicros = quotaRaw ? Number.parseInt(quotaRaw, 10) : Number.NaN;
  const periodMicros = periodRaw ? Number.parseInt(periodRaw, 10) : Number.NaN;
  const usageNsRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup/cpuacct", cpuRelativePath, "cpuacct.usage"));
  const cpuStatRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup/cpu", cpuRelativePath, "cpu.stat"));
  const cpuStats = cpuStatRaw ? parseKeyedStats(cpuStatRaw) : {};

  const normalizedQuota = Number.isFinite(quotaMicros) && quotaMicros > 0 ? quotaMicros : null;
  const normalizedPeriod = Number.isFinite(periodMicros) && periodMicros > 0 ? periodMicros : null;
  const usageMicros = usageNsRaw
    ? Math.round(Number.parseInt(usageNsRaw, 10) / 1000)
    : null;

  return {
    limit: {
      effectiveCpuLimit: toFiniteCpuLimit(hostCpuCount, normalizedQuota, normalizedPeriod),
      cpuQuotaMicros: normalizedQuota,
      cpuPeriodMicros: normalizedPeriod,
      source: usageMicros != null ? "cgroup" as const : "loadavg" as const,
    },
    usageMicros,
    throttledMicros: cpuStats.throttled_time != null
      ? Math.round(cpuStats.throttled_time / 1000)
      : null,
  };
}

function normalizeMemoryLimit(limitBytes: number, hostTotalMemoryBytes: number) {
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) {
    return null;
  }

  if (limitBytes >= hostTotalMemoryBytes * 0.98) {
    return null;
  }

  return limitBytes;
}

function resolveMemoryDescriptor(
  procSelfCgroup: ProcSelfCgroup,
  hostTotalMemoryBytes: number,
  hostFreeMemoryBytes: number,
): MemoryDescriptor {
  const unifiedCurrentRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup", procSelfCgroup.unifiedPath, "memory.current"));
  const unifiedLimitRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup", procSelfCgroup.unifiedPath, "memory.max"));

  const normalizedUnifiedCurrent = unifiedCurrentRaw ? Number.parseInt(unifiedCurrentRaw, 10) : Number.NaN;
  const normalizedUnifiedLimit = unifiedLimitRaw === "max"
    ? null
    : normalizeMemoryLimit(
      unifiedLimitRaw ? Number.parseInt(unifiedLimitRaw, 10) : Number.NaN,
      hostTotalMemoryBytes,
    );

  if (Number.isFinite(normalizedUnifiedCurrent) && normalizedUnifiedLimit) {
    const headroomBytes = Math.max(0, normalizedUnifiedLimit - normalizedUnifiedCurrent);
    const utilizationPercent = Number(((normalizedUnifiedCurrent / normalizedUnifiedLimit) * 100).toFixed(1));

    return {
      currentBytes: normalizedUnifiedCurrent,
      limitBytes: normalizedUnifiedLimit,
      headroomBytes,
      utilizationPercent,
      source: "cgroup",
    };
  }

  const memoryRelativePath = procSelfCgroup.controllerPaths.get("memory") ?? null;
  const usageRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup/memory", memoryRelativePath, "memory.usage_in_bytes"));
  const limitRaw = readTextFile(buildCandidatePaths("/sys/fs/cgroup/memory", memoryRelativePath, "memory.limit_in_bytes"));
  const currentBytes = usageRaw ? Number.parseInt(usageRaw, 10) : Number.NaN;
  const limitBytes = normalizeMemoryLimit(
    limitRaw ? Number.parseInt(limitRaw, 10) : Number.NaN,
    hostTotalMemoryBytes,
  );

  if (Number.isFinite(currentBytes) && limitBytes) {
    const headroomBytes = Math.max(0, limitBytes - currentBytes);
    const utilizationPercent = Number(((currentBytes / limitBytes) * 100).toFixed(1));

    return {
      currentBytes,
      limitBytes,
      headroomBytes,
      utilizationPercent,
      source: "cgroup",
    };
  }

  const hostAvailableMemoryBytes = resolveHostAvailableMemoryBytes(
    hostTotalMemoryBytes,
    hostFreeMemoryBytes,
  );
  const currentBytesHost = Math.max(0, hostTotalMemoryBytes - hostAvailableMemoryBytes);
  return {
    currentBytes: currentBytesHost,
    limitBytes: hostTotalMemoryBytes,
    headroomBytes: hostAvailableMemoryBytes,
    utilizationPercent: hostTotalMemoryBytes > 0
      ? Number(((currentBytesHost / hostTotalMemoryBytes) * 100).toFixed(1))
      : 0,
    source: "host",
  };
}

export function getRuntimeResourceSnapshot(): RuntimeResourceSnapshot {
  const hostCpuCount = os.availableParallelism?.() ?? os.cpus().length ?? 1;
  const hostTotalMemoryBytes = os.totalmem();
  const hostFreeMemoryBytes = os.freemem();
  const procSelfCgroup = readProcSelfCgroup();
  const cpuDescriptor = resolveCpuDescriptor(procSelfCgroup, hostCpuCount);
  const memoryDescriptor = resolveMemoryDescriptor(
    procSelfCgroup,
    hostTotalMemoryBytes,
    hostFreeMemoryBytes,
  );
  const basis = cpuDescriptor.limit.source === "cgroup" || memoryDescriptor.source === "cgroup"
    ? "cgroup"
    : "host";

  return {
    basis,
    hostCpuCount,
    effectiveCpuLimit: cpuDescriptor.limit.effectiveCpuLimit,
    cpuQuotaMicros: cpuDescriptor.limit.cpuQuotaMicros,
    cpuPeriodMicros: cpuDescriptor.limit.cpuPeriodMicros,
    cpuUsageMicros: cpuDescriptor.usageMicros,
    cpuThrottleMicros: cpuDescriptor.throttledMicros,
    cpuMetricSource: cpuDescriptor.limit.source,
    loadAverage1m: Number((os.loadavg()[0] ?? 0).toFixed(2)),
    memoryMetricSource: memoryDescriptor.source,
    memoryCurrentBytes: memoryDescriptor.currentBytes,
    memoryLimitBytes: memoryDescriptor.limitBytes,
    memoryHeadroomBytes: memoryDescriptor.headroomBytes,
    memoryUtilizationPercent: memoryDescriptor.utilizationPercent,
    rssBytes: process.memoryUsage().rss,
  };
}

export function getDefaultPacketCaptureConcurrency() {
  const effectiveCpuLimit = getRuntimeResourceSnapshot().effectiveCpuLimit;
  return Math.max(2, Math.min(8, Math.floor(Math.max(1, effectiveCpuLimit) / 2)));
}
