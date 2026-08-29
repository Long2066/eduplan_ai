import { createHash } from "node:crypto";
import {
  normalizeGenerationSecurityContext,
  normalizeSecurityEventStatus,
  normalizeSecurityGenerationCalls,
  securityHashPreview,
  securityRiskLevel,
  summarizeSecurityGenerationCalls,
  type GenerationPipeline,
  type SecurityEventReviewStatus,
  type SecurityRiskReason,
} from "@shared/security-contract";

export type SecurityUserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: "admin" | "user";
  planStatus: string;
  disabled: boolean;
  ipLimitOverride: boolean;
};

export type SecurityAccessRecord = {
  id: string;
  uid: string;
  ipHash: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type SecurityOperationRecord = {
  id: string;
  uid: string;
  status: string;
  reservedAt: string;
  security: unknown;
  telemetry: unknown;
};

export type SecurityEventRecord = {
  id: string;
  uid: string;
  type: string;
  ipHash: string;
  relatedUids: string[];
  reviewStatus: SecurityEventReviewStatus;
  reviewNote: string;
  reviewedAt: string;
  reviewedByEmail: string;
  createdAt: string;
};

export type SecurityRiskRow = SecurityUserProfile & {
  riskScore: number;
  riskLevel: ReturnType<typeof securityRiskLevel>;
  reasons: SecurityRiskReason[];
  ipCount: number;
  ipHashes: string[];
  operationCount: number;
  releasedCount: number;
  failedCallCount: number;
  fallbackCallCount: number;
  totalTokens: number;
  duplicateGroupCount: number;
  openEventCount: number;
};

export type SecurityIpCluster = {
  key: string;
  ipHashPreview: string;
  uids: string[];
  activeFreeTrialUids: string[];
  blockedUids: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type SecurityDuplicateGroup = {
  key: string;
  fingerprintPreview: string;
  uids: string[];
  operationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type SecurityCoverage = {
  windowDays: number;
  from: string;
  to: string;
  operationsScanned: number;
  operationsWithSecurity: number;
  operationsWithIpHash: number;
  operationsWithFingerprint: number;
  operationsWithTelemetry: number;
  accessRecordsScanned: number;
  eventsScanned: number;
  oldestOperationAt: string;
  newestOperationAt: string;
  truncated: boolean;
};

export type SecurityDashboardData = {
  generatedAt: string;
  coverage: SecurityCoverage;
  summary: {
    openEvents: number;
    highRiskAccounts: number;
    multiAccountIpClusters: number;
    multiIpAccounts: number;
    releasedOperations: number;
    failedCalls: number;
    fallbackCalls: number;
    totalTokens: number;
  };
  risks: SecurityRiskRow[];
  ipClusters: SecurityIpCluster[];
  duplicateGroups: SecurityDuplicateGroup[];
  events: SecurityEventRecord[];
};

type AggregateSecurityInput = {
  users: SecurityUserProfile[];
  accesses: SecurityAccessRecord[];
  operations: SecurityOperationRecord[];
  events: SecurityEventRecord[];
  windowDays: number;
  from: string;
  to: string;
  limits: { accesses: number; operations: number; events: number };
};

function timestamp(value: string) {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

function sortedIso(values: string[], direction: "first" | "last") {
  const sorted = values.filter(Boolean).sort((a, b) => timestamp(a) - timestamp(b));
  return direction === "first" ? sorted[0] || "" : sorted.at(-1) || "";
}

function accountIsActiveFreeTrial(user: SecurityUserProfile | undefined) {
  if (!user || user.role === "admin" || user.disabled || user.ipLimitOverride) return false;
  return user.planStatus !== "paid";
}

function opaqueSecurityKey(value: string) {
  return createHash("sha256").update(`admin-security:${value}`).digest("hex").slice(0, 20);
}

function riskReason(code: SecurityRiskReason["code"], weight: number, label: string, detail: string): SecurityRiskReason {
  return { code, weight, label, detail };
}

export function aggregateSecurityDashboard(input: AggregateSecurityInput): SecurityDashboardData {
  const userByUid = new Map(input.users.map((user) => [user.uid, user]));
  const accessesByUid = new Map<string, Set<string>>();
  const accessesByIp = new Map<string, SecurityAccessRecord[]>();
  for (const access of input.accesses) {
    if (!access.uid || !access.ipHash) continue;
    const uidHashes = accessesByUid.get(access.uid) || new Set<string>();
    uidHashes.add(access.ipHash);
    accessesByUid.set(access.uid, uidHashes);
    const ipRows = accessesByIp.get(access.ipHash) || [];
    ipRows.push(access);
    accessesByIp.set(access.ipHash, ipRows);
  }

  const operationStats = new Map<string, {
    operationCount: number;
    releasedCount: number;
    failedCallCount: number;
    fallbackCallCount: number;
    totalTokens: number;
  }>();
  const fingerprintOperations = new Map<string, SecurityOperationRecord[]>();
  let operationsWithSecurity = 0;
  let operationsWithIpHash = 0;
  let operationsWithFingerprint = 0;
  let operationsWithTelemetry = 0;

  for (const operation of input.operations) {
    if (!operation.uid) continue;
    const stats = operationStats.get(operation.uid) || {
      operationCount: 0,
      releasedCount: 0,
      failedCallCount: 0,
      fallbackCallCount: 0,
      totalTokens: 0,
    };
    stats.operationCount += 1;
    if (operation.status === "released") stats.releasedCount += 1;

    const security = normalizeGenerationSecurityContext(operation.security);
    if (security) operationsWithSecurity += 1;
    if (security?.ipHash) operationsWithIpHash += 1;
    if (security?.inputFingerprint) {
      operationsWithFingerprint += 1;
      const rows = fingerprintOperations.get(security.inputFingerprint) || [];
      rows.push(operation);
      fingerprintOperations.set(security.inputFingerprint, rows);
    }

    const telemetry = operation.telemetry && typeof operation.telemetry === "object"
      ? operation.telemetry as { calls?: unknown; summary?: unknown }
      : {};
    const calls = normalizeSecurityGenerationCalls(telemetry.calls);
    if (calls.length || telemetry.summary) operationsWithTelemetry += 1;
    const summary = summarizeSecurityGenerationCalls(calls);
    const rawSummary = telemetry.summary && typeof telemetry.summary === "object"
      ? telemetry.summary as Record<string, unknown>
      : {};
    stats.failedCallCount += calls.length ? summary.failedCallCount : Math.max(0, Number(rawSummary.failedCallCount || 0));
    stats.fallbackCallCount += calls.length ? summary.fallbackCallCount : Math.max(0, Number(rawSummary.fallbackCallCount || 0));
    stats.totalTokens += calls.length ? summary.totalTokens : Math.max(0, Number(rawSummary.totalTokens || 0));
    operationStats.set(operation.uid, stats);
  }

  const duplicateGroups: SecurityDuplicateGroup[] = [];
  const duplicateGroupsByUid = new Map<string, number>();
  for (const [fingerprint, operations] of fingerprintOperations) {
    const uids = [...new Set(operations.map((operation) => operation.uid).filter(Boolean))];
    if (uids.length < 2) continue;
    duplicateGroups.push({
      key: opaqueSecurityKey(fingerprint),
      fingerprintPreview: securityHashPreview(fingerprint),
      uids,
      operationCount: operations.length,
      firstSeenAt: sortedIso(operations.map((operation) => operation.reservedAt), "first"),
      lastSeenAt: sortedIso(operations.map((operation) => operation.reservedAt), "last"),
    });
    for (const uid of uids) duplicateGroupsByUid.set(uid, (duplicateGroupsByUid.get(uid) || 0) + 1);
  }

  const normalizedEvents = input.events.map((event) => ({
    ...event,
    reviewStatus: normalizeSecurityEventStatus(event.reviewStatus),
    ipHash: event.ipHash ? securityHashPreview(event.ipHash) : "—",
  }));
  const openEventsByUid = new Map<string, number>();
  for (const event of input.events) {
    if (normalizeSecurityEventStatus(event.reviewStatus) === "open") {
      openEventsByUid.set(event.uid, (openEventsByUid.get(event.uid) || 0) + 1);
    }
  }

  const ipClusters: SecurityIpCluster[] = [...accessesByIp].map(([ipHash, rows]) => {
    const uids = [...new Set(rows.map((row) => row.uid))];
    return {
      key: opaqueSecurityKey(ipHash),
      ipHashPreview: securityHashPreview(ipHash),
      uids,
      activeFreeTrialUids: uids.filter((uid) => accountIsActiveFreeTrial(userByUid.get(uid))),
      blockedUids: uids.filter((uid) => userByUid.get(uid)?.disabled),
      firstSeenAt: sortedIso(rows.map((row) => row.firstSeenAt), "first"),
      lastSeenAt: sortedIso(rows.map((row) => row.lastSeenAt), "last"),
    };
  }).sort((a, b) => b.activeFreeTrialUids.length - a.activeFreeTrialUids.length || timestamp(b.lastSeenAt) - timestamp(a.lastSeenAt));

  const risks: SecurityRiskRow[] = input.users
    .filter((user) => user.role !== "admin")
    .map((user) => {
      const reasons: SecurityRiskReason[] = [];
      const ipHashes = [...(accessesByUid.get(user.uid) || new Set<string>())];
      const stats = operationStats.get(user.uid) || {
        operationCount: 0,
        releasedCount: 0,
        failedCallCount: 0,
        fallbackCallCount: 0,
        totalTokens: 0,
      };
      const duplicateGroupCount = duplicateGroupsByUid.get(user.uid) || 0;
      const openEventCount = openEventsByUid.get(user.uid) || 0;
      const maxCluster = Math.max(0, ...ipHashes.map((hash) => accessesByIp.get(hash)?.filter((row) => accountIsActiveFreeTrial(userByUid.get(row.uid))).length || 0));
      if (maxCluster >= 3) reasons.push(riskReason("ip_cluster_accounts", 45, "Cụm IP nhiều tài khoản", `${maxCluster} tài khoản Free/Trial đang hoạt động trong cùng cụm.`));
      else if (maxCluster >= 2) reasons.push(riskReason("ip_cluster_accounts", 22, "IP dùng chung", `${maxCluster} tài khoản Free/Trial được quan sát trong cùng cụm.`));
      if (openEventCount > 0) reasons.push(riskReason("ip_limit_event", Math.min(35, 25 + openEventCount * 5), "Có sự kiện giới hạn IP", `${openEventCount} sự kiện chưa xử lý.`));
      if (ipHashes.length >= 5) reasons.push(riskReason("uid_multiple_ips", 25, "Tài khoản trên nhiều IP", `${ipHashes.length} IP hash đã được quan sát.`));
      else if (ipHashes.length >= 3) reasons.push(riskReason("uid_multiple_ips", 12, "Tài khoản đổi IP", `${ipHashes.length} IP hash đã được quan sát.`));
      const releaseRate = stats.operationCount ? stats.releasedCount / stats.operationCount : 0;
      if (stats.operationCount >= 5 && releaseRate >= 0.6) reasons.push(riskReason("generation_release_rate", 24, "Tỷ lệ hoàn lượt cao", `${stats.releasedCount}/${stats.operationCount} lượt được hoàn.`));
      else if (stats.operationCount >= 5 && releaseRate >= 0.35) reasons.push(riskReason("generation_release_rate", 12, "Nhiều lượt được hoàn", `${stats.releasedCount}/${stats.operationCount} lượt được hoàn.`));
      if (stats.failedCallCount >= 10) reasons.push(riskReason("generation_failed_calls", 16, "Nhiều AI call lỗi", `${stats.failedCallCount} call lỗi trong cửa sổ quan sát.`));
      if (stats.totalTokens >= 500_000) reasons.push(riskReason("generation_token_volume", 18, "Token volume rất cao", `${stats.totalTokens.toLocaleString("vi-VN")} token thành công.`));
      else if (stats.totalTokens >= 200_000) reasons.push(riskReason("generation_token_volume", 9, "Token volume cao", `${stats.totalTokens.toLocaleString("vi-VN")} token thành công.`));
      if (duplicateGroupCount > 0) reasons.push(riskReason("duplicate_input_across_accounts", Math.min(35, 20 + duplicateGroupCount * 5), "Nội dung trùng giữa tài khoản", `${duplicateGroupCount} nhóm fingerprint xuất hiện trên nhiều UID.`));

      let riskScore = reasons.reduce((sum, reason) => sum + reason.weight, 0);
      if (user.ipLimitOverride || user.planStatus === "paid") riskScore = Math.round(riskScore * 0.35);
      riskScore = Math.min(100, riskScore);
      return {
        ...user,
        riskScore,
        riskLevel: securityRiskLevel(riskScore),
        reasons,
        ipCount: ipHashes.length,
        ipHashes: ipHashes.map(securityHashPreview),
        ...stats,
        duplicateGroupCount,
        openEventCount,
      };
    })
    .filter((risk) => risk.riskScore > 0 || risk.disabled || risk.ipLimitOverride)
    .sort((a, b) => b.riskScore - a.riskScore || b.operationCount - a.operationCount);

  const failedCalls = [...operationStats.values()].reduce((sum, stats) => sum + stats.failedCallCount, 0);
  const fallbackCalls = [...operationStats.values()].reduce((sum, stats) => sum + stats.fallbackCallCount, 0);
  const totalTokens = [...operationStats.values()].reduce((sum, stats) => sum + stats.totalTokens, 0);
  const releasedOperations = [...operationStats.values()].reduce((sum, stats) => sum + stats.releasedCount, 0);
  const operationDates = input.operations.map((operation) => operation.reservedAt).filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      windowDays: input.windowDays,
      from: input.from,
      to: input.to,
      operationsScanned: input.operations.length,
      operationsWithSecurity,
      operationsWithIpHash,
      operationsWithFingerprint,
      operationsWithTelemetry,
      accessRecordsScanned: input.accesses.length,
      eventsScanned: input.events.length,
      oldestOperationAt: sortedIso(operationDates, "first"),
      newestOperationAt: sortedIso(operationDates, "last"),
      truncated: input.operations.length >= input.limits.operations
        || input.accesses.length >= input.limits.accesses
        || input.events.length >= input.limits.events,
    },
    summary: {
      openEvents: normalizedEvents.filter((event) => event.reviewStatus === "open").length,
      highRiskAccounts: risks.filter((risk) => risk.riskScore >= 50).length,
      multiAccountIpClusters: ipClusters.filter((cluster) => cluster.activeFreeTrialUids.length >= 2).length,
      multiIpAccounts: risks.filter((risk) => risk.ipCount >= 3).length,
      releasedOperations,
      failedCalls,
      fallbackCalls,
      totalTokens,
    },
    risks,
    ipClusters: ipClusters.filter((cluster) => cluster.uids.length >= 2).slice(0, 100),
    duplicateGroups: duplicateGroups.sort((a, b) => b.uids.length - a.uids.length || b.operationCount - a.operationCount).slice(0, 100),
    events: normalizedEvents.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)).slice(0, 200),
  };
}

export function securityPipelineLabel(value: GenerationPipeline) {
  return value === "staged" ? "Staged" : "Direct";
}
