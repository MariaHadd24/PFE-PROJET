import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Package, Users, Briefcase, X } from 'lucide-react';
import { patchUser } from '../data/api';
import { AddUserModal } from '../components/ui/AddUserModal';
import { AddSiteModal } from '../components/ui/AddSiteModal';
import { AddCategoryModal } from '../components/ui/AddCategoryModal';
import { AddSupplierModal } from '../components/ui/AddSupplierModal';
import { AddDepartmentModal } from '../components/ui/AddDepartmentModal';
import { AddRoleModal } from '../components/ui/AddRoleModal';
import { useNotifications } from '../context/NotificationContext';
import { toast } from 'sonner';
import { ROLE_LABEL } from '../lib/rbac';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLocation } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { useData } from '../context/DataContext';

type TabType = 'users' | 'roles' | 'sites' | 'categories' | 'suppliers' | 'departments';

type DepartmentRow = {
  id: string;
  name: string;
  code?: string;
  head?: string;
  members?: number;
  description?: string;
};

type RoleRow = {
  id: string;
  role: string;
  desc: string;
};

function normalizeDepartment(input: any): DepartmentRow {
  const name = String(input?.name ?? '').trim();
  const code = input?.code ? String(input.code).trim() : '';
  const head = input?.head ? String(input.head).trim() : (input?.manager ? String(input.manager).trim() : '');
  const members = typeof input?.members === 'number' ? input.members : 0;
  const description = input?.description ? String(input.description).trim() : '';
  const id = String(input?.id ?? code ?? `DEPT-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return { id, name, code, head, members, description };
}

export function AdminPage() {
  const location = useLocation();
  const {
    users,
    sites,
    categories,
    suppliers,
    assets,
    departments,
    addUser,
    addSite,
    addCategory,
    addSupplier,
    addDepartment,
    updateUser,
    removeUser,
    updateSite,
    removeSite,
    updateCategory,
    removeCategory,
    updateSupplier,
    removeSupplier,
    updateDepartment,
    removeDepartment,
    refreshAll,
  } = useData();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingSite, setEditingSite] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentRow | null>(null);
  
  const [usersList, setUsersList] = useState(users);
  const [sitesList, setSitesList] = useState(sites);
  const [categoriesList, setCategoriesList] = useState(categories);
  const [suppliersList, setSuppliersList] = useState(suppliers);
  const [assetsList, setAssetsList] = useState(assets);
  const [departmentsList, setDepartmentsList] = useState<DepartmentRow[]>(
    (departments ?? []).map((d: any) => normalizeDepartment(d)),
  );

  const [rolesList, setRolesList] = useState<RoleRow[]>([
    { id: 'ROLE-ADMIN', role: 'Admin', desc: 'Full access to all features.' },
    { id: 'ROLE-TECH', role: 'Technician', desc: 'Manages assets, maintenance, and stock movements.' },
    { id: 'ROLE-MANAGER', role: 'Manager', desc: 'Approves requests and views reports.' },
    { id: 'ROLE-READER', role: 'Reader', desc: 'Read-only access (inventory, reports).' },
  ]);

  const [userSearch, setUserSearch] = useState('');
  const userSearchInputRef = useRef<HTMLInputElement | null>(null);
  const userPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoTargetUserId, setPhotoTargetUserId] = useState<string>('');
  const photoTargetUserIdRef = useRef<string>('');
  
  const { addNotification } = useNotifications();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => setUsersList(users), [users]);
  useEffect(() => setSitesList(sites), [sites]);
  useEffect(() => setCategoriesList(categories), [categories]);
  useEffect(() => setSuppliersList(suppliers), [suppliers]);
  useEffect(() => setAssetsList(assets), [assets]);
  useEffect(() => setDepartmentsList((departments ?? []).map((d: any) => normalizeDepartment(d))), [departments]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const qParam = params.get('q');

    const isValidTab = (t: any): t is TabType => {
      return t === 'users' || t === 'roles' || t === 'sites' || t === 'categories' || t === 'suppliers' || t === 'departments';
    };

    if (isValidTab(tabParam)) {
      setActiveTab(tabParam);
    }

    if (qParam && (!tabParam || tabParam === 'users')) {
      setActiveTab('users');
      setUserSearch(qParam);
      queueMicrotask(() => userSearchInputRef.current?.focus());
    }
  }, [location.search]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key ?? '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'k') {
        e.preventDefault();
        if (activeTab === 'users') {
          userSearchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  const rolesWithCount = useMemo(() => {
    return rolesList.map(r => {
      const usersCount = usersList.filter(u => String((u as any).role) === r.role).length;
      return { ...r, usersCount };
    });
  }, [rolesList, usersList]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(u => {
      const name = String((u as any).name ?? '').toLowerCase();
      const email = String((u as any).email ?? '').toLowerCase();
      const role = String((u as any).role ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [userSearch, usersList]);

  const initialsOf = (name: string) => {
    const clean = String(name ?? '').trim();
    if (!clean) return 'U';
    const parts = clean.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? 'U';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return `${a}${b}`.toUpperCase();
  };

  const openPhotoPicker = (userId: string) => {
    setPhotoTargetUserId(userId);
    photoTargetUserIdRef.current = userId;
    queueMicrotask(() => userPhotoInputRef.current?.click());
  };

  const handlePhotoFile = async (file: File) => {
    const targetId = photoTargetUserIdRef.current;
    if (!targetId) return;
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

    let updatedName = 'User';
    setUsersList(prev =>
      prev.map((u: any) => {
        if (String(u.id) !== targetId) return u;
        updatedName = String(u?.name ?? updatedName);
        return { ...u, avatarUrl: dataUrl };
      }),
    );

    try {
      await updateUser(targetId, { avatarUrl: dataUrl } as any);
    } catch {
    }

    void refreshAll();

    toast.success('Profile photo updated', { description: updatedName });
    setPhotoTargetUserId('');
    photoTargetUserIdRef.current = '';
  };

  const handleAddUser = async (newUser: any) => {
    try {
      const created = await addUser(newUser);
      setUsersList(prev => [created, ...prev]);
      toast.success('User created', {
        description: `${created.name} (${created.role}) added successfully`
      });
      addNotification({
        type: 'info',
        title: 'New user created',
        message: `${created.name} - ${created.email} (${created.role})`,
        action: { label: 'View users', link: '/admin' }
      });
    } catch (e: any) {
      toast.error('Unable to create user', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleUpdateUser = async (userPayload: any) => {
    try {
      const updated = await updateUser(String(userPayload?.id), {
        name: userPayload?.name,
        email: userPayload?.email,
        role: userPayload?.role,
        avatarUrl: userPayload?.avatarUrl,
        signatureData: userPayload?.signatureData,
      } as any);
      setUsersList((prev) => prev.map((u: any) => (String(u.id) === String(updated.id) ? updated : u)));
      toast.success('User updated', { description: updated.name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to update user', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleDeleteUser = async (user: any) => {
    const id = String(user?.id ?? '');
    if (!id) return;
    const name = String(user?.name ?? 'this user');
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      await removeUser(id);
      setUsersList((prev) => prev.filter((u: any) => String(u.id) !== id));
      toast.success('User deleted', { description: name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to delete user', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddSite = async (newSite: any) => {
    try {
      const created = await addSite({
        id: newSite?.id,
        name: newSite?.name,
        codeIt: newSite?.codeIt,
        location: newSite?.location,
        zone: newSite?.zone,
        city: newSite?.city,
      } as any);
      setSitesList(prev => [created, ...prev]);
      toast.success('Site created', {
        description: `${created.name} - ${created.location}`
      });
      addNotification({
        type: 'info',
        title: 'New site created',
        message: `${created.name} at ${created.location}`,
        action: { label: 'View sites', link: '/admin' }
      });
    } catch (e: any) {
      toast.error('Unable to create site', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleUpdateSite = async (sitePayload: any) => {
    try {
      const updated = await updateSite(String(sitePayload?.id), {
        name: sitePayload?.name,
        codeIt: sitePayload?.codeIt,
        location: sitePayload?.location,
        zone: sitePayload?.zone,
        city: sitePayload?.city,
      } as any);
      setSitesList((prev) => prev.map((s: any) => (String(s.id) === String(updated.id) ? updated : s)));
      toast.success('Site updated', { description: updated.name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to update site', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleDeleteSite = async (site: any) => {
    const id = String(site?.id ?? '');
    if (!id) return;
    const name = String(site?.name ?? 'this site');
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      await removeSite(id);
      setSitesList((prev) => prev.filter((s: any) => String(s.id) !== id));
      toast.success('Site deleted', { description: name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to delete site', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddCategory = async (newCategory: any) => {
    try {
      const created = await addCategory({ id: newCategory?.id, name: newCategory?.name } as any);
      setCategoriesList(prev => [created, ...prev]);
      toast.success('Category created', {
        description: created.name
      });
      addNotification({
        type: 'info',
        title: 'New category created',
        message: created.name,
        action: { label: 'View categories', link: '/admin' }
      });
    } catch (e: any) {
      toast.error('Unable to create category', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleUpdateCategory = async (categoryPayload: any) => {
    try {
      const updated = await updateCategory(String(categoryPayload?.id), {
        name: categoryPayload?.name,
      } as any);
      setCategoriesList((prev) => prev.map((c: any) => (String(c.id) === String(updated.id) ? updated : c)));
      toast.success('Category updated', { description: updated.name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to update category', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleDeleteCategory = async (category: any) => {
    const id = String(category?.id ?? '');
    if (!id) return;
    const name = String(category?.name ?? 'this category');
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      await removeCategory(id);
      setCategoriesList((prev) => prev.filter((c: any) => String(c.id) !== id));
      toast.success('Category deleted', { description: name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to delete category', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddSupplier = async (newSupplier: any) => {
    try {
      const created = await addSupplier({
        id: newSupplier?.id,
        name: newSupplier?.name,
        contact: newSupplier?.contact,
      } as any);
      setSuppliersList(prev => [created, ...prev]);
      toast.success('Supplier created', {
        description: `${created.name} - Contact: ${created.contact}`
      });
      addNotification({
        type: 'info',
        title: 'New supplier created',
        message: `${created.name} - ${created.contact}`,
        action: { label: 'View suppliers', link: '/admin' }
      });
    } catch (e: any) {
      toast.error('Unable to create supplier', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleUpdateSupplier = async (supplierPayload: any) => {
    try {
      const updated = await updateSupplier(String(supplierPayload?.id), {
        name: supplierPayload?.name,
        contact: supplierPayload?.contact,
      } as any);
      setSuppliersList((prev) => prev.map((s: any) => (String(s.id) === String(updated.id) ? updated : s)));
      toast.success('Supplier updated', { description: updated.name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to update supplier', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    const id = String(supplier?.id ?? '');
    if (!id) return;
    const name = String(supplier?.name ?? 'this supplier');
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      await removeSupplier(id);
      setSuppliersList((prev) => prev.filter((s: any) => String(s.id) !== id));
      toast.success('Supplier deleted', { description: name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to delete supplier', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddDepartment = async (newDepartment: any) => {
    try {
      const created = await addDepartment(newDepartment);
      const normalized = normalizeDepartment(created);
      setDepartmentsList(prev => [normalized, ...prev]);
      toast.success('Department created', { description: normalized.name });
      addNotification({
        type: 'info',
        title: 'New department created',
        message: normalized.name,
        action: { label: 'View departments', link: '/admin' },
      });
    } catch (e: any) {
      toast.error('Unable to create department', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleUpdateDepartment = async (deptPayload: any) => {
    try {
      const updated = await updateDepartment(String(deptPayload?.id), {
        name: deptPayload?.name,
        code: deptPayload?.code,
        head: deptPayload?.head,
        members: deptPayload?.members,
      } as any);
      const normalized = normalizeDepartment(updated);
      setDepartmentsList((prev) => prev.map((d) => (String(d.id) === String(normalized.id) ? normalized : d)));
      toast.success('Department updated', { description: normalized.name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to update department', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleDeleteDepartment = async (dept: DepartmentRow) => {
    const id = String(dept?.id ?? '');
    if (!id) return;
    const name = String(dept?.name ?? 'this department');
    if (!window.confirm(`Delete ${name}?`)) return;

    try {
      await removeDepartment(id);
      setDepartmentsList((prev) => prev.filter((d) => String(d.id) !== id));
      toast.success('Department deleted', { description: name });
      void refreshAll();
    } catch (e: any) {
      toast.error('Unable to delete department', { description: String(e?.message ?? 'Network error') });
    }
  };

  const handleAddRole = (newRole: any) => {
    const role = String(newRole?.role ?? '').trim();
    const desc = String(newRole?.desc ?? '').trim();
    if (!role) {
      toast.error('Invalid role');
      return;
    }

    const item: RoleRow = {
      id: String(newRole?.id ?? `ROLE-${Date.now()}`),
      role,
      desc,
    };

    setRolesList(prev => [item, ...prev]);
    toast.success('Role created', { description: role });
    addNotification({
      type: 'info',
      title: 'New role created',
      message: role,
      action: { label: 'View roles', link: '/admin' },
    });
  };

  const tabs = [
    { id: 'users' as TabType, label: 'Users', icon: <Users className="w-5 h-5" /> },
    { id: 'roles' as TabType, label: 'Roles', icon: <Users className="w-5 h-5" /> },
    { id: 'sites' as TabType, label: 'Sites', icon: <Building2 className="w-5 h-5" /> },
    { id: 'categories' as TabType, label: 'Categories', icon: <Package className="w-5 h-5" /> },
    { id: 'suppliers' as TabType, label: 'Suppliers', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'departments' as TabType, label: 'Departments', icon: <Building2 className="w-5 h-5" /> }
  ];

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Administration</h1>
        <p className="text-muted-foreground mt-1">Master data and user management</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-4 overflow-x-auto relative">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
                `relative py-3 px-4 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 whitespace-nowrap ` +
                (activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground')
              }
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="adminTabPill"
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 shadow-sm"
                  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
                />
              )}
              <span className="relative z-10">{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
            </motion.button>
          ))}
        </nav>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div
            key="users"
            className="premium-surface"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Users</h2>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block relative">
                <input
                  ref={userSearchInputRef}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search..."
                  className="px-3 pr-9 py-2 border border-border bg-card text-foreground placeholder:text-muted-foreground rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
                />
                {userSearch.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUserSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                onClick={() => {
                  setEditingUser(null);
                  setIsUserModalOpen(true);
                }}
              >
                Add user
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <input
              ref={userPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void handlePhotoFile(file);
                e.target.value = '';
              }}
            />

            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openPhotoPicker(String((user as any).id))}
                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          title="Change profile photo"
                        >
                          <Avatar className="size-9 ring-1 ring-border/60">
                            <AvatarImage src={String((user as any).avatarUrl ?? '') || undefined} alt={String((user as any).name ?? 'User')} />
                            <AvatarFallback className="text-xs font-semibold">
                              {initialsOf(String((user as any).name ?? ''))}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <span className="font-medium text-foreground">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'Manager' ? 'bg-blue-100 text-blue-700' :
                        user.role === 'Technician' ? 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-300' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        type="button"
                        onClick={() => openPhotoPicker(String((user as any).id))}
                        className="text-muted-foreground hover:text-foreground font-medium"
                      >
                        Photo
                      </button>
                      <button
                        className="text-primary hover:opacity-90 font-medium"
                        type="button"
                        onClick={() => {
                          setEditingUser(user);
                          setIsUserModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-600 hover:text-red-700 font-medium"
                        type="button"
                        onClick={() => void handleDeleteUser(user)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <motion.div
            key="roles"
            className="premium-surface"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Roles & Permissions</h2>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              onClick={() => setIsRoleModalOpen(true)}
            >
              Add role
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Users
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {rolesWithCount.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{r.role}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{r.desc}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{r.usersCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {/* Sites Tab */}
        {activeTab === 'sites' && (
          <motion.div
            key="sites"
            className="premium-surface"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Sites</h2>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              onClick={() => {
                setEditingSite(null);
                setIsSiteModalOpen(true);
              }}
            >
              Add site
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Site
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ville
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Zone industrielle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Code site IT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sitesList.map((site) => (
                  <tr key={site.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{site.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {String((site as any)?.location ?? '').trim() || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {String((site as any)?.zone ?? '').trim() || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {String((site as any)?.codeIt ?? '').trim() || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        type="button"
                        className="text-primary hover:opacity-90 font-medium"
                        onClick={() => {
                          setEditingSite(site);
                          setIsSiteModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700 font-medium"
                        onClick={() => void handleDeleteSite(site)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <motion.div
            key="categories"
            className="premium-surface"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Categories</h2>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
            >
              Add category
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Assets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {categoriesList.map((category) => (
                  <tr key={category.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{category.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {assets.filter(a => a.category === category.name).length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        type="button"
                        className="text-primary hover:opacity-90 font-medium"
                        onClick={() => {
                          setEditingCategory(category);
                          setIsCategoryModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700 font-medium"
                        onClick={() => void handleDeleteCategory(category)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {/* Suppliers Tab */}
        {activeTab === 'suppliers' && (
          <motion.div
            key="suppliers"
            className="premium-surface"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Suppliers</h2>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              onClick={() => {
                setEditingSupplier(null);
                setIsSupplierModalOpen(true);
              }}
            >
              Add supplier
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full premium-table">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {suppliersList.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-foreground">{supplier.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {supplier.contact}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        type="button"
                        className="text-primary hover:opacity-90 font-medium"
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setIsSupplierModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700 font-medium"
                        onClick={() => void handleDeleteSupplier(supplier)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </motion.div>
        )}

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <motion.div
            key="departments"
            className="premium-surface"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* Existing departments markup follows */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Departments</h2>
              <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                onClick={() => {
                  setEditingDepartment(null);
                  setIsDepartmentModalOpen(true);
                }}
              >
                Add department
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full premium-table">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Head
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Members
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {departmentsList.map((dept) => (
                    <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-foreground">{dept.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{dept.code || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{dept.head || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{typeof dept.members === 'number' ? dept.members : 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          type="button"
                          className="text-primary hover:opacity-90 font-medium"
                          onClick={() => {
                            setEditingDepartment(dept);
                            setIsDepartmentModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-700 font-medium"
                          onClick={() => void handleDeleteDepartment(dept)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AddUserModal 
        isOpen={isUserModalOpen} 
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(null);
        }} 
        onAdd={handleAddUser}
        initialUser={editingUser}
        onUpdate={handleUpdateUser}
      />

      {/* Add Site Modal */}
      <AddSiteModal 
        isOpen={isSiteModalOpen} 
        onClose={() => {
          setIsSiteModalOpen(false);
          setEditingSite(null);
        }} 
        onAdd={handleAddSite}
        initialSite={editingSite}
        onUpdate={handleUpdateSite}
      />

      {/* Add Category Modal */}
      <AddCategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }} 
        onAdd={handleAddCategory}
        initialCategory={editingCategory}
        onUpdate={handleUpdateCategory}
      />

      {/* Add Supplier Modal */}
      <AddSupplierModal 
        isOpen={isSupplierModalOpen} 
        onClose={() => {
          setIsSupplierModalOpen(false);
          setEditingSupplier(null);
        }} 
        onAdd={handleAddSupplier}
        initialSupplier={editingSupplier}
        onUpdate={handleUpdateSupplier}
      />

      {/* Add Department Modal */}
      <AddDepartmentModal 
        isOpen={isDepartmentModalOpen} 
        onClose={() => {
          setIsDepartmentModalOpen(false);
          setEditingDepartment(null);
        }} 
        onAdd={handleAddDepartment}
        initialDepartment={editingDepartment}
        onUpdate={handleUpdateDepartment}
      />

      {/* Add Role Modal */}
      <AddRoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onAdd={handleAddRole}
      />
    </div>
  );
}