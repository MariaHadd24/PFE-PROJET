import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ClipboardList, Command as CommandIcon, FileText, LogOut, Menu, Moon, Search as SearchIcon, Sun, User, Users as UsersIcon, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router';
import { NotificationPanel } from '../ui/NotificationPanel';
import { motion } from 'motion/react';
import logoImage from '../../assets/leoni-logo.svg';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '../ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useData } from '../../context/DataContext';
import { formatMAD } from '../../lib/money';
import { useNotifications } from '../../context/NotificationContext';

export function Navbar({
  sidebarOpen,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const { user, logout, updateUser, changePassword } = useAuth();
  const { themePreference, setThemePreference, isDark } = useTheme();
  const navigate = useNavigate();
  const {
    assets,
    users: usersList,
    purchaseRequests,
    purchaseOrders,
    maintenanceTickets,
  } = useData();
  const { preferences, setPreferences } = useNotifications();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [profileForm, setProfileForm] = useState({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@company.com',
    department: 'Global IT',
    location: 'San Francisco, HQ',
  });
  const [profileSettings, setProfileSettings] = useState({
    twoFactorAuth: true,
    emailOnAssetAssignment: true,
    browserAlertsOnHighStock: true,
    monthlyInventoryReports: true,
  });

  const toggleProfileSetting = (key: keyof typeof profileSettings) => {
    setProfileSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateProfileField = (key: keyof typeof profileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProfileChanges = () => {
    toast.success('Admin user information saved');
  };

  const resetPasswordDialog = () => {
    setPasswordForm({ current: '', next: '', confirm: '' });
    setPasswordError('');
  };

  const openChangePassword = () => {
    resetPasswordDialog();
    setIsChangePasswordOpen(true);
  };

  const submitChangePassword = async () => {
    setPasswordError('');

    if (!passwordForm.next || passwordForm.next.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }

    const res = await changePassword(passwordForm.current, passwordForm.next);
    if (!res.ok) {
      setPasswordError(String(res.error ?? 'Unable to change password'));
      return;
    }

    toast.success('Password changed');
    setIsChangePasswordOpen(false);
    resetPasswordDialog();
  };

  useEffect(() => {
    if (!user?.email) return;
    setProfileForm((prev) => ({ ...prev, email: user.email }));
  }, [user?.email]);

  const profileInitials = useMemo(() => {
    const first = String(profileForm.firstName ?? '').trim();
    const last = String(profileForm.lastName ?? '').trim();
    const a = first ? first[0] : String(user?.name ?? 'U').trim()[0] ?? 'U';
    const b = last ? last[0] : (String(user?.name ?? '').trim().split(/\s+/).slice(-1)[0]?.[0] ?? '');
    return `${String(a).toUpperCase()}${String(b).toUpperCase()}`;
  }, [profileForm.firstName, profileForm.lastName, user?.name]);

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

    for (const pr of purchaseRequests) {
      items.push({
        id: `pr:${pr.id}`,
        label: pr.id,
        sublabel: `${pr.department} • ${pr.status} • ${formatMAD(pr.budget)}`,
        group: 'Orders',
        icon: <FileText className="w-4 h-4" />,
        onSelect: () => navigate('/orders'),
      });
    }

    for (const po of purchaseOrders) {
      items.push({
        id: `po:${po.id}`,
        label: po.id,
        sublabel: `${po.supplier} • ${po.status} • ${formatMAD(po.total)}`,
        group: 'Orders',
        icon: <FileText className="w-4 h-4" />,
        onSelect: () => navigate('/orders'),
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
  }, [assets, maintenanceTickets, navigate, purchaseOrders, purchaseRequests, usersList]);

  return (
    <div className="fixed top-0 left-0 right-0 h-20 bg-gradient-to-b from-white/95 via-white/90 to-white/85 dark:from-gray-900/95 dark:via-gray-900/90 dark:to-gray-900/85 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 z-40 shadow-lg transition-colors duration-300">
      {/* Premium highlight line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      <div className="h-full px-8 flex items-center justify-between">
        {/* Logo Section */}
        <motion.div 
          className="flex items-center gap-5"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.button
            type="button"
            onClick={onToggleSidebar}
            className="p-2.5 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-gray-800/70 rounded-xl transition-all duration-200"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.98 }}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          {/* Sophisticated Logo Container */}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="relative group cursor-pointer"
            title="Go to Dashboard"
            aria-label="Go to Dashboard"
          >
            {/* Animated background glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-primary via-primary/70 to-primary/50 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500 animate-pulse"></div>
            
            {/* Logo Card */}
            <div className="relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 px-6 py-2 rounded-xl shadow-xl border-2 border-white dark:border-gray-700 group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary rounded-tl-lg opacity-60"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary/70 rounded-br-lg opacity-60"></div>
              
              <img src={logoImage} alt="LEONI" className="h-10 w-auto block relative z-10 group-hover:brightness-110 transition-all duration-300" />
            </div>
          </button>
          
          {/* Elegant Divider */}
          <div className="h-14 w-px bg-gradient-to-b from-transparent via-primary/30 dark:via-primary/30 to-transparent"></div>
          
          {/* Brand Identity */}
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">Enterprise Asset Management Platform</p>
          </div>
        </motion.div>

        {/* Right side */}
        <motion.div 
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Global Search */}
          <motion.button
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-gray-200/70 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-white hover:dark:bg-gray-800 transition-colors"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            title="Search (Ctrl+K)"
          >
            <SearchIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Search…</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <CommandIcon className="w-3.5 h-3.5" />
              K
            </span>
          </motion.button>

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
                className="relative p-2 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 hover:shadow-lg transition-all duration-300 group overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Theme"
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: isDark ? 180 : 0 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                >
                  {isDark ? (
                    <Sun className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700" />
                  )}
                </motion.div>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/20 rounded-xl"
                  initial={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
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

          {/* Notifications */}
          <NotificationPanel />

          {/* User menu */}
          <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <motion.div
                    whileHover={{ scale: 1.08, rotate: 3 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="rounded-full"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={String((user as any)?.avatarUrl ?? '') || undefined} alt={profileForm.email} />
                      <AvatarFallback className="text-xs font-semibold">{profileInitials}</AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <div className="text-sm text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{profileForm.email}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-[440px] p-0 border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePickProfilePhoto}
                        className="rounded-full"
                        title="Change profile photo"
                      >
                        <Avatar className="size-10">
                          <AvatarImage src={String((user as any)?.avatarUrl ?? '') || undefined} alt={profileForm.email} />
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
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{profileForm.email}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Joined on Mar 12, 2024</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveProfileChanges}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-xs font-medium"
                  >
                    Save Changes
                  </button>
                </div>

                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Personal Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <label className="text-gray-500 text-xs">First Name</label>
                        <Input
                          value={profileForm.firstName}
                          onChange={(e) => updateProfileField('firstName', e.target.value)}
                          className="h-8 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs">Last Name</label>
                        <Input
                          value={profileForm.lastName}
                          onChange={(e) => updateProfileField('lastName', e.target.value)}
                          className="h-8 mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-gray-500 text-xs">Email Address</label>
                        <Input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => updateProfileField('email', e.target.value)}
                          className="h-8 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs">Department</label>
                        <Input
                          value={profileForm.department}
                          onChange={(e) => updateProfileField('department', e.target.value)}
                          className="h-8 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs">Location</label>
                        <Input
                          value={profileForm.location}
                          onChange={(e) => updateProfileField('location', e.target.value)}
                          className="h-8 mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Security Settings</h4>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Two-Factor Authentication</div>
                        <div className="text-xs text-gray-500">Extra security for your account</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-300">{profileSettings.twoFactorAuth ? 'Enabled' : 'Disabled'}</span>
                        <Switch
                          checked={profileSettings.twoFactorAuth}
                          onCheckedChange={() => toggleProfileSetting('twoFactorAuth')}
                          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openChangePassword}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-xs font-medium"
                    >
                      Change Password
                    </button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notification Settings</h4>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Only request notifications (demandes)</span>
                      <Switch
                        checked={preferences.onlyRequests}
                        onCheckedChange={(checked) => setPreferences({ onlyRequests: Boolean(checked) })}
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Email on Asset Assignment</span>
                      <Switch
                        checked={profileSettings.emailOnAssetAssignment}
                        onCheckedChange={() => toggleProfileSetting('emailOnAssetAssignment')}
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Browser Alerts on High Stock</span>
                      <Switch
                        checked={profileSettings.browserAlertsOnHighStock}
                        onCheckedChange={() => toggleProfileSetting('browserAlertsOnHighStock')}
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300"
                      />
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Monthly Inventory Reports</span>
                      <Switch
                        checked={profileSettings.monthlyInventoryReports}
                        onCheckedChange={() => toggleProfileSetting('monthlyInventoryReports')}
                        className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-gray-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Login Activity</h4>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-gray-100">Chrome on Windows</span>
                      <span className="text-gray-500">192.168.1.1 • 2 mins ago</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-gray-100">Safari on iPhone</span>
                      <span className="text-gray-500">172.16.0.1 • 5 hours ago</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-gray-100">Firefox on macOS</span>
                      <span className="text-gray-500">10.0.0.1 • 1 day ago</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Dialog
              open={isChangePasswordOpen}
              onOpenChange={(open) => {
                setIsChangePasswordOpen(open);
                if (!open) resetPasswordDialog();
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Current password</label>
                    <Input
                      type="password"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                      className="h-9 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">New password</label>
                    <Input
                      type="password"
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                      className="h-9 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Confirm new password</label>
                    <Input
                      type="password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                      className="h-9 mt-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void submitChangePassword();
                        }
                      }}
                    />
                  </div>

                  {passwordError && <div className="text-sm text-red-600">{passwordError}</div>}
                </div>

                <DialogFooter>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setIsChangePasswordOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                    onClick={() => void submitChangePassword()}
                  >
                    Save
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <motion.button
              onClick={handleLogout}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Log out"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}