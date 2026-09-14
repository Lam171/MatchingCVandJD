from pathlib import Path

from app.application.job_extraction import extract_job_profile


def test_extracts_fields_from_sample_jd() -> None:
    text = (Path(__file__).parent / "testjd.txt").read_text(encoding="utf-8")
    profile = extract_job_profile(text)

    assert profile["job_info"]["level"] == "Intern"
    assert "Python" in profile["requirements"]["technologies_tools"]
    assert "PyTorch" in profile["requirements"]["technologies_tools"]
    assert profile["requirements"]["languages"]
    assert profile["preferred_requirements"]
