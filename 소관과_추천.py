"""요구 문항의 소관 과 후보를 기준표에서 찾는다.

매개변수: 없음.
반환값: 없음.
"""

import csv
from pathlib import Path


기준표 = Path(__file__).parent / "data" / "배분기준표_소관키워드_304건.csv"
조직도 = Path(__file__).parent / "data" / "A부_조직도_26개과.csv"


def 소관과_추천(요구문항: str) -> str:
    """문항의 최고 우선순위 소관 과를 추천한다.

    매개변수: 요구문항(str) — 배분할 요구 문항 한 개.
    반환값: str — 소관 과 이름 또는 후보를 포함한 확인필요 표시.
    """
    with 조직도.open(encoding="utf-8-sig", newline="") as 파일:
        허용과 = {행["과"] for 행 in csv.DictReader(파일)}

    후보 = {}
    with 기준표.open(encoding="utf-8-sig", newline="") as 파일:
        for 규칙 in csv.DictReader(파일):
            과 = 규칙["과"]
            키워드 = 규칙["키워드"].strip()
            제외어 = 규칙["제외어"].split("|") if 규칙["제외어"] else []
            if 과 not in 허용과 or not 키워드 or 키워드 not in 요구문항:
                continue
            # 제외어가 문항에 있으면 그 규칙은 후보에서 뺀다.
            if any(단어.strip() in 요구문항 for 단어 in 제외어 if 단어.strip()):
                continue
            후보[과] = max(후보.get(과, 0), int(규칙["우선순위"]))

    if not 후보:
        return "확인필요"
    최고순위 = max(후보.values())
    최고후보 = sorted(과 for 과, 순위 in 후보.items() if 순위 == 최고순위)
    # 최고 우선순위가 동률이면 사람이 주관 과를 결정하도록 모두 표시한다.
    return 최고후보[0] if len(최고후보) == 1 else "확인필요 (" + ", ".join(최고후보) + ")"
