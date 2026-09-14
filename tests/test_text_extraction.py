from app.application.text_extraction import extract_text


def test_extracts_utf8_text() -> None:
    text, method = extract_text("Kỹ sư Python có 3 năm kinh nghiệm".encode(), "candidate.txt")

    assert text == "Kỹ sư Python có 3 năm kinh nghiệm"
    assert method == "plain_text"
