import React from 'react';
import type { User } from '../types';

interface Tab6Props {
  users: User[];
}

const Tab6: React.FC<Tab6Props> = ({ users }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Quản lý phân quyền người dùng</h2>
        <p className="mt-2 text-red-600 dark:text-red-400 font-semibold">Đây là danh sách người dùng được phép truy cập phần mềm. Muốn xóa, thêm mới, chỉnh sửa xin liên hệ admin.</p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead className="bg-gray-100 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 uppercase">
              <tr>
                <th scope="col" className="px-6 py-3">Email</th>
                <th scope="col" className="px-6 py-3">Gói</th>
                <th scope="col" className="px-6 py-3">Vai trò</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-medium">{user.email === '*' ? 'Tất cả người dùng (Miễn phí)' : user.email}</td>
                  <td className="px-6 py-4">
                    {user.plan === 'full' ? (
                      <span className="text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-1 rounded-full">PRO</span>
                    ) : (
                      <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold px-2 py-1 rounded-full">Free</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'admin' ? (
                       <span className="text-xs bg-red-500 text-white font-bold px-2 py-1 rounded-full">Admin</span>
                    ) : (
                      <span className="text-xs text-gray-500">User</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Tab6;