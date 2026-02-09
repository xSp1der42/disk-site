import React, { useState, useEffect } from 'react';
import { Search, Pencil, Trash2, User as UserIcon, Lock, Phone, Briefcase } from 'lucide-react';
import socket from '../utils/socket';
import { ROLES_CONFIG } from '../utils/constants';

const UsersPage = ({ user, allUsers, setAllUsers, refreshUsers, sysActions }) => {
    const [userForm, setUserForm] = useState({ username: '', password: '', role: 'prorab', name: '', surname: '', phone: '', _id: null });
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [searchUser, setSearchUser] = useState('');

    useEffect(() => { refreshUsers(); }, []);

    const resetUserForm = () => {
        setUserForm({ username: '', password: '', role: 'prorab', name: '', surname: '', phone: '', _id: null });
        setIsEditingUser(false);
    };

    const handleSaveUser = (e) => {
        e.preventDefault();
        if (isEditingUser) {
            socket.emit('admin_edit_user', { userData: userForm, user });
        } else {
            if(!userForm.username || !userForm.password) { sysActions.alert("Ошибка", "Логин и пароль обязательны!"); return; }
            socket.emit('admin_create_user', { newUserData: userForm, user });
        }
        resetUserForm();
    };

    const handleEditUserClick = (u) => {
        setUserForm({ ...u, password: '' }); 
        setIsEditingUser(true);
    };

    const handleDeleteUser = (targetUserId) => {
        sysActions.confirm("Удаление сотрудника", "Удалить сотрудника из системы? Доступ будет закрыт.", () => {
            socket.emit('admin_delete_user', { targetUserId, user });
        });
    };

    // Filter users logic
    const filteredUsers = allUsers.filter(u => {
        const term = searchUser.toLowerCase();
        return u.username.toLowerCase().includes(term) || 
               u.name.toLowerCase().includes(term) || 
               u.surname.toLowerCase().includes(term);
    });

    return (
        <div className="users-management-container" style={{padding: '32px', height:'100%', overflow:'hidden'}}>
             <div className="users-list-section">
                 <div className="section-title">Список пользователей</div>
                 
                 <div className="logs-toolbar" style={{marginBottom: 16}}>
                    <div style={{position: 'relative', width: '100%'}}>
                        <Search size={16} style={{position:'absolute', left:12, top: 12, color:'var(--text-muted)'}}/>
                        <input 
                            className="search-input" 
                            style={{width: '100%'}}
                            placeholder="Поиск по имени или логину..." 
                            value={searchUser}
                            onChange={e => setSearchUser(e.target.value)}
                        />
                    </div>
                 </div>

                 <table className="users-table">
                     <thead>
                         <tr>
                             <th>ФИО</th>
                             <th>Логин</th>
                             <th>Роль</th>
                             <th>Телефон</th>
                             <th style={{width: 80}}>Действия</th>
                         </tr>
                     </thead>
                     <tbody>
                         {filteredUsers.map(u => (
                             <tr key={u._id}>
                                 <td>{u.surname} {u.name}</td>
                                 <td><strong>{u.username}</strong></td>
                                 <td>
                                     <span style={{color: ROLES_CONFIG[u.role]?.color, fontWeight:'700', fontSize:'0.75rem'}}>
                                        {ROLES_CONFIG[u.role]?.label}
                                     </span>
                                 </td>
                                 <td>{u.phone || '-'}</td>
                                 <td style={{display:'flex', gap:5}}>
                                     <button className="icon-btn-edit" onClick={() => handleEditUserClick(u)} title="Редактировать">
                                         <Pencil size={16}/>
                                     </button>
                                     <button className="icon-btn-danger" onClick={() => handleDeleteUser(u._id)} title="Удалить">
                                         <Trash2 size={16}/>
                                     </button>
                                 </td>
                             </tr>
                         ))}
                         {filteredUsers.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding: 20}}>Сотрудники не найдены</td></tr>}
                     </tbody>
                 </table>
             </div>

             <div className="user-form-section">
                 <div className="section-title">
                     {isEditingUser ? 'Редактирование' : 'Новый сотрудник'}
                     {isEditingUser && <button className="text-btn" onClick={resetUserForm}>Отмена</button>}
                 </div>
                 <form onSubmit={handleSaveUser}>
                     <div className="input-group">
                         <UserIcon size={16}/>
                         <input type="text" placeholder="Логин" required value={userForm.username} onChange={e=>setUserForm({...userForm, username: e.target.value})}/>
                     </div>
                     <div className="input-group">
                         <Lock size={16}/>
                         <input 
                            type="password" 
                            placeholder={isEditingUser ? "Пароль (пусто - без изменений)" : "Пароль"} 
                            required={!isEditingUser} 
                            value={userForm.password} 
                            onChange={e=>setUserForm({...userForm, password: e.target.value})}
                         />
                     </div>
                     <div style={{display:'flex', gap: 10}}>
                        {/* ИКОНКИ ЗАМЕНЕНЫ ЗДЕСЬ НА UserIcon */}
                        <div className="input-group" style={{flex:1}}>
                            <UserIcon size={16}/>
                            <input type="text" placeholder="Имя" value={userForm.name} onChange={e=>setUserForm({...userForm, name: e.target.value})}/>
                        </div>
                        <div className="input-group" style={{flex:1}}>
                            <UserIcon size={16}/>
                            <input type="text" placeholder="Фамилия" value={userForm.surname} onChange={e=>setUserForm({...userForm, surname: e.target.value})}/>
                        </div>
                     </div>
                     <div className="input-group">
                         <Phone size={16}/>
                         <input type="text" placeholder="Телефон" value={userForm.phone} onChange={e=>setUserForm({...userForm, phone: e.target.value})}/>
                     </div>
                     <div className="input-group">
                         <Briefcase size={16}/>
                         <select value={userForm.role} onChange={e=>setUserForm({...userForm, role: e.target.value})}>
                             <option value="prorab">Прораб</option>
                             <option value="pto">Инженер ПТО</option>
                             <option value="architect">Проектировщик</option>
                             <option value="director">Директор</option>
                             <option value="admin">Администратор</option>
                         </select>
                     </div>
                     <button type="submit" className="auth-btn">
                         {isEditingUser ? 'Сохранить' : 'Создать'}
                     </button>
                 </form>
             </div>
        </div>
    );
};

export default UsersPage;