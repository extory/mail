"use client";

import { useState } from "react";
import Link from "next/link";

type Lang = "ko" | "en";
type Mode = "server" | "local";

const content = {
  ko: {
    title: "설치 가이드",
    subtitle: "서버에 배포하거나, 내 PC에서 바로 사용할 수 있습니다.",
    tabs: { server: "서버 배포", local: "PC에서 실행" },
    requirements: {
      server: {
        title: "필요 사항",
        items: [
          "Ubuntu 20.04+ 또는 Debian 11+ 서버",
          "Node.js 20+ (설치 스크립트에 포함)",
          "도메인 (예: mail.yourdomain.com)",
          "Anthropic 또는 Google AI Studio API 키",
          "Resend API 키 + 인증된 발신 도메인",
        ],
      },
      local: {
        title: "필요 사항",
        items: [
          "Mac, Windows, 또는 Linux PC",
          "Node.js 20+ (nodejs.org 에서 다운로드)",
          "Git",
          "Anthropic 또는 Google AI Studio API 키",
          "Resend API 키 + 인증된 발신 도메인",
        ],
      },
    },
    steps: {
      server: [
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
          title: "5. 접속 및 가입",
          desc: "브라우저에서 접속합니다. 첫 번째 가입자가 관리자(Admin)가 됩니다.",
          code: "URL: https://mail.yourdomain.com/signup\n\n첫 번째 가입 → 자동으로 관리자 계정 생성\n이후 가입 → 관리자의 초대가 필요",
        },
      ],
      local: [
        {
          title: "1. 레포지토리 클론",
          desc: "터미널(Mac/Linux) 또는 명령 프롬프트(Windows)에서 실행합니다.",
          code: "git clone https://github.com/extory/mail.git\ncd mail",
        },
        {
          title: "2. 의존성 설치",
          desc: "Node.js 패키지를 설치합니다.",
          code: "npm install",
        },
        {
          title: "3. 환경 변수 설정",
          desc: ".env.local 파일을 생성하고 API 키를 입력합니다.",
          code: `cp .env.example .env.local

# .env.local 파일을 텍스트 편집기로 열고 입력하세요:
# ANTHROPIC_API_KEY=sk-ant-...  (또는 GEMINI_API_KEY)
# RESEND_API_KEY=re_...
# SENDER_EMAIL=newsletter@yourdomain.com
# SENDER_NAME=My Newsletter
# JWT_SECRET=아무-랜덤-문자열`,
        },
        {
          title: "4. 빌드 및 실행",
          desc: "프로덕션 빌드 후 실행하거나, 개발 모드로 바로 시작할 수 있습니다.",
          code: `# 방법 A: 개발 모드 (바로 시작)
npm run dev

# 방법 B: 프로덕션 모드 (더 빠름)
npm run build
npm run start`,
        },
        {
          title: "5. 브라우저에서 접속",
          desc: "기본 포트는 3000입니다. 첫 번째 가입자가 관리자가 됩니다.",
          code: "URL: http://localhost:3000/signup\n\n다른 포트 사용: npm run dev -- -p 3100\n\n첫 번째 가입 → 자동으로 관리자 계정 생성",
        },
      ],
    },
    update: {
      server: { title: "업데이트", desc: "서버에서:", code: "cd ~/mail && ./deploy.sh" },
      local: { title: "업데이트", desc: "프로젝트 폴더에서:", code: "git pull origin main\nnpm install\nnpm run build\nnpm run start" },
    },
    commands: {
      server: {
        title: "유용한 명령어",
        items: [
          { cmd: "pm2 status", desc: "서비스 상태 확인" },
          { cmd: "pm2 logs mail", desc: "로그 확인" },
          { cmd: "pm2 restart mail", desc: "재시작" },
          { cmd: "pm2 stop mail", desc: "중지" },
        ],
      },
      local: {
        title: "유용한 명령어",
        items: [
          { cmd: "npm run dev", desc: "개발 모드 실행" },
          { cmd: "npm run build", desc: "프로덕션 빌드" },
          { cmd: "npm run start", desc: "프로덕션 서버 실행" },
          { cmd: "Ctrl+C", desc: "서버 중지" },
        ],
      },
    },
    invite: {
      title: "계정 및 초대",
      steps: [
        "/signup 에 접속하면 'Create Admin Account' 화면이 표시됩니다.",
        "첫 번째 가입자가 자동으로 관리자(Admin)가 됩니다. 초대 코드가 필요 없습니다.",
        "관리자 로그인 후 사이드바의 '초대 관리' 메뉴에서 이메일을 입력하고 초대합니다.",
        "'링크 복사' 버튼을 클릭하면 초대 링크가 클립보드에 복사됩니다.",
        "초대받은 사용자가 해당 링크로 접속하면 초대 코드와 이메일이 자동 입력됩니다.",
        "초대 없이는 가입할 수 없습니다.",
      ],
    },
    localNote: {
      title: "PC 실행 시 참고",
      items: [
        "PC에서는 도메인, nginx, SSL 설정이 필요 없습니다.",
        "http://localhost:3000 으로 접속하면 됩니다.",
        "같은 네트워크의 다른 기기에서 접속: http://내-PC-IP:3000",
        "PC를 끄면 서비스도 중지됩니다. 항시 운영하려면 서버 배포를 권장합니다.",
        "데이터는 프로젝트 폴더의 data/mail.db 파일에 저장됩니다.",
      ],
    },
    back: "홈으로",
  },
  en: {
    title: "Install Guide",
    subtitle: "Deploy to a server, or run it right on your PC.",
    tabs: { server: "Server Deploy", local: "Run on PC" },
    requirements: {
      server: {
        title: "Requirements",
        items: [
          "Ubuntu 20.04+ or Debian 11+ server",
          "Node.js 20+ (included in setup script)",
          "A domain (e.g. mail.yourdomain.com)",
          "Anthropic or Google AI Studio API key",
          "Resend API key + verified sending domain",
        ],
      },
      local: {
        title: "Requirements",
        items: [
          "Mac, Windows, or Linux PC",
          "Node.js 20+ (download from nodejs.org)",
          "Git",
          "Anthropic or Google AI Studio API key",
          "Resend API key + verified sending domain",
        ],
      },
    },
    steps: {
      server: [
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
          title: "5. Access and sign up",
          desc: "Open your browser. The first user to sign up becomes the admin.",
          code: "URL: https://mail.yourdomain.com/signup\n\nFirst signup → automatically becomes Admin\nSubsequent signups → require admin invitation",
        },
      ],
      local: [
        {
          title: "1. Clone the repository",
          desc: "Open Terminal (Mac/Linux) or Command Prompt (Windows).",
          code: "git clone https://github.com/extory/mail.git\ncd mail",
        },
        {
          title: "2. Install dependencies",
          desc: "Install Node.js packages.",
          code: "npm install",
        },
        {
          title: "3. Configure environment",
          desc: "Create .env.local and add your API keys.",
          code: `cp .env.example .env.local

# Open .env.local in a text editor and fill in:
# ANTHROPIC_API_KEY=sk-ant-...  (or GEMINI_API_KEY)
# RESEND_API_KEY=re_...
# SENDER_EMAIL=newsletter@yourdomain.com
# SENDER_NAME=My Newsletter
# JWT_SECRET=any-random-string`,
        },
        {
          title: "4. Build and run",
          desc: "Run in dev mode for quick start, or build for production.",
          code: `# Option A: Dev mode (quick start)
npm run dev

# Option B: Production mode (faster)
npm run build
npm run start`,
        },
        {
          title: "5. Open in browser",
          desc: "Default port is 3000. The first user to sign up becomes the admin.",
          code: "URL: http://localhost:3000/signup\n\nCustom port: npm run dev -- -p 3100\n\nFirst signup → automatically becomes Admin",
        },
      ],
    },
    update: {
      server: { title: "Updates", desc: "On your server:", code: "cd ~/mail && ./deploy.sh" },
      local: { title: "Updates", desc: "In the project folder:", code: "git pull origin main\nnpm install\nnpm run build\nnpm run start" },
    },
    commands: {
      server: {
        title: "Useful commands",
        items: [
          { cmd: "pm2 status", desc: "Check service status" },
          { cmd: "pm2 logs mail", desc: "View logs" },
          { cmd: "pm2 restart mail", desc: "Restart" },
          { cmd: "pm2 stop mail", desc: "Stop" },
        ],
      },
      local: {
        title: "Useful commands",
        items: [
          { cmd: "npm run dev", desc: "Start dev mode" },
          { cmd: "npm run build", desc: "Production build" },
          { cmd: "npm run start", desc: "Start production server" },
          { cmd: "Ctrl+C", desc: "Stop server" },
        ],
      },
    },
    invite: {
      title: "Accounts & Invitations",
      steps: [
        "Visit /signup — you'll see 'Create Admin Account'.",
        "The first signup automatically becomes the Admin. No invite code needed.",
        "Once logged in, go to 'Invitations' in the sidebar and enter an email to invite.",
        "Click 'Copy Link' to copy the invite URL to your clipboard.",
        "When the invited user opens the link, the invite code and email are pre-filled.",
        "Signup is impossible without an invitation.",
      ],
    },
    localNote: {
      title: "Notes for PC usage",
      items: [
        "No domain, nginx, or SSL setup required on PC.",
        "Access via http://localhost:3000.",
        "Access from other devices on the same network: http://your-PC-IP:3000",
        "The service stops when the PC is off. For 24/7, use server deploy.",
        "Data is stored in data/mail.db inside the project folder.",
      ],
    },
    back: "Back to home",
  },
};

