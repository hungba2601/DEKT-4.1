// Thay đổi URL thành URL Google Apps Script sau khi bạn "Triển khai" (Deploy) dưới dạng Web App
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQBrkbe0GsoN4E_IGc9xectS-ZyXQvABlD1OGCSS1GIypzJfK6IolGsvpJbKONlKtUIQ/exec';

export interface LoginResponse {
    success: boolean;
    message?: string;
    plan?: 'full' | 'free';
}

export const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('skkn_device_id');
    if (!deviceId) {
        if (window.crypto && window.crypto.randomUUID) {
            deviceId = window.crypto.randomUUID();
        } else {
            // Fallback for older browsers
            deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        }
        localStorage.setItem('skkn_device_id', deviceId);
    }
    return deviceId;
};

export const loginWithGoogleSheet = async (account: string, password: string): Promise<LoginResponse> => {
    const deviceId = getDeviceId();

    try {
        // Chế độ 'no-cors' không cho phép đọc kết quả response, 
        // vì vậy chúng ta cần phía Google Apps Script xử lý CORS hoặc sử dụng chế độ JSONP nếu cần.
        // Tuy nhiên, GAS Web App thường được gọi qua fetch với method POST.

        // CHÚ Ý: Google Apps Script yêu cầu redirect, fetch sẽ tự động theo sau nếu ko dùng no-cors.
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors', // Đảm bảo GAS đã được cấu hình CORS (thường GAS set Content-Type JSON là ok)
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // GAS doPost thường nhận text/plain rồi JSON.parse
            },
            body: JSON.stringify({
                action: 'login',
                account: account.trim(),
                password: password.trim(),
                deviceId: deviceId
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Login error:', error);
        // Nếu URL chưa có hoặc lỗi, có thể cho phép đăng nhập offline bằng INITIAL_USERS
        return { success: false, message: 'Lỗi kết nối máy chủ xác thực' };
    }
};
