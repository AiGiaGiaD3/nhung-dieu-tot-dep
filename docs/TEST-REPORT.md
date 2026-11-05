# Kết quả kiểm thử Những điều tốt đẹp

Tên ứng dụng đã đổi thành **Những điều tốt đẹp** theo yêu cầu đã duyệt.

## Đã chạy và đạt

- TypeScript: `tsc --noEmit` không lỗi.
- Build Vite demo thành công, ba entry người tham gia / tường / mod.
- Build Apps Script thành công. Bản bundle dùng verifier bcrypt đồng bộ; đã xử lý việc Apps Script không có timer trình duyệt.
- **16/16 bài unit và backend mô phỏng đạt.** Có thêm kiểm tra cache giảm đọc Sheet và mã bị thu hồi không được dùng lại. Bao gồm ghép 2/3/10/100/300 người, không tự ghép và nhận đúng một lần; TSV và tên ảnh mơ hồ; phân quyền; ẩn danh; chống ghi trùng; giới hạn gửi; hết hạn; ghép lại; xoá không hoàn lượt; chữ ký phiên; giả mạo token; lỗi ghi Sheet và cleanup ảnh; giới hạn đăng nhập.
- **3/3 kịch bản Playwright demo đạt** trên Chrome Windows. Bài live được skip có chủ đích vì chưa deploy, không phải kết quả pass live.
- Luồng người tham gia: link riêng → mở phong thư → gửi ghi tên → người nhận thấy thư → tải PNG. Gửi thêm ẩn danh và nhập payload HTML độc hại: hiển thị như văn bản, không chạy script.
- Luồng mod: nhập TSV từ Excel → upload nhiều ảnh theo mã/tên → ghép → kiểm tra mỗi người nhận một lần → CSV/QR → mở/đóng cổng → ẩn lời chúc → tường ở tab khác gỡ nội dung.
- Trang chào, hộp thư, màn chiếu: kiểm tra console/page errors trong các kịch bản, trạng thái mã sai, reduced motion và kiểm tra không cuộn ngang ở 360px.
- Thiệp PNG thực sự được tải và giải mã: rộng 1080px, cao tối thiểu 1350px. Đã sửa xuống dòng theo từ để không tách dấu/âm tiết tiếng Việt ở rìa.
- Bức tường được chụp và kiểm tra đúng **1920×1080**, không vượt chiều cao màn hình. Có thêm ảnh viewport mobile đúng **390×844** và ảnh toàn trang.
- Kiểm tra secret tĩnh trên nguồn public không phát hiện mẫu token/private key bị cấm.
- 16 ảnh WebP + 1 JPEG Open Graph tổng **269.448 byte**, thấp hơn 1,5MB. Ảnh WebP lớn nhất là hero 44.132 byte; mọi nền dưới 250KB.

## Ảnh để duyệt

Trong `screenshots/`:

- `00-trang-chao-1440.png`: trang chào desktop.
- `01-trang-chao-390.png`: trang chào mobile toàn trang.
- `02-phong-thu-390.png`: trước khi mở phong thư.
- `03-nguoi-dong-hanh-390.png`: người được ghép.
- `mobile-390x844.png`: khung mobile chính xác 390×844.
- `04-viet-loi-chuc-390.png`: viết và chọn ghi tên/ẩn danh.
- `05-gui-thanh-cong-390.png`: gửi thành công.
- `06-hop-thu-390.png`: hộp thư.
- `07-buc-tuong-1920.png`: màn chiếu 1920×1080.
- `08-mod-tong-quan-1440.png`: tổng quan mod.
- `thiep-mau.png`: PNG do chính ứng dụng xuất.

## Chưa chạy — phải làm ở Bước 3

- Google Sheet/Drive/Apps Script thật; bootstrap OAuth, CORS/redirect từ GitHub Pages, quyền ảnh riêng và API executable.
- GitHub Actions Pages, kiểm tra URL backend không đổi sau redeploy.
- Bộ live E2E và bài tải 100 người trong 10 phút, 100/300 người đồng thời. Backend mock không chứng minh được quota hay throughput Google.
- iPhone/Safari, Android, Zalo, preview OG thực tế và mạng Wi-Fi sự kiện/4G.
- QR public dùng in poster. QR trong demo localhost chỉ dùng kiểm tra bố cục, không phải QR để phát cho người tham gia.
- Logo chính thức chưa có, nên chưa chèn logo.

## Cập nhật triển khai 05/11/2026

- GitHub CLI và Google OAuth đã kết nối; Sheet và thư mục ảnh riêng chỉ có quyền chủ sở hữu.
- Backend đã bootstrap qua API chủ sở hữu và health trả initialized. Đã cập nhật backend một lần, đối chiếu URL không thay đổi.
- Cả ba trang Pages trả HTTP 200; Chrome không thấy banner demo, lỗi console hay tràn ngang trong kiểm tra mở trang.
- Lần tải đầu tiên tạo 100 người mẫu rồi lỗi ở bước chuẩn bị phiên, trước khi gửi. Đã dọn đủ 100 bản ghi và ảnh mẫu. Đây là lần thử không đạt, không tính thành chứng nhận tải.
- Đã bổ sung cache trạng thái đã commit, đang chạy lại bài tải 100 người/10 phút. Luồng E2E thật và số liệu tải sẽ được cập nhật khi có kết quả.
