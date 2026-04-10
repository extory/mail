"use client";

import { useState } from "react";
import Link from "next/link";

type Lang = "ko" | "en";

const content = {
  ko: {
    nav: { login: "로그인", signup: "시작하기" },
    hero: {
      badge: "AI 기반 이메일 서비스",
      title: "뉴스레터, 이제\nAI로 쉽게 만드세요",
      subtitle:
        "템플릿에 맞추느라 시간 낭비하지 마세요. 보내고 싶은 내용을 설명하면 AI가 이메일을 만들어줍니다.",
      cta: "무료로 시작하기",
      ctaSub: "신용카드 필요 없음",
    },
    features: {
      title: "왜 다를까요?",
      items: [
        {
          title: "AI가 만드는 이메일",
          desc: "보내고 싶은 내용을 한 줄로 설명하세요. AI가 디자인된 HTML 이메일을 즉시 생성합니다. 템플릿 편집기와 씨름할 필요가 없습니다.",
        },
        {
          title: "구독자 그룹 관리",
          desc: "구독자를 그룹으로 나눠서 타겟 이메일을 보낼 수 있습니다. CSV로 대량 등록도 간단합니다.",
        },
        {
          title: "실시간 미리보기",
          desc: "AI가 이메일을 생성하는 과정을 실시간으로 볼 수 있습니다. 마음에 들지 않으면 바로 수정하거나 다시 생성하세요.",
        },
        {
          title: "대량 발송",
          desc: "Resend 기반의 안정적인 이메일 인프라로 수천 명에게 한 번에 발송합니다.",
        },
      ],
    },
    how: {
      title: "3단계로 끝",
      steps: [
        { num: "1", title: "내용 설명", desc: "어떤 이메일을 보내고 싶은지 자연어로 입력" },
        { num: "2", title: "AI가 생성", desc: "디자인된 HTML 이메일이 실시간으로 만들어짐" },
        { num: "3", title: "발송", desc: "미리보기 확인 후 전체 또는 그룹 발송" },
      ],
    },
    cta: {
      title: "지금 시작하세요",
      subtitle: "복잡한 이메일 빌더는 잊으세요. AI에게 맡기세요.",
      button: "무료로 시작하기",
    },
    footer: "Alineteam",
  },
  en: {
    nav: { login: "Log in", signup: "Get Started" },
    hero: {
      badge: "AI-Powered Email Service",
      title: "Create newsletters\neffortlessly with AI",
      subtitle:
        "Stop wasting time fitting content into templates. Just describe what you want to send and AI creates the email for you.",
      cta: "Get Started Free",
      ctaSub: "No credit card required",
    },
    features: {
      title: "Why it's different",
      items: [
        {
          title: "AI-Generated Emails",
          desc: "Describe what you want in one sentence. AI instantly generates a designed HTML email. No more wrestling with template editors.",
        },
        {
          title: "Subscriber Groups",
          desc: "Organize subscribers into groups for targeted emails. Bulk import via CSV is simple.",
        },
        {
          title: "Real-time Preview",
          desc: "Watch AI generate your email in real-time. Edit or regenerate instantly if needed.",
        },
        {
          title: "Bulk Sending",
          desc: "Send to thousands at once with reliable Resend-powered email infrastructure.",
        },
      ],
    },
    how: {
      title: "3 simple steps",
      steps: [
        { num: "1", title: "Describe", desc: "Type what email you want in plain language" },
        { num: "2", title: "AI generates", desc: "A designed HTML email is created in real-time" },
        { num: "3", title: "Send", desc: "Preview, then send to all or specific groups" },
      ],
    },
    cta: {
      title: "Start now",
      subtitle: "Forget complex email builders. Let AI handle it.",
      button: "Get Started Free",
    },
    footer: "Alineteam",
  },
};

const featureGradients = [
  "from-[#2B7FFF] to-[#06b6d4]",
  "from-[#34d399] to-[#22c55e]",
  "from-[#FDC700] to-[#FF6900]",
  "from-[#a78bfa] to-[#7c3aed]",
];

const featureIcons = [
  <svg key="ai" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
  <svg key="group" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  <svg key="preview" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  <svg key="send" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
];

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("ko");
  const t = content[lang];

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#f3f4f6]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2B7FFF] to-[#00C950] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Mail Service</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === "ko" ? "en" : "ko")}
              className="text-[12px] text-[#6b7280] hover:text-[#111827] font-medium px-2 py-1 rounded transition-colors"
            >
              {lang === "ko" ? "EN" : "KO"}
            </button>
            <Link href="/login" className="text-[13px] text-[#6b7280] hover:text-[#111827] font-medium transition-colors">
              {t.nav.login}
            </Link>
            <Link
              href="/signup"
              className="text-[13px] font-medium bg-[#155DFC] text-white px-4 py-1.5 rounded-lg hover:bg-[#0f4ad4] transition-colors"
            >
              {t.nav.signup}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#155DFC]/[0.08] text-[#155DFC] text-[12px] font-medium px-3 py-1 rounded-full mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {t.hero.badge}
          </div>
          <h1 className="text-[40px] md:text-[52px] font-bold leading-[1.15] tracking-tight whitespace-pre-line">
            {t.hero.title}
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-[#6b7280] leading-relaxed max-w-xl mx-auto">
            {t.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#2B7FFF] to-[#00C950] text-white text-[14px] font-medium px-7 py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-[#155DFC]/20"
            >
              {t.hero.cta}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <span className="text-[12px] text-[#9ca3af]">{t.hero.ctaSub}</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-[#f8fafc]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[28px] font-bold text-center tracking-tight mb-12">
            {t.features.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {t.features.items.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#e5e7eb] p-6 hover:border-[#155DFC]/20 hover:shadow-[0_4px_24px_rgba(21,93,252,0.06)] transition-all"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${featureGradients[i]} flex items-center justify-center mb-4`}>
                  {featureIcons[i]}
                </div>
                <h3 className="text-[15px] font-semibold mb-2">{item.title}</h3>
                <p className="text-[13px] text-[#6b7280] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[28px] font-bold text-center tracking-tight mb-12">
            {t.how.title}
          </h2>
          <div className="flex flex-col md:flex-row gap-8">
            {t.how.steps.map((step, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2B7FFF] to-[#00C950] text-white text-[18px] font-bold flex items-center justify-center mx-auto mb-4">
                  {step.num}
                </div>
                <h3 className="text-[15px] font-semibold mb-1">{step.title}</h3>
                <p className="text-[13px] text-[#6b7280]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-[#111827]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[28px] font-bold text-white tracking-tight">
            {t.cta.title}
          </h2>
          <p className="mt-3 text-[15px] text-[#9ca3af]">{t.cta.subtitle}</p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-[#2B7FFF] to-[#00C950] text-white text-[14px] font-medium px-7 py-3 rounded-full hover:opacity-90 transition-opacity"
          >
            {t.cta.button}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#f3f4f6]">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[12px] text-[#9ca3af]">
          <span>&copy; {new Date().getFullYear()} {t.footer}</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-[#6b7280] transition-colors">{t.nav.login}</Link>
            <Link href="/signup" className="hover:text-[#6b7280] transition-colors">{t.nav.signup}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
