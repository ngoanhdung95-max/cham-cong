# ỨNG DỤNG CHẤM CÔNG THEO GIỜ & HỆ THỐNG MULTI-LAUNCHER WEB OS

> **Mô tả:** Web App chấm công theo tiếng hằng ngày dành cho vợ đi làm thêm (ghi nhận giờ đến, giờ về, tự động tính tổng giờ và tiền công), tích hợp hệ thống **Multi-Launcher 5 phong cách giao diện** thay đổi toàn diện (3D Skeuomorphic, Cute Pastel Bouncy, Glassmorphism, Neumorphism, Cyberpunk Dark Mode) và lưu trữ đồng bộ bảo mật qua **Google Drive API (appDataFolder)**.

---

## 🌟 TÍNH NĂNG NỔI BẬT

### 1. Hệ Thống Multi-Launcher 5 Phong Cách Độc Bản
Chỉ với 1 click trong menu Cài đặt, toàn bộ ứng dụng sẽ biến đổi cấu trúc CSS, độ bóng, viền, hình khối và bảng màu bằng hệ thống CSS Variables:
- **Launcher 1: 3D / Skeuomorphic (Giao diện chính mặc định):** Khối nổi 3D chân thực, hiệu ứng ánh sáng bề mặt (specular highlight), đổ bóng sâu đa lớp (deep shadows), xúc giác bấm chân thực, chừa sẵn layout để chèn icon 3D.
- **Launcher 2: Cute & Romantic (Dễ thương dành cho vợ yêu):** Bảng màu pastel ngọt ngào (hồng phấn, cam đào, sữa dâu), góc bo tròn mềm mại (pill-shape), hiệu ứng hover nhún nhảy (bouncy spring) và các sticker trái tim/đám mây lơ lửng bằng CSS animation.
- **Launcher 3: Glassmorphism (Hiệu ứng kính mờ):** Độ trong suốt cao với `backdrop-filter: blur(25px)`, viền mỏng xuyên thấu và hiệu ứng cực quang (Aurora mesh) lung linh di chuyển ở nền.
- **Launcher 4: Neumorphism (Dập nổi / Khoét chìm Soft UI):** Bề mặt mịn màng không viền thô, tương tác ánh sáng kép 2 chiều (dual-source shadows) tạo độ lồi lõm vật lý mượt mà.
- **Launcher 5: Cyberpunk Dark Mode:** Nền đen OLED tuyệt đối, neon Cyan và Magenta chói sáng, viền vát góc công nghệ (chamfered borders) và scanlines quét màn hình.

### 2. Tính Năng Chấm Công Theo Giờ Hằng Ngày (Giờ Đến - Giờ Về)
- **Nút Chấm Công 1 Chạm:** Bấm **"BẮT ĐẦU VÀO CA"** khi đến nơi làm -> Đồng hồ đếm giờ làm việc tự động chạy theo giây/phút/giờ. Bấm **"HOÀN THÀNH - TAN CA"** khi về để tự động chốt giờ và tính tiền lương.
- **Tùy chỉnh Mức Lương/Giờ:** Dễ dàng cài đặt mức thù lao (VD: 25.000đ/h, 30.000đ/h, 45.000đ/h...), có thể thay đổi bất cứ lúc nào.
- **Ghi công bổ sung:** Nếu vợ quên bấm giờ vào/ra, có sẵn form nhập bổ sung ngày làm, giờ đến, giờ về và ghi chú (VD: Làm ca tối, tăng ca dọn dẹp...).
- **Xuất Báo Cáo Gửi Chủ Quán:** 1 chạm để sao chép toàn bộ bảng kê công chi tiết và tổng tiền lương ra clipboard để gửi ngay qua Zalo/Tin nhắn cho nơi làm việc.

### 3. Đồng Bộ & Lưu Trữ Dữ Liệu An Toàn Qua Google Drive API
- Sử dụng thư mục ẩn `appDataFolder` trên Google Drive của người dùng để lưu file `cham_cong_data.json` bảo mật tuyệt đối, chỉ ứng dụng này mới truy cập được và không làm rác thùng thư Drive.
- Hỗ trợ lưu trữ cục bộ qua `localStorage` (không lo mất khi F5 hoặc tắt trình duyệt).
- Hỗ trợ nút **Tải File JSON Dự Phòng** và **Nhập File JSON** trực tiếp không cần mạng Internet.

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY ỨNG DỤNG

### Cách 1: Chạy trực tiếp (Nhanh nhất)
1. Mở thư mục dự án trên máy tính: `c:\Users\Admin\Desktop\APP CHÂM CÔNG`
2. Nhấp đúp chuột vào file `index.html` để mở ngay trên trình duyệt (Chrome, Cốc Cốc, Edge...).

### Cách 2: Chạy qua Local Web Server (Khuyên dùng khi test Google Drive OAuth)
Nhấp đúp vào file `Chay_Ung_Dung.bat` hoặc mở PowerShell trong thư mục này và gõ:
```powershell
python -m http.server 8080
```
Sau đó truy cập: `http://localhost:8080` trên trình duyệt.

---

## ⚙️ HƯỚNG DẪN CẤU HÌNH GOOGLE DRIVE API (TÙY CHỌN)
*(Lưu ý: Ứng dụng đã kích hoạt sẵn chế độ Local Sync + Xuất/Nhập file JSON để bạn dùng được ngay mà không bắt buộc phải tạo Google Cloud project).*

Nếu bạn muốn đồng bộ dữ liệu đám mây qua tài khoản Google Drive:
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo một Dự án mới.
2. Vào **APIs & Services** > **Library**, tìm **Google Drive API** và bấm **Enable**.
3. Vào **APIs & Services** > **OAuth consent screen**:
   - Chọn **External**, điền tên ứng dụng (VD: *App Chấm Công*), email liên hệ.
   - Thêm Scope: `https://www.googleapis.com/auth/drive.appdata`.
4. Vào **APIs & Services** > **Credentials**:
   - Bấm **Create Credentials** > **OAuth Client ID**.
   - Application type: **Web application**.
   - Tại mục **Authorized JavaScript origins**, thêm: `http://localhost:8080` và `http://127.0.0.1:8080`.
5. Sao chép chuỗi **Client ID** (dạng `xxx.apps.googleusercontent.com`).
6. Mở ứng dụng, vào **Cài Đặt Launcher** > Tab **Lưu Trữ Google Drive**, dán Client ID vào và bấm **Lưu Client ID**.
7. Bấm **Kết Nối Google Drive** để cấp quyền. Dữ liệu sẽ tự động đồng bộ lên Drive mỗi khi bạn tan ca!

---

## 📁 CẤU TRÚC MÃ NGUỒN
```text
APP CHÂM CÔNG/
├── index.html            # Khung giao diện chính (Status bar, Hero Widget, App Grid, Dock, Modals)
├── css/
│   ├── style.css         # CSS bố cục, responsive, table nhật ký, khung mobile/desktop
│   └── themes.css        # 5 phong cách Launcher độc bản bằng CSS Variables & Animation
├── js/
│   ├── launcher.js       # Bộ điều khiển: chuyển đổi 5 Theme, đếm giờ, tính lương, localStorage
│   └── google-drive.js   # Module kết nối Google Drive API v3 (appDataFolder, tạo/đọc/cập nhật JSON)
├── Chay_Ung_Dung.bat     # File bấm chạy nhanh trên Windows
└── README.md             # Hướng dẫn chi tiết
```
