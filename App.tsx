
// Fix: Corrected import syntax for useState and useEffect.
import React, { useState, useEffect } from 'react';
import Tab1 from './components/Tab1';
import Tab2 from './components/Tab2';
import Tab3ManualMatrix from './components/Tab3ManualMatrix'; // New component
import Tab3 from './components/Tab3'; // Renamed conceptually in UI to Tab 4
import Tab4 from './components/Tab4'; // Renamed conceptually in UI to Tab 5
import Tab5 from './components/Tab5'; // Renamed conceptually in UI to Tab 6
import Tab6 from './components/Tab6'; // Renamed conceptually in UI to Tab 7
import { TabButton } from './components/TabButton';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import LoginScreen from './components/LoginScreen';
import ChangePasswordModal from './components/ChangePasswordModal';
import ApiKeyModal from './components/ApiKeyModal';
import { setGeminiApiKey, setOnQuotaExceeded } from './services/geminiService';
import type { MatrixConfig, SpecData, User, TabName } from './types';
import { useRef } from 'react';


type Theme = 'light' | 'dark';
type AuthStatus = 'verifying' | 'unauthenticated' | 'allowed';
type UserPlan = 'free' | 'full';
type UserRole = 'admin' | 'user';


// --- CẤU HÌNH GOOGLE SHEETS ---
// Dán URL Web App của bạn từ Google Apps Script vào đây
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyrU5W7VuCbpVUm0nSyiR0mZf7HchcfVE6Ncw4xccvBiXfTcehfkkMSklDIi6ylQRyY/exec';

