import type { PostTargetDto, SocialAccountDto } from "@richfeed/shared";

export interface DashboardStats {
  scheduledThisWeek: number;
  publishedLast7Days: number;
  failedCount: number;
  accountsNeedingReconnect: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  attention: {
    failedTargets: PostTargetDto[];
    accountsNeedingReconnect: SocialAccountDto[];
  };
  upcoming: PostTargetDto[];
}
