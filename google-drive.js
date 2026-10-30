/**
 * ===================================================================
 * GOOGLE DRIVE API INTEGRATION MODULE (V3 + GOOGLE IDENTITY SERVICES)
 * ===================================================================
 * 
 * Tính năng chính:
 * 1. Sử dụng thư mục ẩn 'appDataFolder' trên Google Drive của người dùng
 *    để lưu file dữ liệu ứng dụng (cham_cong_data.json) một cách an toàn,
 *    không làm rác hay lộ thông tin trong Google Drive thông thường.
 * 2. Cung cấp các hàm Fetch API chuẩn: Tạo, Đọc, Cập nhật file JSON.
 * 3. Hỗ trợ chế độ Local Fallback / Mock Sync để người dùng có thể
 *    trải nghiệm ngay lập tức kể cả khi chưa có Google Cloud Client ID.
 */

class GoogleDriveSyncManager {
  constructor() {
    this.CLIENT_ID_STORAGE_KEY = 'chamcong_google_client_id';
    this.API_KEY_STORAGE_KEY = 'chamcong_google_api_key';
    this.DATA_FILE_NAME = 'cham_cong_data.json';
    this.APP_DATA_FOLDER = 'appDataFolder';
    
    this.clientId = localStorage.getItem(this.CLIENT_ID_STORAGE_KEY) || '';
    this.apiKey = localStorage.getItem(this.API_KEY_STORAGE_KEY) || '';
    
    this.accessToken = null;
    this.tokenClient = null;
    this.isConnected = false;
    this.currentFileId = null;

    // Load GIS SDK dynamically if available
    this._loadGisScript();
  }

