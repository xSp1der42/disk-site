import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate, Outlet } from 'react-router-dom';
import socket from './utils/socket';
import './App.css';

// Компоненты
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import SystemModal from './components/SystemModal';
import RoomModal from './components/RoomModal';

// Страницы
import DashboardIndex from './pages/DashboardIndex';
import BuildingPage from './pages/BuildingPage'; // Теперь это список Договоров
import ContractPage from './pages/ContractPage'; // НОВАЯ СТРАНИЦА: Этажи и Помещения
import GroupsPage from './pages/GroupsPage';
import UsersPage from './pages/UsersPage';
import LogsPage from './pages/LogsPage';
import AnalyticsPage from './pages/AnalyticsPage';

const ProtectedLayout = ({ user, buildings, logout, theme, toggleTheme, selectedRoom, setSelectedRoom, actions, groups, sysActions }) => {
    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="app-wrapper">
            <Sidebar user={user} buildings={buildings} logout={logout} theme={theme} toggleTheme={toggleTheme} />
            <main className="main-content">
                <Outlet />
            </main>
            {selectedRoom && (
                <RoomModal 
                    selectedRoom={selectedRoom} 
                    setSelectedRoom={setSelectedRoom} 
                    hasEditRights={['admin', 'architect'].includes(user.role)}
                    currentUser={user}
                    actions={actions}
                    groups={groups}
                    sysActions={sysActions}
                />
            )}
        </div>
    );
};