export default function GuidePage() {
  const [lang, setLang] = useState<Lang>("ko");
  const [mode, setMode] = useState<Mode>("server");
  const t = content[lang];
  const req = t.requirements[mode];
  const steps = t.steps[mode];
  const update = t.update[mode];
  const commands = t.commands[mode];

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
        <p className="text-[16px] text-[#6b7280] mt-2 mb-8">{t.subtitle}</p>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-[#f3f4f6] rounded-lg p-1 mb-10 w-fit">
          {(["server", "local"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-md text-[13px] font-medium transition-all ${
                mode === m
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6b7280] hover:text-[#111827]"
              }`}
            >
              {t.tabs[m]}
            </button>
          ))}
        </div>

        {/* Requirements */}
        <section className="mb-12">
          <h2 className="text-[18px] font-semibold mb-4">{req.title}</h2>
          <ul className="space-y-2">
            {req.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-[#374151]">
                <span className="text-[#00C950] mt-0.5">&#10003;</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Steps */}
        <div className="space-y-10">
          {steps.map((step, i) => (
            <section key={i}>
              <h2 className="text-[18px] font-semibold mb-1">{step.title}</h2>
              <p className="text-[14px] text-[#6b7280] mb-3">{step.desc}</p>
              <pre className="bg-[#111827] text-[#e5e7eb] text-[13px] rounded-xl p-4 overflow-x-auto leading-relaxed">
                <code>{step.code}</code>
              </pre>
            </section>
          ))}
        </div>

        {/* Local note */}
        {mode === "local" && (
          <section className="mt-10 bg-[#FDC700]/[0.08] border border-[#FDC700]/20 rounded-xl p-5">
            <h3 className="text-[15px] font-semibold mb-3">{t.localNote.title}</h3>
            <ul className="space-y-2">
              {t.localNote.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[#374151] leading-relaxed">
                  <span className="text-[#FDC700] mt-0.5">&#9679;</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Update */}
        <section className="mt-12 pt-10 border-t border-[#f3f4f6]">
          <h2 className="text-[18px] font-semibold mb-1">{update.title}</h2>
          <p className="text-[14px] text-[#6b7280] mb-3">{update.desc}</p>
          <pre className="bg-[#111827] text-[#e5e7eb] text-[13px] rounded-xl p-4 overflow-x-auto">
            <code>{update.code}</code>
          </pre>
        </section>

        {/* Commands */}
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold mb-4">{commands.title}</h2>
          <div className="bg-[#f8fafc] border border-[#e5e7eb] rounded-xl overflow-hidden">
            {commands.items.map((item, i) => (
              <div key={i} className={`flex items-center px-5 py-3 text-[13px] ${i < commands.items.length - 1 ? "border-b border-[#e5e7eb]" : ""}`}>
                <code className="text-[#155DFC] font-mono w-48">{item.cmd}</code>
                <span className="text-[#6b7280]">{item.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Invite */}
        <section className="mt-10 bg-[#155DFC]/[0.04] border border-[#155DFC]/10 rounded-xl p-5">
          <h3 className="text-[15px] font-semibold mb-3">{t.invite.title}</h3>
          <ol className="space-y-2">
            {t.invite.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#374151] leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#155DFC]/10 text-[#155DFC] text-[11px] font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
