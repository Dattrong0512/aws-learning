# AWS Learning

Sổ tay AWS SAA-C03 gồm 22 chuyên đề và 124 chủ đề. Tiếng Việt là mặc định;
bản tiếng Anh có đầy đủ nội dung tương ứng. Website chỉ đọc, hỗ trợ tìm kiếm,
mục lục, lọc chuyên đề và mở/thu gọn bài học.

- [Tiếng Việt](https://aws-learning.flexmoney.workers.dev/)
- [English](https://aws-learning.flexmoney.workers.dev/en/)
- Domain dự kiến: `aws.trongle.tech`, sau khi chuyển DNS sang Cloudflare.

## Chạy trên máy

Cần Node.js 22 trở lên.

```sh
node tools/build-site.mjs
npx --yes wrangler@4.128.0 login
npx --yes wrangler@4.128.0 dev
```

Mở `http://localhost:8788`. Trên Windows có thể dùng `Start AWS Learning.cmd`;
`Enable Auto-Start.cmd` bật chạy nền khi đăng nhập và `Stop AWS Learning.cmd` dừng máy chủ.

## Cấu trúc và sửa nội dung

| Thư mục | Nội dung |
| --- | --- |
| `content/vi/` | Bài học tiếng Việt, mỗi chuyên đề một file HTML |
| `content/en/` | Bản tiếng Anh cùng tên file và khóa chủ đề |
| `content/catalog.json` | Danh sách chuyên đề, nhóm và nhãn Việt/Anh |
| `src/client/` | Khởi tạo trang, điều hướng/mục lục, tìm kiếm và ngôn ngữ |
| `src/templates/`, `src/styles/` | Template dùng chung, nhãn giao diện và CSS |
| `src/worker.js` | Phục vụ website và API tương thích chỉ đọc |
| `tools/` | Build, kiểm tra và công cụ bảo trì local |
| `public/` | Kết quả build, không commit hoặc sửa trực tiếp |

Sửa file trong `content/vi/` và cập nhật bản tương ứng trong `content/en/`, rồi build lại.
Giữ nguyên `data-track`, `data-progress-aliases` và tên file khi chỉ sửa nội dung.
Tên dịch vụ, câu lệnh và ví dụ cấu hình được giữ trong ngôn ngữ kỹ thuật gốc.
Không thêm icon trang trí hoặc link trích dẫn `AWS: ...` vào cuối đoạn.

Nút ngôn ngữ chuyển giữa `/` và `/en/`, giữ chuyên đề đang xem qua hash.
Không gọi dịch vụ dịch thuật khi người dùng mở trang.

## Các chuyên đề

1. IAM
2. IAM nâng cao: Organizations, SCP, Identity Center và federation
3. EC2
4. EBS và EFS
5. Load Balancing, Auto Scaling và Elastic Beanstalk
6. RDS, Aurora và ElastiCache
7. Purpose-Built Databases
8. Route 53 và Hybrid DNS
9. Amazon S3
10. CloudFront và Global Accelerator
11. AWS Storage Extras
12. SQS, SNS, Kinesis và Amazon MQ
13. ECS, Fargate, ECR và EKS
14. Serverless: Lambda, DynamoDB, API Gateway, Cognito và AppSync
15. Data và Analytics
16. Machine Learning và AI
17. Monitoring, Audit và Observability
18. Security, Encryption và Threat Detection
19. Networking và Hybrid VPC
20. Disaster Recovery và Migrations
21. Well-Architected và Trusted Advisor
22. Governance, Cost và Other Services

## Kiểm tra và deploy

```sh
node tools/build-site.mjs
node tools/validate-content.mjs
node --test tools/*.test.mjs
git diff --check
npx --yes wrangler@4.128.0 deploy
```

Wrangler tự build trước khi chạy local hoặc deploy. `Deploy AWS Learning.cmd`
chạy build và test trước khi xuất bản. Dùng Wrangler phiên bản đã pin.

Namespace KV cũ được giữ nguyên. `GET/HEAD /api/content` vẫn đọc được snapshot cũ;
các phương thức ghi trả `405`. Website dùng nội dung đã build, không ghi vào KV.
`/Exam` và các trang bên dưới đã gỡ bỏ, trả `410`; `/all.html` chuyển về trang chính.

## Domain

Sao lưu DNS tại nhà đăng ký, chuyển đầy đủ bản ghi đang dùng sang zone Cloudflare Free,
kiểm tra DNSSEC rồi đổi nameserver. Khi zone hoạt động, thêm cấu hình sau vào Wrangler
và deploy lại để gắn domain vào Worker hiện tại:

```json
"routes": [{ "pattern": "aws.trongle.tech", "custom_domain": true }]
```

Giữ URL `workers.dev` hoạt động trong lúc chuyển DNS.

## Bảo mật repo

Đã kiểm tra lịch sử Git bằng Gitleaks 8.30.1 ngày 20/11/2026, không phát hiện secret bị lộ.
Các chuỗi access key minh họa của AWS không phải credential thật.
Không commit `.env`, `.dev.vars`, token, backup, cache hoặc cấu hình riêng của máy.
Đăng nhập Cloudflare qua Wrangler; secret thực tế dùng `wrangler secret put`.