// Hàm lấy hoặc tạo DeviceID (Mã định danh máy dựa trên vân tay trình duyệt)
const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  
  if (!deviceId) {
    // Tạo mã "vân tay" dựa trên cấu hình phần cứng thay vì ngẫu nhiên hoàn toàn
    // Điều này giúp ID ổn định hơn ngay cả khi người dùng xóa cache
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      let gpuId = "";
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        gpuId = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "";
      }
      
      const hardwareInfo = [
        navigator.userAgent,
        screen.width + 'x' + screen.height,
        navigator.hardwareConcurrency || 4,
        gpuId,
        Intl.DateTimeFormat().resolvedOptions().timeZone
      ].join('|');

      // Simple hash (DJB2)
      let hash = 0;
      for (let i = 0; i < hardwareInfo.length; i++) {
          hash = ((hash << 5) - hash) + hardwareInfo.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
      }
      
      deviceId = 'HWID-' + Math.abs(hash).toString(16).toUpperCase();
      localStorage.setItem('deviceId', deviceId);
    } catch (e) {
      // Fallback nếu có lỗi lấy vân tay
      deviceId = 'device-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('deviceId', deviceId);
    }
  }
  return deviceId;
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('tab1');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0); // State cho thanh tiến trình
  const [authStatus, setAuthStatus] = useState<AuthStatus>('verifying');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserPlan, setCurrentUserPlan] = useState<UserPlan | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);

  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const quotaExceededResolvers = useRef<((key: string) => void)[]>([]);

  // Load saved API Key and register Quota Exceeded handler
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setGeminiApiKey(savedKey);
    }

    // Đăng ký cơ chế tạm dừng khi hết hạn mức API
    setOnQuotaExceeded(() => {
      return new Promise((resolve) => {
        setIsQuotaExceeded(true);
        setIsApiKeyModalOpen(true);
        quotaExceededResolvers.current.push(resolve);
      });
    });
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    setGeminiApiKey(key);
    localStorage.setItem('gemini_api_key', key);

    // Nếu chúng ta đang trong trạng thái tạm dừng do hết quota
    if (quotaExceededResolvers.current.length > 0) {
      // Giải phóng TẤT CẢ các Promise đang chờ để tiếp tục chạy
      quotaExceededResolvers.current.forEach(resolve => resolve(key));
      quotaExceededResolvers.current = [];
      setIsQuotaExceeded(false);
    }
  };

  const handleCloseApiKeyModal = () => {
    setIsApiKeyModalOpen(false);
    setIsQuotaExceeded(false);
    // Hủy bỏ trạng thái chờ nếu người dùng đóng modal mà không nhập key
    if (quotaExceededResolvers.current.length > 0) {
      quotaExceededResolvers.current.forEach(resolve => resolve('')); // Trả về chuỗi rỗng để báo hủy
      quotaExceededResolvers.current = [];
    }
  };

  // Bỏ logic đồng bộ hóa người dùng cũ vì đã dùng Google Sheet
  useEffect(() => {
    // Chỉ setAuthStatus ban đầu
  }, []);


  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme') as Theme;
      if (storedTheme) return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);


  // Kiểm tra phiên người dùng đã lưu khi tải lần đầu
  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail');
    const storedPlan = localStorage.getItem('userPlan') as UserPlan;
    const storedRole = localStorage.getItem('userRole') as UserRole || 'user';

    if (storedEmail && storedPlan) {
      setCurrentUserEmail(storedEmail);
      setCurrentUserPlan(storedPlan);
      setCurrentUserRole(storedRole);
      setAuthStatus('allowed');
    } else {
      setAuthStatus('unauthenticated');
    }
  }, []);

  const handleLogin = async (email: string, password?: string) => {
    if (SCRIPT_URL === 'DÁN_URL_WEB_APP_G_SCRIPT_VÀO_ĐÂY') {
      alert("Bạn chưa cấu hình SCRIPT_URL trong App.tsx. Hãy dán URL từ Google Apps Script vào.");
      return;
    }

    setIsLoading(true);
    setLoginError(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setLoginError("Vui lòng nhập tài khoản.");
      setIsLoading(false);
      return;
    }

    if (!password) {
      setLoginError("Vui lòng nhập mật khẩu.");
      setIsLoading(false);
      return;
    }

    try {
      const deviceId = getDeviceId();
      const response = await fetch(`${SCRIPT_URL}?user=${encodeURIComponent(trimmedEmail)}&pass=${encodeURIComponent(password)}&deviceId=${encodeURIComponent(deviceId)}`);
      const data = await response.json();

      if (data.success) {
        setCurrentUserEmail(data.email);
        setCurrentUserPlan(data.plan || 'full');
        setCurrentUserRole(data.role || 'user');
        setAuthStatus('allowed');
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('userPlan', data.plan || 'full');
        localStorage.setItem('userRole', data.role || 'user');
      } else {
        const fullMessage = data.message || 'Sai tên đăng nhập hoặc mật khẩu.';
        // Đính kèm ID máy vào thông báo lỗi để tiện cho Admin kiểm tra
        setLoginError(`${fullMessage} (ID Máy: ${deviceId})`);
      }
    } catch (error) {
      console.error("Login Error:", error);
      setLoginError("Lỗi kết nối tới máy chủ Google Sheets.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userPlan');
    setCurrentUserEmail(null);
    setCurrentUserPlan(null);
    setCurrentUserRole(null);
    setAuthStatus('unauthenticated');
    setActiveTab('tab1');
  };

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleChangePassword = (oldPass: string, newPass: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!currentUserEmail) {
        reject(new Error("Không tìm thấy người dùng hiện tại."));
        return;
      }

      const userIndex = users.findIndex(u => u.email.toLowerCase() === currentUserEmail.toLowerCase());
      if (userIndex === -1) {
        reject(new Error("Không tìm thấy người dùng hiện tại trong danh sách."));
        return;
      }

      const currentUser = users[userIndex];
      if (currentUser.password !== oldPass) {
        reject(new Error("Mật khẩu cũ không chính xác."));
        return;
      }

      // Tạo danh sách người dùng đã cập nhật
      const updatedUsers = [...users];
      updatedUsers[userIndex] = { ...currentUser, password: newPass };

      // FIX: Lưu trực tiếp và ngay lập tức vào localStorage để đảm bảo tính bền vững
      try {
        localStorage.setItem('app_users', JSON.stringify(updatedUsers));
      } catch (e) {
        console.error("Lỗi khi lưu người dùng vào localStorage trong quá trình đổi mật khẩu", e);
        reject(new Error("Không thể lưu mật khẩu mới."));
        return;
      }

      // Cập nhật trạng thái để phản ánh thay đổi trong giao diện người dùng
      setUsers(updatedUsers);

      resolve();
    });
  };

  // State from Tab 1
  const [examTitle, setExamTitle] = useState<string>('');
  const [sgkFileContent, setSgkFileContent] = useState<string>('');
  const [curriculumFileContent, setCurriculumFileContent] = useState<string>('');
  const [matrixConfig, setMatrixConfig] = useState<MatrixConfig>({
    tracNghiem: 70,
    tuLuan: 30,
    biet: 40,
    hieu: 30,
    vanDung: 30,
    soCauNhieuLuaChon: 12,
    soCauTuLuan: 2,
    soCauDungSai: 4,
    soCauTraLoiNgan: 4,
    soYTrongCauDungSai: 4,
    diemCauNhieuLuaChon: 0.25,
    diemCauTuLuan: 1.5,
    diemMoiYTrongCauDungSai: 0.25,
    diemCauTraLoiNgan: 0.25,
    isTuLuan100: false,
  });

  // State for Tab 2 (Matrix)
  const [generatedMatrix, setGeneratedMatrix] = useState<string>('');
  // State for New Tab 3 (Manual Matrix HTML string)
  const [manualMatrixHtml, setManualMatrixHtml] = useState<string>('');
  // State for Tab 4 (Specification) - previously Tab 3
  const [generatedSpec, setGeneratedSpec] = useState<SpecData>([]);
  // State store for Tab 3 (Manual Data) to persist across tab switches
  const [manualSpecStore, setManualSpecStore] = useState<SpecData | null>(null);

  // State for Tab 5 (Questions) - previously Tab 4
  const [reviewQuestions, setReviewQuestions] = useState<string>('');
  const [examTemplateContent, setExamTemplateContent] = useState<string>('');

  // State for Tab 6 (Exams) - previously Tab 5
  const [examPapers, setExamPapers] = useState<string[]>([]);

  const TABS_CONFIG: { id: TabName; label: string; plans: UserPlan[]; roles?: UserRole[] }[] = [
    { id: 'tab1', label: '1. Cấu hình', plans: ['free', 'full'] },
    { id: 'tab2', label: '2. Ma trận (AI)', plans: ['free', 'full'] },
    { id: 'tab3', label: '3. Ma trận mẫu', plans: ['free', 'full'] }, // NEW TAB
    { id: 'tab4', label: '4. Đặc tả', plans: ['free', 'full'] }, // OLD TAB 3
    { id: 'tab5', label: '5. Câu hỏi', plans: ['full'] }, // OLD TAB 4
    { id: 'tab6', label: '6. Đề thi', plans: ['full'] }, // OLD TAB 5
    { id: 'tab7', label: '7. Phân quyền', plans: ['full'], roles: ['admin'] }, // OLD TAB 6
  ];

  // Nếu gói của người dùng không cho phép tab đang hoạt động, hãy đặt lại về tab1
  useEffect(() => {
    if (authStatus === 'allowed' && currentUserPlan) {
      const currentTabConfig = TABS_CONFIG.find(t => t.id === activeTab);
      if (currentTabConfig) {
        const isAllowedByPlan = currentUserPlan && currentTabConfig.plans.includes(currentUserPlan);
        const hasRoleRequirement = !!currentTabConfig.roles && currentTabConfig.roles.length > 0;
        const userHasRequiredRole = hasRoleRequirement && currentUserRole ? currentTabConfig.roles.includes(currentUserRole) : false;
        const isAllowed = isAllowedByPlan && (!hasRoleRequirement || userHasRequiredRole);

        if (!isAllowed) {
          setActiveTab('tab1');
        }
      }
    }
  }, [activeTab, authStatus, currentUserPlan, currentUserRole]);

  // Logic to determine which matrix to use: Manual overrides AI
  const effectiveMatrix = manualMatrixHtml && manualMatrixHtml.trim() !== '' ? manualMatrixHtml : generatedMatrix;

  const handleManualMatrixConfirm = (newSpec: SpecData, newMatrixHtml: string) => {
    setGeneratedSpec(newSpec);
    setManualMatrixHtml(newMatrixHtml);
    setManualSpecStore(newSpec); // Also update the manual store so it persists when they come back
    alert('Đã xác nhận Ma trận Mẫu. Dữ liệu này sẽ được dùng cho Bản Đặc Tả và Đề Kiểm Tra.');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tab1':
        return (
          <Tab1
            examTitle={examTitle}
            setExamTitle={setExamTitle}
            setMatrixConfig={setMatrixConfig}
            matrixConfig={matrixConfig}
            setIsLoading={setIsLoading}
            setLoadingProgress={setLoadingProgress}
            setGeneratedMatrix={setGeneratedMatrix}
            setGeneratedSpec={setGeneratedSpec}
            setActiveTab={setActiveTab}
            sgkFileContent={sgkFileContent}
            setSgkFileContent={setSgkFileContent}
            curriculumFileContent={curriculumFileContent}
            setCurriculumFileContent={setCurriculumFileContent}
          />
        );
      case 'tab2':
        return <Tab2 generatedMatrix={generatedMatrix} />;
      case 'tab3':
        return (
          <Tab3ManualMatrix
            generatedSpec={generatedSpec}
            matrixConfig={matrixConfig}
            onConfirm={handleManualMatrixConfirm}
            examTitle={examTitle}
            savedSpec={manualSpecStore}
            onSaveSpec={setManualSpecStore}
          />
        );
      case 'tab4':
        return <Tab3 generatedSpec={generatedSpec} setGeneratedSpec={setGeneratedSpec} examTitle={examTitle} matrixConfig={matrixConfig} />;
      case 'tab5':
        return (
          <Tab4
            setIsLoading={setIsLoading}
            setLoadingProgress={setLoadingProgress}
            generatedMatrix={effectiveMatrix} // Pass effective matrix
            sgkFileContent={sgkFileContent}
            reviewQuestions={reviewQuestions}
            setReviewQuestions={setReviewQuestions}
            setActiveTab={setActiveTab}
            generatedSpec={generatedSpec}
            matrixConfig={matrixConfig}
          />
        );
      case 'tab6':
        return (
          <Tab5
            setIsLoading={setIsLoading}
            setLoadingProgress={setLoadingProgress}
            generatedMatrix={effectiveMatrix} // Pass effective matrix
            examPapers={examPapers}
            setExamPapers={setExamPapers}
            examTemplateContent={examTemplateContent}
            setExamTemplateContent={setExamTemplateContent}
            sgkFileContent={sgkFileContent}
            matrixConfig={matrixConfig}
          />
        );
      case 'tab7':
        if (currentUserRole !== 'admin') {
          return null; // Nên được chuyển hướng bởi useEffect, nhưng đây là một biện pháp bảo vệ
        }
        return <Tab6 users={users} />;
      default:
        return null;
    }
  };

  if (authStatus === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-sky-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <svg className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-xl font-semibold">Đang tải ứng dụng...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <LoginScreen onLogin={handleLogin} isLoading={isLoading} error={loginError} />;
  }

  return (
    <div className="min-h-screen bg-transparent text-gray-800 dark:text-gray-200">
      <header className="bg-white dark:bg-gray-800 shadow-md dark:shadow-lg sticky top-0 z-20">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600 dark:text-red-500">
              APP TẠO ĐỀ KIỂM TRA + MA TRẬN ĐẶC TẢ CV 7991 (AI) VER 3.1
            </h1>
            <div className="flex items-center gap-4">
              <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} />

              {/* Api Key Button */}
              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="px-3 py-1 rounded-md text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors text-sm font-bold whitespace-nowrap border border-blue-200 dark:border-blue-800"
                title="Cài đặt API Key"
              >
                API KEY
              </button>

              <div className="h-6 w-px bg-gray-200 dark:bg-gray-600"></div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">{currentUserEmail}</span>
                {currentUserPlan === 'full' && (
                  <>
                    <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full hidden sm:inline">PRO</span>
                    <button
                      onClick={() => setIsChangePasswordModalOpen(true)}
                      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                      aria-label="Đổi mật khẩu"
                      title="Đổi mật khẩu"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            <nav className="flex flex-wrap -mb-px" aria-label="Tabs">
              {TABS_CONFIG.map(tab => {
                const hasRoleRequirement = !!tab.roles && tab.roles.length > 0;
                const userHasRequiredRole = hasRoleRequirement && currentUserRole ? tab.roles.includes(currentUserRole) : false;

                // Một tab có thể NHÌN THẤY nếu không có yêu cầu vai trò, hoặc nếu người dùng có vai trò được yêu cầu.
                const isVisible = !hasRoleRequirement || userHasRequiredRole;

                if (!isVisible) {
                  return null; // Ẩn hoàn toàn tab nếu vai trò không khớp
                }

                // Nếu có thể nhìn thấy, hãy kiểm tra xem nó có nên được bật dựa trên gói không.
                const isAllowedByPlan = currentUserPlan && tab.plans.includes(currentUserPlan);
                const isEnabled = isAllowedByPlan;

                return (
                  <TabButton
                    key={tab.id}
                    label={tab.label}
                    isActive={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    isDisabled={!isEnabled} // Vô hiệu hóa nếu gói không khớp
                  />
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main>
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex flex-col items-center justify-center p-4">
              <svg className="animate-spin h-12 w-12 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="w-full max-w-md bg-gray-200 rounded-full h-4 dark:bg-gray-700 overflow-hidden shadow-inner">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${loadingProgress}%` }}
                >
                  <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <p className="mt-4 text-xl font-semibold text-white">AI đang xử lý: {Math.round(loadingProgress)}%</p>
              <p className="mt-1 text-sm text-gray-300">Vui lòng không đóng trình duyệt...</p>
            </div>
          )}
          {renderTabContent()}
        </div>
        <ChangePasswordModal
          isOpen={isChangePasswordModalOpen}
          onClose={() => setIsChangePasswordModalOpen(false)}
          onChangePassword={handleChangePassword}
        />
        <ApiKeyModal
          isOpen={isApiKeyModalOpen}
          onClose={handleCloseApiKeyModal}
          onSave={handleSaveApiKey}
          currentKey={apiKey}
          isQuotaExceeded={isQuotaExceeded}
        />
        <footer className="text-center py-4 text-gray-600 dark:text-gray-400 text-sm">
          {/* Fix: Replaced the obsolete <marquee> tag with a <p> tag to fix JSX type errors. */}
          <p>Made by Nguyễn Phi Hùng - Mọi chi tiết xin liên hệ Mail : hungba2601@gmail.com – Zalo : 0938750424</p>
        </footer>
      </main>
    </div>
  );
};

export default App;
