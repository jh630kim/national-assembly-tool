---
name: vibe-webeffect
description: >
  사용자가 웹페이지·랜딩페이지·웹앱 UI를 만들거나 고칠 때, 작업 맥락을 읽고 어울리는
  웹 애니메이션 효과를 추천하고 코드까지 적용해주는 스킬. 72개 효과 카탈로그
  (스크롤 스크러빙 / 호버 / 시그니처 / 등장·리빌 / 마이크로 인터랙션 / 로딩·상태 / 실험실)
  기반. 다음 상황에서 반드시 이 스킬을 사용한다: 사용자가 "웹페이지 만들어줘",
  "랜딩페이지", "히어로 섹션", "포트폴리오 사이트", "대시보드 UI", "폼/버튼 만들어줘",
  "애니메이션 넣어줘", "효과 추천해줘", "더 살아있게/고급스럽게/화려하게 해줘",
  "밋밋한데?", "인터랙션 추가" 등을 언급할 때 — 애니메이션이라는 단어가 없어도
  HTML/CSS/JS UI를 새로 만들거나 개선하는 요청이면 트리거한다.
---

# vibe-webeffect — 웹 애니메이션 추천·적용 스킬

<span style="color:red">사용자의 UI 작업 요구를 읽고 카탈로그에서 효과를 고른다. 추천 요청이면 이름(KR+EN)과 이유를 제시하고, 제작·수정 요청이면 선택한 효과를 바로 적용한다.</span>
핵심 철학: **"용어가 곧 능력"** — 효과의 정확한 이름을 알려주는 것 자체가 사용자의 자산이 된다.

## 파일 구성
- `catalog.json` — 72개 효과. `{id, cat, kr, en, intensity, tags, prereq, code, ref}` 스키마
- <span style="color:red">`references/modern-web-animation.md` — 최신 브라우저 기능의 적용 조건, 대체 동작, 접근성 기준. 코드 적용 전 먼저 읽는다.</span>
- <span style="color:red">`references/recipes.md` — 카탈로그 효과의 기존 구현 예시. 필요한 효과의 예시만 읽고, 최신 기준과 충돌하면 최신 기준을 따른다.</span>

---

## 워크플로우

### 1단계 — UI 컨텍스트 추출
사용자 요청에서 만들려는 화면의 구성요소를 파악한다. 명시가 없으면 요청의 성격에서 추론한다.

| 감지된 컨텍스트 | 매칭 태그 | 우선 카테고리 |
|---|---|---|
| 히어로/랜딩 첫 화면 | hero, landing | signature, scroll, insane(1개만) |
| 콘텐츠 섹션/블로그/소개 | section, content | **reveal** (기본값) |
| 카드 그리드/갤러리/포트폴리오 | grid, gallery, card, portfolio | reveal(stagger) + hover |
| 통계/수치/성과 | stats, number | reveal(count-up), signature(number-roll) |
| 폼/로그인/설정 | form, input, settings | **micro** + loading(error-shake) |
| 버튼/CTA | button, cta | micro, hover |
| 데이터 로딩/API 호출 화면 | loading, wait, feed | **loading** (필수) |
| 챗/AI 인터페이스 | chat, ai | loading(typing), micro |
| 제품 상세/이커머스 | product, ecommerce | hover, scroll(before-after), micro(star) |
| 스토리텔링/브랜드 사이트 | storytelling, brand, wow | scroll, signature, insane |
| 타임라인/프로세스/연혁 | timeline, process | reveal(line-draw, alternate-slide) |
| 배경이 밋밋함 | background, ambient | insane(constellation 등), signature(blob) |

### 2단계 — 카탈로그 매칭
`catalog.json`을 읽고 태그가 겹치는 효과를 후보로 모은다. 동률이면 intensity가 낮은 쪽을 우선한다(과잉 방지).

### <span style="color:red">3단계 — 추천 또는 적용</span>
<span style="color:red">효과 추천만 요청받았으면 상황에 맞는 후보 2~4개를 아래 형식으로 제시한다:</span>

> **[한국어 이름] ([영어 이름])** — 왜 이 화면에 맞는지 한 줄 + 필요한 전제조건(있으면)

<span style="color:red">웹 UI 제작·수정이 요청되었다면 적절한 효과를 골라 작업을 진행한다. 효과가 불필요한 화면에는 추가하지 않는다. 적용한 효과의 이름은 결과 보고에 명시한다.</span>

### 4단계 — 적용
1. <span style="color:red">`references/modern-web-animation.md`의 적용 조건을 확인하고, 필요한 경우에만 `references/recipes.md`의 해당 예시를 읽는다.</span>
2. <span style="color:red">카탈로그의 `code`는 예시로 취급한다. 현재 프로젝트 구조와 브라우저 지원 범위에 맞춰 구현한다.</span>
3. 아래 **적용 규칙**을 지킨다

### 5단계 — 결과 보고
적용한 효과의 이름(KR+EN)을 명시하고, 사용자가 나중에 AI에게 재요청할 수 있는 한 줄 지시문("~효과 넣어줘")을 함께 알려준다.

---

## 적용 규칙 (위반 금지)

1. **강도 배합** — 한 화면(뷰포트)에 `bold`는 최대 1개. 나머지는 subtle/medium. 전 화면이 다 움직이면 아무것도 안 보인다.
2. <span style="color:red">**움직임 줄이기** — `prefers-reduced-motion`에서 불필요한 움직임을 없애거나 줄이고, 콘텐츠와 조작 기능은 그대로 보이게 한다.</span>
3. <span style="color:red">**성능** — 가능하면 `transform`·`opacity`를 사용한다. 스크롤 진행에 따른 시각 효과는 지원 환경에서 CSS `animation-timeline`을 우선 검토한다. JS가 필요한 경우에는 스크롤 이벤트 작업량과 반복 실행을 제한한다.</span>
4. **transition 재생 함정** — transition 기반 효과를 재트리거할 땐 recipes.md의 "스냅 리셋" 패턴을 쓴다 (클래스 뗐다 바로 붙이면 재생 안 됨).
5. <span style="color:red">**등장 효과** — 한 번 나타나는 효과는 `IntersectionObserver`를 쓸 수 있다. JS가 꺼졌거나 API가 없는 환경에서도 콘텐츠가 보이도록 기본 상태를 유지한다.</span>
6. <span style="color:red">**로딩 상태** — 실제 진행률을 알 때만 백분율을 표시한다. 대기 표시에는 상태를 알 수 있는 텍스트나 접근 가능한 이름을 제공한다.</span>
7. <span style="color:red">**의존성** — 기존 프로젝트의 프레임워크와 라이브러리를 우선 존중한다. 효과 하나를 위해 새 의존성을 추가할 필요가 있는지 판단한다.</span>
8. **마이크로 인터랙션 공용 이징** — `cubic-bezier(.34,1.56,.64,1)` (오버슈트 스프링).

## 추천 어조
- 이름을 가르치듯: "이건 **라인 마스크 리빌(line mask reveal)**이라고 하는데…"
- 과잉을 말리는 것도 추천이다: "여긴 효과 없이 두는 게 낫다"가 정답인 화면이 있다.
- 전제조건(예: 이미지 시퀀스는 ffmpeg 프레임 추출 필요)은 추천 시점에 미리 알린다.