function App() {
  const [user, setUser] = useState(null); 
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [buildings, setBuildings] = useState([]);
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loginInput, setLoginInput] = useState({ username: '', password: '' });
  const [modalConfig, setModalConfig] = useState(null);

  const navigate = useNavigate();

  const sysActions = useMemo(() => ({
      alert: (title, message, onConfirm) => {
          setModalConfig({ type: 'alert', title, message, onConfirm: onConfirm || (() => {}) });
      },
      confirm: (title, message, onConfirm) => {
          setModalConfig({ type: 'confirm', title, message, onConfirm });
      },
      prompt: (title, message, onConfirm, placeholder) => {
          setModalConfig({ type: 'prompt', title, message, onConfirm, placeholder });
      }
  }), []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch (e) { localStorage.removeItem('user'); }
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    socket.on('init_data', (data) => {
      // Глубокая сортировка: Объекты -> Договоры -> Этажи -> Помещения
      const sorted = data.map(b => ({
          ...b,
          contracts: (b.contracts || []).sort((a,b) => (a.order||0) - (b.order||0)).map(c => ({
              ...c,
              floors: (c.floors || []).sort((a,b) => (a.order||0) - (b.order||0)).map(f => ({
                  ...f,
                  rooms: (f.rooms || []).sort((a,b) => (a.order||0) - (b.order||0))
              }))
          }))
      }));
      setBuildings(sorted);
      
      // Обновление выбранной комнаты (live update)
      if (selectedRoom) {
        const b = sorted.find(b => b.id === selectedRoom.buildingId);
        const c = b?.contracts.find(c => c.id === selectedRoom.contractId);
        const f = c?.floors.find(f => f.id === selectedRoom.floorId);
        const r = f?.rooms.find(r => r.id === selectedRoom.room.id);
        if (r) setSelectedRoom({ ...selectedRoom, room: r });
      }
    });

    socket.on('init_groups', (data) => setGroups(data));

    socket.on('login_success', (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setLoginInput({ username: '', password: '' });
        navigate('/dashboard');
        if (userData.role === 'admin') socket.emit('get_users_list', { user: userData });
    });

    socket.on('login_error', (msg) => sysActions.alert("Ошибка входа", msg));
    socket.on('user_saved', () => { sysActions.alert("Успешно", "Данные сотрудника сохранены!"); socket.emit('get_users_list', { user }); });
    socket.on('users_list_update', (list) => setAllUsers(list));
    socket.on('operation_error', (msg) => sysActions.alert("Ошибка", msg));

    return () => {
      socket.off('init_data'); socket.off('init_groups'); socket.off('login_success');
      socket.off('login_error'); socket.off('user_saved'); socket.off('users_list_update'); socket.off('operation_error');
    };
  }, [selectedRoom, user, sysActions, navigate]);

  const handleLogin = (e) => { e.preventDefault(); socket.emit('login', loginInput); };
  const logout = () => { localStorage.removeItem('user'); setUser(null); navigate('/login'); };
  const emitAction = (event, payload) => socket.emit(event, { ...payload, user });

  const actions = {
      createBuilding: (name) => emitAction('create_building', { name }),
      createContract: (buildingId, name) => emitAction('create_contract', { buildingId, name }),
      addFloor: (buildingId, contractId, name) => emitAction('add_floor', { buildingId, contractId, name }),
      addRoom: (buildingId, contractId, floorId, name) => emitAction('add_room', { buildingId, contractId, floorId, name }),
      
      deleteItem: (type, ids) => {
            emitAction('delete_item', { type, ids });
            if (type === 'building') navigate('/dashboard');
            if (type === 'contract') navigate(`/dashboard/${ids.buildingId}`);
      },
      
      reorderItem: (type, buildingId, contractId, floorId, sourceIndex, destinationIndex) => {
          emitAction('reorder_item', { type, buildingId, contractId, floorId, sourceIndex, destinationIndex });
      },
      
      moveItem: (type, direction, ids) => emitAction('move_item', { type, direction, ids }), // Для объектов и договоров
      renameItem: (type, ids, newName) => emitAction('rename_item', { type, ids, newName }),
      copyItem: (type, ids) => emitAction('copy_item', { type, ids }),
      
      createGroup: (name) => emitAction('create_group', { name }),
      deleteGroup: (groupId) => emitAction('delete_group', { groupId }),
      
      addTask: (buildingId, contractId, floorId, roomId, taskData) => {
          emitAction('add_task', { 
              buildingId, contractId, floorId, roomId, 
              taskName: taskData.name, groupId: taskData.groupId, 
              volume: taskData.volume, unit: taskData.unit, unit_power: taskData.unit_power,
              type: taskData.type 
          });
      },
      
      editTask: (buildingId, contractId, floorId, roomId, taskId, data) => emitAction('edit_task', { buildingId, contractId, floorId, roomId, taskId, data }),
      toggleTask: (buildingId, contractId, floorId, roomId, taskId, field, value) => {
        if (user.role === 'director' || user.role === 'architect') return; 
        if (field === 'work_done' && !['prorab', 'admin'].includes(user.role)) {
            sysActions.alert("Нет прав", "Только Прораб или Админ может отмечать выполнение!"); return;
        }
        if (field === 'doc_done' && !['pto', 'admin'].includes(user.role)) {
            sysActions.alert("Нет прав", "Только ПТО или Админ может принимать документацию!"); return;
        }
        emitAction('toggle_task_status', { buildingId, contractId, floorId, roomId, taskId, field, value: !value });
      },
      updateTaskDates: (buildingId, contractId, floorId, roomId, taskId, dates) => emitAction('update_task_dates', { buildingId, contractId, floorId, roomId, taskId, dates }),
      addTaskComment: (buildingId, contractId, floorId, roomId, taskId, text) => emitAction('add_task_comment', { buildingId, contractId, floorId, roomId, taskId, text })
  };

  return (
      <>
          <Routes>
              <Route path="/login" element={!user ? <LoginScreen handleLogin={handleLogin} loginInput={loginInput} setLoginInput={setLoginInput} /> : <Navigate to="/dashboard" />} />
              
              <Route element={<ProtectedLayout user={user} buildings={buildings} logout={logout} theme={theme} toggleTheme={toggleTheme} selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom} actions={actions} groups={groups} sysActions={sysActions} />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardIndex buildings={buildings} user={user} actions={actions} sysActions={sysActions} />} />
                  <Route path="/dashboard/:id" element={<BuildingPage buildings={buildings} user={user} actions={actions} sysActions={sysActions} />} />
                  <Route path="/dashboard/:buildingId/:contractId" element={<ContractPage buildings={buildings} user={user} actions={actions} setSelectedRoom={setSelectedRoom} groups={groups} sysActions={sysActions} />} />
                  <Route path="/analytics" element={['admin', 'director'].includes(user?.role) ? <AnalyticsPage buildings={buildings} user={user} /> : <Navigate to="/dashboard"/>} />
                  <Route path="/groups" element={user?.role === 'admin' ? <GroupsPage user={user} groups={groups} actions={actions} buildings={buildings} setSelectedRoom={setSelectedRoom} sysActions={sysActions} /> : <Navigate to="/dashboard"/>} />
                  <Route path="/users" element={user?.role === 'admin' ? <UsersPage user={user} allUsers={allUsers} setAllUsers={setAllUsers} refreshUsers={() => socket.emit('get_users_list', { user })} sysActions={sysActions} /> : <Navigate to="/dashboard"/>} />
                  <Route path="/logs" element={['admin', 'director'].includes(user?.role) ? <LogsPage user={user} /> : <Navigate to="/dashboard"/>} />
              </Route>
          </Routes>
          {modalConfig && <SystemModal config={modalConfig} close={() => setModalConfig(null)} />}
      </>
  );
}

export default App;