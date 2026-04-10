"use client";

import { useState } from "react";
import Link from "next/link";

type Lang = "ko" | "en";

const content = {
  ko: {
    title: "설치 가이드",
    subtitle: "5분이면 설치 완료. Ubuntu/Debian 서버 하나면 충분합니다.",
    requirements: {
      title: "필요 사항",
      items: [
        "Ubuntu 20.04+ 또는 Debian 11+ 서버",
        "Node.js 20+ (설치 스크립트에 포함)",
        "도메인 (예: mail.yourdomain.com)",
        "Anthropic 또는 Google AI Studio API 키",
        "Resend API 키 + 인증된 발신 도메인",
      ],
    },
    steps: [
      {
        title: "1. 레포지토리 클론",
        desc: "서버에 SSH 접속 후 실행합니다.",
        code: "git clone https://github.com/extory/mail.git ~/mail\ncd ~/mail",
      },
      {
        title: "2. 환경 변수 설정",
        desc: ".env.local 파일을 생성하고 API 키를 입력합니다.",
        code: `cp .env.example .env.local
nano .env.local

# 아래 값들을 입력하세요:
# ANTHROPIC_API_KEY=sk-ant-...  (또는 GEMINI_API_KEY)
# RESEND_API_KEY=re_...
# SENDER_EMAIL=newsletter@yourdomain.com
# SENDER_NAME=My Newsletter
# JWT_SECRET=your-random-secret-string`,
      },
      {
        title: "3. 자동 설치 실행",
        desc: "nginx, SSL, pm2, Node.js를 자동으로 설치하고 설정합니다.",
        code: "chmod +x infra/setup-server.sh\n./infra/setup-server.sh",
      },
      {
        title: "4. DNS 설정",
        desc: "도메인 관리에서 A 레코드를 추가합니다.",
        code: "mail.yourdomain.com → 서버 IP 주소",
      },
      {
        title: "5. 접속 및 로그인",
        desc: "브라우저에서 접속합니다. 첫 번째 가입자가 관리자(Admin)가 됩니다.",
        code: "URL: https://mail.yourdomain.com/signup\n\n첫 번째 가입 → 자동으로 관리자 계정 생성\n이후 가입 → 관리자의 초대가 필요",
      },
    ],
    update: {
      title: "업데이트",
      desc: "코드를 수정하거나 업데이트가 있을 때:",
      code: "cd ~/mail && ./deploy.sh",
    },
    commands: {
      title: "유용한 명령어",
      items: [
        { cmd: "pm2 status", desc: "서비스 상태 확인" },
        { cmd: "pm2 logs mail", desc: "로그 확인" },
        { cmd: "pm2 restart mail", desc: "재시작" },
        { cmd: "pm2 stop mail", desc: "중지" },
      ],
    },
    invite: {
      title: "사용자 초대",
      desc: "회원가입은 초대제로 운영됩니다. 관리자가 대시보드의 '초대 관리' 메뉴에서 이메일을 입력하면 초대 링크가 생성됩니다. 초대받은 사용자만 가입할 수 있습니다.",
    },
    back: "홈으로",
  },
  en: {
    title: "Install Guide",
    subtitle: "5 minutes to install. All you need is one Ubuntu/Debian server.",
    requirements: {
      title: "Requirements",
      items: [
        "Ubuntu 20.04+ or Debian 11+ server",
        "Node.js 20+ (included in setup script)",
        "A domain (e.g. mail.yourdomain.com)",
        "Anthropic or Google AI Studio API key",
        "Resend API key + verified sending domain",
      ],
    },
    steps: [
      {
        title: "1. Clone the repository",
        desc: "SSH into your server and run:",
        code: "git clone https://github.com/extory/mail.git ~/mail\ncd ~/mail",
      },
      {
        title: "2. Configure environment",
        desc: "Create .env.local and add your API keys.",
        code: `cp .env.example .env.local
nano .env.local

# Fill in these values:
# ANTHROPIC_API_KEY=sk-ant-...  (or GEMINI_API_KEY)
# RESEND_API_KEY=re_...
# SENDER_EMAIL=newsletter@yourdomain.com
# SENDER_NAME=My Newsletter
# JWT_SECRET=your-random-secret-string`,
      },
      {
        title: "3. Run setup script",
        desc: "Automatically installs nginx, SSL, pm2, and Node.js.",
        code: "chmod +x infra/setup-server.sh\n./infra/setup-server.sh",
      },
      {
        title: "4. Configure DNS",
        desc: "Add an A record in your domain settings.",
        code: "mail.yourdomain.com → your server IP",
      },
      {
        title: "5. Access and login",
        desc: "Open your browser. The first user to sign up becomes the admin.",
        code: "URL: https://mail.yourdomain.com/signup\n\nFirst signup → automatically becomes Admin\nSubsequent signups → require admin invitation",
      },
    ],
    update: {
      title: "Updates",
      desc: "When you need to update:",
      code: "cd ~/mail && ./deploy.sh",
    },
    commands: {
      title: "Useful commands",
      items: [
        { cmd: "pm2 status", desc: "Check service status" },
        { cmd: "pm2 logs mail", desc: "View logs" },
        { cmd: "pm2 restart mail", desc: "Restart" },
        { cmd: "pm2 stop mail", desc: "Stop" },
      ],
    },
    invite: {
      title: "Inviting users",
      desc: "Signup is invite-only. Admins can invite users from the 'Invitations' menu in the dashboard. Only invited users can create accounts.",
    },
    back: "Back to home",
  },
};

