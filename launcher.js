/**
 * ===================================================================
 * MULTI-LAUNCHER & TIMEKEEPING CONTROLLER
 * ===================================================================
 * 
 * 1. Multi-Launcher Engine (5 Themes Switching + LocalStorage)
 * 2. Timekeeping Engine (Giờ đến, Giờ về, Tính lương theo giờ)
 * 3. Settings UI & Modal Navigation
 * 4. Google Drive Sync Integration & JSON Backup
 */

class LauncherApp {
  constructor() {
    // 5 Themes Registry
    this.THEMES = {
      'theme-skeuomorphic': {
        name: 'Launcher 1: 3D / Skeuomorphic',
        shortName: '3D Skeuomorphic',
        desc: 'Khối nổi 3D chân thực, ánh sáng specular, đổ bóng sâu đa lớp.'
      },
      'theme-cute': {
        name: 'Launcher 2: Cute & Romantic',
        shortName: 'Cute & Romantic',
        desc: 'Tone pastel ngọt ngào, góc bo pill-shape, nhún nhảy & hoa tim lơ lửng.'
      },
      'theme-glassmorphism': {
        name: 'Launcher 3: Glassmorphism',
        shortName: 'Glassmorphism',
        desc: 'Kính mờ cao cấp, viền sáng mỏng, ánh sáng cực quang lung linh.'
      },
      'theme-neumorphism': {
        name: 'Launcher 4: Neumorphism (Soft UI)',
        shortName: 'Neumorphism',
        desc: 'Dập nổi / khoét chìm mịn màng, tương tác ánh sáng vật lý êm dịu.'
      },
      'theme-cyberpunk': {
        name: 'Launcher 5: Cyberpunk Dark Mode',
        shortName: 'Cyberpunk Neon',
        desc: 'Neon Cyan & Magenta chói rực, nền đen tuyền OLED, scanlines.'
      }
    };

    // Storage Keys
    this.STORAGE_KEYS = {
      THEME: 'chamcong_active_theme',
      HOURLY_WAGE: 'chamcong_hourly_wage',
      CURRENT_SESSION: 'chamcong_active_shift',
      LOGS: 'chamcong_attendance_logs',
      DESKTOP_MODE: 'chamcong_expanded_mode'
    };

    // State
    this.currentTheme = localStorage.getItem(this.STORAGE_KEYS.THEME) || 'theme-skeuomorphic';
    this.hourlyWage = parseInt(localStorage.getItem(this.STORAGE_KEYS.HOURLY_WAGE), 10) || 30000;
    this.currentShift = this._loadJson(this.STORAGE_KEYS.CURRENT_SESSION, null);
    this.attendanceLogs = this._loadJson(this.STORAGE_KEYS.LOGS, this._getDefaultLogs());
    this.isDesktopMode = localStorage.getItem(this.STORAGE_KEYS.DESKTOP_MODE) === 'true';

    this.timerInterval = null;

    this.init();
  }

  /**
   * Khởi chạy ứng dụng
   */
  init() {
    this._applyTheme(this.currentTheme, false);
    this._applyDesktopMode(this.isDesktopMode);
    this._setupClock();
    this._setupEventListeners();
    this._renderAttendanceState();
    this._renderLogsTable();
    this._initGoogleDriveUI();
  }

  // =================================================================
  // 1. MULTI-LAUNCHER THEME LOGIC
  // =================================================================

