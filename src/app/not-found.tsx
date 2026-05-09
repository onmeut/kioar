import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <style>{`
        .nf-page {
          height: 100dvh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          overflow: hidden;
          background: var(--background);
          color: var(--foreground);
        }
        .nf-numeral {
          font-weight: 200;
          font-size: clamp(180px, 32vw, 380px);
          line-height: 0.85;

          direction: ltr;
          user-select: none;
          display: inline-block;
          position: relative;
          margin: 0;
        }
        .nf-numeral .dim {
          color: color-mix(in srgb, var(--foreground) 14%, transparent);
        }
        .nf-zero-slot {
          display: inline-block;
          width: 0.78em;
          height: 0.78em;
          border-radius: 50%;
          border: 0.06em solid color-mix(in srgb, var(--foreground) 14%, transparent);
          position: relative;
          vertical-align: -0.04em;
          margin: 0 -0.04em;
        }
        .nf-zero-slot::before {
          content: "";
          position: absolute;
          inset: 0.13em;
          border-radius: 50%;
          border: 1.5px dashed color-mix(in srgb, var(--primary) 38%, transparent);
          animation: nf-rot 22s linear infinite;
        }
        .nf-zero-slot::after {
          content: "";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 2px;
          height: 0.32em;
          background: var(--primary);
          border-radius: 2px;
          animation: nf-blink 1.1s steps(2) infinite;
        }
        @keyframes nf-rot { to { transform: rotate(360deg); } }
        @keyframes nf-blink { 50% { opacity: 0; } }

        .nf-btn-primary {
          animation: nf-buzz 5.5s ease-in-out infinite;
          transform-origin: center;
          position: relative;
        }
        .nf-btn-primary:hover {
          background: color-mix(in srgb, var(--primary) 90%, black) !important;
          animation-play-state: paused;
        }
        .nf-btn-primary::after {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 50%, transparent);
          animation: nf-buzz-glow 5.5s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes nf-buzz {
          0%, 90%, 100% { transform: translate(0, 0) rotate(0); }
          91%   { transform: translate(-1px, 0.5px) rotate(-0.6deg); }
          92%   { transform: translate(1.4px, -0.5px) rotate(0.7deg); }
          93%   { transform: translate(-1.4px, -0.5px) rotate(-0.6deg); }
          94%   { transform: translate(1.2px, 0.5px) rotate(0.5deg); }
          95%   { transform: translate(-1px, 0) rotate(-0.4deg); }
          96%   { transform: translate(0.6px, 0) rotate(0.2deg); }
          97%   { transform: translate(0, 0) rotate(0); }
        }
        @keyframes nf-buzz-glow {
          0%, 89%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent); }
          91% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 18%, transparent); }
          96% { box-shadow: 0 0 0 14px color-mix(in srgb, var(--primary) 0%, transparent); }
        }

        .nf-corner {
          position: absolute;
          width: 14px; height: 14px;
          border: 1px solid color-mix(in srgb, var(--foreground) 18%, transparent);
        }
        .nf-corner.tl { top: 0; left: 0; border-right: 0; border-bottom: 0; }
        .nf-corner.tr { top: 0; right: 0; border-left: 0; border-bottom: 0; }
        .nf-corner.bl { bottom: 0; left: 0; border-right: 0; border-top: 0; }
        .nf-corner.br { bottom: 0; right: 0; border-left: 0; border-top: 0; }

        @media (max-width: 640px) {
          .nf-header, .nf-footer { padding-inline: 22px !important; }
          .nf-main { padding: 0 22px !important; }
          .nf-frame { padding: 32px 0 !important; }
          .nf-stamp { margin-bottom: 18px !important; }
          .nf-copy { margin-top: 24px !important; }
          .nf-footer-inner { flex-direction: column; gap: 10px; align-items: flex-start; }
          .nf-footer-links a { margin-inline-start: 0 !important; margin-inline-end: 14px; }
          .nf-corner { display: none; }
        }
        @media (max-height: 720px) {
          .nf-numeral { font-size: clamp(140px, 22vw, 240px) !important; }
          .nf-frame { padding: 20px 0 !important; }
          .nf-copy { margin-top: 20px !important; }
          .nf-stamp { margin-bottom: 16px !important; }
        }
      `}</style>

      <div className="nf-page">
        {/* Header */}
        <header className="nf-header relative z-10 flex items-center justify-between px-10 py-7">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-bold text-sm text-foreground no-underline"
          >
            <Image src="/brand/logo.svg" alt="" width={24} height={24} />
            <span>کیوآر</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            پشتیبانی
          </Link>
        </header>

        {/* Main */}
        <main className="nf-main relative z-10 grid place-items-center overflow-hidden px-10">
          <div className="w-full max-w-245 text-center">
            <div
              className="nf-frame relative"
              style={{ padding: "56px 0 48px" }}
            >
              <span className="nf-corner tl" />
              <span className="nf-corner tr" />
              <span className="nf-corner bl" />
              <span className="nf-corner br" />

              {/* Stamp */}
              <div
                className="nf-stamp flex items-center justify-center gap-2 mb-7"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                }}
              >
                <span
                  style={{
                    width: "32px",
                    height: "1px",
                    background: "var(--border)",
                    display: "inline-block",
                  }}
                />
                <span>Error · 404 · Not Found</span>
                <span
                  style={{
                    width: "32px",
                    height: "1px",
                    background: "var(--border)",
                    display: "inline-block",
                  }}
                />
              </div>

              {/* 404 numeral */}
              <div className="nf-numeral" aria-label="404">
                <span>4</span>
                <span className="nf-zero-slot" aria-hidden="true" />
                <span className="dim">4</span>
              </div>

              {/* Copy */}
              <div
                className="nf-copy"
                style={{
                  marginTop: "36px",
                  maxWidth: "480px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(22px, 2.4vw, 28px)",
                    fontWeight: 700,
                    lineHeight: 1.35,
                    letterSpacing: "-0.015em",
                    margin: "0 0 10px",
                    textWrap: "balance",
                  }}
                >
                  این آدرس هنوز{" "}
                  <em style={{ fontStyle: "normal", color: "var(--primary)" }}>
                    صاحب
                  </em>{" "}
                  نداره.
                </h1>
                <p
                  style={{
                    color: "var(--muted-foreground)",
                    fontSize: "14px",
                    lineHeight: 1.85,
                    margin: "0 0 28px",
                    textWrap: "pretty",
                  }}
                >
                  نگران نباش — هر لینکی یه جایی شروع میشه. همین الان اسمت رو روی
                  یه آدرسِ کیوآر بذار، قبل از این‌که یکی دیگه ببردش.
                </p>

                {/* CTA row */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card p-1.25"
                  style={{
                    boxShadow:
                      "var(--shadow-xs, 0 1px 2px 0 rgb(0 0 0 / 0.05))",
                  }}
                >
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 h-10.5 px-4.5 rounded-full text-[14px] font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline"
                    style={{ background: "transparent" }}
                  >
                    خانه
                  </Link>
                  <Link
                    href="/auth"
                    className="nf-btn-primary inline-flex items-center gap-2 h-10.5 px-4.5 rounded-full text-[14px] font-semibold no-underline"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                  >
                    بساز مالِ خودت
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M13 5l-7 7 7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="nf-footer relative z-10 px-10 py-5.5">
          <div className="nf-footer-inner flex items-center justify-between text-[12px] text-muted-foreground">
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "0.04em",
              }}
            >
              kioar.ir<strong className="text-foreground font-bold"> /</strong>{" "}
              · <span style={{ opacity: 0.7 }}>404</span>
            </div>
            <div className="nf-footer-links">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors no-underline ms-4.5"
              >
                وضعیت
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors no-underline ms-4.5"
              >
                حریم خصوصی
              </Link>
              <span className="ms-4.5">© ۱۴۰۵</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
