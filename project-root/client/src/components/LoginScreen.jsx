import React from 'react';
import { HardHat, User as UserIcon, Lock } from 'lucide-react';

const LoginScreen = ({ handleLogin, loginInput, setLoginInput }) => (
    <div className="login-screen">
        <div className="login-card">
          <div className="login-header">
            <div style={{display:'inline-flex', padding: 12, borderRadius: '50%', background: '#e0f2fe', marginBottom: 10}}>
                <HardHat size={40} color="#0284c7" />
            </div>
            <h1>ГЕНЕЗИС</h1>
            <p style={{color:'var(--text-muted)'}}>Система управления строительством</p>
          </div>
          <form onSubmit={handleLogin}>
              <div className="input-group">
                  <UserIcon size={18}/>
                  <input 
                    type="text" placeholder="Логин" required
                    value={loginInput.username}
                    onChange={e => setLoginInput({...loginInput, username: e.target.value})}
                  />
              </div>
              <div className="input-group">
                  <Lock size={18}/>
                  <input 
                    type="password" placeholder="Пароль" required
                    value={loginInput.password}
                    onChange={e => setLoginInput({...loginInput, password: e.target.value})}
                  />
              </div>
              <button type="submit" className="auth-btn">Войти в систему</button>
          </form>
        </div>
      </div>
);

export default LoginScreen;