import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Bell, X, Check, CheckCheck, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle, Filter } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll,
    preferences,
    setPreferences 
  } = useNotifications();
  const { user } = useAuth();

  if ((user?.role ?? 'Reader') === 'Reader') {
    return null;
  }

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.action?.link) {
      navigate(notification.action.link);
      setIsOpen(false);
    }
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;
    return date.toLocaleDateString('en-US');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getNotificationStyles = (type: string, read: boolean) => {
    if (!read) {
      switch (type) {
        case 'success': return 'bg-emerald-50/40 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20';
        case 'error': return 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-200/50 dark:border-rose-500/20';
        case 'warning': return 'bg-amber-50/40 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/20';
        default: return 'bg-blue-50/40 dark:bg-blue-500/10 border-blue-200/50 dark:border-blue-500/20';
      }
    }
    return 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5';
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Notification Bell Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="chip-industrial relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-all duration-300 hover:border-cyan-300/60 dark:text-gray-200 dark:hover:border-cyan-300/45 group overflow-hidden"
        whileHover={{ scale: 1.08, y: -3 }}
        whileTap={{ scale: 0.93 }}
        title="Notifications"
      >
        <motion.div 
          className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300"
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <Bell className="w-5 h-5 relative z-10 transition-all duration-300 group-hover:scale-110" />
        {unreadCount > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-[10px] font-bold rounded-full shadow-lg z-20 border border-white/20"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="panel-frame absolute right-0 top-14 w-[400px] bg-card/90 dark:bg-card/75 backdrop-blur-xl shadow-2xl rounded-2xl z-[100] overflow-hidden border border-border/60"
          >
            {/* Header */}
            <div className="p-4 border-b border-border/50 bg-gradient-to-br from-primary/10 via-cyan-400/5 to-transparent relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.1),transparent_70%)] pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base tracking-tight text-foreground">
                    Notifications
                  </h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between relative z-10">
                <div className="flex gap-1.5">
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Read all
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                </div>

                {/* Filter toggle */}
                <button
                  onClick={() => setPreferences({ onlyRequests: !preferences.onlyRequests })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                    preferences.onlyRequests 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                  title="Filter requests only"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Requests
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[480px] overflow-y-auto sidebar-scroll">
              {notifications.length === 0 ? (
                <div className="p-10 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.05),transparent_70%)] pointer-events-none" />
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-border shadow-inner">
                      <Bell className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-foreground font-semibold text-sm">No notifications</p>
                    <p className="text-muted-foreground text-xs mt-1 max-w-[200px] mx-auto leading-relaxed">
                      {preferences.onlyRequests 
                        ? "You don't have any pending requests to review." 
                        : "Everything is quiet for now. You're all caught up!"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {notifications.map((notification) => (
                    <motion.div
                      layout
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group p-3.5 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden ${
                        getNotificationStyles(notification.type, notification.read)
                      }`}
                      whileHover={{ x: 4 }}
                    >
                      {!notification.read && (
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-400" />
                      )}
                      
                      <div className="flex gap-3.5">
                        {/* Icon Container */}
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-xl bg-card border border-border shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                            {getIcon(notification.type)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`font-bold text-sm tracking-tight transition-colors ${
                              !notification.read ? 'text-foreground' : 'text-foreground/70'
                            }`}>
                              {notification.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-all text-muted-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[13px] leading-relaxed text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-border" />
                              {getTimeAgo(notification.timestamp)}
                            </span>
                            {notification.action && (
                              <button
                                onClick={() => handleNotificationClick(notification)}
                                className="text-[11px] font-bold text-primary hover:text-cyan-600 transition-colors uppercase tracking-widest flex items-center gap-1 group/btn"
                              >
                                {notification.action.label}
                                <span className="group-hover/btn:translate-x-1 transition-transform inline-block">→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-muted/30 border-t border-border/50 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                <button 
                  onClick={() => {
                    navigate('/audit-logs');
                    setIsOpen(false);
                  }}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground transition-all uppercase tracking-widest relative z-10"
                >
                  View all activity logs
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