export default function GuidePage() {
  const [lang, setLang] = useState<Lang>("ko");
  const t = content[lang];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#f3f4f6]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2B7FFF] to-[#00C950] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Mail Service</span>
          </Link>
          <button
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
            className="text-[12px] text-[#6b7280] hover:text-[#111827] font-medium px-2 py-1 rounded transition-colors"
          >
            {lang === "ko" ? "EN" : "KO"}
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-[13px] text-[#155DFC] hover:underline font-medium">
          &larr; {t.back}
        </Link>

        <h1 className="text-[32px] font-bold tracking-tight mt-6">{t.title}</h1>
        <p className="text-[16px] text-[#6b7280] mt-2 mb-12">{t.subtitle}</p>

        {/* Requirements */}
        <section className="mb-12">
          <h2 className="text-[18px] font-semibold mb-4">{t.requirements.title}</h2>
          <ul className="space-y-2">
            {t.requirements.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-[#374151]">
                <span className="text-[#00C950] mt-0.5">&#10003;</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Steps */}
        <div className="space-y-10">
          {t.steps.map((step, i) => (
            <section key={i}>
              <h2 className="text-[18px] font-semibold mb-1">{step.title}</h2>
              <p className="text-[14px] text-[#6b7280] mb-3">{step.desc}</p>
              <pre className="bg-[#111827] text-[#e5e7eb] text-[13px] rounded-xl p-4 overflow-x-auto leading-relaxed">
                <code>{step.code}</code>
              </pre>
            </section>
          ))}
        </div>

        {/* Update */}
        <section className="mt-12 pt-10 border-t border-[#f3f4f6]">
          <h2 className="text-[18px] font-semibold mb-1">{t.update.title}</h2>
          <p className="text-[14px] text-[#6b7280] mb-3">{t.update.desc}</p>
          <pre className="bg-[#111827] text-[#e5e7eb] text-[13px] rounded-xl p-4 overflow-x-auto">
            <code>{t.update.code}</code>
          </pre>
        </section>

        {/* Commands */}
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold mb-4">{t.commands.title}</h2>
          <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-xl overflow-hidden">
            {t.commands.items.map((item, i) => (
              <div key={i} className={`flex items-center px-5 py-3 text-[13px] ${i < t.commands.items.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
                <code className="text-[#155DFC] font-mono w-48">{item.cmd}</code>
                <span className="text-[#6b7280]">{item.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Invite */}
        <section className="mt-10 bg-[#155DFC]/[0.04] border border-[#155DFC]/10 rounded-xl p-5">
          <h3 className="text-[15px] font-semibold mb-2">{t.invite.title}</h3>
          <p className="text-[13px] text-[#6b7280] leading-relaxed">{t.invite.desc}</p>
        </section>
      </div>
    </div>
  );
}
