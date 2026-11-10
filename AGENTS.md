# AGENTS.md — 에이전트가 이 폴더에서 가장 먼저 읽는 규칙

<span style="color:red">기존 양식을 프로젝트 규칙으로 채웠다. `CLAUDE.md`의 프로젝트 규칙과 `Coding_Rule.md`의 일반 지침을 함께 적용한다.</span>

## 꼭 들어가야 할 3줄 (체크)
- [x] <span style="color:red">작업 전에 CONTEXT.md에 적힌 근거 자료를 먼저 읽는다. 없는 자료는 있는 것으로 가정하지 않는다.</span>
- [x] <span style="color:red">배분 규칙은 배분기준표 CSV에 두고, 코드에 직접 쓰지 않는다(코드는 읽기만). 판정 순서는 처리지침 제3장(우선순위 숫자가 큰 과 → 동순위·불일치는 「확인필요」)을 따른다. `처리지침.md`가 아직 없으므로 현재는 `CONTEXT.md`의 원자료와 최신 공지를 근거로 한다.</span>
- [x] <span style="color:red">부서는 조직도(26개 과) 안에서만 쓴다. 없는 부서명을 만들지 않는다.</span>

## 1. 언어와 보고
- <span style="color:red">답변·주석·문서는 한국어로 쓴다. 확인한 사실과 추정·제안을 구분하고, 수치는 원자료에 대조한다.</span>
- <span style="color:red">결과에는 변경 내용, 확인 방법, 남은 문제를 보고한다. 질의응답·원인 분석 요청에는 수정 없이 분석과 개선 계획을 보고한다.</span>

## 2. 작업 범위
- <span style="color:red">문항별 접수·분해·배분 후보·회신 취합·누락 점검·이력 기록을 다룬다. 답변 자동 작성, 결재, 외부 제출과 제출 여부 결정은 범위 밖이다.</span>
- <span style="color:red">과거 접수대장은 읽기 전용이다. 실제 요구자료는 내부 시스템에서만 취급하고 개인정보 포함 자료를 외부 AI에 전송하지 않는다.</span>
- <span style="color:red">사용자의 명시적 지시 전에는 소스 코드를 작성·수정하지 않는다. 이 폴더 밖의 파일은 요청과 권한이 허용할 때만 다룬다.</span>

## 3. 작업 순서
1. <span style="color:red">`PROGRESS.md`를 먼저 읽어 완료·남은 일·막힌 점을 확인한다.</span>
2. <span style="color:red">`CONTEXT.md`에서 근거 파일을 찾아 실제 내용을 읽고 `CLAUDE.md`·`Coding_Rule.md`의 적용 규칙을 확인한다.</span>
3. <span style="color:red">요구의 의도·모호함·개선점·UI 표현(해당 시)을 확인한다. 코딩 지시 전에는 구현하지 않고, 지시 후 필요한 부분만 수정·검증한다.</span>
4. <span style="color:red">끝나면 `PROGRESS.md`에 날짜·완료·남은 일·막힌 점을 갱신한다.</span>

## 4. 금지 (먼저 물어볼 것 포함)
- 99_완성본_잠금 폴더(완성본 zip)는 열거나 풀거나 참고하지 않는다. 암호를 묻거나 추측하지 않는다(과정 규칙).
- <span style="color:red">추정으로 부서·배분 결과·숫자·단계 정의를 확정하지 않는다. 동순위·미매칭·불일치는 「확인필요」로 남기고 사람이 결정한다.</span>
- <span style="color:red">관련 없는 코드·주석·형식을 정리하거나 기존 기록을 지우지 않는다. 변경·보완·수정 사유는 이력에 남긴다.</span>
- <span style="color:red">사용자 요청 없이 커밋·푸시하거나 Discord 알림을 보내지 않는다. 비밀키와 웹훅 URL을 문서나 공유 코드에 넣지 않는다.</span>

## 5. `CLAUDE.md`에서 함께 적용할 상세 규칙
- <span style="color:red">일반 코딩 규율은 `Coding_Rule.md`가 우선이고 `CLAUDE.md`의 프로젝트 규칙을 더한다. 코딩 전 계획에는 의도 재정리, 모호함, 개선점, UI 표현(해당 시)만 담는다. 파일·함수별 구현 명세는 쓰지 않는다.</span>
- <span style="color:red">Python 개발 시 모듈은 주 객체 하나 중심, 파일 200줄·메서드 30줄 이내를 원칙으로 한다. 예외는 `docs/size_exceptions.md`에 사유를 기록해 검토받는다. 개발 환경은 루트 `.venv`를 사용한다.</span>
- <span style="color:red">개발 착수 시 Git 저장소가 없으면 `git init`과 `.gitignore`를 준비한다. `.gitignore`에는 `.venv/`, `__pycache__/`, `build/`, `dist/`, `.claude/*.local.json`을 포함한다. 커밋·푸시는 사용자 지시가 있을 때만 한다.</span>
- <span style="color:red">소스 코드와 `CLAUDE.md` 외의 기존 Markdown 문서는 이번 변경분만 빨간색 HTML span 태그로 표시하고, 과거의 빨간 표시 중 이번에 건드리지 않은 부분은 원복한다. 신규 문서 최초 생성은 색상 표시를 하지 않는다. `docs/` 계획 문서명은 세션 이름으로 한다.</span>
- <span style="color:red">새 컨벤션·프로젝트 변경 기록은 `CLAUDE.md`의 `[yyyymmdd]_제목` 아래 남긴다. Discord는 사용자가 명시적으로 요청한 경우에만 `.claude/notify.local.json`의 비공개 웹훅을 사용한다.</span>
- <span style="color:red">코딩 전 가정·모호함·절충안을 드러낸다. 여러 해석이 가능하면 선택지를 제시하고, 더 간단한 방법이 있으면 제안한다. 요청받지 않은 기능·추상화·설정과 불필요한 예외 처리를 추가하지 않는다.</span>
- <span style="color:red">기존 코드의 인접한 부분을 임의로 개선하지 않고 현재 스타일을 따른다. 기존 미사용 코드는 알리기만 하며, 이번 변경 때문에 미사용이 된 요소만 정리한다.</span>
- <span style="color:red">작업의 성공 기준을 검증 가능한 형태로 정하고 확인될 때까지 점검한다. 복잡한 업무 규칙과 주요 조건 분기는 한글 주석으로 설명한다. Python 모듈·클래스·함수 시작에는 목적·매개변수·반환값을 설명하는 한글 독스트링을 둔다(`Coding_Rule.md`).</span>
