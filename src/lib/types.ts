export interface Member {
  memberId: string;
  fullName: string;
}

export interface SearchApiResponse {
  success: boolean;
  results?: Member[];
  error?: string;
}

export interface CheckinApiResponse {
  success: boolean;
  alreadyCheckedIn?: boolean;
  fullName?: string;
  error?: string;
}

export interface TodayCheckin {
  fullName: string;
  timestamp: string;
}

export interface StatsApiResponse {
  success: boolean;
  todayCount?: number;
  totalMembers?: number;
  todayCheckins?: TodayCheckin[];
  error?: string;
}

export interface ExportApiResponse {
  success: boolean;
  rows?: {
    timestamp: string;
    memberId: string;
    fullName: string;
    serviceDate: string;
  }[];
  error?: string;
}
