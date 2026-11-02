# AutoFill-Form — Google Form Auto-Filler Webapp

## Đọc Claude.md trong C:\Users\nhath\Máy tính\AI-Workspace để nhớ.

## 🎯 Project Goal
Webapp (Next.js 14 + TypeScript + Playwright) tự động điền Google Form public theo tỉ lệ người dùng cấu hình, phục vụ mục đích kiểm thử nội bộ.

## 🧱 Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| State | Zustand |
| UI | shadcn/ui (Radix primitives), Lucide icons |
| Automation | Playwright (Chromium headless) |
| Storage | CSV file-based |
| Font | Poppins (heading) + Open Sans (body) |

## 📁 Project Structure
```
AutoFill-Form/
├── CLAUDE.md                        # Project documentation
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── playwright.config.ts
├── components.json                  # shadcn/ui config
├── data/
│   ├── history.csv                  # Execution history
│   └── results/                     # Detailed results per session
└── src/
    ├── app/
    │   ├── layout.tsx               # Root layout + fonts
    │   ├── page.tsx                 # Main: Scanner → Config → Execute
    │   ├── globals.css              # Tailwind + theme variables
    │   ├── history/
    │   │   └── page.tsx             # Chat-style history page
    │   └── api/
    │       ├── scan/route.ts        # POST: scan Google Form
    │       ├── execute/route.ts     # POST: execute auto-fill (SSE)
    │       └── history/route.ts     # GET: list history entries
    ├── components/
    │   ├── ui/                      # shadcn/ui primitives
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── input.tsx
    │   │   ├── label.tsx
    │   │   ├── progress.tsx
    │   │   ├── badge.tsx
    │   │   ├── dialog.tsx
    │   │   ├── separator.tsx
    │   │   └── scroll-area.tsx
    │   ├── form-scanner.tsx         # URL input + scan trigger
    │   ├── form-config.tsx          # Ratio configuration per field
    │   ├── execution-panel.tsx      # Start/Stop + loop count
    │   ├── execution-log.tsx        # Real-time result stream
    │   └── captcha-popup.tsx        # Captcha alert dialog
    ├── lib/
    │   ├── utils.ts                 # shadcn/ui utility (cn)
    │   ├── browser.ts               # Playwright browser singleton
    │   ├── scanner.ts               # Google Form DOM parser
    │   ├── filler.ts                # Auto-fill engine
    │   └── csv-logger.ts            # CSV read/write utilities
    ├── stores/
    │   ├── form-store.ts            # Form structure + config state
    │   └── execution-store.ts       # Execution state + results
    └── types/
        └── index.ts                 # All TypeScript interfaces
```

## 🎨 Design System
- **Style**: Minimalism & Swiss (functional, high performance, WCAG AAA)
- **Primary**: `#2563EB` (blue-600)
- **Background**: `#F8FAFC` (slate-50)
- **Text**: `#1E293B` (slate-900)
- **Font**: Poppins (headings) + Open Sans (body)

## 🔄 Architecture Flow
```
[User] → [Scan URL] → [Parse DOM via Playwright] → [Show Fields]
                                                    ↓
[User] → [Configure Ratios] → [Set Loop Count] → [Start Execution]
                                                    ↓
[Playwright fills form in loop] ← [Rate Limit 4-6/min] ← [Captcha? → Stop]
                                                    ↓
                                          [Log to CSV] → [Show Results]
```

## 🚀 Setup
```bash
npm install
npx playwright install chromium
npm run dev
```

## ⚙️ Key Patterns
- **API Routes**: Server-side Playwright operations, client-side SSE streaming
- **State**: Zustand stores with loading/error/data pattern
- **Components**: shadcn/ui primitives, composition over configuration
- **Storage**: CSV append-only, read for history display
