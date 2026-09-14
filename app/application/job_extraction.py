"""Deterministic, multilingual-friendly extraction for Job Descriptions."""

from __future__ import annotations

import re

from app.application.profile_extraction import _collapse, _normalize_key, _unique

SECTION_KEYS = {
    "description": {"job description", "mô tả công việc", "responsibilities", "job duties", "missions", "aufgaben"},
    "requirements": {"requirements", "yêu cầu", "qualifications", "must have", "exigences", "anforderungen"},
    "preferred": {"preferred", "preferred requirements", "nice to have", "điểm cộng", "ưu tiên", "plus", "atout", "von vorteil"},
    "benefits": {"benefits", "quyền lợi", "what we offer", "avantages"},
    "other": {"thông tin khác", "other information", "additional information"},
}

TECHNOLOGIES = (
    "Python", "PyTorch", "TensorFlow", "OpenCV", "PIL/Pillow", "Machine Learning", "Deep Learning",
    "CNN", "Transformer", "LLM", "GPT", "Claude", "RAG", "LangChain", "LlamaIndex", "CrewAI",
    "Git", "Docker", "CI/CD", "FastAPI", "Flask", "Kaggle", "API",
)


def extract_job_profile(text: str) -> dict[str, object]:
    lines = _lines(text)
    sections = _split_sections(lines)
    requirement_lines = sections.get("requirements", [])
    preferred_lines = sections.get("preferred", [])
    return {
        "job_info": _job_info(lines, sections),
        "job_description": {
            "description": _collapse(" ".join(sections.get("overview", []))),
            "responsibilities": _clean_bullets(sections.get("description", [])),
        },
        "requirements": {
            "mandatory_skills": _mandatory_skills(requirement_lines),
            "experience": _matching_lines(requirement_lines, r"kinh nghiệm|thực tập|experience|internship|project|dự án"),
            "education": _matching_lines(requirement_lines, r"sinh viên|student|gpa|học lực|degree|bachelor|master"),
            "fields_of_study": _extract_fields(requirement_lines),
            "certificates": _matching_lines(requirement_lines, r"chứng chỉ|certificate|certification"),
            "languages": _matching_lines(requirement_lines, r"tiếng anh|english|language|ngoại ngữ|paper"),
            "technologies_tools": _find_technologies(requirement_lines),
        },
        "preferred_requirements": _clean_bullets(preferred_lines),
    }


def _lines(text: str) -> list[str]:
    return [re.sub(r"\s+", " ", line).strip() for line in text.replace("\r", "").split("\n") if line.strip()]


def _section_name(line: str) -> str | None:
    key = _normalize_key(line.strip(" :.-•"))
    for name, aliases in SECTION_KEYS.items():
        if key in {_normalize_key(alias) for alias in aliases}:
            return name
    return None


def _split_sections(lines: list[str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {"overview": [], "description": [], "requirements": [], "preferred": [], "benefits": [], "other": []}
    headings = [(index, _section_name(line)) for index, line in enumerate(lines) if _section_name(line)]
    requirement_index = next((index for index, name in headings if name == "requirements"), len(lines))
    # A repeated description heading separates the company overview from responsibilities.
    description_indices = [index for index, name in headings if name == "description"]
    overview_start = description_indices[0] + 1 if description_indices else 0
    task_start = description_indices[1] + 1 if len(description_indices) > 1 else overview_start
    result["overview"] = lines[overview_start:task_start - 1 if len(description_indices) > 1 else requirement_index]

    current: str | None = None
    for index, line in enumerate(lines):
        name = _section_name(line)
        if name:
            current = name
            continue
        if current in result:
            result[current].append(line)
    return result


def _clean_bullets(lines: list[str]) -> list[str]:
    return _unique(line.lstrip("•-– ").strip() for line in lines if line.strip())


def _matching_lines(lines: list[str], pattern: str) -> list[str]:
    return _clean_bullets([line for line in lines if re.search(pattern, line, re.IGNORECASE)])


def _find_technologies(lines: list[str]) -> list[str]:
    content = " ".join(lines)
    found = []
    for technology in TECHNOLOGIES:
        pattern = re.escape(technology)
        if re.search(pattern, content, re.IGNORECASE):
            found.append(technology)
    return found


def _mandatory_skills(lines: list[str]) -> list[str]:
    excluded = r"sinh viên|student|gpa|học lực|tiếng anh|english|chứng chỉ|certificate"
    return _clean_bullets([line for line in lines if not re.search(excluded, line, re.IGNORECASE)])


def _extract_fields(lines: list[str]) -> list[str]:
    fields = []
    for line in lines:
        match = re.search(r"(?:ngành|major|field(?:s)? of study)\s*[: ]\s*(.+)", line, re.IGNORECASE)
        if match:
            fields.extend(part.strip(" .") for part in re.split(r",|/| hoặc | or ", match.group(1)))
        elif re.search(r"công nghệ thông tin|khoa học máy tính|trí tuệ nhân tạo|toán.tin", line, re.IGNORECASE):
            fields.extend(re.findall(r"Công nghệ thông tin|Khoa học Máy tính|Trí tuệ Nhân tạo|Toán-Tin", line, re.IGNORECASE))
    return _unique(fields)


def _job_info(lines: list[str], sections: dict[str, list[str]]) -> dict[str, str]:
    content = " ".join(lines)
    title_match = re.search(r"(?:vị trí|position|job title)\s*[:\-]\s*([^\n|]{3,80})", content, re.IGNORECASE)
    location_match = re.search(r"(?:nơi làm việc|location|work location)\s*[:\-]?\s*(.+)", content, re.IGNORECASE)
    department_match = re.search(r"(?:phòng ban|department|đội ngũ)\s*[:\-]?\s*([A-Za-zÀ-ỹ ]{2,50})", content, re.IGNORECASE)
    level = "Intern" if re.search(r"thực tập|intern", content, re.IGNORECASE) else ""
    employment = "Full-time" if re.search(r"full.?time|toàn thời gian", content, re.IGNORECASE) else ""
    return {
        "title": title_match.group(1).strip() if title_match else "",
        "department": department_match.group(1).strip() if department_match else "",
        "level": level,
        "location": location_match.group(1).strip() if location_match else "",
        "employment_type": employment,
    }
