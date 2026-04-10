const translations = {
  en: {
    // Common
    "app.title": "Mail Service",
    "app.description": "AI-powered newsletter and email sending service",
    loading: "Loading...",
    add: "Add",
    remove: "Remove",
    close: "Close",
    preview: "Preview",
    actions: "Actions",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",

    // Sidebar
    "nav.dashboard": "Dashboard",
    "nav.subscribers": "Subscribers",
    "nav.groups": "Groups",
    "nav.compose": "Compose",
    "nav.history": "History",

    // Dashboard
    "dashboard.subscribers.title": "Subscribers",
    "dashboard.subscribers.desc": "Manage your subscriber list. Add, remove, or import from CSV.",
    "dashboard.groups.title": "Groups",
    "dashboard.groups.desc": "Organize subscribers into groups for targeted emails.",
    "dashboard.compose.title": "Compose",
    "dashboard.compose.desc": "Generate email content with AI and send to your subscribers.",
    "dashboard.history.title": "History",
    "dashboard.history.desc": "View past emails and their delivery status.",

    // Subscribers
    "subscribers.title": "Subscribers",
    "subscribers.email": "Email",
    "subscribers.name": "Name",
    "subscribers.name.placeholder": "Optional",
    "subscribers.added": "Added",
    "subscribers.group": "Group",
    "subscribers.search": "Search subscribers...",
    "subscribers.import": "Import CSV",
    "subscribers.no_subscribers": "No subscribers yet",
    "subscribers.count": "{count} active subscriber(s)",
    "subscribers.imported": "Imported: {imported}, Skipped: {skipped}",
    "subscribers.all_groups": "All Groups",
    "subscribers.no_group": "No Group",
    "subscribers.download_template": "CSV Template",

    // Groups
    "groups.title": "Groups",
    "groups.description": "Organize subscribers into groups for targeted sending.",
    "groups.name": "Group Name",
    "groups.name.placeholder": "e.g. VIP Customers",
    "groups.create": "Create Group",
    "groups.no_groups": "No groups yet",
    "groups.count": "{count} subscriber(s)",
    "groups.delete_confirm": "Delete this group? Subscribers will not be deleted.",

    // Compose
    "compose.title": "Compose Email",
    "compose.description": "Describe what you want to send and AI will generate the email for you.",
    "compose.prompt_label": "Describe your email",
    "compose.prompt_placeholder": "e.g. Weekly newsletter about the latest AI developments, include 3 key stories with brief summaries...",
    "compose.generate": "Generate Email",
    "compose.generating": "Generating...",
    "compose.subject": "Subject",
    "compose.subject_placeholder": "Email subject line",
    "compose.preview": "Preview",
    "compose.view_html": "View HTML",
    "compose.visual_preview": "Visual Preview",
    "compose.send_all": "Send to All Subscribers",
    "compose.send_group": "Send to Group",
    "compose.sending": "Sending...",
    "compose.select_group": "Select group",
    "compose.all_subscribers": "All Subscribers",
    "compose.sent_result": "Sent to {success} subscriber(s)",
    "compose.sent_failed": ", {failed} failed",
    "compose.error_generate": "Error generating email",
    "compose.error_send": "Error sending emails",

    // Drafts
    "nav.drafts": "Drafts",
    "drafts.title": "Drafts",
    "drafts.description": "Saved email drafts. Click to edit and send.",
    "drafts.no_drafts": "No drafts yet",
    "drafts.save": "Save Draft",
    "drafts.saved": "Draft saved",
    "drafts.delete_confirm": "Delete this draft?",
    "drafts.updated": "Updated",
    "drafts.no_subject": "(No subject)",
    "dashboard.drafts.title": "Drafts",
    "dashboard.drafts.desc": "View and edit saved email drafts.",

    // Invitations
    "nav.invitations": "Invitations",
    "invitations.title": "Invitations",
    "invitations.description": "Invite users to sign up. Only invited users can create accounts.",
    "invitations.email": "Email to invite",
    "invitations.send": "Send Invite",
    "invitations.no_invitations": "No invitations yet",
    "invitations.status": "Status",
    "invitations.status.pending": "Pending",
    "invitations.status.used": "Used",
    "invitations.copy": "Copy Link",
    "invitations.copied": "Copied!",
    "invitations.delete_confirm": "Delete this invitation?",

    // History
    "history.title": "Send History",
    "history.date": "Date",
    "history.subject": "Subject",
    "history.recipients": "Recipients",
    "history.status": "Status",
    "history.no_history": "No emails sent yet",
  },
  ko: {
    // Common
    "app.title": "메일 서비스",
    "app.description": "AI 기반 뉴스레터 및 이메일 발송 서비스",
    loading: "로딩 중...",
    add: "추가",
    remove: "삭제",
    close: "닫기",
    preview: "미리보기",
    actions: "관리",
    save: "저장",
    cancel: "취소",
    delete: "삭제",
    edit: "수정",

    // Sidebar
    "nav.dashboard": "대시보드",
    "nav.subscribers": "구독자",
    "nav.groups": "그룹",
    "nav.compose": "이메일 작성",
    "nav.history": "발송 이력",

    // Dashboard
    "dashboard.subscribers.title": "구독자",
    "dashboard.subscribers.desc": "구독자 목록을 관리합니다. 추가, 삭제, CSV 가져오기를 할 수 있습니다.",
    "dashboard.groups.title": "그룹",
    "dashboard.groups.desc": "구독자를 그룹으로 나눠서 타겟 이메일을 보낼 수 있습니다.",
    "dashboard.compose.title": "이메일 작성",
    "dashboard.compose.desc": "AI로 이메일 내용을 생성하고 구독자에게 발송합니다.",
    "dashboard.history.title": "발송 이력",
    "dashboard.history.desc": "보낸 이메일과 발송 상태를 확인합니다.",

    // Subscribers
    "subscribers.title": "구독자",
    "subscribers.email": "이메일",
    "subscribers.name": "이름",
    "subscribers.name.placeholder": "선택사항",
    "subscribers.added": "등록일",
    "subscribers.group": "그룹",
    "subscribers.search": "구독자 검색...",
    "subscribers.import": "CSV 가져오기",
    "subscribers.no_subscribers": "구독자가 없습니다",
    "subscribers.count": "활성 구독자 {count}명",
    "subscribers.imported": "가져오기: {imported}명, 건너뜀: {skipped}명",
    "subscribers.all_groups": "전체 그룹",
    "subscribers.no_group": "그룹 없음",
    "subscribers.download_template": "CSV 양식 다운로드",

    // Groups
    "groups.title": "그룹",
    "groups.description": "구독자를 그룹으로 나눠서 관리합니다.",
    "groups.name": "그룹 이름",
    "groups.name.placeholder": "예: VIP 고객",
    "groups.create": "그룹 만들기",
    "groups.no_groups": "그룹이 없습니다",
    "groups.count": "구독자 {count}명",
    "groups.delete_confirm": "이 그룹을 삭제하시겠습니까? 구독자는 삭제되지 않습니다.",

    // Compose
    "compose.title": "이메일 작성",
    "compose.description": "보내고 싶은 이메일을 설명하면 AI가 생성해줍니다.",
    "compose.prompt_label": "이메일 내용 설명",
    "compose.prompt_placeholder": "예: 최신 AI 기술 동향에 대한 주간 뉴스레터, 주요 기사 3개와 간단한 요약 포함...",
    "compose.generate": "이메일 생성",
    "compose.generating": "생성 중...",
    "compose.subject": "제목",
    "compose.subject_placeholder": "이메일 제목",
    "compose.preview": "미리보기",
    "compose.view_html": "HTML 보기",
    "compose.visual_preview": "미리보기",
    "compose.send_all": "전체 구독자에게 발송",
    "compose.send_group": "그룹에게 발송",
    "compose.sending": "발송 중...",
    "compose.select_group": "그룹 선택",
    "compose.all_subscribers": "전체 구독자",
    "compose.sent_result": "{success}명에게 발송 완료",
    "compose.sent_failed": ", {failed}명 실패",
    "compose.error_generate": "이메일 생성 중 오류가 발생했습니다",
    "compose.error_send": "이메일 발송 중 오류가 발생했습니다",

    // Drafts
    "nav.drafts": "임시저장",
    "drafts.title": "임시저장",
    "drafts.description": "저장된 이메일 초안입니다. 클릭하면 수정 및 발송할 수 있습니다.",
    "drafts.no_drafts": "임시저장된 이메일이 없습니다",
    "drafts.save": "임시저장",
    "drafts.saved": "저장되었습니다",
    "drafts.delete_confirm": "이 초안을 삭제하시겠습니까?",
    "drafts.updated": "수정일",
    "drafts.no_subject": "(제목 없음)",
    "dashboard.drafts.title": "임시저장",
    "dashboard.drafts.desc": "저장된 이메일 초안을 확인하고 수정합니다.",

    // Invitations
    "nav.invitations": "초대 관리",
    "invitations.title": "초대 관리",
    "invitations.description": "사용자를 초대합니다. 초대받은 사용자만 가입할 수 있습니다.",
    "invitations.email": "초대할 이메일",
    "invitations.send": "초대하기",
    "invitations.no_invitations": "초대 내역이 없습니다",
    "invitations.status": "상태",
    "invitations.status.pending": "대기",
    "invitations.status.used": "사용됨",
    "invitations.copy": "링크 복사",
    "invitations.copied": "복사됨!",
    "invitations.delete_confirm": "이 초대를 삭제하시겠습니까?",

    // History
    "history.title": "발송 이력",
    "history.date": "날짜",
    "history.subject": "제목",
    "history.recipients": "수신자",
    "history.status": "상태",
    "history.no_history": "발송 이력이 없습니다",
  },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof (typeof translations)["en"];

export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text = (translations[locale]?.[key] ?? translations.en[key] ?? key) as string;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function getLocales(): { code: Locale; label: string }[] {
  return [
    { code: "en", label: "English" },
    { code: "ko", label: "한국어" },
  ];
}
