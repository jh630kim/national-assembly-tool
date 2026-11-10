# CONTEXT.md — 에이전트가 근거로 삼을 자료 목록 (필수)

이 파일은 AGENTS.md와 함께 필수 하네스 파일이다. 도구가 자동으로 읽는 파일이 아니므로 AGENTS.md 1번이 이 파일을 가리킨다. <span style="color:red">경로는 이 프로젝트 루트를 기준으로 하며, 작업 전 해당 자료의 실제 존재와 내용을 확인한다.</span>

| 자료 | 위치 | 용도 |
|---|---|---|
| 문제정의서 | 00_문제정의/problem.md | 무엇을, 왜, 어디까지 만들지 |
| 설계서 | <span style="color:red">design.md</span> | 화면·데이터·서버(/api/app) 구성<span style="color:red">. S3~S8 정의는 TBD</span> |
| 과거 접수대장 | data/요구자료_접수대장_2026국감_520건.csv | 과거 제출 이력(읽기만) |
| 처리 지침 | 처리지침.md | 접수·배분·취합·검증 업무 규칙<span style="color:red">. 현재 파일 없음; 마련되기 전까지 아래 지침재료를 읽고 최신 공지를 우선한다</span> |
| 조직도 | data/A부_조직도_26개과.csv | 배분 가능한 부서 목록(이 밖의 부서 금지) |
| 배분기준표 | data/배분기준표_소관키워드_304건.csv | 키워드 → 소관 과 규칙 |
| 시험 문항 | data/시험_요구문항_40건.csv | 배분 정확도 시험 |
| <span style="color:red">검증용 접수대장</span> | <span style="color:red">data/검증용_접수대장_120건.csv</span> | <span style="color:red">검증 시 사용하는 별도 샘플</span> |
| <span style="color:red">지침재료</span> | <span style="color:red">지침재료/00_안내.txt, 01_전임자_인수인계서_국회업무_2025.md, 02_2025국감_대응계획_메모.txt, 03_업무메일_모음_2025국감.txt, 04_과장님_구두지시_메모.txt</span> | <span style="color:red">처리지침 초안의 원천. 날짜와 출처를 비교해 최신 규칙 적용</span> |
| <span style="color:red">요구서 원문</span> | <span style="color:red">원문/의 PDF 파일 3개</span> | <span style="color:red">문항 분해와 원문 대조용 가상 자료</span> |
| <span style="color:red">부서 회신</span> | <span style="color:red">부서회신/의 XLSX 파일 6개</span> | <span style="color:red">회신 양식·취합·검사 사례</span> |
| <span style="color:red">프로젝트 규칙</span> | <span style="color:red">AGENTS.md, CLAUDE.md, Coding_Rule.md</span> | <span style="color:red">작업 순서·코딩·문서 표기 규칙</span> |

개인 툴을 만들 때는 이 표에 개인 자료(가상 샘플) 위치를 추가한다.

<span style="color:red">기준 해석: 배분은 기준표의 제외어와 큰 우선순위를 따르고, 최고 우선순위 동률·미매칭은 확인필요로 남긴다(2025-10-02 메일). 금액 단위는 천원(2025-09-15 메일), 배분 이견은 통지 후 2시간 안에 요청한다(2025-09-22 메일). AI는 문항 분해·후보 추천·누락 점검까지만 보조하며 최종 판단은 사람에게 있다(2025-12-30 메일·과장 메모).</span>
