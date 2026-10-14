import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Search, Stethoscope } from 'lucide-react';

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user: authUser } = useAuth();
  const user = authUser || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('hx_auth') || sessionStorage.getItem('meridian_user') || 'null');
    } catch {
      return null;
    }
  })();

  const getInitials = (name: string) =>
    name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DR';

  const getRoleLabel = () => {
    if (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'hospital management') return 'Administrator';
    return user?.specialization || user?.department || user?.dept || 'Doctor';
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1>{title || 'Dashboard'}</h1>
      </div>
      <div className="header-right">
        <button className="header-icon-btn" title="Search">
          <Search size={18} />
        </button>
        <button className="header-icon-btn" title="Notifications">
          <Bell size={18} />
        </button>
        {user?.role?.toLowerCase() === 'doctor' && (
          <button className="header-icon-btn" title="On Call">
            <Stethoscope size={18} />
          </button>
        )}
        <div className="header-user">
          <div className="header-user-avatar">
            {user ? getInitials(user.name) : 'U'}
          </div>
          <div className="header-user-info">
            <div className="name">{user?.name}</div>
            <div className="role">{getRoleLabel()}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
