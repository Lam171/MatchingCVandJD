from pathlib import Path

from app.application.profile_extraction import extract_cv_profile


def test_extracts_fields_from_sample_cv() -> None:
    text = (Path(__file__).parent / "textcv.txt").read_text(encoding="utf-8")
    profile = extract_cv_profile(text)

    assert profile["personal_info"]["name"] == "TRAN ANH QUANG"
    assert profile["personal_info"]["email"] == "taquangk63@gmail.com"
    assert profile["personal_info"]["location"] == "Ha Noi City, Viet Nam"
    assert "Python" in profile["skills"]
    assert "PostgreSQL" in profile["skills"]
    assert "Large Language Models (LLMs)" in profile["skills"]
    assert profile["experience"][0]["title"] == "AI Intern — iVista Technology"
    assert profile["education"][0]["title"] == "University of Transport and Communications (UTC)"
    assert profile["projects"][0]["title"] == "Bee Assistant - AI Chatbot"
    assert profile["certificates"] == []