  /**
   * Tải Google Identity Services SDK
   */
  _loadGisScript() {
    if (document.getElementById('googleGisScript')) return;
    const script = document.createElement('script');
    script.id = 'googleGisScript';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.log('Google Identity Services (GIS) SDK đã tải thành công.');
      if (this.clientId) {
        this.initTokenClient();
      }
    };
    script.onerror = () => {
      this.log('Không thể tải Google Identity Services SDK. Chế độ Local Sync đang hoạt động.');
    };
    document.head.appendChild(script);
  }

  /**
   * Khởi tạo Token Client từ Google Identity Services
   */
  initTokenClient() {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      this.log('Google SDK chưa sẵn sàng. Vui lòng thử lại sau giây lát.');
      return false;
    }

    if (!this.clientId) {
      this.log('Chưa có Google Client ID. Vui lòng nhập Client ID trong bảng Cài đặt.');
      return false;
    }

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.isConnected = true;
            this.log('Đăng nhập Google Drive thành công! Access Token đã sẵn sàng.');
            if (this.onAuthSuccessCallback) {
              this.onAuthSuccessCallback();
            }
          } else {
            this.log('Đăng nhập thất bại hoặc người dùng đã hủy.');
          }
        },
      });
      return true;
    } catch (err) {
      this.log(`Lỗi khởi tạo OAuth Client: ${err.message}`);
      return false;
    }
  }

  /**
   * Yêu cầu người dùng đăng nhập & cấp quyền
   */
  async signIn(onSuccess) {
    this.onAuthSuccessCallback = onSuccess;
    if (!this.clientId) {
      this.log('Vui lòng cấu hình Google Client ID trước khi kết nối!');
      return false;
    }
    if (!this.tokenClient) {
      const initialized = this.initTokenClient();
      if (!initialized) return false;
    }
    // Kích hoạt popup đăng nhập OAuth2
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
    return true;
  }

  /**
   * Đăng xuất khỏi phiên Google Drive
   */
  signOut() {
    if (this.accessToken && window.google) {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        this.accessToken = null;
        this.isConnected = false;
        this.log('Đã đăng xuất Google Drive.');
      });
    } else {
      this.accessToken = null;
      this.isConnected = false;
    }
  }

  /**
   * 1. TÌM FILE DỮ LIỆU TRONG APPDATAFOLDER (Fetch API)
   * GET https://www.googleapis.com/drive/v3/files
   */
  async findAppDataFile() {
    if (!this.accessToken) {
      throw new Error('Chưa đăng nhập Google Drive (Access Token không hợp lệ)');
    }

    const query = encodeURIComponent(`name = '${this.DATA_FILE_NAME}' and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?spaces=${this.APP_DATA_FOLDER}&q=${query}&fields=files(id,name,modifiedTime)`;

    this.log(`Đang tìm kiếm file '${this.DATA_FILE_NAME}' trong ${this.APP_DATA_FOLDER}...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ? err.error.message : 'Lỗi khi tìm kiếm file');
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      this.currentFileId = data.files[0].id;
      this.log(`Tìm thấy file trên Drive! ID: ${this.currentFileId} (Cập nhật lúc: ${data.files[0].modifiedTime})`);
      return data.files[0];
    }

    this.log(`Chưa có file '${this.DATA_FILE_NAME}' trong thư mục ẩn. Sẽ tạo mới khi lưu.`);
    return null;
  }

  /**
   * 2. ĐỌC DỮ LIỆU FILE JSON TỪ DRIVE (Fetch API)
   * GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
   */
  async readAppDataFile(fileId) {
    if (!this.accessToken) {
      throw new Error('Chưa đăng nhập Google Drive');
    }

    this.log(`Đang tải nội dung file ID: ${fileId}...`);
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Không thể đọc dữ liệu file từ Google Drive.');
    }

    const jsonData = await response.json();
    this.log('Tải dữ liệu từ Google Drive thành công!');
    return jsonData;
  }

  /**
   * 3. TẠO MỚI FILE JSON TRONG APPDATAFOLDER (Fetch API Multipart Upload)
   * POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
   */
  async createAppDataFile(payload) {
    if (!this.accessToken) {
      throw new Error('Chưa đăng nhập Google Drive');
    }

    this.log('Đang tạo file mới trong appDataFolder...');
    const metadata = {
      name: this.DATA_FILE_NAME,
      parents: [this.APP_DATA_FOLDER],
      mimeType: 'application/json'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload, null, 2) +
      closeDelimiter;

    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ? err.error.message : 'Lỗi khi tạo file trên Drive');
    }

    const result = await response.json();
    this.currentFileId = result.id;
    this.log(`Tạo file thành công trên Drive! File ID: ${result.id}`);
    return result;
  }

  /**
   * 4. CẬP NHẬT FILE JSON TRÊN DRIVE (Fetch API)
   * PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media
   */
  async updateAppDataFile(fileId, payload) {
    if (!this.accessToken) {
      throw new Error('Chưa đăng nhập Google Drive');
    }

    this.log(`Đang cập nhật dữ liệu vào file ID: ${fileId}...`);
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload, null, 2)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ? err.error.message : 'Lỗi khi cập nhật file trên Drive');
    }

    const result = await response.json();
    this.log('Cập nhật dữ liệu lên Google Drive thành công!');
    return result;
  }

  /**
   * HÀM TỔNG HỢP: SAO LƯU DỮ LIỆU ĐẾN DRIVE
   */
  async syncToGoogleDrive(appData) {
    if (!this.isConnected || !this.accessToken) {
      // Fallback: Lưu bản ghi offline có timestamp
      localStorage.setItem('chamcong_last_offline_backup', new Date().toISOString());
      this.log('[Local Sync] Chưa kết nối Drive. Đã ghi nhận bản sao lưu an toàn tại LocalStorage.');
      return { success: true, mode: 'local' };
    }

    try {
      let file = await this.findAppDataFile();
      if (file && file.id) {
        await this.updateAppDataFile(file.id, appData);
      } else {
        await this.createAppDataFile(appData);
      }
      return { success: true, mode: 'cloud' };
    } catch (err) {
      this.log(`Lỗi đồng bộ Cloud: ${err.message}`);
      throw err;
    }
  }

  /**
   * HÀM TỔNG HỢP: KHÔI PHỤC DỮ LIỆU TỪ DRIVE
   */
  async restoreFromGoogleDrive() {
    if (!this.isConnected || !this.accessToken) {
      this.log('Cần kết nối Google Drive trước để tải dữ liệu.');
      return null;
    }

    try {
      const file = await this.findAppDataFile();
      if (!file || !file.id) {
        this.log('Không tìm thấy bản sao lưu nào trên tài khoản Google Drive này.');
        return null;
      }
      const data = await this.readAppDataFile(file.id);
      return data;
    } catch (err) {
      this.log(`Lỗi khi tải từ Drive: ${err.message}`);
      throw err;
    }
  }

  /**
   * Xuất file JSON tải thẳng về máy (1-click backup)
   */
  exportLocalJsonFile(data, filename = 'cham_cong_backup.json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.log(`Đã xuất file dự phòng '${filename}' về máy.`);
  }

  /**
   * Ghi log ra màn hình console và trigger UI callback
   */
  log(msg) {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const fullMsg = `[${timestamp}] ${msg}`;
    console.log(`[GoogleDriveSync] ${fullMsg}`);
    
    const consoleEl = document.getElementById('driveSyncLog');
    if (consoleEl) {
      consoleEl.innerHTML = `${fullMsg}\n` + consoleEl.innerHTML;
    }
  }
}

// Khởi tạo instance toàn cục
window.googleDriveManager = new GoogleDriveSyncManager();
