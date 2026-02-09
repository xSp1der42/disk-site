import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, HelpCircle, Pencil } from 'lucide-react';

const SystemModal = ({ config, close }) => {
    const { type, title, message, onConfirm, placeholder } = config;
    const [val, setVal] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (type === 'prompt' && inputRef.current) inputRef.current.focus();
    }, [type]);

    const handleConfirm = () => {
        if (type === 'prompt') {
            if (!val.trim()) return;
            onConfirm(val);
        } else {
            onConfirm();
        }
        close();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') close();
    }

    let icon, iconColor, btnClass;
    if (type === 'alert') {
        icon = <AlertTriangle size={28} color="#f59e0b"/>; iconColor = '#fef3c7'; btnClass = 'btn-sys-primary';
    } else if (type === 'confirm') {
        icon = <HelpCircle size={28} color="#ef4444"/>; iconColor = '#fee2e2'; btnClass = 'btn-sys-danger';
    } else {
        icon = <Pencil size={28} color="#3b82f6"/>; iconColor = '#dbeafe'; btnClass = 'btn-sys-primary';
    }

    return (
        <div className="system-modal-backdrop" onClick={close}>
            <div className="system-modal" onClick={e => e.stopPropagation()}>
                <div className="system-modal-icon" style={{background: iconColor}}>
                    {icon}
                </div>
                <h3>{title}</h3>
                <p>{message}</p>

                {type === 'prompt' && (
                    <input 
                        ref={inputRef}
                        className="system-modal-input"
                        placeholder={placeholder || 'Введите значение...'}
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                )}

                <div className="system-modal-actions">
                    {type !== 'alert' && (
                        <button className="btn-sys btn-sys-cancel" onClick={close}>Отмена</button>
                    )}
                    <button className={`btn-sys ${btnClass}`} onClick={handleConfirm}>
                        {type === 'alert' ? 'Понятно' : 'Подтвердить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemModal;