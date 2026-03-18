import React, { useState, useEffect } from 'react';
import type { User } from '../types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User) => void;
  userToEdit: User | null;
  defaultPassword?: string;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, userToEdit, defaultPassword }) => {
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<'free' | 'full'>('full');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setEmail(userToEdit.email);
        setPlan(userToEdit.plan);
        setRole(userToEdit.role || 'user');
        setPassword(userToEdit.password || '');
      } else {
        // Reset for new user
        setEmail('');
        setPlan('full');
        setRole('user');
        setPassword(defaultPassword || '123');
      }
      setError('');
    }
  }, [isOpen, userToEdit, defaultPassword]);

  const handleSave = () => {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Email không hợp lệ.');
      return;
    }
    if (!password.trim()) {
      setError('Mật khẩu không được để trống.');
      return;
    }

    onSave({
      email: email.trim(),
      plan,
      role,
      password,
    });
    onClose();
  };
  
  if (!isOpen) return null;

  const isEditing = !!userToEdit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {isEditing ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                id="user-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isEditing}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
              />
            </div>
             <div>
              <label htmlFor="user-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mật khẩu</label>
              <input
                type="text"
                id="user-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="user-plan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gói</label>
              <select
                id="user-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value as 'free' | 'full')}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="full">PRO (full)</option>
                <option value="free">Miễn phí (free)</option>
              </select>
            </div>
            <div>
              <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vai trò</label>
              <select
                id="user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex justify-end gap-4 rounded-b-lg">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500">
            Hủy
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;