  _applyTheme(themeKey, notify = true) {
    if (!this.THEMES[themeKey]) themeKey = 'theme-skeuomorphic';

    // Xóa tất cả các theme classes cũ trên body
    Object.keys(this.THEMES).forEach(key => {
      document.body.classList.remove(key);
    });

    // Thêm class theme mới vào body
    document.body.classList.add(themeKey);
    this.currentTheme = themeKey;
    localStorage.setItem(this.STORAGE_KEYS.THEME, themeKey);

    // Cập nhật UI Preview Cards trong Modal Cài Đặt
    document.querySelectorAll('.theme-card').forEach(card => {
      if (card.getAttribute('data-theme') === themeKey) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Cập nhật các label trạng thái
    const activeInfo = this.THEMES[themeKey];
    const footerInfoEl = document.getElementById('footerActiveThemeInfo');
    const headerPillEl = document.getElementById('activeThemeName');
    
    if (footerInfoEl) footerInfoEl.textContent = `Đang chọn: ${activeInfo.name}`;
    if (headerPillEl) headerPillEl.textContent = activeInfo.name;

    if (notify) {
      this.showToast(`✨ Đã kích hoạt ${activeInfo.name}!`);
    }
  }

  // =================================================================
  // 2. LIVE CLOCK & DATE WIDGET
  // =================================================================

  _setupClock() {
    const updateTime = () => {
      const now = new Date();
      
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      // Status Bar Clock & Hero Widget Clock
      const statusClock = document.getElementById('statusClock');
      const heroClock = document.getElementById('heroClock');
      if (statusClock) statusClock.textContent = timeStr;
      if (heroClock) heroClock.textContent = timeStr;

      // Hero Widget Date (Tiếng Việt)
      const heroDate = document.getElementById('heroDate');
      if (heroDate) {
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = days[now.getDay()];
        const dateStr = `${dayName}, ${now.getDate()} Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
        heroDate.textContent = dateStr;
      }

      // Nếu đang trong ca làm việc, cập nhật đồng hồ đếm giờ làm thực tế
      this._updateShiftTimer();
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  // =================================================================
  // 3. TIMEKEEPING ATTENDANCE LOGIC (CHẤM CÔNG VỢ YÊU ĐI LÀM)
  // =================================================================

  /**
   * Bấm nút Vào Ca / Tan Ca
   */
  togglePunchShift() {
    const now = new Date();

    if (!this.currentShift) {
      // 1. BẮT ĐẦU VÀO CA (CHECK-IN)
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');

      this.currentShift = {
        date: this._formatDateISO(now),
        checkInTime: `${hours}:${mins}:${secs}`,
        checkInTimestamp: now.getTime(),
        hourlyWage: this.hourlyWage
      };

      this._saveJson(this.STORAGE_KEYS.CURRENT_SESSION, this.currentShift);
      this.showToast(`🌸 Vợ yêu đã vào ca lúc ${hours}:${mins}! Chúc một ngày làm việc vui vẻ ❤️`);
      this._renderAttendanceState();
    } else {
      // 2. TAN CA (CHECK-OUT)
      const startTime = this.currentShift.checkInTimestamp;
      const endTime = now.getTime();
      const diffMs = endTime - startTime;
      
      // Tính giờ làm: đổi ms ra giờ với 2 số thập phân (tối thiểu tính 0.1h cho thử nghiệm)
      let workedHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      if (workedHours < 0.05) workedHours = 0.1; // Demo: nếu bấm test nhanh dưới 3 phút vẫn tính 0.1h

      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const checkOutTime = `${hours}:${mins}`;

      const totalWage = Math.round(workedHours * this.currentShift.hourlyWage);

      // Thêm vào nhật ký công
      const newEntry = {
        id: 'shift_' + Date.now(),
        date: this.currentShift.date,
        timeIn: this.currentShift.checkInTime.slice(0, 5),
        timeOut: checkOutTime,
        workedHours: workedHours,
        hourlyWage: this.currentShift.hourlyWage,
        totalWage: totalWage,
        note: 'Bấm chấm công tự động'
      };

      this.attendanceLogs.unshift(newEntry);
      this._saveJson(this.STORAGE_KEYS.LOGS, this.attendanceLogs);

      // Xóa ca hiện tại
      this.currentShift = null;
      localStorage.removeItem(this.STORAGE_KEYS.CURRENT_SESSION);

      this.showToast(`🎉 Tan ca thành công! Vợ đã làm ${workedHours}h, tiền công: ${this._formatMoney(totalWage)}!`);
      this._renderAttendanceState();
      this._renderLogsTable();

      // Tự động sao lưu lên Drive nếu đã kết nối
      this._triggerAutoDriveSync();
    }
  }

  /**
   * Cập nhật đồng hồ đếm thời gian thực khi đang làm việc
   */
  _updateShiftTimer() {
    if (!this.currentShift) return;

    const now = Date.now();
    const elapsedMs = now - this.currentShift.checkInTimestamp;
    
    const totalSecs = Math.floor(elapsedMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const timerStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    const elapsedEl = document.getElementById('punchElapsedTimer');
    if (elapsedEl) {
      elapsedEl.textContent = `Đang làm: ${timerStr}`;
    }

    // Tạm tính số tiền theo từng giây phút
    const currentWorkedHours = elapsedMs / (1000 * 60 * 60);
    const currentEstWage = Math.round(currentWorkedHours * this.currentShift.hourlyWage);

    const hoursEl = document.getElementById('todayWorkedHours');
    const wageEl = document.getElementById('todayEstimatedWage');
    if (hoursEl) hoursEl.textContent = `${currentWorkedHours.toFixed(2)}h`;
    if (wageEl) wageEl.textContent = this._formatMoney(currentEstWage);
  }

  /**
   * Cập nhật toàn bộ trạng thái hiển thị của Widget chấm công
   */
  _renderAttendanceState() {
    const punchBtn = document.getElementById('mainPunchBtn');
    const punchLabel = document.getElementById('punchBtnLabel');
    const punchSub = document.getElementById('punchElapsedTimer');
    const statusBadge = document.getElementById('workStatusBadge');
    const displayWageEl = document.getElementById('displayHourlyWage');
    const todayCheckInEl = document.getElementById('todayCheckInTime');
    const todayHoursEl = document.getElementById('todayWorkedHours');
    const todayWageEl = document.getElementById('todayEstimatedWage');

    if (displayWageEl) {
      displayWageEl.textContent = this._formatMoney(this.hourlyWage);
    }

    if (this.currentShift) {
      // Đang trong ca làm việc
      if (punchBtn) {
        punchBtn.className = 'hero-punch-btn working';
      }
      if (punchLabel) punchLabel.textContent = 'HOÀN THÀNH - TAN CA';
      if (punchSub) punchSub.textContent = `Vào lúc: ${this.currentShift.checkInTime.slice(0, 5)}`;
      if (statusBadge) {
        statusBadge.textContent = 'Đang làm';
        statusBadge.className = 'app-badge';
      }
      if (todayCheckInEl) todayCheckInEl.textContent = this.currentShift.checkInTime.slice(0, 5);
    } else {
      // Đang rảnh rỗi / chưa vào ca
      if (punchBtn) {
        punchBtn.className = 'hero-punch-btn ready';
      }
      if (punchLabel) punchLabel.textContent = 'BẮT ĐẦU VÀO CA';
      if (punchSub) punchSub.textContent = 'Bấm để ghi nhận giờ đến';
      if (statusBadge) {
        statusBadge.textContent = 'Chưa vào';
        statusBadge.className = 'app-badge count';
      }

      // Tính tổng giờ và tiền của hôm nay từ danh sách logs
      const todayISO = this._formatDateISO(new Date());
      const todayEntries = this.attendanceLogs.filter(log => log.date === todayISO);

      if (todayEntries.length > 0) {
        const totalTodayHours = todayEntries.reduce((sum, item) => sum + item.workedHours, 0);
        const totalTodayWage = todayEntries.reduce((sum, item) => sum + item.totalWage, 0);
        if (todayCheckInEl) todayCheckInEl.textContent = todayEntries[todayEntries.length - 1].timeIn;
        if (todayHoursEl) todayHoursEl.textContent = `${totalTodayHours.toFixed(1)}h`;
        if (todayWageEl) todayWageEl.textContent = this._formatMoney(totalTodayWage);
      } else {
        if (todayCheckInEl) todayCheckInEl.textContent = '--:--';
        if (todayHoursEl) todayHoursEl.textContent = '0.0h';
        if (todayWageEl) todayWageEl.textContent = '0 đ';
      }
    }

    // Cập nhật số ngày đã làm trong tháng
    const monthBadge = document.getElementById('monthTotalDays');
    if (monthBadge) {
      const currentMonth = new Date().getMonth() + 1;
      const monthLogs = this.attendanceLogs.filter(l => {
        const d = new Date(l.date);
        return d.getMonth() + 1 === currentMonth;
      });
      monthBadge.textContent = `${monthLogs.length} ca`;
    }
  }

  /**
   * Hiển thị bảng nhật ký chấm công
   */
  _renderLogsTable() {
    const tableBody = document.getElementById('attendanceTableBody');
    if (!tableBody) return;

    if (this.attendanceLogs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 24px; color: #94a3b8;">
            Chưa có nhật ký ca làm nào. Bấm 'Bắt đầu vào ca' hoặc '+ Ghi công bổ sung' để tạo mới!
          </td>
        </tr>
      `;
      this._updateMonthlySummary(0, 0);
      return;
    }

    let totalHours = 0;
    let totalWage = 0;

    let html = '';
    this.attendanceLogs.forEach((item) => {
      totalHours += Number(item.workedHours);
      totalWage += Number(item.totalWage);

      html += `
        <tr>
          <td><strong>${item.date}</strong></td>
          <td><span style="color:#10b981; font-weight:600;">${item.timeIn}</span></td>
          <td><span style="color:#f43f5e; font-weight:600;">${item.timeOut}</span></td>
          <td><strong>${item.workedHours} giờ</strong></td>
          <td>${this._formatMoney(item.hourlyWage)}/h</td>
          <td><strong style="color:#38bdf8;">${this._formatMoney(item.totalWage)}</strong></td>
          <td><small style="color:#94a3b8;">${item.note || '-'}</small></td>
          <td>
            <button class="btn-delete-row" data-id="${item.id}" title="Xóa dòng này">Xóa</button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
    this._updateMonthlySummary(totalHours, totalWage);

    // Gắn sự kiện xóa dòng
    tableBody.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.deleteLogEntry(id);
      });
    });
  }

  _updateMonthlySummary(totalHours, totalWage) {
    const modalHours = document.getElementById('modalMonthHours');
    const modalWage = document.getElementById('modalMonthWage');
    if (modalHours) modalHours.textContent = `${totalHours.toFixed(1)} giờ`;
    if (modalWage) modalWage.textContent = this._formatMoney(totalWage);
  }

  /**
   * Thêm nhật ký chấm công thủ công (khi vợ quên bấm giờ)
   */
  saveManualEntry() {
    const dateInput = document.getElementById('manualDate');
    const timeInInput = document.getElementById('manualTimeIn');
    const timeOutInput = document.getElementById('manualTimeOut');
    const wageRateInput = document.getElementById('manualWageRate');
    const noteInput = document.getElementById('manualNote');

    const dateVal = dateInput.value || this._formatDateISO(new Date());
    const timeInVal = timeInInput.value || '08:00';
    const timeOutVal = timeOutInput.value || '12:00';
    const wageRateVal = parseInt(wageRateInput.value, 10) || this.hourlyWage;
    const noteVal = noteInput.value.trim() || 'Ghi công bổ sung';

    // Tính số giờ giữa 2 mốc thời gian
    const [hIn, mIn] = timeInVal.split(':').map(Number);
    const [hOut, mOut] = timeOutVal.split(':').map(Number);

    let totalMinutes = (hOut * 60 + mOut) - (hIn * 60 + mIn);
    if (totalMinutes <= 0) {
      alert('Giờ về phải lớn hơn giờ đến!');
      return;
    }

    const workedHours = parseFloat((totalMinutes / 60).toFixed(2));
    const totalWage = Math.round(workedHours * wageRateVal);

    const newLog = {
      id: 'manual_' + Date.now(),
      date: dateVal,
      timeIn: timeInVal,
      timeOut: timeOutVal,
      workedHours: workedHours,
      hourlyWage: wageRateVal,
      totalWage: totalWage,
      note: noteVal
    };

    this.attendanceLogs.unshift(newLog);
    this._saveJson(this.STORAGE_KEYS.LOGS, this.attendanceLogs);

    this._renderLogsTable();
    this._renderAttendanceState();
    this._triggerAutoDriveSync();

    // Reset & ẩn form
    document.getElementById('manualEntryForm').style.display = 'none';
    this.showToast(`Đã thêm ca làm ngày ${dateVal} (${workedHours}h)!`);
  }

  /**
   * Xóa một dòng chấm công
   */
  deleteLogEntry(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi chấm công này không?')) return;
    this.attendanceLogs = this.attendanceLogs.filter(log => log.id !== id);
    this._saveJson(this.STORAGE_KEYS.LOGS, this.attendanceLogs);
    this._renderLogsTable();
    this._renderAttendanceState();
    this._triggerAutoDriveSync();
    this.showToast('Đã xóa bản ghi chấm công.');
  }

  /**
   * Xóa toàn bộ lịch sử chấm công
   */
  clearAllLogs() {
    if (!confirm('CẢNH BÁO: Thao tác này sẽ xóa toàn bộ nhật ký chấm công từ trước tới nay. Bạn có chắc không?')) return;
    this.attendanceLogs = [];
    this._saveJson(this.STORAGE_KEYS.LOGS, this.attendanceLogs);
    this._renderLogsTable();
    this._renderAttendanceState();
    this.showToast('Đã dọn dẹp sạch nhật ký chấm công.');
  }

  /**
   * Lưu mức lương theo giờ mới
   */
  saveHourlyWage(newRate) {
    newRate = parseInt(newRate, 10);
    if (isNaN(newRate) || newRate <= 0) {
      alert('Vui lòng nhập mức lương hợp lệ lớn hơn 0!');
      return;
    }
    this.hourlyWage = newRate;
    localStorage.setItem(this.STORAGE_KEYS.HOURLY_WAGE, newRate.toString());
    this._renderAttendanceState();
    this.showToast(`Đã lưu mức lương mới: ${this._formatMoney(newRate)} / giờ!`);
  }

  // =================================================================
  // 4. GOOGLE DRIVE SYNC & BACKUP MANAGEMENT
  // =================================================================

  _initGoogleDriveUI() {
    const driveManager = window.googleDriveManager;
    if (!driveManager) return;

    // Hiển thị Client ID đã lưu
    const clientIdInput = document.getElementById('googleClientId');
    if (clientIdInput && driveManager.clientId) {
      clientIdInput.value = driveManager.clientId;
    }

    // Nút Lưu Client ID
    const btnSaveConfig = document.getElementById('btnSaveConfig');
    if (btnSaveConfig) {
      btnSaveConfig.addEventListener('click', () => {
        const val = clientIdInput.value.trim();
        driveManager.clientId = val;
        localStorage.setItem(driveManager.CLIENT_ID_STORAGE_KEY, val);
        driveManager.initTokenClient();
        this.showToast('Đã lưu Google Client ID thành công!');
      });
    }

    // Nút Kết nối Google Drive
    const connectDriveBtn = document.getElementById('connectGoogleDriveBtn');
    if (connectDriveBtn) {
      connectDriveBtn.addEventListener('click', () => {
        driveManager.signIn(() => {
          this._updateDriveConnectionStatus(true);
          this.showToast('Đã kết nối thành công với Google Drive!');
        });
      });
    }

    // Nút Sao lưu lên Drive ngay
    const btnBackup = document.getElementById('btnBackupNow');
    if (btnBackup) {
      btnBackup.addEventListener('click', async () => {
        try {
          const payload = this.exportFullAppData();
          const result = await driveManager.syncToGoogleDrive(payload);
          if (result.mode === 'cloud') {
            this.showToast('☁️ Đã sao lưu dữ liệu lên Google Drive an toàn!');
          } else {
            this.showToast('💾 Đã lưu dữ liệu dự phòng cục bộ (Local Sync)!');
          }
        } catch (err) {
          alert('Lỗi sao lưu: ' + err.message);
        }
      });
    }

    // Nút Tải dữ liệu từ Drive
    const btnRestore = document.getElementById('btnRestoreNow');
    if (btnRestore) {
      btnRestore.addEventListener('click', async () => {
        try {
          const cloudData = await driveManager.restoreFromGoogleDrive();
          if (cloudData) {
            this.importFullAppData(cloudData);
            this.showToast('📥 Đã khôi phục toàn bộ dữ liệu từ Google Drive!');
          }
        } catch (err) {
          alert('Lỗi khôi phục: ' + err.message);
        }
      });
    }

    // Nút Xuất file JSON dự phòng (Download offline)
    const btnExportJson = document.getElementById('btnExportLocalJson');
    if (btnExportJson) {
      btnExportJson.addEventListener('click', () => {
        const payload = this.exportFullAppData();
        const nowStr = this._formatDateISO(new Date());
        driveManager.exportLocalJsonFile(payload, `cham_cong_vo_${nowStr}.json`);
        this.showToast('Đã tải file JSON về máy!');
      });
    }

    // Nút Nhập file JSON từ máy
    const btnImportTrigger = document.getElementById('btnImportLocalJsonTrigger');
    const fileInput = document.getElementById('importJsonFileInput');
    if (btnImportTrigger && fileInput) {
      btnImportTrigger.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedData = JSON.parse(event.target.result);
            this.importFullAppData(importedData);
            this.showToast('Đã nhập dữ liệu từ file JSON thành công!');
          } catch (err) {
            alert('File JSON không hợp lệ: ' + err.message);
          }
        };
        reader.readAsText(file);
      });
    }

    // Header Pill Click -> mở tab Drive
    const driveStatusPill = document.getElementById('driveStatusPill');
    if (driveStatusPill) {
      driveStatusPill.addEventListener('click', () => {
        this.openModal('settingsModal');
        this.switchSettingsTab('tab-drive');
      });
    }
  }

  _updateDriveConnectionStatus(connected) {
    const heading = document.getElementById('driveStatusHeading');
    const sub = document.getElementById('driveStatusSub');
    const topLabel = document.getElementById('topSyncLabel');
    if (connected) {
      if (heading) heading.textContent = 'Google Drive: Đã Kết Nối (Online)';
      if (sub) sub.textContent = 'Dữ liệu được tự động đồng bộ vào thư mục ẩn appDataFolder của tài khoản Google.';
      if (topLabel) topLabel.textContent = 'Drive Online';
    }
  }

  _triggerAutoDriveSync() {
    if (window.googleDriveManager && window.googleDriveManager.isConnected) {
      const payload = this.exportFullAppData();
      window.googleDriveManager.syncToGoogleDrive(payload).catch(console.error);
    }
  }

  /**
   * Đóng gói toàn bộ cấu hình & dữ liệu chấm công thành 1 JSON object
   */
  exportFullAppData() {
    return {
      appName: 'MultiLauncherAttendanceApp',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      activeTheme: this.currentTheme,
      hourlyWage: this.hourlyWage,
      currentShift: this.currentShift,
      attendanceLogs: this.attendanceLogs
    };
  }

  /**
   * Nhập & khôi phục dữ liệu từ JSON object
   */
  importFullAppData(data) {
    if (!data) return;
    if (data.activeTheme) this._applyTheme(data.activeTheme, false);
    if (data.hourlyWage) {
      this.hourlyWage = data.hourlyWage;
      localStorage.setItem(this.STORAGE_KEYS.HOURLY_WAGE, data.hourlyWage.toString());
    }
    if (data.attendanceLogs && Array.isArray(data.attendanceLogs)) {
      this.attendanceLogs = data.attendanceLogs;
      this._saveJson(this.STORAGE_KEYS.LOGS, data.attendanceLogs);
    }
    this._renderAttendanceState();
    this._renderLogsTable();
  }

  // =================================================================
  // 5. EVENT LISTENERS & MODAL ROUTING
  // =================================================================

  _setupEventListeners() {
    // Punch button hero
    const punchBtn = document.getElementById('mainPunchBtn');
    if (punchBtn) {
      punchBtn.addEventListener('click', () => this.togglePunchShift());
    }

    // Dock quick punch button
    const dockPunchBtn = document.getElementById('dockPunchToggleBtn');
    if (dockPunchBtn) {
      dockPunchBtn.addEventListener('click', () => this.togglePunchShift());
    }

    // Modal: Bảng Cài đặt Launcher & Themes
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const appSettingsTrigger = document.getElementById('appSettingsTrigger');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const confirmThemeBtn = document.getElementById('confirmThemeBtn');

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => this.openModal('settingsModal'));
    if (appSettingsTrigger) appSettingsTrigger.addEventListener('click', () => this.openModal('settingsModal'));
    if (closeSettingsModal) closeSettingsModal.addEventListener('click', () => this.closeModal('settingsModal'));
    if (confirmThemeBtn) confirmThemeBtn.addEventListener('click', () => this.closeModal('settingsModal'));

    // Theme Cards Click
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const selected = card.getAttribute('data-theme');
        this._applyTheme(selected, true);
      });
    });

    // Settings Modal Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');
        this.switchSettingsTab(targetTab);
      });
    });

    // Modal: Nhật Ký Chấm Công
    const openLogApp = document.getElementById('openLogModalApp');
    const openPayrollApp = document.getElementById('openPayrollApp');
    const dockLogBtn = document.getElementById('dockLogHistoryBtn');
    const closeLogModal = document.getElementById('closeLogModal');
    const closeLogFooter = document.getElementById('btnCloseLogModalFooter');
    const clearAllLogsBtn = document.getElementById('btnClearAllLogs');

    const handleOpenLog = () => {
      this._renderLogsTable();
      this.openModal('logModal');
    };

    if (openLogApp) openLogApp.addEventListener('click', handleOpenLog);
    if (openPayrollApp) openPayrollApp.addEventListener('click', handleOpenLog);
    if (dockLogBtn) dockLogBtn.addEventListener('click', handleOpenLog);
    if (closeLogModal) closeLogModal.addEventListener('click', () => this.closeModal('logModal'));
    if (closeLogFooter) closeLogFooter.addEventListener('click', () => this.closeModal('logModal'));
    if (clearAllLogsBtn) clearAllLogsBtn.addEventListener('click', () => this.clearAllLogs());

    // Toggle Form Ghi công bổ sung
    const btnToggleManual = document.getElementById('btnToggleManualForm');
    const manualForm = document.getElementById('manualEntryForm');
    const btnCancelManual = document.getElementById('btnCancelManual');
    const btnSaveManual = document.getElementById('btnSaveManualEntry');

    if (btnToggleManual && manualForm) {
      btnToggleManual.addEventListener('click', () => {
        const isHidden = manualForm.style.display === 'none';
        manualForm.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          document.getElementById('manualDate').value = this._formatDateISO(new Date());
          document.getElementById('manualWageRate').value = this.hourlyWage;
        }
      });
    }

    if (btnCancelManual && manualForm) {
      btnCancelManual.addEventListener('click', () => {
        manualForm.style.display = 'none';
      });
    }

    if (btnSaveManual) {
      btnSaveManual.addEventListener('click', () => this.saveManualEntry());
    }

    // Modal: Cài Đặt Mức Lương Theo Giờ
    const openWageBtn = document.getElementById('openWageModalBtn');
    const openWageApp = document.getElementById('openWageConfigApp');
    const closeWageModal = document.getElementById('closeWageModal');
    const btnCancelWage = document.getElementById('btnCancelWage');
    const btnSaveWage = document.getElementById('btnSaveHourlyWage');
    const wageInput = document.getElementById('hourlyWageInput');

    const handleOpenWage = () => {
      if (wageInput) wageInput.value = this.hourlyWage;
      this.openModal('wageModal');
    };

    if (openWageBtn) openWageBtn.addEventListener('click', handleOpenWage);
    if (openWageApp) openWageApp.addEventListener('click', handleOpenWage);
    if (closeWageModal) closeWageModal.addEventListener('click', () => this.closeModal('wageModal'));
    if (btnCancelWage) btnCancelWage.addEventListener('click', () => this.closeModal('wageModal'));
    if (btnSaveWage && wageInput) {
      btnSaveWage.addEventListener('click', () => {
        this.saveHourlyWage(wageInput.value);
        this.closeModal('wageModal');
      });
    }

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wageVal = e.currentTarget.getAttribute('data-wage');
        if (wageInput) wageInput.value = wageVal;
      });
    });

    // App: Xuất Báo Cáo Gửi Chủ Quán
    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
      exportReportBtn.addEventListener('click', () => this.generateTextReport());
    }

    // App: Thống Kê
    const openReportApp = document.getElementById('openReportApp');
    if (openReportApp) {
      openReportApp.addEventListener('click', () => handleOpenLog());
    }

    // App: Ghi Bổ Sung
    const openManualApp = document.getElementById('openManualEntryApp');
    if (openManualApp) {
      openManualApp.addEventListener('click', () => {
        handleOpenLog();
        if (manualForm) manualForm.style.display = 'block';
      });
    }

    // App: Google Drive Cloud trigger
    const appDriveTrigger = document.getElementById('appDriveTrigger');
    const openDriveDock = document.getElementById('openDriveBtn');
    const handleOpenDriveTab = () => {
      this.openModal('settingsModal');
      this.switchSettingsTab('tab-drive');
    };
    if (appDriveTrigger) appDriveTrigger.addEventListener('click', handleOpenDriveTab);
    if (openDriveDock) openDriveDock.addEventListener('click', handleOpenDriveTab);

    // Desktop Frame Toggle Mode
    const toggleFrameBtn = document.getElementById('toggleFrameModeBtn');
    if (toggleFrameBtn) {
      toggleFrameBtn.addEventListener('click', () => {
        this.isDesktopMode = !this.isDesktopMode;
        localStorage.setItem(this.STORAGE_KEYS.DESKTOP_MODE, this.isDesktopMode.toString());
        this._applyDesktopMode(this.isDesktopMode);
      });
    }

    // Search Bar Filter
    const searchInput = document.getElementById('launcherSearchInput');
    const searchClear = document.getElementById('searchClearBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (searchClear) searchClear.classList.toggle('visible', query.length > 0);

        document.querySelectorAll('.app-item').forEach(item => {
          const title = item.querySelector('.app-title').textContent.toLowerCase();
          item.style.display = title.includes(query) ? 'flex' : 'none';
        });
      });
    }

    if (searchClear && searchInput) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      });
    }

    // Backdrop click close modal
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
        }
      });
    });
  }

  // =================================================================
  // 6. HELPER UTILITIES
  // =================================================================

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  switchSettingsTab(tabId) {
    document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  }

  _applyDesktopMode(isDesktop) {
    const shell = document.getElementById('launcherShell');
    const toggleBtn = document.getElementById('toggleFrameModeBtn');
    if (shell) {
      shell.classList.toggle('expanded-desktop-mode', isDesktop);
    }
    if (toggleBtn) {
      toggleBtn.querySelector('.tool-text').textContent = isDesktop ? 'Thu nhỏ Phone' : 'Mở rộng Desktop';
      toggleBtn.querySelector('.tool-icon').textContent = isDesktop ? '💻' : '📱';
    }
  }

  showToast(message) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.add('show');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  generateTextReport() {
    if (this.attendanceLogs.length === 0) {
      alert('Chưa có dữ liệu chấm công để xuất báo cáo.');
      return;
    }

    let report = '📋 BẢNG TỔNG HỢP CÔNG LÀM THÊM (GỬI CHỦ QUÁN)\n';
    report += `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}\n`;
    report += '--------------------------------------------------\n';
    
    let totalH = 0;
    let totalW = 0;

    this.attendanceLogs.forEach((log, index) => {
      totalH += log.workedHours;
      totalW += log.totalWage;
      report += `${index + 1}. Ngày ${log.date} | ${log.timeIn} - ${log.timeOut} | ${log.workedHours}h | ${this._formatMoney(log.totalWage)} (${log.note || 'Bình thường'})\n`;
    });

    report += '--------------------------------------------------\n';
    report += `TỔNG SỐ GIỜ LÀM: ${totalH.toFixed(1)} Giờ\n`;
    report += `TỔNG TIỀN LƯƠNG NHẬN: ${this._formatMoney(totalW)}\n`;

    // Tự động copy vào clipboard
    navigator.clipboard.writeText(report).then(() => {
      alert('Đã sao chép bảng kê chi tiết vào Clipboard!\nBạn có thể dán (Paste) ngay qua Zalo hoặc tin nhắn để gửi cho chủ quán:\n\n' + report);
    }).catch(() => {
      alert(report);
    });
  }

  _formatMoney(num) {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  }

  _formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _loadJson(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  _saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.error('Lỗi lưu LocalStorage:', e);
    }
  }

  _getDefaultLogs() {
    // 3 mẫu dữ liệu giả định ban đầu để người dùng kiểm tra giao diện bảng và tính toán ngay
    const today = new Date();
    const d1 = new Date(today); d1.setDate(d1.getDate() - 2);
    const d2 = new Date(today); d2.setDate(d2.getDate() - 1);

    return [
      {
        id: 'sample_2',
        date: this._formatDateISO(d2),
        timeIn: '17:30',
        timeOut: '21:30',
        workedHours: 4.0,
        hourlyWage: 30000,
        totalWage: 120000,
        note: 'Ca tối phụ quán cà phê'
      },
      {
        id: 'sample_1',
        date: this._formatDateISO(d1),
        timeIn: '08:00',
        timeOut: '12:30',
        workedHours: 4.5,
        hourlyWage: 30000,
        totalWage: 135000,
        note: 'Ca sáng thu ngân'
      }
    ];
  }
}

// Khởi tạo app khi trang web sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.launcherApp = new LauncherApp();
});
