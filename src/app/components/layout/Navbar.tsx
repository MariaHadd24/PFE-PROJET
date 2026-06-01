import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ClipboardList, Command as CommandIcon, FileText, LogOut, Menu, Moon, Search as SearchIcon, Sun, User, Users as UsersIcon, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router';
import { NotificationPanel } from '../ui/NotificationPanel';
import { motion } from 'motion/react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '../ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useData } from '../../context/DataContext';

const logoImage = new URL('../../assets/leoni-logo.svg', import.meta.url).href;

const NavLink = React.forwardRef<
  HTMLAnchorElement,
  { href: string; children: React.ReactNode; className?: string }
>(({ href, children, className }, ref) => {
  return (
    <motion.a
      ref={ref}
      href={href}
      className={className}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.a>
  );
});

export function Navbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { user, logout, updateUser } = useAuth();
  const { themePreference, setThemePreference, isDark } = useTheme();
  const navigate = useNavigate();
  const {
    assets,
    users: usersList,
    maintenanceTickets,
  } = useData();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const profileEmail = useMemo(() => {
    const email = String((user as any)?.email ?? '').trim();
    return email || '—';
  }, [user]);

  const profileName = useMemo(() => {
    const name = String((user as any)?.name ?? '').trim();
    return name;
  }, [user]);

  const profileInitials = useMemo(() => {
    const name = profileName;
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      const a = parts[0]?.[0] ?? 'U';
      const b = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') ?? '';
      return `${String(a).toUpperCase()}${String(b).toUpperCase()}`;
    }

    const email = profileEmail;
    const a = (email && email !== '—' ? email[0] : 'U') ?? 'U';
    return String(a).toUpperCase();
  }, [profileEmail, profileName]);

  const handlePickProfilePhoto = () => {
    profilePhotoInputRef.current?.click();
  };

  const handleProfilePhotoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file', { description: 'Please choose an image file' });
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });

    updateUser({ avatarUrl: dataUrl });
    toast.success('Profile photo updated');
  };

  const handleDeleteProfilePhoto = () => {
    updateUser({ avatarUrl: '' });
    toast.success('Profile photo removed');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key ?? '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  type SearchItem = {
    id: string;
    label: string;
    sublabel?: string;
    group: 'Navigation' | 'Assets' | 'Users' | 'Orders' | 'Maintenance';
    icon?: React.ReactNode;
    onSelect: () => void;
  };

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    items.push(
      {
        id: 'nav-dashboard',
        label: 'Dashboard',
        group: 'Navigation',
        icon: <CommandIcon className="w-4 h-4" />,
        onSelect: () => navigate('/dashboard'),
      },
      {
        id: 'nav-stock',
        label: 'Assets IT',
        group: 'Navigation',
        icon: <ClipboardList className="w-4 h-4" />,
        onSelect: () => navigate('/stock-inventory'),
      },
      {
        id: 'nav-admin',
        label: 'Administration',
        group: 'Navigation',
        icon: <Building2 className="w-4 h-4" />,
        onSelect: () => navigate('/admin'),
      },
      {
        id: 'nav-orders',
        label: 'Orders',
        group: 'Navigation',
        icon: <FileText className="w-4 h-4" />,
        onSelect: () => navigate('/orders'),
      },
      {
        id: 'nav-maintenance',
        label: 'Maintenance',
        group: 'Navigation',
        icon: <Wrench className="w-4 h-4" />,
        onSelect: () => navigate('/maintenance'),
      },
      {
        id: 'nav-licences',
        label: 'Licences',
        group: 'Navigation',
        icon: <FileText className="w-4 h-4" />,
        onSelect: () => navigate('/licences'),
      },
      {
        id: 'nav-pdf-history',
        label: 'Historique PDF',
        group: 'Navigation',
        icon: <FileText className="w-4 h-4" />,
        onSelect: () => navigate('/pdf-history'),
      },
      {
        id: 'nav-sessions',
        label: 'Sessions',
        group: 'Navigation', 
        icon: <UsersIcon className="w-4 h-4" />,
        onSelect: () => navigate('/sessions'),
      },
    );

    for (const a of assets) {
      items.push({
        id: `asset:${a.id}`,
        label: a.assetTag,
        sublabel: `${a.model} • ${a.site} • ${a.status}`,
        group: 'Assets',
        icon: <ClipboardList className="w-4 h-4" />,
        onSelect: () => navigate(`/stock-inventory/${a.id}`),
      });
    }

    for (const u of usersList) {
      items.push({
        id: `user:${u.id}`,
        label: u.name,
        sublabel: `${u.email} • ${u.role}`,
        group: 'Users',
        icon: <UsersIcon className="w-4 h-4" />,
        onSelect: () => navigate(`/admin?tab=users&q=${encodeURIComponent(u.email)}`),
      });
    }

    for (const t of maintenanceTickets) {
      items.push({
        id: `mt:${t.id}`,
        label: t.id,
        sublabel: `${t.status} • ${t.provider}`,
        group: 'Maintenance',
        icon: <Wrench className="w-4 h-4" />,
        onSelect: () => navigate('/maintenance'),
      });
    }

    return items;
  }, [assets, maintenanceTickets, navigate, usersList]);

  return (
    <div className="control-rail fixed top-0 left-0 right-0 z-[100] bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-[0_4px_30px_-10px_rgba(2,6,23,0.2)] transition-all duration-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-300/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(44,102,255,0.14),transparent_44%),radial-gradient(circle_at_100%_0%,rgba(31,197,255,0.12),transparent_42%),linear-gradient(90deg,rgba(15,35,57,0.04),transparent_34%,rgba(198,132,74,0.05)_76%,transparent)]" />
      <div className="mx-auto flex h-20 max-w-[1680px] items-center justify-between px-3 sm:px-6 lg:px-8 gap-3 sm:gap-4 relative z-10">
        <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* Logo Section */}
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <motion.button
            type="button"
            onClick={onToggleSidebar}
            className="chip-industrial relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-foreground transition-all duration-300 hover:border-cyan-300/60 hover:text-primary dark:text-gray-100 dark:hover:border-cyan-300/45 group overflow-hidden"
            whileHover={{ scale: 1.08, y: -3 }}
            whileTap={{ scale: 0.93 }}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300"
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <Menu className="w-5 h-5 relative z-10 transition-all duration-300 group-hover:scale-110" />
          </motion.button>

          {/* Divider */}
          <div className="w-px h-7 bg-gradient-to-b from-white/0 via-white/15 to-white/0 dark:via-white/10" />

          {/* Sophisticated Logo Container */}
          <motion.button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="relative group cursor-pointer"
            title="Go to Dashboard"
            aria-label="Go to Dashboard"
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute -inset-3 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent rounded-xl opacity-0 group-hover:opacity-50 blur-lg transition-all duration-500 group-hover:blur-xl" />
            <motion.div 
              className="absolute -inset-3 bg-gradient-to-r from-primary/20 via-transparent to-transparent rounded-xl opacity-0 transition-all duration-500"
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <div className="panel-frame relative px-5 py-2.5 rounded-xl group-hover:shadow-xl transition-all duration-300 overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-0 group-hover:opacity-70 transition-opacity duration-300" />
              <img src={logoImage} alt="LEONI" className="h-8 w-auto block relative z-10 group-hover:drop-shadow-xl transition-all duration-300 scale-100 group-hover:scale-105" />
            </div>
          </motion.button>
        </motion.div>
        </div>

        {/* Right side */}
        <motion.div 
          className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 lg:gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.button
            onClick={() => setIsSearchOpen(true)}
            className="chip-industrial inline-flex h-11 w-11 items-center justify-center rounded-xl text-foreground shadow-lg shadow-black/5 transition-all duration-200 hover:border-cyan-300/60 dark:text-gray-200 dark:hover:border-cyan-300/45 lg:hidden"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Search (Ctrl+K)"
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </motion.button>

          {/* Global Search */}
          <motion.button
            onClick={() => setIsSearchOpen(true)}
            className="chip-industrial hidden lg:flex min-w-[340px] items-center gap-3 rounded-xl px-4 py-2.5 text-foreground shadow-lg shadow-black/5 transition-all duration-200 hover:border-cyan-300/60 dark:text-gray-200 dark:hover:border-cyan-300/45 group overflow-hidden relative"
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            title="Search (Ctrl+K)"
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-300"
              animate={{ opacity: [0.05, 0.15, 0.05] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <motion.span 
              className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/15 text-primary transition-all group-hover:from-primary/35 group-hover:to-primary/25 group-hover:shadow-lg group-hover:shadow-primary/20 relative z-10"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <SearchIcon className="w-4 h-4" />
            </motion.span>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3 relative z-10">
              <span className="truncate text-sm font-medium text-foreground/80 dark:text-gray-200">Search anything...</span>
              <span className="hidden items-center gap-1.5 rounded-md border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-foreground/75 lg:flex dark:text-gray-200 dark:bg-cyan-300/15 dark:border-cyan-300/35 transition-all">
                <CommandIcon className="h-3 w-3" />
                K
              </span>
            </span>
          </motion.button>

          {/* Divider */}
          <div className="hidden lg:block w-px h-7 bg-gradient-to-b from-white/0 via-white/15 to-white/0 dark:via-white/10" />

          <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} title="Global Search" description="Search assets, users, orders, tickets…">
            <CommandInput placeholder="Search assets, users, orders, tickets…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Navigation">
                {searchItems.filter(i => i.group === 'Navigation').map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      setIsSearchOpen(false);
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Assets">
                {searchItems.filter(i => i.group === 'Assets').slice(0, 12).map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      setIsSearchOpen(false);
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Users">
                {searchItems.filter(i => i.group === 'Users').slice(0, 8).map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      setIsSearchOpen(false);
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Orders">
                {searchItems.filter(i => i.group === 'Orders').slice(0, 8).map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      setIsSearchOpen(false);
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandGroup heading="Maintenance">
                {searchItems.filter(i => i.group === 'Maintenance').slice(0, 8).map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      setIsSearchOpen(false);
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandDialog>

          {/* Theme */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                className="chip-industrial relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-foreground shadow-lg shadow-black/5 transition-all duration-300 hover:border-cyan-300/60 dark:text-gray-200 dark:hover:border-cyan-300/45 group"
                whileHover={{ scale: 1.08, y: -3, rotate: 10 }}
                whileTap={{ scale: 0.93 }}
                title="Theme"
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300"
                  animate={{ opacity: [0.1, 0.2, 0.1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <motion.div
                  initial={false}
                  animate={{ rotate: isDark ? 180 : 0 }}
                  transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                  className="relative z-10"
                >
                  {isDark ? (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.3 }}>
                      <Sun className="w-5 h-5 text-yellow-400" />
                    </motion.div>
                  ) : (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.3 }}>
                      <Moon className="w-5 h-5 text-foreground/80" />
                    </motion.div>
                  )}
                </motion.div>
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={themePreference} onValueChange={(v) => setThemePreference(v as any)}>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Divider */}
          <div className="w-px h-7 bg-gradient-to-b from-white/0 via-white/15 to-white/0 dark:via-white/10" />

          {/* Notifications */}
          <NotificationPanel />

          {/* User menu */}
          <div className="panel-frame flex items-center gap-2 rounded-xl px-1.5 py-1 transition-all duration-300 hover:border-white/35 dark:hover:border-white/20 group overflow-hidden relative">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300"
              animate={{ opacity: [0.05, 0.15, 0.05] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <Popover>
              <PopoverTrigger asChild>
                <motion.button 
                  className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10 relative z-10"
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 350 }}
                    className="rounded-full ring-2 ring-white/40 dark:ring-slate-700/50 shadow-lg shadow-primary/20 transition-all group-hover:ring-white/60 dark:group-hover:ring-slate-600/70"
                  >
                    <Avatar className="size-8 border border-white/30 dark:border-slate-700/60 hover:border-primary/40 dark:hover:border-primary/60 transition-colors">
                      <AvatarImage src={String((user as any)?.avatarUrl ?? '') || undefined} alt={profileEmail} />
                      <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-primary/30 to-primary/15 text-primary dark:from-primary/20 dark:to-primary/10">{profileInitials}</AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <div className="hidden max-w-[140px] text-left lg:block">
                    <motion.div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {profileName || profileEmail}
                    </motion.div>
                    <div className="truncate text-xs text-gray-600 dark:text-gray-400">{profileEmail}</div>
                  </div>
                  <motion.div className="ml-auto">
                    <ChevronDown className="w-4 h-4 text-foreground/70 dark:text-gray-300 transition-transform" />
                  </motion.div>
                </motion.button>
              </PopoverTrigger>

              <PopoverContent align="end" className="panel-frame w-[360px] p-0 shadow-2xl shadow-black/20 backdrop-blur-xl rounded-xl">
                <div className="flex items-center gap-3 border-b border-white/10 p-4 bg-gradient-to-r from-primary/12 via-cyan-300/10 to-transparent dark:from-primary/20 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePickProfilePhoto}
                      className="rounded-full"
                      title="Changer la photo de profil"
                    >
                      <Avatar className="size-12">
                        <AvatarImage src={String((user as any)?.avatarUrl ?? '') || undefined} alt={profileEmail} />
                        <AvatarFallback className="text-sm font-bold">{profileInitials}</AvatarFallback>
                      </Avatar>
                    </button>
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void handleProfilePhotoFile(file);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">{profileName || profileEmail}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{profileName ? profileEmail : 'Clique sur la photo pour changer'}</p>
                    {profileName && <p className="text-xs text-gray-500 mt-0.5">Clique sur la photo pour changer</p>}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 p-3 border-t border-white/10 dark:border-white/5">
                  <button
                    type="button"
                    onClick={handlePickProfilePhoto}
                    className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/50 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                    title="Changer la photo de profil"
                  >
                    Changer photo
                  </button>
                  {(user as any)?.avatarUrl && (
                    <button
                      type="button"
                      onClick={handleDeleteProfilePhoto}
                      className="flex-1 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/50 hover:bg-red-100/70 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                      title="Supprimer la photo de profil"
                    >
                      Supprimer photo
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <motion.button
              onClick={handleLogout}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-900/40 rounded-lg transition-all duration-200 relative z-10 group"
              whileHover={{ scale: 1.15, rotate: -8 }}
              whileTap={{ scale: 0.85 }}
              title="Log out"
            >
              <motion.div 
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 0.5 }}
              >
                <LogOut className="w-5 h-5 group-hover:drop-shadow-lg transition-all" />
              </motion.div>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}