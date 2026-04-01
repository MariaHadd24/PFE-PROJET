import React, { useState } from 'react';
import { X, TruckIcon } from 'lucide-react';
import type { Asset, MovementType, Site, User } from '../../types';
import { useLockBodyScroll } from '../../lib/useLockBodyScroll';

interface AddMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (movement: any) => void;
  assets: Asset[];
  sites: Site[];
  users: User[];
}

export function AddMovementModal({ isOpen, onClose, onAdd, assets, sites, users: usersList }: AddMovementModalProps) {
  useLockBodyScroll(isOpen);
  const [formData, setFormData] = useState({
    assetId: '',
    type: 'Entry' as MovementType,
    sourceSite: '',
    destinationSite: '',
    date: new Date().toISOString().split('T')[0],
    userId: '',
    comment: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Reset source/destination based on type
    if (name === 'type') {
      if (value === 'Entry') {
        setFormData(prev => ({ ...prev, sourceSite: '', destinationSite: '' }));
      } else if (value === 'Exit') {
        setFormData(prev => ({ ...prev, destinationSite: '' }));
      }
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.assetId) {
      newErrors.assetId = 'Asset is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.userId) {
      newErrors.userId = 'User is required';
    }

    // Validate based on type
    if (formData.type === 'Transfer') {
      if (!formData.sourceSite) {
        newErrors.sourceSite = 'Source site is required for a transfer';
      }
      if (!formData.destinationSite) {
        newErrors.destinationSite = 'Destination site is required for a transfer';
      }
      if (formData.sourceSite === formData.destinationSite) {
        newErrors.destinationSite = 'Destination site must be different from the source site';
      }
    } else if (formData.type === 'Entry') {
      if (!formData.destinationSite) {
        newErrors.destinationSite = 'Destination site is required for an entry';
      }
    } else if (formData.type === 'Exit') {
      if (!formData.sourceSite) {
        newErrors.sourceSite = 'Source site is required for an exit';
      }
    }

    if (!formData.comment.trim()) {
      newErrors.comment = 'Comment is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const selectedAsset = assets.find(a => a.id === formData.assetId);
    const selectedUser = usersList.find(u => u.id === formData.userId);

    const newMovement = {
      id: `MOV-${Date.now()}`,
      assetId: formData.assetId,
      assetTag: selectedAsset?.assetTag || '',
      type: formData.type,
      sourceSite: formData.sourceSite || undefined,
      destinationSite: formData.destinationSite || undefined,
      date: formData.date,
      user: selectedUser?.name || '',
      comment: formData.comment
    };

    onAdd(newMovement);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      assetId: '',
      type: 'Entry',
      sourceSite: '',
      destinationSite: '',
      date: new Date().toISOString().split('T')[0],
      userId: '',
      comment: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      ></div>

      <div className="flex min-h-full items-start justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          <div className="sticky top-0 bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <TruckIcon className="w-6 h-6" />
              <h2 className="text-xl font-bold">New stock movement</h2>
            </div>
            <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Asset Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset <span className="text-red-500">*</span>
                </label>
                <select
                  name="assetId"
                  value={formData.assetId}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.assetId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.assetTag} - {asset.model}
                    </option>
                  ))}
                </select>
                {errors.assetId && <p className="mt-1 text-sm text-red-600">{errors.assetId}</p>}
              </div>

              {/* Movement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Movement type <span className="text-red-500">*</span>
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none"
                >
                  <option value="Entry">Entry</option>
                  <option value="Exit">Exit</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>

              {/* Source Site (for Transfer and Exit) */}
              {(formData.type === 'Transfer' || formData.type === 'Exit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source site <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="sourceSite"
                    value={formData.sourceSite}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                      errors.sourceSite ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select...</option>
                    {sites.map(site => (
                      <option key={site.id} value={site.name}>{site.name}</option>
                    ))}
                  </select>
                  {errors.sourceSite && <p className="mt-1 text-sm text-red-600">{errors.sourceSite}</p>}
                </div>
              )}

              {/* Destination Site (for Transfer and Entry) */}
              {(formData.type === 'Transfer' || formData.type === 'Entry') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination site <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="destinationSite"
                    value={formData.destinationSite}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                      errors.destinationSite ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select...</option>
                    {sites.map(site => (
                      <option key={site.id} value={site.name}>{site.name}</option>
                    ))}
                  </select>
                  {errors.destinationSite && <p className="mt-1 text-sm text-red-600">{errors.destinationSite}</p>}
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Movement date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
              </div>

              {/* User */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Responsible <span className="text-red-500">*</span>
                </label>
                <select
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none ${
                    errors.userId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  {usersList.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                {errors.userId && <p className="mt-1 text-sm text-red-600">{errors.userId}</p>}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment <span className="text-red-500">*</span>
              </label>
              <textarea
                name="comment"
                value={formData.comment}
                onChange={handleChange}
                rows={3}
                placeholder="Describe the movement..."
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1B4F91] focus:border-transparent outline-none resize-none ${
                  errors.comment ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.comment && <p className="mt-1 text-sm text-red-600">{errors.comment}</p>}
            </div>

            {/* Info based on type */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>
                  {formData.type === 'Entry' && 'Entry: '}
                  {formData.type === 'Exit' && 'Exit: '}
                  {formData.type === 'Transfer' && 'Transfer: '}
                </strong>
                {formData.type === 'Entry' && 'New asset arriving at a site.'}
                {formData.type === 'Exit' && 'Asset leaving a site permanently.'}
                {formData.type === 'Transfer' && 'Moving an asset from one site to another.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#1B4F91] to-[#2563EB] text-white rounded-lg hover:shadow-lg hover:scale-[1.02] font-medium transition-all"
              >
                Save movement
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
