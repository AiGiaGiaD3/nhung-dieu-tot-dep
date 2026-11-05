# Báo cáo nghiệm thu — 05/11/2026

Ứng dụng: **Những điều tốt đẹp**. Website: https://aigiagiad3.github.io/nhung-dieu-tot-dep/

## Kiểm thử đã đạt

- TypeScript không lỗi; Vite production build thành công với trang tham gia, tường, mod, quyền riêng tư và quy tắc tham gia.
- **18/18 bài unit/backend mô phỏng đạt.** Bao phủ ghép đôi, phân quyền, mã/phiên, ẩn danh, XSS, quota gửi, idempotency, xoá không hoàn lượt, khoá/ghi nguyên tử, ảnh, cache chia phần cho dữ liệu lớn và phục hồi phần bị mất, thu hồi phiên và thử lại lỗi Google Sheets tạm thời mà không tạo thư trùng.
- **3/3 kịch bản Playwright demo đạt** trên Chrome Windows; bài live được bỏ qua trong lượt demo rồi chạy riêng.
- **1/1 kịch bản E2E trên website và backend thật đạt**, khoảng 2,3 phút ở lượt mới nhất: nhập 10 người từ Excel, 10 ảnh lô, ghép một-một không tự ghép, CSV, cổng gửi, link cá nhân, ảnh riêng từ Drive, ghi tên/ẩn danh, hộp thư, PNG, ẩn thư và tường cập nhật. Không có console/page error trong kịch bản.
- Thiệp xuất thật rộng 1080px, cao tối thiểu 1350px; tường đúng 1920×1080; không cuộn ngang tại 360px; có screenshot mobile 390×844.
- Đã dọn và đối soát sạch fixture sau E2E. Test tải dùng bộ fixture riêng và sẽ dọn khi hoàn tất.
- OAuth bootstrap, Drive riêng, health và cập nhật deployment giữ nguyên URL đã được kiểm chứng.
- GitHub Actions đã xuất bản thành công. Lấy API status với nonce để tránh phản hồi HTTP cũ báo queued.
- Hai trang thông tin trả HTTP 200 và đã kiểm tra trên Chrome mobile không tràn ngang.
- Nguồn public không phát hiện mẫu secret bị cấm; .env, .local, OAuth JSON và ảnh/dữ liệu nhân sự không được commit.
- 16 WebP + JPEG Open Graph: 269.448 byte; WebP lớn nhất 44.132 byte. Không dùng logo vì chưa có file chính thức.

## Đo tải thực tế và các lỗi đã sửa

Các lần chuẩn bị tải đầu đã phát hiện quota đọc Sheets và tranh chấp bộ đếm đăng nhập. Đã thêm cache dữ liệu đã commit, khóa cache thay theo từng lần ghi, bộ đếm nhanh cho mã cá nhân và giữ giới hạn mật khẩu mod trong Properties. Đã sửa MIME gzip khi giải nén cache trong Apps Script và xác minh trực tiếp.

Lượt 100 người gửi trong 10 phút sau sửa cache: **99/100 thành công, không đạt tiêu chí 100%**. Có 3.480 lượt đọc tường, không lỗi đọc; p50 gửi thành công 2.211ms, p95 3.452ms. Một lần batchUpdate báo service currently unavailable. Đã bổ sung ánh xạ lỗi tạm thời thành BUSY để client thử lại bằng cùng requestId, kèm bài regression không tạo thư trùng. Bộ dữ liệu của lượt này đã dọn sạch.

Lượt kiểm chứng mới với 300 người/10 phút đang chạy. Chỉ công bố số liệu cuối cùng sau khi đối soát và cleanup. Test API dùng client Node có timeout/retry; không tương đương 300 thiết bị vật lý hoặc bảo đảm hạ tầng Google ở mọi thời điểm.

## Ảnh kiểm tra

- screenshots/live/mobile-390x844.png
- screenshots/live/wall-1920.png
- screenshots/live/thiep-mau.png
- screenshots/privacy-390.png và screenshots/terms-390.png
- Các ảnh demo ở screenshots/; ảnh live không đưa lên repository.

## Việc cần chủ tài khoản/thiết bị thật xác nhận

- OAuth còn Testing ở lần người dùng xác nhận gần nhất. Đang hoàn thiện Branding để chuyển In production; cần chủ tài khoản tự xác nhận và đăng nhập Google lại.
- Chưa kiểm tra trên thiết bị iPhone/Safari, Android/Zalo hoặc Wi-Fi/4G tại địa điểm sự kiện. Chrome tự động không thay thế các bước đó.
- Chưa chứng nhận gửi 100/300 yêu cầu ghi ngay trong cùng một giây; kịch bản mục tiêu là phân bố gửi trong 10 phút với các lượt đọc tường đồng thời.
