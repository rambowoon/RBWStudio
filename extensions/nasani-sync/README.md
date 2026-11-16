# Hướng Dẫn Cài Đặt Nasani Sync Extension Cho Chrome / Edge

Tiện ích giúp tự động lấy **Ngày giờ dự kiến hoàn thành**, **Mã hợp đồng**, **Link Design** từ trang quản lý `projects.nasani.vn/ky-thuat/program/list/` và đồng bộ về **RBWManager** trên máy tính.

---

### Bước 1: Mở trang quản lý Tiện ích (Extensions)
- Trên **Google Chrome**: Truy cập `chrome://extensions/`
- Trên **Microsoft Edge**: Truy cập `edge://extensions/`

### Bước 2: Bật "Chế độ dành cho nhà phát triển" (Developer mode)
- Gạt công tắc **Developer mode** ở góc trên cùng bên phải sang **ON (Bật)**.

### Bước 3: Tải tiện ích lên (Load unpacked)
1. Bấm nút **"Load unpacked"** (Tải tiện ích đã giải nén) ở góc trên bên trái.
2. Chọn thư mục:
   `D:\RBWStack\www\RBWManager\extensions\nasani-sync`
3. Nhấn **Select Folder**.

---

### Cách sử dụng:
1. Mở trang quản lý dự án công ty: `https://projects.nasani.vn/ky-thuat/program/list/`
2. Ở góc dưới cùng bên phải màn hình sẽ xuất hiện nút màu xanh:
   **`⚡ Đồng bộ ➔ RBWManager`**
3. Bấm vào nút này (hoặc bật chế độ tự động đồng bộ trong popup tiện ích), toàn bộ ngày giờ dự kiến xong sẽ được nạp về RBWManager.
4. Mở lại `http://localhost/RBWManager/`, các dự án khớp mã hợp đồng hoặc tên sẽ lập tức hiện **Badge Deadline** (còn bao nhiêu ngày/giờ, màu xanh/vàng/đỏ cảnh báo trễ hạn).
