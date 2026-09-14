# CV–JD Matching

Hệ thống tải CV, trích xuất thông tin có cấu trúc và đánh giá mức độ phù hợp với Job Description (JD). Mục tiêu MVP là tạo kết quả **có thể giải thích được**: điểm tổng, từng tiêu chí đóng góp, kỹ năng khớp/thiếu và bằng chứng được trích từ CV.

## Phạm vi MVP

- Nhận CV/JD bằng text dán trực tiếp, TXT hoặc PDF có lớp text; hiển thị raw text trước khi phân tích.
- Trích xuất hồ sơ chuẩn hoá: thông tin cơ bản, kỹ năng, kinh nghiệm, học vấn, chứng chỉ, ngôn ngữ.
- Phân tích yêu cầu JD và phân loại bắt buộc/ưu tiên.
- Tính điểm theo các nhóm kỹ năng, kinh nghiệm, học vấn/ngôn ngữ; trả về lý do và các kỹ năng còn thiếu.
- Lưu hồ sơ, tệp gốc (cục bộ ở môi trường phát triển) và kết quả phân tích.

MVP **không** tự động loại ứng viên, không suy luận thuộc tính nhạy cảm (tuổi, giới tính, dân tộc, tôn giáo, tình trạng hôn nhân...) và luôn coi điểm số là công cụ hỗ trợ người tuyển dụng.

## Kiến trúc

```text
Client / Admin UI
       │ HTTP
       ▼
FastAPI routers ──► application services ──► domain (CV, JD, scoring)
       │                       │                    │
       │                       ▼                    ▼
       └────────────► adapters: parser, OCR, NLP/LLM, repository
                                           │
                                      PostgreSQL / Object storage
```

Luồng xử lý MVP: `upload/dán text → kiểm tra tệp → trích raw text → hiển thị text → chuẩn hoá schema → phân tích JD → matching → trả kết quả`. Chỉ nhận TXT, Word `.docx` và PDF có lớp text; PDF scan/ảnh không được trích text trong MVP vì không dùng OCR.

## Cấu trúc thư mục

```text
.
├── app/
│   ├── api/                 # HTTP routers, request/response schemas, dependency injection
│   ├── application/         # Use-cases: ingest CV, parse JD, run matching
│   ├── core/                # Settings, logging, security, exception handlers
│   ├── domain/              # Entity/value objects, interfaces, scoring thuần nghiệp vụ
│   ├── infrastructure/      # SQLAlchemy, storage, parser PDF/DOCX, OCR, LLM clients
│   ├── workers/             # Background jobs khi xử lý tệp lớn
│   └── main.py              # FastAPI application factory
├── tests/                   # unit / integration / e2e tests, không dùng dữ liệu CV thật
├── alembic/                 # Database migrations
├── docs/                    # Roadmap, kiến trúc, API contract, quyết định kỹ thuật
├── scripts/                 # Seed dữ liệu giả, tác vụ phát triển lặp lại được
├── pyproject.toml           # Dependencies, tooling và cấu hình Python
├── docker-compose.yml       # API + PostgreSQL (và Redis khi bật worker)
└── README.md
```

## Công nghệ đề xuất

| Nhu cầu | Lựa chọn MVP | Lý do |
| --- | --- | --- |
| API | FastAPI + Pydantic | Type-safe, có OpenAPI sẵn |
| DB | PostgreSQL + SQLAlchemy + Alembic | Dữ liệu quan hệ, truy vết phiên bản kết quả |
| Đọc tài liệu | PyMuPDF | Trích text từ digital PDF |
| OCR (sau MVP) | Tesseract/pytesseract | Cần thiết nếu muốn ảnh/PDF scan → text |
| NLP | spaCy + RapidFuzz | Chuẩn hoá và so khớp có giải thích được |
| Semantic matching (giai đoạn 2) | sentence-transformers | Bổ sung ngữ nghĩa, không thay thế luật |
| Queue (khi cần) | Redis + Celery | Tách OCR/LLM dài khỏi request HTTP |
| Test/quality | pytest, ruff, mypy | Giữ chất lượng khi mở rộng |

Không nên gọi LLM trực tiếp trong router. Nếu dùng LLM, chỉ dùng ở adapter để tạo cấu trúc theo JSON Schema, lưu prompt/model/version và luôn có đường fallback dựa trên rule.

## Khởi động

Yêu cầu: Python 3.11+, Docker Desktop (nếu chạy PostgreSQL qua Docker). Tesseract chỉ cần khi bật OCR cho CV scan.

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
#docker compose up -d db
uvicorn app.main:app --reload
```

Sau khi scaffold API hoàn chỉnh, tài liệu tương tác sẽ ở `http://localhost:8000/docs`.

## Nguyên tắc scoring

Điểm phải cấu hình được theo vị trí, mặc định: kỹ năng bắt buộc 45%, kinh nghiệm 30%, kỹ năng ưu tiên 15%, học vấn/chứng chỉ/ngôn ngữ 10%. Một yêu cầu bắt buộc không đạt sẽ được đánh dấu `blocker`; không nên âm thầm bù bằng điểm từ tiêu chí khác. Mỗi điểm cần trả về `evidence` (đoạn text/trường CV nguồn), `confidence` và `matcher_version`.

## Bảo mật & dữ liệu cá nhân

- CV là PII: mã hoá khi lưu, dùng URL tải lên có thời hạn, RBAC và audit log cho thao tác xem/tải xuống.
- Không commit CV/JD thật, token API hoặc file `.env`.
- Đặt thời hạn xoá tệp, hỗ trợ xoá ứng viên theo yêu cầu và chỉ lưu tối thiểu dữ liệu cần thiết.
- Kiểm thử với dữ liệu tổng hợp/đã ẩn danh.

Chi tiết triển khai theo giai đoạn ở [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md) và các quyết định kiến trúc ở [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
