# Architecture Decisions

## Bounded contexts

- **Document ingestion:** nhận, kiểm tra và trích text từ file; không hiểu nghiệp vụ tuyển dụng.
- **Profile/JD extraction:** biến text thành schema chuẩn hoá, gắn evidence và confidence.
- **Matching:** hàm nghiệp vụ thuần, đầu vào là hai schema chuẩn hoá; không gọi DB, OCR hay LLM.
- **Delivery:** API/UI chỉ xác thực, điều phối use-case và trình bày kết quả.

Sự tách biệt này giúp test scoring bằng JSON fixture và thay parser/LLM không ảnh hưởng endpoint.

## Data model tối thiểu

| Entity | Trường cốt lõi |
| --- | --- |
| `candidate` | id, tenant_id, consent_at, retention_until |
| `document` | id, candidate_id, object_key, sha256, mime_type, parse_status |
| `candidate_profile` | document_id, schema_version, extracted_json, confidence |
| `job_description` | id, tenant_id, title, raw_text, normalized_json, version |
| `match_run` | id, profile_id, jd_id, matcher_version, config_version, total_score, status |
| `match_factor` | match_run_id, criterion, score, weight, evidence_json, is_blocker |
| `audit_event` | actor_id, action, resource_type, resource_id, created_at |

`tenant_id` nên xuất hiện trên mọi entity nghiệp vụ ngay từ đầu nếu hệ thống có nhiều công ty/phòng ban.

## API contract khởi đầu

```text
POST /v1/candidates/{candidate_id}/documents     # upload CV
POST /v1/job-descriptions                        # tạo JD
POST /v1/matches                                 # {profile_id, job_description_id}
GET  /v1/matches/{match_id}                      # score + breakdown + evidence
GET  /health                                     # liveness/readiness
```

Upload và matching trả `202 Accepted` khi xử lý async. Client polling `GET` kết quả; sau này có thể thêm webhook mà không phá vỡ contract.

## Quy ước kỹ thuật

- UTC ISO-8601 cho thời gian, UUID cho public IDs; không đưa đường dẫn storage thẳng ra API.
- Mọi payload extraction/matching có `schema_version`, `matcher_version`, `config_version`.
- Các score nằm trong `[0, 100]`; không dùng float chưa làm tròn khi so sánh/ranking.
- Log có `request_id`, nhưng tuyệt đối không log nội dung CV, email, số điện thoại hoặc access token.
- Parser, repository, object storage và model provider được phụ thuộc qua interface trong `domain/`.

## Chỉ số cần theo dõi

`parse_success_rate`, `parse_duration_seconds`, `match_duration_seconds`, `ocr_queue_depth`, tỉ lệ confidence thấp, error rate theo loại file và ranking metrics trên tập đánh giá đã ẩn danh.
