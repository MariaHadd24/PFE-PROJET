import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Shield, User, UserPlus } from 'lucide-react';
import type { UserRole } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: any) => void;
  initialUser?: any;
  onUpdate?: (user: any) => void;
}

export function AddUserModal({ isOpen, onClose, onAdd, initialUser, onUpdate }: AddUserModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const isEdit = useMemo(() => !!initialUser, [initialUser]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'Reader' as UserRole,
    avatarUrl: '',
    signatureData: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    if (!initialUser) {
      setFormData({
        name: '',
        email: '',
        role: 'Reader' as UserRole,
        avatarUrl: '',
        signatureData: '',
        password: '',
        confirmPassword: '',
      });
      setErrors({});
      return;
    }

    setFormData({
      name: String(initialUser?.name ?? ''),
      email: String(initialUser?.email ?? ''),
      role: (String((initialUser as any)?.role ?? 'Reader') as UserRole) || 'Reader',
      avatarUrl: String((initialUser as any)?.avatarUrl ?? ''),
      signatureData: String((initialUser as any)?.signatureData ?? ''),
      password: '',
      confirmPassword: '',
    });
    setErrors({});
  }, [isOpen, initialUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const initials = useMemo(() => {
    const name = String(formData.name ?? '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? 'U';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return `${a}${b}`.toUpperCase();
  }, [formData.name]);

  const handleAvatarFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, avatarUrl: 'Please choose an image file' }));
      return;
    }
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });

    setFormData((prev) => ({ ...prev, avatarUrl: dataUrl }));
    setErrors((prev) => ({ ...prev, avatarUrl: '' }));
  };

  const handleSignatureFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, signatureData: 'Please choose an image file' }));
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error('Unable to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });

    setFormData((prev) => ({ ...prev, signatureData: dataUrl }));
    setErrors((prev) => ({ ...prev, signatureData: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!isEdit) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Confirmation is required';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (!isEdit && !formData.signatureData.trim()) {
      newErrors.signatureData = 'Signature is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      role: 'Reader',
      avatarUrl: '',
      signatureData: '',
      password: '',
      confirmPassword: '',
    });
    setErrors({});
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const userPayload = {
      id: String((initialUser as any)?.id ?? `USR-${Date.now()}`),
      name: formData.name.trim(),
      email: formData.email.toLowerCase().trim(),
      role: formData.role,
      avatarUrl: formData.avatarUrl,
      signatureData: formData.signatureData || undefined,
    };

    if (isEdit) {
      (onUpdate ?? onAdd)(userPayload);
    } else {
      onAdd({
        ...userPayload,
        password: formData.password,
      });
    }

    handleClose();
  };

  const roleInfo: Record<UserRole, { label: string; description: string; color: string }> = {
    Admin: {
      label: 'Administrateur IT',
      description: 'Paramétrage global, gestion référentiels, droits, supervision',
      color: 'bg-purple-50 border-purple-200',
    },
    Manager: {
      label: 'Manager',
      description: "Validation des demandes d’achat, suivi KPI",
      color: 'bg-blue-50 border-blue-200',
    },
    Technician: {
      label: 'Technicien',
      description: 'Inventaire, mouvements, affectations, maintenance',
      color: 'bg-green-50 border-green-200',
    },
    Reader: {
      label: 'Lecteur',
      description: 'Consultation uniquement (tableaux, fiches, Dashboard)',
      color: 'bg-gray-50 border-gray-200',
    },
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {isEdit ? 'Edit user' : 'New user'}
              </span>
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update user details and role.'
                : 'Create a user account and assign a role.'}
            </DialogDescription>
          </DialogHeader>

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Personal information
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {/* Profile photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profile photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                    {formData.avatarUrl ? (
                      <img src={formData.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-gray-600">{initials}</span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void handleAvatarFile(file);
                      e.target.value = '';
                    }}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Upload
                    </button>
                    {formData.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, avatarUrl: '' }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                    <div className="text-xs text-gray-500">PNG/JPG recommended</div>
                  </div>
                </div>
                {errors.avatarUrl && <p className="mt-1 text-sm text-red-600">{errors.avatarUrl}</p>}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="jean.dupont@company.com"
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              {/* Signature number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signature <span className="text-red-500">*</span>
                </label>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleSignatureFile(file);
                    e.target.value = '';
                  }}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Upload signature
                  </button>

                  {formData.signatureData ? (
                    <div className="h-12 w-48 border border-gray-200 rounded bg-white overflow-hidden flex items-center justify-center">
                      <img src={formData.signatureData} alt="Signature" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-12 w-48 border border-gray-200 rounded bg-gray-50 flex items-center justify-center">
                      <span className="text-xs text-gray-500">No signature selected</span>
                    </div>
                  )}
                </div>

                {errors.signatureData && <p className="mt-1 text-sm text-red-600">{errors.signatureData}</p>}
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Role & permissions
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none"
              >
                {Object.entries(roleInfo).map(([role, info]) => (
                  <option key={role} value={role}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`p-4 rounded-lg border ${roleInfo[formData.role].color}`}>
              <p className="text-sm font-medium text-gray-900 mb-1">{roleInfo[formData.role].label}</p>
              <p className="text-sm text-gray-700">{roleInfo[formData.role].description}</p>
            </div>
          </div>

          {!isEdit && (
            <>
              <div className="space-y-4 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900">Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimum 6 characters"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter password"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none ${
                        errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm text-primary">
                  <strong>Security note:</strong> The user will receive an email with their credentials. They can change
                  their password on first login.
                </p>
              </div>
            </>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={handleClose}
              className="border border-border bg-card text-foreground px-4 py-2 rounded-lg hover:bg-muted/30 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              {isEdit ? 'Save changes' : 'Create user'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
