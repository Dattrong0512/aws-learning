# AWS Learning

Sổ tay AWS SAA-C03: 22 chuyên đề, 124 chủ đề, chỉ đọc.

- [Tiếng Việt](https://aws.trongle.tech/)
- [English](https://aws.trongle.tech/en/)

## Chạy

Repo chỉ chứa bản website tĩnh và JavaScript modules, không cần cài thư viện hoặc build.
Chạy HTTP server từ thư mục `public/`, ví dụ với Python:

```sh
python -m http.server 8000 --directory public
```

Mở `http://localhost:8000`. Nút Việt/Anh giữ chuyên đề đang xem;
tìm kiếm hỗ trợ tiếng Việt không dấu, nhiều từ khóa và cả mục đang đóng.

## Chuyên đề

IAM; IAM Advanced; EC2; EBS/EFS; Load Balancing/Auto Scaling/Beanstalk;
RDS/Aurora/ElastiCache; Purpose-Built Databases; Route 53; S3;
CloudFront/Global Accelerator; Storage Extras; SQS/SNS/Kinesis/Amazon MQ;
ECS/Fargate/ECR/EKS; Serverless; Data/Analytics; Machine Learning;
Monitoring/Audit; Security/Encryption; VPC/Hybrid Networking;
Disaster Recovery/Migrations; Well-Architected/Trusted Advisor;
Governance/Cost/Other Services.

## File

- `public/index.html`: bản tiếng Việt.
- `public/en/index.html`: bản tiếng Anh đầy đủ.
- `public/assets/`: CSS, JavaScript dùng chung và icon SVG chính thức của AWS.

Icon lấy từ [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/),
bộ phát hành ngày 31/07/2026. Các chuyên đề dùng icon dịch vụ chính hoặc nhóm dịch vụ tương ứng.

Source biên soạn, test, cấu hình deploy, backup và tài liệu tham khảo được giữ local
và không đưa lên GitHub. Không có API chỉnh sửa nội dung trên website.

## Kiểm tra bảo mật

Đã quét lịch sử commit được push bằng Gitleaks ngày 20/11/2026.
Hai cảnh báo là câu định nghĩa mã hóa trong bài KMS; chưa phát hiện credential thật.
Lịch sử commit được giữ nguyên.
