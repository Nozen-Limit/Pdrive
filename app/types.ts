export type Role = "teacher" | "head";
export type ResourceState =
  | "draft"
  | "pending"
  | "resubmitted"
  | "returned"
  | "approved"
  | "rejected"
  | "archived";
export type Scope =
  | "shared"
  | "mine"
  | "saved"
  | "recent"
  | "review"
  | "all"
  | "archived"
  | "myarchive";
export type Page =
  | "overview"
  | "bank"
  | "upload"
  | "detail"
  | "notes"
  | "notifications"
  | "teachers"
  | "profile"
  | "collaboration"
  | "help"
  | "summary"
  | "tools";
export interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  approval_status?: string;
  is_coordinator?: boolean;
  is_owner?: boolean;
  isOwner?: boolean;
  approval_note?: string;
  emailConfirmed?: boolean;
  requested_at?: string;
  avatarUrl?: string;
  avatar_key?: string;
  phone?: string;
  location?: string;
  assignment?: string;
  subjects?: string[];
  grade_levels?: string[];
}
export interface SchoolNote {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updated?: string;
}
export interface Notice {
  id: string;
  body: string;
  read: boolean;
  created: string;
  module?: string;
}
export interface SchoolState {
  user: Person;
  teachers: Person[];
  notes: SchoolNote[];
  notifications: Notice[];
  workflowReady: boolean;
  /** False until this account agrees to the current Privacy Notice. */
  privacyAccepted?: boolean;
}
export interface Resource {
  contributors?: { id: string; name: string }[];
  id: string;
  owner: string;
  title: string;
  creator: string;
  category?: string;
  bank_category?: string;
  subject: string;
  grade: string;
  term: string;
  state?: ResourceState;
  status: ResourceState;
  revision: number;
  version: number;
  final_version?: number;
  bank_draft: boolean;
  rejected_reason?: string;
  assigned_reviewer?: string | null;
  archived: boolean;
  created: string;
  updated: string;
  approved?: string;
  filename?: string;
  saved?: boolean;
  type?: string;
  bank_description?: string;
  bank_competency?: string;
  bank_competency_id?: string;
  bank_competency_code?: string;
  bank_curriculum_version?: string;
  bank_competency_source?: { title: string; url: string; page: string };
  bank_localization?: string;
  bank_resource_type?: string | null;
  bank_language?: string | null;
  bank_rights?: string | null;
  bank_tags?: string[];
  bank_source?: string;
  bank_notes?: string;
  approverName?: string;
}
export interface Version {
  id?: string;
  version: number;
  name: string;
  type: string;
  size: number;
  created: string;
  changes: string;
  uploader: string;
  url?: string;
  downloadUrl?: string;
  unavailable?: boolean;
  bank_competency_text?: string;
}
export interface Review {
  version: number;
  decision: string;
  reviewerName: string;
  feedback: string;
  created: string;
}
export interface ResourceDetail {
  resource: Resource;
  versions: Version[];
  reviews: Review[];
  events: { id: string; body: string; actorName: string; created: string }[];
  private: boolean;
  attachments?: Attachment[];
  hidden?: boolean;
  canReview?: boolean;
  reviewers?: Colleague[];
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Competency {
  id: string;
  status: string;
  learning_area: string;
  grade: string;
  quarter: string | null;
  official_code: string | null;
  competency_text: string;
  curriculum_version: string;
  source_title: string;
  source_url: string;
  source_page: string;
}
export interface CurriculumConfig {
  enforced: boolean;
  verified_count: number;
  learning_areas: string[];
}
export interface Coverage {
  verified_competencies: number;
  without_approved_resource: number;
  catalog_empty: boolean;
}
export type Metadata = Record<string, string | string[] | null>;
export interface Backend {
  ready(): Promise<void>;
  recovery: boolean;
  recoveryError: string;
  clearRecovery(): void;
  api(
    path: string,
    options?: { method?: string; body?: string | FormData },
  ): Promise<unknown>;
  reset(email: string): Promise<unknown>;
  updatePassword(password: string): Promise<void>;
  changePassword(currentPassword: string, nextPassword: string): Promise<void>;
  validateBankFile(file: File): Promise<unknown>;
  acceptPrivacy(): Promise<void>;
  phone: { normalize(value: string): string; format(value: string): string };
  bank: {
    collaboration(mid?: string | null): Promise<CollaborationState>;
    collaborationAction(args: {
      mid: string;
      action: string;
      payload?: Record<string, unknown>;
      expected_revision?: number;
    }): Promise<void>;
    list(
      filters: Record<string, string>,
      page?: number,
    ): Promise<PageResult<Resource>>;
    facets(): Promise<{ subjects: string[]; creators: string[] }>;
    details(id: string): Promise<ResourceDetail>;
    curriculum(): Promise<CurriculumConfig>;
    competencies(
      filters: Record<string, string>,
      page?: number,
    ): Promise<PageResult<Competency>>;
    competency(id: string): Promise<Competency | null>;
    competencyCoverage(): Promise<Coverage>;
    upload(
      id: string,
      file: File,
      onProgress?: (percent: number) => void,
    ): Promise<string>;
    save(args: {
      mid: string;
      d: Metadata;
      expected_revision: number | null;
      object_key: string | null;
      submit: boolean;
    }): Promise<string>;
    edit(args: {
      mid: string;
      d: Metadata;
      expected_revision: number;
    }): Promise<void>;
    revise(args: {
      mid: string;
      expected_revision: number;
      object_key: string;
      changes: string;
    }): Promise<void>;
    decide(args: {
      mid: string;
      expected_revision: number;
      decision: string;
      feedback: string;
      checks: Record<string, string>;
    }): Promise<void>;
    archive(args: {
      mid: string;
      expected_revision: number;
      archive: boolean;
    }): Promise<void>;
    deleteDraft(args: {
      mid: string;
      expected_revision: number;
    }): Promise<void>;
    saved(id: string, value: boolean): Promise<void>;
    reject(args: {
      mid: string;
      expected_revision: number;
      reason: string;
    }): Promise<void>;
    assign(mid: string, reviewer: string | null): Promise<void>;
    assigned(): Promise<AssignedReview[]>;
    setRole(uid: string, role: Role, coordinator: boolean): Promise<void>;
    setActive(uid: string, active: boolean): Promise<void>;
    report(mid: string, reason: string, details: string): Promise<void>;
    reports(): Promise<ProblemReport[]>;
    resolveReport(rid: string, note: string): Promise<void>;
    share(mid: string, recipient: string, note: string): Promise<void>;
    colleagues(): Promise<Colleague[]>;
    hide(mid: string, hidden: boolean): Promise<void>;
    attach(mid: string, object_key: string, label: string): Promise<void>;
    detach(aid: string): Promise<void>;
    transfer(
      mid: string,
      expected_revision: number,
      new_owner: string,
    ): Promise<void>;
    announcements(): Promise<Announcement[]>;
    announce(title: string, body: string, expires?: string): Promise<string>;
    removeAnnouncement(aid: string): Promise<void>;
    reportRows(): Promise<ReportRow[]>;
  };
}
export interface CollaborationState {
  resources?: (Resource & { membership?: string })[];
  teachers?: { id: string; name: string }[];
  resource?: Resource;
  members?: { id: string; name: string; status: string }[];
  comments?: {
    id: string;
    author: string;
    name: string;
    body: string;
    created: string;
  }[];
  proposals?: (Version & {
    id: string;
    author: string;
    selected: boolean;
    submitted: boolean;
  })[];
}
declare global {
  interface Window {
    sikapBackend: Backend;
    SIKAP_CONFIG: { supabaseUrl: string; supabasePublishableKey: string };
    previewDocx?: (url: string, target: HTMLElement) => Promise<void>;
  }
}

export interface Colleague {
  id: string;
  name: string;
  role: Role;
  coordinator: boolean;
}
export interface AssignedReview {
  id: string;
  title: string;
  creator: string;
  subject: string;
  grade: string;
  term: string;
  updated: string;
  revision: number;
}
export interface ProblemReport {
  id: string;
  module: string;
  title: string;
  reason: string;
  details: string;
  status: "open" | "resolved";
  resolution: string;
  reporter: string;
  created: string;
  resolved?: string;
}
export interface Attachment {
  id: string;
  module: string;
  key: string;
  name: string;
  type: string;
  size: number;
  label: string;
  created: string;
  url?: string;
  downloadUrl?: string;
  unavailable?: boolean;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  expires: string | null;
  created: string;
  author: string;
}
export interface ReportRow {
  title: string;
  teacher: string;
  subject: string;
  grade: string;
  term: string;
  category: string;
  status: string;
  version: number;
  submitted: string | null;
  approved: string | null;
  approver: string | null;
  updated: string;
}
