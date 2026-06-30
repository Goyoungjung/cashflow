# CashFlow API

가계부 앱 백엔드 API — Node.js + Express + Supabase + Render

## 기술 스택

| 항목 | 스택 |
|------|------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| DB / Auth | Supabase (PostgreSQL + Auth) |
| 배포 | Render (Web Service) |
| 슬립 방지 | UptimeRobot → `/health` 5분 ping |

---

## 1단계 — Supabase 프로젝트 설정

1. [supabase.com](https://supabase.com) → New Project (리전: **Northeast Asia (Seoul)**)
2. **SQL Editor** → `supabase/migrations/001_init.sql` 전체 실행
3. **Project Settings → API** 에서 아래 값 복사:
   - `URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. (선택) pg_cron 고정지출 자동반영 사용 시:
   - **Database → Extensions** → `pg_cron` 활성화
   - `001_init.sql` 하단 주석 처리된 `SELECT cron.schedule(...)` 실행

---

## 2단계 — 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 Supabase URL, SERVICE_ROLE_KEY 입력

# 개발 서버 실행
npm run dev
# → http://localhost:3000

# 헬스체크
curl http://localhost:3000/health
```

---

## 3단계 — Render 배포

1. GitHub 저장소 push
2. [render.com](https://render.com) → **New Web Service** → GitHub 연결
3. `render.yaml` 자동 감지 → **Environment Variables** 에서 설정:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy → 배포 완료 후 Render URL 확인

---

## 4단계 — Render 슬립 방지 (무료 티어)

Render 무료 플랜은 15분 비활성 시 슬립됩니다.

1. [UptimeRobot](https://uptimerobot.com) 무료 가입
2. **Add New Monitor** → HTTP(s) 유형 선택
3. URL: `https://<your-render-url>/health`
4. 모니터링 간격: **5분**

---

## 프로젝트 구조

```
src/
├── config/
│   └── supabase.js          # Supabase admin 클라이언트 (service_role)
├── middleware/
│   └── auth.js              # Supabase JWT 검증 → req.user 주입
├── routes/
│   ├── cards.js             # GET/POST/PUT/DELETE /api/cards
│   ├── budgets.js           # GET/POST /api/budgets, GET /api/budgets/summary
│   ├── transactions.js      # CRUD + /calendar (cursor 페이징)
│   ├── fixedExpenses.js     # CRUD + POST /apply
│   └── stats.js             # /category /card /monthly
├── services/
│   ├── budgetService.js     # 월별 예산 요약 집계
│   └── fixedExpenseScheduler.js  # node-cron (KST 매월 1일 00:00)
└── app.js                   # Express 앱 + 서버 시작
supabase/
└── migrations/
    └── 001_init.sql         # 전체 스키마 + RLS 정책 + 인덱스 + pg_cron 가이드
```

---

## API 엔드포인트

모든 API는 `Authorization: Bearer <supabase_access_token>` 헤더 필수.  
Supabase Auth는 **클라이언트에서 직접** 처리 (서버는 토큰 검증만 담당).

### Card
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/cards | 카드 목록 |
| POST | /api/cards | 카드 등록 |
| PUT | /api/cards/:id | 카드 수정 |
| DELETE | /api/cards/:id | 카드 삭제 |

### Budget
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/budgets?year=&month= | 예산 조회 |
| POST | /api/budgets | 예산 upsert |
| GET | /api/budgets/summary?year=&month= | 월별 요약 |

### Transaction
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/transactions | 목록 (cursor 페이징) |
| POST | /api/transactions | 등록 |
| PUT | /api/transactions/:id | 수정 |
| DELETE | /api/transactions/:id | 삭제 |
| GET | /api/transactions/calendar?year=&month= | 캘린더 뷰 |

### Fixed Expense
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/fixed-expenses | 목록 |
| POST | /api/fixed-expenses | 등록 |
| PUT | /api/fixed-expenses/:id | 수정 |
| DELETE | /api/fixed-expenses/:id | 삭제 |
| POST | /api/fixed-expenses/apply?year=&month= | 이번 달 일괄 반영 |

### Statistics
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/stats/category?year=&month= | 카테고리별 집계 |
| GET | /api/stats/card?year=&month= | 카드사별 집계 |
| GET | /api/stats/monthly?months=6 | 최근 N개월 추이 |

---

## 응답 형식

```json
// 성공
{ "success": true, "data": { ... } }

// 에러
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." } }

// 페이지네이션 (transactions)
{ "success": true, "data": { "items": [...], "next_cursor": "ISO timestamp", "has_more": true } }
```

---

## 고정지출 자동반영

- **node-cron** (앱 레벨): `'0 15 28-31 * *'` — KST 1일 여부 확인 후 실행
- **pg_cron** (DB 레벨, 권장): Render 슬립 중에도 Supabase DB에서 직접 실행  
  → `001_init.sql` 하단 주석 참고

---

## API 테스트

`tests/api.http` 파일을 VS Code **REST Client** 확장으로 실행
