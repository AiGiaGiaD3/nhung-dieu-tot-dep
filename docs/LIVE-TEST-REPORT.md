# Nghiệm thu website thật — 05/11/2026

Website: https://aigiagiad3.github.io/nhung-dieu-tot-dep/

Bài Playwright live đã chạy trên Chrome Windows với GitHub Pages và Google Apps Script thật. Không giả lập response backend. Request nhập 10 người hư cấu được gắn isDemo để dọn an toàn sau kiểm thử.

- 1 bài đạt; 0 bài lỗi; 0 bài bỏ qua.
- Nhập danh sách Excel, tải 10 ảnh theo mã nhân viên/họ tên, ghép đôi và đối soát một người nhận đúng một lần.
- Xuất CSV mã cá nhân, mở cổng, đăng nhập bằng link riêng, gửi lời ghi tên và ẩn danh, đọc hộp thư, tải/giải mã PNG.
- API tường không lộ tên người gửi ẩn danh; payload HTML hiển thị như văn bản.
- Mod ẩn lời chúc và tường tự gỡ; không có console/page error trong kịch bản.
- Thiệp PNG rộng 1080; màn chiếu đúng 1920×1080; kiểm tra không cuộn ngang tại 360px.
- Đã đối soát sạch người mẫu, lời chúc và phân công sau khi test.

Ảnh và thiệp ở screenshots/live/ trên máy; không đưa screenshot có dữ liệu thực lên repository.

Phần đo tải tách riêng, chưa tính kết quả E2E này là chứng nhận 100–300 người đồng thời. Safari/iPhone, Android/Zalo và mạng sự kiện chưa được kiểm tra trực tiếp.
