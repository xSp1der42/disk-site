import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HardHat, LayoutDashboard, Users, Book, List, Building2, Sun, Moon, LogOut, PieChart } from 'lucide-react';
import { ROLES_CONFIG } from '../utils/constants';

const Sidebar = ({ user, buildings, logout, theme, toggleTheme }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const isActive = (path) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));

    return (
      <aside className="sidebar">
        <div className="brand">
          <HardHat size={26} color="var(--accent-primary)" /> Генезис
        </div>
        
        <div className="user-profile">
            <div className="avatar-circle" style={{background: ROLES_CONFIG[user.role]?.color}}>
                {user.username[0].toUpperCase()}
            </div>
            <div className="user-info">
                <div className="user-name">{user.name || user.username}</div>
                <div className="user-role" style={{color: ROLES_CONFIG[user.role].color}}>
                    {ROLES_CONFIG[user.role].label}
                </div>
            </div>
        </div>

        <nav className="nav-menu">
            <div className="nav-group-title">Меню</div>
            <div className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={18} /> Объекты
            </div>

            {['admin', 'director'].includes(user.role) && (
                 <div className={`nav-item ${isActive('/analytics') ? 'active' : ''}`} onClick={() => navigate('/analytics')}>
                    <PieChart size={18} /> Аналитика
                </div>
            )}
            
            {user.role === 'admin' && (
                <>
                    <div className={`nav-item ${isActive('/users') ? 'active' : ''}`} onClick={() => navigate('/users')}>
                        <Users size={18} /> Сотрудники
                    </div>
                    <div className={`nav-item ${isActive('/groups') ? 'active' : ''}`} onClick={() => navigate('/groups')}>
                        <Book size={18} /> Справочник
                    </div>
                </>
            )}

            {['admin', 'director'].includes(user.role) && (
                <div className={`nav-item ${isActive('/logs') ? 'active' : ''}`} onClick={() => navigate('/logs')}>
                    <List size={18} /> Логи
                </div>
            )}
        </nav>

        <div className="sidebar-footer">
            <div className="theme-toggle" onClick={toggleTheme}>
                <span>{theme === 'light' ? 'Светлая тема' : 'Темная тема'}</span>
                {theme === 'light' ? <Sun size={18}/> : <Moon size={18}/>}
            </div>
            <button className="logout-btn" onClick={logout}>
              <LogOut size={18}/> Выйти
            </button>
        </div>
      </aside>
    );
};

export default Sidebar;