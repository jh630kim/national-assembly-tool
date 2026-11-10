"""자료요구서 PDF를 문항별 CSV로 분리한다.

매개변수: 없음. 반환값: 없음. 실행하면 원문 PDF를 읽고 새 CSV를 만든다.
"""

import csv
import re
from pathlib import Path

from pypdf import PdfReader


class QuestionSplitter:
    """원문의 문항 경계를 판별하고 CSV 행을 만든다.

    매개변수: 없음. 반환값: 없음.
    """

    columns = ("파일명", "위원회", "의원", "제출기한", "문항번호", "요구내용", "세부항목", "비고")

    def split(self, path: Path) -> list[dict[str, str]]:
        """PDF 한 건을 문항 행으로 나눈다.

        매개변수: path(읽을 PDF 경로). 반환값: 문항별 CSV 행 목록.
        """
        text = "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        header = re.fullmatch(r"(.+위원회)\s+(.+?)\s+의원실 자료요구서", lines[0])
        deadline = next((re.search(r"제출기한:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.", line)
                         for line in lines if line.startswith("수신:")), None)
        if not header or not deadline:
            raise ValueError(f"머리글 또는 제출기한을 읽지 못했습니다: {path.name}")
        date = f"{int(deadline[1]):04d}-{int(deadline[2]):02d}-{int(deadline[3]):02d}"
        common = dict(zip(self.columns[:4], (path.name, header[1], header[2], date)))
        rows: list[dict[str, str]] = []
        field = "요구내용"
        for line in lines[1:]:
            if line.startswith(("수신:", "담당 보좌관:")) or line == "끝.":
                continue
            number = re.match(r"^(\d+)\.\s*(.*)$", line)
            subitem = re.match(r"^([가-힣])\.\s*(.*)$", line)
            if number:
                rows.append({**common, "문항번호": number[1], "요구내용": number[2],
                             "세부항목": "", "비고": ""})
                field = "요구내용"
            elif not rows:
                raise ValueError(f"첫 문항 앞에 해석할 수 없는 줄이 있습니다: {path.name}: {line}")
            elif subitem:
                field = "세부항목"
                rows[-1][field] += (" / " if rows[-1][field] else "") + line
            elif line.startswith("※"):
                field = "비고"
                rows[-1][field] += (" / " if rows[-1][field] else "") + line.removeprefix("※").strip()
            else:
                # 새 경계가 없으면 바로 앞 내용, 세부항목 또는 비고의 연속 줄이다.
                rows[-1][field] += " " + line
        return rows


def main() -> None:
    """PDF 3건을 검증한 뒤 UTF-8 BOM CSV를 새로 만든다.

    매개변수: 없음. 반환값: 없음.
    """
    source = Path(__file__).parent / "원문"
    output = Path(__file__).parent / "data" / "문항목록.csv"
    if output.exists():
        raise FileExistsError(f"기존 파일을 덮어쓰지 않습니다: {output}")
    paths = sorted(source.glob("*.pdf"))
    if len(paths) != 3:
        raise ValueError(f"PDF 3건이 필요합니다. 현재 {len(paths)}건")
    splitter = QuestionSplitter()
    all_rows = []
    print("파일명 | 파일명의 문항 수 | 뽑은 문항 수 | 마지막 번호 | 번호 연속 | 일치(O/X)")
    for path in paths:
        match = re.search(r"_(\d+)문항\.pdf$", path.name)
        if not match:
            raise ValueError(f"파일명에서 문항 수를 찾지 못했습니다: {path.name}")
        rows = splitter.split(path)
        numbers = [int(row["문항번호"]) for row in rows]
        continuous = numbers == list(range(1, len(rows) + 1))
        matched = len(rows) == int(match[1]) and continuous
        print(f"{path.name} | {match[1]} | {len(rows)} | {numbers[-1] if numbers else '-'} | "
              f"{'O' if continuous else 'X'} | {'O' if matched else 'X'}")
        if not matched:
            raise ValueError(f"문항 수 또는 번호가 원문과 일치하지 않습니다: {path.name}")
        all_rows.extend(rows)
    with output.open("x", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=splitter.columns)
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"저장: {output} ({len(all_rows)}문항)")


if __name__ == "__main__":
    main()
